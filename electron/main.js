const { app, BrowserWindow, ipcMain, dialog } = require("electron");
const path = require("path");
const fs = require("fs");
const http = require("http");
const net = require("net");
const { spawn, execSync } = require("child_process");
const log = require("electron-log");
const { autoUpdater } = require("electron-updater");
const getPort = require("get-port");
const findProcess = require("find-process");
// License module — isolated, no impact on updater or inventory backend
const licenseService = require("./license/licenseService");

/* ---------------- LOAD .env (no dotenv dependency) ---------------- */
(function loadEnv() {
  const envPath = path.join(__dirname, "..", ".env");
  if (!fs.existsSync(envPath)) return;
  const lines = fs.readFileSync(envPath, "utf8").split("\n");
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    const value = trimmed.slice(eqIdx + 1).trim().replace(/^["']|["']$/g, "");
    if (key && !(key in process.env)) {
      process.env[key] = value;
    }
  }
  log.info("[env] .env loaded from:", envPath);
})();

// Configure electron-log to write to userData/logs/
log.transports.file.resolvePathFn = () =>
  path.join(app.getPath("userData"), "logs", "main.log");
log.transports.file.level = "info";
log.transports.console.level = "debug";

// Production safety flag
const isDev = !app.isPackaged;

/* ---------------- USERDATA MIGRATION ---------------- */
// Migrate old "Eyerventory" userData to "EyerFlow" if needed
(function migrateUserData() {
  const oldDir = path.join(app.getPath("appData"), "Eyerventory");
  const newDir = app.getPath("userData"); // now resolves to .../EyerFlow
  if (fs.existsSync(oldDir) && !fs.existsSync(path.join(newDir, ".migrated"))) {
    try {
      if (!fs.existsSync(newDir)) fs.mkdirSync(newDir, { recursive: true });
      for (const entry of fs.readdirSync(oldDir)) {
        const src = path.join(oldDir, entry);
        const dest = path.join(newDir, entry);
        if (!fs.existsSync(dest)) fs.cpSync(src, dest, { recursive: true });
      }
      fs.writeFileSync(path.join(newDir, ".migrated"), "1");
      log.info("[migration] userData migrated from Eyerventory → EyerFlow");
    } catch (err) {
      log.warn("[migration] userData migration failed (non-critical):", err.message);
    }
  }
})();

let mainWindow;
let backendProcess = null;
let licenseBackendProcess;  // License service process
let backendSpawnError = null; // set if spawn itself fails
const BACKEND_HOST = "127.0.0.1";
let BACKEND_PORT = null; // Will be dynamically allocated
const LICENSE_PORT = 8001; // Fixed port for license service
const PORT_RANGE_START = 8000;
const PORT_RANGE_END = 8100;
const MAX_STARTUP_RETRIES = 3;

/* ---------------- BACKEND READY CHECK ---------------- */
/**
 * Polls /api/health until the backend responds or we time out.
 * Rejects immediately if the spawn already errored.
 */
function waitForBackend(maxWaitMs = 90000, intervalMs = 600) {
  return new Promise((resolve, reject) => {
    if (!BACKEND_PORT) {
      return reject(new Error("Backend port not allocated"));
    }

    const deadline = Date.now() + maxWaitMs;

    function attempt() {
      // If spawn already failed, no point polling
      if (backendSpawnError) {
        return reject(backendSpawnError);
      }

      const req = http.get(`http://${BACKEND_HOST}:${BACKEND_PORT}/api/health`, (res) => {
        if (res.statusCode < 500) {
          log.info("[backend] health check passed on port", BACKEND_PORT);
          resolve();
        } else {
          retry();
        }
        // Drain the response so the socket closes
        res.resume();
      });

      req.on("error", retry);
      req.setTimeout(500, () => {
        req.destroy();
        retry();
      });
    }

    function retry() {
      if (Date.now() >= deadline) {
        return reject(
          new Error(
            "Backend did not start within 90 seconds.\n\n" +
            "Check logs at: " + path.join(app.getPath("userData"), "logs", "main.log")
          )
        );
      }
      setTimeout(attempt, intervalMs);
    }

    attempt();
  });
}

/* ---------------- PORT & PROCESS MANAGEMENT ---------------- */

/**
 * Check if a port is in use
 */
function isPortInUse(port, host = BACKEND_HOST) {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.once("error", (err) => {
      if (err.code === "EADDRINUSE") {
        resolve(true);
      } else {
        log.warn(`[port-check] error on ${host}:${port}:`, err.message);
        resolve(false);
      }
    });
    server.once("listening", () => {
      server.close(() => resolve(false));
    });
    server.listen(port, host);
  });
}

/**
 * Find and kill processes using a specific port on Windows
 */
async function killProcessOnPort(port) {
  if (process.platform !== "win32") {
    log.warn("[process-cleanup] killProcessOnPort only implemented for Windows");
    return false;
  }

  try {
    log.info(`[process-cleanup] searching for processes on port ${port}...`);
    const processList = await findProcess("port", port);
    
    if (processList.length === 0) {
      log.info(`[process-cleanup] no process found on port ${port}`);
      return false;
    }

    for (const proc of processList) {
      log.info(`[process-cleanup] found process: PID=${proc.pid} name=${proc.name} on port ${port}`);
      try {
        execSync(`taskkill /F /PID ${proc.pid}`, { windowsHide: true });
        log.info(`[process-cleanup] killed PID ${proc.pid}`);
      } catch (err) {
        log.warn(`[process-cleanup] failed to kill PID ${proc.pid}:`, err.message);
      }
    }
    
    // Wait a bit for the port to be released
    await new Promise(resolve => setTimeout(resolve, 1000));
    return true;
  } catch (err) {
    log.error("[process-cleanup] error finding/killing process:", err.message);
    return false;
  }
}

/**
 * Clean up stale backend processes (Python/Node/Electron processes that might be holding ports)
 */
async function cleanupStaleProcesses() {
  if (process.platform !== "win32") {
    return;
  }

  try {
    log.info("[process-cleanup] checking for stale backend processes...");
    
    // Look for uvicorn, python, and backend.exe processes
    const processNames = ["uvicorn", "python.exe", "backend.exe"];
    
    for (const name of processNames) {
      try {
        const processList = await findProcess("name", name);
        for (const proc of processList) {
          // Skip our own process
          if (proc.pid === process.pid) continue;
          
          // Check if it's a backend process by looking at command line
          const cmdLine = proc.cmd || "";
          if (cmdLine.includes("backend") || cmdLine.includes("uvicorn") || cmdLine.includes("main:app")) {
            log.info(`[process-cleanup] found stale backend process: PID=${proc.pid} cmd=${cmdLine}`);
            try {
              execSync(`taskkill /F /PID ${proc.pid}`, { windowsHide: true });
              log.info(`[process-cleanup] killed stale process PID ${proc.pid}`);
            } catch (err) {
              log.warn(`[process-cleanup] failed to kill PID ${proc.pid}:`, err.message);
            }
          }
        }
      } catch (err) {
        // Process not found or error - continue
        log.debug(`[process-cleanup] no ${name} processes found or error:`, err.message);
      }
    }
    
    // Wait for processes to fully terminate
    await new Promise(resolve => setTimeout(resolve, 1500));
    log.info("[process-cleanup] stale process cleanup complete");
  } catch (err) {
    log.error("[process-cleanup] error during cleanup:", err.message);
  }
}

/**
 * Allocate a free port in the specified range
 */
async function allocatePort(preferredPort = PORT_RANGE_START) {
  try {
    // First try the preferred port
    const portInUse = await isPortInUse(preferredPort);
    if (!portInUse) {
      log.info(`[port-allocation] preferred port ${preferredPort} is available`);
      return preferredPort;
    }

    log.warn(`[port-allocation] preferred port ${preferredPort} is in use, trying to free it...`);
    
    // Try to kill the process using the port
    const killed = await killProcessOnPort(preferredPort);
    if (killed) {
      const stillInUse = await isPortInUse(preferredPort);
      if (!stillInUse) {
        log.info(`[port-allocation] freed port ${preferredPort}`);
        return preferredPort;
      }
    }

    // If we couldn't free the preferred port, find an alternative
    log.info(`[port-allocation] searching for alternative port in range ${PORT_RANGE_START}-${PORT_RANGE_END}...`);
    const port = await getPort({ port: getPort.makeRange(PORT_RANGE_START, PORT_RANGE_END) });
    log.info(`[port-allocation] allocated alternative port ${port}`);
    return port;
  } catch (err) {
    log.error("[port-allocation] failed to allocate port:", err.message);
    throw new Error(`Failed to allocate port: ${err.message}`);
  }
}

/* ---------------- LICENSE BACKEND START ---------------- */
async function startLicenseBackend() {
  const licenseDbPath = path.join(app.getPath("userData"), "license.db");
  const env = { ...process.env, LICENSE_DB_PATH: licenseDbPath };

  let executable, args, options;
  // license_service/ folder — this is the cwd for both dev and prod
  const licenseServiceDir = path.join(app.getAppPath(), "license_service");

  if (isDev) {
    executable = path.join(app.getAppPath(), "venv", "Scripts", "python.exe");
    if (!fs.existsSync(executable)) {
      log.warn("[license-backend] Python venv not found — license server will not start");
      return;
    }
    // cwd = license_service/ so bare imports (database, models, service) resolve correctly
    args = ["-m", "uvicorn", "main:app", "--host", "127.0.0.1", "--port", String(LICENSE_PORT)];
    options = { env, windowsHide: true, detached: false, cwd: licenseServiceDir };
  } else {
    const backendDir = path.join(process.resourcesPath, "backend");
    executable = path.join(backendDir, "license_service.exe");
    
    if (!fs.existsSync(executable)) {
      log.error("[license-backend] license_service.exe not found at:", executable);
      log.error("[license-backend] Contents of backendDir:", fs.readdirSync(backendDir).join(", "));
      log.warn("[license-backend] License service will not be available");
      return;
    }
    
    args = [];
    options = { env, windowsHide: true, detached: false, cwd: backendDir };
  }

  // Check if license port is in use
  const portInUse = await isPortInUse(LICENSE_PORT);
  if (portInUse) {
    log.warn(`[license-backend] port ${LICENSE_PORT} is in use, attempting to free it...`);
    await killProcessOnPort(LICENSE_PORT);
    
    // Verify port is now free
    const stillInUse = await isPortInUse(LICENSE_PORT);
    if (stillInUse) {
      log.error(`[license-backend] could not free port ${LICENSE_PORT}, license service will not start`);
      return;
    }
  }

  log.info(`[license-backend] starting on port ${LICENSE_PORT}...`);
  log.info(`[license-backend] executable: ${executable}`);
  
  licenseBackendProcess = spawn(executable, args, options);
  licenseBackendProcess.stdout?.on("data", (d) => log.info("[license:stdout]", d.toString().trim()));
  licenseBackendProcess.stderr?.on("data", (d) => log.info("[license:stderr]", d.toString().trim()));
  licenseBackendProcess.on("error", (err) => log.error("[license-backend] spawn error:", err.message));
  licenseBackendProcess.on("exit", (code) => log.info("[license-backend] exited code:", code));
  
  if (licenseBackendProcess.pid) {
    log.info("[license-backend] started with PID:", licenseBackendProcess.pid);
  }
}

/* ---------------- BACKEND START ---------------- */
async function startBackend() {
  if (backendProcess) {
    log.warn("[backend] already running, skipping duplicate start");
    return;
  }

  // Reset error state
  backendSpawnError = null;

  // Step 1: Clean up any stale processes
  log.info("[backend] ========== BACKEND STARTUP SEQUENCE ==========");
  await cleanupStaleProcesses();

  // Step 2: Allocate a port (with retry logic built-in)
  try {
    BACKEND_PORT = await allocatePort(PORT_RANGE_START);
    log.info(`[backend] allocated port: ${BACKEND_PORT}`);
  } catch (err) {
    const msg = `Failed to allocate port for backend:\n\n${err.message}\n\nPlease close any applications using ports ${PORT_RANGE_START}-${PORT_RANGE_END}.`;
    log.error("[backend]", msg);
    dialog.showErrorBox("Backend Port Allocation Failed", msg);
    app.quit();
    return;
  }

  const dbPath = path.join(app.getPath("userData"), "inventory.db");

  // Ensure userData dir exists (it always should, but be safe)
  const userDataDir = app.getPath("userData");
  if (!fs.existsSync(userDataDir)) {
    fs.mkdirSync(userDataDir, { recursive: true });
  }

  log.info("[backend] DB_PATH =", dbPath);
  log.info("[backend] BACKEND_PORT =", BACKEND_PORT);
  log.info("[backend] Environment: " + (isDev ? "DEVELOPMENT" : "PRODUCTION (app.isPackaged=true)"));

  const env = {
    ...process.env,
    DB_PATH: dbPath,
    BACKEND_PORT: String(BACKEND_PORT),
  };

  let executable, args, options, backendDir;

  if (app.isPackaged) {
    // Production: backend.exe in resources/backend folder (via extraResources)
    backendDir = path.join(process.resourcesPath, "backend");
    executable = path.join(backendDir, "backend.exe");

    log.info("[backend] mode=production (backend.exe)");
    log.info("[backend] process.resourcesPath:", process.resourcesPath);
    log.info("[backend] backendDir:", backendDir);
    log.info("[backend] expectedExecutable:", executable);

    if (!fs.existsSync(backendDir)) {
      const msg = `Backend resources folder not found at:\n${backendDir}\n\nThe app was not packaged correctly.`;
      log.error("[backend]", msg);
      log.error("[backend] process.resourcesPath:", process.resourcesPath);
      log.error("[backend] Contents of process.resourcesPath:", fs.readdirSync(process.resourcesPath).join(", "));
      dialog.showErrorBox("Backend Resources Missing", msg);
      app.quit();
      return;
    }

    if (!fs.existsSync(executable)) {
      const msg = `backend.exe not found at:\n${executable}\n\nThe app may not have been built correctly.`;
      log.error("[backend]", msg);
      log.error("[backend] Contents of backendDir:", fs.readdirSync(backendDir).join(", "));
      dialog.showErrorBox("Backend Executable Missing", msg);
      app.quit();
      return;
    }

    args = [];
    options = {
      env,
      windowsHide: true,
      detached: false,
      cwd: backendDir
    };
  } else {
    // Development: using Python + uvicorn for live reload during development
    executable = path.join(app.getAppPath(), "venv", "Scripts", "python.exe");

    if (!fs.existsSync(executable)) {
      const msg = `Python executable not found at:\n${executable}\n\nEnsure the venv is set up correctly.\n\nRun: python -m venv venv && .\\venv\\Scripts\\activate && pip install -r requirements.txt`;
      log.error("[backend]", msg);
      dialog.showErrorBox("Python venv Not Found", msg);
      app.quit();
      return;
    }

    args = [
      "-m", "uvicorn", "backend.main:app",
      "--host", BACKEND_HOST,
      "--port", String(BACKEND_PORT),
      "--reload",
    ];
    options = { 
      env, 
      windowsHide: true, 
      detached: false,
      cwd: app.getAppPath()
    };
  }

  // Verify executable file is readable
  try {
    fs.accessSync(executable, fs.constants.X_OK);
    log.info("[backend] executable is readable and executable");
  } catch (err) {
    log.warn("[backend] executable may not be executable:", err.message);
  }

  log.info(`[backend] isDev=${isDev}`);
  log.info(`[backend] spawning: ${executable}`);
  log.info(`[backend] args: ${JSON.stringify(args)}`);
  log.info(`[backend] cwd: ${options.cwd}`);

  // Step 3: Spawn the backend process
  backendProcess = spawn(executable, args, options);

  backendProcess.stdout.on("data", (d) =>
    log.info("[backend:stdout]", d.toString().trim())
  );
  backendProcess.stderr.on("data", (d) =>
    log.info("[backend:stderr]", d.toString().trim())
  );

  backendProcess.on("error", (err) => {
    log.error("[backend] spawn error:", err);
    backendSpawnError = new Error(
      `Failed to start backend process.\n\n${err.message}\n\nExecutable: ${executable}\nArgs: ${JSON.stringify(args)}`
    );
  });

  backendProcess.on("exit", (code, signal) => {
    log.warn(`[backend] exited — code=${code} signal=${signal}`);
    backendProcess = null;
    
    // If backend crashes unexpectedly, log it
    if (code !== 0 && code !== null) {
      log.error(`[backend] unexpected exit with code ${code}`);
    }
  });

  // Log PID for debugging
  if (backendProcess.pid) {
    log.info(`[backend] started with PID: ${backendProcess.pid}`);
  } else {
    log.error("[backend] failed to get PID - process may not have started");
  }
  
  log.info("[backend] ===============================================");
}

/* ---------------- WINDOW ---------------- */
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 860,
    title: "EyerFlow",
    show: false,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      webSecurity: false,
    },
  });

  // Allow microphone + speech recognition permissions
  mainWindow.webContents.session.setPermissionRequestHandler((_webContents, permission, callback) => {
    const allowed = ["media", "microphone", "speech"].includes(permission);
    callback(allowed);
  });

  mainWindow.once("ready-to-show", () => mainWindow.show());

  if (isDev) {
    mainWindow.loadURL("http://localhost:5173");
    mainWindow.webContents.openDevTools();
  } else {
    // Production: load from packaged files
    const indexPath = path.join(process.resourcesPath, 'app.asar', 'frontend', 'dist', 'index.html');
    log.info("[window] loading:", indexPath);

    mainWindow.loadFile(indexPath).catch((err) => {
      log.error("[window] loadFile failed:", err);
      mainWindow.loadURL(
        `data:text/html,<pre style="font-family:monospace;padding:24px;color:red">` +
        `Failed to load UI\n\nPath: ${indexPath}\nError: ${err.message}\n` +
        `__dirname: ${__dirname}\nappPath: ${app.getAppPath()}\nresourcesPath: ${process.resourcesPath}</pre>`
      );
    });
  }

  // Prevent DevTools from opening in production
  if (!isDev) {
    mainWindow.webContents.on("before-input-event", (event, input) => {
      // Block F12, Ctrl+Shift+I, Ctrl+Shift+C, Ctrl+Shift+J, Ctrl+Shift+K
      if (
        input.key === "F12" ||
        (input.control && input.shift && input.key.toLowerCase() === "i") ||
        (input.control && input.shift && input.key.toLowerCase() === "c") ||
        (input.control && input.shift && input.key.toLowerCase() === "j") ||
        (input.control && input.shift && input.key.toLowerCase() === "k")
      ) {
        event.preventDefault();
      }
    });

    // Close DevTools if user somehow manages to open it
    mainWindow.webContents.on("devtools-opened", () => {
      mainWindow.webContents.closeDevTools();
    });
  }
}

/* ---------------- AUTO UPDATER ---------------- */
function setupAutoUpdate() {
  // Only check for updates in production
  if (isDev) {
    log.info("[updater] skipping auto-update check in development mode");
    return;
  }

  try {
    log.info("[updater] ========== AUTO UPDATE SYSTEM INIT ==========");
    log.info("[updater] app version:", app.getVersion());
    log.info("[updater] app.isPackaged:", app.isPackaged);
    log.info("[updater] platform:", process.platform);
    log.info("[updater] arch:", process.arch);

    // Configure updater
    autoUpdater.logger = log;
    autoUpdater.autoDownload = false;
    autoUpdater.autoInstallOnAppQuit = true;

    // Log update source configuration
    log.info("[updater] checking update config...");
    const updateConfig = autoUpdater.currentAppData;
    if (updateConfig) {
      log.info("[updater] currentAppData:", JSON.stringify(updateConfig, null, 2));
    }

    // ===== UPDATE AVAILABLE =====
    autoUpdater.on("update-available", async (info) => {
      log.info("[updater] UPDATE AVAILABLE");
      log.info("[updater]   current version: " + app.getVersion());
      log.info("[updater]   new version: " + info.version);
      log.info("[updater]   release date: " + info.releaseDate);
      log.info("[updater]   release notes: " + (info.releaseNotes ? "present" : "none"));

      const res = await dialog.showMessageBox(mainWindow, {
        type: "info",
        buttons: ["Download", "Later"],
        title: "🔄 Update Available",
        message: `Version ${info.version} is available.\n\nYour current version: ${app.getVersion()}\n\nDownload now?`,
        detail: `New version: ${info.version}\nRelease Date: ${info.releaseDate || "N/A"}`,
      });

      if (res.response === 0) {
        log.info("[updater] user accepted update download");
        dialog.showMessageBox(mainWindow, {
          type: "info",
          title: "Downloading Update",
          message: "Update is downloading. You will be notified when ready to install.",
        });
        autoUpdater.downloadUpdate();
      } else {
        log.info("[updater] user deferred update");
      }
    });

    // ===== UPDATE NOT AVAILABLE =====
    autoUpdater.on("update-not-available", (info) => {
      log.info("[updater] UPDATE NOT AVAILABLE");
      log.info("[updater]   current version: " + app.getVersion());
      log.info(`[updater]   latest version: ${info.version || 'unknown'}`);
      log.info("[updater]   you are on the latest version");
    });

    // ===== DOWNLOAD PROGRESS =====
    autoUpdater.on("download-progress", (progress) => {
      const percent = Math.round(progress.percent);
      const transferred = Math.round(progress.transferred / 1024 / 1024);
      const total = Math.round(progress.total / 1024 / 1024);
      log.info(
        `[updater] DOWNLOAD PROGRESS: ${percent}% (${transferred}MB / ${total}MB)`
      );
    });

    // ===== UPDATE DOWNLOADED =====
    autoUpdater.on("update-downloaded", async (info) => {
      log.info("[updater] UPDATE DOWNLOADED - ready to install");
      log.info(`[updater]   version: ${info.version}`);

      const res = await dialog.showMessageBox(mainWindow, {
        type: "info",
        buttons: ["Install & Restart", "Later"],
        title: "⬇️ Update Ready to Install",
        message: `Version ${info.version} is ready to install.\n\nRestart now to apply the update?`,
        detail: "The app will restart to complete the installation.",
      });

      if (res.response === 0) {
        log.info("[updater] user approved install and restart");
        autoUpdater.quitAndInstall();
      } else {
        log.info("[updater] user deferred install");
      }
    });

    // ===== ERROR HANDLER =====
    autoUpdater.on("error", (err) => {
      log.error("[updater] ERROR during update check:");
      log.error(`[updater]   message: ${err.message}`);
      log.error(`[updater]   code: ${err.code}`);
      log.error(`[updater]   stack: ${err.stack}`);
    });

    // ===== CHECKING FOR UPDATE =====
    autoUpdater.on("checking-for-update", () => {
      log.info("[updater] CHECKING FOR UPDATE...");
      log.info("[updater]   github owner: GymAurCode");
      log.info("[updater]   github repo: eyerflow-software");
      log.info("[updater]   current version: " + app.getVersion());
    });

    // Start update check after a short delay to ensure window is ready
    log.info("[updater] scheduling update check for 2 seconds from now...");
    setTimeout(() => {
      log.info("[updater] initiating update check");
      autoUpdater.checkForUpdatesAndNotify().catch((err) => {
        log.error(
          "[updater] checkForUpdatesAndNotify failed:",
          err.message
        );
      });
    }, 2000);

    log.info("[updater] ============================================");
  } catch (err) {
    log.error("[updater] FATAL - setup failed:", err.message);
    log.error(`[updater] stack: ${err.stack}`);
  }
}

/* ---------------- APP LIFECYCLE ---------------- */
app.commandLine.appendSwitch("enable-features", "WebSpeechAPI");
app.commandLine.appendSwitch("enable-speech-input");
app.commandLine.appendSwitch("allow-http-background-page");

app.whenReady().then(async () => {
  log.info("[app] ========== APPLICATION STARTING ==========");
  log.info("[app] version:", app.getVersion());
  log.info("[app] platform:", process.platform);
  log.info("[app] isPackaged:", app.isPackaged);
  
  try {
    // Start backend with robust error handling
    await startBackend();
    
    // Start license service (non-blocking)
    await startLicenseBackend();

    // Wait for backend to be ready
    log.info("[app] waiting for backend to be ready...");
    await waitForBackend();
    log.info("[app] backend ready — creating window");
  } catch (err) {
    log.error("[app] FATAL: backend failed to start:", err.message);
    log.error("[app] stack:", err.stack);
    
    const response = await dialog.showMessageBox({
      type: "error",
      title: "Backend Failed to Start",
      message: "The application backend could not start.",
      detail: err.message + "\n\nWould you like to retry?",
      buttons: ["Retry", "View Logs", "Exit"],
      defaultId: 0,
      cancelId: 2
    });

    if (response.response === 0) {
      // Retry
      log.info("[app] user requested retry, restarting app...");
      app.relaunch();
      app.quit();
      return;
    } else if (response.response === 1) {
      // View logs
      const logPath = path.join(app.getPath("userData"), "logs", "main.log");
      require("electron").shell.openPath(logPath);
      app.quit();
      return;
    } else {
      // Exit
      app.quit();
      return;
    }
  }

  // ── LICENSE CHECK (runs before window loads) ──────────────────────────────
  const userDataDir = app.getPath("userData");
  const licenseStatus = licenseService.loadTokenOnStartup(userDataDir);
  log.info("[license] startup check:", licenseStatus);
  // Pass result to renderer via a global so LicenseGate can read it via IPC
  // (window hasn't loaded yet — we store it and serve via IPC handler below)
  // ─────────────────────────────────────────────────────────────────────────

  createWindow();

  // Start auto backup by default
  startAutoBackup();

  // Only setup auto-updater in production
  if (app.isPackaged) {
    setupAutoUpdate();
  }
  
  log.info("[app] ========== APPLICATION READY ==========");
});

app.on("window-all-closed", () => {
  if (backendProcess) { backendProcess.kill(); backendProcess = null; }
  if (licenseBackendProcess) { licenseBackendProcess.kill(); licenseBackendProcess = null; }
  if (process.platform !== "darwin") app.quit();
});

app.on("before-quit", () => {
  if (backendProcess) { backendProcess.kill(); backendProcess = null; }
  if (licenseBackendProcess) { licenseBackendProcess.kill(); licenseBackendProcess = null; }
});

/* ---------------- IPC ---------------- */
ipcMain.handle("app:getVersion", () => app.getVersion());

// Expose backend port to frontend
ipcMain.handle("app:getBackendPort", () => {
  if (!BACKEND_PORT) {
    log.error("[ipc] backend port requested but not allocated");
    return null;
  }
  return BACKEND_PORT;
});

// Manual update check (for testing or user-triggered checks)
ipcMain.handle("app:checkForUpdates", async () => {
  if (!app.isPackaged) {
    log.warn("[ipc] update check requested in development mode - ignoring");
    return { ok: false, message: "Updates disabled in development mode" };
  }

  try {
    log.info("[ipc] manual update check requested");
    const result = await autoUpdater.checkForUpdates();
    
    if (result && result.updateInfo) {
      log.info("[ipc] update check result:", JSON.stringify(result.updateInfo, null, 2));
      return {
        ok: true,
        currentVersion: app.getVersion(),
        latestVersion: result.updateInfo.version,
        updateAvailable: result.updateInfo.version > app.getVersion(),
      };
    }
    
    return {
      ok: true,
      currentVersion: app.getVersion(),
      updateAvailable: false,
    };
  } catch (err) {
    log.error("[ipc] manual update check failed:", err.message);
    return { ok: false, message: err.message };
  }
});

ipcMain.handle("backup:create", async () => {
  const dbPath = path.join(app.getPath("userData"), "inventory.db");
  const res = await dialog.showSaveDialog(mainWindow, {
    title: "Save Backup",
    defaultPath: `inventory-backup-${Date.now()}.db`,
    filters: [{ name: "SQLite Database", extensions: ["db"] }],
  });
  if (!res.filePath) return { ok: false };
  fs.copyFileSync(dbPath, res.filePath);
  log.info("[backup] saved to:", res.filePath);
  return { ok: true };
});

ipcMain.handle("backup:restore", async () => {
  const res = await dialog.showOpenDialog(mainWindow, {
    title: "Restore Backup",
    filters: [{ name: "SQLite Database", extensions: ["db"] }],
    properties: ["openFile"],
  });
  if (res.canceled || !res.filePaths[0]) return { ok: false };
  const dbPath = path.join(app.getPath("userData"), "inventory.db");
  fs.copyFileSync(res.filePaths[0], dbPath);
  log.info("[backup] restored from:", res.filePaths[0]);
  return { ok: true };
});

/* ---------------- AUTO BACKUP ---------------- */
let autoBackupTimer = null;
const AUTO_BACKUP_INTERVAL_MS = 24 * 60 * 60 * 1000; // 24 hours

function runAutoBackup() {
  try {
    const dbPath = path.join(app.getPath("userData"), "inventory.db");
    const backupDir = path.join(app.getPath("userData"), "backup");
    if (!fs.existsSync(backupDir)) fs.mkdirSync(backupDir, { recursive: true });
    const dest = path.join(backupDir, "eyerflow_backup.db");
    fs.copyFileSync(dbPath, dest);
    log.info("[auto-backup] saved to:", dest);
  } catch (err) {
    log.error("[auto-backup] failed:", err.message);
  }
}

function startAutoBackup() {
  if (autoBackupTimer) return;
  runAutoBackup(); // run immediately on start
  autoBackupTimer = setInterval(runAutoBackup, AUTO_BACKUP_INTERVAL_MS);
  log.info("[auto-backup] scheduler started (every 24h)");
}

function stopAutoBackup() {
  if (autoBackupTimer) {
    clearInterval(autoBackupTimer);
    autoBackupTimer = null;
    log.info("[auto-backup] scheduler stopped");
  }
}

ipcMain.handle("backup:setAuto", (_event, enabled) => {
  if (enabled) startAutoBackup();
  else stopAutoBackup();
  return { ok: true };
});

/* ---------------- LICENSE IPC ---------------- */

ipcMain.handle("license:check", () => {
  const userDataDir = app.getPath("userData");
  const result = licenseService.loadTokenOnStartup(userDataDir);
  log.info("[license:check]", result);
  return result;
});

ipcMain.handle("license:activate", async (_event, licenseKey) => {
  const userDataDir = app.getPath("userData");
  const result = await licenseService.activateLicense(userDataDir, licenseKey);
  log.info("[license:activate]", result.ok ? "success" : result.error);
  return result;
});

ipcMain.handle("license:getMachineId", () => {
  return licenseService.getMachineId();
});

ipcMain.handle("license:clear", () => {
  const userDataDir = app.getPath("userData");
  licenseService.clearToken(userDataDir);
  log.info("[license:clear] token cleared");
  return { ok: true };
});
