import { useState } from 'react'
import { Radio, X, Send } from 'lucide-react'
import { useStore } from '../../store/appStore'
import './BroadcastBar.css'

export default function BroadcastBar() {
  const { broadcastMode, toggleBroadcast, tabs } = useStore()
  const [cmd, setCmd] = useState('')
  const api = (window as any).helixAPI

  if (!broadcastMode) return null

  const connectedTabs = tabs.filter(t => t.isConnected)

  const send = () => {
    if (!cmd.trim() || !api) return
    const ids = connectedTabs.map(t => t.ptyId)
    api.terminalBroadcast({ ids, data: cmd + '\n' })
    setCmd('')
  }

  return (
    <div className="broadcast-bar">
      <div className="bc-left">
        <Radio size={13} className="bc-icon" />
        <span className="bc-label">Broadcast</span>
        <span className="bc-count">{connectedTabs.length} sessions</span>
      </div>
      <input
        className="bc-input font-mono"
        placeholder="Command to send to all connected sessions…"
        value={cmd}
        onChange={e => setCmd(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter') send() }}
        autoFocus
      />
      <button className="bc-send" onClick={send} disabled={!cmd.trim()}>
        <Send size={12} /> Send
      </button>
      <button className="bc-close" onClick={toggleBroadcast} title="Exit broadcast mode">
        <X size={13} />
      </button>
    </div>
  )
}
