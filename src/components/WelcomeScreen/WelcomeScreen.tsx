import { useState } from 'react'
import { Plus, Terminal, ArrowRight, Zap, Shield, Cpu, GitBranch, Radio, Bot, ChevronRight } from 'lucide-react'
import { useStore } from '../../store/appStore'
import './WelcomeScreen.css'

const STEPS = [
  {
    icon: Plus,
    title: 'Add your first session',
    desc: 'Click "New Session" to add an SSH, Telnet, or Serial connection.',
    action: 'new-session',
    actionLabel: 'New Session',
  },
  {
    icon: Bot,
    title: 'Configure AI',
    desc: 'Add your OpenAI, Anthropic, or Gemini API key — or use local Ollama.',
    action: 'settings',
    actionLabel: 'Open Settings',
  },
  {
    icon: Terminal,
    title: 'Connect & explore',
    desc: 'Double-click any session to connect. Ask Helix AI anything about your output.',
    action: null,
    actionLabel: null,
  },
]

const CAPABILITIES = [
  { Icon: Shield,    label: 'SSH',             desc: 'Password, key file, SSH agent, MFA' },
  { Icon: Radio,     label: 'Telnet',           desc: 'Full IAC negotiation, NAWS sizing' },
  { Icon: Cpu,       label: 'Serial / COM',     desc: 'Cisco console cable via USB adapter' },
  { Icon: GitBranch, label: 'Jump Host',        desc: 'Bastion / ProxyJump chain' },
  { Icon: Bot,       label: 'Helix AI',         desc: 'GPT-4o · Claude · Gemini · Ollama' },
  { Icon: Zap,       label: 'Macros',           desc: 'Automate multi-step command flows' },
]

export default function WelcomeScreen() {
  const { setShowNewSessionModal, setActiveView, sessions, addTab } = useStore()
  const [hovered, setHovered] = useState<number | null>(null)

  const recent = sessions
    .filter(s => s.lastConnected)
    .sort((a, b) => (b.lastConnected || 0) - (a.lastConnected || 0))
    .slice(0, 4)

  const hasNoSessions = sessions.length === 0

  const handleStep = (action: string | null) => {
    if (action === 'new-session') setShowNewSessionModal(true)
    if (action === 'settings')   setActiveView('settings')
  }

  const envColor = (env: string) =>
    env === 'production' ? 'var(--env-prod)'
    : env === 'staging'  ? 'var(--env-staging)'
    : env === 'lab'      ? 'var(--env-lab)'
    : 'var(--text-muted)'

  return (
    <div className="welcome">

      {/* ── Hero ── */}
      <div className="welcome-hero">
        <div className="hero-logo">
          <svg width="44" height="44" viewBox="0 0 44 44" fill="none">
            <rect width="44" height="44" rx="13" fill="url(#hbg)"/>
            <path d="M10 12 Q22 19 34 12" stroke="white" strokeWidth="2.5" strokeLinecap="round" fill="none"/>
            <path d="M10 22 Q22 29 34 22" stroke="white" strokeWidth="2.5" strokeLinecap="round" fill="none" opacity="0.75"/>
            <path d="M10 32 Q22 39 34 32" stroke="white" strokeWidth="2.5" strokeLinecap="round" fill="none" opacity="0.45"/>
            <defs>
              <linearGradient id="hbg" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%"   stopColor="#2563eb"/>
                <stop offset="100%" stopColor="#7c3aed"/>
              </linearGradient>
            </defs>
          </svg>
        </div>
        <h1 className="hero-title">Welcome to Helix</h1>
        <p className="hero-sub">The AI-powered network terminal built for engineers who move fast.</p>

        <div className="hero-actions">
          <button className="btn-primary hero-btn" onClick={() => setShowNewSessionModal(true)}>
            <Plus size={14} /> New Session
          </button>
          <button className="btn-secondary hero-btn" onClick={() => addTab()}>
            <Terminal size={14} /> Local Shell
          </button>
        </div>
      </div>

      {/* ── First-run onboarding (only if no sessions yet) ── */}
      {hasNoSessions && (
        <div className="section">
          <div className="section-label">Get started in 3 steps</div>
          <div className="onboarding-steps">
            {STEPS.map((step, i) => {
              const Icon = step.icon
              return (
                <div
                  key={i}
                  className={`onboard-card ${hovered === i ? 'hovered' : ''} ${step.action ? 'clickable' : ''}`}
                  onMouseEnter={() => setHovered(i)}
                  onMouseLeave={() => setHovered(null)}
                  onClick={() => handleStep(step.action)}
                >
                  <div className="onboard-num">{i + 1}</div>
                  <div className="onboard-icon"><Icon size={16} strokeWidth={1.75} /></div>
                  <div className="onboard-body">
                    <div className="onboard-title">{step.title}</div>
                    <div className="onboard-desc">{step.desc}</div>
                  </div>
                  {step.actionLabel && (
                    <div className="onboard-cta">
                      {step.actionLabel} <ChevronRight size={12} />
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* ── Recent sessions (shown once sessions exist) ── */}
      {recent.length > 0 && (
        <div className="section">
          <div className="section-label">Recent</div>
          <div className="recent-list">
            {recent.map(s => (
              <button key={s.id} className="recent-card" onClick={() => addTab(s.id)} style={{ borderLeftColor: envColor(s.env), borderLeftWidth: '3px' }}>
                <div className="recent-info">
                  <div className="recent-name">{s.name}</div>
                  <div className="recent-host font-mono">
                    {s.username ? `${s.username}@` : ''}{s.host}
                  </div>
                </div>
                <ArrowRight size={13} className="recent-arrow" />
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── Capabilities grid (always shown) ── */}
      <div className="section">
        <div className="section-label">{hasNoSessions ? 'What Helix supports' : 'Capabilities'}</div>
        <div className="feature-grid">
          {CAPABILITIES.map(({ Icon, label, desc }, i) => (
            <div key={i} className="feature-card">
              <div className="feature-icon"><Icon size={14} strokeWidth={1.75} /></div>
              <div>
                <div className="feature-name">{label}</div>
                <div className="feature-desc">{desc}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Tip ── */}
      <div className="welcome-tip">
        <kbd>⌘K</kbd> Command Palette &nbsp;·&nbsp;
        <kbd>⌘T</kbd> New Tab &nbsp;·&nbsp;
        <kbd>⌘⇧B</kbd> Broadcast &nbsp;·&nbsp;
        <kbd>⌘L</kbd> Lock
      </div>

    </div>
  )
}
