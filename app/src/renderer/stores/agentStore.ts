import { create } from 'zustand'
import { useConfigStore } from './configStore'

export type AgentStatus = 'idle' | 'connecting' | 'connected' | 'disconnecting' | 'error'
export type OperationalMode = 'autonomous' | 'returnBytes'

export interface Message {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  timestamp: Date
  metadata?: Record<string, any>
}

export interface AgentStore {
  status: AgentStatus
  isConnected: boolean
  connectionError: string | null
  messages: Message[]
  currentSessionId: string | null
  isTyping: boolean
  operationalMode: OperationalMode
  
  setStatus: (status: AgentStatus) => void
  setConnected: (connected: boolean) => void
  setConnectionError: (error: string | null) => void
  clearConnectionError: () => void
  setIsTyping: (typing: boolean) => void
  setOperationalMode: (mode: OperationalMode) => Promise<void>
  
  addMessage: (message: Message) => void
  clearMessages: () => void
  
  setSessionId: (sessionId: string | null) => void
  startNewSession: (sessionId: string) => void
  
  connect: () => Promise<void>
  disconnect: () => Promise<void>
  sendMessage: (content: string) => Promise<void>
}

export const useAgentStore = create<AgentStore>((set, get) => {
  const configStore = useConfigStore.getState()
  const initialOperationalMode = configStore.config?.advanced?.operationalMode || 'autonomous'
  
  return {
    status: 'idle' as AgentStatus,
    isConnected: false,
    connectionError: null,
    messages: [],
    currentSessionId: null,
    isTyping: false,
    operationalMode: initialOperationalMode as OperationalMode,
  
  setStatus: (status) => set({ status }),
  
  setConnected: (connected) => set({ 
    isConnected: connected, 
    status: connected ? 'connected' : 'idle' 
  }),
  
  setIsTyping: (typing) => set({ isTyping: typing }),
  
  setOperationalMode: async (mode) => {
    const { isConnected, status } = get()
    
    if (status === 'initializing') {
      return
    }
    
    set({ operationalMode: mode })
    
    const configStore = useConfigStore.getState()
    configStore.setOperationalMode(mode)
    await configStore.saveConfig()
    
    if (isConnected) {
      await get().disconnect()
      await new Promise(resolve => setTimeout(resolve, 100))
      await get().connect()
    }
  },
  
  setConnectionError: (error) => set({ 
    connectionError: error, 
    status: 'error',
    isConnected: false 
  }),
  
  clearConnectionError: () => set({ connectionError: null }),
  
  addMessage: (message) => set((state) => ({ 
    messages: [...state.messages, message] 
  })),
  
  clearMessages: () => set({ messages: [] }),
  
  setSessionId: (sessionId) => set({ currentSessionId: sessionId }),
  
  startNewSession: (sessionId) => set({ 
    currentSessionId: sessionId, 
    messages: [] 
  }),
  
  connect: async () => {
    set({ status: 'connecting' as AgentStatus, connectionError: null })
    
    try {
      const rawConfig = await window.electron.loadConfig()
      
      if (!rawConfig) {
        throw new Error('No configuration found. Please configure your settings first.')
      }
      
      const accountId = rawConfig.hedera?.accountId || (rawConfig as any).accountId || ''
      const privateKey = rawConfig.hedera?.privateKey || (rawConfig as any).privateKey || ''
      const network = rawConfig.hedera?.network || (rawConfig as any).network || 'testnet'
      const llmProvider = rawConfig.llmProvider || 'openai'
      
      let apiKey = ''
      let modelName = ''
      
      if (llmProvider === 'anthropic') {
        apiKey = rawConfig.anthropic?.apiKey || ''
        modelName = rawConfig.anthropic?.model || 'claude-3-5-sonnet-20241022'
      } else {
        apiKey = rawConfig.openai?.apiKey || (rawConfig as any).openAIApiKey || ''
        modelName = rawConfig.openai?.model || (rawConfig as any).modelName || 'gpt-4o-mini'
      }
      
      
      if (!accountId || !privateKey || !apiKey) {
        throw new Error('Invalid configuration. Please check your settings.')
      }
      
      const { operationalMode } = get()
      
      const result = await window.electron.initializeAgent({
        accountId,
        privateKey,
        network,
        openAIApiKey: apiKey,
        modelName,
        operationalMode,
        llmProvider
      })
      
      if (result.success) {
        set({ 
          isConnected: true, 
          status: 'connected' as AgentStatus,
          currentSessionId: result.data?.sessionId || null 
        })
      } else {
        throw new Error(result.error || 'Failed to connect')
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Connection failed'
      set({ 
        isConnected: false, 
        status: 'error' as AgentStatus,
        connectionError: errorMessage 
      })
      throw error
    }
  },
  
  disconnect: async () => {
    set({ status: 'disconnecting' as AgentStatus })
    
    try {
      await window.electron.disconnectAgent()
      set({ 
        isConnected: false, 
        status: 'idle' as AgentStatus,
        currentSessionId: null,
        connectionError: null
      })
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Disconnect failed'
      set({ 
        status: 'error' as AgentStatus,
        connectionError: errorMessage 
      })
      throw error
    }
  },
  
  sendMessage: async (content: string) => {
    const { isConnected, messages } = get()
    
    if (!isConnected) {
      throw new Error('Not connected to agent')
    }
    
    const userMessage: Message = {
      id: generateMessageId(),
      role: 'user',
      content,
      timestamp: new Date()
    }
    
    set((state) => ({ messages: [...state.messages, userMessage] }))
    
    try {
      set({ isTyping: true })
      
      const chatHistory = messages.map(msg => ({
        type: msg.role === 'user' ? 'human' as const : 'ai' as const,
        content: msg.content
      }))
      
      const result = await window.electron.sendAgentMessage({
        content,
        chatHistory
      })
      
      
      if (result.success && result.response) {
        const assistantMessage: Message = {
          id: result.response.id || generateMessageId(),
          role: 'assistant',
          content: result.response.content || '',
          timestamp: new Date(result.response.timestamp || Date.now()),
          metadata: result.response.metadata
        }
        set((state) => ({ messages: [...state.messages, assistantMessage] }))
      } else {
        throw new Error(result.error || 'Failed to get response')
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Send failed'
      set({ connectionError: errorMessage })
      throw error
    } finally {
      set({ isTyping: false })
    }
  }
  }
})

/**
 * Generates a unique message ID
 */
function generateMessageId(): string {
  return `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
}