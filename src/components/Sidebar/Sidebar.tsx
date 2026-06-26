import { useState } from 'react'
import {
  Terminal, Monitor, FolderOpen, FileText, Settings,
  Plus, Search, X, ChevronRight, ChevronDown, Network,
  Play, Copy, Trash2, Edit3, Lock, Radio, Cpu,
  ArrowRight, Zap, Shield, GitBranch, Upload, Download
} from 'lucide-react'
import { useStore, Session, EnvTag } from '../../store/appStore'
import Logo from '../Logo/Logo'
import './Sidebar.css'

const ENV_COLORS: Record<EnvTag, string> = {
  production: 'var(--env-prod)', staging: 'var(--env-staging)',
  lab: 'var(--env-lab)', dev: 'var(--env-dev)', none: 'var(--text-muted)',
}
const ENV_LABELS: Record<EnvTag, string> = {
  production: 'PROD', staging: 'STG', lab: 'LAB', dev: 'DEV', none: '',
}

function ProtocolIcon({ protocol }: { protocol: string }) {
  if (protocol === 'SSH')    return <Lock  size={10} className="proto-icon" />
  if (protocol === 'Telnet') return <Radio size={10} className="proto-icon" />
  return <Cpu size={10} className="proto-icon" />
}

function groupSessions(sessions: Session[]) {
  const groups: Record<string, Session[]> = {}
  sessions.forEach(s => {
    const g = s.group || 'Ungrouped'
    if (!groups[g]) groups[g] = []
    groups[g].push(s)
  })
  return groups
}

function timeAgo(ts?: number) {
  if (!ts) return ''
  const diff = Date.now() - ts
  if (diff < 60000)    return 'just now'
  if (diff < 3600000)  return `${Math.floor(diff / 60000)}m`
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h`
  return `${Math.floor(diff / 86400000)}d`
}

const NAV_ITEMS = [
  { id: 'terminal', Icon: Terminal,    label: 'Terminal Workspace' },
  { id: 'topology', Icon: Network,     label: 'Topology Map' },
  { id: 'sftp',     Icon: FolderOpen,  label: 'SFTP' },
  { id: 'portfwd',  Icon: ArrowRight,  label: 'Port Forwarding' },
  { id: 'macros',   Icon: Zap,         label: 'Macros' },
  { id: 'hosts',    Icon: Shield,      label: 'Known Hosts' },
  { id: 'logs',     Icon: FileText,    label: 'Session Logs' },
  { id: 'settings', Icon: Settings,    label: 'Settings' },
]

export default function Sidebar() {
  const {
    sessions, selectedSessionId, selectSession, addTab,
    activeView, setActiveView, setShowNewSessionModal,
    setEditingSession, deleteSession, cloneSession,
  } = useStore()

  const api = (window as any).helixAPI

  const [search, setSearch]         = useState('')
  const [collapsed, setCollapsed]   = useState<Record<string, boolean>>({})
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; session: Session } | null>(null)

  const filtered = sessions.filter(s =>
    s.name.toLowerCase().includes(search.toLowerCase()) ||
    s.host.toLowerCase().includes(search.toLowerCase()) ||
    s.group.toLowerCase().includes(search.toLowerCase())
  )
  const groups = groupSessions(filtered)

  const handleConnect = (session: Session) => {
    selectSession(session.id)
    addTab(session.id)
    setActiveView('terminal')
  }

  const handleContextMenu = (e: React.MouseEvent, session: Session) => {
    e.preventDefault()
    setContextMenu({ x: e.clientX, y: e.clientY, session })
  }

  const handleExport = async () => {
    await api?.sessionsExport({ sessions })
  }

  const handleImport = async () => {
    const result = await api?.sessionsImport()
    if (result?.sessions) {
      useStore.getState().importSessions(result.sessions)
    }
  }

  const handleImportSecureCRT = async () => {
    const result = await api?.sessionsImportSecureCRT()
    if (result?.sessions) {
      useStore.getState().importSessions(result.sessions)
    }
  }

  const closeContext = () => setContextMenu(null)

  return (
    <aside className="sidebar" onClick={closeContext}>

      {/* Logo */}
      <div className="sidebar-logo">
        <div className="logo-mark">
          <Logo size={18} />
        </div>
        <span className="logo-text">Helix</span>
      </div>

      {/* Nav */}
      <nav className="sidebar-nav">
        {NAV_ITEMS.map(({ id, Icon, label }) => (
          <button
            key={id}
            className={`nav-btn ${activeView === id ? 'active' : ''}`}
            onClick={() => setActiveView(id as any)}
            title={label}
          >
            <Icon size={15} strokeWidth={1.75} />
            <span>{label}</span>
          </button>
        ))}
      </nav>

      {/* Sessions Panel */}
      <div className="sessions-panel">
        <div className="sessions-header">
          <span className="section-label">Sessions</span>
          <div className="sessions-header-actions">
            <button className="icon-btn" onClick={handleImport} data-tooltip="Import JSON">
              <Upload size={12} />
            </button>
            <button className="icon-btn" onClick={handleImportSecureCRT} data-tooltip="Import SecureCRT (.ini)">
              <FolderOpen size={12} />
            </button>
            <button className="icon-btn" onClick={handleExport} data-tooltip="Export Sessions">
              <Download size={12} />
            </button>
            <button className="icon-btn" onClick={() => setShowNewSessionModal(true)} data-tooltip="New Session">
              <Plus size={14} />
            </button>
          </div>
        </div>

        <div className="search-wrap">
          <Search size={12} className="search-icon" />
          <input
            className="search-input"
            placeholder="Search sessions..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          {search && (
            <button className="search-clear" onClick={() => setSearch('')}>
              <X size={11} />
            </button>
          )}
        </div>

        <div className="session-groups scrollable">
          {Object.entries(groups).map(([group, items]) => (
            <div key={group} className="group">
              <button
                className="group-header"
                onClick={() => setCollapsed(c => ({ ...c, [group]: !c[group] }))}
              >
                {collapsed[group]
                  ? <ChevronRight size={11} className="chevron" />
                  : <ChevronDown  size={11} className="chevron" />
                }
                <span className="group-name truncate">{group}</span>
                <span className="group-count">{items.length}</span>
              </button>

              {!collapsed[group] && items.map(session => (
                <div key={session.id}
                  className={`session-item ${selectedSessionId === session.id ? 'selected' : ''}`}
                  onClick={() => selectSession(session.id)}
                  onDoubleClick={() => handleConnect(session)}
                  onContextMenu={e => handleContextMenu(e, session)}
                  style={{ borderLeftColor: ENV_COLORS[session.env], borderLeftWidth: session.env !== 'none' ? '2px' : '0', borderLeftStyle: 'solid' }}
                >
                  <div className="session-info min-w-0">
                    <div className="session-name truncate">
                      <ProtocolIcon protocol={session.protocol} />
                      {session.name}
                    </div>
                    <div className="session-host truncate font-mono">
                      {session.username && `${session.username}@`}{session.host}
                      {session.lastConnected && (
                        <span className="session-time"> · {timeAgo(session.lastConnected)}</span>
                      )}
                    </div>
                  </div>
                  {session.env !== 'none' && (
                    <span className="env-badge" style={{ color: ENV_COLORS[session.env] }}>
                      {ENV_LABELS[session.env]}
                    </span>
                  )}
                  {session.jumpHost && (
                    <span title="Uses jump host"><GitBranch size={10} className="jump-icon" /></span>
                  )}
                  <button
                    className="connect-btn"
                    onClick={e => { e.stopPropagation(); handleConnect(session) }}
                    title="Connect"
                  >
                    <Play size={9} fill="currentColor" />
                  </button>
                </div>
              ))}
            </div>
          ))}

          {filtered.length === 0 && (
            <div className="empty-state">
              <div className="empty-state-icon"><Monitor size={16} strokeWidth={1.5} /></div>
              {!search ? (
                <>
                  <p>No sessions yet.<br/>Add your first device to get started.</p>
                  <button className="empty-link" onClick={() => setShowNewSessionModal(true)}>
                    <Plus size={12} /> New Session
                  </button>
                </>
              ) : (
                <p>No sessions match your search.</p>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Context Menu */}
      {contextMenu && (
        <div
          className="context-menu glass animate-fade-in"
          style={{ left: contextMenu.x, top: contextMenu.y }}
          onClick={e => e.stopPropagation()}
        >
          <button onClick={() => { handleConnect(contextMenu.session); closeContext() }}>
            <Play size={13} /> Connect
          </button>
          <button onClick={() => { addTab(contextMenu.session.id); closeContext() }}>
            <Plus size={13} /> Open in New Tab
          </button>
          <div className="context-divider" />
          <button onClick={() => { setEditingSession(contextMenu.session); closeContext() }}>
            <Edit3 size={13} /> Edit Session
          </button>
          <button onClick={() => { cloneSession(contextMenu.session.id); closeContext() }}>
            <Copy size={13} /> Clone Session
          </button>
          <button onClick={() => { navigator.clipboard.writeText(contextMenu.session.host); closeContext() }}>
            <Copy size={13} /> Copy Hostname
          </button>
          <div className="context-divider" />
          <button className="danger" onClick={() => { deleteSession(contextMenu.session.id); closeContext() }}>
            <Trash2 size={13} /> Delete
          </button>
        </div>
      )}
    </aside>
  )
}
