const { app, BrowserWindow, ipcMain, dialog } = require("electron");
const path = require("path");
const fs = require("fs");
const http = require("http");
const { spawn } = require("child_process");
const log = require("electron-log");
const { autoUpdater } = require("electron-updater");

let mainWindow;
let backendProcess;

/** Poll http://127.0.0.1:8000/api/health until it responds or we time out. */
function waitForBackend(maxWaitMs = 30000, intervalMs = 500) {
  return new Promise((resolve, reject) => {
    const deadline = Date.now() + maxWaitMs;
    function attempt() {
      const req = http.get("http://127.0.0.1:8000/api/health", (res) => {
        if (res.statusCode < 500) {
          log.info("[backend] ready ✅");
          resolve();
        } else {
          retry();
        }
      });
      req.on("error", retry);
      req.setTimeout(400, () => { req.destroy(); retry(); });
    }
    function retry() {
      if (Date.now() >= deadline) return reject(new Error("Backend did not start in time"));
      setTimeout(attempt, intervalMs);
    }
    attempt();
  });
}

function resolveBackendEntrypoint() {
  if (app.isPackaged) {
    return path.join(process.resourcesPath, "backend", "main.py");
  }
  return path.join(app.getAppPath(), "backend", "main.py");
}

function startBackend() {
  const dbPath = path.join(app.getPath("userData"), "inventory.db");
  const env = {
    ...process.env,
    DB_PATH: dbPath,
  };

  const pythonExecutable = process.env.PYTHON_EXECUTABLE || "python";
  const isDev = process.env.NODE_ENV === "development";
  const backendArgs = ["-m", "uvicorn", "backend.main:app", "--host", "127.0.0.1", "--port", "8000"];
  if (isDev) {
    backendArgs.push("--reload", "--reload-dir", "backend");
  }
  backendProcess = spawn(pythonExecutable, backendArgs, {
    cwd: app.getAppPath(),
    env,
    windowsHide: true,
  });

  backendProcess.stdout.on("data", (data) => log.info(`[backend] ${data}`));
  backendProcess.stderr.on("data", (data) => log.info(`[backend] ${data}`));
  backendProcess.on("error", (err) => {
    log.error(`[backend] failed to start: ${err.message}`);
    dialog.showErrorBox("Backend startup failed", `Could not start backend service.\n${err.message}`);
  });
  backendProcess.on("exit", (code) => log.warn(`[backend] exited with code ${code}`));
  log.info("[backend] process spawned, waiting for readiness...");
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 860,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  if (process.env.NODE_ENV === "development") {
    mainWindow
      .loadURL("http://localhost:5173")
      .catch(() => {
        mainWindow.loadURL(
          "data:text/html;charset=utf-8,<html><body style='font-family:sans-serif;padding:24px;'><h2>Frontend dev server is not running.</h2><p>Start it with: <b>npm --prefix frontend run dev</b></p></body></html>",
        );
      });
  } else {
    mainWindow.loadFile(path.join(app.getAppPath(), "frontend", "dist", "index.html"));
  }
}

function setupAutoUpdate() {
  autoUpdater.logger = log;
  autoUpdater.autoDownload = false;

  autoUpdater.on("update-available", async () => {
    const choice = await dialog.showMessageBox(mainWindow, {
      type: "info",
      buttons: ["Download", "Later"],
      title: "Update available",
      message: "A new version is available. Download now?",
    });

    if (choice.response === 0) {
      autoUpdater.downloadUpdate();
    }
  });

  autoUpdater.on("update-downloaded", async () => {
    const choice = await dialog.showMessageBox(mainWindow, {
      type: "info",
      buttons: ["Install and Restart", "Later"],
      title: "Update ready",
      message: "Update downloaded. Install now?",
    });

    if (choice.response === 0) {
      autoUpdater.quitAndInstall();
    }
  });

  autoUpdater.checkForUpdatesAndNotify();
}

app.whenReady().then(async () => {
  startBackend();

  // Wait for uvicorn to be ready before loading the UI so we avoid ERR_CONNECTION_REFUSED
  try {
    await waitForBackend(30000);
  } catch (err) {
    log.error("[backend] startup timeout:", err.message);
    dialog.showErrorBox(
      "Backend not responding",
      "The backend server did not start within 30 seconds.\nCheck that Python and dependencies are installed correctly.",
    );
  }

  createWindow();
  setupAutoUpdate();
});

app.on("window-all-closed", () => {
  if (backendProcess) backendProcess.kill();
  if (process.platform !== "darwin") app.quit();
});

app.on("before-quit", () => {
  if (backendProcess) backendProcess.kill();
});

ipcMain.handle("app:getVersion", () => app.getVersion());

ipcMain.handle("backup:create", async () => {
  const dbPath = path.join(app.getPath("userData"), "inventory.db");
  if (!fs.existsSync(dbPath)) return { ok: false, message: "Database not found" };
  const result = await dialog.showSaveDialog(mainWindow, {
    title: "Create Backup",
    defaultPath: `inventory-backup-${Date.now()}.backup`,
    filters: [
      { name: "Backup Files", extensions: ["backup"] },
      { name: "SQLite DB", extensions: ["db"] },
    ],
  });
  if (result.canceled || !result.filePath) return { ok: false, message: "Backup cancelled" };
  fs.copyFileSync(dbPath, result.filePath);
  return { ok: true, path: result.filePath };
});

ipcMain.handle("backup:restore", async () => {
  const dbPath = path.join(app.getPath("userData"), "inventory.db");
  const pick = await dialog.showOpenDialog(mainWindow, {
    title: "Select Backup File",
    properties: ["openFile"],
    filters: [
      { name: "Backup Files", extensions: ["backup", "db"] },
      { name: "All Files", extensions: ["*"] },
    ],
  });
  if (pick.canceled || !pick.filePaths?.length) return { ok: false, message: "Restore cancelled" };
  const source = pick.filePaths[0];
  if (!fs.existsSync(source) || fs.statSync(source).size < 1024) {
    return { ok: false, message: "Invalid backup file" };
  }
  const confirm = await dialog.showMessageBox(mainWindow, {
    type: "warning",
    title: "Confirm Restore",
    message: "Restore will overwrite the current database and restart the app.",
    buttons: ["Restore and Restart", "Cancel"],
    defaultId: 1,
    cancelId: 1,
  });
  if (confirm.response !== 0) return { ok: false, message: "Restore cancelled" };
  try {
    if (backendProcess) backendProcess.kill();
    fs.copyFileSync(source, dbPath);
    app.relaunch();
    app.exit(0);
    return { ok: true };
  } catch (error) {
    return { ok: false, message: `Restore failed: ${error.message}` };
  }
});
