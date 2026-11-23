const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('desktopAPI', {
  isDesktop: true,
  platform: process.platform,
  
  // Window controls
  minimize: () => ipcRenderer.send('window:minimize'),
  maximize: () => ipcRenderer.send('window:maximize'),
  close: () => ipcRenderer.send('window:close'),
  
  // Database configuration
  getDbConfig: () => ipcRenderer.invoke('db:get-config'),
  saveDbConfig: (config) => ipcRenderer.invoke('db:save-config', config),
  testDbConnection: (uri) => ipcRenderer.invoke('db:test-connection', uri),

  // Printing & Hardware
  getPrinters: () => ipcRenderer.invoke('printer:get-list'),
  printSilent: (options) => ipcRenderer.invoke('printer:print-silent', options),
  
  // Server status
  getServerStatus: () => ipcRenderer.invoke('server:status')
});
