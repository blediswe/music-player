const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  selectMusic: () => ipcRenderer.invoke('select-music')
});