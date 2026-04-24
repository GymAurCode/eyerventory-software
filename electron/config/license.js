"use strict";

const isDev = process.env.NODE_ENV === "development";

const LICENSE_SERVER_URL = isDev
  ? "http://127.0.0.1:8001"
  : "https://license-server-production-cd65.up.railway.app";

module.exports = { LICENSE_SERVER_URL };
