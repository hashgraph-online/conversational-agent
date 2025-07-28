import { describe, test, expect, beforeEach, vi, Mock } from 'vitest';
import { ConversationalAgent } from '../../src';
import { HederaMirrorNode, Logger } from '@hashgraphonline/standards-sdk';
import { PrivateKey } from '@hashgraph/sdk';
import { createAgent } from '../../src/agent-factory';

let mockPrivateKey: any;
let mockAgent: any;

vi.mock('@hashgraphonline/standards-sdk');
vi.mock('@hashgraph/sdk');
vi.mock('hedera-agent-kit', async () => {
  const actual = await vi.importActual('hedera-agent-kit');
  return {
    ...actual,
    ServerSigner: vi.fn().mockImplementation(() => ({
      getAccountId: () => ({ toString: () => '0.0.12345' }),
      getNetwork: () => 'testnet',
      getOperatorPrivateKey: () => mockPrivateKey,
    })),
    HederaAgentKit: vi.fn().mockImplementation(function(this: any) {
      this.initialize = vi.fn().mockResolvedValue(undefined);
      this.getAggregatedLangChainTools = vi.fn().mockReturnValue([]);
      this.operationalMode = 'returnBytes';
    }),
    getAllHederaCorePlugins: vi.fn(() => [])
  };
});

vi.mock('../../src/agent-factory', () => ({
  createAgent: vi.fn(() => mockAgent)
}));

/**
 * Unit tests for ConversationalAgent
 */
describe('ConversationalAgent Unit Tests', () => {
  let mockMirrorNode: any;
  let mockLogger: any;

  beforeEach(() => {
    vi.clearAllMocks();

    mockPrivateKey = {
      toString: () => 'mock-private-key-instance'
    };

    mockAgent = {
      boot: vi.fn().mockResolvedValue(undefined),
      chat: vi.fn().mockResolvedValue({
        output: 'Agent response',
        intermediateSteps: []
      })
    };

    mockLogger = {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      debug: vi.fn()
    };

    mockMirrorNode = {
      requestAccount: vi.fn().mockResolvedValue({
        key: { _type: 'ED25519' }
      })
    };

    (Logger as unknown as Mock).mockImplementation(() => mockLogger);
    (HederaMirrorNode as unknown as Mock).mockImplementation(() => mockMirrorNode);
    (PrivateKey.fromStringED25519 as Mock) = vi.fn().mockReturnValue(mockPrivateKey);
    (PrivateKey.fromStringECDSA as Mock) = vi.fn().mockReturnValue(mockPrivateKey);
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
      expect(mockAgent.boot).toHaveBeenCalled();
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

      const createAgentCall = (createAgent as unknown as Mock).mock.calls[0];
      
      expect(createAgentCall[0].framework).toBe('langchain');
      expect(createAgentCall[0].execution?.operationalMode).toBe('autonomous');
      expect(createAgentCall[0].debug?.verbose).toBe(false);
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

      expect(mockAgent.chat).toHaveBeenCalledWith(
        'Find all AI agents',
        { messages: [] }
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

      const expectedMessages = chatHistory.map(msg => 
        msg.type === 'human' 
          ? expect.objectContaining({ content: msg.content })
          : expect.objectContaining({ content: msg.content })
      );

      expect(mockAgent.chat).toHaveBeenCalledWith(
        'Find agents',
        { messages: expectedMessages }
      );
    });

    test('Throws error if not initialized', async () => {
      const agent = new ConversationalAgent({
        accountId: '0.0.12345',
        privateKey: 'mock-private-key',
        openAIApiKey: 'sk-test'
      });

      await expect(agent.processMessage('Test')).rejects.toThrow(
        'Agent not initialized. Call initialize() first.'
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

      const createAgentCall = (createAgent as unknown as Mock).mock.calls[0];
      const plugins = createAgentCall[0].extensions?.plugins;
      
      expect(plugins).toBeDefined();
      expect(plugins.length).toBeGreaterThan(0);
      expect(plugins).toContain(agent.getPlugin());
    });

    test('State manager is passed to plugin config', async () => {
      const agent = new ConversationalAgent({
        accountId: '0.0.12345',
        privateKey: 'mock-private-key',
        openAIApiKey: 'sk-test'
      });

      await agent.initialize();

      const hcs10Plugin = agent.getPlugin();
      expect(hcs10Plugin.appConfig).toBeDefined();
      expect(hcs10Plugin.appConfig.stateManager).toBe(agent.getStateManager());
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
        'Agent not initialized. Call initialize() first.'
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
      expect(hederaAgent).toBe(mockAgent);
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

      const createAgentCall = (createAgent as unknown as Mock).mock.calls[0];
      const systemMessage = createAgentCall[0].messaging?.systemPreamble;
      
      expect(systemMessage).toBeDefined();
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

      expect(HederaMirrorNode).toHaveBeenCalledWith('mainnet');
    });
  });

  describe('Tool Filtering', () => {
    test('Applies custom tool filter to remove specific tools', async () => {
      const toolFilter = (tool: { name: string; namespace?: string }) => {
        return !tool.name.includes('unwanted');
      };

      const agent = new ConversationalAgent({
        accountId: '0.0.12345',
        privateKey: 'mock-private-key',
        openAIApiKey: 'sk-test',
        toolFilter
      });

      await agent.initialize();

      const createAgentCall = (createAgent as unknown as Mock).mock.calls[0];
      const toolPredicate = createAgentCall[0].filtering?.toolPredicate;
      
      expect(toolPredicate).toBeDefined();
      expect(toolPredicate({ name: 'wanted-tool' })).toBe(true);
      expect(toolPredicate({ name: 'unwanted-tool' })).toBe(false);
    });

    test('Tool filter works alongside hardcoded hedera-account-transfer-hbar filter', async () => {
      const toolFilter = (tool: { name: string; namespace?: string }) => {
        return tool.namespace !== 'restricted';
      };

      const agent = new ConversationalAgent({
        accountId: '0.0.12345',
        privateKey: 'mock-private-key',
        openAIApiKey: 'sk-test',
        toolFilter
      });

      await agent.initialize();

      const createAgentCall = (createAgent as unknown as Mock).mock.calls[0];
      const toolPredicate = createAgentCall[0].filtering?.toolPredicate;
      
      expect(toolPredicate({ name: 'hedera-account-transfer-hbar' })).toBe(false);
      
      expect(toolPredicate({ name: 'hedera-account-transfer-hbar', namespace: 'allowed' })).toBe(false);
      
      expect(toolPredicate({ name: 'some-tool', namespace: 'restricted' })).toBe(false);
      expect(toolPredicate({ name: 'some-tool', namespace: 'allowed' })).toBe(true);
    });

    test('Tool filter can be undefined and defaults to allowing all tools except hardcoded ones', async () => {
      const agent = new ConversationalAgent({
        accountId: '0.0.12345',
        privateKey: 'mock-private-key',
        openAIApiKey: 'sk-test'
      });

      await agent.initialize();

      const createAgentCall = (createAgent as unknown as Mock).mock.calls[0];
      const toolPredicate = createAgentCall[0].filtering?.toolPredicate;
      
      expect(toolPredicate).toBeDefined();
      expect(toolPredicate({ name: 'hedera-account-transfer-hbar' })).toBe(false);
      expect(toolPredicate({ name: 'any-other-tool' })).toBe(true);
      expect(toolPredicate({ name: 'another-tool', namespace: 'any' })).toBe(true);
    });

    test('Tool filter receives proper tool structure with name and namespace', async () => {
      const capturedTools: Array<{ name: string; namespace?: string }> = [];
      
      const toolFilter = (tool: { name: string; namespace?: string }) => {
        capturedTools.push(tool);
        return true;
      };

      const agent = new ConversationalAgent({
        accountId: '0.0.12345',
        privateKey: 'mock-private-key',
        openAIApiKey: 'sk-test',
        toolFilter
      });

      await agent.initialize();

      const createAgentCall = (createAgent as unknown as Mock).mock.calls[0];
      const toolPredicate = createAgentCall[0].filtering?.toolPredicate;
      
      toolPredicate({ name: 'test-tool' });
      toolPredicate({ name: 'namespaced-tool', namespace: 'test-ns' });
      
      expect(capturedTools).toHaveLength(2);
      expect(capturedTools[0]).toEqual({ name: 'test-tool' });
      expect(capturedTools[1]).toEqual({ name: 'namespaced-tool', namespace: 'test-ns' });
    });

    test('Complex tool filter with multiple conditions', async () => {
      const toolFilter = (tool: { name: string; namespace?: string }) => {
        if (tool.name.includes('test')) return false;
        if (tool.namespace === 'dev') return false;
        if (tool.namespace && !['production', 'stable'].includes(tool.namespace)) return false;
        return true;
      };

      const agent = new ConversationalAgent({
        accountId: '0.0.12345',
        privateKey: 'mock-private-key',
        openAIApiKey: 'sk-test',
        toolFilter
      });

      await agent.initialize();

      const createAgentCall = (createAgent as unknown as Mock).mock.calls[0];
      const toolPredicate = createAgentCall[0].filtering?.toolPredicate;
      
      expect(toolPredicate({ name: 'test-tool', namespace: 'production' })).toBe(false);
      expect(toolPredicate({ name: 'good-tool', namespace: 'dev' })).toBe(false);
      expect(toolPredicate({ name: 'good-tool', namespace: 'beta' })).toBe(false);
      expect(toolPredicate({ name: 'good-tool', namespace: 'production' })).toBe(true);
      expect(toolPredicate({ name: 'good-tool' })).toBe(true);
    });
  });
});