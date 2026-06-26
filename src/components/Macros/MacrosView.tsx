import { useState, useEffect, useRef } from 'react'
import {
  Plus, Trash2, Play, Edit3, ChevronDown, ChevronUp,
  GripVertical, Clock, Download, Upload, Keyboard,
  CheckCircle, AlertCircle, Loader, Tag, X, Variable
} from 'lucide-react'
import { useStore, Macro, MacroCommand } from '../../store/appStore'
import './MacrosView.css'

const api = (window as any).helixAPI

// Extract {variable} tokens from command text
function extractVars(commands: MacroCommand[]): string[] {
  const seen = new Set<string>()
  const vars: string[] = []
  for (const { cmd } of commands) {
    const matches = cmd.match(/\{(\w+)\}/g) || []
    for (const m of matches) {
      const v = m.slice(1, -1)
      if (!seen.has(v)) { seen.add(v); vars.push(v) }
    }
  }
  return vars
}

// Apply variable substitutions to a command
function applyVars(cmd: string, vals: Record<string, string>): string {
  return cmd.replace(/\{(\w+)\}/g, (_, k) => vals[k] ?? `{${k}}`)
}

interface RunState {
  macroId: string
  step: number
  total: number
  done: boolean
  error?: string
}

interface VarPromptState {
  macro: Macro
  vars: string[]
  vals: Record<string, string>
}

export default function MacrosView() {
  const { macros, addMacro, updateMacro, deleteMacro, tabs, activeTabId } = useStore()
  const [editing, setEditing] = useState<string | null>(null)
  const [form, setForm] = useState<Omit<Macro, 'id'>>({
    name: '', description: '', commands: [{ cmd: '', delay: 0 }],
    hotkey: '', category: '', variables: [],
  })
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})
  const [runState, setRunState] = useState<RunState | null>(null)
  const [varPrompt, setVarPrompt] = useState<VarPromptState | null>(null)
  const [search, setSearch] = useState('')
  const abortRef = useRef(false)

  const activeTab = tabs.find(t => t.id === activeTabId)
  const canRun = !!activeTab?.isConnected

  // ── Hotkey listener ──────────────────────────────────────────────────────────
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      for (const m of macros) {
        if (!m.hotkey) continue
        const parts = m.hotkey.toLowerCase().split('+')
        const ctrl  = parts.includes('ctrl')  === (e.ctrlKey  || e.metaKey)
        const shift = parts.includes('shift') === e.shiftKey
        const key   = parts[parts.length - 1] === e.key.toLowerCase()
        if (ctrl && shift && key && canRun) { e.preventDefault(); handleRun(m) }
      }
    }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [macros, canRun, activeTab])

  // ── Form helpers ─────────────────────────────────────────────────────────────
  const openNew = () => {
    setForm({ name: '', description: '', commands: [{ cmd: '', delay: 0 }], hotkey: '', category: '', variables: [] })
    setEditing('new')
  }
  const openEdit = (m: Macro) => {
    setForm({ name: m.name, description: m.description || '', commands: [...m.commands], hotkey: m.hotkey || '', category: m.category || '', variables: m.variables || [] })
    setEditing(m.id)
  }
  const save = () => {
    if (!form.name.trim()) return
    const vars = extractVars(form.commands)
    const data = { ...form, variables: vars }
    if (editing === 'new') addMacro(data)
    else if (editing)      updateMacro(editing, data)
    setEditing(null)
  }
  const addCmd    = () => setForm(f => ({ ...f, commands: [...f.commands, { cmd: '', delay: 0 }] }))
  const removeCmd = (i: number) => setForm(f => ({ ...f, commands: f.commands.filter((_, j) => j !== i) }))
  const updateCmd = (i: number, field: keyof MacroCommand, value: string | number) =>
    setForm(f => ({ ...f, commands: f.commands.map((c, j) => j === i ? { ...c, [field]: value } : c) }))

  // ── Run logic ────────────────────────────────────────────────────────────────
  const handleRun = (m: Macro) => {
    if (!canRun || !activeTab) return
    const vars = extractVars(m.commands)
    if (vars.length > 0) {
      setVarPrompt({ macro: m, vars, vals: Object.fromEntries(vars.map(v => [v, ''])) })
    } else {
      executeRun(m, {})
    }
  }

  const executeRun = async (m: Macro, vals: Record<string, string>) => {
    if (!activeTab) return
    abortRef.current = false
    setRunState({ macroId: m.id, step: 0, total: m.commands.length, done: false })
    for (let i = 0; i < m.commands.length; i++) {
      if (abortRef.current) break
      const { cmd, delay } = m.commands[i]
      const resolved = applyVars(cmd, vals)
      setRunState(s => s ? { ...s, step: i + 1 } : s)
      try {
        await api?.macroRun({ terminalId: activeTab.ptyId, commands: [{ cmd: resolved, delay: 0 }] })
      } catch (err: any) {
        setRunState(s => s ? { ...s, done: true, error: String(err) } : s)
        return
      }
      if (delay > 0) await new Promise(r => setTimeout(r, delay))
    }
    setRunState(s => s ? { ...s, done: true } : s)
    setTimeout(() => setRunState(null), 3000)
  }

  const stopRun = () => { abortRef.current = true; setRunState(null) }

  // ── Export / Import ──────────────────────────────────────────────────────────
  const exportMacros = () => {
    const blob = new Blob([JSON.stringify(macros, null, 2)], { type: 'application/json' })
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob)
    a.download = 'helix-macros.json'; a.click()
  }
  const importMacros = () => {
    const input = document.createElement('input'); input.type = 'file'; input.accept = '.json'
    input.onchange = async () => {
      const file = input.files?.[0]; if (!file) return
      try {
        const text = await file.text()
        const data = JSON.parse(text) as Macro[]
        for (const m of data) addMacro({ ...m, id: undefined as any })
      } catch { alert('Invalid macro file') }
    }
    input.click()
  }

  const filtered = macros.filter(m =>
    !search || m.name.toLowerCase().includes(search.toLowerCase()) ||
    m.category?.toLowerCase().includes(search.toLowerCase())
  )

  const categories = [...new Set(macros.map(m => m.category).filter(Boolean))]

  return (
    <div className="macros-view">
      {/* Variable prompt modal */}
      {varPrompt && (
        <div className="var-overlay">
          <div className="var-modal animate-fade-in">
            <div className="var-header">
              <Variable size={16} />
              <span>Set Variables for: <strong>{varPrompt.macro.name}</strong></span>
              <button className="var-close" onClick={() => setVarPrompt(null)}><X size={14} /></button>
            </div>
            <p className="var-hint">Fill in the variable values before running this macro.</p>
            <div className="var-fields">
              {varPrompt.vars.map(v => (
                <div key={v} className="var-field">
                  <label><code>{`{${v}}`}</code></label>
                  <input
                    placeholder={`Enter ${v}...`}
                    value={varPrompt.vals[v]}
                    onChange={e => setVarPrompt(s => s ? { ...s, vals: { ...s.vals, [v]: e.target.value } } : s)}
                    onKeyDown={e => e.key === 'Enter' && (() => { setVarPrompt(null); executeRun(varPrompt.macro, varPrompt.vals) })()}
                    autoFocus
                  />
                </div>
              ))}
            </div>
            <div className="var-footer">
              <button className="btn-secondary" onClick={() => setVarPrompt(null)}>Cancel</button>
              <button className="btn-primary" onClick={() => { const p = varPrompt; setVarPrompt(null); executeRun(p.macro, p.vals) }}>
                <Play size={12} fill="currentColor" /> Run
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="macros-header">
        <div>
          <h2>Macros</h2>
          <p>Automate command sequences with variables, delays, and hotkeys</p>
        </div>
        <div className="macros-header-actions">
          <button className="btn-icon" data-tooltip="Import Macros" onClick={importMacros}><Upload size={14} /></button>
          <button className="btn-icon" data-tooltip="Export Macros" onClick={exportMacros} disabled={macros.length === 0}><Download size={14} /></button>
          <button className="btn-primary" onClick={openNew}><Plus size={13} /> New Macro</button>
        </div>
      </div>

      {/* Run progress banner */}
      {runState && (
        <div className={`run-banner ${runState.error ? 'error' : runState.done ? 'done' : 'running'}`}>
          {runState.error
            ? <><AlertCircle size={14} /> Error: {runState.error}</>
            : runState.done
            ? <><CheckCircle size={14} /> Macro complete — all {runState.total} steps executed</>
            : <><Loader size={14} className="spin" /> Running step {runState.step} of {runState.total}…</>
          }
          {!runState.done && <button className="run-stop-btn" onClick={stopRun}>Stop</button>}
        </div>
      )}

      {/* Editor */}
      {editing && (
        <div className="macro-editor animate-fade-in">
          <h3>{editing === 'new' ? 'New Macro' : 'Edit Macro'}</h3>
          <div className="me-row">
            <input placeholder="Macro name *" value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))} className="me-name" />
            <input placeholder="Description (optional)" value={form.description}
              onChange={e => setForm(f => ({ ...f, description: e.target.value }))} className="me-desc" />
          </div>
          <div className="me-row-2">
            <div className="me-field">
              <label><Tag size={11} /> Category</label>
              <input
                placeholder="e.g. BGP, OSPF, Cisco"
                value={form.category}
                list="macro-categories"
                onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
              />
              <datalist id="macro-categories">
                {categories.map(c => <option key={c} value={c!} />)}
              </datalist>
            </div>
            <div className="me-field">
              <label><Keyboard size={11} /> Hotkey</label>
              <input
                placeholder="e.g. ctrl+shift+1"
                value={form.hotkey}
                onChange={e => setForm(f => ({ ...f, hotkey: e.target.value }))}
              />
            </div>
          </div>
          <div className="me-var-hint">
            💡 Use <code>{'{variable}'}</code> syntax in commands — you'll be prompted to fill them in at runtime.
          </div>
          <div className="me-commands">
            <div className="me-cmd-header">
              <span>Command (use {'{var}'} for variables)</span>
              <span>Delay after (ms)</span>
              <span />
            </div>
            {form.commands.map((c, i) => (
              <div key={i} className="me-cmd-row">
                <GripVertical size={13} className="me-grip" />
                <input
                  className="font-mono me-cmd-input"
                  placeholder="show ip int brief  or  conf t"
                  value={c.cmd}
                  onChange={e => updateCmd(i, 'cmd', e.target.value)}
                />
                <div className="me-delay-wrap">
                  <Clock size={11} />
                  <input type="number" min="0" step="100" value={c.delay}
                    onChange={e => updateCmd(i, 'delay', parseInt(e.target.value) || 0)}
                    className="me-delay-input"
                  />
                </div>
                <button className="me-rm-btn" onClick={() => removeCmd(i)} disabled={form.commands.length === 1}>
                  <Trash2 size={12} />
                </button>
              </div>
            ))}
          </div>
          <div className="me-actions">
            <button className="add-cmd-btn" onClick={addCmd}><Plus size={12} /> Add Step</button>
            <div className="me-footer-btns">
              <button className="btn-secondary" onClick={() => setEditing(null)}>Cancel</button>
              <button className="btn-primary" onClick={save} disabled={!form.name.trim()}>Save Macro</button>
            </div>
          </div>
        </div>
      )}

      {/* Search */}
      {macros.length > 0 && (
        <div className="macros-search">
          <input
            placeholder="Search macros or categories…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          {search && <button className="search-clear" onClick={() => setSearch('')}><X size={12} /></button>}
        </div>
      )}

      {/* List */}
      {macros.length === 0 && !editing ? (
        <div className="macros-empty">
          <Play size={28} strokeWidth={1.5} />
          <p>No macros yet. Create one to automate repetitive command sequences.</p>
          <p className="macros-empty-hint">💡 Use {`{ip}`} or {`{vlan}`} in commands to prompt for values at runtime.</p>
          <button className="btn-primary" onClick={openNew}><Plus size={13} /> Create First Macro</button>
        </div>
      ) : (
        <div className="macros-list">
          {filtered.map(m => {
            const isRunning = runState?.macroId === m.id && !runState.done
            const vars = extractVars(m.commands)
            return (
              <div key={m.id} className={`macro-card ${isRunning ? 'running' : ''}`}>
                <div className="mc-top">
                  <div className="mc-info">
                    <div className="mc-name-row">
                      <div className="mc-name">{m.name}</div>
                      {m.category && <span className="mc-tag">{m.category}</span>}
                      {m.hotkey  && <span className="mc-hotkey"><Keyboard size={9} /> {m.hotkey}</span>}
                      {vars.length > 0 && <span className="mc-vars-badge"><Variable size={9} /> {vars.length} var{vars.length > 1 ? 's' : ''}</span>}
                    </div>
                    {m.description && <div className="mc-desc">{m.description}</div>}
                    <div className="mc-meta">{m.commands.length} step{m.commands.length !== 1 ? 's' : ''}</div>
                  </div>
                  <div className="mc-actions">
                    <button
                      className={`mc-btn run ${!canRun ? 'disabled' : ''} ${isRunning ? 'running' : ''}`}
                      onClick={() => isRunning ? stopRun() : handleRun(m)}
                      data-tooltip={canRun ? (isRunning ? 'Stop' : 'Run macro') : 'Connect to a session first'}
                      disabled={!canRun}
                    >
                      {isRunning
                        ? <><Loader size={11} className="spin" /> Running</>
                        : <><Play size={12} fill="currentColor" /> Run</>
                      }
                    </button>
                    <button className="mc-btn" data-tooltip="Edit" onClick={() => openEdit(m)}><Edit3 size={12} /></button>
                    <button className="mc-btn danger" data-tooltip="Delete" onClick={() => deleteMacro(m.id)}><Trash2 size={12} /></button>
                    <button className="mc-btn" onClick={() => setExpanded(e => ({ ...e, [m.id]: !e[m.id] }))}>
                      {expanded[m.id] ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                    </button>
                  </div>
                </div>
                {expanded[m.id] && (
                  <div className="mc-steps">
                    {m.commands.map((c, i) => (
                      <div key={i} className={`mc-step ${isRunning && runState?.step === i + 1 ? 'active' : ''}`}>
                        <span className="mc-step-num">{i + 1}</span>
                        <code className="mc-step-cmd">{c.cmd}</code>
                        {c.delay > 0 && <span className="mc-step-delay"><Clock size={10} />{c.delay}ms</span>}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
          {filtered.length === 0 && search && (
            <div className="macros-empty" style={{ marginTop: 20 }}>
              <p>No macros match "{search}"</p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
