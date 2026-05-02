/**
 * Backend Manager Module
 * Handles robust backend startup with dynamic port allocation,
 * process cleanup, and retry logic for production stability.
 */

const { spawn } = require("child_process");
const path = require("path");
const fs = require("fs");
const http = require("http");
const net = require("net");
const getPort = require("get-port");
const log = require("electron-log");

class BackendManager {
  constructor(app) {
    this.app = app;
    this.backendProcess = null;
    this.backendPort = null;
    this.backendHost = "127.0.0.1";
    this.isDev = !app.isPackaged;
    this.maxRetries = 3;
    this.portRange = { min: 8000, max: 8100 };
  }

  /**
   * Check if a port is in use
   */
  async isPortInUse(port, host = this.backendHost) {
    return new Promise((resolve) => {
      const server = net.createServer();
      server.once("error", (err) => {
        if (err.code === "EADDRINUSE") {
          resolve(true);
        } else {
          log.warn(`[backend-manager] port check error on ${host}:${port}:`, err.message);
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
   * Find an available port in the configured range
   */
  async findAvailablePort() {
    try {
      const port = await getPort({
        port: getPort.makeRange(this.portRange.min, this.portRange.max),
        host: this.backendHost,
      });
      log.info(`[backend-manager] found available port: ${port}`);
      return port;
    } catch (err) {
      log.error(`[backend-manager] failed to find available port:`, err.message);
      throw new Error(`No available ports in range ${this.portRange.min}-${this.portRange.max}`);
    }
  }

  /**
   * Kill stale processes on Windows that might be holding the port
   */
  async killStaleProcesses(port) {
    if (process.platform !== "win32") return;

    try {
      log.info(`[backend-manager] checking for stale processes on port ${port}`);
      
      // Use netstat to find process using the port
      const { execSync } = require("child_process");
      const output = execSync(`netstat -ano | findstr :${port}`, { encoding: "utf8" }).trim();
      
      if (!output) {
        log.info(`[backend-manager] no processes found on port ${port}`);
        return;
      }

      // Extract PIDs from netstat output
      const lines = output.split("\n");
      const pids = new Set();
      
      for (const line of lines) {
        const parts = line.trim().split(/\s+/);
        const pid = parts[parts.length - 1];
        if (pid && pid !== "0" && !isNaN(pid)) {
          pids.add(pid);
        }
      }

      // Kill each process
      for (const pid of pids) {
        try {
          log.info(`[backend-manager] killing stale process PID ${pid}`);
          execSync(`taskkill /F /PID ${pid}`, { encoding: "utf8" });
          log.info(`[backend-manager] successfully killed PID ${pid}`);
        } catch (err) {
          log.warn(`[backend-manager] failed to kill PID ${pid}:`, err.message);
        }
      }

      // Wait a bit for ports to be released
      await new Promise((resolve) => setTimeout(resolve, 1000));
    } catch (err) {
      // netstat might fail if no processes found - this is OK
      if (!err.message.includes("findstr")) {
        log.warn(`[backend-manager] error checking for stale processes:`, err.message);
      }
    }
  }

  /**
   * Wait for backend to be ready by polling health endpoint
   */
  async waitForBackend(maxWaitMs = 90000, intervalMs = 600) {
    return new Promise((resolve, reject) => {
      const deadline = Date.now() + maxWaitMs;
      let attempts = 0;

      const attempt = () => {
        attempts++;
        
        // Check if process died
        if (this.backendProcess && this.backendProcess.exitCode !== null) {
          return reject(
            new Error(
              `Backend process exited unexpectedly with code ${this.backendProcess.exitCode}`
            )
          );
        }

        const req = http.get(
          `http://${this.backendHost}:${this.backendPort}/api/health`,
          (res) => {
            if (res.statusCode < 500) {
              log.info(`[backend-manager] health check passed after ${attempts} attempts`);
              resolve();
            } else {
              retry();
            }
            res.resume();
          }
        );

        req.on("error", retry);
        req.setTimeout(500, () => {
          req.destroy();
          retry();
        });
      };

      const retry = () => {
        if (Date.now() >= deadline) {
          return reject(
            new Error(
              `Backend did not start within ${maxWaitMs / 1000} seconds.\n\n` +
              `Port: ${this.backendPort}\n` +
              `Attempts: ${attempts}\n` +
              `Check logs at: ${path.join(this.app.getPath("userData"), "logs", "main.log")}`
            )
          );
        }
        setTimeout(attempt, intervalMs);
      };

      attempt();
    });
  }

  /**
   * Spawn the backend process
   */
  async spawnBackend(port) {
    const dbPath = path.join(this.app.getPath("userData"), "inventory.db");
    const userDataDir = this.app.getPath("userData");

    // Ensure userData directory exists
    if (!fs.existsSync(userDataDir)) {
      fs.mkdirSync(userDataDir, { recursive: true });
    }

    log.info(`[backend-manager] spawning backend on port ${port}`);
    log.info(`[backend-manager] DB_PATH: ${dbPath}`);
    log.info(`[backend-manager] environment: ${this.isDev ? "DEVELOPMENT" : "PRODUCTION"}`);

    const env = {
      ...process.env,
      DB_PATH: dbPath,
      BACKEND_PORT: String(port),
    };

    let executable, args, options, backendDir;

    if (this.app.isPackaged) {
      // Production: backend.exe in resources/backend folder
      backendDir = path.join(process.resourcesPath, "backend");
      executable = path.join(backendDir, "backend.exe");

      log.info(`[backend-manager] mode: PRODUCTION`);
      log.info(`[backend-manager] resourcesPath: ${process.resourcesPath}`);
      log.info(`[backend-manager] backendDir: ${backendDir}`);
      log.info(`[backend-manager] executable: ${executable}`);

      // Verify backend directory exists
      if (!fs.existsSync(backendDir)) {
        throw new Error(
          `Backend resources folder not found at:\n${backendDir}\n\n` +
          `The app was not packaged correctly.\n` +
          `Contents of resourcesPath: ${fs.readdirSync(process.resourcesPath).join(", ")}`
        );
      }

      // Verify backend.exe exists
      if (!fs.existsSync(executable)) {
        throw new Error(
          `backend.exe not found at:\n${executable}\n\n` +
          `The app may not have been built correctly.\n` +
          `Contents of backendDir: ${fs.readdirSync(backendDir).join(", ")}`
        );
      }

      args = [];
      options = {
        env,
        windowsHide: true,
        detached: false,
        cwd: backendDir,
      };
    } else {
      // Development: Python + uvicorn
      executable = path.join(this.app.getAppPath(), "venv", "Scripts", "python.exe");

      if (!fs.existsSync(executable)) {
        throw new Error(
          `Python executable not found at:\n${executable}\n\n` +
          `Ensure the venv is set up correctly.\n\n` +
          `Run: python -m venv venv && .\\venv\\Scripts\\activate && pip install -r requirements.txt`
        );
      }

      args = [
        "-m",
        "uvicorn",
        "backend.main:app",
        "--host",
        this.backendHost,
        "--port",
        String(port),
        "--reload",
      ];
      options = {
        env,
        windowsHide: true,
        detached: false,
        cwd: this.app.getAppPath(),
      };
    }

    // Verify executable is accessible
    try {
      fs.accessSync(executable, fs.constants.X_OK);
      log.info(`[backend-manager] executable verified: ${executable}`);
    } catch (err) {
      log.warn(`[backend-manager] executable may not be executable:`, err.message);
    }

    log.info(`[backend-manager] spawning: ${executable}`);
    log.info(`[backend-manager] args: ${JSON.stringify(args)}`);
    log.info(`[backend-manager] cwd: ${options.cwd}`);

    // Spawn the process
    this.backendProcess = spawn(executable, args, options);

    // Setup logging
    this.backendProcess.stdout?.on("data", (data) => {
      log.info(`[backend:stdout] ${data.toString().trim()}`);
    });

    this.backendProcess.stderr?.on("data", (data) => {
      log.info(`[backend:stderr] ${data.toString().trim()}`);
    });

    this.backendProcess.on("error", (err) => {
      log.error(`[backend-manager] spawn error:`, err);
      throw new Error(
        `Failed to start backend process.\n\n${err.message}\n\n` +
        `Executable: ${executable}\nArgs: ${JSON.stringify(args)}`
      );
    });

    this.backendProcess.on("exit", (code, signal) => {
      log.warn(`[backend-manager] process exited - code=${code} signal=${signal}`);
      this.backendProcess = null;
      this.backendPort = null;
    });

    if (this.backendProcess.pid) {
      log.info(`[backend-manager] started with PID: ${this.backendProcess.pid}`);
    }

    this.backendPort = port;
  }

  /**
   * Start the backend with retry logic
   */
  async start() {
    log.info(`[backend-manager] ========== BACKEND STARTUP ==========`);
    
    if (this.backendProcess) {
      log.warn(`[backend-manager] backend already running on port ${this.backendPort}`);
      return { port: this.backendPort, host: this.backendHost };
    }

    let lastError = null;

    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      try {
        log.info(`[backend-manager] startup attempt ${attempt}/${this.maxRetries}`);

        // Find available port
        const port = await this.findAvailablePort();
        
        // Try to clean up stale processes
        await this.killStaleProcesses(port);

        // Verify port is actually free
        const portInUse = await this.isPortInUse(port);
        if (portInUse) {
          log.warn(`[backend-manager] port ${port} still in use after cleanup, finding another`);
          continue;
        }

        // Spawn backend
        await this.spawnBackend(port);

        // Wait for backend to be ready
        await this.waitForBackend();

        log.info(`[backend-manager] ========== BACKEND READY ==========`);
        log.info(`[backend-manager] URL: http://${this.backendHost}:${this.backendPort}`);
        
        return { port: this.backendPort, host: this.backendHost };
      } catch (err) {
        lastError = err;
        log.error(`[backend-manager] attempt ${attempt} failed:`, err.message);

        // Clean up failed process
        if (this.backendProcess) {
          try {
            this.backendProcess.kill();
          } catch (killErr) {
            log.warn(`[backend-manager] failed to kill process:`, killErr.message);
          }
          this.backendProcess = null;
          this.backendPort = null;
        }

        // Wait before retry
        if (attempt < this.maxRetries) {
          const waitTime = 2000 * attempt;
          log.info(`[backend-manager] waiting ${waitTime}ms before retry...`);
          await new Promise((resolve) => setTimeout(resolve, waitTime));
        }
      }
    }

    // All retries failed
    log.error(`[backend-manager] ========== BACKEND STARTUP FAILED ==========`);
    throw new Error(
      `Backend failed to start after ${this.maxRetries} attempts.\n\n` +
      `Last error: ${lastError?.message || "Unknown error"}\n\n` +
      `Check logs at: ${path.join(this.app.getPath("userData"), "logs", "main.log")}`
    );
  }

  /**
   * Stop the backend process
   */
  stop() {
    if (this.backendProcess) {
      log.info(`[backend-manager] stopping backend (PID: ${this.backendProcess.pid})`);
      try {
        this.backendProcess.kill();
      } catch (err) {
        log.warn(`[backend-manager] error killing process:`, err.message);
      }
      this.backendProcess = null;
      this.backendPort = null;
    }
  }

  /**
   * Get current backend info
   */
  getInfo() {
    return {
      running: this.backendProcess !== null,
      port: this.backendPort,
      host: this.backendHost,
      pid: this.backendProcess?.pid,
      url: this.backendPort ? `http://${this.backendHost}:${this.backendPort}` : null,
    };
  }
}

module.exports = BackendManager;
