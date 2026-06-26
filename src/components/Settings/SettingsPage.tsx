import { useState } from 'react'
import { Bot, Terminal, Shield, Keyboard, Info, Highlighter, Lock, Plus, Trash2, Eye, EyeOff } from 'lucide-react'
import { useStore, AIProvider, HighlightRule } from '../../store/appStore'
import './SettingsPage.css'

const PROVIDERS: { id: AIProvider; name: string; models: string[]; keyLabel: string; hasBaseUrl?: boolean }[] = [
  { id: 'openai',    name: 'OpenAI',         models: ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo', 'gpt-3.5-turbo'],                               keyLabel: 'API Key (sk-...)' },
  { id: 'anthropic', name: 'Anthropic',       models: ['claude-3-5-sonnet-20241022', 'claude-3-5-haiku-20241022', 'claude-3-opus-20240229'],    keyLabel: 'API Key (sk-ant-...)' },
  { id: 'google',    name: 'Google Gemini',   models: ['gemini-1.5-pro', 'gemini-1.5-flash', 'gemini-2.0-flash'],                               keyLabel: 'API Key (AIza...)' },
  { id: 'ollama',    name: 'Ollama (Local)',  models: ['llama3', 'llama3.1', 'mistral', 'qwen2.5', 'phi3', 'codellama', 'deepseek-r1'],         keyLabel: 'Not required (local)', hasBaseUrl: true },
]

const FONT_FAMILIES = ['JetBrains Mono', 'Fira Code', 'Cascadia Code', 'Menlo', 'Monaco', 'Courier New', 'Consolas']

type SettingsTab = 'ai' | 'terminal' | 'highlights' | 'security' | 'shortcuts' | 'about'

export default function SettingsPage() {
  const {
    aiSettings, updateAISettings,
    termSettings, updateTermSettings,
    highlights, addHighlight, updateHighlight, deleteHighlight,
    isLocked, lockSession, lockPin, setLockPin,
  } = useStore()

  const [activeTab, setActiveTab] = useState<SettingsTab>('ai')
  const [showKeys, setShowKeys]   = useState<Record<string, boolean>>({})
  const [newHl, setNewHl]         = useState({ pattern: '', color: '#ef4444', bg: 'transparent', enabled: true })
  const [pinInput, setPinInput]   = useState(lockPin)
  const [pinSaved, setPinSaved]   = useState(false)

  const currentProvider = PROVIDERS.find(p => p.id === aiSettings.provider)!

  const savePin = () => {
    setLockPin(pinInput)
    setPinSaved(true)
    setTimeout(() => setPinSaved(false), 2000)
  }

  const TABS: { id: SettingsTab; Icon: any; label: string }[] = [
    { id: 'ai',         Icon: Bot,          label: 'AI & Models' },
    { id: 'terminal',   Icon: Terminal,      label: 'Terminal' },
    { id: 'highlights', Icon: Highlighter,   label: 'Highlights' },
    { id: 'security',   Icon: Lock,          label: 'Security' },
    { id: 'shortcuts',  Icon: Keyboard,      label: 'Shortcuts' },
    { id: 'about',      Icon: Info,          label: 'About' },
  ]

  return (
    <div className="settings-page">
      <div className="settings-sidebar">
        <div className="settings-title">Settings</div>
        {TABS.map(({ id, Icon, label }) => (
          <button key={id}
            className={`settings-nav-item ${activeTab === id ? 'active' : ''}`}
            onClick={() => setActiveTab(id)}>
            <Icon size={14} strokeWidth={1.75} />
            <span>{label}</span>
          </button>
        ))}
      </div>

      <div className="settings-content scrollable">

        {/* ── AI ── */}
        {activeTab === 'ai' && (
          <div className="settings-section animate-fade-in">
            <h2 className="settings-section-title">AI & Models</h2>
            <p className="settings-section-desc">Choose your AI provider and enter your API key. Keys are stored locally and never sent to Helix servers.</p>

            <div className="settings-card">
              <div className="settings-label">AI Provider</div>
              <div className="provider-grid">
                {PROVIDERS.map(p => (
                  <button key={p.id}
                    className={`provider-card ${aiSettings.provider === p.id ? 'active' : ''}`}
                    onClick={() => updateAISettings({ provider: p.id })}>
                    <span className="provider-name">{p.name}</span>
                    {aiSettings.provider === p.id && <span className="provider-check">✓</span>}
                  </button>
                ))}
              </div>
            </div>

            <div className="settings-card">
              <div className="settings-label">{currentProvider.keyLabel}</div>
              {currentProvider.id !== 'ollama' ? (
                <div className="key-input-wrap">
                  <input
                    type={showKeys[currentProvider.id] ? 'text' : 'password'}
                    placeholder={`Enter your ${currentProvider.name} API key...`}
                    value={aiSettings[`${currentProvider.id}Key` as keyof typeof aiSettings] as string}
                    onChange={e => updateAISettings({ [`${currentProvider.id}Key`]: e.target.value } as any)}
                    className="settings-input" autoComplete="off" spellCheck={false}
                  />
                  <button className="key-toggle-btn"
                    onClick={() => setShowKeys(k => ({ ...k, [currentProvider.id]: !k[currentProvider.id] }))}>
                    {showKeys[currentProvider.id] ? <EyeOff size={14}/> : <Eye size={14}/>}
                  </button>
                </div>
              ) : (
                <div className="settings-hint">No API key required for local Ollama models.</div>
              )}
            </div>

            {currentProvider.hasBaseUrl && (
              <div className="settings-card">
                <div className="settings-label">Ollama Base URL</div>
                <input type="text" placeholder="http://localhost:11434"
                  value={aiSettings.ollamaBase}
                  onChange={e => updateAISettings({ ollamaBase: e.target.value })}
                  className="settings-input" />
                <div className="settings-hint">Make sure Ollama is running: <code>ollama serve</code></div>
              </div>
            )}

            <div className="settings-card">
              <div className="settings-label">Model</div>
              <select
                value={aiSettings[`${currentProvider.id}Model` as keyof typeof aiSettings] as string}
                onChange={e => updateAISettings({ [`${currentProvider.id}Model`]: e.target.value } as any)}
                className="settings-input">
                {currentProvider.models.map(m => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>

            <div className="settings-card">
              <div className="settings-label">Terminal Context Lines</div>
              <div className="slider-wrap">
                <input type="range" min="20" max="200" step="10"
                  value={aiSettings.contextLines}
                  onChange={e => updateAISettings({ contextLines: parseInt(e.target.value) })}
                  className="settings-slider" />
                <span className="slider-value">{aiSettings.contextLines} lines</span>
              </div>
              <div className="settings-hint">Lines of terminal output sent to AI as context.</div>
            </div>

            <div className="settings-card links-card">
              <div className="settings-label">Get API Keys</div>
              <div className="provider-links">
                <a href="https://platform.openai.com/api-keys" target="_blank" rel="noreferrer">OpenAI Platform →</a>
                <a href="https://console.anthropic.com" target="_blank" rel="noreferrer">Anthropic Console →</a>
                <a href="https://aistudio.google.com" target="_blank" rel="noreferrer">Google AI Studio →</a>
                <a href="https://ollama.com" target="_blank" rel="noreferrer">Ollama (local) →</a>
              </div>
            </div>
          </div>
        )}

        {/* ── Terminal ── */}
        {activeTab === 'terminal' && (
          <div className="settings-section animate-fade-in">
            <h2 className="settings-section-title">Terminal</h2>
            <p className="settings-section-desc">Global terminal appearance and behaviour. Override per-session in session settings.</p>

            <div className="settings-card">
              <div className="settings-label">Font Family</div>
              <select className="settings-input" value={termSettings.fontFamily}
                onChange={e => updateTermSettings({ fontFamily: e.target.value })}>
                {FONT_FAMILIES.map(f => <option key={f} value={f}>{f}</option>)}
              </select>
            </div>

            <div className="settings-card">
              <div className="settings-label">Font Size</div>
              <div className="slider-wrap">
                <input type="range" min="10" max="22" step="1"
                  value={termSettings.fontSize}
                  onChange={e => updateTermSettings({ fontSize: parseInt(e.target.value) })}
                  className="settings-slider" />
                <span className="slider-value">{termSettings.fontSize}px</span>
              </div>
            </div>

            <div className="settings-card">
              <div className="settings-label">Cursor Style</div>
              <select className="settings-input" value={termSettings.cursorStyle}
                onChange={e => updateTermSettings({ cursorStyle: e.target.value })}>
                <option value="block">Block</option>
                <option value="bar">Bar</option>
                <option value="underline">Underline</option>
              </select>
            </div>

            <div className="settings-card">
              <div className="settings-label">Scrollback Lines</div>
              <div className="slider-wrap">
                <input type="range" min="1000" max="50000" step="1000"
                  value={termSettings.scrollback}
                  onChange={e => updateTermSettings({ scrollback: parseInt(e.target.value) })}
                  className="settings-slider" />
                <span className="slider-value">{termSettings.scrollback.toLocaleString()}</span>
              </div>
            </div>

            <div className="settings-card">
              <div className="settings-label">Behaviour</div>
              <label className="toggle-wrap">
                <input type="checkbox" checked={termSettings.bellEnabled}
                  onChange={e => updateTermSettings({ bellEnabled: e.target.checked })} />
                <span>Terminal bell sound</span>
              </label>
              <label className="toggle-wrap" style={{ marginTop: 8 }}>
                <input type="checkbox" checked={termSettings.autoLog}
                  onChange={e => updateTermSettings({ autoLog: e.target.checked })} />
                <span>Auto-start logging on connect</span>
              </label>
            </div>
          </div>
        )}

        {/* ── Highlights ── */}
        {activeTab === 'highlights' && (
          <div className="settings-section animate-fade-in">
            <h2 className="settings-section-title">Keyword Highlighting</h2>
            <p className="settings-section-desc">Automatically colorize matching text in terminal output. Supports regex patterns.</p>

            <div className="highlights-list">
              {highlights.map((h: HighlightRule) => (
                <div key={h.id} className="hl-row">
                  <div className="hl-swatch" style={{ background: h.color }} />
                  <input className="hl-pattern font-mono" value={h.pattern}
                    onChange={e => updateHighlight(h.id, { pattern: e.target.value })} />
                  <input type="color" value={h.color}
                    onChange={e => updateHighlight(h.id, { color: e.target.value })}
                    className="hl-color-input" title="Text color" />
                  <label className="toggle-wrap compact">
                    <input type="checkbox" checked={h.enabled}
                      onChange={e => updateHighlight(h.id, { enabled: e.target.checked })} />
                  </label>
                  <button className="hl-rm" onClick={() => deleteHighlight(h.id)}>
                    <Trash2 size={12} />
                  </button>
                </div>
              ))}
            </div>

            <div className="hl-add-row">
              <div className="hl-swatch" style={{ background: newHl.color }} />
              <input className="hl-pattern font-mono" placeholder="Regex pattern, e.g. ERROR|FAIL"
                value={newHl.pattern} onChange={e => setNewHl(n => ({ ...n, pattern: e.target.value }))} />
              <input type="color" value={newHl.color}
                onChange={e => setNewHl(n => ({ ...n, color: e.target.value }))}
                className="hl-color-input" />
              <button className="btn-primary hl-add-btn"
                onClick={() => { if (!newHl.pattern.trim()) return; addHighlight(newHl); setNewHl({ pattern: '', color: '#ef4444', bg: 'transparent', enabled: true }) }}
                disabled={!newHl.pattern.trim()}>
                <Plus size={12} /> Add
              </button>
            </div>
            <div className="settings-hint">Patterns are matched as case-sensitive regular expressions.</div>
          </div>
        )}

        {/* ── Security ── */}
        {activeTab === 'security' && (
          <div className="settings-section animate-fade-in">
            <h2 className="settings-section-title">Security</h2>

            <div className="settings-card">
              <div className="settings-label">Session Lock</div>
              <p className="settings-section-desc" style={{ marginBottom: 12 }}>
                Lock Helix with a PIN (⌘L). Useful when stepping away from your terminal.
              </p>
              <div className="key-input-wrap" style={{ maxWidth: 240 }}>
                <input type="password" placeholder="Set lock PIN (leave empty for no PIN)"
                  value={pinInput} onChange={e => setPinInput(e.target.value)}
                  maxLength={32} className="settings-input" />
              </div>
              <div className="settings-actions" style={{ marginTop: 10 }}>
                <button className="btn-primary" onClick={savePin}>
                  {pinSaved ? '✓ Saved' : 'Save PIN'}
                </button>
                <button className="btn-secondary" onClick={lockSession} disabled={isLocked}>
                  <Lock size={13} /> Lock Now (⌘L)
                </button>
              </div>
            </div>

            <div className="settings-card">
              <div className="settings-label">SSH Host Key Verification</div>
              <p className="settings-hint">
                Helix verifies SSH host keys by default for all new sessions. You can override this per-session.
                Trusted keys are stored in Settings → <strong>Known Hosts</strong>.
              </p>
            </div>

            <div className="settings-card">
              <div className="settings-label">Credential Storage</div>
              <p className="settings-hint">
                Passwords and keys are stored in an encrypted local store (AES-256).
                On macOS, Helix uses the system Keychain when available.
                Credentials are never transmitted to Helix servers.
              </p>
            </div>
          </div>
        )}

        {/* ── Shortcuts ── */}
        {activeTab === 'shortcuts' && (
          <div className="settings-section animate-fade-in">
            <h2 className="settings-section-title">Keyboard Shortcuts</h2>
            <div className="shortcuts-table">
              {[
                ['⌘K',   'Open Command Palette'],
                ['⌘T',   'New Tab'],
                ['⌘W',   'Close Tab'],
                ['⌘1–9', 'Switch to Tab N'],
                ['⌘,',   'Settings'],
                ['⌘L',   'Lock Session'],
                ['⌘F',   'Find in Terminal'],
                ['⌘⇧A',  'Toggle AI Sidebar'],
                ['⌘⇧S',  'SFTP Browser'],
                ['⌘⇧L',  'Session Logs'],
                ['⌘⇧B',  'Broadcast Mode'],
                ['⌘⇧H',  'Split Horizontal'],
                ['⌘⇧V',  'Split Vertical'],
                ['⌘⇧4',  'Quad Split'],
                ['⌘⇧1',  'Single Pane'],
              ].map(([key, desc]) => (
                <div key={key} className="shortcut-row">
                  <code className="kbd">{key}</code>
                  <span>{desc}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── About ── */}
        {activeTab === 'about' && (
          <div className="settings-section animate-fade-in">
            <div className="about-card">
              <div className="about-logo">
                <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
                  <rect width="48" height="48" rx="12" fill="url(#abg)"/>
                  <path d="M10 10 Q24 20 38 10" stroke="white" strokeWidth="3" strokeLinecap="round" fill="none"/>
                  <path d="M10 22 Q24 32 38 22" stroke="white" strokeWidth="3" strokeLinecap="round" fill="none" opacity="0.8"/>
                  <path d="M10 34 Q24 44 38 34" stroke="white" strokeWidth="3" strokeLinecap="round" fill="none" opacity="0.6"/>
                  <defs>
                    <linearGradient id="abg" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor="#1f6feb"/>
                      <stop offset="100%" stopColor="#a371f7"/>
                    </linearGradient>
                  </defs>
                </svg>
              </div>
              <h2>Helix</h2>
              <p>Version 1.0.0</p>
              <p className="about-desc">AI-powered network terminal for network engineers. SSH, Telnet, Serial — with GPT/Claude/Gemini/Ollama built in.</p>
              <div className="about-features">
                <span>SSH · Telnet · Serial</span>
                <span>OpenAI · Anthropic · Google · Ollama</span>
                <span>Split Pane · Broadcast · Port Forwarding</span>
                <span>SFTP · Macros · Keyword Highlighting</span>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  )
}
