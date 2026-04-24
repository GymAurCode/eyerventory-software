const { app, BrowserWindow, ipcMain, dialog } = require("electron");
const path = require("path");
const fs = require("fs");
const http = require("http");
const { spawn } = require("child_process");
const log = require("electron-log");
const { autoUpdater } = require("electron-updater");
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
let backendProcess;
let licenseBackendProcess;  // License service process (port 8001)
let backendSpawnError = null; // set if spawn itself fails

/* ---------------- BACKEND READY CHECK ---------------- */
/**
 * Polls /api/health until the backend responds or we time out.
 * Rejects immediately if the spawn already errored.
 */
function waitForBackend(maxWaitMs = 90000, intervalMs = 600) {
  return new Promise((resolve, reject) => {
    const deadline = Date.now() + maxWaitMs;

    function attempt() {
      // If spawn already failed, no point polling
      if (backendSpawnError) {
        return reject(backendSpawnError);
      }

      const req = http.get("http://127.0.0.1:8000/api/health", (res) => {
        if (res.statusCode < 500) {
          log.info("[backend] health check passed");
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

/* ---------------- LICENSE BACKEND START ---------------- */
function startLicenseBackend() {
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
    args = ["-m", "uvicorn", "main:app", "--host", "127.0.0.1", "--port", "8001"];
    options = { env, windowsHide: true, detached: false, cwd: licenseServiceDir };
  } else {
    const backendDir = path.join(process.resourcesPath, "backend");
    executable = path.join(backendDir, "license_service.exe");
    if (!fs.existsSync(executable)) {
      log.warn("[license-backend] license_service.exe not found — skipping");
      return;
    }
    args = [];
    options = { env, windowsHide: true, detached: false, cwd: backendDir };
  }

  licenseBackendProcess = spawn(executable, args, options);
  licenseBackendProcess.stdout?.on("data", (d) => log.info("[license:stdout]", d.toString().trim()));
  licenseBackendProcess.stderr?.on("data", (d) => log.info("[license:stderr]", d.toString().trim()));
  licenseBackendProcess.on("error", (err) => log.error("[license-backend] spawn error:", err.message));
  licenseBackendProcess.on("exit", (code) => log.info("[license-backend] exited code:", code));
  if (licenseBackendProcess.pid) log.info("[license-backend] PID:", licenseBackendProcess.pid);
}

/* ---------------- BACKEND START ---------------- */
function startBackend() {
  const dbPath = path.join(app.getPath("userData"), "inventory.db");

  // Ensure userData dir exists (it always should, but be safe)
  const userDataDir = app.getPath("userData");
  if (!fs.existsSync(userDataDir)) {
    fs.mkdirSync(userDataDir, { recursive: true });
  }

  log.info("[backend] DB_PATH =", dbPath);
  log.info("[backend] Environment: " + (isDev ? "DEVELOPMENT" : "PRODUCTION (app.isPackaged=true)"));

  const env = {
    ...process.env,
    DB_PATH: dbPath,
    BACKEND_PORT: "8000",
  };

  let executable, args, options, backendDir;

  if (isDev) {
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
      "--host", "127.0.0.1",
      "--port", "8000",
      "--reload",
    ];
    options = { 
      env, 
      windowsHide: true, 
      detached: false,
      cwd: app.getAppPath()
    };
  } else {
    // Production: backend.exe in resources/backend folder (via extraResources)
    backendDir = path.join(process.resourcesPath, "backend");
    executable = path.join(backendDir, "backend.exe");

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
  });

  // Log PID for debugging
  if (backendProcess.pid) {
    log.info(`[backend] started with PID: ${backendProcess.pid}`);
  }
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
      webSecurity: false, // required: allows file:// page to call http://127.0.0.1
    },
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
app.whenReady().then(async () => {
  startBackend();
  startLicenseBackend();  // Start license service (port 8001)

  try {
    await waitForBackend();
    log.info("[app] backend ready — creating window");
  } catch (err) {
    log.error("[app] backend failed to start:", err.message);
    dialog.showErrorBox(
      "Backend Failed to Start",
      err.message + "\n\nThe application will now close."
    );
    app.quit();
    return;
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
