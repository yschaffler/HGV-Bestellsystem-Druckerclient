import { useState, useEffect } from 'react'
import TitleBar from './components/TitleBar.jsx'
import Dashboard from './components/Dashboard.jsx'

export default function App() {
  const [config, setConfig] = useState(null)
  const [loading, setLoading] = useState(true)
  const [initialPage, setInitialPage] = useState(null)

  useEffect(() => {
    window.electron.getConfig().then((cfg) => {
      setConfig(cfg)
      setLoading(false)
    })
  }, [])

  // Tray-Menü kann direkt zur Settings-Seite navigieren
  useEffect(() => {
    window.electron.onNavigate((target) => {
      if (target === 'settings') setInitialPage('settings')
    })
  }, [])

  const handleSaveConfig = async (newConfig) => {
    await window.electron.saveConfig(newConfig)
    if (newConfig.autoStart !== undefined) {
      await window.electron.setAutostart(newConfig.autoStart)
    }
    setConfig(newConfig)
  }

  if (loading) {
    return (
      <div className="app-shell" style={{ alignItems: 'center', justifyContent: 'center' }}>
        <TitleBar barName="" />
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
          Starte…
        </div>
      </div>
    )
  }

  return (
    <div className="app-shell">
      <TitleBar barName={config?.barName} />
      <Dashboard
        config={config}
        initialPage={initialPage}
        onSaveConfig={handleSaveConfig}
      />
    </div>
  )
}
