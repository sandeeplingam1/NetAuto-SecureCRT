import { useState, useEffect } from 'react'
import { Trash2, Shield, RefreshCw } from 'lucide-react'
import './KnownHostsView.css'

const api = (window as any).helixAPI

interface KnownHost { key: string; host: string; port: string; fingerprint: string }

export default function KnownHostsView() {
  const [hosts, setHosts] = useState<KnownHost[]>([])
  const [loading, setLoading] = useState(true)

  const load = async () => {
    setLoading(true)
    const raw = await api?.hostsList() || {}
    const list = Object.entries(raw as Record<string, string>).map(([key, fingerprint]) => {
      const [host, port] = key.split(':')
      return { key, host, port, fingerprint }
    })
    setHosts(list.sort((a, b) => a.host.localeCompare(b.host)))
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const remove = async (key: string) => {
    await api?.hostsDelete({ key })
    setHosts(h => h.filter(x => x.key !== key))
  }

  return (
    <div className="kh-view">
      <div className="kh-header">
        <div>
          <h2>Known Hosts</h2>
          <p>SSH host keys trusted by Helix. Remove a key if a server's fingerprint has changed.</p>
        </div>
        <button className="btn-secondary" onClick={load}><RefreshCw size={13} /> Refresh</button>
      </div>

      {loading ? (
        <div className="kh-loading">Loading…</div>
      ) : hosts.length === 0 ? (
        <div className="kh-empty">
          <Shield size={28} strokeWidth={1.5} />
          <p>No trusted hosts yet. They'll appear here when you connect to new SSH servers.</p>
        </div>
      ) : (
        <div className="kh-table">
          <div className="kh-thead">
            <span>Host</span><span>Port</span><span>Fingerprint (SHA-256)</span><span />
          </div>
          {hosts.map(h => (
            <div key={h.key} className="kh-row">
              <span className="font-mono kh-host">{h.host}</span>
              <span className="font-mono kh-port">{h.port}</span>
              <span className="font-mono kh-fp">{h.fingerprint.match(/.{1,8}/g)?.join(':')}</span>
              <button className="kh-rm" onClick={() => remove(h.key)} title="Remove trust">
                <Trash2 size={12} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
