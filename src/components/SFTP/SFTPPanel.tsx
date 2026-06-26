import { useState, useEffect, useCallback } from 'react'
import { FolderOpen, File, Upload, Download, RefreshCw, ChevronRight, ArrowLeft, Home, HardDrive } from 'lucide-react'
import { useStore } from '../../store/appStore'
import './SFTPPanel.css'

interface FileEntry {
  name: string
  isDir: boolean
  size: number
  modified: number
  mode: number
}

function formatSize(bytes: number) {
  if (bytes < 1024)     return `${bytes}B`
  if (bytes < 1048576)  return `${(bytes/1024).toFixed(1)}K`
  if (bytes < 1073741824) return `${(bytes/1048576).toFixed(1)}M`
  return `${(bytes/1073741824).toFixed(1)}G`
}

function formatDate(ts: number) {
  return new Date(ts).toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}

export default function SFTPPanel() {
  const { tabs, activeTabId, sessions } = useStore()
  const activeTab = tabs.find(t => t.id === activeTabId)
  const session   = activeTab?.sessionId ? sessions.find(s => s.id === activeTab.sessionId) : null

  const [path, setPath]       = useState('/')
  const [entries, setEntries] = useState<FileEntry[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState<string | null>(null)
  const [history, setHistory] = useState<string[]>([])

  const api = (window as any).helixAPI

  const loadDir = useCallback(async (dirPath: string) => {
    if (!api || !activeTab?.isConnected || !session) {
      setError(activeTab?.isConnected ? null : 'Connect to a session first to browse files.')
      return
    }
    setLoading(true)
    setError(null)
    const result = await api.sftpList({ sessionId: activeTab.ptyId, remotePath: dirPath })
    setLoading(false)
    if (result?.error) {
      setError(result.error)
    } else {
      const sorted = [...(result.entries || [])].sort((a: FileEntry, b: FileEntry) => {
        if (a.isDir !== b.isDir) return a.isDir ? -1 : 1
        return a.name.localeCompare(b.name)
      })
      setEntries(sorted)
      setPath(dirPath)
    }
  }, [api, activeTab, session])

  useEffect(() => { if (activeTab?.isConnected) loadDir('/') }, [activeTab?.isConnected])

  const navigate = (entry: FileEntry) => {
    if (!entry.isDir) return
    setHistory(h => [...h, path])
    loadDir(path === '/' ? `/${entry.name}` : `${path}/${entry.name}`)
  }

  const goBack = () => {
    const prev = history[history.length - 1] || '/'
    setHistory(h => h.slice(0, -1))
    loadDir(prev)
  }

  const goHome = () => { setHistory([]); loadDir('/') }

  const download = async (entry: FileEntry) => {
    if (!api || entry.isDir) return
    const remotePath = path === '/' ? `/${entry.name}` : `${path}/${entry.name}`
    await api.sftpDownload({ sessionId: activeTab?.ptyId, remotePath })
  }

  const upload = async () => {
    if (!api) return
    await api.sftpUpload({ sessionId: activeTab?.ptyId, remotePath: path })
    loadDir(path)
  }

  const breadcrumbs = path.split('/').filter(Boolean)

  if (!activeTab?.sessionId) {
    return (
      <div className="sftp-empty">
        <HardDrive size={28} strokeWidth={1.5} />
        <div>Open an SSH session to browse files</div>
      </div>
    )
  }

  if (!activeTab.isConnected) {
    return (
      <div className="sftp-empty">
        <HardDrive size={28} strokeWidth={1.5} />
        <div>Connect to a session first</div>
      </div>
    )
  }

  return (
    <div className="sftp-panel">
      {/* Toolbar */}
      <div className="sftp-toolbar">
        <button className="sftp-btn" onClick={goBack}  disabled={history.length === 0} title="Back"><ArrowLeft size={13} /></button>
        <button className="sftp-btn" onClick={goHome}  title="Home"><Home size={13} /></button>
        <button className="sftp-btn" onClick={() => loadDir(path)} title="Refresh"><RefreshCw size={13} className={loading ? 'animate-spin' : ''} /></button>

        {/* Breadcrumbs */}
        <div className="sftp-breadcrumbs">
          <button className="sftp-crumb" onClick={goHome}>/</button>
          {breadcrumbs.map((seg, i) => (
            <span key={i} className="sftp-crumb-wrap">
              <ChevronRight size={11} />
              <button className="sftp-crumb" onClick={() => {
                const p = '/' + breadcrumbs.slice(0, i + 1).join('/')
                setHistory(h => [...h, path])
                loadDir(p)
              }}>{seg}</button>
            </span>
          ))}
        </div>

        <button className="sftp-btn upload" onClick={upload} title="Upload file">
          <Upload size={13} /> Upload
        </button>
      </div>

      {/* File list */}
      {error ? (
        <div className="sftp-error">{error}</div>
      ) : (
        <div className="sftp-list scrollable">
          {entries.length === 0 && !loading && (
            <div className="sftp-empty-dir">Empty directory</div>
          )}
          {entries.map(entry => (
            <div
              key={entry.name}
              className={`sftp-entry ${entry.isDir ? 'dir' : ''}`}
              onDoubleClick={() => navigate(entry)}
            >
              <span className="sftp-entry-icon">
                {entry.isDir ? <FolderOpen size={13} /> : <File size={13} />}
              </span>
              <span className="sftp-entry-name truncate">{entry.name}</span>
              <span className="sftp-entry-size">{entry.isDir ? '' : formatSize(entry.size)}</span>
              <span className="sftp-entry-date">{formatDate(entry.modified)}</span>
              {!entry.isDir && (
                <button className="sftp-dl-btn" onClick={() => download(entry)} title="Download">
                  <Download size={11} />
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
