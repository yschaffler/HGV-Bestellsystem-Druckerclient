const {
  app,
  BrowserWindow,
  Tray,
  Menu,
  ipcMain,
  Notification,
  nativeImage,
  shell,
  dialog,
} = require('electron')
const path = require('path')
const fs = require('fs')

// ─── Konstanten ─────────────────────────────────────────────────────────────

const isDev = process.env.NODE_ENV === 'development'
const CONFIG_PATH = path.join(app.getPath('userData'), 'config.json')
const ICON_PATH = path.join(__dirname, '..', 'assets', 'icon.ico')
console.log("configpath", CONFIG_PATH)
// ─── State ───────────────────────────────────────────────────────────────────

let mainWindow = null
let printWindow = null
let tray = null

// ─── Config ──────────────────────────────────────────────────────────────────

function loadConfig() {
  try {
    if (fs.existsSync(CONFIG_PATH)) {
      return JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'))
    }
  } catch (e) {
    console.error('[config] Fehler beim Laden:', e)
  }
  return {
    serverUrl: '',
    secret: '',
    barName: '',
    printerName: '',
    printerType: 'windows', // 'windows' | 'com'
    comPort: 'COM3',
    autoPrint: true,
    soundEnabled: true,
    autoStart: false,
  }
}

function saveConfig(config) {
  try {
    fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2), 'utf8')
    return { success: true }
  } catch (e) {
    console.error('[config] Fehler beim Speichern:', e)
    return { success: false, error: e.message }
  }
}

// ─── Hauptfenster ────────────────────────────────────────────────────────────

function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 1000,
    height: 680,
    minWidth: 760,
    minHeight: 520,
    // Frameless für custom Titelleiste
    frame: false,
    transparent: false,
    backgroundColor: '#f4f4f5',
    // Icon
    ...(fs.existsSync(ICON_PATH) ? { icon: ICON_PATH } : {}),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
    show: false,
  })

  // Dev: Vite Dev-Server | Prod: gebaute Dateien
  if (isDev) {
    mainWindow.loadURL('http://localhost:5173')
    mainWindow.webContents.openDevTools()
  } else {
    mainWindow.loadFile(path.join(__dirname, '..', 'dist', 'index.html'))
  }

  mainWindow.once('ready-to-show', () => {
    mainWindow.show()
  })

  // Schließen → in Tray minimieren (nicht beenden)
  mainWindow.on('close', (e) => {
    e.preventDefault()
    mainWindow.hide()
  })
}

// ─── Druckfenster (versteckt, nur zum Drucken) ───────────────────────────────

function createPrintWindow() {
  printWindow = new BrowserWindow({
    width: 400,
    height: 800,
    show: false,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
    },
  })
}

// ─── System-Tray ─────────────────────────────────────────────────────────────

function createTray() {
  // Fallback-Icon falls assets/icon.ico fehlt
  let icon
  if (fs.existsSync(ICON_PATH)) {
    icon = nativeImage.createFromPath(ICON_PATH)
  } else {
    // 16×16 schwarzes PNG als Fallback
    icon = nativeImage.createEmpty()
  }

  tray = new Tray(icon)
  tray.setToolTip('HGV-Bestellsystem Druckerclient')

  const menu = Menu.buildFromTemplate([
    { label: 'HGV-Bestellsystem Druckerclient', enabled: false },
    { type: 'separator' },
    {
      label: 'Öffnen',
      click: () => {
        mainWindow.show()
        mainWindow.focus()
      },
    },
    {
      label: 'Einstellungen',
      click: () => {
        mainWindow.show()
        mainWindow.focus()
        mainWindow.webContents.send('navigate', 'settings')
      },
    },
    { type: 'separator' },
    {
      label: 'Beenden',
      click: () => {
        app.exit(0)
      },
    },
  ])

  tray.setContextMenu(menu)

  tray.on('double-click', () => {
    mainWindow.show()
    mainWindow.focus()
  })
}

// ─── IPC Handler ─────────────────────────────────────────────────────────────

// Config
ipcMain.handle('get-config', () => loadConfig())
ipcMain.handle('save-config', (_e, config) => saveConfig(config))

// Fenster-Steuerung (für custom Titelleiste)
ipcMain.handle('window-minimize', () => mainWindow?.minimize())
ipcMain.handle('window-maximize', () => {
  if (mainWindow?.isMaximized()) mainWindow.unmaximize()
  else mainWindow?.maximize()
})
ipcMain.handle('window-close', () => mainWindow?.hide())
ipcMain.handle('quit-app', () => app.exit(0))

// Autostart
ipcMain.handle('set-autostart', (_e, enabled) => {
  app.setLoginItemSettings({
    openAtLogin: enabled,
    openAsHidden: true,
    name: 'HGV Bestellsystem Druckerclient',
    executablePath: app.getPath('exe'),
  })
  return { success: true }
})
ipcMain.handle('get-autostart', () => {
  return app.getLoginItemSettings().openAtLogin
})

// Drucker
ipcMain.handle('get-printers', async () => {
  try {
    const printers = await mainWindow.webContents.getPrintersAsync()
    return { success: true, printers }
  } catch (e) {
    return { success: false, printers: [], error: e.message }
  }
})

// Druckerstatus abfragen (Windows PRINTER_STATUS_* Flags)
ipcMain.handle('get-printer-status', async (_e, printerName) => {
  if (!printerName) return { online: null, text: 'Kein Drucker konfiguriert' }
  try {
    const printers = await mainWindow.webContents.getPrintersAsync()
    const p = printers.find((pr) => pr.name === printerName)
    if (!p) return { online: false, text: 'Drucker nicht gefunden' }
    const s = p.status || 0
    if (s === 0)       return { online: true,  text: 'Bereit' }
    if (s & 0x080)     return { online: false, text: 'Offline' }
    if (s & 0x008)     return { online: false, text: 'Kein Papier' }
    if (s & 0x004)     return { online: false, text: 'Papierstau' }
    if (s & 0x002)     return { online: false, text: 'Fehler' }
    return { online: false, text: 'Unbekannt' }
  } catch (e) {
    return { online: null, text: 'Statusabfrage fehlgeschlagen' }
  }
})

// COM-Ports via serialport
ipcMain.handle('get-com-ports', async () => {
  try {
    const { SerialPort } = require('serialport')
    const ports = await SerialPort.list()
    return { success: true, ports }
  } catch (e) {
    return { success: false, ports: [], error: e.message }
  }
})

// Drucken
ipcMain.handle('print-order', async (_e, { order, config }) => {
  const {
    buildPrintHtml,
    buildPrintHtmlFromLayout,
    buildEscPosBufferFromLayout,
    printToWindowsPrinter,
    printToWindowsPrinterEscPos,
    printToComPort,
    DEFAULT_LAYOUT,
  } = require('./printer')

  const layout = Array.isArray(config.bonLayout) && config.bonLayout.length > 0
    ? config.bonLayout
    : DEFAULT_LAYOUT

  try {
    if (config.printerType === 'com') {
      await printToComPort(config.comPort, order)
    } else if (config.printerType === 'escpos') {
      const { execFile } = require('child_process')
      const fs   = require('fs')
      const os   = require('os')
      const path = require('path')

      const buffer  = buildEscPosBufferFromLayout(order, config.barName, layout)
      const ts      = Date.now()
      const tmpBin  = path.join(os.tmpdir(), `hgv_escpos_${ts}.bin`)
      const tmpPs   = path.join(os.tmpdir(), `hgv_escpos_${ts}.ps1`)

      fs.writeFileSync(tmpBin, buffer)

      const safePrinter = config.printerName.replace(/'/g, "''")
      const safeBin     = tmpBin.replace(/\\/g, '\\\\')

      const ps = `
$ErrorActionPreference = 'Stop'
$bytes = [System.IO.File]::ReadAllBytes('${safeBin}')
Add-Type -Namespace HgvPrint -Name WinSpool -MemberDefinition @'
  [DllImport("winspool.drv", CharSet=CharSet.Ansi)]
  public static extern bool OpenPrinter(string name, out IntPtr handle, IntPtr def);
  [DllImport("winspool.drv")]
  public static extern bool ClosePrinter(IntPtr handle);
  [DllImport("winspool.drv", CharSet=CharSet.Ansi)]
  public static extern int StartDocPrinter(IntPtr h, int lvl, ref DOCINFO di);
  [DllImport("winspool.drv")]
  public static extern bool EndDocPrinter(IntPtr h);
  [DllImport("winspool.drv")]
  public static extern bool StartPagePrinter(IntPtr h);
  [DllImport("winspool.drv")]
  public static extern bool EndPagePrinter(IntPtr h);
  [DllImport("winspool.drv")]
  public static extern bool WritePrinter(IntPtr h, IntPtr buf, int len, out int written);
  [StructLayout(LayoutKind.Sequential, CharSet=CharSet.Ansi)]
  public struct DOCINFO {
    [MarshalAs(UnmanagedType.LPStr)] public string pDocName;
    [MarshalAs(UnmanagedType.LPStr)] public string pOutputFile;
    [MarshalAs(UnmanagedType.LPStr)] public string pDataType;
  }
'@
$h = [IntPtr]::Zero
if (-not [HgvPrint.WinSpool]::OpenPrinter('${safePrinter}', [ref]$h, [IntPtr]::Zero)) {
  throw "Drucker '${safePrinter}' konnte nicht geoeffnet werden."
}
$di = New-Object HgvPrint.WinSpool+DOCINFO
$di.pDocName  = 'HGV Bon'
$di.pDataType = 'RAW'
[HgvPrint.WinSpool]::StartDocPrinter($h, 1, [ref]$di) | Out-Null
[HgvPrint.WinSpool]::StartPagePrinter($h) | Out-Null
$gc = [Runtime.InteropServices.GCHandle]::Alloc($bytes, 'Pinned')
$written = 0
[HgvPrint.WinSpool]::WritePrinter($h, $gc.AddrOfPinnedObject(), $bytes.Length, [ref]$written) | Out-Null
$gc.Free()
[HgvPrint.WinSpool]::EndPagePrinter($h) | Out-Null
[HgvPrint.WinSpool]::EndDocPrinter($h) | Out-Null
[HgvPrint.WinSpool]::ClosePrinter($h) | Out-Null
`
      fs.writeFileSync(tmpPs, ps, 'utf8')

      await new Promise((resolve, reject) => {
        execFile(
          'powershell.exe',
          ['-NonInteractive', '-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', tmpPs],
          { timeout: 20000 },
          (err, _stdout, stderr) => {
            try { fs.unlinkSync(tmpBin) } catch (_) {}
            try { fs.unlinkSync(tmpPs)  } catch (_) {}
            if (err) reject(new Error(stderr?.trim() || err.message))
            else resolve()
          }
        )
      })
    } else {
      const html = buildPrintHtmlFromLayout(order, config.barName, layout)
      await printToWindowsPrinter(printWindow, config.printerName, html)
    }
    return { success: true }
  } catch (e) {
    console.error('[print] Fehler:', e)
    return { success: false, error: e.message }
  }
})

// Test-Druck
ipcMain.handle('test-print', async (_e, config) => {
  const {
    buildPrintHtmlFromLayout,
    buildEscPosBufferFromLayout,
    printToWindowsPrinter,
    printToComPort,
    DEFAULT_LAYOUT,
  } = require('./printer')

  const testOrder = {
    order_id: 42,
    job_type: 'RECHNUNG',
    table: 7,
    waiter_name: 'Testdruck',
    items: [
      { name: 'Club Mate', quantity: 2, price: 2.5 },
      { name: 'Bier 0,5l', quantity: 1, price: 3.0, note: 'ohne Schaum' },
      { name: 'Spezi', quantity: 3, price: 2.0 },
    ],
    note: 'HGV Bestellsystem – Druckerclient',
  }

  const layout = Array.isArray(config.bonLayout) && config.bonLayout.length > 0
    ? config.bonLayout
    : DEFAULT_LAYOUT

  try {
    if (config.printerType === 'com') {
      await printToComPort(config.comPort, testOrder)
    } else if (config.printerType === 'escpos') {
      const { execFile } = require('child_process')
      const fs   = require('fs')
      const os   = require('os')
      const path = require('path')

      const buffer  = buildEscPosBufferFromLayout(testOrder, config.barName, layout)
      const ts      = Date.now()
      const tmpBin  = path.join(os.tmpdir(), `hgv_escpos_${ts}.bin`)
      const tmpPs   = path.join(os.tmpdir(), `hgv_escpos_${ts}.ps1`)

      fs.writeFileSync(tmpBin, buffer)

      const safePrinter = config.printerName.replace(/'/g, "''")
      const safeBin     = tmpBin.replace(/\\/g, '\\\\')

      const ps = `
$ErrorActionPreference = 'Stop'
$bytes = [System.IO.File]::ReadAllBytes('${safeBin}')
Add-Type -Namespace HgvPrint -Name WinSpool -MemberDefinition @'
  [DllImport("winspool.drv", CharSet=CharSet.Ansi)]
  public static extern bool OpenPrinter(string name, out IntPtr handle, IntPtr def);
  [DllImport("winspool.drv")]
  public static extern bool ClosePrinter(IntPtr handle);
  [DllImport("winspool.drv", CharSet=CharSet.Ansi)]
  public static extern int StartDocPrinter(IntPtr h, int lvl, ref DOCINFO di);
  [DllImport("winspool.drv")]
  public static extern bool EndDocPrinter(IntPtr h);
  [DllImport("winspool.drv")]
  public static extern bool StartPagePrinter(IntPtr h);
  [DllImport("winspool.drv")]
  public static extern bool EndPagePrinter(IntPtr h);
  [DllImport("winspool.drv")]
  public static extern bool WritePrinter(IntPtr h, IntPtr buf, int len, out int written);
  [StructLayout(LayoutKind.Sequential, CharSet=CharSet.Ansi)]
  public struct DOCINFO {
    [MarshalAs(UnmanagedType.LPStr)] public string pDocName;
    [MarshalAs(UnmanagedType.LPStr)] public string pOutputFile;
    [MarshalAs(UnmanagedType.LPStr)] public string pDataType;
  }
'@
$h = [IntPtr]::Zero
if (-not [HgvPrint.WinSpool]::OpenPrinter('${safePrinter}', [ref]$h, [IntPtr]::Zero)) {
  throw "Drucker '${safePrinter}' konnte nicht geoeffnet werden."
}
$di = New-Object HgvPrint.WinSpool+DOCINFO
$di.pDocName  = 'HGV Bon'
$di.pDataType = 'RAW'
[HgvPrint.WinSpool]::StartDocPrinter($h, 1, [ref]$di) | Out-Null
[HgvPrint.WinSpool]::StartPagePrinter($h) | Out-Null
$gc = [Runtime.InteropServices.GCHandle]::Alloc($bytes, 'Pinned')
$written = 0
[HgvPrint.WinSpool]::WritePrinter($h, $gc.AddrOfPinnedObject(), $bytes.Length, [ref]$written) | Out-Null
$gc.Free()
[HgvPrint.WinSpool]::EndPagePrinter($h) | Out-Null
[HgvPrint.WinSpool]::EndDocPrinter($h) | Out-Null
[HgvPrint.WinSpool]::ClosePrinter($h) | Out-Null
`
      fs.writeFileSync(tmpPs, ps, 'utf8')

      await new Promise((resolve, reject) => {
        execFile(
          'powershell.exe',
          ['-NonInteractive', '-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', tmpPs],
          { timeout: 20000 },
          (err, _stdout, stderr) => {
            try { fs.unlinkSync(tmpBin) } catch (_) {}
            try { fs.unlinkSync(tmpPs)  } catch (_) {}
            if (err) reject(new Error(stderr?.trim() || err.message))
            else resolve()
          }
        )
      })
    } else {
      const html = buildPrintHtmlFromLayout(testOrder, config.barName, layout)
      await printToWindowsPrinter(printWindow, config.printerName, html)
    }
    return { success: true }
  } catch (e) {
    console.error('[test-print] Fehler:', e)
    return { success: false, error: e.message }
  }
})

// Layout exportieren
ipcMain.handle('export-layout', async (_e, layout) => {
  const { filePath, canceled } = await dialog.showSaveDialog(mainWindow, {
    title: 'Bon-Layout exportieren',
    defaultPath: 'bon-layout.json',
    filters: [{ name: 'JSON', extensions: ['json'] }],
  })
  if (canceled || !filePath) return { success: false, canceled: true }
  try {
    fs.writeFileSync(filePath, JSON.stringify({ bonLayout: layout }, null, 2), 'utf8')
    return { success: true }
  } catch (e) {
    return { success: false, error: e.message }
  }
})

// Layout importieren
ipcMain.handle('import-layout', async () => {
  const { filePaths, canceled } = await dialog.showOpenDialog(mainWindow, {
    title: 'Bon-Layout importieren',
    filters: [{ name: 'JSON', extensions: ['json'] }],
    properties: ['openFile'],
  })
  if (canceled || !filePaths.length) return { success: false, canceled: true }
  try {
    const raw = fs.readFileSync(filePaths[0], 'utf8')
    const data = JSON.parse(raw)
    const layout = Array.isArray(data) ? data : data.bonLayout
    if (!Array.isArray(layout)) throw new Error('Ungültiges Layout-Format')
    return { success: true, layout }
  } catch (e) {
    return { success: false, error: e.message }
  }
})

// Benachrichtigung
ipcMain.handle('show-notification', (_e, { title, body }) => {
  if (Notification.isSupported()) {
    new Notification({ title, body }).show()
  }
})

// Tray-Tooltip aktualisieren
ipcMain.handle('set-tray-tooltip', (_e, text) => {
  tray?.setToolTip(text)
})

// ─── App-Lifecycle ────────────────────────────────────────────────────────────

app.whenReady().then(() => {
  createMainWindow()
  createPrintWindow()
  createTray()
})

// Kein Beenden wenn alle Fenster geschlossen (läuft im Tray weiter)
app.on('window-all-closed', (e) => e.preventDefault())

// macOS: Fenster bei App-Click wieder öffnen
app.on('activate', () => {
  if (mainWindow) {
    mainWindow.show()
    mainWindow.focus()
  }
})
