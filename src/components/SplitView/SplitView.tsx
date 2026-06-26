import { useStore, Tab, SplitLayout } from '../../store/appStore'
import TerminalPane from '../Terminal/TerminalPane'
import WelcomeScreen from '../WelcomeScreen/WelcomeScreen'
import ResizableSplit from './ResizableSplit'
import './SplitView.css'

interface SplitViewProps { tabs: Tab[]; activeTabId: string | null; layout: SplitLayout }

// ── Single pane ───────────────────────────────────────────────────────────────
function SingleView({ tabs, activeTabId }: { tabs: Tab[]; activeTabId: string | null }) {
  if (tabs.length === 0) return <WelcomeScreen />
  return (
    <div className="split-single">
      {tabs.map(tab => (
        <div key={tab.id} className={`split-pane ${tab.id === activeTabId ? 'active' : 'hidden'}`}>
          <TerminalPane tab={tab} />
        </div>
      ))}
    </div>
  )
}

// ── Per-pane header with tab switcher ────────────────────────────────────────
function PaneHeader({ paneIndex, tabs, activeTabId }: {
  paneIndex: number; tabs: Tab[]; activeTabId: string | null
}) {
  const { setPaneActiveTab, setActivePaneIndex, addTab } = useStore()

  return (
    <div className="pane-header">
      <div className="pane-tab-strip">
        {tabs.map(tab => (
          <button
            key={tab.id}
            className={`pane-tab ${tab.id === activeTabId ? 'active' : ''}`}
            onClick={() => { setActivePaneIndex(paneIndex); setPaneActiveTab(paneIndex, tab.id) }}
          >
            <span className={`pane-tab-dot ${tab.isConnected ? 'connected' : ''}`} />
            <span className="pane-tab-label">{tab.title}</span>
          </button>
        ))}
      </div>
      <button
        className="pane-add-btn"
        data-tooltip="New Tab in This Pane"
        onClick={() => { setActivePaneIndex(paneIndex); addTab() }}
      >+</button>
    </div>
  )
}

// ── A single split pane with header ──────────────────────────────────────────
function SplitPane({ paneIndex, tabs }: { paneIndex: number; tabs: Tab[] }) {
  const { paneActiveTabIds, activePaneIndex, setActivePaneIndex } = useStore()
  const activeTabId = paneActiveTabIds[paneIndex] || null
  const activeTab = tabs.find(t => t.id === activeTabId)
  const isFocused = activePaneIndex === paneIndex

  return (
    <div
      className={`split-pane ${isFocused ? 'active' : ''}`}
      onClick={() => setActivePaneIndex(paneIndex)}
    >
      <PaneHeader paneIndex={paneIndex} tabs={tabs} activeTabId={activeTabId} />
      {activeTab
        ? <TerminalPane tab={activeTab} />
        : <WelcomeScreen />
      }
    </div>
  )
}

// ── Main SplitView ────────────────────────────────────────────────────────────
export default function SplitView({ tabs, activeTabId, layout }: SplitViewProps) {
  if (layout === 'single') return <SingleView tabs={tabs} activeTabId={activeTabId} />
  if (tabs.length === 0)   return <WelcomeScreen />

  if (layout === 'horizontal') {
    return (
      <ResizableSplit direction="horizontal">
        {[
          <SplitPane key={0} paneIndex={0} tabs={tabs} />,
          <SplitPane key={1} paneIndex={1} tabs={tabs} />,
        ]}
      </ResizableSplit>
    )
  }

  if (layout === 'vertical') {
    return (
      <ResizableSplit direction="vertical">
        {[
          <SplitPane key={0} paneIndex={0} tabs={tabs} />,
          <SplitPane key={1} paneIndex={1} tabs={tabs} />,
        ]}
      </ResizableSplit>
    )
  }

  // Quad: 2×2 grid using nested splits
  if (layout === 'quad') {
    return (
      <ResizableSplit direction="horizontal">
        {[
          <ResizableSplit key="left" direction="vertical">
            {[
              <SplitPane key={0} paneIndex={0} tabs={tabs} />,
              <SplitPane key={2} paneIndex={2} tabs={tabs} />,
            ]}
          </ResizableSplit>,
          <ResizableSplit key="right" direction="vertical">
            {[
              <SplitPane key={1} paneIndex={1} tabs={tabs} />,
              <SplitPane key={3} paneIndex={3} tabs={tabs} />,
            ]}
          </ResizableSplit>,
        ]}
      </ResizableSplit>
    )
  }

  return null
}
