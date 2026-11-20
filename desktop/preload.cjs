const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("riwaqDesktop", {
  startDownload: (request) => ipcRenderer.invoke("riwaq:download:start", request),
  lookupSteamMetadata: (query, appId) => ipcRenderer.invoke("riwaq:metadata:steam", { query, appId }),
  listDownloadedGames: () => ipcRenderer.invoke("riwaq:library:list-downloaded"),
  controlDownload: (itemId, action) => ipcRenderer.invoke("riwaq:download:control", { itemId, action }),
  showDownloadedFile: (itemId) => ipcRenderer.invoke("riwaq:download:show", itemId),
  onAppUpdateStatus: (callback) => {
    const listener = (_event, status) => callback(status);
    ipcRenderer.on("riwaq:update:status", listener);
    return () => ipcRenderer.removeListener("riwaq:update:status", listener);
  },
  onDownloadUpdate: (callback) => {
    const listener = (_event, update) => callback(update);
    ipcRenderer.on("riwaq:download:update", listener);
    return () => ipcRenderer.removeListener("riwaq:download:update", listener);
  }
});
