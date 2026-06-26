import { Plus, SplitSquareHorizontal, LayoutGrid, Bot } from 'lucide-react'
import { useStore } from '../../store/appStore'
import './TabBar.css'

export default function TabBar() {
  const { tabs, activeTabId, setActiveTab, closeTab, addTab, toggleAISidebar, showAISidebar } = useStore()

  return (
    <div className="tabbar">
      <div className="tabs-list">
        {tabs.map(tab => (
          <div
            key={tab.id}
            className={`tab ${activeTabId === tab.id ? 'active' : ''}`}
            onClick={() => setActiveTab(tab.id)}
            style={{ borderLeft: `2px solid ${tab.isConnected ? 'var(--accent-green)' : 'transparent'}` }}
          >

            <span className="tab-label truncate">{tab.title}</span>
            <button
              className="tab-close"
              onClick={e => { e.stopPropagation(); closeTab(tab.id) }}
            >
              <svg width="8" height="8" viewBox="0 0 8 8" fill="none">
                <path d="M1 1l6 6M7 1L1 7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
            </button>
          </div>
        ))}

        <button className="new-tab" onClick={() => addTab()} title="New Tab (⌘T)">
          <Plus size={13} strokeWidth={2} />
        </button>
      </div>

      <div className="tabbar-right">
        <button
          className={`ai-btn ${showAISidebar ? 'active' : ''}`}
          onClick={toggleAISidebar}
          title="Toggle AI Sidebar"
        >
          <Bot size={13} strokeWidth={1.75} />
          <span>AI</span>
        </button>
        <div className="tabbar-sep" />
        <button className="tool-btn" title="Split View">
          <SplitSquareHorizontal size={14} strokeWidth={1.75} />
        </button>
        <button className="tool-btn" title="Tile Sessions">
          <LayoutGrid size={14} strokeWidth={1.75} />
        </button>
      </div>
    </div>
  )
}
