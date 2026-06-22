const { app, BrowserWindow, ipcMain, dialog } = require("electron");
const path = require("path");
const fs = require("fs");
const log = require("electron-log");
const { autoUpdater } = require("electron-updater");
// Backend managers for robust startup
const BackendManager = require("./backend-manager");
const LicenseBackendManager = require("./license-backend-manager");
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
let backendManager;
let licenseBackendManager;

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
  // Initialize backend managers
  backendManager = new BackendManager(app);
  licenseBackendManager = new LicenseBackendManager(app);

  // Start main backend with retry logic
  try {
    const backendInfo = await backendManager.start();
    log.info(`[app] backend ready at ${backendInfo.host}:${backendInfo.port}`);
  } catch (err) {
    log.error("[app] backend failed to start:", err.message);
    dialog.showErrorBox(
      "Backend Failed to Start",
      err.message + "\n\nThe application will now close."
    );
    app.quit();
    return;
  }

  // Start license backend (dev only — production uses Railway directly)
  const licenseResult = licenseBackendManager.start();
  if (licenseResult.mode === "remote") {
    log.info("[app] license: using Railway remote server (production mode)");
  } else if (licenseResult.success) {
    log.info(`[app] license service started locally on port ${licenseResult.port}`);
  } else {
    log.info(`[app] license service not started (${licenseResult.reason}) — will use Railway`);
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
  if (backendManager) backendManager.stop();
  if (licenseBackendManager) licenseBackendManager.stop();
  if (process.platform !== "darwin") app.quit();
});

app.on("before-quit", () => {
  if (backendManager) backendManager.stop();
  if (licenseBackendManager) licenseBackendManager.stop();
});

/* ---------------- IPC ---------------- */
ipcMain.handle("app:getVersion", () => app.getVersion());

// Get backend connection info
ipcMain.handle("backend:getInfo", () => {
  if (!backendManager) {
    return { error: "Backend manager not initialized" };
  }
  return backendManager.getInfo();
});

// Get license backend info
ipcMain.handle("license-backend:getInfo", () => {
  if (!licenseBackendManager) {
    return { error: "License backend manager not initialized" };
  }
  return licenseBackendManager.getInfo();
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

/* ---------------- THERMAL PRINTER IPC ---------------- */

ipcMain.handle("print-receipt", async (_event, saleData) => {
  try {
    const { ThermalPrinter, PrinterTypes, CharacterSet } = require("node-thermal-printer");

    let printer = new ThermalPrinter({
      type: PrinterTypes.EPSON,
      interface: "printer:auto",
      characterSet: CharacterSet.PC437_USA,
      removeSpecialCharacters: false,
      lineCharacter: "-",
    });

    let isConnected = await printer.isPrinterConnected();
    if (!isConnected) {
      return { success: false, error: "Printer not connected" };
    }

    // Header
    printer.alignCenter();
    printer.bold(true);
    printer.println("EYERFLOW OPTICAL");
    printer.bold(false);
    printer.println("Your Shop Address Here");
    printer.println("Phone: 0300-0000000");
    printer.drawLine();

    // Bill info
    printer.alignLeft();
    printer.println(`Date: ${saleData.date}`);
    printer.println(`Bill#: ${saleData.bill_number}`);
    if (saleData.customer_name) {
      printer.println(`Customer: ${saleData.customer_name}`);
    }
    printer.drawLine();

    // Items
    saleData.items.forEach((item) => {
      printer.tableCustom([
        { text: item.item_name || item.name, align: "LEFT", width: 0.5 },
        { text: `x${item.qty}`, align: "CENTER", width: 0.15 },
        { text: `${item.total_price || item.total}`, align: "RIGHT", width: 0.35 },
      ]);
    });

    printer.drawLine();

    // Totals
    printer.alignRight();
    printer.println(`Subtotal: ${saleData.subtotal}`);
    if (saleData.discount > 0) {
      printer.println(`Discount: -${saleData.discount}`);
    }
    printer.bold(true);
    printer.println(`TOTAL: ${saleData.total}`);
    printer.bold(false);

    if (saleData.payment_method === "cash") {
      printer.println(`Cash: ${saleData.cash_received}`);
      printer.println(`Change: ${saleData.change}`);
    }

    printer.drawLine();
    printer.alignCenter();
    printer.println("Thank you for visiting!");
    printer.println("Come again :)");

    printer.cut();
    await printer.execute();

    return { success: true };
  } catch (err) {
    log.error("[printer] thermal print failed:", err.message);
    return { success: false, error: err.message };
  }
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
  const result = await licenseService.activateLicense(userDataDir, licenseKey, app.isPackaged);
  if (result.ok) {
    log.info("[license:activate] activation success");
  } else {
    log.warn("[license:activate] activation failed:", result.error);
  }
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
