import { Plus, SplitSquareHorizontal, Bot } from 'lucide-react'
import { useStore } from '../../store/appStore'
import './TitleBar.css'

export default function TitleBar() {
  const { 
    addTab, toggleAISidebar, showAISidebar, 
    setSplitLayout, splitLayout 
  } = useStore()

  function cycleSplit() {
    if (splitLayout === 'single') setSplitLayout('horizontal')
    else if (splitLayout === 'horizontal') setSplitLayout('vertical')
    else setSplitLayout('single')
  }

  return (
    <div className="titlebar-drag">
      {/* Left empty for macOS traffic lights */}
      <div className="tb-left"></div>

      <div className="tb-center">
        <span>Helix</span>
      </div>

      <div className="tb-right no-drag">
        <button 
          className="tb-btn" 
          onClick={addTab} 
          data-tooltip-left="New Tab (⌘T)"
        >
          <Plus size={14} />
        </button>

        <div className="tb-sep" />

        <button
          className={`tb-btn ${splitLayout !== 'single' && splitLayout !== 'quad' ? 'active' : ''}`}
          onClick={cycleSplit}
          data-tooltip-left={`Split: ${splitLayout} (click to cycle)`}
        >
          <SplitSquareHorizontal size={14} />
        </button>
        <button
          className={`tb-btn ${splitLayout === 'quad' ? 'active' : ''}`}
          onClick={() => setSplitLayout(splitLayout === 'quad' ? 'single' : 'quad')}
          data-tooltip-left="Toggle Quad Split"
        >
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
            <rect x="2" y="2" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.5"/>
            <rect x="9" y="2" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.5"/>
            <rect x="2" y="9" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.5"/>
            <rect x="9" y="9" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.5"/>
          </svg>
        </button>

        <div className="tb-sep" />

        <button
          className={`tb-btn ${showAISidebar ? 'active' : ''}`}
          onClick={toggleAISidebar}
          data-tooltip-left="Toggle AI Sidebar"
        >
          <Bot size={14} />
        </button>
      </div>
    </div>
  )
}
