const {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  Header, AlignmentType, HeadingLevel, BorderStyle, WidthType,
  ShadingType, VerticalAlign, LevelFormat, PageNumber, Footer,
  ExternalHyperlink,
} = require('docx')
const fs = require('fs')

// ── Farben ──────────────────────────────────────────────────────────────────
const BLUE   = '2563EB'
const GRAY   = 'F1F5F9'
const DKGRAY = '64748B'
const BLACK  = '0F172A'
const GREEN  = '16A34A'
const RED    = 'DC2626'
const WHITE  = 'FFFFFF'
const BORDER_COLOR = 'E2E8F0'
const CODE_BG = 'F8FAFC'

// ── Hilfsfunktionen ─────────────────────────────────────────────────────────

function h1(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_1,
    spacing: { before: 360, after: 120 },
    children: [new TextRun({ text, bold: true, size: 34, color: BLACK, font: 'Segoe UI' })],
    border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: BLUE, space: 4 } },
  })
}

function h2(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_2,
    spacing: { before: 280, after: 80 },
    children: [new TextRun({ text, bold: true, size: 28, color: BLACK, font: 'Segoe UI' })],
  })
}

function h3(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_3,
    spacing: { before: 200, after: 60 },
    children: [new TextRun({ text, bold: true, size: 24, color: DKGRAY, font: 'Segoe UI' })],
  })
}

function p(text, opts = {}) {
  return new Paragraph({
    spacing: { before: 0, after: 120 },
    children: [new TextRun({ text, size: 22, color: BLACK, font: 'Segoe UI', ...opts })],
  })
}

function pRuns(runs) {
  return new Paragraph({
    spacing: { before: 0, after: 120 },
    children: runs.map(([text, opts = {}]) =>
      new TextRun({ text, size: 22, color: BLACK, font: 'Segoe UI', ...opts })
    ),
  })
}

function code(text) {
  const b = { style: BorderStyle.SINGLE, size: 1, color: BORDER_COLOR }
  return new Paragraph({
    spacing: { before: 40, after: 40 },
    shading: { fill: CODE_BG, type: ShadingType.CLEAR },
    border: { top: b, bottom: b, left: b, right: b },
    children: [new TextRun({ text, size: 18, font: 'Consolas', color: '1E3A5F' })],
    indent: { left: 200, right: 200 },
  })
}

function codeBlock(lines) {
  const b = { style: BorderStyle.SINGLE, size: 4, color: BORDER_COLOR }
  return lines.map((line, i) => {
    const isFirst = i === 0
    const isLast = i === lines.length - 1
    return new Paragraph({
      spacing: { before: isFirst ? 80 : 0, after: isLast ? 80 : 0 },
      shading: { fill: CODE_BG, type: ShadingType.CLEAR },
      border: {
        top: isFirst ? b : undefined,
        bottom: isLast ? b : undefined,
        left: b,
        right: b,
      },
      children: [new TextRun({ text: line || ' ', size: 18, font: 'Consolas', color: '1E3A5F' })],
      indent: { left: 200, right: 200 },
    })
  })
}

function note(emoji, text, color = BLUE, bg = 'EFF6FF') {
  const b = { style: BorderStyle.SINGLE, size: 1, color }
  return new Paragraph({
    spacing: { before: 100, after: 120 },
    shading: { fill: bg, type: ShadingType.CLEAR },
    border: { top: b, bottom: b, left: { style: BorderStyle.SINGLE, size: 12, color }, right: b },
    children: [
      new TextRun({ text: emoji + '  ', size: 22, font: 'Segoe UI' }),
      new TextRun({ text, size: 22, font: 'Segoe UI', color: BLACK }),
    ],
    indent: { left: 160, right: 160 },
  })
}

function bullet(text, level = 0) {
  return new Paragraph({
    numbering: { reference: 'bullets', level },
    spacing: { before: 0, after: 60 },
    children: [new TextRun({ text, size: 22, font: 'Segoe UI', color: BLACK })],
  })
}

function bulletRuns(runs, level = 0) {
  return new Paragraph({
    numbering: { reference: 'bullets', level },
    spacing: { before: 0, after: 60 },
    children: runs.map(([text, opts = {}]) =>
      new TextRun({ text, size: 22, font: 'Segoe UI', color: BLACK, ...opts })
    ),
  })
}

function gap(pts = 80) {
  return new Paragraph({ spacing: { before: 0, after: pts }, children: [] })
}

// ── Tabellen ─────────────────────────────────────────────────────────────────

function makeTable(headers, rows, widths) {
  const totalW = widths.reduce((a, b) => a + b, 0)
  const headerB = { style: BorderStyle.SINGLE, size: 1, color: BORDER_COLOR }
  const cellB   = { style: BorderStyle.SINGLE, size: 1, color: BORDER_COLOR }
  const cellM   = { top: 80, bottom: 80, left: 120, right: 120 }

  const headerRow = new TableRow({
    tableHeader: true,
    children: headers.map((h, i) =>
      new TableCell({
        width: { size: widths[i], type: WidthType.DXA },
        shading: { fill: BLACK, type: ShadingType.CLEAR },
        borders: { top: headerB, bottom: headerB, left: headerB, right: headerB },
        margins: cellM,
        children: [new Paragraph({
          children: [new TextRun({ text: h, bold: true, size: 20, color: WHITE, font: 'Segoe UI' })],
        })],
      })
    ),
  })

  const dataRows = rows.map((row, ri) =>
    new TableRow({
      children: row.map((cell, ci) => {
        const isArr = Array.isArray(cell)
        return new TableCell({
          width: { size: widths[ci], type: WidthType.DXA },
          shading: { fill: ri % 2 === 0 ? WHITE : GRAY, type: ShadingType.CLEAR },
          borders: { top: cellB, bottom: cellB, left: cellB, right: cellB },
          margins: cellM,
          children: [new Paragraph({
            children: isArr
              ? cell.map(([t, o = {}]) => new TextRun({ text: t, size: 20, font: 'Segoe UI', color: BLACK, ...o }))
              : [new TextRun({ text: cell, size: 20, font: 'Segoe UI', color: BLACK })],
          })],
        })
      }),
    })
  )

  return new Table({
    width: { size: totalW, type: WidthType.DXA },
    columnWidths: widths,
    rows: [headerRow, ...dataRows],
  })
}

// ── Titelseite ───────────────────────────────────────────────────────────────

function titlePage() {
  return [
    gap(1600),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 0, after: 200 },
      children: [new TextRun({ text: '🖨️', size: 96, font: 'Segoe UI Emoji' })],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 0, after: 120 },
      children: [new TextRun({ text: 'Druckerclient', bold: true, size: 64, color: BLACK, font: 'Segoe UI' })],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 0, after: 80 },
      children: [new TextRun({ text: 'Backend-Integration', size: 36, color: BLUE, font: 'Segoe UI' })],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 0, after: 60 },
      children: [new TextRun({ text: 'Abiball Bestellsystem', size: 26, color: DKGRAY, font: 'Segoe UI' })],
    }),
    gap(80),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 0, after: 0 },
      border: { top: { style: BorderStyle.SINGLE, size: 4, color: BORDER_COLOR, space: 1 } },
      children: [],
    }),
    gap(80),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 0, after: 60 },
      children: [new TextRun({ text: 'Version 1.0  ·  Mai 2025', size: 22, color: DKGRAY, font: 'Segoe UI' })],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 0, after: 60 },
      children: [new TextRun({ text: 'Intern – nur für Entwickler', size: 22, color: DKGRAY, font: 'Segoe UI' })],
    }),
    new Paragraph({ pageBreakBefore: true, children: [] }),
  ]
}

// ────────────────────────────────────────────────────────────────────────────
// DOKUMENT-INHALT
// ────────────────────────────────────────────────────────────────────────────

const children = [
  // ── Titelseite ─────────────────────────────────────────────────
  ...titlePage(),

  // ── 1. Überblick ───────────────────────────────────────────────
  h1('1. Überblick'),
  p('Der Druckerclient ist eine Electron-App, die auf jedem Bar-Laptop läuft. Er verbindet sich per WebSocket zum Go-Backend und druckt eingehende Bestellungen automatisch auf den USB-Bondrucker. Dieses Dokument beschreibt alles, was das Backend implementieren muss, damit der Client funktioniert.'),
  gap(),

  h2('1.1 Architektur'),
  ...codeBlock([
    '  Gast (Browser)',
    '       │  POST /orders',
    '       ▼',
    '  Go Backend (vServer)',
    '       │  WebSocket Push (wss://...)',
    '       ▼',
    '  Electron Druckerclient (Windows-Laptop, pro Bar)',
    '       │  ESC/POS',
    '       ▼',
    '  Epson Bondrucker (USB)',
  ]),
  gap(),
  note('ℹ️', 'Der Client verbindet sich aktiv zum Backend — nicht umgekehrt. Dadurch müssen keine eingehenden Ports auf den Laptops freigegeben werden.'),
  gap(),

  h2('1.2 Komponenten'),
  makeTable(
    ['Datei', 'Beschreibung'],
    [
      ['electron/main.js', 'Electron Hauptprozess: Fenster, Tray, IPC, Autostart'],
      ['electron/printer.js', 'Drucklogik: Windows-Drucker (TM-T88IV) + COM-Port (TM-T88I)'],
      ['electron/preload.js', 'Sichere IPC-Bridge zum Renderer'],
      ['src/App.jsx', 'React-Root: Setup- vs. Dashboard-Screen'],
      ['src/components/SetupScreen.jsx', 'Einrichtungsformular (einmalig pro Laptop)'],
      ['src/components/Dashboard.jsx', 'Live-Dashboard mit Druckprotokoll'],
      ['src/hooks/useWebSocket.js', 'WebSocket-Hook mit Exponential-Backoff-Reconnect'],
    ],
    [3200, 5860]
  ),
  gap(200),

  // ── 2. WebSocket-Endpunkt ──────────────────────────────────────
  h1('2. WebSocket-Endpunkt'),
  h2('2.1 URL & Parameter'),
  p('Der Client verbindet sich zu folgendem Endpunkt:'),
  ...codeBlock([
    'GET /ws/printer?bar=Bar+1&secret=DEIN_SECRET',
    '',
    'Protokoll:  wss:// (Produktion via Caddy/TLS)',
    '            ws://  (lokale Entwicklung)',
  ]),
  gap(),
  makeTable(
    ['Parameter', 'Typ', 'Beschreibung'],
    [
      ['bar', 'string', 'Bar-Name (URL-encoded), z.B. "Bar 1", "Bar 2"'],
      ['secret', 'string', 'Gemeinsames Secret, konfiguriert per Umgebungsvariable PRINTER_SECRET'],
    ],
    [1800, 1800, 5460]
  ),
  gap(160),

  h2('2.2 Authentifizierung'),
  p('Das Backend prüft den secret-Parameter vor dem Upgrade auf WebSocket:'),
  ...codeBlock([
    'if r.URL.Query().Get("secret") != os.Getenv("PRINTER_SECRET") {',
    '    http.Error(w, "Unauthorized", http.StatusUnauthorized)',
    '    return',
    '}',
  ]),
  note('⚠️', 'Bei falschem Secret: HTTP 401 vor dem Upgrade zurückgeben. Der Client erkennt Code 401 und zeigt "Authentifizierungsfehler" an — kein Reconnect-Loop.', RED, 'FEF2F2'),
  gap(),

  h2('2.3 Verbindungsverhalten'),
  bullet('Pro Bar-Name ist genau eine aktive WebSocket-Verbindung erlaubt.'),
  bullet('Verbindet sich eine neue Instanz für dieselbe Bar, wird die alte Verbindung serverseitig geschlossen (Reconnect-Szenario).'),
  bullet('Beim Reconnect schickt das Backend alle unbestätigten Jobs der Queue sofort nach.'),
  bullet('Das Backend sendet alle 30 Sekunden einen WebSocket-Ping — der Client antwortet automatisch mit Pong. Bleibt die Antwort 60 Sekunden aus, gilt die Verbindung als tot.'),
  gap(200),

  // ── 3. Nachrichten-Protokoll ───────────────────────────────────
  h1('3. Nachrichten-Protokoll'),
  h2('3.1 Backend → Client: Druckauftrag'),
  p('Format: JSON, WebSocket TextMessage'),
  ...codeBlock([
    '{',
    '  "type": "print_job",',
    '  "payload": {',
    '    "order_id": 42,',
    '    "items": [',
    '      { "name": "Club Mate",  "quantity": 2, "price": 2.50 },',
    '      { "name": "Bier 0,5l", "quantity": 1, "price": 3.00 }',
    '    ],',
    '    "note": "Kein Eis"',
    '  }',
    '}',
  ]),
  gap(120),
  makeTable(
    ['Feld', 'Typ', 'Pflicht', 'Beschreibung'],
    [
      ['type', 'string', '✓', 'Immer "print_job"'],
      ['payload.order_id', 'integer', '✓', 'Eindeutige ID der Bestellung (für ACK)'],
      ['payload.items', 'array', '✓', 'Liste der bestellten Artikel'],
      ['payload.items[].name', 'string', '✓', 'Artikelname'],
      ['payload.items[].quantity', 'integer', '✓', 'Menge'],
      ['payload.items[].price', 'float', '✓', 'Einzelpreis in Euro'],
      ['payload.note', 'string', '–', 'Optionale Notiz / Sonderwunsch'],
    ],
    [2200, 1600, 1200, 4060]
  ),
  gap(200),

  h2('3.2 Client → Backend: Bestätigung (ACK)'),
  p('Nach erfolgreichem Druck sendet der Client eine Bestätigung:'),
  ...codeBlock([
    '{ "type": "ack", "order_id": 42 }',
  ]),
  gap(),
  note('ℹ️', 'Das Backend entfernt den Job aus der Queue sobald der ACK eintrifft. Jobs ohne ACK werden beim nächsten Verbindungsaufbau erneut gesendet.'),
  gap(200),

  // ── 4. Print-Queue ─────────────────────────────────────────────
  h1('4. Print-Queue pro Bar'),
  h2('4.1 Anforderungen'),
  bullet('Jede Bar hat eine eigene Queue (in-memory oder persistiert).'),
  bullet('Jobs bleiben in der Queue bis ein ACK vom Client eintrifft.'),
  bullet('Bei Reconnect werden alle ausstehenden Jobs sofort in der Reihenfolge ihres Eingangs gesendet.'),
  bullet('Für den Abiball (Single-Night-Event) reicht eine In-Memory-Queue — kein Neustart des Servers geplant.'),
  bullet('Optional: JSON-Persistenz auf Disk, falls doch ein Neustart nötig ist.'),
  gap(),

  h2('4.2 Go-Implementierung (geliefert)'),
  p('Die Dateien backend/ws/hub.go und backend/ws/queue.go sind bereits fertig implementiert und können direkt übernommen werden.'),
  gap(),
  makeTable(
    ['Datei', 'Inhalt'],
    [
      ['backend/ws/hub.go', 'Hub (Connection-Manager), WebSocket-Handler, Ping/Pong, ACK-Verarbeitung'],
      ['backend/ws/queue.go', 'Print-Queue pro Bar, threadsafe, Pending()/Add()/Ack()'],
      ['backend/ws/integration.go', 'Kommentierte Beispiele für die Integration in main.go und Order-Handler'],
    ],
    [2800, 6260]
  ),
  gap(200),

  // ── 5. Integration ─────────────────────────────────────────────
  h1('5. Integration ins Go-Backend'),
  h2('5.1 Abhängigkeit hinzufügen'),
  ...codeBlock([
    'go get github.com/gorilla/websocket',
  ]),
  gap(),

  h2('5.2 Hub initialisieren (main.go)'),
  ...codeBlock([
    'import "yourmodule/ws"',
    '',
    'var PrintHub = ws.NewHub(os.Getenv("PRINTER_SECRET"))',
    '',
    'func main() {',
    '    mux := http.NewServeMux()',
    '    mux.Handle("/ws/printer", PrintHub)   // WebSocket-Endpunkt',
    '    mux.HandleFunc("/orders", handleNewOrder)',
    '    // ...',
    '}',
  ]),
  gap(),

  h2('5.3 Order-Handler anpassen'),
  p('Nach dem Speichern der Bestellung in der Datenbank wird EnqueueAndSend aufgerufen:'),
  ...codeBlock([
    'func handleNewOrder(w http.ResponseWriter, r *http.Request) {',
    '    var req struct {',
    '        BarName string         `json:"bar_name"`',
    '        Items   []ws.OrderItem `json:"items"`',
    '        Note    string         `json:"note"`',
    '    }',
    '    json.NewDecoder(r.Body).Decode(&req)',
    '',
    '    // ... In DB speichern, orderID ermitteln ...',
    '',
    '    // Druckjob in Queue stellen + sofort senden falls verbunden',
    '    PrintHub.EnqueueAndSend(req.BarName, &ws.PrintJob{',
    '        OrderID: orderID,',
    '        Items:   req.Items,',
    '        Note:    req.Note,',
    '    })',
    '',
    '    w.WriteHeader(http.StatusCreated)',
    '}',
  ]),
  gap(),
  note('ℹ️', 'EnqueueAndSend ist threadsafe und nicht-blockierend. Falls der Client gerade offline ist, landet der Job in der Queue und wird beim nächsten Verbindungsaufbau automatisch zugestellt.'),
  gap(200),

  // ── 6. Umgebungsvariablen ──────────────────────────────────────
  h1('6. Konfiguration & Deployment'),
  h2('6.1 Umgebungsvariable'),
  makeTable(
    ['Variable', 'Beispielwert', 'Beschreibung'],
    [
      ['PRINTER_SECRET', 'abiball2025geheim!', 'Gemeinsames Secret für alle Bar-Laptops'],
    ],
    [2600, 2800, 3660]
  ),
  gap(120),
  note('⚠️', 'Das Secret muss exakt mit dem Wert übereinstimmen, den der Bar-Mitarbeiter im Einrichtungsformular des Clients eingibt.', RED, 'FEF2F2'),
  gap(),

  h2('6.2 Caddy-Konfiguration (TLS / WSS)'),
  p('Caddy terminiert TLS automatisch. Die WebSocket-Verbindung wird transparent weitergeleitet:'),
  ...codeBlock([
    'abiball.example.com {',
    '    reverse_proxy /ws/*  localhost:8080',
    '    reverse_proxy *      localhost:3000',
    '}',
  ]),
  gap(),
  p('Der Client konfiguriert dann:'),
  ...codeBlock([
    'Server-URL: wss://abiball.example.com',
  ]),
  gap(200),

  // ── 7. Client-Einrichtung ──────────────────────────────────────
  h1('7. Client-Einrichtung (Bar-Laptop)'),
  h2('7.1 Was der Bar-Mitarbeiter eingibt'),
  makeTable(
    ['Feld', 'Beispielwert', 'Beschreibung'],
    [
      ['Server-URL', 'wss://abiball.example.com', 'Domain des vServers, ohne Pfad'],
      ['Secret-Key', '••••••••••', 'Von Backend-Admin mitgeteilt, einmalig'],
      ['Bar-Name', 'Bar 1', 'Bestimmt welche Queue der Client abonniert'],
      ['Drucker', 'EPSON TM-T88IV', 'Aus Windows-Druckerliste gewählt'],
    ],
    [2000, 2800, 4260]
  ),
  gap(120),
  p('Nach der Einrichtung läuft der Client dauerhaft im Windows-Tray und reconnectet sich automatisch bei Verbindungsabbrüchen.'),
  gap(),

  h2('7.2 Druckauftrag-Flow'),
  ...codeBlock([
    '1. Gast bestellt über das Frontend',
    '2. Go-Backend speichert die Bestellung in der DB',
    '3. Backend ruft PrintHub.EnqueueAndSend("Bar 1", job) auf',
    '4. Hub schickt job per WebSocket an den verbundenen Client',
    '5. Client druckt den Bon (ESC/POS)',
    '6. Client sendet { "type": "ack", "order_id": 42 }',
    '7. Hub entfernt den Job aus der Queue',
  ]),
  gap(160),

  h2('7.3 Offline-Szenario (Reconnect)'),
  ...codeBlock([
    '1. Laptop geht kurz offline (WLAN-Aussetzer)',
    '2. Backend puffert eingehende Jobs in der Queue',
    '3. Laptop kommt zurück, baut WebSocket-Verbindung neu auf',
    '4. Backend sendet alle ausstehenden Jobs sofort nach',
    '5. Client druckt sie der Reihe nach und sendet ACKs',
  ]),
  gap(200),

  // ── 8. Fehlerbehandlung ────────────────────────────────────────
  h1('8. Fehlerbehandlung'),
  makeTable(
    ['Situation', 'Client-Verhalten', 'Backend-Verhalten'],
    [
      ['Falsches Secret', 'Zeigt "Authentifizierungsfehler", kein Reconnect', 'HTTP 401 vor WebSocket-Upgrade'],
      ['Verbindungsabbruch', 'Reconnect mit Exponential Backoff (1s → 30s)', 'Jobs bleiben in Queue'],
      ['Druckfehler', 'Zeigt Fehler im Log, kein ACK gesendet', 'Job bleibt in Queue, wird beim Reconnect erneut gesendet'],
      ['Zweite Verbindung selbe Bar', '–', 'Alte Verbindung wird geschlossen (CloseNormalClosure)'],
      ['Ungültige JSON-Nachricht', 'Wird ignoriert, Verbindung bleibt offen', '–'],
    ],
    [2200, 3000, 3860]
  ),
  gap(200),

  // ── 9. Bon-Layout ──────────────────────────────────────────────
  h1('9. Bon-Layout (Referenz)'),
  p('Der Bon wird vom Client automatisch aus den Auftragsdaten generiert. Das Backend muss nichts am Layout ändern. Zur Information:'),
  gap(),
  ...codeBlock([
    '================================',
    '         BESTELLUNG             ',
    '           Bar 1               ',
    '================================',
    '14.06.2025              22:14 Uhr',
    '              #42              ',
    '--------------------------------',
    '  2x  Club Mate        5,00 EUR',
    '  1x  Bier 0,5l        3,00 EUR',
    '--------------------------------',
    '  GESAMT               8,00 EUR',
    '================================',
    'Notiz: Kein Eis',
    '',
    '================================',
  ]),
  gap(),
  p('Für den TM-T88I (COM-Port) werden Umlaute automatisch ersetzt: ä→ae, ö→oe, ü→ue, ß→ss, €→EUR.'),
  gap(200),

  // ── 10. Checkliste ─────────────────────────────────────────────
  h1('10. Backend-Checkliste'),
  note('✅', 'Diese Punkte müssen implementiert sein, damit der Client funktioniert.', GREEN, 'F0FDF4'),
  gap(80),
  bullet('go get github.com/gorilla/websocket'),
  bullet('backend/ws/hub.go und queue.go ins Projekt kopieren'),
  bullet('var PrintHub = ws.NewHub(os.Getenv("PRINTER_SECRET")) in main.go'),
  bullet('mux.Handle("/ws/printer", PrintHub) registrieren'),
  bullet('Caddy /ws/* → Backend weiterleiten'),
  bullet('PRINTER_SECRET als Umgebungsvariable setzen (Docker Compose oder .env)'),
  bullet('PrintHub.EnqueueAndSend(barName, &ws.PrintJob{...}) im Order-Handler aufrufen'),
  bullet('bar_name im Order-Request-Body vom Frontend mitschicken lassen'),
  gap(200),

  // ── Anhang ─────────────────────────────────────────────────────
  h1('Anhang: Schnellreferenz Nachrichtenformat'),
  h3('Backend → Client'),
  ...codeBlock([
    'type OutMessage struct {',
    '    Type    string    `json:"type"`    // immer "print_job"',
    '    Payload *PrintJob `json:"payload"`',
    '}',
    '',
    'type PrintJob struct {',
    '    OrderID int         `json:"order_id"`',
    '    Items   []OrderItem `json:"items"`',
    '    Note    string      `json:"note,omitempty"`',
    '}',
    '',
    'type OrderItem struct {',
    '    Name     string  `json:"name"`',
    '    Quantity int     `json:"quantity"`',
    '    Price    float64 `json:"price"`',
    '}',
  ]),
  gap(),
  h3('Client → Backend'),
  ...codeBlock([
    'type AckMessage struct {',
    '    Type    string `json:"type"`      // immer "ack"',
    '    OrderID int    `json:"order_id"`',
    '}',
  ]),
]

// ── Dokument zusammenbauen ───────────────────────────────────────────────────

const doc = new Document({
  numbering: {
    config: [
      {
        reference: 'bullets',
        levels: [{
          level: 0,
          format: LevelFormat.BULLET,
          text: '–',
          alignment: AlignmentType.LEFT,
          style: { paragraph: { indent: { left: 480, hanging: 240 } } },
        }],
      },
    ],
  },
  styles: {
    default: {
      document: { run: { font: 'Segoe UI', size: 22, color: BLACK } },
    },
    paragraphStyles: [
      {
        id: 'Heading1', name: 'Heading 1', basedOn: 'Normal', next: 'Normal', quickFormat: true,
        run: { size: 34, bold: true, font: 'Segoe UI', color: BLACK },
        paragraph: { spacing: { before: 360, after: 120 }, outlineLevel: 0 },
      },
      {
        id: 'Heading2', name: 'Heading 2', basedOn: 'Normal', next: 'Normal', quickFormat: true,
        run: { size: 28, bold: true, font: 'Segoe UI', color: BLACK },
        paragraph: { spacing: { before: 280, after: 80 }, outlineLevel: 1 },
      },
      {
        id: 'Heading3', name: 'Heading 3', basedOn: 'Normal', next: 'Normal', quickFormat: true,
        run: { size: 24, bold: true, font: 'Segoe UI', color: DKGRAY },
        paragraph: { spacing: { before: 200, after: 60 }, outlineLevel: 2 },
      },
    ],
  },
  sections: [{
    properties: {
      page: {
        size: { width: 11906, height: 16838 },
        margin: { top: 1134, right: 1134, bottom: 1134, left: 1134 },
      },
    },
    headers: {
      default: new Header({
        children: [
          new Paragraph({
            border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: BORDER_COLOR, space: 4 } },
            children: [
              new TextRun({ text: 'Druckerclient · Backend-Integration', size: 18, color: DKGRAY, font: 'Segoe UI' }),
              new TextRun({ text: '\t', size: 18 }),
              new TextRun({ text: 'Abiball Bestellsystem', size: 18, color: DKGRAY, font: 'Segoe UI' }),
            ],
            tabStops: [{ type: 'right', position: 8500 }],
          }),
        ],
      }),
    },
    footers: {
      default: new Footer({
        children: [
          new Paragraph({
            border: { top: { style: BorderStyle.SINGLE, size: 4, color: BORDER_COLOR, space: 4 } },
            alignment: AlignmentType.CENTER,
            children: [
              new TextRun({ text: 'Seite ', size: 18, color: DKGRAY, font: 'Segoe UI' }),
              new TextRun({ children: [PageNumber.CURRENT], size: 18, color: DKGRAY, font: 'Segoe UI' }),
              new TextRun({ text: ' von ', size: 18, color: DKGRAY, font: 'Segoe UI' }),
              new TextRun({ children: [PageNumber.TOTAL_PAGES], size: 18, color: DKGRAY, font: 'Segoe UI' }),
            ],
          }),
        ],
      }),
    },
    children,
  }],
})

Packer.toBuffer(doc).then((buffer) => {
  fs.writeFileSync('Druckerclient-Backend-Integration.docx', buffer)
  console.log('✓ Druckerclient-Backend-Integration.docx erstellt')
})
