/**
 * License Service — Electron main process module.
 * Fully isolated. Does NOT touch updater, electron-builder, or inventory backend.
 *
 * Architecture:
 *   - Production (packaged): activates against Railway HTTPS server only.
 *                            No local license_service.exe is spawned.
 *   - Development:           activates against local server (port 8001) or Railway.
 *
 * Token storage: AES-256-CBC encrypted file in userData/license.enc
 * Machine ID:    SHA-256 hash of CPU model + hostname (stable across reboots)
 */

"use strict";

const crypto = require("crypto");
const fs = require("fs");
const os = require("os");
const path = require("path");
const log = require("electron-log");
const { getLicenseServerUrl } = require("../config/license");

// ─── Constants ───────────────────────────────────────────────────────────────

const AES_KEY_SEED = "eyerflow-aes-key-seed-v1";
const TOKEN_FILE = "license.enc";

// ─── AES-256 helpers ─────────────────────────────────────────────────────────

function _deriveKey(machineId) {
  return crypto.createHash("sha256").update(AES_KEY_SEED + machineId).digest();
}

function encryptToken(plaintext, machineId) {
  const key = _deriveKey(machineId);
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv("aes-256-cbc", key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  return iv.toString("hex") + ":" + encrypted.toString("hex");
}

function decryptToken(ciphertext, machineId) {
  try {
    const [ivHex, encHex] = ciphertext.split(":");
    if (!ivHex || !encHex) return null;
    const key = _deriveKey(machineId);
    const iv = Buffer.from(ivHex, "hex");
    const enc = Buffer.from(encHex, "hex");
    const decipher = crypto.createDecipheriv("aes-256-cbc", key, iv);
    return Buffer.concat([decipher.update(enc), decipher.final()]).toString("utf8");
  } catch {
    return null;
  }
}

// ─── Machine ID ──────────────────────────────────────────────────────────────

/**
 * Stable machine fingerprint: SHA-256(cpuModel + hostname).
 */
function getMachineId() {
  const cpus = os.cpus();
  const cpuModel = cpus && cpus.length > 0 ? cpus[0].model : "unknown-cpu";
  const hostname = os.hostname();
  const raw = `${cpuModel}::${hostname}`;
  return crypto.createHash("sha256").update(raw).digest("hex");
}

// ─── Token file I/O ──────────────────────────────────────────────────────────

function _tokenPath(userDataDir) {
  return path.join(userDataDir, TOKEN_FILE);
}

function storeEncryptedToken(userDataDir, token) {
  const machineId = getMachineId();
  const encrypted = encryptToken(token, machineId);
  fs.writeFileSync(_tokenPath(userDataDir), encrypted, "utf8");
  log.info("[license] token stored to:", _tokenPath(userDataDir));
}

function loadEncryptedToken(userDataDir) {
  const filePath = _tokenPath(userDataDir);
  if (!fs.existsSync(filePath)) return null;
  try {
    const ciphertext = fs.readFileSync(filePath, "utf8").trim();
    const machineId = getMachineId();
    return decryptToken(ciphertext, machineId);
  } catch {
    return null;
  }
}

function clearToken(userDataDir) {
  const filePath = _tokenPath(userDataDir);
  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
    log.info("[license] token cleared");
  }
}

// ─── HTTP helpers (pure Node — no axios) ─────────────────────────────────────

function _post(urlStr, body) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body);
    const url = new URL(urlStr);
    const transport = url.protocol === "https:" ? require("https") : require("http");
    const options = {
      hostname: url.hostname,
      port: url.port || (url.protocol === "https:" ? 443 : 80),
      path: url.pathname,
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(data),
      },
    };
    const req = transport.request(options, (res) => {
      let raw = "";
      res.on("data", (chunk) => (raw += chunk));
      res.on("end", () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(raw) });
        } catch {
          resolve({ status: res.statusCode, data: raw });
        }
      });
    });
    req.on("error", reject);
    req.setTimeout(10000, () => {
      req.destroy();
      reject(new Error("Request timed out after 10s"));
    });
    req.write(data);
    req.end();
  });
}

// ─── Core license operations ──────────────────────────────────────────────────

/**
 * Activate a license key against the remote server.
 * In production this is always the Railway HTTPS server.
 * Stores the encrypted token locally on success.
 *
 * @param {string} userDataDir
 * @param {string} licenseKey
 * @param {boolean} isPackaged - pass app.isPackaged
 * @returns {{ ok: boolean, token?: string, expiry?: string, error?: string }}
 */
async function activateLicense(userDataDir, licenseKey, isPackaged) {
  const machineId = getMachineId();
  const serverUrl = getLicenseServerUrl(isPackaged);
  const baseUrl = serverUrl.replace(/\/$/, "");

  log.info("[license] using remote server:", baseUrl);
  log.info("[license] machine ID:", machineId.slice(0, 12) + "...");
  log.info("[license] activating key:", licenseKey.slice(0, 8) + "...");

  try {
    const res = await _post(`${baseUrl}/activate`, {
      license_key: licenseKey,
      machine_id: machineId,
    });

    log.info("[license] server response status:", res.status);

    if (res.status === 200 && res.data && res.data.token) {
      storeEncryptedToken(userDataDir, res.data.token);
      log.info("[license] activation success — token saved");
      return { ok: true, token: res.data.token, expiry: res.data.expiry };
    }

    const detail = (res.data && (res.data.detail || res.data.error)) || "Activation failed";
    log.warn("[license] activation failed:", detail);
    return { ok: false, error: detail };
  } catch (err) {
    log.error("[license] activation error:", err.message);
    return { ok: false, error: `Cannot reach license server: ${err.message}` };
  }
}

/**
 * Verify the locally stored token (offline — no server call).
 * @returns {{ valid: boolean, reason: string|null, expiry: string|null }}
 */
function verifyLocalToken(userDataDir) {
  const token = loadEncryptedToken(userDataDir);
  if (!token) {
    log.info("[license] no local token found");
    return { valid: false, reason: "no_token" };
  }

  const machineId = getMachineId();

  try {
    // Token format: base64url(payload).signature
    const [payloadB64] = token.split(".");
    if (!payloadB64) return { valid: false, reason: "malformed_token" };

    const padding = 4 - (payloadB64.length % 4);
    const padded = payloadB64 + "=".repeat(padding % 4);
    const payload = JSON.parse(Buffer.from(padded, "base64").toString("utf8"));

    // Machine binding check
    if (payload.mid !== machineId) {
      log.warn("[license] machine mismatch — token bound to different machine");
      return { valid: false, reason: "machine_mismatch" };
    }

    // Expiry check
    if (payload.exp) {
      const expiry = new Date(payload.exp);
      if (Date.now() > expiry.getTime()) {
        log.warn("[license] token expired at:", payload.exp);
        return { valid: false, reason: "expired" };
      }
    }

    log.info("[license] local token valid", payload.exp ? `(expires: ${payload.exp})` : "(no expiry)");
    return { valid: true, reason: null, expiry: payload.exp || null };
  } catch (err) {
    log.error("[license] token parse error:", err.message);
    return { valid: false, reason: "malformed_token" };
  }
}

/**
 * Startup check — verify local token offline.
 * Called before window loads; no network required.
 */
function loadTokenOnStartup(userDataDir) {
  const result = verifyLocalToken(userDataDir);
  log.info("[license] startup check result:", result);
  return result;
}

module.exports = {
  getMachineId,
  activateLicense,
  verifyLocalToken,
  loadTokenOnStartup,
  storeEncryptedToken,
  clearToken,
};
