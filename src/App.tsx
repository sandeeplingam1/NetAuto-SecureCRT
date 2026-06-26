import { useEffect } from 'react'
import { useStore } from './store/appStore'
import Sidebar            from './components/Sidebar/Sidebar'
import TitleBar           from './components/TitleBar/TitleBar'
import AISidebar          from './components/AISidebar/AISidebar'
import StatusBar          from './components/StatusBar/StatusBar'
import SessionModal       from './components/SessionModal/SessionModal'
import CommandPalette     from './components/CommandPalette/CommandPalette'
import SettingsPage       from './components/Settings/SettingsPage'
import WelcomeScreen      from './components/WelcomeScreen/WelcomeScreen'
import SFTPPanel          from './components/SFTP/SFTPPanel'
import SplitView          from './components/SplitView/SplitView'
import BroadcastBar       from './components/BroadcastBar/BroadcastBar'
import MacrosView         from './components/Macros/MacrosView'
import PortForwardView    from './components/PortForward/PortForwardView'
import KnownHostsView     from './components/KnownHosts/KnownHostsView'
import LogsView           from './components/Logs/LogsView'
import LockScreen         from './components/LockScreen/LockScreen'
import { HostKeyDialog, KeyboardInteractiveDialog } from './components/SSHDialogs/SSHDialogs'
import './App.css'

const api = (window as any).helixAPI

export default function App() {
  const {
    tabs, activeTabId, activeView,
    showAISidebar, showCommandPalette, toggleCommandPalette,
    showNewSessionModal, editingSession,
    toggleAISidebar, setActiveView, addTab, closeTab,
    setSplitLayout, splitLayout, broadcastMode, toggleBroadcast,
    setHostKeyEvent, setKbInteractive,
    lockSession, isLocked,
    setActivePaneIndex, activePaneIndex,
  } = useStore()

  // ── Subscribe to SSH events from main process ───────────────────────────────
  useEffect(() => {
    if (!api) return
    const unHk  = api.onSSHUnknownHost((e: any)       => setHostKeyEvent(e))
    const unHkC = api.onSSHHostKeyChanged((e: any)     => setHostKeyEvent({ ...e, stored: e.stored }))
    const unKb  = api.onSSHKeyboardInteractive((e: any)=> setKbInteractive(e))
    const unMenu = api.onMenuEvent((ev: string) => {
      switch (ev) {
        case 'settings':   setActiveView('settings'); break
        case 'new-session': useStore.getState().setShowNewSessionModal(true); break
        case 'new-tab':    addTab(); break
        case 'close-tab':  if (activeTabId) closeTab(activeTabId); break
        case 'broadcast':  toggleBroadcast(); break
        case 'toggle-ai':  toggleAISidebar(); break
        case 'sftp':       setActiveView('sftp'); break
        case 'split-h':    setSplitLayout('horizontal'); break
        case 'split-v':    setSplitLayout('vertical'); break
        case 'palette':    toggleCommandPalette(); break
      }
    })
    return () => { unHk(); unHkC(); unKb(); unMenu() }
  }, [activeTabId])

  // ── Global keyboard shortcuts ───────────────────────────────────────────────
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      const meta = e.metaKey || e.ctrlKey
      if (meta && e.key === 'k' && !e.shiftKey) { e.preventDefault(); toggleCommandPalette() }
      if (meta && e.key === 't')                 { e.preventDefault(); addTab() }
      if (meta && e.key === 'w')                 { e.preventDefault(); const st = useStore.getState(); if (st.activeTabId) st.closeTab(st.activeTabId) }
      if (meta && e.key === ',')                 { e.preventDefault(); setActiveView('settings') }
      if (meta && e.shiftKey && e.key === 'A')   { e.preventDefault(); toggleAISidebar() }
      if (meta && e.shiftKey && e.key === 'S')   { e.preventDefault(); setActiveView('sftp') }
      if (meta && e.shiftKey && e.key === 'L')   { e.preventDefault(); setActiveView('logs') }
      if (meta && e.shiftKey && e.key === 'B')   { e.preventDefault(); toggleBroadcast() }
      if (meta && e.shiftKey && e.key === 'H')   { e.preventDefault(); setSplitLayout('horizontal') }
      if (meta && e.shiftKey && e.key === 'V')   { e.preventDefault(); setSplitLayout('vertical') }
      if (meta && e.shiftKey && e.key === '4')   { e.preventDefault(); setSplitLayout('quad') }
      if (meta && e.shiftKey && e.key === '1')   { e.preventDefault(); setSplitLayout('single') }
      if (meta && e.key === 'l')                 { e.preventDefault(); lockSession() }

      // Cycle through panes
      if (meta && e.key === '[' && splitLayout !== 'single') {
        e.preventDefault()
        const paneCount = splitLayout === 'quad' ? 4 : 2
        setActivePaneIndex((activePaneIndex + paneCount - 1) % paneCount)
      }
      if (meta && e.key === ']' && splitLayout !== 'single') {
        e.preventDefault()
        const paneCount = splitLayout === 'quad' ? 4 : 2
        setActivePaneIndex((activePaneIndex + 1) % paneCount)
      }

      // ⌘1–9 tab switching
      if (meta && !e.shiftKey && e.key >= '1' && e.key <= '9') {
        const idx = parseInt(e.key) - 1
        const tab = tabs[idx]
        if (tab) { e.preventDefault(); useStore.getState().setActiveTab(tab.id) }
      }
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [tabs, activeTabId, toggleCommandPalette, addTab, closeTab, setActiveView, toggleAISidebar, toggleBroadcast, setSplitLayout, lockSession, splitLayout, activePaneIndex, setActivePaneIndex])

  // ── Sidebar Resize Handlers ─────────────────────────────────────────────────
  const startResizeLeft = (e: React.MouseEvent) => {
    e.preventDefault()
    const onMove = (ev: MouseEvent) => {
      let w = ev.clientX
      if (w < 180) w = 180
      if (w > 600) w = 600
      document.documentElement.style.setProperty('--sidebar-width', `${w}px`)
    }
    const onUp = () => {
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
    }
    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
  }

  const startResizeRight = (e: React.MouseEvent) => {
    e.preventDefault()
    const onMove = (ev: MouseEvent) => {
      let w = window.innerWidth - ev.clientX
      if (w < 260) w = 260
      if (w > 800) w = 800
      document.documentElement.style.setProperty('--ai-panel-width', `${w}px`)
    }
    const onUp = () => {
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
    }
    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
  }

  const view = isLocked ? 'locked' : activeView

  if (isLocked) return <LockScreen />

  return (
    <div className="app-root">
      {/* macOS traffic-lights drag region & global controls */}
      <TitleBar />

      <div className="app-body">
        {/* Left sidebar */}
        <Sidebar />
        <div className="resize-handle vertical" onMouseDown={startResizeLeft} />

        {/* Main content */}
        <div className="main-content">

          {/* ── Terminal view ── */}
          {view === 'terminal' && (
            <>
              <BroadcastBar />
              <div className="workspace">
                {tabs.length === 0
                  ? <WelcomeScreen />
                  : <SplitView tabs={tabs} activeTabId={activeTabId} layout={splitLayout} />
                }
              </div>
            </>
          )}

          {/* ── Settings ── */}
          {view === 'settings' && <SettingsPage />}

          {/* ── SFTP ── */}
          {view === 'sftp' && (
            <div className="sftp-view">
              <div className="sftp-view-header">
                <span>SFTP File Browser</span>
                <button className="sftp-view-back" onClick={() => setActiveView('terminal')}>
                  ← Back to Terminal
                </button>
              </div>
              <SFTPPanel />
            </div>
          )}

          {/* ── Logs ── */}
          {view === 'logs' && <LogsView />}

          {/* ── Macros ── */}
          {view === 'macros' && <MacrosView />}

          {/* ── Port Forwarding ── */}
          {view === 'portfwd' && <PortForwardView />}

          {/* ── Known Hosts ── */}
          {view === 'hosts' && <KnownHostsView />}
        </div>

        {/* AI Sidebar */}
        {showAISidebar && (
          <>
            <div className="resize-handle vertical" onMouseDown={startResizeRight} />
            <AISidebar />
          </>
        )}
      </div>

      {/* Status Bar */}
      <StatusBar />

      {/* Modals & Overlays */}
      {(showNewSessionModal || editingSession) && <SessionModal />}
      {showCommandPalette && <CommandPalette />}

      {/* SSH Security Dialogs */}
      <HostKeyDialog />
      <KeyboardInteractiveDialog />

      {/* Lock Screen */}
      <LockScreen />
    </div>
  )
}
