const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("desktop", {
  getVersion: () => ipcRenderer.invoke("app:getVersion"),
  backupDatabase: () => ipcRenderer.invoke("backup:create"),
  restoreDatabase: () => ipcRenderer.invoke("backup:restore"),
  getBackendInfo: () => ipcRenderer.invoke("backend:getInfo"),
  getLicenseBackendInfo: () => ipcRenderer.invoke("license-backend:getInfo"),
});

// HR Module API — exposed as window.electronAPI
contextBridge.exposeInMainWorld("electronAPI", {
  backupCreate: () => ipcRenderer.invoke("backup:create"),
  backupRestore: () => ipcRenderer.invoke("backup:restore"),
  setAutoBackup: (enabled) => ipcRenderer.invoke("backup:setAuto", enabled),
  printReceipt: (saleData) => ipcRenderer.invoke("print-receipt", saleData),
});

// License API — exposed as window.licenseAPI
contextBridge.exposeInMainWorld("licenseAPI", {
  check: () => ipcRenderer.invoke("license:check"),
  activate: (licenseKey) => ipcRenderer.invoke("license:activate", licenseKey),
  getMachineId: () => ipcRenderer.invoke("license:getMachineId"),
  clear: () => ipcRenderer.invoke("license:clear"),
});
