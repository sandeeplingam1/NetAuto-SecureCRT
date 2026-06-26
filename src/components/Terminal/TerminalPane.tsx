import { useEffect, useRef, useCallback, useState } from 'react'
import { Terminal } from '@xterm/xterm'
import { FitAddon }      from '@xterm/addon-fit'
import { WebLinksAddon } from '@xterm/addon-web-links'
import { SearchAddon }   from '@xterm/addon-search'
import { LogOut, FileText, FolderOpen, Wifi, WifiOff, Search, X } from 'lucide-react'
import { useStore, Tab } from '../../store/appStore'
import '@xterm/xterm/css/xterm.css'
import './TerminalPane.css'

const ENV_COLOR: Record<string, string> = {
  production: 'var(--env-prod)',
  staging:    'var(--env-staging)',
  lab:        'var(--env-lab)',
  dev:        'var(--env-dev)',
  none:       'var(--text-muted)',
}

const XTERM_THEME = {
  background:          '#0a0e17',
  foreground:          '#e2e8f0',
  cursor:              '#60a5fa',
  cursorAccent:        '#0a0e17',
  selectionBackground: 'rgba(59,130,246,0.25)',
  black:   '#3d4f66', red:     '#ef4444',
  green:   '#22c55e', yellow:  '#f59e0b',
  blue:    '#60a5fa', magenta: '#a78bfa',
  cyan:    '#14b8a6', white:   '#b0bec5',
  brightBlack:   '#546070', brightRed:    '#f87171',
  brightGreen:   '#4ade80', brightYellow: '#fbbf24',
  brightBlue:    '#93c5fd', brightMagenta:'#c4b5fd',
  brightCyan:    '#5eead4', brightWhite:  '#f1f5f9',
}

interface Props { tab: Tab }

export default function TerminalPane({ tab }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const termRef      = useRef<Terminal | null>(null)
  const fitRef       = useRef<FitAddon | null>(null)
  const searchRef    = useRef<SearchAddon | null>(null)
  const unsubsRef    = useRef<Array<() => void>>([])

  const [showSearch, setShowSearch] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')

  const { sessions, updateTab, appendOutput, setPendingInsert, pendingInsert, activeTabId } = useStore()
  const session = tab.sessionId ? sessions.find(s => s.id === tab.sessionId) : null

  const api = (window as any).helixAPI

  // ── Write data into xterm ──────────────────────────────────────────────────
  const writeToTerm = useCallback((data: string) => {
    termRef.current?.write(data)
    appendOutput(tab.id, data)
    // Log to file if logging active
    if (tab.logPath && api) {
      api.logWrite({ id: tab.ptyId, data })
    }
  }, [tab.id, tab.ptyId, tab.logPath, appendOutput, api])

  // ── Connect via SSH or local shell ─────────────────────────────────────────
  const connect = useCallback(async () => {
    if (!api) return

    updateTab(tab.id, { isConnecting: true, connectionError: null })

    let result: any

    if (session) {
      let runUser = session.username
      let runPass = session.password || ''
      let runKey = session.privateKey || ''
      let runPassphrase = session.passphrase || ''
      
      if (session.credentialId) {
        const cred = useStore.getState().credentials.find(c => c.id === session.credentialId)
        if (cred) {
          runUser = cred.username
          if (cred.authMethod === 'password') {
             runPass = (await api.keychainGet({ account: `cred-${cred.id}` })) || ''
          } else if (cred.authMethod === 'key') {
             runKey = cred.privateKey || ''
             runPassphrase = (await api.keychainGet({ account: `cred-${cred.id}-passphrase` })) || ''
          }
        }
      }

      // SSH connection
      result = await api.terminalCreateSSH({
        id:         tab.ptyId,
        host:       session.host,
        port:       session.port,
        username:   runUser,
        password:   runPass,
        privateKey: runKey,
        passphrase: runPassphrase,
        cols:       termRef.current?.cols  || 80,
        rows:       termRef.current?.rows  || 24,
        jumpHost:   session.jumpHost,
        socksProxy: session.socksProxy,
        agentForwarding: session.agentForwarding,
        verifyHost: session.verifyHost,
        keepaliveInterval: session.keepaliveInterval,
      })
    } else {
      // Local shell
      result = await api.terminalCreateLocal({
        id:   tab.ptyId,
        cols: termRef.current?.cols  || 80,
        rows: termRef.current?.rows  || 24,
      })
    }

    if (result?.error) {
      updateTab(tab.id, {
        isConnecting: false,
        isConnected:  false,
        connectionError: result.error,
      })
      termRef.current?.writeln(`\r\n\x1b[31m✖ Connection failed: ${result.error}\x1b[0m\r\n`)
      return
    }

    updateTab(tab.id, { isConnecting: false, isConnected: true })
    if (session) {
      useStore.getState().updateSession(session.id, { lastConnected: Date.now() })
    }

    // Subscribe to output
    const unsubOut  = api.onTerminalOutput(tab.ptyId, writeToTerm)
    const unsubExit = api.onTerminalExit(tab.ptyId, (code: number) => {
      termRef.current?.writeln(`\r\n\x1b[33m[Process exited with code ${code}]\x1b[0m`)
      updateTab(tab.id, { isConnected: false })
    })
    unsubsRef.current.push(unsubOut, unsubExit)
  }, [tab.id, tab.ptyId, session, updateTab, writeToTerm, api])

  // ── Mount xterm ────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!containerRef.current || termRef.current) return

    const term   = new Terminal({
      fontFamily:  "'JetBrains Mono', 'SF Mono', 'Cascadia Code', monospace",
      fontSize:    13,
      lineHeight:  1.45,
      cursorBlink: true,
      cursorStyle: 'block',
      scrollback:  10000,
      theme:       XTERM_THEME,
    })

    const fit    = new FitAddon()
    const links  = new WebLinksAddon()
    const search = new SearchAddon()

    term.loadAddon(fit)
    term.loadAddon(links)
    term.loadAddon(search)
    term.open(containerRef.current)

    setTimeout(() => { try { fit.fit() } catch {} }, 50)

    termRef.current  = term
    fitRef.current   = fit
    searchRef.current = search

    // Forward keystrokes to backend
    term.onData(data => {
      if (api && tab.isConnected) {
        api.terminalInput({ id: tab.ptyId, data })
      }
    })

    // ⌘F shortcut
    term.attachCustomKeyEventHandler((e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'f') {
        setShowSearch(s => !s)
        return false
      }
      return true
    })

    // ResizeObserver
    const ro = new ResizeObserver(() => {
      try {
        fit.fit()
        if (api && tab.isConnected) {
          api.terminalResize({ id: tab.ptyId, cols: term.cols, rows: term.rows })
        }
      } catch {}
    })
    ro.observe(containerRef.current)

    // Auto-connect
    connect()

    return () => {
      ro.disconnect()
      unsubsRef.current.forEach(fn => fn())
      unsubsRef.current = []
      if (api) api.terminalKill({ id: tab.ptyId })
      term.dispose()
      termRef.current = null
    }
  }, []) // Only on mount

  // ── Handle pending insert from AI ──────────────────────────────────────────
  useEffect(() => {
    if (pendingInsert && tab.id === activeTabId && tab.isConnected && api) {
      api.terminalInput({ id: tab.ptyId, data: pendingInsert })
      setPendingInsert(null)
      termRef.current?.focus()
    }
  }, [pendingInsert, tab.id, activeTabId, tab.isConnected, tab.ptyId, api, setPendingInsert])

  // ── Search ─────────────────────────────────────────────────────────────────
  const doSearch = (dir: 'next' | 'prev') => {
    if (!searchQuery || !searchRef.current) return
    if (dir === 'next') searchRef.current.findNext(searchQuery, { caseSensitive: false, incremental: true })
    else                searchRef.current.findPrevious(searchQuery, { caseSensitive: false })
  }

  // ── Disconnect ─────────────────────────────────────────────────────────────
  const disconnect = () => {
    if (api) api.terminalKill({ id: tab.ptyId })
    updateTab(tab.id, { isConnected: false })
  }

  // ── Logging toggle ─────────────────────────────────────────────────────────
  const toggleLog = async () => {
    if (!api) return
    if (tab.logPath) {
      await api.logStop({ id: tab.ptyId })
      updateTab(tab.id, { logPath: undefined })
    } else {
      const result = await api.logStart({ id: tab.ptyId, name: tab.title })
      if (result?.ok) updateTab(tab.id, { logPath: result.logPath })
    }
  }

  const statusColor = tab.isConnecting ? 'var(--accent-amber)'
    : tab.isConnected ? 'var(--accent-green)'
    : tab.connectionError ? 'var(--accent-red)'
    : 'var(--text-muted)'

  const statusLabel = tab.isConnecting ? 'Connecting…'
    : tab.isConnected ? 'Connected'
    : tab.connectionError ? 'Failed'
    : 'Disconnected'

  return (
    <div className="terminal-pane">

      {/* Session bar */}
      {session && (
        <div className="session-bar" style={{ borderLeft: session.env !== 'none' ? `3px solid ${ENV_COLOR[session.env]}` : '3px solid transparent' }}>
          <div className="sb-left">
            <span className="device-name">{session.name}</span>
            <span className="sb-divider" />
            <span className="device-host font-mono">{session.username}@{session.host}:{session.port}</span>
            <span className="proto-tag">{session.protocol}</span>
          </div>
          <div className="sb-right">
            <span className="status-text" style={{ color: statusColor }}>{statusLabel}</span>
            {tab.connectionError && (
              <span className="error-text" title={tab.connectionError}>Error: {tab.connectionError.slice(0, 40)}</span>
            )}
            <div className="bar-actions">
              <button className="bar-btn" data-tooltip="Search (⌘F)" onClick={() => setShowSearch(s => !s)}>
                <Search size={12} />
              </button>
              <button
                className={`bar-btn ${tab.logPath ? 'active' : ''}`}
                data-tooltip={tab.logPath ? `Logging: ${tab.logPath}` : 'Start Session Log'}
                onClick={toggleLog}
              >
                <FileText size={12} />
              </button>
              <button className="bar-btn" data-tooltip="SFTP Browser" onClick={() => useStore.getState().setActiveView('sftp')}>
                <FolderOpen size={12} />
              </button>
              {tab.isConnected 
                ? <button className="bar-btn danger" data-tooltip="Disconnect" onClick={disconnect}><WifiOff size={12} /></button>
                : <button className="bar-btn" data-tooltip="Reconnect" onClick={connect}><Wifi size={12} /></button>}
            </div>
          </div>
        </div>
      )}

      {/* Terminal search bar */}
      {showSearch && (
        <div className="search-bar">
          <Search size={12} className="sb-search-icon" />
          <input
            className="sb-search-input"
            placeholder="Search terminal…"
            value={searchQuery}
            autoFocus
            onChange={e => setSearchQuery(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter')  doSearch(e.shiftKey ? 'prev' : 'next')
              if (e.key === 'Escape') setShowSearch(false)
            }}
          />
          <button className="sb-search-btn" onClick={() => doSearch('prev')}>↑</button>
          <button className="sb-search-btn" onClick={() => doSearch('next')}>↓</button>
          <button className="sb-search-close" onClick={() => setShowSearch(false)}><X size={11} /></button>
        </div>
      )}

      <div className="terminal-container" ref={containerRef} />
    </div>
  )
}
