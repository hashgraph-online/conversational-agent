import { renderHook, act } from '@testing-library/react'
import { useAgentStore } from '../../../src/renderer/stores/agentStore'

describe('Agent Store', () => {
  beforeEach(() => {
    useAgentStore.setState({
      status: 'idle',
      isConnected: false,
      connectionError: null,
      messages: [],
      currentSessionId: null
    })
  })

  describe('Agent Status', () => {
    it('should update agent status', () => {
      const { result } = renderHook(() => useAgentStore())

      act(() => {
        result.current.setStatus('connecting')
      })

      expect(result.current.status).toBe('connecting')
    })

    it('should update connection state', () => {
      const { result } = renderHook(() => useAgentStore())

      act(() => {
        result.current.setConnected(true)
      })

      expect(result.current.isConnected).toBe(true)
      expect(result.current.status).toBe('connected')
    })

    it('should handle connection errors', () => {
      const { result } = renderHook(() => useAgentStore())

      act(() => {
        result.current.setConnectionError('Failed to connect to agent')
      })

      expect(result.current.connectionError).toBe('Failed to connect to agent')
      expect(result.current.status).toBe('error')
      expect(result.current.isConnected).toBe(false)
    })

    it('should reset connection error', () => {
      const { result } = renderHook(() => useAgentStore())

      act(() => {
        result.current.setConnectionError('Failed to connect to agent')
      })

      act(() => {
        result.current.clearConnectionError()
      })

      expect(result.current.connectionError).toBe(null)
    })
  })

  describe('Messages', () => {
    it('should add messages', () => {
      const { result } = renderHook(() => useAgentStore())

      const message = {
        id: '1',
        role: 'user' as const,
        content: 'Hello',
        timestamp: new Date()
      }

      act(() => {
        result.current.addMessage(message)
      })

      expect(result.current.messages).toHaveLength(1)
      expect(result.current.messages[0]).toEqual(message)
    })

    it('should clear messages', () => {
      const { result } = renderHook(() => useAgentStore())

      act(() => {
        result.current.addMessage({
          id: '1',
          role: 'user',
          content: 'Hello',
          timestamp: new Date()
        })
        result.current.addMessage({
          id: '2',
          role: 'assistant',
          content: 'Hi there!',
          timestamp: new Date()
        })
      })

      act(() => {
        result.current.clearMessages()
      })

      expect(result.current.messages).toHaveLength(0)
    })
  })

  describe('Session Management', () => {
    it('should update current session ID', () => {
      const { result } = renderHook(() => useAgentStore())

      act(() => {
        result.current.setSessionId('session-123')
      })

      expect(result.current.currentSessionId).toBe('session-123')
    })

    it('should start a new session', () => {
      const { result } = renderHook(() => useAgentStore())

      act(() => {
        result.current.addMessage({
          id: '1',
          role: 'user',
          content: 'Old message',
          timestamp: new Date()
        })
        result.current.setSessionId('old-session')
      })

      act(() => {
        result.current.startNewSession('new-session')
      })

      expect(result.current.currentSessionId).toBe('new-session')
      expect(result.current.messages).toHaveLength(0)
    })
  })

  describe('Agent Connection', () => {
    it('should connect to agent', async () => {
      const { result } = renderHook(() => useAgentStore())

      window.electron = {
        connectAgent: jest.fn().mockResolvedValue({ success: true, sessionId: 'session-123' }),
        disconnectAgent: jest.fn(),
        sendMessage: jest.fn()
      }

      await act(async () => {
        await result.current.connect()
      })

      expect(result.current.isConnected).toBe(true)
      expect(result.current.currentSessionId).toBe('session-123')
      expect(result.current.status).toBe('connected')
    })

    it('should handle connection failure', async () => {
      const { result } = renderHook(() => useAgentStore())

      window.electron = {
        connectAgent: jest.fn().mockRejectedValue(new Error('Connection failed')),
        disconnectAgent: jest.fn(),
        sendMessage: jest.fn()
      }

      await act(async () => {
        await result.current.connect()
      })

      expect(result.current.isConnected).toBe(false)
      expect(result.current.connectionError).toBe('Connection failed')
      expect(result.current.status).toBe('error')
    })

    it('should disconnect from agent', async () => {
      const { result } = renderHook(() => useAgentStore())

      window.electron = {
        connectAgent: jest.fn(),
        disconnectAgent: jest.fn().mockResolvedValue(undefined),
        sendMessage: jest.fn()
      }

      act(() => {
        result.current.setConnected(true)
        result.current.setSessionId('session-123')
      })

      await act(async () => {
        await result.current.disconnect()
      })

      expect(result.current.isConnected).toBe(false)
      expect(result.current.currentSessionId).toBe(null)
      expect(result.current.status).toBe('idle')
    })
  })

  describe('Message Sending', () => {
    it('should send messages', async () => {
      const { result } = renderHook(() => useAgentStore())

      const mockResponse = {
        id: '2',
        role: 'assistant' as const,
        content: 'Hello! How can I help you?',
        timestamp: new Date()
      }

      window.electron = {
        connectAgent: jest.fn(),
        disconnectAgent: jest.fn(),
        sendMessage: jest.fn().mockResolvedValue(mockResponse)
      }

      act(() => {
        result.current.setConnected(true)
        result.current.setSessionId('session-123')
      })

      await act(async () => {
        await result.current.sendMessage('Hello')
      })

      expect(result.current.messages).toHaveLength(2)
      expect(result.current.messages[0].content).toBe('Hello')
      expect(result.current.messages[0].role).toBe('user')
      expect(result.current.messages[1]).toEqual(mockResponse)
    })

    it('should handle send message errors', async () => {
      const { result } = renderHook(() => useAgentStore())

      window.electron = {
        connectAgent: jest.fn(),
        disconnectAgent: jest.fn(),
        sendMessage: jest.fn().mockRejectedValue(new Error('Send failed'))
      }

      act(() => {
        result.current.setConnected(true)
      })

      await act(async () => {
        await result.current.sendMessage('Hello')
      })

      expect(result.current.connectionError).toBe('Send failed')
    })
  })
})