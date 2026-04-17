const { app, BrowserWindow, ipcMain, dialog } = require("electron");
const path = require("path");
const fs = require("fs");
const http = require("http");
const { spawn } = require("child_process");
const log = require("electron-log");
const { autoUpdater } = require("electron-updater");

// Configure electron-log to write to userData/logs/
log.transports.file.resolvePathFn = () =>
  path.join(app.getPath("userData"), "logs", "main.log");
log.transports.file.level = "info";
log.transports.console.level = "debug";

// Production safety flag
const isDev = !app.isPackaged;

let mainWindow;
let backendProcess;
let backendSpawnError = null; // set if spawn itself fails

/* ---------------- BACKEND READY CHECK ---------------- */
/**
 * Polls /api/health until the backend responds or we time out.
 * Rejects immediately if the spawn already errored.
 */
function waitForBackend(maxWaitMs = 45000, intervalMs = 600) {
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
            "Backend did not start within 45 seconds.\n\n" +
            "Check logs at: " + path.join(app.getPath("userData"), "logs", "main.log")
          )
        );
      }
      setTimeout(attempt, intervalMs);
    }

    attempt();
  });
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
    show: false, // don't flash a white window before content loads
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
  try {
    autoUpdater.logger = log;
    autoUpdater.autoDownload = false;
    autoUpdater.autoInstallOnAppQuit = true;

    autoUpdater.on("update-available", async (info) => {
      const res = await dialog.showMessageBox(mainWindow, {
        type: "info",
        buttons: ["Download", "Later"],
        title: "Update Available",
        message: `Version ${info.version} is available. Download now?`,
      });
      if (res.response === 0) {
        dialog.showMessageBox(mainWindow, {
          type: "info",
          title: "Downloading Update",
          message: "Update is downloading. You will be notified when ready.",
        });
        autoUpdater.downloadUpdate();
      }
    });

    autoUpdater.on("update-downloaded", async () => {
      const res = await dialog.showMessageBox(mainWindow, {
        type: "info",
        buttons: ["Install & Restart", "Later"],
        title: "Update Ready",
        message: "Update downloaded. Install now?",
      });
      if (res.response === 0) autoUpdater.quitAndInstall();
    });

    autoUpdater.on("error", (err) => log.warn("Auto-update (non-critical):", err.message));

    // Check for updates immediately on startup
    autoUpdater.checkForUpdates().catch((err) =>
      log.warn("Update check skipped:", err.message)
    );
  } catch (err) {
    log.warn("Auto-updater init failed (non-critical):", err.message);
  }
}

/* ---------------- APP LIFECYCLE ---------------- */
app.whenReady().then(async () => {
  startBackend();

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
    return; // <-- critical: don't create window if backend is dead
  }

  createWindow();
  setupAutoUpdate();
});

app.on("window-all-closed", () => {
  if (backendProcess) {
    backendProcess.kill();
    backendProcess = null;
  }
  if (process.platform !== "darwin") app.quit();
});

app.on("before-quit", () => {
  if (backendProcess) {
    backendProcess.kill();
    backendProcess = null;
  }
});

/* ---------------- IPC ---------------- */
ipcMain.handle("app:getVersion", () => app.getVersion());

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
