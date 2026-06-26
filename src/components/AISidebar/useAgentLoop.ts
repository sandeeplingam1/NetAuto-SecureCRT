import { useState, useCallback, useRef } from 'react'
import { useStore, ChatMessage } from '../../store/appStore'

const api = (window as any).helixAPI

export interface AgentApprovalItem {
  id: string
  command: string
  reasoning: string
}

export function useAgentLoop() {
  const { chatMessages, addChatMessage, updateLastMessage, aiSettings, tabs, activeTabId } = useStore()
  const [isAgentRunning, setIsAgentRunning] = useState(false)
  const [pendingApproval, setPendingApproval] = useState<AgentApprovalItem | null>(null)
  const [iteration, setIteration] = useState(0)
  
  const MAX_ITERATIONS = 10
  
  // Ref to hold the latest messages array during loop to avoid stale closures
  const messagesRef = useRef<any[]>([])

  const systemPrompt = `You are Helix Agent, an autonomous network engineering AI.
You have the ability to run commands directly on the user's active terminal session.
When you need information, call the 'run_command' tool.
Before running a command, briefly explain WHY you are running it in the tool call arguments (reasoning).
Do NOT output any markdown blocks of commands if you intend to run them. Call the tool instead.
Only output text when you have completed your analysis or need to ask the user a question.
Keep your reasoning concise (1-2 sentences).`

  const tools = [
    {
      type: 'function',
      function: {
        name: 'run_command',
        description: 'Run a CLI command in the active terminal session and read the output.',
        parameters: {
          type: 'object',
          properties: {
            command: { type: 'string', description: 'The exact CLI command to run (e.g. "show bgp summary")' },
            reasoning: { type: 'string', description: 'A short explanation of why you are running this command' }
          },
          required: ['command', 'reasoning']
        }
      }
    }
  ]

  const stepLoop = async (currentMessages: any[], currentIteration: number) => {
    if (currentIteration >= MAX_ITERATIONS) {
      addChatMessage({ role: 'assistant', content: '⚠️ **Agent stopped:** Reached maximum iteration limit (10).' })
      setIsAgentRunning(false)
      return
    }

    setIteration(currentIteration + 1)
    const st = useStore.getState()
    
    try {
      const res = await api.agentChat({
        provider: st.aiSettings.provider,
        apiKey: st.aiSettings[`${st.aiSettings.provider}Key` as keyof typeof st.aiSettings],
        model: st.aiSettings[`${st.aiSettings.provider}Model` as keyof typeof st.aiSettings],
        baseUrl: st.aiSettings.ollamaBase,
        messages: currentMessages,
        tools
      })
      
      if (res.error) throw new Error(res.error)
      
      const msg = res.message
      currentMessages.push(msg)
      
      if (msg.tool_calls && msg.tool_calls.length > 0) {
        // Handle first tool call (sequential execution)
        const tc = msg.tool_calls[0]
        if (tc.function.name === 'run_command') {
          let args = { command: '', reasoning: '' }
          try { args = JSON.parse(tc.function.arguments) } catch (e) {}
          setPendingApproval({
            id: tc.id,
            command: args.command,
            reasoning: args.reasoning
          })
          // Update the UI placeholder
          updateLastMessage({ isLoading: false, content: '' })
        }
      } else if (msg.content) {
        updateLastMessage({ isLoading: false, content: msg.content })
        setIsAgentRunning(false)
      }
    } catch (e: any) {
      updateLastMessage({ isLoading: false, content: `**Agent Error:** ${e.message}` })
      setIsAgentRunning(false)
    }
  }

  const startAgent = useCallback((userText: string) => {
    if (isAgentRunning) return
    setIsAgentRunning(true)
    setIteration(0)
    setPendingApproval(null)
    
    addChatMessage({ role: 'user', content: userText })
    addChatMessage({ role: 'assistant', content: '', isLoading: true })
    
    const activeTab = useStore.getState().tabs.find(t => t.id === activeTabId)
    const contextLines = activeTab?.terminalOutput.slice(-50).join('') || ''
    
    const initialMessages = [
      { role: 'system', content: systemPrompt },
      ...useStore.getState().chatMessages.filter(m => !m.isLoading && m.content).map(m => {
        // If we have stored tool calls or tool roles in the store, we should map them.
        // For simplicity, we just pass the standard roles to the backend, 
        // or we use the messagesRef for the duration of the loop.
        // The store currently only holds user/assistant simple messages.
        return { role: m.role, content: m.content }
      }),
      { role: 'user', content: userText + (contextLines ? `\n\n[Terminal Context]\n\`\`\`\n${contextLines}\n\`\`\`` : '') }
    ]
    
    messagesRef.current = initialMessages
    stepLoop(messagesRef.current, 0)
  }, [isAgentRunning, activeTabId])

  const approveCommand = async (commandOverride?: string) => {
    if (!pendingApproval) return
    
    const activeTab = useStore.getState().tabs.find(t => t.id === activeTabId)
    if (!activeTab) {
      setIsAgentRunning(false)
      setPendingApproval(null)
      return
    }
    
    const cmdToRun = commandOverride || pendingApproval.command
    const tcId = pendingApproval.id
    const reasoning = pendingApproval.reasoning
    
    setPendingApproval(null)
    
    // Add AI message showing what it decided to do
    addChatMessage({ 
      role: 'assistant', 
      content: `> **Agent Action:** Running \`${cmdToRun}\`\n> *${reasoning}*` 
    })
    addChatMessage({ role: 'assistant', content: '', isLoading: true })

    // Execute in terminal
    await api.macroRun({ terminalId: activeTab.ptyId, commands: [{ cmd: cmdToRun, delay: 0 }] })
    
    // Wait for output to settle
    setTimeout(() => {
      const currentTab = useStore.getState().tabs.find(t => t.id === activeTabId)
      // Grab last 100 lines
      const newOutput = currentTab?.terminalOutput.slice(-100).join('') || '(No output)'
      
      messagesRef.current.push({
        role: 'tool',
        tool_call_id: tcId,
        name: 'run_command',
        content: newOutput
      })
      
      stepLoop(messagesRef.current, iteration)
    }, 1500)
  }

  const rejectCommand = () => {
    if (!pendingApproval) return
    
    const tcId = pendingApproval.id
    setPendingApproval(null)
    
    messagesRef.current.push({
      role: 'tool',
      tool_call_id: tcId,
      name: 'run_command',
      content: 'USER_REJECTED: The user declined to run this command. Please analyze why and provide a different approach or ask for clarification.'
    })
    
    addChatMessage({ role: 'assistant', content: '', isLoading: true })
    stepLoop(messagesRef.current, iteration)
  }
  
  const stopAgent = () => {
    setIsAgentRunning(false)
    setPendingApproval(null)
    updateLastMessage({ isLoading: false, content: '⚠️ **Agent stopped by user.**' })
  }

  return {
    startAgent,
    isAgentRunning,
    pendingApproval,
    approveCommand,
    rejectCommand,
    stopAgent
  }
}
