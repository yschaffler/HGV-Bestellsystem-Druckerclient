/**
 * printer.js – Drucker-Utilities für Electron Main Process
 *
 * Unterstützt:
 *   - Windows-Drucker (TM-T88IV): über Windows Print Spooler
 *   - COM-Port (TM-T88I, ~1996): ESC/POS direkt über seriellen Port
 */

// ─── Umlaut-Ersatz für ältere Drucker ohne UTF-8 ─────────────────────────────

function replaceUmlauts(text) {
  return String(text)
    .replace(/ä/g, 'ae')
    .replace(/Ä/g, 'Ae')
    .replace(/ö/g, 'oe')
    .replace(/Ö/g, 'Oe')
    .replace(/ü/g, 'ue')
    .replace(/Ü/g, 'Ue')
    .replace(/ß/g, 'ss')
    .replace(/€/g, 'EUR')
}

// ─── Preis-Formatierung ───────────────────────────────────────────────────────

function formatPrice(price) {
  return Number(price).toFixed(2).replace('.', ',') + ' EUR'
}

function formatTime(date) {
  return date.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })
}

// ─── Windows-Drucker (TM-T88IV) ──────────────────────────────────────────────

/**
 * Baut HTML für den Druckjob auf.
 * Wird in einem versteckten BrowserWindow gerendert und gedruckt.
 */
function isStorno(order) {
  return String(order.job_type).toUpperCase() === 'STORNO'
}

function buildPrintHtml(order, barName = '') {
  const now = new Date()
  const storno = isStorno(order)
  const total = order.items.reduce(
    (sum, item) => sum + item.price * item.quantity,
    0
  )

  const itemRows = order.items
    .map((item) => `
      <tr class="${storno ? 'storno-row' : ''}">
        <td class="qty">${item.quantity}x</td>
        <td class="name">${item.name}</td>
        <td class="price">${storno ? '–' : ''}${formatPrice(item.price * item.quantity)}</td>
      </tr>
      ${item.note ? `
      <tr class="note-row">
        <td></td>
        <td colspan="2" class="note">↳ ${item.note}</td>
      </tr>` : ''}`)
    .join('')

  const venue = barName || 'Abiball 2026'

  return `<!DOCTYPE html>
<html lang="de">
<head>
<meta charset="UTF-8">
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }

  body {
    font-family: 'Courier New', Courier, monospace;
    font-size: 13px;
    line-height: 1.45;
    width: 72mm;
    color: #000;
    background: #fff;
  }

  /* ── Header ─────────────────────────────── */
  .header {
    text-align: center;
    padding: 4mm 2mm 3mm;
    border-bottom: 2px solid #000;
  }
  .venue {
    font-size: 19px;
    font-weight: bold;
    letter-spacing: 1px;
    text-transform: uppercase;
  }
  .doc-type {
    font-size: 11px;
    letter-spacing: 3px;
    margin-top: 2px;
  }

  /* ── Storno-Banner ───────────────────────── */
  .storno-banner {
    text-align: center;
    font-size: 15px;
    font-weight: bold;
    letter-spacing: 2px;
    padding: 3mm 0;
    border-bottom: 1px dashed #000;
  }

  /* ── Meta (Datum / Kellner) ─────────────── */
  .meta {
    padding: 2mm 2mm;
    font-size: 12px;
    border-bottom: 1px dashed #000;
  }
  .meta-row {
    display: flex;
    justify-content: space-between;
    padding: 1px 0;
  }
  .meta-row .lbl { color: #444; }
  .meta-row .val { font-weight: bold; }

  /* ── Bon-Nr / Tisch ─────────────────────── */
  .order-info {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    padding: 2mm 2mm;
    font-weight: bold;
    font-size: 15px;
    border-bottom: 2px solid #000;
  }

  /* ── Artikel ────────────────────────────── */
  .items { padding: 2mm 2mm 1mm; }
  table { width: 100%; border-collapse: collapse; }
  td { padding: 2px 0; vertical-align: top; }
  td.qty  { width: 30px; white-space: nowrap; font-weight: bold; }
  td.name { padding-left: 3px; word-break: break-word; }
  td.price { text-align: right; white-space: nowrap; }
  .storno-row td { text-decoration: line-through; color: #555; }
  .note-row .note {
    font-size: 11px;
    font-style: italic;
    color: #444;
    padding: 0 0 3px 4px;
  }

  /* ── Gesamt ─────────────────────────────── */
  .total-section {
    border-top: 2px solid #000;
    padding: 3mm 2mm 2mm;
  }
  .total-row {
    display: flex;
    justify-content: space-between;
    font-weight: bold;
    font-size: 16px;
  }

  /* ── Notiz ──────────────────────────────── */
  .note-section {
    border-top: 1px dashed #000;
    padding: 2mm 2mm;
    font-size: 12px;
  }
  .note-section strong { font-weight: bold; }

  /* ── Footer ─────────────────────────────── */
  .footer {
    border-top: 1px dashed #000;
    text-align: center;
    padding: 3mm 2mm 6mm;
    font-size: 11px;
    color: #555;
  }

  @media print {
    html, body { width: auto; }
  }
</style>
</head>
<body>

  <div class="header">
    <div class="venue">${venue}</div>
    <div class="doc-type">${storno ? '— STORNO —' : '— BESTELLUNG —'}</div>
  </div>

  ${storno ? '<div class="storno-banner">*** STORNO ***</div>' : ''}

  <div class="meta">
    <div class="meta-row">
      <span class="lbl">Datum</span>
      <span class="val">${now.toLocaleDateString('de-DE')}</span>
    </div>
    <div class="meta-row">
      <span class="lbl">Uhrzeit</span>
      <span class="val">${formatTime(now)} Uhr</span>
    </div>
    <div class="meta-row">
      <span class="lbl">Kellner</span>
      <span class="val">${order.waiter_name || '–'}</span>
    </div>
  </div>

  <div class="order-info">
    <span>Bon #${order.order_id}</span>
    <span>Tisch ${order.table ?? '–'}</span>
  </div>

  <div class="items">
    <table>${itemRows}</table>
  </div>

  <div class="total-section">
    <div class="total-row">
      <span>${storno ? 'STORNO' : 'GESAMT'}</span>
      <span>${storno ? '–' : ''}${formatPrice(total)}</span>
    </div>
  </div>

  ${order.note ? `
  <div class="note-section">
    <strong>Notiz:</strong> ${order.note}
  </div>` : ''}

  <div class="footer">${venue} &mdash; Viel Spaß!</div>

</body>
</html>`
}

/**
 * Druckt über Windows Print Spooler (für TM-T88IV mit Windows-Treiber).
 */
async function printToWindowsPrinter(printWindow, printerName, html) {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(
      () => reject(new Error('Druckvorgang Timeout (30s)')),
      30000
    )

    printWindow.loadURL(
      `data:text/html;charset=utf-8,${encodeURIComponent(html)}`
    )

    printWindow.webContents.once('did-finish-load', () => {
      printWindow.webContents.print(
        {
          silent: true,
          deviceName: printerName,
          margins: { marginType: 'none' },
          copies: 1,
          scaleFactor: 100,
          // Thermal-Rolle: 72mm Breite, Höhe groß genug für beliebigen Bon
          pageSize: { width: 72000, height: 999000 },
        },
        (success, errorType) => {
          clearTimeout(timeout)
          if (success) resolve()
          else reject(new Error(`Druckfehler: ${errorType}`))
        }
      )
    })
  })
}

// ─── ESC/POS Buffer Builder ───────────────────────────────────────────────────

const ESC = 0x1b
const GS  = 0x1d

/**
 * Baut einen ESC/POS-Byte-Buffer für den TM-T88V.
 * Wird sowohl für den COM-Port-Druck als auch für den RAW-Windows-Druck genutzt.
 *
 * Zeichensatz: PC858 (ESC t 16) – enthält ä/ö/ü/ß nativ, kein Umlaut-Ersatz nötig.
 * Zeilenbreite: 42 Zeichen bei Normalgröße.
 */
function buildEscPosBuffer(order, barName = '') {
  const now    = new Date()
  const storno = isStorno(order)
  const total  = order.items.reduce((sum, i) => sum + i.price * i.quantity, 0)
  const W      = 42   // Zeichen pro Zeile (Normalgröße, 80 mm Papier)

  // ── ESC/POS-Befehle ────────────────────────────────────────────────────────
  const CMD = {
    INIT:        Buffer.from([ESC, 0x40]),
    CHARSET_858: Buffer.from([ESC, 0x74, 0x10]),  // PC858 – ä ö ü ß nativ
    ALIGN_LEFT:  Buffer.from([ESC, 0x61, 0x00]),
    BOLD_ON:     Buffer.from([ESC, 0x45, 0x01]),
    BOLD_OFF:    Buffer.from([ESC, 0x45, 0x00]),
    DBL_H:       Buffer.from([GS,  0x21, 0x01]),  // 2× Höhe (Breite bleibt 42 Z.)
    NORMAL:      Buffer.from([GS,  0x21, 0x00]),
    CUT:         Buffer.from([GS,  0x56, 0x42, 0x05]),
    LF:          Buffer.from([0x0a]),
  }

  // Zeile als latin1-Buffer
  function ln(text = '') {
    return Buffer.from(String(text) + '\n', 'latin1')
  }

  // Zwei Spalten: links + rechts, dazwischen Leerzeichen bis W Zeichen
  function pad(left, right, width = W) {
    left  = String(left)
    right = String(right)
    const spaces = Math.max(1, width - left.length - right.length)
    return Buffer.from(left + ' '.repeat(spaces) + right + '\n', 'latin1')
  }

  // Drei Spalten gleichmäßig verteilt auf W Zeichen
  function threeCol(left, center, right, width = W) {
    left   = String(left)
    center = String(center)
    right  = String(right)
    const spare = Math.max(2, width - left.length - center.length - right.length)
    const g1 = Math.ceil(spare / 2)
    const g2 = spare - g1
    return Buffer.from(
      left + ' '.repeat(g1) + center + ' '.repeat(g2) + right + '\n',
      'latin1'
    )
  }

  // Trennlinie
  function sep(ch = '=') {
    return Buffer.from(ch.repeat(W) + '\n', 'latin1')
  }

  // ── Header: Tisch | Bar | Zeit – alle drei auf einer Zeile ────────────────
  const venue = String(barName || 'HGV').toUpperCase()
  const header = storno
    ? threeCol(`Tisch ${order.table ?? '-'}`, venue, formatTime(now))
    : threeCol(`Tisch ${order.table ?? '-'}`, venue, formatTime(now))

  const chunks = [
    CMD.INIT,
    CMD.CHARSET_858,
    CMD.ALIGN_LEFT,
    CMD.BOLD_ON,
    CMD.DBL_H,
    header,
    CMD.NORMAL,
    CMD.BOLD_OFF,
    sep('='),
  ]

  // ── Storno-Banner ──────────────────────────────────────────────────────────
  if (storno) {
    chunks.push(
      CMD.LF,
      CMD.BOLD_ON,
      ln('*** STORNO ***'),
      CMD.BOLD_OFF,
    )
  }

  // ── Artikel ────────────────────────────────────────────────────────────────
  // Doppelte Höhe → 42 Zeichen Breite bleibt, Text wirkt größer & besser lesbar
  // Abstand nach Header: eine Leerzeile
  chunks.push(CMD.LF)

  for (let i = 0; i < order.items.length; i++) {
    const item  = order.items[i]
    const qty   = storno ? `-${item.quantity}x` : `${item.quantity}x`
    const price = storno
      ? `-${formatPrice(item.price * item.quantity)}`
      : formatPrice(item.price * item.quantity)

    // Mit DBL_H bleibt die Zeilenbreite 42 Zeichen
    const nameMax = W - qty.length - 3 - 1 - price.length
    const name = String(item.name).substring(0, nameMax).padEnd(nameMax)

    chunks.push(
      CMD.DBL_H,
      Buffer.from(`${qty}   ${name} ${price}\n`, 'latin1'),
      CMD.NORMAL,
    )

    if (item.note) {
      // Notiz in Normalgröße, leicht eingerückt
      chunks.push(Buffer.from(`     -> ${item.note}\n`, 'latin1'))
    }

    // Abstand zwischen Artikeln
    chunks.push(CMD.LF)
  }

  // ── Gesamt ─────────────────────────────────────────────────────────────────
  const totalLabel = storno ? 'STORNO' : 'GESAMT'
  const totalValue = storno ? `-${formatPrice(total)}` : formatPrice(total)

  chunks.push(
    sep('='),
    CMD.BOLD_ON,
    pad(totalLabel, totalValue),
    CMD.BOLD_OFF,
    sep('-'),
  )

  // ── Gesamtnotiz ────────────────────────────────────────────────────────────
  if (order.note) {
    chunks.push(CMD.LF, ln(`Notiz: ${order.note}`))
  }

  // ── Footer: Kellner | #Bon-Nr | Datum ─────────────────────────────────────
  chunks.push(
    threeCol(
      order.waiter_name || '-',
      `#${order.order_id}`,
      now.toLocaleDateString('de-DE'),
    ),
    Buffer.from('\n\n\n'),
    CMD.CUT,
  )

  return Buffer.concat(chunks)
}

// ─── ESC/POS über Windows-Drucker (RAW-Modus via PowerShell/WinSpool) ────────

/**
 * Sendet rohe ESC/POS-Bytes direkt an einen Windows-Drucker (RAW-Dateitype).
 * Kein zusätzliches npm-Paket nötig – nutzt die WinSpool-API via PowerShell.
 *
 * Funktioniert mit dem EPSON Advanced Printer Driver (APD) und dem
 * generischen ESC/POS-Treiber. Der Drucker muss als Windows-Drucker installiert sein.
 */
async function printToWindowsPrinterEscPos(printerName, order, barName) {
  const { execFile } = require('child_process')
  const fs   = require('fs')
  const os   = require('os')
  const path = require('path')

  const buffer  = buildEscPosBuffer(order, barName)
  const ts      = Date.now()
  const tmpBin  = path.join(os.tmpdir(), `hgv_escpos_${ts}.bin`)
  const tmpPs   = path.join(os.tmpdir(), `hgv_escpos_${ts}.ps1`)

  fs.writeFileSync(tmpBin, buffer)

  // Sonderzeichen in Druckernamen für PowerShell escapen
  const safePrinter = printerName.replace(/'/g, "''")
  const safeBin     = tmpBin.replace(/\\/g, '\\\\')

  // PowerShell-Skript ruft WinSpool-API direkt auf (kein Treiber-Rendering)
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

  return new Promise((resolve, reject) => {
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
}

// ─── COM-Port / Serieller Drucker (TM-T88I) ──────────────────────────────────

// Hilfsfunktionen für den COM-Port Druck (32-Zeichen-Breite, Umlaut-Ersatz)
const COM_CMD = {
  INIT:         Buffer.from([ESC, 0x40]),
  ALIGN_CENTER: Buffer.from([ESC, 0x61, 0x01]),
  ALIGN_LEFT:   Buffer.from([ESC, 0x61, 0x00]),
  BOLD_ON:      Buffer.from([ESC, 0x45, 0x01]),
  BOLD_OFF:     Buffer.from([ESC, 0x45, 0x00]),
  FONT_BIG:     Buffer.from([GS,  0x21, 0x11]),
  FONT_NORMAL:  Buffer.from([GS,  0x21, 0x00]),
  CUT:          Buffer.from([GS,  0x56, 0x42, 0x00]),
  LINE:         Buffer.from('--------------------------------\n', 'ascii'),
  DASHED:       Buffer.from('- - - - - - - - - - - - - - - -\n', 'ascii'),
}

function textLine(text) {
  return Buffer.from(replaceUmlauts(text) + '\n', 'latin1')
}

function paddedLine(left, right, width = 32) {
  left  = replaceUmlauts(String(left))
  right = replaceUmlauts(String(right))
  const spaces = Math.max(1, width - left.length - right.length)
  return Buffer.from(left + ' '.repeat(spaces) + right + '\n', 'latin1')
}

/**
 * Druckt direkt über seriellen COM-Port (für TM-T88I).
 * Keine Windows-Treiber nötig, ESC/POS direkt übertragen.
 */
async function printToComPort(portPath, order) {
  const { SerialPort } = require('serialport')

  const port = new SerialPort({
    path: portPath,
    baudRate: 9600,
    dataBits: 8,
    stopBits: 1,
    parity: 'none',
    autoOpen: false,
  })

  // Port öffnen
  await new Promise((resolve, reject) => {
    port.open((err) => (err ? reject(err) : resolve()))
  })

  const now = new Date()
  const total = order.items.reduce(
    (sum, item) => sum + item.price * item.quantity,
    0
  )

  const storno = isStorno(order)
  const titleText = storno ? 'STORNO' : 'BESTELLUNG'

  const chunks = [
    COM_CMD.INIT,
    COM_CMD.ALIGN_CENTER,
    COM_CMD.BOLD_ON,
    COM_CMD.FONT_BIG,
    textLine(titleText),
    COM_CMD.FONT_NORMAL,
    COM_CMD.BOLD_OFF,
    Buffer.from('\n'),
    ...(storno ? [
      COM_CMD.ALIGN_CENTER,
      textLine('** BESTELLUNG WIRD STORNIERT **'),
      Buffer.from('\n'),
    ] : []),
    COM_CMD.ALIGN_LEFT,
    COM_CMD.LINE,
    paddedLine(`#${order.order_id}`, `${formatTime(now)} Uhr`),
    COM_CMD.LINE,
    Buffer.from('\n'),
  ]

  for (const item of order.items) {
    const qtyLabel = storno
      ? `-${item.quantity}x  ${item.name}`
      : `${item.quantity}x  ${item.name}`
    const priceLabel = storno
      ? `-${formatPrice(item.price * item.quantity)}`
      : formatPrice(item.price * item.quantity)
    chunks.push(paddedLine(qtyLabel, priceLabel))
  }

  const totalLabel = storno ? 'STORNO' : 'GESAMT'
  const totalValue = storno ? `-${formatPrice(total)}` : formatPrice(total)

  chunks.push(
    Buffer.from('\n'),
    COM_CMD.LINE,
    COM_CMD.BOLD_ON,
    paddedLine(totalLabel, totalValue),
    COM_CMD.BOLD_OFF,
    COM_CMD.LINE,
  )

  if (order.note) {
    chunks.push(
      Buffer.from('\n'),
      COM_CMD.BOLD_ON,
      textLine('Notiz:'),
      COM_CMD.BOLD_OFF,
      textLine(order.note),
    )
  }

  chunks.push(
    Buffer.from('\n\n\n'),
    COM_CMD.CUT,
  )

  const data = Buffer.concat(chunks)

  // Daten senden
  await new Promise((resolve, reject) => {
    port.write(data, (err) => (err ? reject(err) : resolve()))
  })

  // Auf Drain warten (alle Daten wurden gesendet)
  await new Promise((resolve, reject) => {
    port.drain((err) => (err ? reject(err) : resolve()))
  })

  // Port schließen
  await new Promise((resolve) => port.close(resolve))
}

// ─── Layout-Rendering ─────────────────────────────────────────────────────────

/**
 * Standard-Layout – spiegelt das bisherige ESC/POS-Format exakt wider.
 * Wird genutzt wenn kein bonLayout in der Config hinterlegt ist.
 */
const DEFAULT_LAYOUT = [
  {
    id: 'header',
    type: 'compound',
    bold: true,
    size: 'large',
    cols: [
      { field: 'table',    prefix: 'Tisch' },
      { field: 'bar_name', prefix: '' },
      { field: 'time',     prefix: '' },
    ],
  },
  { id: 'div1', type: 'divider', char: '=' },
  { id: 'items', type: 'items' },
  { id: 'div2', type: 'divider', char: '=' },
  { id: 'total', type: 'total', bold: true },
  { id: 'div3', type: 'divider', char: '-' },
  {
    id: 'footer',
    type: 'compound',
    bold: false,
    size: 'normal',
    cols: [
      { field: 'waiter',   prefix: '' },
      { field: 'order_id', prefix: '#' },
      { field: 'date',     prefix: '' },
    ],
  },
]

function resolveField(field, order, barName, now) {
  switch (field) {
    case 'table':    return order.table != null ? String(order.table) : '-'
    case 'waiter':   return order.waiter_name || '-'
    case 'order_id': return String(order.order_id)
    case 'date':     return now.toLocaleDateString('de-DE')
    case 'time':     return formatTime(now)
    case 'bar_name': return String(barName || 'HGV').toUpperCase()
    case 'note':     return order.note || ''
    default:         return ''
  }
}

/**
 * Baut einen ESC/POS-Buffer aus einem konfigurierbaren Layout-Array.
 */
function buildEscPosBufferFromLayout(order, barName, layout) {
  const now    = new Date()
  const storno = isStorno(order)
  const total  = order.items.reduce((sum, i) => sum + i.price * i.quantity, 0)
  const W      = 42

  const CMD = {
    INIT:        Buffer.from([ESC, 0x40]),
    CHARSET_858: Buffer.from([ESC, 0x74, 0x10]),
    ALIGN_LEFT:  Buffer.from([ESC, 0x61, 0x00]),
    ALIGN_CENTER:Buffer.from([ESC, 0x61, 0x01]),
    ALIGN_RIGHT: Buffer.from([ESC, 0x61, 0x02]),
    BOLD_ON:     Buffer.from([ESC, 0x45, 0x01]),
    BOLD_OFF:    Buffer.from([ESC, 0x45, 0x00]),
    DBL_H:       Buffer.from([GS,  0x21, 0x01]),
    NORMAL:      Buffer.from([GS,  0x21, 0x00]),
    CUT:         Buffer.from([GS,  0x56, 0x42, 0x05]),
    LF:          Buffer.from([0x0a]),
  }

  function ln(text = '') {
    return Buffer.from(String(text) + '\n', 'latin1')
  }

  function alignedLine(text, align, width = W) {
    text = String(text)
    if (align === 'center') {
      const spaces = Math.max(0, Math.floor((width - text.length) / 2))
      return Buffer.from(' '.repeat(spaces) + text + '\n', 'latin1')
    }
    if (align === 'right') {
      const spaces = Math.max(0, width - text.length)
      return Buffer.from(' '.repeat(spaces) + text + '\n', 'latin1')
    }
    return Buffer.from(text + '\n', 'latin1')
  }

  function padBuf(left, right, width = W) {
    left  = String(left); right = String(right)
    const spaces = Math.max(1, width - left.length - right.length)
    return Buffer.from(left + ' '.repeat(spaces) + right + '\n', 'latin1')
  }

  function threeColBuf(a, b, c, width = W) {
    a = String(a); b = String(b); c = String(c)
    const spare = Math.max(2, width - a.length - b.length - c.length)
    const g1 = Math.ceil(spare / 2)
    const g2 = spare - g1
    return Buffer.from(a + ' '.repeat(g1) + b + ' '.repeat(g2) + c + '\n', 'latin1')
  }

  function sepBuf(ch = '=') {
    return Buffer.from(ch.repeat(W) + '\n', 'latin1')
  }

  const chunks = [CMD.INIT, CMD.CHARSET_858, CMD.ALIGN_LEFT]

  const hasNoteField = layout.some(el => el.type === 'field' && el.field === 'note')

  for (const el of layout) {
    switch (el.type) {

      case 'compound': {
        const texts = (el.cols || []).map(c => {
          const val = resolveField(c.field, order, barName, now)
          return c.prefix ? `${c.prefix} ${val}` : val
        })
        if (el.bold) chunks.push(CMD.BOLD_ON)
        if (el.size === 'large') chunks.push(CMD.DBL_H)

        if (texts.length >= 3)      chunks.push(threeColBuf(texts[0], texts[1], texts[2]))
        else if (texts.length === 2) chunks.push(padBuf(texts[0], texts[1]))
        else if (texts.length === 1) chunks.push(alignedLine(texts[0], el.align || 'left'))

        if (el.size === 'large') chunks.push(CMD.NORMAL)
        if (el.bold) chunks.push(CMD.BOLD_OFF)
        break
      }

      case 'field': {
        const val = resolveField(el.field, order, barName, now)
        if (!val || val === '-') { if (['note', 'waiter'].includes(el.field)) break }
        const text = el.label ? `${el.label}: ${val}` : val
        if (el.bold) chunks.push(CMD.BOLD_ON)
        if (el.size === 'large') chunks.push(CMD.DBL_H)
        chunks.push(alignedLine(text, el.align || 'left'))
        if (el.size === 'large') chunks.push(CMD.NORMAL)
        if (el.bold) chunks.push(CMD.BOLD_OFF)
        break
      }

      case 'text': {
        if (!el.content) break
        if (el.bold) chunks.push(CMD.BOLD_ON)
        if (el.size === 'large') chunks.push(CMD.DBL_H)
        chunks.push(alignedLine(el.content, el.align || 'left'))
        if (el.size === 'large') chunks.push(CMD.NORMAL)
        if (el.bold) chunks.push(CMD.BOLD_OFF)
        break
      }

      case 'divider':
        chunks.push(sepBuf(el.char && el.char.trim() ? el.char[0] : '='))
        break

      case 'spacer':
        chunks.push(CMD.LF)
        break

      case 'items': {
        if (storno) {
          chunks.push(CMD.LF, CMD.BOLD_ON, ln('*** STORNO ***'), CMD.BOLD_OFF)
        }
        chunks.push(CMD.LF)
        for (const item of order.items) {
          const qty   = storno ? `-${item.quantity}x` : `${item.quantity}x`
          const price = storno
            ? `-${formatPrice(item.price * item.quantity)}`
            : formatPrice(item.price * item.quantity)
          const nameMax = W - qty.length - 3 - 1 - price.length
          const name    = String(item.name).substring(0, nameMax).padEnd(nameMax)
          chunks.push(
            CMD.DBL_H,
            Buffer.from(`${qty}   ${name} ${price}\n`, 'latin1'),
            CMD.NORMAL,
          )
          if (item.note) chunks.push(Buffer.from(`     -> ${item.note}\n`, 'latin1'))
          chunks.push(CMD.LF)
        }
        break
      }

      case 'total': {
        const totalLabel = storno ? 'STORNO' : 'GESAMT'
        const totalValue = storno ? `-${formatPrice(total)}` : formatPrice(total)
        if (el.bold) chunks.push(CMD.BOLD_ON)
        chunks.push(padBuf(totalLabel, totalValue))
        if (el.bold) chunks.push(CMD.BOLD_OFF)
        // Bestellnotiz nach Gesamt ausgeben, sofern kein eigenes Notiz-Feld im Layout
        if (order.note && !hasNoteField) {
          chunks.push(CMD.LF, ln(`Notiz: ${order.note}`))
        }
        break
      }

      default: break
    }
  }

  chunks.push(Buffer.from('\n\n\n'), CMD.CUT)
  return Buffer.concat(chunks)
}

/**
 * Baut HTML aus einem konfigurierbaren Layout-Array (für Windows-Druckmodus).
 */
function buildPrintHtmlFromLayout(order, barName, layout) {
  const now    = new Date()
  const storno = isStorno(order)
  const total  = order.items.reduce((sum, i) => sum + i.price * i.quantity, 0)

  function esc(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
  }

  function resolveHtml(field) {
    return esc(resolveField(field, order, barName, now))
  }

  function alignStyle(align) {
    if (align === 'center') return 'text-align:center'
    if (align === 'right')  return 'text-align:right'
    return 'text-align:left'
  }

  const hasNoteField = layout.some(el => el.type === 'field' && el.field === 'note')

  const sections = layout.map(el => {
    switch (el.type) {

      case 'compound': {
        const texts = (el.cols || []).map(c => {
          const val = resolveHtml(c.field)
          return c.prefix ? `${esc(c.prefix)} ${val}` : val
        })
        const fs   = el.size === 'large' ? '16px' : '13px'
        const fw   = el.bold ? 'bold' : 'normal'
        if (texts.length >= 3) {
          return `<div style="display:flex;justify-content:space-between;font-size:${fs};font-weight:${fw};padding:2px 0">
            <span>${texts[0]}</span><span>${texts[1]}</span><span>${texts[2]}</span>
          </div>`
        }
        if (texts.length === 2) {
          return `<div style="display:flex;justify-content:space-between;font-size:${fs};font-weight:${fw};padding:2px 0">
            <span>${texts[0]}</span><span>${texts[1]}</span>
          </div>`
        }
        const align = el.align || 'left'
        return `<div style="${alignStyle(align)};font-size:${fs};font-weight:${fw};padding:2px 0">${texts[0] || ''}</div>`
      }

      case 'field': {
        const val = resolveHtml(el.field)
        if (!val || val === '-') { if (['note', 'waiter'].includes(el.field)) return '' }
        const text = el.label ? `${esc(el.label)}: ${val}` : val
        const fs   = el.size === 'large' ? '15px' : '12px'
        const fw   = el.bold ? 'bold' : 'normal'
        return `<div style="${alignStyle(el.align)};font-size:${fs};font-weight:${fw};padding:2px 0">${text}</div>`
      }

      case 'text': {
        if (!el.content) return ''
        const fs = el.size === 'large' ? '15px' : '12px'
        const fw = el.bold ? 'bold' : 'normal'
        return `<div style="${alignStyle(el.align)};font-size:${fs};font-weight:${fw};padding:2px 0">${esc(el.content)}</div>`
      }

      case 'divider': {
        const ch = el.char && el.char.trim() ? el.char[0] : '='
        return `<div style="border-top:${ch === '=' ? '2px' : '1px'} ${ch === ' ' ? 'dashed' : 'solid'} #000;margin:4px 0"></div>`
      }

      case 'spacer':
        return `<div style="height:6px"></div>`

      case 'items': {
        const rows = order.items.map(item => `
          <tr class="${storno ? 'storno-row' : ''}">
            <td class="qty">${item.quantity}x</td>
            <td class="name">${esc(item.name)}</td>
            <td class="price">${storno ? '–' : ''}${esc(formatPrice(item.price * item.quantity))}</td>
          </tr>
          ${item.note ? `<tr class="note-row"><td></td><td colspan="2" class="note">↳ ${esc(item.note)}</td></tr>` : ''}
        `).join('')

        const stornoHtml = storno
          ? `<div style="text-align:center;font-weight:bold;font-size:15px;letter-spacing:2px;padding:3mm 0;border-bottom:1px dashed #000">*** STORNO ***</div>`
          : ''

        return `${stornoHtml}<div class="items"><table>${rows}</table></div>`
      }

      case 'total': {
        const label = storno ? 'STORNO' : 'GESAMT'
        const value = `${storno ? '–' : ''}${esc(formatPrice(total))}`
        const fw    = el.bold ? 'bold' : 'normal'
        const noteHtml = (order.note && !hasNoteField)
          ? `<div style="font-size:12px;padding:2mm 0"><strong>Notiz:</strong> ${esc(order.note)}</div>`
          : ''
        return `
          <div style="display:flex;justify-content:space-between;font-weight:${fw};font-size:16px;padding:3mm 0">
            <span>${label}</span><span>${value}</span>
          </div>
          ${noteHtml}`
      }

      default: return ''
    }
  }).join('\n')

  return `<!DOCTYPE html>
<html lang="de">
<head>
<meta charset="UTF-8">
<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  body { font-family:'Courier New',Courier,monospace; font-size:13px; line-height:1.45; width:72mm; color:#000; background:#fff; padding:4mm 3mm; }
  table { width:100%; border-collapse:collapse; }
  td { padding:2px 0; vertical-align:top; }
  td.qty { width:30px; white-space:nowrap; font-weight:bold; }
  td.name { padding-left:3px; word-break:break-word; }
  td.price { text-align:right; white-space:nowrap; }
  .storno-row td { text-decoration:line-through; color:#555; }
  .note-row .note { font-size:11px; font-style:italic; color:#444; padding:0 0 3px 4px; }
  .items { padding:2mm 0; }
  @media print { html,body { width:auto; } }
</style>
</head>
<body>${sections}</body>
</html>`
}

module.exports = {
  buildPrintHtml,
  buildPrintHtmlFromLayout,
  buildEscPosBuffer,
  buildEscPosBufferFromLayout,
  printToWindowsPrinter,
  printToWindowsPrinterEscPos,
  printToComPort,
  replaceUmlauts,
  formatPrice,
  DEFAULT_LAYOUT,
}
