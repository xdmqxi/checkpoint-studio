const { contextBridge, ipcRenderer } = require("electron");
contextBridge.exposeInMainWorld("studio", {
  onExportProgress: (callback) => {
    const listener = (_, value) => callback(value);
    ipcRenderer.on("export:progress", listener);
    return () => ipcRenderer.removeListener("export:progress", listener);
  },
  ...Object.fromEntries(
    [
      "sources",
      "create",
      "open",
      "save",
      "write",
      "read",
      "importMedia",
      "hasAudio",
      "exportVideo",
      "reveal",
    ].map((k) => [k, (...a) => ipcRenderer.invoke(k, ...a)]),
  ),
});

contextBridge.exposeInMainWorld("live", {
  publish: (state) => ipcRenderer.invoke("live:state", state),
  get: () => ipcRenderer.invoke("live:get"),
  fit: (width, height) => ipcRenderer.invoke("live:fit", width, height),
  action: (action) => ipcRenderer.invoke("live:action", action),
  text: (text) => ipcRenderer.invoke("live:text", text),
  onState: (callback) => {
    const listener = (_, state) => callback(state);
    ipcRenderer.on("live:state", listener);
    return () => ipcRenderer.removeListener("live:state", listener);
  },
  onCommand: (callback) => {
    const listener = (_, command) => callback(command);
    ipcRenderer.on("live:command", listener);
    return () => ipcRenderer.removeListener("live:command", listener);
  },
});
