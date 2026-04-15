const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("desktop", {
  getVersion: () => ipcRenderer.invoke("app:getVersion"),
  backupDatabase: () => ipcRenderer.invoke("backup:create"),
  restoreDatabase: () => ipcRenderer.invoke("backup:restore"),
});
