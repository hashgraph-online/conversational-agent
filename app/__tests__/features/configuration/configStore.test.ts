import { renderHook, act } from '@testing-library/react'
import { useConfigStore } from '../../../src/renderer/stores/configStore'

describe('Configuration Store', () => {
  beforeEach(() => {
    useConfigStore.setState({
      config: {
        hedera: {
          accountId: '',
          privateKey: '',
          network: 'testnet'
        },
        openai: {
          apiKey: '',
          model: 'gpt-4'
        },
        advanced: {
          theme: 'light',
          autoStart: false
        }
      },
      isLoading: false,
      error: null
    })
  })

  describe('Hedera Configuration', () => {
    it('should update Hedera account ID', () => {
      const { result } = renderHook(() => useConfigStore())

      act(() => {
        result.current.setHederaAccountId('0.0.12345')
      })

      expect(result.current.config.hedera.accountId).toBe('0.0.12345')
    })

    it('should update Hedera private key', () => {
      const { result } = renderHook(() => useConfigStore())

      act(() => {
        result.current.setHederaPrivateKey('302e020100300506032b657004220420')
      })

      expect(result.current.config.hedera.privateKey).toBe('302e020100300506032b657004220420')
    })

    it('should update Hedera network', () => {
      const { result } = renderHook(() => useConfigStore())

      act(() => {
        result.current.setHederaNetwork('mainnet')
      })

      expect(result.current.config.hedera.network).toBe('mainnet')
    })

    it('should validate Hedera configuration', () => {
      const { result } = renderHook(() => useConfigStore())

      act(() => {
        result.current.setHederaAccountId('0.0.12345')
        result.current.setHederaPrivateKey('302e020100300506032b657004220420')
      })

      expect(result.current.isHederaConfigValid()).toBe(true)
    })

    it('should invalidate incomplete Hedera configuration', () => {
      const { result } = renderHook(() => useConfigStore())

      act(() => {
        result.current.setHederaAccountId('0.0.12345')
      })

      expect(result.current.isHederaConfigValid()).toBe(false)
    })
  })

  describe('OpenAI Configuration', () => {
    it('should update OpenAI API key', () => {
      const { result } = renderHook(() => useConfigStore())

      act(() => {
        result.current.setOpenAIApiKey('sk-test-key')
      })

      expect(result.current.config.openai.apiKey).toBe('sk-test-key')
    })

    it('should update OpenAI model', () => {
      const { result } = renderHook(() => useConfigStore())

      act(() => {
        result.current.setOpenAIModel('gpt-3.5-turbo')
      })

      expect(result.current.config.openai.model).toBe('gpt-3.5-turbo')
    })

    it('should validate OpenAI configuration', () => {
      const { result } = renderHook(() => useConfigStore())

      act(() => {
        result.current.setOpenAIApiKey('sk-test-key')
      })

      expect(result.current.isOpenAIConfigValid()).toBe(true)
    })
  })

  describe('Advanced Configuration', () => {
    it('should update theme', () => {
      const { result } = renderHook(() => useConfigStore())

      act(() => {
        result.current.setTheme('dark')
      })

      expect(result.current.config.advanced.theme).toBe('dark')
    })

    it('should update auto-start', () => {
      const { result } = renderHook(() => useConfigStore())

      act(() => {
        result.current.setAutoStart(true)
      })

      expect(result.current.config.advanced.autoStart).toBe(true)
    })
  })

  describe('Configuration Persistence', () => {
    it('should save configuration', async () => {
      const { result } = renderHook(() => useConfigStore())

      const mockSaveConfig = jest.fn().mockResolvedValue(undefined)
      window.electron = {
        saveConfig: mockSaveConfig,
        loadConfig: jest.fn(),
        testHederaConnection: jest.fn(),
        testOpenAIConnection: jest.fn()
      }

      await act(async () => {
        await result.current.saveConfig()
      })

      expect(mockSaveConfig).toHaveBeenCalledWith(result.current.config)
    })

    it('should load configuration', async () => {
      const { result } = renderHook(() => useConfigStore())

      const mockConfig = {
        hedera: {
          accountId: '0.0.54321',
          privateKey: 'test-key',
          network: 'mainnet' as const
        },
        openai: {
          apiKey: 'sk-loaded-key',
          model: 'gpt-4' as const
        },
        advanced: {
          theme: 'dark' as const,
          autoStart: true
        }
      }

      window.electron = {
        saveConfig: jest.fn(),
        loadConfig: jest.fn().mockResolvedValue(mockConfig),
        testHederaConnection: jest.fn(),
        testOpenAIConnection: jest.fn()
      }

      await act(async () => {
        await result.current.loadConfig()
      })

      expect(result.current.config).toEqual(mockConfig)
    })

    it('should handle save errors', async () => {
      const { result } = renderHook(() => useConfigStore())

      window.electron = {
        saveConfig: jest.fn().mockRejectedValue(new Error('Save failed')),
        loadConfig: jest.fn(),
        testHederaConnection: jest.fn(),
        testOpenAIConnection: jest.fn()
      }

      await act(async () => {
        await result.current.saveConfig()
      })

      expect(result.current.error).toBe('Save failed')
    })
  })

  describe('Connection Testing', () => {
    it('should test Hedera connection', async () => {
      const { result } = renderHook(() => useConfigStore())

      window.electron = {
        saveConfig: jest.fn(),
        loadConfig: jest.fn(),
        testHederaConnection: jest.fn().mockResolvedValue({ success: true }),
        testOpenAIConnection: jest.fn()
      }

      act(() => {
        result.current.setHederaAccountId('0.0.12345')
        result.current.setHederaPrivateKey('test-key')
      })

      const testResult = await act(async () => {
        return await result.current.testHederaConnection()
      })

      expect(testResult).toEqual({ success: true })
    })

    it('should test OpenAI connection', async () => {
      const { result } = renderHook(() => useConfigStore())

      window.electron = {
        saveConfig: jest.fn(),
        loadConfig: jest.fn(),
        testHederaConnection: jest.fn(),
        testOpenAIConnection: jest.fn().mockResolvedValue({ success: true })
      }

      act(() => {
        result.current.setOpenAIApiKey('sk-test-key')
      })

      const testResult = await act(async () => {
        return await result.current.testOpenAIConnection()
      })

      expect(testResult).toEqual({ success: true })
    })
  })
})