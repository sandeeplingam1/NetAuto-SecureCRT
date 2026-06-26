import { useStore, Tab, SplitLayout } from '../../store/appStore'
import TerminalPane from '../Terminal/TerminalPane'
import WelcomeScreen from '../WelcomeScreen/WelcomeScreen'
import './SplitView.css'

interface SplitViewProps { tabs: Tab[]; activeTabId: string | null; layout: SplitLayout }

export default function SplitView({ tabs, activeTabId, layout }: SplitViewProps) {
  const { setActiveTab } = useStore()

  if (tabs.length === 0) return <WelcomeScreen />

  if (layout === 'single') {
    return (
      <div className="split-single">
        {tabs.map(tab => (
          <div key={tab.id} className={`split-pane ${tab.id === activeTabId ? 'active' : 'hidden'}`}>
            <TerminalPane tab={tab} />
          </div>
        ))}
        {!activeTabId && <WelcomeScreen />}
      </div>
    )
  }

  // For split layouts, show multiple panes simultaneously
  const paneCount = layout === 'quad' ? 4 : 2
  const visibleTabs = tabs.slice(0, paneCount)

  return (
    <div className={`split-container split-${layout}`}>
      {visibleTabs.map(tab => (
        <div
          key={tab.id}
          className={`split-pane ${tab.id === activeTabId ? 'active' : ''}`}
          onClick={() => setActiveTab(tab.id)}
        >
          <div className="split-pane-label">
            <span className={`split-status ${tab.isConnected ? 'connected' : 'idle'}`} />
            <span>{tab.title}</span>
          </div>
          <TerminalPane tab={tab} />
        </div>
      ))}
      {/* Fill empty panes if fewer tabs than slots */}
      {Array.from({ length: paneCount - visibleTabs.length }).map((_, i) => (
        <div key={`empty-${i}`} className="split-pane empty">
          <WelcomeScreen />
        </div>
      ))}
    </div>
  )
}
