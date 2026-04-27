const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('flex', {
  onWorkData: (cb) => ipcRenderer.on('work-data', (_, data) => cb(data)),
  onTick: (cb) => ipcRenderer.on('tick', (_, data) => cb(data)),
  requestData: () => ipcRenderer.send('request-data'),
  refresh: () => ipcRenderer.send('refresh'),
  openLogin: () => ipcRenderer.send('open-login'),
  openSettings: () => ipcRenderer.send('open-settings'),
  quit: () => ipcRenderer.send('quit'),
  getBreakMinutes: () => ipcRenderer.invoke('get-break-minutes'),
  setBreakMinutes: (min) => ipcRenderer.send('set-break-minutes', min),
  clockIn: () => ipcRenderer.invoke('clock-in'),
  clockOut: () => ipcRenderer.invoke('clock-out'),
  getSettings: () => ipcRenderer.invoke('get-settings'),
  saveSettings: (settings) => ipcRenderer.send('save-settings', settings),
  resizeWindow: (width, height) => ipcRenderer.send('resize-window', width, height),
  getLaunchAtLogin: () => ipcRenderer.invoke('get-launch-at-login'),
  setLaunchAtLogin: (val) => ipcRenderer.send('set-launch-at-login', val),
});
