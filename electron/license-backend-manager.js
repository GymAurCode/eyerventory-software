/**
 * License Backend Manager Module
 * Handles license service startup with proper error handling and resource verification
 */

const { spawn } = require("child_process");
const path = require("path");
const fs = require("fs");
const log = require("electron-log");

class LicenseBackendManager {
  constructor(app) {
    this.app = app;
    this.process = null;
    this.port = 8001;
    this.host = "127.0.0.1";
    this.isDev = !app.isPackaged;
  }

  /**
   * Verify license_service.exe exists in production
   */
  verifyLicenseServiceExecutable() {
    if (this.isDev) return true;

    const backendDir = path.join(process.resourcesPath, "backend");
    const executable = path.join(backendDir, "license_service.exe");

    log.info(`[license-backend-manager] checking for: ${executable}`);

    if (!fs.existsSync(executable)) {
      log.error(`[license-backend-manager] license_service.exe not found at: ${executable}`);
      
      // List what's actually in the backend directory
      if (fs.existsSync(backendDir)) {
        const files = fs.readdirSync(backendDir);
        log.error(`[license-backend-manager] contents of backend dir: ${files.join(", ")}`);
      } else {
        log.error(`[license-backend-manager] backend directory does not exist: ${backendDir}`);
      }
      
      return false;
    }

    log.info(`[license-backend-manager] license_service.exe found`);
    return true;
  }

  /**
   * Start the license backend service
   */
  start() {
    log.info(`[license-backend-manager] ========== LICENSE SERVICE STARTUP ==========`);

    if (this.process) {
      log.warn(`[license-backend-manager] already running, skipping duplicate start`);
      return { success: true, port: this.port };
    }

    const licenseDbPath = path.join(this.app.getPath("userData"), "license.db");
    const env = { ...process.env, LICENSE_DB_PATH: licenseDbPath };

    let executable, args, options;

    if (this.isDev) {
      // Development mode: use Python venv
      const licenseServiceDir = path.join(this.app.getAppPath(), "license_service");
      executable = path.join(this.app.getAppPath(), "venv", "Scripts", "python.exe");

      if (!fs.existsSync(executable)) {
        log.warn(`[license-backend-manager] Python venv not found at: ${executable}`);
        log.warn(`[license-backend-manager] license service will not start (dev mode)`);
        return { success: false, reason: "venv_not_found" };
      }

      if (!fs.existsSync(licenseServiceDir)) {
        log.warn(`[license-backend-manager] license_service directory not found at: ${licenseServiceDir}`);
        return { success: false, reason: "license_service_dir_not_found" };
      }

      args = ["-m", "uvicorn", "main:app", "--host", this.host, "--port", String(this.port)];
      options = { env, windowsHide: true, detached: false, cwd: licenseServiceDir };

      log.info(`[license-backend-manager] mode: DEVELOPMENT`);
      log.info(`[license-backend-manager] cwd: ${licenseServiceDir}`);
    } else {
      // Production mode: use license_service.exe
      const backendDir = path.join(process.resourcesPath, "backend");
      executable = path.join(backendDir, "license_service.exe");

      // Verify executable exists
      if (!this.verifyLicenseServiceExecutable()) {
        log.error(`[license-backend-manager] license_service.exe missing - cannot start`);
        return { success: false, reason: "executable_not_found" };
      }

      args = [];
      options = { env, windowsHide: true, detached: false, cwd: backendDir };

      log.info(`[license-backend-manager] mode: PRODUCTION`);
      log.info(`[license-backend-manager] executable: ${executable}`);
    }

    log.info(`[license-backend-manager] spawning: ${executable}`);
    log.info(`[license-backend-manager] args: ${JSON.stringify(args)}`);
    log.info(`[license-backend-manager] port: ${this.port}`);

    try {
      this.process = spawn(executable, args, options);

      // Setup logging
      this.process.stdout?.on("data", (data) => {
        log.info(`[license:stdout] ${data.toString().trim()}`);
      });

      this.process.stderr?.on("data", (data) => {
        log.info(`[license:stderr] ${data.toString().trim()}`);
      });

      this.process.on("error", (err) => {
        log.error(`[license-backend-manager] spawn error:`, err.message);
      });

      this.process.on("exit", (code, signal) => {
        log.info(`[license-backend-manager] process exited - code=${code} signal=${signal}`);
        this.process = null;
      });

      if (this.process.pid) {
        log.info(`[license-backend-manager] started with PID: ${this.process.pid}`);
        log.info(`[license-backend-manager] ========== LICENSE SERVICE READY ==========`);
        return { success: true, port: this.port, pid: this.process.pid };
      } else {
        log.error(`[license-backend-manager] process spawned but no PID assigned`);
        return { success: false, reason: "no_pid" };
      }
    } catch (err) {
      log.error(`[license-backend-manager] failed to spawn:`, err.message);
      return { success: false, reason: "spawn_failed", error: err.message };
    }
  }

  /**
   * Stop the license backend service
   */
  stop() {
    if (this.process) {
      log.info(`[license-backend-manager] stopping license service (PID: ${this.process.pid})`);
      try {
        this.process.kill();
      } catch (err) {
        log.warn(`[license-backend-manager] error killing process:`, err.message);
      }
      this.process = null;
    }
  }

  /**
   * Get current service info
   */
  getInfo() {
    return {
      running: this.process !== null,
      port: this.port,
      host: this.host,
      pid: this.process?.pid,
      url: `http://${this.host}:${this.port}`,
    };
  }
}

module.exports = LicenseBackendManager;
