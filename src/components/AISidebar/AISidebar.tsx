import { useState, useRef, useEffect, useCallback } from 'react'
import { Bot, Trash2, Settings, Send, Sparkles, AlertTriangle, Wrench,
         AlignLeft, Network, Radio, CornerDownLeft, Copy, Check } from 'lucide-react'
import { useStore, ChatMessage, AIProvider } from '../../store/appStore'
import './AISidebar.css'

declare global {
  interface Window {
    helixAPI?: any
  }
}

const PROVIDER_NAMES: Record<AIProvider, string> = {
  openai:    'OpenAI',
  anthropic: 'Anthropic',
  google:    'Gemini',
  ollama:    'Ollama',
}

const QUICK_ACTIONS = [
  { Icon: AlignLeft,     label: 'Explain output',  prompt: 'Explain the current terminal output in plain English.' },
  { Icon: AlertTriangle, label: 'Find errors',      prompt: 'Find any errors, warnings or anomalies in the terminal output and explain them.' },
  { Icon: Wrench,        label: 'Suggest fix',      prompt: 'Based on the terminal output, what might be wrong and how do I fix it? Provide step-by-step commands.' },
  { Icon: AlignLeft,     label: 'Summarize',        prompt: 'Give me a brief summary of what is shown in the terminal output.' },
  { Icon: Network,       label: 'Generate config',  prompt: 'Help me generate a network device configuration. Ask me what I need.' },
  { Icon: Radio,         label: 'BGP help',         prompt: 'Help me troubleshoot BGP. Ask me what information you need to diagnose the issue.' },
]

function timeStr(ts: number) {
  return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

function MessageBubble({ msg }: { msg: ChatMessage }) {
  const isUser = msg.role === 'user'
  const [copied, setCopied] = useState(false)
  const { setPendingInsert, tabs, activeTabId } = useStore()

  const activeTab = tabs.find(t => t.id === activeTabId)
  const canInsert = activeTab?.isConnected

  const copyText = () => {
    navigator.clipboard.writeText(msg.content)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  // Extract first code block command for insert
  const extractCommand = (text: string) => {
    const m = text.match(/`([^`\n]+)`/)
    return m?.[1] || text.split('\n').find(l => l.trim().startsWith('$') || l.trim().startsWith('#'))?.replace(/^[$#]\s*/, '') || ''
  }

  const insertToTerminal = () => {
    const cmd = extractCommand(msg.content)
    if (cmd) setPendingInsert(cmd + '\n')
  }

  return (
    <div className={`msg-wrap ${isUser ? 'user' : 'ai'}`}>
      {!isUser && (
        <div className="msg-avatar">
          <Bot size={11} strokeWidth={2} />
        </div>
      )}
      <div className={`msg-bubble ${isUser ? 'user' : 'ai'}`}>
        {msg.isLoading && !msg.content ? (
          <div className="typing"><span /><span /><span /></div>
        ) : (
          <div className="msg-text">
            {formatContent(msg.content)}
          </div>
        )}
        <div className="msg-meta">
          <span className="msg-time">{timeStr(msg.timestamp)}</span>
          {!isUser && msg.content && !msg.isLoading && (
            <div className="msg-actions">
              <button className="msg-act-btn" onClick={copyText} title="Copy">
                {copied ? <Check size={10} /> : <Copy size={10} />}
              </button>
              {canInsert && (
                <button className="msg-act-btn insert" onClick={insertToTerminal} title="Insert command to terminal">
                  <CornerDownLeft size={10} />
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function formatContent(text: string) {
  const lines = text.split('\n')
  const out: React.ReactNode[] = []
  let inCode = false
  let codeLines: string[] = []
  let codeLang = ''

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    if (line.startsWith('```')) {
      if (inCode) {
        out.push(<pre key={i} className="msg-codeblock"><code>{codeLines.join('\n')}</code></pre>)
        codeLines = []
        inCode = false
      } else {
        inCode = true
        codeLang = line.slice(3).trim()
      }
    } else if (inCode) {
      codeLines.push(line)
    } else if (line.startsWith('# '))    out.push(<h4 key={i} className="msg-h">{line.slice(2)}</h4>)
    else if (line.startsWith('## '))   out.push(<h5 key={i} className="msg-h">{line.slice(3)}</h5>)
    else if (line.startsWith('- ') || line.startsWith('• '))
      out.push(<div key={i} className="msg-li">• {inlineFormat(line.slice(2))}</div>)
    else if (line.trim() === '')       out.push(<br key={i} />)
    else                              out.push(<p key={i} className="msg-p">{inlineFormat(line)}</p>)
  }
  return out
}

function inlineFormat(text: string) {
  const parts = text.split(/(`[^`]+`)/)
  return parts.map((p, i) =>
    p.startsWith('`') && p.endsWith('`')
      ? <code key={i} className="msg-code">{p.slice(1, -1)}</code>
      : p
  )
}

export default function AISidebar() {
  const { chatMessages, addChatMessage, updateLastMessage,
    clearChat, aiSettings, tabs, activeTabId, setActiveView } = useStore()

  const [input, setInput]   = useState('')
  const [loading, setLoading] = useState(false)
  const endRef   = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const api = window.helixAPI

  const activeTab = tabs.find(t => t.id === activeTabId)
  const termCtx   = activeTab?.terminalOutput.slice(-aiSettings.contextLines).join('').slice(-8000) || ''

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [chatMessages])

  const hasKey = () => {
    const { provider, openaiKey, anthropicKey, googleKey } = aiSettings
    if (provider === 'openai')    return !!openaiKey
    if (provider === 'anthropic') return !!anthropicKey
    if (provider === 'google')    return !!googleKey
    return true // ollama — no key needed
  }

  const buildMessages = (userText: string) => {
    const system = `You are Helix AI, an expert network engineer assistant embedded in a terminal application.
You help with Cisco IOS/IOS-XE/NX-OS, Juniper JunOS, Arista EOS, and Linux networking.
Be concise, practical, and accurate. Wrap commands in backticks. Wrap multi-line configs in \`\`\`\`\`.
${termCtx ? `\nCurrent terminal output context:\n\`\`\`\n${termCtx}\n\`\`\`` : ''}`

    return [
      { role: 'system', content: system },
      ...chatMessages.filter(m => !m.isLoading && m.content).map(m => ({ role: m.role, content: m.content })),
      { role: 'user', content: userText },
    ]
  }

  const sendMessage = useCallback(async (text: string) => {
    if (!text.trim() || loading) return
    setInput('')
    setLoading(true)

    addChatMessage({ role: 'user', content: text })
    const streamId = `stream-${Date.now()}`
    addChatMessage({ role: 'assistant', content: '', isLoading: true, streamId })

    const messages = buildMessages(text)

    try {
      if (api) {
        const result = await api.aiChat({
          provider: aiSettings.provider,
          apiKey:   aiSettings[`${aiSettings.provider}Key` as keyof typeof aiSettings],
          model:    aiSettings[`${aiSettings.provider}Model` as keyof typeof aiSettings],
          baseUrl:  aiSettings.ollamaBase,
          messages,
        })

        if (result.streamId) {
          // Streaming path — patch messages by streamId
          const sid = result.streamId
          // Update the placeholder to carry the real streamId from main
          useStore.setState(st => ({
            chatMessages: st.chatMessages.map(m =>
              m.streamId === streamId ? { ...m, streamId: sid, isLoading: false } : m
            )
          }))

          const unsubChunk = api.onAIStreamChunk(({ streamId: chunkSid, delta }: any) => {
            if (chunkSid !== sid) return
            useStore.setState(st => ({
              chatMessages: st.chatMessages.map(m =>
                m.streamId === sid ? { ...m, content: m.content + delta } : m
              )
            }))
          })

          const unsubDone = api.onAIStreamDone(({ streamId: doneSid, content }: any) => {
            if (doneSid !== sid) return
            unsubChunk()
            unsubDone()
            useStore.setState(st => ({
              chatMessages: st.chatMessages.map(m =>
                m.streamId === sid ? { ...m, content: content || m.content, isLoading: false } : m
              )
            }))
            setLoading(false)
          })
        } else if (result.error) {
          updateLastMessage({ content: `Error: ${result.error}`, isLoading: false })
          setLoading(false)
        } else {
          // Non-streaming (Google, or fallback)
          updateLastMessage({ content: result.content || '', isLoading: false })
          setLoading(false)
        }
      } else {
        // Browser-only preview (no Electron context)
        await new Promise(r => setTimeout(r, 800))
        updateLastMessage({
          content: `AI features are available in the Helix desktop app. Launch with \`npm run dev\` to use ${PROVIDER_NAMES[aiSettings.provider]}.`,
          isLoading: false,
        })
        setLoading(false)
      }
    } catch (e: any) {
      updateLastMessage({ content: `Error: ${e.message}`, isLoading: false })
      setLoading(false)
    }
  }, [loading, chatMessages, aiSettings, termCtx, api, addChatMessage, updateLastMessage])

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(input) }
  }

  // Auto-resize textarea
  const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value)
    e.target.style.height = 'auto'
    e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px'
  }

  return (
    <aside className="ai-sidebar">

      {/* Header */}
      <div className="ai-header">
        <div className="ai-header-left">
          <div className="ai-avatar"><Bot size={14} strokeWidth={1.75} /></div>
          <div>
            <div className="ai-name">Helix AI</div>
            <div className="ai-model">{PROVIDER_NAMES[aiSettings.provider]}</div>
          </div>
        </div>
        <div className="ai-actions">
          {termCtx && (
            <div className="ctx-pill" title={`Sending last ${aiSettings.contextLines} terminal lines as context`}>
              <span className="ctx-dot" />
              ctx
            </div>
          )}
          <button className="icon-btn" onClick={clearChat} title="Clear chat"><Trash2 size={13} /></button>
          <button className="icon-btn" onClick={() => setActiveView('settings')} title="AI Settings"><Settings size={13} /></button>
        </div>
      </div>

      {/* API key warning */}
      {!hasKey() && (
        <button className="key-warning" onClick={() => setActiveView('settings')}>
          <AlertTriangle size={12} />
          <span>Add API key to enable AI</span>
          <span className="key-warning-cta">Configure →</span>
        </button>
      )}

      {/* Chat */}
      <div className="chat-area scrollable">
        {chatMessages.length === 0 ? (
          <div className="empty-chat">
            <div className="empty-icon"><Sparkles size={22} strokeWidth={1.5} /></div>
            <div className="empty-title">Helix AI</div>
            <div className="empty-sub">
              {hasKey()
                ? 'Your AI network engineer. Ask about CLI output, configs, or troubleshooting.'
                : 'Add your API key in Settings to start using AI assistance.'}
            </div>
            {hasKey() ? (
              <div className="quick-grid">
                {QUICK_ACTIONS.map(({ Icon, label, prompt }, i) => (
                  <button key={i} className="quick-btn" onClick={() => sendMessage(prompt)}>
                    <Icon size={12} strokeWidth={1.75} />
                    <span>{label}</span>
                  </button>
                ))}
              </div>
            ) : (
              <button className="configure-key-btn" onClick={() => setActiveView('settings')}>
                Configure API Key →
              </button>
            )}
          </div>
        ) : (
          <div className="msg-list">
            {chatMessages.map(msg => <MessageBubble key={msg.id} msg={msg} />)}
            <div ref={endRef} />
          </div>
        )}
      </div>

      {/* Input */}
      <div className="ai-input-area">
        <div className="input-box">
          <textarea
            ref={inputRef}
            className="ai-textarea"
            placeholder={hasKey() ? 'Ask Helix AI…  (⏎ send, ⇧⏎ newline)' : 'Configure API key first…'}
            value={input}
            onChange={handleInput}
            onKeyDown={handleKey}
            disabled={loading}
            rows={1}
          />
          <button
            className={`send-btn ${loading ? 'loading' : ''}`}
            onClick={() => sendMessage(input)}
            disabled={loading || !input.trim()}
            title="Send"
          >
            {loading
              ? <span className="spin-icon">⟳</span>
              : <Send size={13} strokeWidth={2} />
            }
          </button>
        </div>
        <div className="input-hint">
          {PROVIDER_NAMES[aiSettings.provider]} · {aiSettings.contextLines} lines ctx
          {activeTab?.isConnected && ' · ⌘↵ Insert to terminal'}
        </div>
      </div>
    </aside>
  )
}
