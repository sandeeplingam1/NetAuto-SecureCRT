import { useState, useEffect } from 'react'
import { Plus, Trash2, Play, Square, ArrowRight } from 'lucide-react'
import { useStore } from '../../store/appStore'
import './PortForwardView.css'

const api = (window as any).helixAPI

export default function PortForwardView() {
  const { portForwards, addPortForward, removePortForward, updatePortForward, tabs, sessions } = useStore()
  const [form, setForm] = useState({
    sessionId: '', type: 'local' as 'local' | 'remote',
    localPort: 8080, remoteHost: '', remotePort: 80,
  })
  const [adding, setAdding] = useState(false)

  const connectedTabs = tabs.filter(t => t.isConnected && t.sessionId)

  const start = async (pf: typeof portForwards[0]) => {
    const result = await api?.portFwdStart({
      sessionId: pf.sessionId, type: pf.type,
      localPort: pf.localPort, remoteHost: pf.remoteHost, remotePort: pf.remotePort,
    })
    if (result?.ok) updatePortForward(pf.id, { active: true })
  }

  const stop = async (pf: typeof portForwards[0]) => {
    await api?.portFwdStop({ sessionId: pf.sessionId, localPort: pf.localPort })
    updatePortForward(pf.id, { active: false })
  }

  const addForward = () => {
    if (!form.sessionId || !form.remoteHost) return
    addPortForward({ ...form, active: false })
    setForm({ sessionId: '', type: 'local', localPort: 8080, remoteHost: '', remotePort: 80 })
    setAdding(false)
  }

  const getSessionName = (id: string) => {
    const tab = tabs.find(t => t.sessionId === id)
    return tab?.title || sessions.find(s => s.id === id)?.name || id
  }

  return (
    <div className="pf-view">
      <div className="pf-header">
        <div>
          <h2>Port Forwarding</h2>
          <p>Forward local ports through active SSH connections</p>
        </div>
        <button className="btn-primary" onClick={() => setAdding(a => !a)}><Plus size={13} /> Add Forward</button>
      </div>

      {adding && (
        <div className="pf-form animate-fade-in">
          <div className="pf-form-row">
            <div className="pf-field">
              <label>Session</label>
              <select value={form.sessionId} onChange={e => setForm(f => ({ ...f, sessionId: e.target.value }))}>
                <option value="">Select connected session…</option>
                {connectedTabs.map(t => (
                  <option key={t.sessionId} value={t.sessionId!}>{t.title}</option>
                ))}
              </select>
            </div>
            <div className="pf-field">
              <label>Type</label>
              <select value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value as any }))}>
                <option value="local">Local → Remote</option>
                <option value="remote">Remote → Local</option>
              </select>
            </div>
          </div>
          <div className="pf-form-row three-col">
            <div className="pf-field">
              <label>Local Port</label>
              <input type="number" value={form.localPort}
                onChange={e => setForm(f => ({ ...f, localPort: parseInt(e.target.value) || 8080 }))} />
            </div>
            <div className="pf-field">
              <label>Remote Host</label>
              <input placeholder="127.0.0.1" value={form.remoteHost}
                onChange={e => setForm(f => ({ ...f, remoteHost: e.target.value }))} className="font-mono" />
            </div>
            <div className="pf-field">
              <label>Remote Port</label>
              <input type="number" value={form.remotePort}
                onChange={e => setForm(f => ({ ...f, remotePort: parseInt(e.target.value) || 80 }))} />
            </div>
          </div>
          <div className="pf-form-actions">
            <button className="btn-secondary" onClick={() => setAdding(false)}>Cancel</button>
            <button className="btn-primary" onClick={addForward}
              disabled={!form.sessionId || !form.remoteHost}>Add Forward</button>
          </div>
        </div>
      )}

      {portForwards.length === 0 ? (
        <div className="pf-empty">
          <ArrowRight size={28} strokeWidth={1.5} />
          <p>No port forwards. Tunnel local ports through SSH for secure database access, web UIs, and more.</p>
        </div>
      ) : (
        <div className="pf-list">
          {portForwards.map(pf => (
            <div key={pf.id} className={`pf-row ${pf.active ? 'active' : ''}`}>

              <div className="pf-route font-mono">
                localhost:{pf.localPort}
                <ArrowRight size={12} className="pf-arrow" />
                {pf.remoteHost}:{pf.remotePort}
              </div>
              <div className="pf-session">{getSessionName(pf.sessionId)}</div>
              <div className="pf-type-tag">{pf.type}</div>
              <div className="pf-actions">
                {pf.active
                  ? <button className="pf-btn stop" onClick={() => stop(pf)} title="Stop"><Square size={11} /></button>
                  : <button className="pf-btn start" onClick={() => start(pf)} title="Start"><Play size={11} /></button>
                }
                <button className="pf-btn rm" onClick={() => { stop(pf); removePortForward(pf.id) }} title="Delete">
                  <Trash2 size={11} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
