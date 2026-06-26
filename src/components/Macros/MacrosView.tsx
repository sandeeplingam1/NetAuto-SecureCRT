import { useState } from 'react'
import { Plus, Trash2, Play, Edit3, ChevronDown, ChevronUp, GripVertical, Clock } from 'lucide-react'
import { useStore, Macro, MacroCommand } from '../../store/appStore'
import './MacrosView.css'

const api = (window as any).helixAPI

export default function MacrosView() {
  const { macros, addMacro, updateMacro, deleteMacro, tabs, activeTabId } = useStore()
  const [editing, setEditing] = useState<string | null>(null)
  const [form, setForm] = useState<Omit<Macro, 'id'>>({ name: '', description: '', commands: [{ cmd: '', delay: 0 }] })
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})

  const activeTab = tabs.find(t => t.id === activeTabId)
  const canRun = activeTab?.isConnected

  const openNew = () => {
    setForm({ name: '', description: '', commands: [{ cmd: '', delay: 0 }] })
    setEditing('new')
  }

  const openEdit = (m: Macro) => {
    setForm({ name: m.name, description: m.description || '', commands: [...m.commands] })
    setEditing(m.id)
  }

  const save = () => {
    if (!form.name.trim()) return
    if (editing === 'new') addMacro(form)
    else if (editing)      updateMacro(editing, form)
    setEditing(null)
  }

  const runMacro = async (m: Macro) => {
    if (!canRun || !activeTab) return
    await api?.macroRun({ terminalId: activeTab.ptyId, commands: m.commands })
  }

  const addCmd = () => setForm(f => ({ ...f, commands: [...f.commands, { cmd: '', delay: 0 }] }))
  const removeCmd = (i: number) => setForm(f => ({ ...f, commands: f.commands.filter((_, j) => j !== i) }))
  const updateCmd = (i: number, field: keyof MacroCommand, value: string | number) =>
    setForm(f => ({ ...f, commands: f.commands.map((c, j) => j === i ? { ...c, [field]: value } : c) }))

  return (
    <div className="macros-view">
      <div className="macros-header">
        <div>
          <h2>Macros</h2>
          <p>Record and replay command sequences for automation</p>
        </div>
        <button className="btn-primary" onClick={openNew}><Plus size={13} /> New Macro</button>
      </div>

      {editing && (
        <div className="macro-editor animate-fade-in">
          <h3>{editing === 'new' ? 'New Macro' : 'Edit Macro'}</h3>
          <div className="me-row">
            <input placeholder="Macro name *" value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))} className="me-name" />
            <input placeholder="Description (optional)" value={form.description}
              onChange={e => setForm(f => ({ ...f, description: e.target.value }))} className="me-desc" />
          </div>
          <div className="me-commands">
            <div className="me-cmd-header">
              <span>Command</span>
              <span>Delay after (ms)</span>
              <span />
            </div>
            {form.commands.map((c, i) => (
              <div key={i} className="me-cmd-row">
                <GripVertical size={13} className="me-grip" />
                <input
                  className="font-mono me-cmd-input"
                  placeholder="show ip int brief"
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

      {macros.length === 0 && !editing ? (
        <div className="macros-empty">
          <Play size={28} strokeWidth={1.5} />
          <p>No macros yet. Create one to automate repetitive command sequences.</p>
          <button className="btn-primary" onClick={openNew}><Plus size={13} /> Create First Macro</button>
        </div>
      ) : (
        <div className="macros-list">
          {macros.map(m => (
            <div key={m.id} className="macro-card">
              <div className="mc-top">
                <div className="mc-info">
                  <div className="mc-name">{m.name}</div>
                  {m.description && <div className="mc-desc">{m.description}</div>}
                  <div className="mc-meta">{m.commands.length} step{m.commands.length !== 1 ? 's' : ''}</div>
                </div>
                <div className="mc-actions">
                  <button
                    className={`mc-btn run ${!canRun ? 'disabled' : ''}`}
                    onClick={() => runMacro(m)}
                    title={canRun ? 'Run macro' : 'Connect to a session first'}
                    disabled={!canRun}
                  >
                    <Play size={12} fill="currentColor" /> Run
                  </button>
                  <button className="mc-btn" onClick={() => openEdit(m)}><Edit3 size={12} /></button>
                  <button className="mc-btn danger" onClick={() => deleteMacro(m.id)}><Trash2 size={12} /></button>
                  <button className="mc-btn" onClick={() => setExpanded(e => ({ ...e, [m.id]: !e[m.id] }))}>
                    {expanded[m.id] ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                  </button>
                </div>
              </div>
              {expanded[m.id] && (
                <div className="mc-steps">
                  {m.commands.map((c, i) => (
                    <div key={i} className="mc-step">
                      <span className="mc-step-num">{i + 1}</span>
                      <code className="mc-step-cmd">{c.cmd}</code>
                      {c.delay > 0 && <span className="mc-step-delay"><Clock size={10} />{c.delay}ms</span>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
