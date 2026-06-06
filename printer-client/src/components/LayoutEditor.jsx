import { useState, useCallback } from 'react'
import {
  Layout, GripVertical, Trash2, ChevronUp, ChevronDown,
  Plus, RotateCcw, Save, AlignLeft, AlignCenter, AlignRight,
  Type, Minus, Square, List, Hash, Eye, Download, Upload,
} from 'lucide-react'

// ─── Konstanten ───────────────────────────────────────────────────────────────

export const FIELD_OPTIONS = [
  { value: 'table',    label: 'Tischnummer' },
  { value: 'waiter',   label: 'Kellner' },
  { value: 'order_id', label: 'Bon-Nummer' },
  { value: 'date',     label: 'Datum' },
  { value: 'time',     label: 'Uhrzeit' },
  { value: 'bar_name', label: 'Bar-Name' },
  { value: 'note',     label: 'Bestellnotiz' },
]

export const DEFAULT_LAYOUT = [
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

const SAMPLE_ORDER = {
  order_id: 42,
  job_type: 'RECHNUNG',
  table: 7,
  waiter_name: 'Max',
  items: [
    { name: 'Club Mate',  quantity: 2, price: 2.50 },
    { name: 'Bier 0,5l',  quantity: 1, price: 3.00, note: 'ohne Schaum' },
    { name: 'Spezi',      quantity: 3, price: 2.00 },
  ],
  note: '',
}

const REQUIRED_TYPES = new Set(['items', 'total'])

function uid() {
  return Math.random().toString(36).slice(2, 8)
}

// ─── Vorschau-Rendering ───────────────────────────────────────────────────────

function fmtPrice(p) {
  return Number(p).toFixed(2).replace('.', ',') + ' EUR'
}

function resolveField(field, order, barName) {
  const now = new Date()
  switch (field) {
    case 'table':    return order.table != null ? String(order.table) : '-'
    case 'waiter':   return order.waiter_name || '-'
    case 'order_id': return String(order.order_id)
    case 'date':     return now.toLocaleDateString('de-DE')
    case 'time':     return now.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })
    case 'bar_name': return String(barName || 'BAR').toUpperCase()
    case 'note':     return order.note || ''
    default:         return ''
  }
}

function padLine(left, right, W = 42) {
  left = String(left); right = String(right)
  const spaces = Math.max(1, W - left.length - right.length)
  return left + ' '.repeat(spaces) + right
}

function threeColLine(a, b, c, W = 42) {
  a = String(a); b = String(b); c = String(c)
  const spare = Math.max(2, W - a.length - b.length - c.length)
  const g1 = Math.ceil(spare / 2)
  const g2 = spare - g1
  return a + ' '.repeat(g1) + b + ' '.repeat(g2) + c
}

function alignLine(text, align, W = 42) {
  text = String(text)
  if (align === 'center') return ' '.repeat(Math.max(0, Math.floor((W - text.length) / 2))) + text
  if (align === 'right')  return ' '.repeat(Math.max(0, W - text.length)) + text
  return text
}

function renderPreview(layout, barName) {
  const W = 42
  const order = SAMPLE_ORDER
  const lines = []

  for (const el of layout) {
    switch (el.type) {
      case 'compound': {
        const texts = (el.cols || []).map(c => {
          const val = resolveField(c.field, order, barName)
          return c.prefix ? `${c.prefix} ${val}` : val
        })
        let text = ''
        if (texts.length >= 3) text = threeColLine(texts[0], texts[1], texts[2], W)
        else if (texts.length === 2) text = padLine(texts[0], texts[1], W)
        else if (texts.length === 1) text = alignLine(texts[0], el.align || 'left', W)
        lines.push({ text, bold: el.bold, large: el.size === 'large' })
        break
      }
      case 'field': {
        const val = resolveField(el.field, order, barName)
        if (!val || val === '-') { if (el.field === 'note') break }
        const text = el.label ? `${el.label}: ${val}` : val
        lines.push({ text: alignLine(text, el.align || 'left', W), bold: el.bold, large: el.size === 'large' })
        break
      }
      case 'text':
        if (!el.content) break
        lines.push({ text: alignLine(el.content, el.align || 'left', W), bold: el.bold, large: el.size === 'large' })
        break
      case 'divider':
        lines.push({ text: (el.char || '=').repeat(W), divider: true })
        break
      case 'spacer':
        lines.push({ text: '' })
        break
      case 'items': {
        lines.push({ text: '' })
        for (const item of order.items) {
          const qty   = `${item.quantity}x`
          const price = fmtPrice(item.price * item.quantity)
          const nameMax = W - qty.length - 3 - 1 - price.length
          const name = item.name.substring(0, nameMax).padEnd(nameMax)
          lines.push({ text: `${qty}   ${name} ${price}`, large: true })
          if (item.note) lines.push({ text: `     -> ${item.note}`, italic: true })
          lines.push({ text: '' })
        }
        break
      }
      case 'total': {
        const totalVal = fmtPrice(order.items.reduce((s, i) => s + i.price * i.quantity, 0))
        lines.push({ text: padLine('GESAMT', totalVal, W), bold: true })
        break
      }
      default: break
    }
  }
  return lines
}

// ─── Element-Beschreibung ─────────────────────────────────────────────────────

function elementLabel(el) {
  switch (el.type) {
    case 'compound': {
      const names = (el.cols || []).map(c => {
        const f = FIELD_OPTIONS.find(o => o.value === c.field)
        return (c.prefix ? c.prefix + ' ' : '') + (f?.label ?? c.field)
      })
      return names.join(' | ')
    }
    case 'field': {
      const f = FIELD_OPTIONS.find(o => o.value === el.field)
      return (el.label ? el.label + ': ' : '') + (f?.label ?? el.field)
    }
    case 'text':    return el.content ? `"${el.content}"` : '(leerer Text)'
    case 'divider': return `Trennlinie (${el.char || '='})`
    case 'spacer':  return 'Leerzeile'
    case 'items':   return 'Artikelliste (erforderlich)'
    case 'total':   return 'Gesamtbetrag (erforderlich)'
    default:        return el.type
  }
}

function elementIcon(type) {
  switch (type) {
    case 'compound': return <Layout size={14} />
    case 'field':    return <Hash size={14} />
    case 'text':     return <Type size={14} />
    case 'divider':  return <Minus size={14} />
    case 'spacer':   return <Square size={14} style={{ opacity: 0.4 }} />
    case 'items':    return <List size={14} />
    case 'total':    return <Hash size={14} />
    default:         return <Square size={14} />
  }
}

// ─── Einzel-Element-Editor ────────────────────────────────────────────────────

function AlignButtons({ value, onChange }) {
  return (
    <div style={{ display: 'flex', gap: 4 }}>
      {[
        { v: 'left',   icon: <AlignLeft size={13} /> },
        { v: 'center', icon: <AlignCenter size={13} /> },
        { v: 'right',  icon: <AlignRight size={13} /> },
      ].map(({ v, icon }) => (
        <button
          key={v}
          className={`btn btn-ghost btn-sm ${value === v ? 'active' : ''}`}
          style={{ padding: '4px 8px', background: value === v ? 'var(--accent)' : undefined }}
          onClick={() => onChange(v)}
        >
          {icon}
        </button>
      ))}
    </div>
  )
}

function FieldSelect({ value, onChange }) {
  return (
    <div className="select-wrapper" style={{ flex: 1 }}>
      <select className="form-select" value={value} onChange={e => onChange(e.target.value)}
        style={{ fontSize: 12, padding: '4px 24px 4px 8px' }}>
        {FIELD_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </div>
  )
}

function CompoundEditor({ el, onChange }) {
  const cols = el.cols || []

  function setCol(i, patch) {
    const next = cols.map((c, ci) => ci === i ? { ...c, ...patch } : c)
    onChange({ cols: next })
  }

  function addCol() {
    if (cols.length >= 3) return
    onChange({ cols: [...cols, { field: 'table', prefix: '' }] })
  }

  function removeCol(i) {
    if (cols.length <= 1) return
    onChange({ cols: cols.filter((_, ci) => ci !== i) })
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <label className="form-label" style={{ margin: 0, minWidth: 60 }}>Größe</label>
        <div className="type-tabs" style={{ flex: 1 }}>
          <button className={`type-tab ${el.size !== 'large' ? 'active' : ''}`} onClick={() => onChange({ size: 'normal' })}>Normal</button>
          <button className={`type-tab ${el.size === 'large' ? 'active' : ''}`} onClick={() => onChange({ size: 'large' })}>Groß</button>
        </div>
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, cursor: 'pointer' }}>
          <input type="checkbox" checked={!!el.bold} onChange={e => onChange({ bold: e.target.checked })} />
          Fett
        </label>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {cols.map((col, i) => (
          <div key={i} style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <span style={{ fontSize: 11, color: 'var(--muted-foreground)', minWidth: 14 }}>
              {['L', 'M', 'R'][i]}
            </span>
            <FieldSelect value={col.field} onChange={v => setCol(i, { field: v })} />
            <input
              className="form-input"
              style={{ width: 70, fontSize: 12, padding: '4px 8px' }}
              placeholder="Prefix"
              value={col.prefix || ''}
              onChange={e => setCol(i, { prefix: e.target.value })}
            />
            {cols.length > 1 && (
              <button className="btn btn-ghost btn-sm" style={{ padding: '4px 6px', color: 'var(--destructive)' }}
                onClick={() => removeCol(i)}>
                <Trash2 size={12} />
              </button>
            )}
          </div>
        ))}
        {cols.length < 3 && (
          <button className="btn btn-ghost btn-sm" style={{ alignSelf: 'flex-start', gap: 4, fontSize: 11 }}
            onClick={addCol}>
            <Plus size={11} /> Spalte hinzufügen
          </button>
        )}
      </div>
    </div>
  )
}

function FieldEditor({ el, onChange }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <label className="form-label" style={{ margin: 0, minWidth: 60 }}>Feld</label>
        <FieldSelect value={el.field || 'table'} onChange={v => onChange({ field: v })} />
      </div>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <label className="form-label" style={{ margin: 0, minWidth: 60 }}>Label</label>
        <input
          className="form-input"
          style={{ flex: 1, fontSize: 12, padding: '4px 8px' }}
          placeholder="z.B. Tisch, Kellner… (leer = kein Label)"
          value={el.label || ''}
          onChange={e => onChange({ label: e.target.value })}
        />
      </div>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <label className="form-label" style={{ margin: 0, minWidth: 60 }}>Ausrichtung</label>
        <AlignButtons value={el.align || 'left'} onChange={v => onChange({ align: v })} />
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, marginLeft: 8, cursor: 'pointer' }}>
          <input type="checkbox" checked={!!el.bold} onChange={e => onChange({ bold: e.target.checked })} />
          Fett
        </label>
      </div>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <label className="form-label" style={{ margin: 0, minWidth: 60 }}>Größe</label>
        <div className="type-tabs">
          <button className={`type-tab ${el.size !== 'large' ? 'active' : ''}`} onClick={() => onChange({ size: 'normal' })}>Normal</button>
          <button className={`type-tab ${el.size === 'large' ? 'active' : ''}`} onClick={() => onChange({ size: 'large' })}>Groß</button>
        </div>
      </div>
    </div>
  )
}

function TextEditor({ el, onChange }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <label className="form-label" style={{ margin: 0, minWidth: 60 }}>Text</label>
        <input
          className="form-input"
          style={{ flex: 1, fontSize: 12, padding: '4px 8px' }}
          placeholder="Eigener Text…"
          value={el.content || ''}
          onChange={e => onChange({ content: e.target.value })}
        />
      </div>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <label className="form-label" style={{ margin: 0, minWidth: 60 }}>Ausrichtung</label>
        <AlignButtons value={el.align || 'left'} onChange={v => onChange({ align: v })} />
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, marginLeft: 8, cursor: 'pointer' }}>
          <input type="checkbox" checked={!!el.bold} onChange={e => onChange({ bold: e.target.checked })} />
          Fett
        </label>
      </div>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <label className="form-label" style={{ margin: 0, minWidth: 60 }}>Größe</label>
        <div className="type-tabs">
          <button className={`type-tab ${el.size !== 'large' ? 'active' : ''}`} onClick={() => onChange({ size: 'normal' })}>Normal</button>
          <button className={`type-tab ${el.size === 'large' ? 'active' : ''}`} onClick={() => onChange({ size: 'large' })}>Groß</button>
        </div>
      </div>
    </div>
  )
}

function DividerEditor({ el, onChange }) {
  return (
    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
      <label className="form-label" style={{ margin: 0, minWidth: 60 }}>Stil</label>
      <div className="type-tabs">
        {[
          { v: '=', label: '═══ Doppelt' },
          { v: '-', label: '─── Einfach' },
          { v: ' ', label: '· · Gepunktet' },
        ].map(({ v, label }) => (
          <button
            key={v}
            className={`type-tab ${(el.char || '=') === v ? 'active' : ''}`}
            onClick={() => onChange({ char: v })}
          >
            {label}
          </button>
        ))}
      </div>
    </div>
  )
}

function TotalEditor({ el, onChange }) {
  return (
    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
      <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, cursor: 'pointer' }}>
        <input type="checkbox" checked={!!el.bold} onChange={e => onChange({ bold: e.target.checked })} />
        Fett darstellen
      </label>
    </div>
  )
}

// ─── Element-Karte ────────────────────────────────────────────────────────────

function ElementCard({ el, index, total, onMove, onChange, onDelete }) {
  const [expanded, setExpanded] = useState(false)
  const required = REQUIRED_TYPES.has(el.type)

  const canEdit = !['spacer', 'items'].includes(el.type) || el.type === 'items'
  const hasEditor = !['spacer'].includes(el.type)

  return (
    <div
      style={{
        border: '1px solid var(--border)',
        borderRadius: 8,
        overflow: 'hidden',
        background: 'var(--card)',
        marginBottom: 6,
      }}
    >
      {/* Header row */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '8px 10px',
          cursor: hasEditor ? 'pointer' : 'default',
          userSelect: 'none',
        }}
        onClick={() => hasEditor && setExpanded(e => !e)}
      >
        <GripVertical size={14} style={{ color: 'var(--muted-foreground)', flexShrink: 0 }} />
        <span style={{ color: 'var(--muted-foreground)', flexShrink: 0 }}>{elementIcon(el.type)}</span>
        <span style={{ fontSize: 12, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {elementLabel(el)}
        </span>
        {required && (
          <span style={{ fontSize: 10, color: 'var(--muted-foreground)', background: 'var(--muted)', borderRadius: 4, padding: '1px 5px', flexShrink: 0 }}>
            Pflicht
          </span>
        )}
        <div style={{ display: 'flex', gap: 2, flexShrink: 0 }} onClick={e => e.stopPropagation()}>
          <button className="btn btn-ghost btn-sm" style={{ padding: '3px 5px' }}
            onClick={() => onMove(-1)} disabled={index === 0}>
            <ChevronUp size={13} />
          </button>
          <button className="btn btn-ghost btn-sm" style={{ padding: '3px 5px' }}
            onClick={() => onMove(1)} disabled={index === total - 1}>
            <ChevronDown size={13} />
          </button>
          {!required && (
            <button className="btn btn-ghost btn-sm" style={{ padding: '3px 5px', color: 'var(--destructive)' }}
              onClick={() => onDelete()}>
              <Trash2 size={13} />
            </button>
          )}
        </div>
      </div>

      {/* Editor */}
      {expanded && hasEditor && (
        <div style={{ padding: '10px 12px 12px', borderTop: '1px solid var(--border)', background: 'var(--muted)', display: 'flex', flexDirection: 'column', gap: 8 }}>
          {el.type === 'compound' && <CompoundEditor el={el} onChange={onChange} />}
          {el.type === 'field'    && <FieldEditor    el={el} onChange={onChange} />}
          {el.type === 'text'     && <TextEditor     el={el} onChange={onChange} />}
          {el.type === 'divider'  && <DividerEditor  el={el} onChange={onChange} />}
          {el.type === 'total'    && <TotalEditor     el={el} onChange={onChange} />}
        </div>
      )}
    </div>
  )
}

// ─── Element hinzufügen ───────────────────────────────────────────────────────

const ADD_OPTIONS = [
  { type: 'compound', label: 'Mehrspaltiger Eintrag',   desc: 'Bis zu 3 Datenfelder nebeneinander' },
  { type: 'field',    label: 'Einzelnes Feld',           desc: 'Ein Datenfeld mit optionalem Label' },
  { type: 'text',     label: 'Benutzerdefinierter Text', desc: 'Eigener statischer Text' },
  { type: 'divider',  label: 'Trennlinie',               desc: 'Horizontale Linie (=, –, ···)' },
  { type: 'spacer',   label: 'Leerzeile',                desc: 'Vertikaler Abstand' },
]

function makeDefault(type) {
  switch (type) {
    case 'compound': return { id: uid(), type, bold: false, size: 'normal', cols: [{ field: 'table', prefix: '' }] }
    case 'field':    return { id: uid(), type, field: 'table', label: '', align: 'left', bold: false, size: 'normal' }
    case 'text':     return { id: uid(), type, content: '', align: 'left', bold: false, size: 'normal' }
    case 'divider':  return { id: uid(), type, char: '-' }
    case 'spacer':   return { id: uid(), type }
    default:         return { id: uid(), type }
  }
}

function AddElementMenu({ onAdd }) {
  const [open, setOpen] = useState(false)

  return (
    <div style={{ position: 'relative' }}>
      <button
        className="btn btn-secondary"
        style={{ width: '100%', justifyContent: 'center', gap: 6 }}
        onClick={() => setOpen(o => !o)}
      >
        <Plus size={14} /> Element hinzufügen
      </button>
      {open && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0,
          background: 'var(--popover)', border: '1px solid var(--border)', borderRadius: 8,
          boxShadow: '0 8px 24px rgba(0,0,0,.15)', zIndex: 50, overflow: 'hidden',
        }}>
          {ADD_OPTIONS.map(opt => (
            <button
              key={opt.type}
              style={{
                display: 'flex', flexDirection: 'column', alignItems: 'flex-start',
                width: '100%', padding: '8px 12px', background: 'none', border: 'none',
                cursor: 'pointer', textAlign: 'left', gap: 2,
              }}
              onMouseEnter={e => e.currentTarget.style.background = 'var(--muted)'}
              onMouseLeave={e => e.currentTarget.style.background = 'none'}
              onClick={() => { onAdd(makeDefault(opt.type)); setOpen(false) }}
            >
              <span style={{ fontSize: 12, fontWeight: 600 }}>{opt.label}</span>
              <span style={{ fontSize: 11, color: 'var(--muted-foreground)' }}>{opt.desc}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Vorschau-Panel ───────────────────────────────────────────────────────────

function BonPreview({ layout, barName }) {
  const lines = renderPreview(layout, barName)

  return (
    <div style={{
      background: '#fff',
      border: '1px solid #ddd',
      borderRadius: 6,
      padding: '12px 10px',
      fontFamily: "'Courier New', monospace",
      fontSize: 11,
      lineHeight: 1.5,
      color: '#000',
      maxWidth: 340,
      margin: '0 auto',
      boxShadow: '0 2px 8px rgba(0,0,0,.08)',
    }}>
      {lines.map((line, i) => (
        <div key={i} style={{
          fontWeight: line.bold ? 700 : 400,
          fontSize: line.large ? 13 : 11,
          fontStyle: line.italic ? 'italic' : 'normal',
          color: line.divider ? '#555' : '#000',
          whiteSpace: 'pre',
          overflow: 'hidden',
        }}>
          {line.text || ' '}
        </div>
      ))}
    </div>
  )
}

// ─── Hauptkomponente ──────────────────────────────────────────────────────────

export default function LayoutEditor({ config, onSave }) {
  const [layout, setLayout] = useState(() => {
    if (Array.isArray(config?.bonLayout) && config.bonLayout.length > 0) {
      return config.bonLayout
    }
    return DEFAULT_LAYOUT
  })
  const [saving, setSaving]       = useState(false)
  const [saved, setSaved]         = useState(false)
  const [importError, setImportError] = useState('')

  const barName = config?.barName || 'BAR'

  function move(index, dir) {
    const next = [...layout]
    const target = index + dir
    if (target < 0 || target >= next.length) return
    ;[next[index], next[target]] = [next[target], next[index]]
    setLayout(next)
    setSaved(false)
  }

  function update(index, patch) {
    setLayout(prev => prev.map((el, i) => i === index ? { ...el, ...patch } : el))
    setSaved(false)
  }

  function remove(index) {
    setLayout(prev => prev.filter((_, i) => i !== index))
    setSaved(false)
  }

  function addElement(el) {
    setLayout(prev => [...prev, el])
    setSaved(false)
  }

  function resetToDefault() {
    setLayout(DEFAULT_LAYOUT)
    setSaved(false)
  }

  async function handleSave() {
    setSaving(true)
    const newConfig = { ...config, bonLayout: layout }
    await window.electron.saveConfig(newConfig)
    onSave?.(newConfig)
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 3000)
  }

  async function handleExport() {
    await window.electron.exportLayout(layout)
  }

  async function handleImport() {
    setImportError('')
    const result = await window.electron.importLayout()
    if (result.canceled) return
    if (!result.success) {
      setImportError(result.error || 'Fehler beim Importieren')
      return
    }
    setLayout(result.layout)
    setSaved(false)
  }

  return (
    <div className="settings-panel">
      {/* Header */}
      <div className="settings-panel-header">
        <div>
          <div className="page-title">Bon-Layout</div>
          <div className="page-subtitle">Anordnung und Inhalt des gedruckten Bons anpassen</div>
        </div>
        <div style={{ display: 'flex', gap: 8, flexShrink: 0, flexWrap: 'wrap' }}>
          <button className="btn btn-secondary" style={{ gap: 6 }} onClick={handleImport} title="Layout aus JSON-Datei laden">
            <Upload size={13} /> Importieren
          </button>
          <button className="btn btn-secondary" style={{ gap: 6 }} onClick={handleExport} title="Layout als JSON-Datei speichern">
            <Download size={13} /> Exportieren
          </button>
          <button className="btn btn-secondary" style={{ gap: 6 }} onClick={resetToDefault}>
            <RotateCcw size={13} /> Standard
          </button>
          <button className="btn btn-primary" style={{ gap: 6 }} onClick={handleSave} disabled={saving}>
            {saving
              ? 'Speichern…'
              : saved
                ? '✓ Gespeichert'
                : <><Save size={13} /> Speichern</>
            }
          </button>
        </div>
      </div>

      {importError && (
        <div className="alert error" style={{ marginBottom: 12 }}>
          <span style={{ fontWeight: 600 }}>Import fehlgeschlagen:</span> {importError}
        </div>
      )}

      {/* Body: 2-column layout */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 360px', gap: 20, alignItems: 'start' }}>

        {/* Left: Element-Liste */}
        <div>
          <div className="card">
            <div className="card-header">
              <div className="card-icon"><Layout size={15} /></div>
              <div>
                <div className="card-title-text">Elemente</div>
                <div className="card-description">Reihenfolge durch Pfeile ändern · Klick zum Bearbeiten</div>
              </div>
            </div>

            <div>
              {layout.map((el, i) => (
                <ElementCard
                  key={el.id}
                  el={el}
                  index={i}
                  total={layout.length}
                  onMove={dir => move(i, dir)}
                  onChange={patch => update(i, patch)}
                  onDelete={() => remove(i)}
                />
              ))}
            </div>

            <div style={{ marginTop: 8 }}>
              <AddElementMenu onAdd={addElement} />
            </div>
          </div>

          {/* Feldreferenz */}
          <div className="card" style={{ marginTop: 12 }}>
            <div className="card-header">
              <div className="card-icon"><Hash size={15} /></div>
              <div>
                <div className="card-title-text">Verfügbare Felder</div>
                <div className="card-description">Diese Werte werden beim Drucken automatisch befüllt</div>
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px 12px' }}>
              {FIELD_OPTIONS.map(f => (
                <div key={f.value} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '3px 0' }}>
                  <code style={{ fontSize: 10, background: 'var(--muted)', padding: '1px 5px', borderRadius: 3, color: 'var(--muted-foreground)' }}>
                    {f.value}
                  </code>
                  <span style={{ fontSize: 12 }}>{f.label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right: Vorschau */}
        <div style={{ position: 'sticky', top: 20 }}>
          <div className="card">
            <div className="card-header">
              <div className="card-icon"><Eye size={15} /></div>
              <div>
                <div className="card-title-text">Vorschau</div>
                <div className="card-description">Beispiel-Bon mit Musterdaten</div>
              </div>
            </div>
            <BonPreview layout={layout} barName={barName} />
          </div>
        </div>
      </div>
    </div>
  )
}
