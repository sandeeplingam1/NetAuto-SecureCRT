import { Keyboard } from 'lucide-react'
import { useStore } from '../../store/appStore'
import './StatusBar.css'

const PROVIDER_SHORT: Record<string, string> = {
  openai: 'GPT', anthropic: 'Claude', google: 'Gemini', ollama: 'Ollama'
}

export default function StatusBar() {
  const { tabs, activeTabId, aiSettings, sessions } = useStore()
  const activeTab = tabs.find(t => t.id === activeTabId)
  const session   = activeTab?.sessionId ? sessions.find(s => s.id === activeTab.sessionId) : null
  const model     = aiSettings[`${aiSettings.provider}Model` as keyof typeof aiSettings] as string

  const connStatus = activeTab?.isConnecting ? 'connecting'
    : activeTab?.isConnected ? 'connected'
    : session ? 'disconnected'
    : 'idle'

  return (
    <div className="statusbar">
      <div className="sb-left">
        {session ? (
          <>
            <span className="sb-text mono">{session.username}@{session.host}:{session.port}</span>
            <span className="sb-sep">·</span>
            <span className="sb-text">{session.protocol}</span>
            <span className="sb-sep">·</span>
            <span className={`sb-text ${connStatus}`}>
              {connStatus === 'connecting' ? 'Connecting…' : connStatus === 'connected' ? 'Connected' : 'Disconnected'}
            </span>
            {activeTab?.logPath && (
              <>
                <span className="sb-sep">·</span>
                <span className="sb-text log-active">Logging</span>
              </>
            )}
          </>
        ) : (
          <>
            <span className="sb-text muted">No active session</span>
          </>
        )}
      </div>

      <div className="sb-center">
        <span className="sb-brand">Helix</span>
      </div>

      <div className="sb-right">
        <span className="sb-ai-pill">
          {PROVIDER_SHORT[aiSettings.provider]} · {model}
        </span>
        <span className="sb-sep">·</span>
        <span className="sb-text">UTF-8</span>
        <span className="sb-sep">·</span>
        <span className="sb-text"><Keyboard size={10} style={{ display:'inline', verticalAlign:'middle' }} /> ⌘K</span>
        <span className="sb-sep">·</span>
        <span className="sb-text">{tabs.length} tab{tabs.length !== 1 ? 's' : ''}</span>
      </div>
    </div>
  )
}

