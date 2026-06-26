import { create } from 'zustand'

// ── Types ─────────────────────────────────────────────────────────────────────
export type EnvTag     = 'production' | 'staging' | 'lab' | 'dev' | 'none'
export type AuthMethod = 'password' | 'key' | 'agent'
export type Protocol   = 'SSH' | 'Telnet' | 'Serial'
export type AIProvider = 'openai' | 'anthropic' | 'google' | 'ollama'
export type SplitLayout= 'single' | 'horizontal' | 'vertical' | 'quad'

export interface JumpHost {
  host: string; port: number; username: string
  password?: string; privateKey?: string; passphrase?: string
}

export interface PortForward {
  id: string; sessionId: string
  type: 'local' | 'remote'; localPort: number
  remoteHost: string; remotePort: number; active: boolean
}

export interface Credential {
  id: string
  name: string
  username: string
  authMethod: AuthMethod
  password?: string
  privateKey?: string
  passphrase?: string
}

export interface Session {
  id: string; name: string; host: string; port: number
  username: string; protocol: Protocol; authMethod: AuthMethod
  credentialId?: string
  password?: string; privateKey?: string; passphrase?: string
  group: string; env: EnvTag; lastConnected?: number
  color?: string; notes?: string
  // SSH advanced
  jumpHost?: JumpHost
  socksProxy?: { host: string; port: number; type: 4 | 5 }
  agentForwarding?: boolean
  keepaliveInterval?: number
  verifyHost?: boolean
  // per-session appearance
  fontFamily?: string; fontSize?: number; cursorStyle?: string; scrollback?: number
  // Serial-specific
  serialPath?: string; baudRate?: number; dataBits?: number
  stopBits?: number; parity?: 'none' | 'even' | 'odd'
  // Button bar
  buttons?: ButtonBarItem[]
}

export interface ButtonBarItem {
  id: string; label: string; command: string; color?: string
}

export interface MacroCommand { cmd: string; delay: number }
export interface Macro {
  id: string; name: string; description?: string
  commands: MacroCommand[]
  hotkey?: string          // e.g. 'ctrl+shift+1'
  variables?: string[]     // extracted variable names like ['ip', 'vlan']
  category?: string
}

export interface HighlightRule {
  id: string; pattern: string; color: string; bg: string; enabled: boolean
}

export interface Tab {
  id: string; ptyId: string
  sessionId: string | null; title: string
  isConnected: boolean; isConnecting: boolean
  connectionError: string | null
  terminalOutput: string[]
  logPath?: string
  panePosition?: 'tl' | 'tr' | 'bl' | 'br' | 'left' | 'right' | 'top' | 'bottom'
}

export interface AISettings {
  provider: AIProvider; openaiKey: string; openaiModel: string
  anthropicKey: string; anthropicModel: string
  googleKey: string; googleModel: string
  ollamaBase: string; ollamaModel: string; contextLines: number
}

export interface TermSettings {
  fontFamily: string; fontSize: number; cursorStyle: string
  scrollback: number; bellEnabled: boolean; autoLog: boolean
}

export interface ChatMessage {
  id: string; role: 'user' | 'assistant' | 'system'
  content: string; timestamp: number
  isLoading?: boolean; streamId?: string
}

export interface SSHHostKeyEvent {
  id: string; host: string; port: number; fingerprint: string; stored?: string
}

export interface KeyboardInteractiveEvent {
  id: string; prompts: { prompt: string; echo: boolean }[]
}

export interface AppState {
  // Sessions
  sessions: Session[]
  selectedSessionId: string | null
  addSession:    (s: Omit<Session, 'id'>) => void
  updateSession: (id: string, u: Partial<Session>) => void
  deleteSession: (id: string) => void
  selectSession: (id: string | null) => void
  cloneSession:  (id: string) => void
  importSessions:(sessions: Session[]) => void

  // Tabs
  tabs: Tab[]; activeTabId: string | null
  splitLayout: SplitLayout
  broadcastMode: boolean
  paneActiveTabIds: Record<number, string | null>
  activePaneIndex: number
  addTab:            (sessionId?: string) => void
  closeTab:          (id: string) => void
  setActiveTab:      (id: string) => void
  updateTab:         (id: string, u: Partial<Tab>) => void
  appendOutput:      (tabId: string, data: string) => void
  setSplitLayout:    (l: SplitLayout) => void
  toggleBroadcast:   () => void
  setPaneActiveTab:  (pane: number, tabId: string | null) => void
  setActivePaneIndex:(pane: number) => void

  // Port forwards
  portForwards: PortForward[]
  addPortForward:    (pf: Omit<PortForward, 'id'>) => void
  removePortForward: (id: string) => void
  updatePortForward: (id: string, u: Partial<PortForward>) => void

  // Credentials
  credentials: Credential[]
  addCredential:    (c: Omit<Credential, 'id'>) => void
  updateCredential: (id: string, u: Partial<Credential>) => void
  deleteCredential: (id: string) => void

  // Macros
  macros: Macro[]
  addMacro:    (m: Omit<Macro, 'id'>) => void
  updateMacro: (id: string, u: Partial<Macro>) => void
  deleteMacro: (id: string) => void

  // Highlights
  highlights: HighlightRule[]
  addHighlight:    (h: Omit<HighlightRule, 'id'>) => void
  updateHighlight: (id: string, u: Partial<HighlightRule>) => void
  deleteHighlight: (id: string) => void

  // AI
  aiSettings: AISettings
  updateAISettings: (s: Partial<AISettings>) => void

  // Terminal Settings
  termSettings: TermSettings
  updateTermSettings: (s: Partial<TermSettings>) => void

  // Chat
  chatMessages: ChatMessage[]
  addChatMessage:    (msg: Omit<ChatMessage, 'id' | 'timestamp'>) => void
  clearChat:         () => void
  updateLastMessage: (u: Partial<ChatMessage>) => void

  // SSH dialogs
  hostKeyEvent:   SSHHostKeyEvent | null
  setHostKeyEvent:(e: SSHHostKeyEvent | null) => void
  kbInteractive:  KeyboardInteractiveEvent | null
  setKbInteractive:(e: KeyboardInteractiveEvent | null) => void

  // UI state
  activeView: 'terminal' | 'sessions' | 'settings' | 'logs' | 'sftp' | 'portfwd' | 'macros' | 'hosts' | 'topology'
  setActiveView:          (v: AppState['activeView']) => void
  showAISidebar:          boolean
  toggleAISidebar:        () => void
  showCommandPalette:     boolean
  toggleCommandPalette:   () => void
  showNewSessionModal:    boolean
  setShowNewSessionModal: (v: boolean) => void
  editingSession:         Session | null
  setEditingSession:      (s: Session | null) => void
  pendingInsert:          string | null
  setPendingInsert:       (s: string | null) => void
  showMacroModal:         boolean
  setShowMacroModal:      (v: boolean) => void
  showPortFwdModal:       boolean
  setShowPortFwdModal:    (v: boolean) => void
  isLocked:               boolean
  lockSession:            () => void
  unlockSession:          (pin: string) => boolean
  lockPin:                string
  setLockPin:             (pin: string) => void
}

// ── Defaults ──────────────────────────────────────────────────────────────────
const DEFAULT_AI: AISettings = {
  provider: 'openai', openaiKey: '', openaiModel: 'gpt-4o-mini',
  anthropicKey: '', anthropicModel: 'claude-3-5-haiku-20241022',
  googleKey: '', googleModel: 'gemini-1.5-flash',
  ollamaBase: 'http://localhost:11434', ollamaModel: 'llama3',
  contextLines: 60,
}

const DEFAULT_TERM: TermSettings = {
  fontFamily: 'JetBrains Mono', fontSize: 13, cursorStyle: 'block',
  scrollback: 10000, bellEnabled: false, autoLog: false,
}

const DEFAULT_HIGHLIGHTS: HighlightRule[] = [
  { id: 'h1', pattern: 'error|Error|ERROR|FAILED|failed',      color: '#ef4444', bg: 'transparent', enabled: true },
  { id: 'h2', pattern: 'warn|Warn|WARNING|warning',             color: '#f59e0b', bg: 'transparent', enabled: true },
  { id: 'h3', pattern: 'success|SUCCESS|Connected|connected',   color: '#22c55e', bg: 'transparent', enabled: true },
  { id: 'h4', pattern: 'down|DOWN|unreachable|UNREACHABLE',      color: '#ef4444', bg: 'transparent', enabled: true },
  { id: 'h5', pattern: '\\d{1,3}\\.\\d{1,3}\\.\\d{1,3}\\.\\d{1,3}', color: '#60a5fa', bg: 'transparent', enabled: true },
]

const DEMO_SESSIONS: Session[] = []

let tabCounter = 1
const mkTabId  = () => `tab-${tabCounter++}`
const mkPtyId  = () => `pty-${crypto.randomUUID()}`

async function loadFromStore<T>(key: string, fallback: T): Promise<T> {
  try {
    const val = await (window as any).helixAPI?.storeGet(key)
    return (val ?? fallback) as T
  } catch { return fallback }
}

// ── Store ─────────────────────────────────────────────────────────────────────
export const useStore = create<AppState>((set, get) => ({
  // Sessions
  sessions: DEMO_SESSIONS,
  selectedSessionId: null,
  addSession: (s) => {
    const session = { ...s, id: crypto.randomUUID(), verifyHost: s.verifyHost ?? true, keepaliveInterval: s.keepaliveInterval ?? 30000 }
    set(st => { const sessions = [...st.sessions, session]; persist('sessions', sessions); return { sessions } })
  },
  updateSession: (id, u) => set(st => {
    const sessions = st.sessions.map(s => s.id === id ? { ...s, ...u } : s)
    persist('sessions', sessions); return { sessions }
  }),
  deleteSession: (id) => set(st => {
    const sessions = st.sessions.filter(s => s.id !== id)
    persist('sessions', sessions); return { sessions }
  }),
  selectSession: (id) => set({ selectedSessionId: id }),
  cloneSession: (id) => {
    const src = get().sessions.find(s => s.id === id)
    if (!src) return
    get().addSession({ ...src, name: `${src.name} (copy)`, lastConnected: undefined })
  },
  importSessions: (incoming) => set(st => {
    // Merge: skip sessions with same host+port+username that already exist
    const existing = new Set(st.sessions.map(s => `${s.host}:${s.port}:${s.username}`))
    const newOnes  = incoming
      .filter(s => !existing.has(`${s.host}:${s.port}:${s.username}`))
      .map(s => ({ ...s, id: crypto.randomUUID() }))
    const sessions = [...st.sessions, ...newOnes]
    persist('sessions', sessions)
    return { sessions }
  }),

  // Credentials
  credentials: [],
  addCredential: (c) => set(st => {
    const credentials = [...st.credentials, { ...c, id: crypto.randomUUID() }]
    persist('credentials', credentials); return { credentials }
  }),
  updateCredential: (id, u) => set(st => {
    const credentials = st.credentials.map(c => c.id === id ? { ...c, ...u } : c)
    persist('credentials', credentials); return { credentials }
  }),
  deleteCredential: (id) => set(st => {
    const credentials = st.credentials.filter(c => c.id !== id)
    const sessions = st.sessions.map(s => s.credentialId === id ? { ...s, credentialId: undefined } : s)
    persist('credentials', credentials)
    persist('sessions', sessions)
    return { credentials, sessions }
  }),

  // Tabs
  tabs: [], activeTabId: null,
  splitLayout: 'single', broadcastMode: false,
  paneActiveTabIds: { 0: null, 1: null, 2: null, 3: null },
  activePaneIndex: 0,
  addTab: (sessionId) => {
    const id    = mkTabId()
    const ptyId = mkPtyId()
    const session = sessionId ? get().sessions.find(s => s.id === sessionId) : null
    const tab: Tab = {
      id, ptyId, sessionId: sessionId || null,
      title: session?.name || 'Terminal',
      isConnected: false, isConnecting: false, connectionError: null,
      terminalOutput: [],
    }
    set(st => {
      const paneIdx = st.splitLayout !== 'single' ? st.activePaneIndex : 0
      return {
        tabs: [...st.tabs, tab],
        activeTabId: id,
        paneActiveTabIds: { ...st.paneActiveTabIds, [paneIdx]: id },
      }
    })
  },
  closeTab: (id) => set(st => {
    const tabs      = st.tabs.filter(t => t.id !== id)
    const activeTabId = st.activeTabId === id ? (tabs[tabs.length - 1]?.id || null) : st.activeTabId
    // Remove closed tab from any pane assignments
    const paneActiveTabIds = { ...st.paneActiveTabIds }
    for (const k in paneActiveTabIds) {
      if (paneActiveTabIds[Number(k)] === id) {
        paneActiveTabIds[Number(k)] = tabs[0]?.id || null
      }
    }
    return { tabs, activeTabId, paneActiveTabIds }
  }),
  setActiveTab:   (id) => set({ activeTabId: id }),
  updateTab:      (id, u) => set(st => ({ tabs: st.tabs.map(t => t.id === id ? { ...t, ...u } : t) })),
  appendOutput:   (tabId, data) => set(st => ({
    tabs: st.tabs.map(t => t.id === tabId
      ? { ...t, terminalOutput: [...t.terminalOutput.slice(-500), data] }
      : t)
  })),
  setSplitLayout: (l) => set(st => {
    // Auto-assign existing tabs to panes when switching layout
    const paneCount = l === 'quad' ? 4 : l === 'single' ? 1 : 2
    const paneActiveTabIds = { ...st.paneActiveTabIds }
    for (let i = 0; i < paneCount; i++) {
      if (!paneActiveTabIds[i] || !st.tabs.find(t => t.id === paneActiveTabIds[i])) {
        paneActiveTabIds[i] = st.tabs[i]?.id || null
      }
    }
    return { splitLayout: l, paneActiveTabIds }
  }),
  toggleBroadcast:    () => set(st => ({ broadcastMode: !st.broadcastMode })),
  setPaneActiveTab:   (pane, tabId) => set(st => ({ paneActiveTabIds: { ...st.paneActiveTabIds, [pane]: tabId }, activeTabId: tabId })),
  setActivePaneIndex: (pane) => set(st => ({ activePaneIndex: pane, activeTabId: st.paneActiveTabIds[pane] || st.activeTabId })),

  // Port forwards
  portForwards: [],
  addPortForward:    (pf)    => set(st => ({ portForwards: [...st.portForwards, { ...pf, id: crypto.randomUUID() }] })),
  removePortForward: (id)    => set(st => ({ portForwards: st.portForwards.filter(p => p.id !== id) })),
  updatePortForward: (id, u) => set(st => ({ portForwards: st.portForwards.map(p => p.id === id ? { ...p, ...u } : p) })),

  // Macros
  macros: [],
  addMacro:    (m)    => set(st => { const macros = [...st.macros, { ...m, id: crypto.randomUUID() }]; persist('macros', macros); return { macros } }),
  updateMacro: (id, u)=> set(st => { const macros = st.macros.map(m => m.id === id ? { ...m, ...u } : m); persist('macros', macros); return { macros } }),
  deleteMacro: (id)   => set(st => { const macros = st.macros.filter(m => m.id !== id); persist('macros', macros); return { macros } }),

  // Highlights
  highlights: DEFAULT_HIGHLIGHTS,
  addHighlight:    (h)    => set(st => { const highlights = [...st.highlights, { ...h, id: crypto.randomUUID() }]; persist('highlights', highlights); return { highlights } }),
  updateHighlight: (id, u)=> set(st => { const highlights = st.highlights.map(h => h.id === id ? { ...h, ...u } : h); persist('highlights', highlights); return { highlights } }),
  deleteHighlight: (id)   => set(st => { const highlights = st.highlights.filter(h => h.id !== id); persist('highlights', highlights); return { highlights } }),

  // AI
  aiSettings: DEFAULT_AI,
  updateAISettings: (s) => set(st => { const aiSettings = { ...st.aiSettings, ...s }; persist('aiSettings', aiSettings); return { aiSettings } }),

  // Terminal settings
  termSettings: DEFAULT_TERM,
  updateTermSettings: (s) => set(st => { const termSettings = { ...st.termSettings, ...s }; persist('termSettings', termSettings); return { termSettings } }),

  // Chat
  chatMessages: [],
  addChatMessage:    (msg) => set(st => ({ chatMessages: [...st.chatMessages, { ...msg, id: crypto.randomUUID(), timestamp: Date.now() }] })),
  clearChat:         ()    => set({ chatMessages: [] }),
  updateLastMessage: (u)   => set(st => {
    const msgs = [...st.chatMessages]
    if (msgs.length) msgs[msgs.length - 1] = { ...msgs[msgs.length - 1], ...u }
    return { chatMessages: msgs }
  }),

  // SSH dialogs
  hostKeyEvent:    null,
  setHostKeyEvent: (e) => set({ hostKeyEvent: e }),
  kbInteractive:   null,
  setKbInteractive:(e) => set({ kbInteractive: e }),

  // UI
  activeView:             'terminal',
  setActiveView:          (v) => set({ activeView: v }),
  showAISidebar:          true,
  toggleAISidebar:        () => set(st => ({ showAISidebar: !st.showAISidebar })),
  showCommandPalette:     false,
  toggleCommandPalette:   () => set(st => ({ showCommandPalette: !st.showCommandPalette })),
  showNewSessionModal:    false,
  setShowNewSessionModal: (v) => set({ showNewSessionModal: v }),
  editingSession:         null,
  setEditingSession:      (s) => set({ editingSession: s }),
  pendingInsert:          null,
  setPendingInsert:       (s) => set({ pendingInsert: s }),
  showMacroModal:         false,
  setShowMacroModal:      (v) => set({ showMacroModal: v }),
  showPortFwdModal:       false,
  setShowPortFwdModal:    (v) => set({ showPortFwdModal: v }),

  // Lock
  isLocked:  false,
  lockPin:   '',
  lockSession:  () => set({ isLocked: true }),
  unlockSession:(pin) => {
    const stored = get().lockPin
    if (!stored || pin === stored) { set({ isLocked: false }); return true }
    return false
  },
  setLockPin: (pin) => set({ lockPin: pin }),
}))

// ── Persist helper ────────────────────────────────────────────────────────────
function persist(key: string, value: any) {
  try { (window as any).helixAPI?.storeSet(key, value) } catch {}
}

// ── Hydrate from store on boot ─────────────────────────────────────────────────
async function hydrate() {
  try {
    const [sessions, aiSettings, termSettings, macros, highlights, credentials] = await Promise.all([
      loadFromStore<Session[]>('sessions', []),
      loadFromStore<Partial<AISettings>>('aiSettings', {}),
      loadFromStore<Partial<TermSettings>>('termSettings', {}),
      loadFromStore<Macro[]>('macros', []),
      loadFromStore<HighlightRule[]>('highlights', []),
      loadFromStore<Credential[]>('credentials', []),
    ])
    useStore.setState(st => ({
      sessions:     sessions.length > 0 ? sessions : st.sessions,
      aiSettings:   { ...st.aiSettings, ...aiSettings },
      termSettings: { ...st.termSettings, ...termSettings },
      macros:       macros.length > 0 ? macros : st.macros,
      highlights:   highlights.length > 0 ? highlights : st.highlights,
      credentials:  credentials.length > 0 ? credentials : st.credentials,
    }))
  } catch (e) {
    console.warn('Hydration skipped:', e)
  }
}
setTimeout(hydrate, 100)
