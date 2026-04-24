/**
 * License Service — Electron main process module.
 * Fully isolated. Does NOT touch updater, electron-builder, or inventory backend.
 *
 * Token storage: AES-256-CBC encrypted file in userData/license.enc
 * Machine ID:    SHA-256 hash of CPU model + hostname (stable across reboots)
 */

"use strict";

const crypto = require("crypto");
const fs = require("fs");
const os = require("os");
const path = require("path");
const http = require("http");

// ─── Constants ───────────────────────────────────────────────────────────────

// Read at call time (not module load time) so the .env loader in main.js
// has already populated process.env before this value is used.
function getLicenseServer() {
  return process.env.LICENSE_SERVER_URL || "http://127.0.0.1:8001";
}
const AES_KEY_SEED = "eyerflow-aes-key-seed-v1"; // deterministic key derivation
const TOKEN_FILE = "license.enc";

// ─── AES-256 helpers ─────────────────────────────────────────────────────────

/**
 * Derive a 32-byte AES key from the machine ID so the encrypted file is
 * machine-bound even if copied to another PC.
 */
function _deriveKey(machineId) {
  return crypto.createHash("sha256").update(AES_KEY_SEED + machineId).digest();
}

function encryptToken(plaintext, machineId) {
  const key = _deriveKey(machineId);
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv("aes-256-cbc", key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  // Store as: iv_hex:encrypted_hex
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
 * Falls back to hostname-only if CPU info unavailable.
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
  if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
}

// ─── HTTP helpers (no axios — pure Node) ─────────────────────────────────────

function _post(urlStr, body) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body);
    const url = new URL(urlStr);
    // Use https for Railway (https://), http for local dev (http://)
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
    req.setTimeout(8000, () => { req.destroy(); reject(new Error("timeout")); });
    req.write(data);
    req.end();
  });
}

// ─── Core license operations ──────────────────────────────────────────────────

/**
 * Activate a license key online.
 * Stores the encrypted token locally on success.
 * Returns { ok, token, expiry, error }
 */
async function activateLicense(userDataDir, licenseKey) {
  const machineId = getMachineId();
  const licenseServer = getLicenseServer();
  // Strip trailing slash to avoid double-slash in URL
  const baseUrl = licenseServer.replace(/\/$/, "");
  try {
    const res = await _post(`${baseUrl}/activate`, {
      license_key: licenseKey,
      machine_id: machineId,
    });
    if (res.status === 200 && res.data.token) {
      storeEncryptedToken(userDataDir, res.data.token);
      return { ok: true, token: res.data.token, expiry: res.data.expiry };
    }
    const detail = res.data?.detail || "Activation failed";
    return { ok: false, error: detail };
  } catch (err) {
    return { ok: false, error: `Cannot reach license server: ${err.message}` };
  }
}

/**
 * Verify the locally stored token (offline — no server call).
 * Returns { valid, reason, expiry }
 */
function verifyLocalToken(userDataDir) {
  const token = loadEncryptedToken(userDataDir);
  if (!token) return { valid: false, reason: "no_token" };

  const machineId = getMachineId();

  // Decode payload (format: base64url_payload.signature)
  try {
    const [payloadB64] = token.split(".");
    if (!payloadB64) return { valid: false, reason: "malformed_token" };

    const padding = 4 - (payloadB64.length % 4);
    const padded = payloadB64 + "=".repeat(padding % 4);
    const payload = JSON.parse(Buffer.from(padded, "base64").toString("utf8"));

    // Machine binding check
    if (payload.mid !== machineId) return { valid: false, reason: "machine_mismatch" };

    // Expiry check
    if (payload.exp) {
      const expiry = new Date(payload.exp);
      if (Date.now() > expiry.getTime()) return { valid: false, reason: "expired" };
    }

    return { valid: true, reason: null, expiry: payload.exp || null };
  } catch {
    return { valid: false, reason: "malformed_token" };
  }
}

/**
 * Full startup check:
 * 1. Try local token verification (offline-first)
 * 2. If invalid, return false — caller shows license screen
 */
function loadTokenOnStartup(userDataDir) {
  return verifyLocalToken(userDataDir);
}

module.exports = {
  getMachineId,
  activateLicense,
  verifyLocalToken,
  loadTokenOnStartup,
  storeEncryptedToken,
  clearToken,
};
