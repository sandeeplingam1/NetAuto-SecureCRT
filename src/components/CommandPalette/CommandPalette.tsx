import { useState, useEffect, useRef } from 'react'
import { Search, Terminal, Plus, Settings, Trash2, Monitor, Command } from 'lucide-react'
import { useStore } from '../../store/appStore'
import './CommandPalette.css'

interface Cmd {
  id: string
  label: string
  description?: string
  category: string
  Icon: React.ElementType
  action: () => void
}

export default function CommandPalette() {
  const { sessions, addTab, toggleCommandPalette, setActiveView, setShowNewSessionModal, clearChat } = useStore()
  const [query, setQuery] = useState('')
  const [selectedIdx, setSelectedIdx] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => { inputRef.current?.focus() }, [])
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') toggleCommandPalette() }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [toggleCommandPalette])

  const commands: Cmd[] = [
    ...sessions.map(s => ({
      id: `session-${s.id}`,
      Icon: Monitor,
      label: s.name,
      description: `${s.username}@${s.host}:${s.port} · ${s.protocol} · ${s.group}`,
      category: 'Connect',
      action: () => { addTab(s.id); toggleCommandPalette() },
    })),
    {
      id: 'new-session', Icon: Plus, label: 'New Session',
      description: 'Add a new SSH, Telnet, or Serial session',
      category: 'Actions',
      action: () => { setShowNewSessionModal(true); toggleCommandPalette() }
    },
    {
      id: 'new-tab', Icon: Terminal, label: 'New Terminal Tab',
      description: 'Open a blank local terminal tab',
      category: 'Actions',
      action: () => { addTab(); toggleCommandPalette() }
    },
    {
      id: 'settings', Icon: Settings, label: 'Settings',
      description: 'Open AI provider settings, terminal preferences',
      category: 'Navigate',
      action: () => { setActiveView('settings'); toggleCommandPalette() }
    },
    {
      id: 'clear-ai', Icon: Trash2, label: 'Clear AI Chat',
      description: 'Clear the AI conversation history',
      category: 'Actions',
      action: () => { clearChat(); toggleCommandPalette() }
    },
  ]

  const filtered = query.trim()
    ? commands.filter(c =>
        c.label.toLowerCase().includes(query.toLowerCase()) ||
        (c.description || '').toLowerCase().includes(query.toLowerCase())
      )
    : commands

  const grouped = filtered.reduce<Record<string, Cmd[]>>((acc, cmd) => {
    acc[cmd.category] = acc[cmd.category] || []
    acc[cmd.category].push(cmd)
    return acc
  }, {})

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setSelectedIdx(i => Math.min(i + 1, filtered.length - 1)) }
    if (e.key === 'ArrowUp')   { e.preventDefault(); setSelectedIdx(i => Math.max(i - 1, 0)) }
    if (e.key === 'Enter')     { filtered[selectedIdx]?.action() }
  }

  let idx = 0

  return (
    <div className="cp-overlay" onClick={toggleCommandPalette}>
      <div className="cp-panel glass animate-fade-in" onClick={e => e.stopPropagation()}>

        <div className="cp-search-row">
          <Search size={14} className="cp-search-icon" />
          <input
            ref={inputRef}
            className="cp-input"
            placeholder="Search sessions and commands…"
            value={query}
            onChange={e => { setQuery(e.target.value); setSelectedIdx(0) }}
            onKeyDown={handleKey}
          />
          <kbd className="cp-kbd">ESC</kbd>
        </div>

        <div className="cp-results scrollable">
          {filtered.length === 0 ? (
            <div className="cp-empty">No results for "{query}"</div>
          ) : (
            Object.entries(grouped).map(([cat, cmds]) => (
              <div key={cat} className="cp-group">
                <div className="cp-group-label">{cat}</div>
                {cmds.map(cmd => {
                  const i = idx++
                  return (
                    <button
                      key={cmd.id}
                      className={`cp-item ${i === selectedIdx ? 'active' : ''}`}
                      onClick={cmd.action}
                      onMouseEnter={() => setSelectedIdx(i)}
                    >
                      <div className="cp-item-icon">
                        <cmd.Icon size={14} strokeWidth={1.75} />
                      </div>
                      <div className="cp-item-text">
                        <span className="cp-item-label">{cmd.label}</span>
                        {cmd.description && <span className="cp-item-desc">{cmd.description}</span>}
                      </div>
                      {i === selectedIdx && <kbd className="cp-enter">↵</kbd>}
                    </button>
                  )
                })}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
