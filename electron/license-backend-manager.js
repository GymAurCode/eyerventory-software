/**
 * License Backend Manager
 *
 * Production (packaged EXE):
 *   Does NOTHING. License activation goes directly to the Railway HTTPS server.
 *   No local process is spawned. No port is used. No conflicts possible.
 *
 * Development only:
 *   Optionally spawns the local license_service Python server on port 8001
 *   for testing the license flow locally. Skips gracefully if venv is missing.
 */

"use strict";

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
    this.isPackaged = app.isPackaged;
  }

  /**
   * Start the license service.
   *
   * Production: immediately returns success — Railway handles everything.
   * Development: tries to start local Python server; skips if venv missing.
   */
  start() {
    // ── PRODUCTION: never spawn a local process ───────────────────────────
    if (this.isPackaged) {
      log.info("[license-backend-manager] production mode — using Railway server, no local process needed");
      return { success: true, mode: "remote" };
    }

    // ── DEVELOPMENT: optional local server ───────────────────────────────
    log.info("[license-backend-manager] development mode — attempting local license service");

    if (this.process) {
      log.warn("[license-backend-manager] already running, skipping duplicate start");
      return { success: true, port: this.port, mode: "local" };
    }

    const appPath = this.app.getAppPath();
    const licenseServiceDir = path.join(appPath, "license_service");
    const pythonExe = path.join(appPath, "venv", "Scripts", "python.exe");

    if (!fs.existsSync(pythonExe)) {
      log.warn("[license-backend-manager] venv not found — local license service skipped");
      log.warn("[license-backend-manager] activation will use Railway server instead");
      return { success: false, reason: "venv_not_found", mode: "remote_fallback" };
    }

    if (!fs.existsSync(licenseServiceDir)) {
      log.warn("[license-backend-manager] license_service dir not found — skipped");
      return { success: false, reason: "dir_not_found", mode: "remote_fallback" };
    }

    const licenseDbPath = path.join(this.app.getPath("userData"), "license.db");
    const env = { ...process.env, LICENSE_DB_PATH: licenseDbPath };

    try {
      this.process = spawn(
        pythonExe,
        ["-m", "uvicorn", "main:app", "--host", this.host, "--port", String(this.port)],
        { env, windowsHide: true, detached: false, cwd: licenseServiceDir }
      );

      this.process.stdout?.on("data", (d) => log.info(`[license:stdout] ${d.toString().trim()}`));
      this.process.stderr?.on("data", (d) => log.info(`[license:stderr] ${d.toString().trim()}`));
      this.process.on("error", (err) => log.error("[license-backend-manager] spawn error:", err.message));
      this.process.on("exit", (code, signal) => {
        log.info(`[license-backend-manager] process exited — code=${code} signal=${signal}`);
        this.process = null;
      });

      if (this.process.pid) {
        log.info(`[license-backend-manager] started with PID: ${this.process.pid} on port ${this.port}`);
        return { success: true, port: this.port, pid: this.process.pid, mode: "local" };
      }

      return { success: false, reason: "no_pid" };
    } catch (err) {
      log.error("[license-backend-manager] failed to spawn:", err.message);
      return { success: false, reason: "spawn_failed", error: err.message };
    }
  }

  stop() {
    if (this.process) {
      log.info(`[license-backend-manager] stopping local license service (PID: ${this.process.pid})`);
      try { this.process.kill(); } catch (err) {
        log.warn("[license-backend-manager] error killing process:", err.message);
      }
      this.process = null;
    }
  }

  getInfo() {
    if (this.isPackaged) {
      return { running: false, mode: "remote", url: null };
    }
    return {
      running: this.process !== null,
      mode: "local",
      port: this.port,
      host: this.host,
      pid: this.process?.pid,
      url: this.process ? `http://${this.host}:${this.port}` : null,
    };
  }
}

module.exports = LicenseBackendManager;
