import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import ChatHeader from '../../../renderer/components/chat/ChatHeader';
import { useAgentStore } from '../../../renderer/stores/agentStore';
import { useConfigStore } from '../../../renderer/stores/configStore';

jest.mock('../../../renderer/stores/agentStore');
jest.mock('../../../renderer/stores/configStore');

const mockUseAgentStore = useAgentStore as jest.MockedFunction<typeof useAgentStore>;
const mockUseConfigStore = useConfigStore as jest.MockedFunction<typeof useConfigStore>;

describe('ChatHeader', () => {
  const mockConfig = {
    accountId: '0.0.123456',
    privateKey: 'test-key',
    network: 'testnet' as const,
    openAIApiKey: 'test-api-key'
  };

  beforeEach(() => {
    mockUseAgentStore.mockReturnValue({
      status: 'idle',
      isConnected: false,
      connectionError: null,
      messages: [],
      currentSessionId: null,
      setStatus: jest.fn(),
      setConnected: jest.fn(),
      setConnectionError: jest.fn(),
      clearConnectionError: jest.fn(),
      addMessage: jest.fn(),
      clearMessages: jest.fn(),
      setSessionId: jest.fn(),
      startNewSession: jest.fn(),
      connect: jest.fn(),
      disconnect: jest.fn(),
      sendMessage: jest.fn()
    });

    mockUseConfigStore.mockReturnValue({
      config: mockConfig,
      isConfigured: true,
      isLoading: false,
      error: null,
      loadConfig: jest.fn(),
      saveConfig: jest.fn()
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should render the header with agent title', () => {
    render(<ChatHeader />);
    
    expect(screen.getByText('Conversational Agent')).toBeInTheDocument();
  });

  it('should show disconnected status when not connected', () => {
    render(<ChatHeader />);
    
    expect(screen.getByText('Disconnected')).toBeInTheDocument();
  });

  it('should show connected status when connected', () => {
    mockUseAgentStore.mockReturnValue({
      ...mockUseAgentStore(),
      status: 'connected',
      isConnected: true
    });
    
    render(<ChatHeader />);
    
    expect(screen.getByText('Connected')).toBeInTheDocument();
  });

  it('should show connecting status', () => {
    mockUseAgentStore.mockReturnValue({
      ...mockUseAgentStore(),
      status: 'connecting',
      isConnected: false
    });
    
    render(<ChatHeader />);
    
    expect(screen.getByText('Connecting...')).toBeInTheDocument();
  });

  it('should show error status when there is a connection error', () => {
    mockUseAgentStore.mockReturnValue({
      ...mockUseAgentStore(),
      status: 'error',
      isConnected: false,
      connectionError: 'Connection failed'
    });
    
    render(<ChatHeader />);
    
    expect(screen.getByText('Connection failed')).toBeInTheDocument();
  });

  it('should display network information when config is available', () => {
    render(<ChatHeader />);
    
    expect(screen.getByText('TESTNET')).toBeInTheDocument();
  });

  it('should display account information when config is available', () => {
    render(<ChatHeader />);
    
    expect(screen.getByText('Account: 0.0.123456')).toBeInTheDocument();
  });

  it('should handle missing config gracefully', () => {
    mockUseConfigStore.mockReturnValue({
      config: null,
      isConfigured: false,
      isLoading: false,
      error: null,
      loadConfig: jest.fn(),
      saveConfig: jest.fn()
    });
    
    render(<ChatHeader />);
    
    expect(screen.getByText('Conversational Agent')).toBeInTheDocument();
    expect(screen.queryByText('TESTNET')).not.toBeInTheDocument();
  });
});