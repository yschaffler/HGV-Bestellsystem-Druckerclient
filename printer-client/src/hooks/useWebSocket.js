import { useState, useEffect, useRef, useCallback } from 'react'

/**
 * WebSocket-Hook mit automatischem Reconnect + Exponential Backoff.
 *
 * Verbindungs-URL: wss://server/ws/printer?bar=Bar+1&secret=xxx
 *
 * Status-Werte:
 *   'connecting'  – Verbindung wird aufgebaut
 *   'connected'   – Verbunden und bereit
 *   'disconnected'– Verbindung unterbrochen, Reconnect läuft
 *   'error'       – Dauerhafter Fehler (z.B. 401 Unauthorized)
 */

const MIN_DELAY_MS  = 1_000   // 1s erster Retry
const MAX_DELAY_MS  = 30_000  // max 30s Abstand
const MAX_RETRIES   = 50      // danach aufgeben (bei Abiball: nie aufgeben)

export default function useWebSocket({ url, secret, barName, onMessage }) {
  const [status, setStatus] = useState('connecting')
  const [reconnectIn, setReconnectIn] = useState(0)
  const [reconnectCount, setReconnectCount] = useState(0)

  const wsRef        = useRef(null)
  const retryRef     = useRef(0)
  const timerRef     = useRef(null)
  const countdownRef = useRef(null)
  const mountedRef   = useRef(true)
  const onMessageRef = useRef(onMessage)

  // onMessage-Callback immer aktuell halten ohne Hook neu zu starten
  useEffect(() => { onMessageRef.current = onMessage }, [onMessage])

  // ── Verbindung aufbauen ──────────────────────────────────────────────────

  const connect = useCallback(() => {
    if (!mountedRef.current) return
    if (!url || !secret || !barName) return

    // Bestehende Verbindung sauber schließen
    if (wsRef.current) {
      wsRef.current.onclose = null // kein Reconnect-Trigger
      wsRef.current.close()
      wsRef.current = null
    }

    setStatus('connecting')

    // WebSocket-URL zusammenbauen
    const wsUrl = buildUrl(url, barName, secret)
    if (!wsUrl) {
      setStatus('error')
      return
    }

    let ws
    try {
      ws = new WebSocket(wsUrl)
    } catch (e) {
      console.error('[ws] Ungültige URL:', e)
      setStatus('error')
      return
    }

    wsRef.current = ws

    ws.onopen = () => {
      if (!mountedRef.current) return
      console.log('[ws] Verbunden:', wsUrl)
      retryRef.current = 0
      setStatus('connected')
      setReconnectCount(0)
      setReconnectIn(0)
    }

    ws.onmessage = (event) => {
      if (!mountedRef.current) return
      try {
        const msg = JSON.parse(event.data)
        onMessageRef.current?.(msg)
      } catch (e) {
        console.warn('[ws] Ungültige Nachricht:', event.data)
      }
    }

    ws.onerror = (e) => {
      console.warn('[ws] Fehler:', e)
      // onclose wird danach automatisch aufgerufen
    }

    ws.onclose = (event) => {
      if (!mountedRef.current) return

      wsRef.current = null

      // 401 = falsches Secret → kein Retry
      if (event.code === 4001 || event.code === 1008) {
        console.error('[ws] Authentifizierungsfehler')
        setStatus('error')
        return
      }

      scheduleReconnect()
    }
  }, [url, secret, barName])

  // ── Reconnect mit Exponential Backoff ────────────────────────────────────

  const scheduleReconnect = useCallback(() => {
    if (!mountedRef.current) return

    clearTimeout(timerRef.current)
    clearInterval(countdownRef.current)

    retryRef.current += 1
    setReconnectCount(retryRef.current)

    // Backoff: 1s, 2s, 4s, 8s, … bis 30s
    const delay = Math.min(
      MIN_DELAY_MS * Math.pow(2, retryRef.current - 1),
      MAX_DELAY_MS
    )

    setStatus('disconnected')
    setReconnectIn(Math.round(delay / 1000))

    // Countdown
    let remaining = Math.round(delay / 1000)
    countdownRef.current = setInterval(() => {
      remaining -= 1
      setReconnectIn(Math.max(0, remaining))
    }, 1000)

    timerRef.current = setTimeout(() => {
      clearInterval(countdownRef.current)
      if (mountedRef.current) connect()
    }, delay)
  }, [connect])

  // ── Nachrichten senden ───────────────────────────────────────────────────

  const sendMessage = useCallback((msg) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(msg))
    } else {
      console.warn('[ws] sendMessage: nicht verbunden')
    }
  }, [])

  // ── Lifecycle ────────────────────────────────────────────────────────────

  useEffect(() => {
    mountedRef.current = true
    retryRef.current = 0
    connect()

    return () => {
      mountedRef.current = false
      clearTimeout(timerRef.current)
      clearInterval(countdownRef.current)
      if (wsRef.current) {
        wsRef.current.onclose = null
        wsRef.current.close()
        wsRef.current = null
      }
    }
  }, [connect]) // connect ist stabil (useCallback mit url/secret/barName als Deps)

  return { status, reconnectIn, reconnectCount, sendMessage }
}

// ─── URL zusammenbauen ────────────────────────────────────────────────────────

function buildUrl(baseUrl, barName, secret) {
  try {
    // Normalisieren: trailing slash entfernen
    const base = baseUrl.replace(/\/$/, '')
    const url = new URL(`${base}/ws/printer`)
    url.searchParams.set('bar', barName)
    url.searchParams.set('secret', secret)
    return url.toString()
  } catch (e) {
    console.error('[ws] Ungültige Basis-URL:', baseUrl, e)
    return null
  }
}
