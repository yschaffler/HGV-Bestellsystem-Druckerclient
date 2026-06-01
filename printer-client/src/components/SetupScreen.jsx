import { useState, useEffect } from 'react'
import {
  Server, KeyRound, Store, Printer, Zap, Plug, ChevronDown,
  CheckCircle2, XCircle, Loader2, PrinterCheck, Settings, Save, X,
} from 'lucide-react'

const BAR_NAMES = ['Bar 1', 'Bar 2', 'Bar 3']

export default function SetupScreen({ initialConfig, onSave, onCancel, panelMode = false }) {
  const [config, setConfig] = useState({
    serverUrl: '',
    secret: '',
    barName: '',
    printerName: '',
    printerType: 'escpos',
    comPort: 'COM3',
    autoPrint: true,
    autoStart: false,
    ...initialConfig,
  })

  const [printers, setPrinters]               = useState([])
  const [comPorts, setComPorts]               = useState([])
  const [loadingPrinters, setLoadingPrinters] = useState(false)
  const [testStatus, setTestStatus]           = useState(null) // null | 'printing' | 'ok' | 'error'
  const [testError, setTestError]             = useState('')
  const [saving, setSaving]                   = useState(false)
  const [errors, setErrors]                   = useState({})

  useEffect(() => { loadPrinters(); loadComPorts() }, [])

  async function loadPrinters() {
    setLoadingPrinters(true)
    const result = await window.electron.getPrinters()
    if (result.success) {
      setPrinters(result.printers)
      if (!config.printerName && result.printers.length > 0)
        setConfig((c) => ({ ...c, printerName: result.printers[0].name }))
    }
    setLoadingPrinters(false)
  }

  async function loadComPorts() {
    const result = await window.electron.getComPorts()
    if (result.success) setComPorts(result.ports)
  }

  function set(key, value) {
    setConfig((c) => ({ ...c, [key]: value }))
    setErrors((e) => ({ ...e, [key]: undefined }))
  }

  function validate() {
    const errs = {}
    if (!config.serverUrl.trim()) errs.serverUrl = 'Server-URL ist erforderlich'
    else if (!config.serverUrl.startsWith('ws')) errs.serverUrl = 'Muss mit wss:// oder ws:// beginnen'
    if (!config.secret.trim()) errs.secret = 'Secret-Key ist erforderlich'
    if (!config.barName.trim()) errs.barName = 'Bar-Name ist erforderlich'
    if ((config.printerType === 'windows' || config.printerType === 'escpos') && !config.printerName)
      errs.printerName = 'Bitte einen Drucker auswählen'
    if (config.printerType === 'com' && !config.comPort)
      errs.comPort = 'COM-Port ist erforderlich'
    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  async function handleTestPrint() {
    setTestStatus('printing')
    setTestError('')
    const result = await window.electron.testPrint(config)
    if (result?.success) {
      setTestStatus('ok')
      setTimeout(() => setTestStatus(null), 4000)
    } else {
      setTestStatus('error')
      setTestError(result?.error || 'Unbekannter Fehler')
    }
  }

  async function handleSave() {
    if (!validate()) return
    setSaving(true)
    await onSave(config)
    setSaving(false)
  }

  const customBarName = !BAR_NAMES.includes(config.barName) ? config.barName : ''
  const usesWindowsPrinter = config.printerType === 'windows' || config.printerType === 'escpos'

  const content = (
    <div style={{ maxWidth: 620 }}>

      {/* ── Server-Verbindung ──────────────────────────────────────────────── */}
      <div className="card" style={{ marginBottom: 12 }}>
        <div className="card-header">
          <div className="card-icon"><Server size={16} /></div>
          <div>
            <div className="card-title-text">Server-Verbindung</div>
            <div className="card-description">WebSocket-Verbindung zum HGV Bestellsystem</div>
          </div>
        </div>

        <div className="form-group">
          <label className="form-label">WebSocket-URL</label>
          <input
            className="form-input"
            placeholder="wss://hgv.example.com"
            value={config.serverUrl}
            onChange={(e) => set('serverUrl', e.target.value)}
            spellCheck={false}
          />
          {errors.serverUrl && <div className="field-error">{errors.serverUrl}</div>}
          <div className="form-hint">Nur die Domain ohne Pfad, z.B. wss://meinserver.de</div>
        </div>

        <div className="form-group" style={{ marginBottom: 0 }}>
          <label className="form-label">Secret-Key</label>
          <div style={{ position: 'relative' }}>
            <KeyRound size={14} style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', color: 'var(--muted-foreground)' }} />
            <input
              className="form-input"
              type="password"
              placeholder="••••••••••••••"
              value={config.secret}
              onChange={(e) => set('secret', e.target.value)}
              spellCheck={false}
              style={{ paddingLeft: 32 }}
            />
          </div>
          {errors.secret && <div className="field-error">{errors.secret}</div>}
        </div>
      </div>

      {/* ── Bar ───────────────────────────────────────────────────────────── */}
      <div className="card" style={{ marginBottom: 12 }}>
        <div className="card-header">
          <div className="card-icon"><Store size={16} /></div>
          <div>
            <div className="card-title-text">Bar</div>
            <div className="card-description">Welche Bar druckt dieser Client?</div>
          </div>
        </div>

        <div className="form-group" style={{ marginBottom: 10 }}>
          <div className="type-tabs">
            {BAR_NAMES.map((name) => (
              <button
                key={name}
                className={`type-tab ${config.barName === name ? 'active' : ''}`}
                onClick={() => set('barName', name)}
              >
                {name}
              </button>
            ))}
          </div>
        </div>

        <div className="form-group" style={{ marginBottom: 0 }}>
          <label className="form-label">Eigener Name</label>
          <input
            className="form-input"
            placeholder="z.B. Cocktailbar, Außenbar…"
            value={customBarName}
            onChange={(e) => set('barName', e.target.value)}
          />
          {errors.barName && <div className="field-error">{errors.barName}</div>}
        </div>
      </div>

      {/* ── Drucker ───────────────────────────────────────────────────────── */}
      <div className="card" style={{ marginBottom: 12 }}>
        <div className="card-header">
          <div className="card-icon"><Printer size={16} /></div>
          <div>
            <div className="card-title-text">Drucker</div>
            <div className="card-description">Angeschlossener Bondrucker</div>
          </div>
        </div>

        {/* Druckertyp */}
        <div className="form-group">
          <label className="form-label">Druckertyp</label>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6 }}>
            <PrinterTypeCard
              active={config.printerType === 'escpos'}
              onClick={() => set('printerType', 'escpos')}
              icon={<Zap size={16} />}
              title="ESC/POS"
              desc="TM-T88V · Empfohlen"
            />
            <PrinterTypeCard
              active={config.printerType === 'windows'}
              onClick={() => set('printerType', 'windows')}
              icon={<Printer size={16} />}
              title="Windows"
              desc="TM-T88V · HTML"
            />
            <PrinterTypeCard
              active={config.printerType === 'com'}
              onClick={() => set('printerType', 'com')}
              icon={<Plug size={16} />}
              title="COM-Port"
              desc="TM-T88I · Seriell"
            />
          </div>
        </div>

        {/* Drucker auswählen */}
        {usesWindowsPrinter ? (
          <div className="form-group">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
              <label className="form-label" style={{ margin: 0 }}>
                Drucker auswählen
                {loadingPrinters && <Loader2 size={12} style={{ marginLeft: 6, animation: 'spin 1s linear infinite', display: 'inline' }} />}
              </label>
              <button className="btn btn-ghost btn-sm" onClick={loadPrinters} title="Aktualisieren" style={{ padding: '3px 8px' }}>
                <span style={{ fontSize: 13 }}>↺</span>
              </button>
            </div>
            <div className="select-wrapper">
              <select
                className="form-select"
                value={config.printerName}
                onChange={(e) => set('printerName', e.target.value)}
              >
                <option value="">– Bitte wählen –</option>
                {printers.map((p) => (
                  <option key={p.name} value={p.name}>
                    {p.name}{p.isDefault ? ' (Standard)' : ''}
                  </option>
                ))}
              </select>
              <ChevronDown size={14} className="select-arrow" />
            </div>
            {errors.printerName && <div className="field-error">{errors.printerName}</div>}
            <div className="form-hint">
              {config.printerType === 'escpos'
                ? 'ESC/POS RAW: native Druckerschriften, ~100 ms, Umlaute direkt unterstützt'
                : 'HTML-Modus: Bon wird als Webseite gerendert und über Windows-Treiber gedruckt'}
            </div>
          </div>
        ) : (
          <div className="form-group">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
              <label className="form-label" style={{ margin: 0 }}>COM-Port</label>
              <button className="btn btn-ghost btn-sm" onClick={loadComPorts} title="Aktualisieren" style={{ padding: '3px 8px' }}>
                <span style={{ fontSize: 13 }}>↺</span>
              </button>
            </div>
            <div className="select-wrapper">
              <select
                className="form-select"
                value={config.comPort}
                onChange={(e) => set('comPort', e.target.value)}
              >
                {comPorts.length === 0
                  ? <option value={config.comPort}>{config.comPort}</option>
                  : comPorts.map((p) => (
                      <option key={p.path} value={p.path}>{p.path}{p.manufacturer ? ` – ${p.manufacturer}` : ''}</option>
                    ))}
              </select>
              <ChevronDown size={14} className="select-arrow" />
            </div>
            {errors.comPort && <div className="field-error">{errors.comPort}</div>}
            <div className="form-hint">9600 Baud · Umlaute werden automatisch ersetzt</div>
          </div>
        )}

        {/* Testdruck */}
        <div>
          <button
            className="btn btn-secondary"
            style={{ width: '100%', justifyContent: 'center', gap: 8 }}
            onClick={handleTestPrint}
            disabled={testStatus === 'printing'}
          >
            {testStatus === 'printing'
              ? <><Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> Druckt…</>
              : <><PrinterCheck size={14} /> Testdruck starten</>}
          </button>

          {testStatus === 'ok' && (
            <div className="alert success" style={{ marginTop: 8 }}>
              <CheckCircle2 size={14} style={{ flexShrink: 0, marginTop: 1 }} />
              Testdruck erfolgreich
            </div>
          )}
          {testStatus === 'error' && (
            <div className="alert error" style={{ marginTop: 8 }}>
              <XCircle size={14} style={{ flexShrink: 0, marginTop: 1 }} />
              {testError}
            </div>
          )}
        </div>
      </div>

      {/* ── Allgemein ─────────────────────────────────────────────────────── */}
      <div className="card" style={{ marginBottom: 20 }}>
        <div className="card-header">
          <div className="card-icon"><Settings size={16} /></div>
          <div>
            <div className="card-title-text">Allgemein</div>
            <div className="card-description">Verhalten und Systemeinstellungen</div>
          </div>
        </div>

        <ToggleRow
          name="Automatisch drucken"
          desc="Neue Bestellungen sofort ohne Bestätigung drucken"
          checked={config.autoPrint}
          onChange={(v) => set('autoPrint', v)}
        />
        <ToggleRow
          name="Autostart mit Windows"
          desc="Client automatisch beim Windows-Login starten"
          checked={config.autoStart}
          onChange={(v) => set('autoStart', v)}
          last
        />
      </div>

      {/* ── Footer ────────────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
        {onCancel && (
          <button className="btn btn-secondary" onClick={onCancel} style={{ gap: 6 }}>
            <X size={13} /> Abbrechen
          </button>
        )}
        <button className="btn btn-primary" onClick={handleSave} disabled={saving} style={{ gap: 6 }}>
          {saving
            ? <><Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} /> Speichern…</>
            : <><Save size={13} /> {panelMode ? 'Speichern' : 'Einrichtung abschließen'}</>}
        </button>
      </div>
    </div>
  )

  // ── Panel-Modus (2-Spalten, füllt main-content vollständig) ───────────────
  if (panelMode) {
    return (
      <div className="settings-panel">

        {/* Header mit Aktions-Buttons */}
        <div className="settings-panel-header">
          <div>
            <div className="page-title">Einstellungen</div>
            <div className="page-subtitle">Verbindung, Drucker und Verhalten konfigurieren</div>
          </div>
          <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
            {onCancel && (
              <button className="btn btn-secondary" onClick={onCancel} style={{ gap: 6 }}>
                <X size={13} /> Abbrechen
              </button>
            )}
            <button className="btn btn-primary" onClick={handleSave} disabled={saving} style={{ gap: 6 }}>
              {saving
                ? <><Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} /> Speichern…</>
                : <><Save size={13} /> Speichern</>}
            </button>
          </div>
        </div>

        {/* 2-Spalten-Grid */}
        <div className="settings-grid">

          {/* Linke Spalte: Verbindung + Bar */}
          <div className="settings-col">

            <div className="card">
              <div className="card-header">
                <div className="card-icon"><Server size={15} /></div>
                <div>
                  <div className="card-title-text">Server-Verbindung</div>
                  <div className="card-description">WebSocket zum HGV Bestellsystem</div>
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">WebSocket-URL</label>
                <input className="form-input" placeholder="wss://hgv.example.com"
                  value={config.serverUrl} onChange={(e) => set('serverUrl', e.target.value)} spellCheck={false} />
                {errors.serverUrl && <div className="field-error">{errors.serverUrl}</div>}
                <div className="form-hint">Domain ohne Pfad, z.B. wss://meinserver.de</div>
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Secret-Key</label>
                <div style={{ position: 'relative' }}>
                  <KeyRound size={13} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--muted-foreground)' }} />
                  <input className="form-input" type="password" placeholder="••••••••••••••"
                    value={config.secret} onChange={(e) => set('secret', e.target.value)}
                    spellCheck={false} style={{ paddingLeft: 30 }} />
                </div>
                {errors.secret && <div className="field-error">{errors.secret}</div>}
              </div>
            </div>

            <div className="card">
              <div className="card-header">
                <div className="card-icon"><Store size={15} /></div>
                <div>
                  <div className="card-title-text">Bar</div>
                  <div className="card-description">Welche Bar druckt dieser Client?</div>
                </div>
              </div>
              <div className="form-group" style={{ marginBottom: 10 }}>
                <div className="type-tabs">
                  {BAR_NAMES.map((name) => (
                    <button key={name} className={`type-tab ${config.barName === name ? 'active' : ''}`}
                      onClick={() => set('barName', name)}>{name}</button>
                  ))}
                </div>
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Eigener Name</label>
                <input className="form-input" placeholder="z.B. Cocktailbar, Außenbar…"
                  value={customBarName} onChange={(e) => set('barName', e.target.value)} />
                {errors.barName && <div className="field-error">{errors.barName}</div>}
              </div>
            </div>

          </div>

          {/* Rechte Spalte: Drucker + Allgemein */}
          <div className="settings-col">

            <div className="card">
              <div className="card-header">
                <div className="card-icon"><Printer size={15} /></div>
                <div>
                  <div className="card-title-text">Drucker</div>
                  <div className="card-description">Angeschlossener Bondrucker</div>
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Druckertyp</label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 6 }}>
                  <PrinterTypeCard active={config.printerType === 'escpos'} onClick={() => set('printerType', 'escpos')} icon={<Zap size={14} />} title="ESC/POS" desc="Empfohlen" />
                  <PrinterTypeCard active={config.printerType === 'windows'} onClick={() => set('printerType', 'windows')} icon={<Printer size={14} />} title="Windows" desc="HTML" />
                  <PrinterTypeCard active={config.printerType === 'com'} onClick={() => set('printerType', 'com')} icon={<Plug size={14} />} title="COM-Port" desc="Seriell" />
                </div>
              </div>

              {usesWindowsPrinter ? (
                <div className="form-group">
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                    <label className="form-label" style={{ margin: 0 }}>
                      Drucker
                      {loadingPrinters && <Loader2 size={11} style={{ marginLeft: 6, animation: 'spin 1s linear infinite', display: 'inline-block', verticalAlign: 'middle' }} />}
                    </label>
                    <button className="btn btn-ghost btn-sm" onClick={loadPrinters} style={{ padding: '2px 6px', fontSize: 13 }}>↺</button>
                  </div>
                  <div className="select-wrapper">
                    <select className="form-select" value={config.printerName} onChange={(e) => set('printerName', e.target.value)}>
                      <option value="">– Bitte wählen –</option>
                      {printers.map((p) => <option key={p.name} value={p.name}>{p.name}{p.isDefault ? ' (Standard)' : ''}</option>)}
                    </select>
                    <ChevronDown size={13} className="select-arrow" />
                  </div>
                  {errors.printerName && <div className="field-error">{errors.printerName}</div>}
                  <div className="form-hint">
                    {config.printerType === 'escpos' ? 'ESC/POS RAW · native Schriften · ~100 ms' : 'HTML wird über Windows-Treiber gerendert'}
                  </div>
                </div>
              ) : (
                <div className="form-group">
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                    <label className="form-label" style={{ margin: 0 }}>COM-Port</label>
                    <button className="btn btn-ghost btn-sm" onClick={loadComPorts} style={{ padding: '2px 6px', fontSize: 13 }}>↺</button>
                  </div>
                  <div className="select-wrapper">
                    <select className="form-select" value={config.comPort} onChange={(e) => set('comPort', e.target.value)}>
                      {comPorts.length === 0 ? <option value={config.comPort}>{config.comPort}</option>
                        : comPorts.map((p) => <option key={p.path} value={p.path}>{p.path}{p.manufacturer ? ` – ${p.manufacturer}` : ''}</option>)}
                    </select>
                    <ChevronDown size={13} className="select-arrow" />
                  </div>
                  {errors.comPort && <div className="field-error">{errors.comPort}</div>}
                  <div className="form-hint">9600 Baud · Umlaute werden automatisch ersetzt</div>
                </div>
              )}

              <div style={{ marginBottom: 0 }}>
                <button className="btn btn-secondary" style={{ width: '100%', justifyContent: 'center', gap: 8 }}
                  onClick={handleTestPrint} disabled={testStatus === 'printing'}>
                  {testStatus === 'printing'
                    ? <><Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} /> Druckt…</>
                    : <><PrinterCheck size={13} /> Testdruck</>}
                </button>
                {testStatus === 'ok' && (
                  <div className="alert success" style={{ marginTop: 8, marginBottom: 0 }}>
                    <CheckCircle2 size={13} style={{ flexShrink: 0 }} /> Testdruck erfolgreich
                  </div>
                )}
                {testStatus === 'error' && (
                  <div className="alert error" style={{ marginTop: 8, marginBottom: 0 }}>
                    <XCircle size={13} style={{ flexShrink: 0 }} /> {testError}
                  </div>
                )}
              </div>
            </div>

            <div className="card">
              <div className="card-header">
                <div className="card-icon"><Settings size={15} /></div>
                <div>
                  <div className="card-title-text">Allgemein</div>
                  <div className="card-description">Verhalten und Systemeinstellungen</div>
                </div>
              </div>
              <ToggleRow name="Automatisch drucken" desc="Neue Bestellungen sofort drucken"
                checked={config.autoPrint} onChange={(v) => set('autoPrint', v)} />
              <ToggleRow name="Autostart mit Windows" desc="Client beim Login automatisch starten"
                checked={config.autoStart} onChange={(v) => set('autoStart', v)} last />
            </div>

          </div>
        </div>
      </div>
    )
  }

  // ── Ersteinrichtung ────────────────────────────────────────────────────────
  return (
    <div className="setup-screen">
      <div className="setup-card">
        <div className="setup-header">
          <div className="setup-logo">HGV Bestellsystem</div>
          <div className="setup-title">Druckerclient einrichten</div>
          <div className="setup-subtitle">Einmalige Konfiguration für diesen Bar-Laptop</div>
        </div>

        {/* Im Fullscreen-Modus: kompaktere Darstellung ohne Karten */}
        <div className="setup-section-title">Server-Verbindung</div>
        <div className="form-group">
          <label className="form-label">WebSocket-URL</label>
          <input className="form-input" placeholder="wss://hgv.example.com"
            value={config.serverUrl} onChange={(e) => set('serverUrl', e.target.value)} spellCheck={false} />
          {errors.serverUrl && <div className="field-error">{errors.serverUrl}</div>}
        </div>
        <div className="form-group">
          <label className="form-label">Secret-Key</label>
          <input className="form-input" type="password" placeholder="••••••••••••••"
            value={config.secret} onChange={(e) => set('secret', e.target.value)} spellCheck={false} />
          {errors.secret && <div className="field-error">{errors.secret}</div>}
        </div>

        <div className="setup-section-title">Bar</div>
        <div className="form-group">
          <div className="type-tabs" style={{ marginBottom: 8 }}>
            {BAR_NAMES.map((name) => (
              <button key={name} className={`type-tab ${config.barName === name ? 'active' : ''}`}
                onClick={() => set('barName', name)}>{name}</button>
            ))}
          </div>
          <input className="form-input" placeholder="Oder eigenen Namen eingeben…"
            value={customBarName} onChange={(e) => set('barName', e.target.value)} />
          {errors.barName && <div className="field-error">{errors.barName}</div>}
        </div>

        <div className="setup-section-title">Drucker</div>
        <div className="form-group">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6, marginBottom: 12 }}>
            <PrinterTypeCard active={config.printerType === 'escpos'} onClick={() => set('printerType', 'escpos')} icon={<Zap size={14} />} title="ESC/POS" desc="Empfohlen" />
            <PrinterTypeCard active={config.printerType === 'windows'} onClick={() => set('printerType', 'windows')} icon={<Printer size={14} />} title="Windows" desc="HTML" />
            <PrinterTypeCard active={config.printerType === 'com'} onClick={() => set('printerType', 'com')} icon={<Plug size={14} />} title="COM-Port" desc="Seriell" />
          </div>
          {usesWindowsPrinter ? (
            <>
              <div className="select-wrapper">
                <select className="form-select" value={config.printerName} onChange={(e) => set('printerName', e.target.value)}>
                  <option value="">– Bitte Drucker wählen –</option>
                  {printers.map((p) => <option key={p.name} value={p.name}>{p.name}{p.isDefault ? ' (Standard)' : ''}</option>)}
                </select>
                <ChevronDown size={14} className="select-arrow" />
              </div>
              {errors.printerName && <div className="field-error">{errors.printerName}</div>}
            </>
          ) : (
            <>
              <div className="select-wrapper">
                <select className="form-select" value={config.comPort} onChange={(e) => set('comPort', e.target.value)}>
                  {comPorts.length === 0 ? <option value={config.comPort}>{config.comPort}</option>
                    : comPorts.map((p) => <option key={p.path} value={p.path}>{p.path}</option>)}
                </select>
                <ChevronDown size={14} className="select-arrow" />
              </div>
              {errors.comPort && <div className="field-error">{errors.comPort}</div>}
            </>
          )}
        </div>

        <div className="setup-footer">
          {onCancel && <button className="btn btn-secondary" onClick={onCancel}>Abbrechen</button>}
          <button className="btn btn-primary" onClick={handleSave} disabled={saving} style={{ gap: 6 }}>
            {saving ? <><Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} /> Speichern…</> : <>Einrichtung abschließen →</>}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Sub-Komponenten ──────────────────────────────────────────────────────────

function PrinterTypeCard({ active, onClick, icon, title, desc }) {
  return (
    <button
      className={`type-tab ${active ? 'active' : ''}`}
      onClick={onClick}
      style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5, padding: '12px 8px' }}
    >
      <span style={{ opacity: active ? 1 : 0.5 }}>{icon}</span>
      <span style={{ fontSize: 12, fontWeight: 600 }}>{title}</span>
      <span style={{ fontSize: 10, fontWeight: 400, opacity: 0.65, lineHeight: 1.2 }}>{desc}</span>
    </button>
  )
}

function ToggleRow({ name, desc, checked, onChange, last = false }) {
  return (
    <div className="toggle-row" style={last ? { borderBottom: 'none', paddingBottom: 0 } : {}}>
      <div>
        <div className="toggle-name">{name}</div>
        <div className="toggle-desc">{desc}</div>
      </div>
      <label className="toggle">
        <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
        <span className="toggle-track" />
      </label>
    </div>
  )
}
