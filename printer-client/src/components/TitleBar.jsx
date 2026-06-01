import { Minus, Square, X } from 'lucide-react'

export default function TitleBar({ barName }) {
  return (
    <div className="titlebar">
      <div className="titlebar-left">
      <div class="titlebar-logo">
        <span class="logo-mark">HGV</span>
        <span class="logo-text">Bestellsystem</span>
      </div>
        <div className="titlebar-title">
          <span className='titlebar-sub'> Druckerclient</span>
          {barName && <span className="bar-label"> · {barName}</span>}
        </div>
      </div>

      <div className="titlebar-controls">
        <button className="titlebar-btn" onClick={() => window.electron.minimize()} title="Minimieren">
          <Minus size={12} />
        </button>
        <button className="titlebar-btn" onClick={() => window.electron.maximize()} title="Maximieren">
          <Square size={11} />
        </button>
        <button className="titlebar-btn close" onClick={() => window.electron.close()} title="In Taskleiste">
          <X size={12} />
        </button>
      </div>
    </div>
  )
}
