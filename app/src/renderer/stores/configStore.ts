import { create } from 'zustand'
import { configService } from '../services/configService'

/**
 * Helper to wait for electron bridge to be available
 */
const waitForElectronBridge = async (maxRetries = 10, retryDelay = 500): Promise<boolean> => {
  for (let i = 0; i < maxRetries; i++) {
    if (window.electron && typeof window.electron.saveConfig === 'function') {
      return true
    }
    await new Promise(resolve => setTimeout(resolve, retryDelay))
  }
  return false
}

export interface HederaConfig {
  accountId: string
  privateKey: string
  network: 'mainnet' | 'testnet'
}

export interface OpenAIConfig {
  apiKey: string
  model: 'gpt-4o' | 'gpt-4o-mini' | 'gpt-4' | 'gpt-3.5-turbo'
}

export interface AnthropicConfig {
  apiKey: string
  model: 'claude-3-5-sonnet-20241022' | 'claude-3-5-haiku-20241022' | 'claude-3-opus-20240229'
}

export interface AdvancedConfig {
  theme: 'light' | 'dark'
  autoStart: boolean
  logLevel: 'debug' | 'info' | 'warn' | 'error'
  operationalMode?: 'autonomous' | 'returnBytes'
}

export interface AppConfig {
  hedera: HederaConfig
  openai: OpenAIConfig
  anthropic: AnthropicConfig
  advanced: AdvancedConfig
  llmProvider: 'openai' | 'anthropic'
}

export interface ConfigStore {
  config: AppConfig | null
  isLoading: boolean
  error: string | null
  isConfigured: () => boolean
  
  setHederaAccountId: (accountId: string) => void
  setHederaPrivateKey: (privateKey: string) => void
  setHederaNetwork: (network: 'mainnet' | 'testnet') => void
  
  setOpenAIApiKey: (apiKey: string) => void
  setOpenAIModel: (model: 'gpt-4o' | 'gpt-4o-mini' | 'gpt-4' | 'gpt-3.5-turbo') => void
  
  setAnthropicApiKey: (apiKey: string) => void
  setAnthropicModel: (model: 'claude-3-5-sonnet-20241022' | 'claude-3-5-haiku-20241022' | 'claude-3-opus-20240229') => void
  
  setLLMProvider: (provider: 'openai' | 'anthropic') => void
  
  setTheme: (theme: 'light' | 'dark') => Promise<void>
  setAutoStart: (autoStart: boolean) => void
  setLogLevel: (logLevel: 'debug' | 'info' | 'warn' | 'error') => void
  setOperationalMode: (mode: 'autonomous' | 'returnBytes') => void
  
  saveConfig: () => Promise<void>
  loadConfig: () => Promise<void>
  
  testHederaConnection: () => Promise<{ success: boolean; error?: string }>
  testOpenAIConnection: () => Promise<{ success: boolean; error?: string }>
  testAnthropicConnection: () => Promise<{ success: boolean; error?: string }>
  
  isHederaConfigValid: () => boolean
  isOpenAIConfigValid: () => boolean
  isAnthropicConfigValid: () => boolean
  isLLMConfigValid: () => boolean
  
  clearError: () => void
}

const defaultConfig: AppConfig = {
  hedera: {
    accountId: '',
    privateKey: '',
    network: 'testnet'
  },
  openai: {
    apiKey: '',
    model: 'gpt-4o'
  },
  anthropic: {
    apiKey: '',
    model: 'claude-3-5-sonnet-20241022'
  },
  advanced: {
    theme: 'light',
    autoStart: false,
    logLevel: 'info',
    operationalMode: 'autonomous'
  },
  llmProvider: 'openai'
}

export const useConfigStore = create<ConfigStore>((set, get) => ({
  config: defaultConfig,
  isLoading: false,
  error: null,
  
  isConfigured: () => {
    const state = get();
    
    const hederaValid = state.isHederaConfigValid();
    const llmValid = state.isLLMConfigValid();
    const result = hederaValid && llmValid;
    
    return result;
  },
  
  setHederaAccountId: (accountId) => 
    set((state) => ({
      config: state.config ? {
        ...state.config,
        hedera: { ...state.config.hedera, accountId }
      } : null
    })),
  
  setHederaPrivateKey: (privateKey) => 
    set((state) => ({
      config: state.config ? {
        ...state.config,
        hedera: { ...state.config.hedera, privateKey }
      } : null
    })),
  
  setHederaNetwork: (network) => 
    set((state) => ({
      config: state.config ? {
        ...state.config,
        hedera: { ...state.config.hedera, network }
      } : null
    })),
  
  setOpenAIApiKey: (apiKey) => 
    set((state) => ({
      config: state.config ? {
        ...state.config,
        openai: { ...state.config.openai, apiKey }
      } : null
    })),
  
  setOpenAIModel: (model) => 
    set((state) => ({
      config: state.config ? {
        ...state.config,
        openai: { ...state.config.openai, model }
      } : null
    })),

  setAnthropicApiKey: (apiKey) => 
    set((state) => ({
      config: state.config ? {
        ...state.config,
        anthropic: { ...state.config.anthropic, apiKey }
      } : null
    })),

  setAnthropicModel: (model) => 
    set((state) => ({
      config: state.config ? {
        ...state.config,
        anthropic: { ...state.config.anthropic, model }
      } : null
    })),

  setLLMProvider: (provider) => 
    set((state) => ({
      config: state.config ? {
        ...state.config,
        llmProvider: provider
      } : null
    })),
  
  setTheme: async (theme) => {
    set((state) => ({
      config: state.config ? {
        ...state.config,
        advanced: { ...state.config.advanced, theme }
      } : null
    }))
    
    try {
      await configService.applyTheme(theme)
    } catch (error) {
    }
  },
  
  setAutoStart: (autoStart) => 
    set((state) => ({
      config: state.config ? {
        ...state.config,
        advanced: { ...state.config.advanced, autoStart }
      } : null
    })),
  
  setLogLevel: (logLevel) => 
    set((state) => ({
      config: state.config ? {
        ...state.config,
        advanced: { ...state.config.advanced, logLevel }
      } : null
    })),
  
  setOperationalMode: (mode) => 
    set((state) => ({
      config: state.config ? {
        ...state.config,
        advanced: { ...state.config.advanced, operationalMode: mode }
      } : null
    })),
  
  saveConfig: async () => {
    const { config } = get()
    if (!config) {
      throw new Error('No configuration to save')
    }
    
    const isAvailable = await waitForElectronBridge()
    if (!isAvailable) {
      set({ error: 'Unable to save settings - Electron API not available' })
      return
    }
    
    set({ isLoading: true, error: null })
    
    try {
      await window.electron.saveConfig(config as unknown as Record<string, unknown>)
      localStorage.setItem('app-config', JSON.stringify(config))
      set({ isLoading: false })
    } catch (error) {
      set({ 
        isLoading: false, 
        error: error instanceof Error ? error.message : 'Failed to save configuration'
      })
      throw error
    }
  },
  
  loadConfig: async () => {
    set({ isLoading: true, error: null })
    
    try {
      const isAvailable = await waitForElectronBridge()
      if (!isAvailable) {
        set({ config: defaultConfig, isLoading: false })
        return
      }
      
      const loadedConfig = await window.electron.loadConfig()
      
      if (loadedConfig) {
        const migratedConfig = migrateConfig(loadedConfig)
        set({ config: migratedConfig, isLoading: false })
        localStorage.setItem('app-config', JSON.stringify(migratedConfig))
        
        try {
          await configService.applyTheme(migratedConfig.advanced.theme)
        } catch (error) {
        }
      } else {
        set({ config: defaultConfig, isLoading: false })
        
        try {
          await configService.applyTheme(defaultConfig.advanced.theme)
        } catch (error) {
        }
      }
    } catch (error) {
      set({ 
        config: defaultConfig,
        isLoading: false, 
        error: error instanceof Error ? error.message : 'Failed to load configuration'
      })
    }
  },
  
  testHederaConnection: async () => {
    const { config } = get()
    
    if (!config || !config.hedera) {
      return { success: false, error: 'Hedera configuration not found' }
    }
    
    const isAvailable = await waitForElectronBridge()
    if (!isAvailable) {
      return { success: false, error: 'Electron API not available' }
    }
    
    try {
      const result = await window.electron.testHederaConnection({
        accountId: config.hedera.accountId,
        privateKey: config.hedera.privateKey,
        network: config.hedera.network
      })
      return result
    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Connection test failed'
      }
    }
  },
  
  testOpenAIConnection: async () => {
    const { config } = get()
    
    if (!config || !config.openai) {
      return { success: false, error: 'OpenAI configuration not found' }
    }
    
    const isAvailable = await waitForElectronBridge()
    if (!isAvailable) {
      return { success: false, error: 'Electron API not available' }
    }
    
    try {
      const result = await window.electron.testOpenAIConnection({
        apiKey: config.openai.apiKey,
        model: config.openai.model
      })
      return result
    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Connection test failed'
      }
    }
  },

  testAnthropicConnection: async () => {
    const { config } = get()
    
    if (!config || !config.anthropic) {
      return { success: false, error: 'Anthropic configuration not found' }
    }
    
    const isAvailable = await waitForElectronBridge()
    if (!isAvailable) {
      return { success: false, error: 'Electron API not available' }
    }
    
    try {
      const result = await window.electron.testAnthropicConnection({
        apiKey: config.anthropic.apiKey,
        model: config.anthropic.model
      })
      return result
    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Connection test failed'
      }
    }
  },
  
  isHederaConfigValid: () => {
    const { config } = get()
    if (!config || !config.hedera) {
      return false
    }
    
    const hasAccountId = !!config.hedera.accountId
    const hasPrivateKey = !!config.hedera.privateKey
    const validAccountId = isValidAccountId(config.hedera.accountId)
    const validPrivateKey = isValidPrivateKey(config.hedera.privateKey)
    
    const result = hasAccountId && hasPrivateKey && validAccountId && validPrivateKey
    return result
  },
  
  isOpenAIConfigValid: () => {
    const { config } = get()
    if (!config || !config.openai) {
      return false
    }
    
    const hasKey = !!config.openai.apiKey
    const startsWithSk = config.openai.apiKey?.startsWith('sk-')
    const result = !!(hasKey && startsWithSk)
    return result
  },

  isAnthropicConfigValid: () => {
    const { config } = get()
    if (!config || !config.anthropic) return false
    
    return !!(config.anthropic.apiKey && config.anthropic.apiKey.startsWith('sk-ant-'))
  },

  isLLMConfigValid: () => {
    const { config } = get()
    if (!config) {
      return false
    }
    
    if (config.llmProvider === 'openai') {
      const result = get().isOpenAIConfigValid()
      return result
    } else if (config.llmProvider === 'anthropic') {
      const result = get().isAnthropicConfigValid()
      return result
    }
    
    return false
  },
  
  clearError: () => set({ error: null })
}))

/**
 * Validates Hedera account ID format
 */
function isValidAccountId(accountId: string): boolean {
  const pattern = /^\d+\.\d+\.\d+$/
  return pattern.test(accountId)
}

/**
 * Validates Hedera private key format
 */
function isValidPrivateKey(privateKey: string): boolean {
  return !!privateKey && privateKey.length > 0
}

/**
 * Migrates old configuration format to new format
 */
function migrateConfig(config: any): AppConfig {
  if (config.hedera && config.openai && config.anthropic && config.advanced && config.llmProvider) {
    return config as AppConfig
  }
  
  return {
    hedera: {
      accountId: config.hederaAccountId || config.hedera?.accountId || '',
      privateKey: config.hederaPrivateKey || config.hedera?.privateKey || '',
      network: config.hederaNetwork || config.hedera?.network || 'testnet'
    },
    openai: {
      apiKey: config.openaiApiKey || config.openai?.apiKey || '',
      model: config.openaiModel || config.openai?.model || 'gpt-4o'
    },
    anthropic: {
      apiKey: config.anthropicApiKey || config.anthropic?.apiKey || '',
      model: config.anthropicModel || config.anthropic?.model || 'claude-3-5-sonnet-20241022'
    },
    advanced: {
      theme: config.theme || config.advanced?.theme || 'light',
      autoStart: config.autoStart || config.advanced?.autoStart || false,
      logLevel: config.logLevel || config.advanced?.logLevel || 'info'
    },
    llmProvider: config.llmProvider || 'openai'
  }
}