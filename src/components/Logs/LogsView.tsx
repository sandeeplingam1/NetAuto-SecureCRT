import { useState, useEffect } from 'react'
import { FileText, FolderOpen, RefreshCw, Download, Trash2, Clock, HardDrive } from 'lucide-react'
import './LogsView.css'

const api = (window as any).helixAPI

interface LogEntry { name: string; path: string; size: number; mtime: number }

function fmtSize(b: number) {
  if (b < 1024) return `${b}B`
  if (b < 1048576) return `${(b/1024).toFixed(1)}K`
  return `${(b/1048576).toFixed(1)}M`
}

export default function LogsView() {
  const [logs, setLogs] = useState<LogEntry[]>([])
  const [loading, setLoading] = useState(true)

  const load = async () => {
    setLoading(true)
    const result = await api?.logList() || []
    setLogs(result)
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  return (
    <div className="logs-view-full">
      <div className="lv-header">
        <div>
          <h2>Session Logs</h2>
          <p>Auto-saved terminal session recordings</p>
        </div>
        <div className="lv-actions">
          <button className="btn-secondary" onClick={load}><RefreshCw size={13} /> Refresh</button>
          <button className="btn-secondary" onClick={() => api?.logOpenDir()}>
            <FolderOpen size={13} /> Open Folder
          </button>
        </div>
      </div>

      {loading ? (
        <div className="lv-loading">Loading logs…</div>
      ) : logs.length === 0 ? (
        <div className="lv-empty">
          <FileText size={28} strokeWidth={1.5} />
          <p>No logs yet. Start a session and click the <strong>Log</strong> button in the session bar.</p>
        </div>
      ) : (
        <div className="lv-list">
          <div className="lv-thead">
            <span>Filename</span><span>Size</span><span>Date</span>
          </div>
          {logs.map(log => (
            <div key={log.path} className="lv-row">
              <FileText size={13} className="lv-icon" />
              <span className="lv-name truncate font-mono">{log.name}</span>
              <span className="lv-size"><HardDrive size={11} /> {fmtSize(log.size)}</span>
              <span className="lv-date"><Clock size={11} /> {new Date(log.mtime).toLocaleString()}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
