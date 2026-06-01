import { useState, useEffect, useCallback } from 'react'
import { ClipboardList, Settings, Printer, Wifi, WifiOff, Loader2, Clock, PrinterX } from 'lucide-react'
import useWebSocket from '../hooks/useWebSocket.js'
import SetupScreen from './SetupScreen.jsx'

const MAX_LOG = 100

function isConfigComplete(config) {
  return !!(config?.serverUrl && config?.secret && config?.barName &&
    (config?.printerName || config?.printerType === 'com'))
}

function playBeep() {
  try {
    const ctx = new AudioContext()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.frequency.value = 880
    osc.type = 'sine'
    gain.gain.setValueAtTime(0.25, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.25)
    osc.start(ctx.currentTime)
    osc.stop(ctx.currentTime + 0.25)
  } catch (_) {}
}

function formatTime(iso) {
  try {
    return new Date(iso).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
  } catch { return '--:--:--' }
}

function itemsSummary(items = [], storno = false) {
  const prefix = storno ? '-' : ''
  return items.map((i) => `${prefix}${i.quantity}× ${i.name}`).join(', ')
}

function isStorno(order) {
  return String(order?.job_type ?? '').toUpperCase() === 'STORNO'
}

// ─── Drucker-Status Hook ──────────────────────────────────────────────────────

function usePrinterStatus(printerName, printerType, intervalMs = 6000) {
  const [printerStatus, setPrinterStatus] = useState({ online: null, text: '…' })

  useEffect(() => {
    // COM-Port: kein Windows-Status abfragbar
    if (printerType === 'com' || !printerName) {
      setPrinterStatus({ online: null, text: printerType === 'com' ? 'COM-Port' : 'Kein Drucker' })
      return
    }

    async function check() {
      const result = await window.electron.getPrinterStatus(printerName)
      setPrinterStatus(result)
    }

    check()
    const id = setInterval(check, intervalMs)
    return () => clearInterval(id)
  }, [printerName, printerType, intervalMs])

  return printerStatus
}

// ─── Dashboard ────────────────────────────────────────────────────────────────

export default function Dashboard({ config, initialPage, onSaveConfig }) {
  const configured = isConfigComplete(config)
  const [activePage, setActivePage] = useState(
    initialPage ?? (configured ? 'orders' : 'settings')
  )
  const [log, setLog] = useState([])
  const [activePrinting, setActivePrinting] = useState(null)

  const printerStatus = usePrinterStatus(config?.printerName, config?.printerType)

  const total   = log.length
  const success = log.filter((e) => e.status === 'ok').length
  const failed  = log.filter((e) => e.status === 'error').length

  // Wenn initialPage sich ändert (Tray-Menü), reagieren
  useEffect(() => {
    if (initialPage) setActivePage(initialPage)
  }, [initialPage])

  // Tray-Tooltip
  useEffect(() => {
    window.electron.setTrayTooltip(
      `Druckerclient · ${config?.barName ?? '–'} · ${total} Bestellungen`
    )
  }, [total, config?.barName])

  // ── Drucken ─────────────────────────────────────────────────────────────────

  const printOrder = useCallback(async (order, isManual = false) => {
    const entryId = `${order.order_id}-${Date.now()}`

    setLog((prev) => [
      ...prev.slice(-MAX_LOG + 1),
      { id: entryId, order, status: 'printing', timestamp: new Date().toISOString(), error: null, manual: isManual },
    ])
    setActivePrinting(order.order_id)

    const result = await window.electron.printOrder(order, config)

    setActivePrinting(null)
    setLog((prev) =>
      prev.map((e) =>
        e.id === entryId
          ? { ...e, status: result.success ? 'ok' : 'error', error: result.error || null }
          : e
      )
    )

    if (result.success && config?.soundEnabled) playBeep()
    return result
  }, [config])

  // ── WebSocket ────────────────────────────────────────────────────────────────

  const { status, reconnectIn, reconnectCount, sendMessage } = useWebSocket({
    url: configured ? config.serverUrl : '',
    secret: configured ? config.secret : '',
    barName: configured ? config.barName : '',
    onMessage: async (msg) => {
      if (msg.type !== 'print_job') return
      const { payload } = msg
      const storno = isStorno(payload)

      window.electron.showNotification(
        storno ? `Storno #${payload.order_id}` : `Neue Bestellung #${payload.order_id}`,
        itemsSummary(payload.items, storno)
      )

      if (config.autoPrint) {
        const result = await printOrder(payload)
        if (result.success) sendMessage({ type: 'ack', order_id: payload.order_id })
      } else {
        setLog((prev) => [
          ...prev.slice(-MAX_LOG + 1),
          { id: `${payload.order_id}-${Date.now()}`, order: payload, status: 'waiting', timestamp: new Date().toISOString(), error: null },
        ])
      }
    },
  })

  async function handleManualPrint(entry) {
    const result = await printOrder(entry.order, true)
    if (result.success) sendMessage({ type: 'ack', order_id: entry.order.order_id })
  }

  // ── Server-Banner ────────────────────────────────────────────────────────────

  const serverBanner = (() => {
    if (!configured) return null
    switch (status) {
      case 'connected':    return { cls: 'connected',    icon: '🟢', title: 'Server verbunden',          sub: `${config.barName} · ${config.serverUrl}` }
      case 'connecting':   return { cls: 'connecting',   icon: '🟡', title: reconnectCount > 0 ? `Verbinde… (Versuch ${reconnectCount})` : 'Verbinde…', sub: reconnectCount > 0 ? `Nächster Versuch in ${reconnectIn}s` : 'Verbindung wird aufgebaut' }
      case 'disconnected': return { cls: 'disconnected', icon: '🔴', title: 'Verbindung unterbrochen',   sub: reconnectIn > 0 ? `Reconnect in ${reconnectIn}s…` : 'Verbindet…' }
      case 'error':        return { cls: 'error',        icon: '⚠️', title: 'Verbindungsfehler',         sub: 'URL oder Secret ungültig – Einstellungen prüfen' }
      default:             return { cls: 'disconnected', icon: '⚫', title: 'Getrennt', sub: '' }
    }
  })()

  const printerOffline = printerStatus.online === false

  // ── Sidebar-Status-Label ─────────────────────────────────────────────────────

  const serverStatusLabel = {
    connected: 'Verbunden', connecting: 'Verbinde…', error: 'Fehler', disconnected: 'Getrennt',
  }[status] || 'Getrennt'

  const printerStatusCls = printerStatus.online === true ? 'connected'
    : printerStatus.online === false ? 'error'
    : 'connecting'

  // ── Render ────────────────────────────────────────────────────────────────────

  return (
    <div className="app-body">

      {/* Sidebar */}
      <aside className="sidebar">
        <nav className="sidebar-nav">
          <button
            className={`sidebar-item ${activePage === 'orders' ? 'active' : ''} ${!configured ? 'disabled' : ''}`}
            onClick={() => configured && setActivePage('orders')}
            disabled={!configured}
            title={!configured ? 'Zuerst konfigurieren' : ''}
          >
            <ClipboardList size={16} />
            Bestellungen
          </button>
          <button
            className={`sidebar-item ${activePage === 'settings' ? 'active' : ''}`}
            onClick={() => setActivePage('settings')}
          >
            <Settings size={16} />
            Einstellungen
          </button>
        </nav>

        {/* Status-Footer */}
        <div className="sidebar-status-group">
          <div className="sidebar-status">
            {configured && status === 'connected'
              ? <Wifi size={12} style={{ color: 'var(--green)', flexShrink: 0 }} />
              : configured && status === 'connecting'
              ? <Loader2 size={12} style={{ color: 'var(--yellow)', flexShrink: 0, animation: 'spin 1s linear infinite' }} />
              : <WifiOff size={12} style={{ color: 'var(--red)', flexShrink: 0 }} />}
            <span className="status-label">
              <span className={configured ? status : 'error'}>
                {configured ? serverStatusLabel : 'Nicht konfiguriert'}
              </span>
            </span>
          </div>
          <div className="sidebar-status">
            <Printer size={12} style={{ color: printerStatusCls === 'connected' ? 'var(--green)' : printerStatusCls === 'error' ? 'var(--red)' : 'var(--muted-foreground)', flexShrink: 0 }} />
            <span className="status-label">
              <span className={printerStatusCls}>{printerStatus.text}</span>
            </span>
          </div>
        </div>

        <div className="sidebar-copyright">
          © {new Date().getFullYear()} Yannik Schäffler
        </div>
      </aside>

      {/* Hauptbereich */}
      <main className={`main-content${activePage === 'settings' ? ' main-content--settings' : ''}`}>

        {/* ── Bestellungen ── */}
        {activePage === 'orders' && configured && (
          <>
            <div className="page-header">
              <div className="page-title">Bestellungen</div>
              <div className="page-subtitle">Eingehende Druckaufträge für {config.barName}</div>
            </div>

            {/* Server-Banner */}
            {serverBanner && (
              <div className={`connection-banner ${serverBanner.cls}`}>
                <span className="banner-icon">{serverBanner.icon}</span>
                <div className="banner-text">
                  <div className="banner-title">{serverBanner.title}</div>
                  <div className="banner-subtitle">{serverBanner.sub}</div>
                </div>
                {status !== 'connected' && (
                  <button className="btn btn-secondary btn-sm" onClick={() => setActivePage('settings')}>
                    Einstellungen
                  </button>
                )}
              </div>
            )}

            {/* Drucker-Offline-Banner */}
            {printerOffline && (
              <div className="connection-banner disconnected" style={{ marginBottom: 12 }}>
                <PrinterX size={18} className='banner-icon'/>
                <div className="banner-text">
                  <div className="banner-title">Drucker offline – {printerStatus.text}</div>
                  <div className="banner-subtitle">
                    Bestellungen werden in der Windows-Druckwarteschlange gehalten und automatisch gedruckt sobald der Drucker wieder verfügbar ist.
                  </div>
                </div>
              </div>
            )}

            {/* Stats */}
            <div className="stats-grid">
              <div className="stat-card">
                <div className="stat-value accent">{total}</div>
                <div className="stat-label">Bestellungen</div>
              </div>
              <div className="stat-card">
                <div className={`stat-value ${success > 0 ? 'green' : ''}`}>{success}</div>
                <div className="stat-label">Gedruckt</div>
              </div>
              <div className="stat-card">
                <div className={`stat-value ${failed > 0 ? 'red' : ''}`}>{failed}</div>
                <div className="stat-label">Fehler</div>
              </div>
            </div>

            {/* Druckprotokoll */}
            <div className="card">
              <div className="card-title">
                Druckprotokoll
              </div>
              {log.length === 0 ? (
                <div className="empty-state">
                  <Printer size={30} style={{ color: 'var(--muted-foreground)' }}/>
                  <div className="empty-state-text">
                    {status === 'connected' ? 'Warte auf Bestellungen…' : 'Keine Verbindung zum Server'}
                  </div>
                </div>
              ) : (
                <div className="order-list">
                  {[...log].reverse().map((entry) => (
                    <OrderEntry
                      key={entry.id}
                      entry={entry}
                      isActive={activePrinting === entry.order.order_id}
                      onPrint={() => handleManualPrint(entry)}
                    />
                  ))}
                </div>
              )}
            </div>
          </>
        )}

        {/* ── Einstellungen ── */}
        {activePage === 'settings' && (
          <SetupScreen
            key={activePage}
            initialConfig={config}
            onSave={async (newConfig) => {
              await onSaveConfig(newConfig)
              if (configured) setActivePage('orders')
            }}
            onCancel={configured ? () => setActivePage('orders') : null}
            panelMode
          />
        )}

        {/* ── Nicht konfiguriert ── */}
        {activePage === 'orders' && !configured && (
          <div className="empty-state" style={{ marginTop: 80 }}>
            <div className="empty-state-icon">⚙️</div>
            <div className="empty-state-text" style={{ marginBottom: 16 }}>
              Druckerclient noch nicht eingerichtet
            </div>
            <button className="btn btn-primary" onClick={() => setActivePage('settings')}>
              Jetzt einrichten →
            </button>
          </div>
        )}

      </main>
    </div>
  )
}

// ─── Log-Eintrag ──────────────────────────────────────────────────────────────

function OrderEntry({ entry, isActive, onPrint }) {
  const { order, status, timestamp, error } = entry
  const storno = isStorno(order)

  const badge = {
    ok:       { cls: 'success', label: '✓ Gedruckt' },
    error:    { cls: 'error',   label: '✗ Fehler' },
    printing: { cls: 'pending', label: '⏳ Druckt…' },
    waiting:  { cls: 'new',     label: '● Wartend' },
  }[status] || { cls: 'pending', label: status }

  const itemClass = [
    'order-item',
    storno ? 'storno' : status === 'waiting' ? 'new' : status === 'error' ? 'error' : '',
  ].filter(Boolean).join(' ')

  return (
    <div className={itemClass}>
      <div className="order-id" style={storno ? { color: 'var(--red)' } : {}}>
        #{order.order_id}
      </div>
      <div className="order-body">
        <div className="order-items-text" style={storno ? { color: 'var(--red)' } : {}}>
          {itemsSummary(order.items, storno)}
        </div>
        <div className="order-meta">
          {formatTime(timestamp)}
          {order.table ? ` · Tisch ${order.table}` : ''}
          {order.waiter_name ? ` · ${order.waiter_name}` : ''}
        </div>
        {order.note && <div className="order-note">📝 {order.note}</div>}
        {status === 'error' && error && (
          <div style={{ fontSize: 11, color: 'var(--red)', marginTop: 3, fontWeight: 500 }}>{error}</div>
        )}
      </div>
      <div className="order-actions">
        {storno && <span className="badge error" style={{ marginRight: 4 }}>↩ Storno</span>}
        <span className={`badge ${badge.cls}`}>{badge.label}</span>
        {(status === 'error' || status === 'waiting') && (
          <button className="btn btn-ghost btn-sm" onClick={onPrint} disabled={isActive} title="Nochmal drucken">
            🖨️
          </button>
        )}
      </div>
    </div>
  )
}
