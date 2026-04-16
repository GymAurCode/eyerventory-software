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

  const env = {
    ...process.env,
    DB_PATH: dbPath,
    BACKEND_PORT: "8000",
  };

  let executable, args, options;

  if (app.isPackaged) {
    // Production: dist/backend/ folder is copied to resources/backend/ by extraResources
    executable = path.join(process.resourcesPath, "backend", "backend.exe");

    if (!fs.existsSync(executable)) {
      const msg = `backend.exe not found at:\n${executable}\n\nThe app may not have been built correctly.`;
      log.error("[backend]", msg);
      dialog.showErrorBox("Backend Missing", msg);
      app.quit();
      return;
    }

    args = [];
    options = { env, windowsHide: true, detached: false };
  } else {
    // Development: run uvicorn directly
    executable = process.env.PYTHON_EXECUTABLE || "python";
    args = [
      "-m", "uvicorn", "backend.main:app",
      "--host", "127.0.0.1",
      "--port", "8000",
      "--reload",
      "--reload-dir", "backend",
    ];
    options = { cwd: app.getAppPath(), env, windowsHide: true };
  }

  log.info(`[backend] spawning: ${executable}`);
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
      `Failed to start backend process.\n\n${err.message}\n\nExecutable: ${executable}`
    );
  });

  backendProcess.on("exit", (code, signal) => {
    log.warn(`[backend] exited — code=${code} signal=${signal}`);
  });
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

  if (!app.isPackaged) {
    mainWindow.loadURL("http://localhost:5173");
    mainWindow.webContents.openDevTools();
  } else {
    // __dirname is electron/ inside the asar; frontend/dist is at asar root
    const indexPath = path.join(__dirname, "..", "frontend", "dist", "index.html");
    log.info("[window] loading:", indexPath);

    mainWindow.loadFile(indexPath).catch((err) => {
      log.error("[window] loadFile failed:", err);
      mainWindow.loadURL(
        `data:text/html,<pre style="font-family:monospace;padding:24px;color:red">` +
        `Failed to load UI\n\nPath: ${indexPath}\nError: ${err.message}\n` +
        `__dirname: ${__dirname}\nappPath: ${app.getAppPath()}</pre>`
      );
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
      if (res.response === 0) autoUpdater.downloadUpdate();
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

    setTimeout(() => {
      autoUpdater.checkForUpdates().catch((err) =>
        log.warn("Update check skipped:", err.message)
      );
    }, 15000);
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
