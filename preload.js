// Secure bridge between the Electron main process and the crafting-sim page.
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('cbNative', {
  // main process pushes clipboard text here when the global Ctrl+D fires
  onImport: (cb) => ipcRenderer.on('cb-import', (_event, text) => cb(text)),
  platform: process.platform
});
