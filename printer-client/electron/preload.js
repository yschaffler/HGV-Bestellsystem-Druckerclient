const { contextBridge, ipcRenderer } = require('electron')

/**
 * Sichere IPC-Bridge: Exposiert nur explizit definierte Funktionen
 * an den Renderer-Prozess (React App).
 */
contextBridge.exposeInMainWorld('electron', {
  // ── Config ──────────────────────────────────────────────────────────────
  getConfig: () => ipcRenderer.invoke('get-config'),
  saveConfig: (config) => ipcRenderer.invoke('save-config', config),

  // ── Fenster ─────────────────────────────────────────────────────────────
  minimize: () => ipcRenderer.invoke('window-minimize'),
  maximize: () => ipcRenderer.invoke('window-maximize'),
  close: () => ipcRenderer.invoke('window-close'),
  quit: () => ipcRenderer.invoke('quit-app'),

  // ── Autostart ───────────────────────────────────────────────────────────
  setAutostart: (enabled) => ipcRenderer.invoke('set-autostart', enabled),
  getAutostart: () => ipcRenderer.invoke('get-autostart'),

  // ── Drucker ─────────────────────────────────────────────────────────────
  getPrinters: () => ipcRenderer.invoke('get-printers'),
  getPrinterStatus: (name) => ipcRenderer.invoke('get-printer-status', name),
  getComPorts: () => ipcRenderer.invoke('get-com-ports'),
  printOrder: (order, config) =>
    ipcRenderer.invoke('print-order', { order, config }),
  testPrint: (config) => ipcRenderer.invoke('test-print', config),

  // ── Benachrichtigungen ───────────────────────────────────────────────────
  showNotification: (title, body) =>
    ipcRenderer.invoke('show-notification', { title, body }),
  setTrayTooltip: (text) => ipcRenderer.invoke('set-tray-tooltip', text),

  // ── Events vom Main-Prozess ──────────────────────────────────────────────
  onNavigate: (callback) => {
    ipcRenderer.on('navigate', (_e, screen) => callback(screen))
  },
})
