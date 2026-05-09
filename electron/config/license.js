"use strict";

/**
 * License server URL resolution.
 *
 * Production (packaged EXE): always use the Railway hosted server.
 * Development: use local license service if available, fall back to Railway.
 *
 * NOTE: This module is loaded in the Electron main process where
 * `app.isPackaged` is available. We export a function so the URL is
 * resolved at call-time (after app is ready) rather than at module load.
 */

const RAILWAY_URL = "https://web-production-b7053.up.railway.app";
const LOCAL_DEV_URL = "http://127.0.0.1:8001";

/**
 * Returns the correct license server URL.
 * @param {boolean} isPackaged - pass app.isPackaged from the caller
 */
function getLicenseServerUrl(isPackaged) {
  if (isPackaged) {
    return RAILWAY_URL;
  }
  // Development: prefer env override, fall back to local, then Railway
  return process.env.LICENSE_SERVER_URL || LOCAL_DEV_URL;
}

module.exports = { getLicenseServerUrl, RAILWAY_URL, LOCAL_DEV_URL };
