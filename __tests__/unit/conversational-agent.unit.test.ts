import { describe, test, expect, beforeEach, vi, Mock } from 'vitest';
import { ConversationalAgent } from '../../src';
import { HederaMirrorNode, Logger } from '@hashgraphonline/standards-sdk';
import { PrivateKey } from '@hashgraph/sdk';
import { HederaConversationalAgent } from 'hedera-agent-kit';

vi.mock('@hashgraphonline/standards-sdk');
vi.mock('@hashgraph/sdk');
vi.mock('hedera-agent-kit', async () => {
  const actual = await vi.importActual('hedera-agent-kit');
  return {
    ...actual,
    ServerSigner: vi.fn(),
    HederaConversationalAgent: vi.fn(),
    getAllHederaCorePlugins: vi.fn(() => [])
  };
});

/**
 * Unit tests for ConversationalAgent
 */
describe('ConversationalAgent Unit Tests', () => {
  let mockMirrorNode: any;
  let mockLogger: any;
  let mockPrivateKey: any;
  let mockConversationalAgent: any;

  beforeEach(() => {
    vi.clearAllMocks();

    mockLogger = {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn()
    };

    mockMirrorNode = {
      requestAccount: vi.fn().mockResolvedValue({
        key: { _type: 'ED25519' }
      })
    };

    mockPrivateKey = {
      toString: () => 'mock-private-key-instance'
    };

    mockConversationalAgent = {
      initialize: vi.fn().mockResolvedValue(undefined),
      processMessage: vi.fn().mockResolvedValue({
        output: 'Agent response',
        intermediateSteps: []
      })
    };

    (Logger as unknown as Mock).mockImplementation(() => mockLogger);
    (HederaMirrorNode as unknown as Mock).mockImplementation(() => mockMirrorNode);
    (PrivateKey.fromStringED25519 as Mock) = vi.fn().mockReturnValue(mockPrivateKey);
    (PrivateKey.fromStringECDSA as Mock) = vi.fn().mockReturnValue(mockPrivateKey);
    (HederaConversationalAgent as unknown as Mock).mockImplementation(() => mockConversationalAgent);
  });

  describe('Initialization', () => {
    test('Creates ConversationalAgent with required options', () => {
      const agent = new ConversationalAgent({
        accountId: '0.0.12345',
        privateKey: 'mock-private-key',
        network: 'testnet',
        openAIApiKey: 'sk-test'
      });

      expect(agent).toBeDefined();
      expect(agent.getStateManager()).toBeDefined();
      expect(agent.getPlugin()).toBeDefined();
    });

    test('Initializes with ED25519 key', async () => {
      const agent = new ConversationalAgent({
        accountId: '0.0.12345',
        privateKey: 'mock-private-key',
        network: 'testnet',
        openAIApiKey: 'sk-test'
      });

      await agent.initialize();

      expect(mockMirrorNode.requestAccount).toHaveBeenCalledWith('0.0.12345');
      expect(PrivateKey.fromStringED25519).toHaveBeenCalledWith('mock-private-key');
      expect(mockConversationalAgent.initialize).toHaveBeenCalled();
    });

    test('Initializes with ECDSA key', async () => {
      mockMirrorNode.requestAccount.mockResolvedValue({
        key: { _type: 'ECDSA_SECP256K1' }
      });

      const agent = new ConversationalAgent({
        accountId: '0.0.12345',
        privateKey: 'mock-private-key',
        network: 'testnet',
        openAIApiKey: 'sk-test'
      });

      await agent.initialize();

      expect(PrivateKey.fromStringECDSA).toHaveBeenCalledWith('mock-private-key');
    });

    test('Uses default values for optional parameters', async () => {
      const agent = new ConversationalAgent({
        accountId: '0.0.12345',
        privateKey: 'mock-private-key',
        openAIApiKey: 'sk-test'
      });

      await agent.initialize();

      const agentCall = (HederaConversationalAgent as unknown as Mock).mock.calls[0];
      expect(agentCall[1].openAIModelName).toBe('gpt-4o');
      expect(agentCall[1].verbose).toBe(false);
      expect(agentCall[1].operationalMode).toBe('autonomous');
    });

    test('Throws error when required parameters are missing', async () => {
      const agent = new ConversationalAgent({
        accountId: '',
        privateKey: '',
        openAIApiKey: 'sk-test'
      });

      await expect(agent.initialize()).rejects.toThrow('Account ID and private key are required');
    });

    test('Handles mirror node errors gracefully', async () => {
      mockMirrorNode.requestAccount.mockRejectedValue(new Error('Network error'));

      const agent = new ConversationalAgent({
        accountId: '0.0.12345',
        privateKey: 'mock-private-key',
        openAIApiKey: 'sk-test'
      });

      await expect(agent.initialize()).rejects.toThrow();
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Failed to initialize ConversationalAgent:',
        expect.any(Error)
      );
    });
  });

  describe('Message Processing', () => {
    test('Processes messages after initialization', async () => {
      const agent = new ConversationalAgent({
        accountId: '0.0.12345',
        privateKey: 'mock-private-key',
        openAIApiKey: 'sk-test'
      });

      await agent.initialize();

      const response = await agent.processMessage('Find all AI agents');

      expect(mockConversationalAgent.processMessage).toHaveBeenCalledWith(
        'Find all AI agents',
        []
      );
      expect(response.output).toBe('Agent response');
    });

    test('Passes chat history to processMessage', async () => {
      const agent = new ConversationalAgent({
        accountId: '0.0.12345',
        privateKey: 'mock-private-key',
        openAIApiKey: 'sk-test'
      });

      await agent.initialize();

      const chatHistory = [
        { type: 'human' as const, content: 'Hello' },
        { type: 'ai' as const, content: 'Hi there!' }
      ];

      await agent.processMessage('Find agents', chatHistory);

      expect(mockConversationalAgent.processMessage).toHaveBeenCalledWith(
        'Find agents',
        chatHistory
      );
    });

    test('Throws error if not initialized', async () => {
      const agent = new ConversationalAgent({
        accountId: '0.0.12345',
        privateKey: 'mock-private-key',
        openAIApiKey: 'sk-test'
      });

      await expect(agent.processMessage('Test')).rejects.toThrow(
        'ConversationalAgent not initialized. Call initialize() first.'
      );
    });
  });

  describe('Plugin Integration', () => {
    test('Plugin is included in conversational agent', async () => {
      const agent = new ConversationalAgent({
        accountId: '0.0.12345',
        privateKey: 'mock-private-key',
        openAIApiKey: 'sk-test'
      });

      await agent.initialize();

      const agentCall = (HederaConversationalAgent as unknown as Mock).mock.calls[0];
      const plugins = agentCall[1].pluginConfig.plugins;
      
      expect(plugins).toBeDefined();
      expect(plugins.length).toBeGreaterThan(0);
      expect(plugins[0]).toBe(agent.getPlugin());
    });

    test('State manager is passed to plugin config', async () => {
      const agent = new ConversationalAgent({
        accountId: '0.0.12345',
        privateKey: 'mock-private-key',
        openAIApiKey: 'sk-test'
      });

      await agent.initialize();

      const agentCall = (HederaConversationalAgent as unknown as Mock).mock.calls[0];
      const appConfig = agentCall[1].pluginConfig.appConfig;
      
      expect(appConfig.stateManager).toBe(agent.getStateManager());
    });
  });

  describe('Getters', () => {
    test('getConversationalAgent throws before initialization', () => {
      const agent = new ConversationalAgent({
        accountId: '0.0.12345',
        privateKey: 'mock-private-key',
        openAIApiKey: 'sk-test'
      });

      expect(() => agent.getConversationalAgent()).toThrow(
        'ConversationalAgent not initialized. Call initialize() first.'
      );
    });

    test('getConversationalAgent returns agent after initialization', async () => {
      const agent = new ConversationalAgent({
        accountId: '0.0.12345',
        privateKey: 'mock-private-key',
        openAIApiKey: 'sk-test'
      });

      await agent.initialize();

      const hederaAgent = agent.getConversationalAgent();
      expect(hederaAgent).toBe(mockConversationalAgent);
    });
  });

  describe('System Message', () => {
    test('Includes custom system message with account context', async () => {
      const agent = new ConversationalAgent({
        accountId: '0.0.12345',
        privateKey: 'mock-private-key',
        openAIApiKey: 'sk-test'
      });

      await agent.initialize();

      const agentCall = (HederaConversationalAgent as unknown as Mock).mock.calls[0];
      const systemMessage = agentCall[1].customSystemMessagePreamble;
      
      expect(systemMessage).toContain('0.0.12345');
      expect(systemMessage).toContain('HCS-10');
      expect(systemMessage).toContain('registering agents');
      expect(systemMessage).toContain('connections');
    });
  });

  describe('Network Configuration', () => {
    test('Passes network to mirror node and signer', async () => {
      const agent = new ConversationalAgent({
        accountId: '0.0.12345',
        privateKey: 'mock-private-key',
        network: 'mainnet',
        openAIApiKey: 'sk-test'
      });

      await agent.initialize();

      expect(HederaMirrorNode).toHaveBeenCalledWith('mainnet', expect.any(Object));
    });
  });
});