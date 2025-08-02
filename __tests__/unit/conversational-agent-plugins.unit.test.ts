import { describe, test, expect, vi, beforeEach, Mock } from 'vitest';
import { ConversationalAgent } from '../../src';
import { BasePlugin, HederaConversationalAgent } from 'hedera-agent-kit';
import type { GenericPluginContext } from 'hedera-agent-kit';

let mockAgent: any;

vi.mock('hedera-agent-kit', async () => {
  const actual = await vi.importActual('hedera-agent-kit');
  return {
    ...actual,
    ServerSigner: vi.fn().mockImplementation(() => ({
      getAccountId: () => ({ toString: () => '0.0.12345' }),
      getNetwork: () => 'testnet',
    })),
    HederaAgentKit: vi.fn().mockImplementation(function(this: any) {
      this.initialize = vi.fn().mockResolvedValue(undefined);
      this.getAggregatedLangChainTools = vi.fn().mockReturnValue([]);
      this.operationalMode = 'returnBytes';
    }),
    HederaConversationalAgent: vi.fn(),
    getAllHederaCorePlugins: vi.fn().mockReturnValue([
      { id: 'hedera-token-service', name: 'Hedera Token Service Plugin' },
      { id: 'hedera-consensus-service', name: 'Hedera Consensus Service Plugin' },
      { id: 'hedera-account', name: 'Hedera Account Plugin' },
      { id: 'hedera-smart-contract-service', name: 'Hedera Smart Contract Service Plugin' },
      { id: 'hedera-network', name: 'Hedera Network Plugin' }
    ]),
    TokenUsageCallbackHandler: vi.fn().mockImplementation(function(this: any) {
      this.getLatestTokenUsage = vi.fn().mockReturnValue(null);
      this.getTotalTokenUsage = vi.fn().mockReturnValue({ promptTokens: 0, completionTokens: 0, totalTokens: 0 });
      this.getTokenUsageHistory = vi.fn().mockReturnValue([]);
      this.reset = vi.fn();
    }),
    calculateTokenCostSync: vi.fn().mockReturnValue({ totalCost: 0 }),
  };
});

vi.mock('@hashgraphonline/standards-agent-kit', async () => {
  const actual = await vi.importActual('@hashgraphonline/standards-agent-kit');
  return {
    ...actual,
    HCS10Builder: vi.fn().mockImplementation(() => ({
      getStandardClient: vi.fn(),
      getOperatorId: vi.fn().mockReturnValue('0.0.12345'),
      getNetwork: vi.fn().mockReturnValue('testnet')
    }))
  };
});

vi.mock('@hashgraphonline/standards-sdk', async () => {
  const actual = await vi.importActual('@hashgraphonline/standards-sdk');
  return {
    ...actual,
    HederaMirrorNode: vi.fn().mockImplementation(() => ({
      requestAccount: vi.fn().mockResolvedValue({
        key: { _type: 'ED25519' }
      })
    }))
  };
});

vi.mock('@hashgraph/sdk', () => ({
  PrivateKey: {
    fromStringED25519: vi.fn().mockReturnValue('mock-private-key-instance'),
    fromStringECDSA: vi.fn().mockReturnValue('mock-private-key-instance'),
  },
}));

vi.mock('../../src/agent-factory', () => ({
  createAgent: vi.fn(() => mockAgent)
}));

/**
 * Unit tests for ConversationalAgent additional plugins functionality
 */
describe('ConversationalAgent Plugin Support', () => {
  const mockAccountId = '0.0.12345';
  const mockPrivateKey = '302e020100300506032b657004220420a689b974df063cc7e19fd4ddeaf6dd412b5efec4e4a3cee7f181d29d40b3fc1e';
  const mockOpenAIKey = 'sk-test-key';
  let mockConversationalAgent: any;

  beforeEach(() => {
    vi.clearAllMocks();
    
    mockAgent = {
      boot: vi.fn().mockResolvedValue(undefined),
      chat: vi.fn().mockResolvedValue({
        output: 'Test response',
        intermediateSteps: []
      })
    };
    
    mockConversationalAgent = {
      initialize: vi.fn().mockResolvedValue(undefined),
      processMessage: vi.fn().mockResolvedValue({
        output: 'Test response',
        transactionId: '0.0.12345@1234567890.123',
      })
    };
    
    (HederaConversationalAgent as unknown as Mock).mockImplementation(() => mockConversationalAgent);
  });

  class MockPlugin extends BasePlugin {
    id = 'mock-plugin';
    name = 'Mock Plugin';
    description = 'A mock plugin for testing';
    author = 'Mock Author';
    version = '1.0.0';
    namespace = 'mock';

    initialized = false;

    override async initialize(context: GenericPluginContext): Promise<void> {
      await super.initialize(context);
      this.initialized = true;
    }

    getTools(): [] {
      return [];
    }
  }

  test('ConversationalAgent accepts additional plugins', async () => {
    const mockPlugin = new MockPlugin();
    
    const agent = new ConversationalAgent({
      accountId: mockAccountId,
      privateKey: mockPrivateKey,
      network: 'testnet',
      openAIApiKey: mockOpenAIKey,
      additionalPlugins: [mockPlugin]
    });

    await agent.initialize();

    const { createAgent } = await import('../../src/agent-factory');
    const createAgentCall = (createAgent as unknown as Mock).mock.calls[0];
    const config = createAgentCall[0];
    
    expect(config.extensions?.plugins).toBeDefined();
    expect(config.extensions.plugins.length).toBeGreaterThan(0);
    
    const hcs10Plugin = config.extensions.plugins.find((p: any) => p.id === 'hcs-10');
    expect(hcs10Plugin).toBeDefined();
    
    expect(config.extensions.plugins).toContain(mockPlugin);
  });

  test('ConversationalAgent works with custom state manager', async () => {
    const customStateManager = {
      custom: 'state',
      someMethod: vi.fn()
    };
    
    const agent = new ConversationalAgent({
      accountId: mockAccountId,
      privateKey: mockPrivateKey,
      network: 'testnet',
      openAIApiKey: mockOpenAIKey,
      stateManager: customStateManager as any
    });

    await agent.initialize();

    expect(agent.getStateManager()).toBe(customStateManager);
    
    const { createAgent } = await import('../../src/agent-factory');
    const createAgentCall = (createAgent as unknown as Mock).mock.calls[0];
    const config = createAgentCall[0];
    
    expect(agent.getStateManager()).toBe(customStateManager);
    
    const hcs10Plugin = agent.getPlugin();
    expect(hcs10Plugin.appConfig).toBeDefined();
    expect(hcs10Plugin.appConfig.stateManager).toBe(customStateManager);
  });

  test('ConversationalAgent passes optional configuration correctly', async () => {
    const customPreamble = 'Custom instructions here';
    const customPostamble = 'Additional instructions';
    
    const agent = new ConversationalAgent({
      accountId: mockAccountId,
      privateKey: mockPrivateKey,
      network: 'testnet',
      openAIApiKey: mockOpenAIKey,
      operationalMode: 'returnBytes',
      userAccountId: '0.0.99999',
      customSystemMessagePreamble: customPreamble,
      customSystemMessagePostamble: customPostamble,
      scheduleUserTransactionsInBytesMode: true,
      disableLogging: true,
      verbose: true
    });

    await agent.initialize();

    const { createAgent } = await import('../../src/agent-factory');
    const createAgentCall = (createAgent as unknown as Mock).mock.calls[0];
    const config = createAgentCall[0];
    
    expect(config.execution?.operationalMode).toBe('returnBytes');
    expect(config.execution?.userAccountId).toBe('0.0.99999');
    expect(config.messaging?.systemPreamble).toBe(customPreamble);
    expect(config.messaging?.systemPostamble).toBe(customPostamble);
    expect(config.execution?.scheduleUserTransactions).toBe(true);
    expect(config.debug?.silent).toBe(true);
    expect(config.debug?.verbose).toBe(true);
  });

  test('ConversationalAgent uses default system message when no custom preamble provided', async () => {
    const agent = new ConversationalAgent({
      accountId: mockAccountId,
      privateKey: mockPrivateKey,
      network: 'testnet',
      openAIApiKey: mockOpenAIKey
    });

    await agent.initialize();

    const { createAgent } = await import('../../src/agent-factory');
    const createAgentCall = (createAgent as unknown as Mock).mock.calls[0];
    const config = createAgentCall[0];
    
    expect(config.messaging?.systemPreamble).toBeDefined();
    expect(config.messaging.systemPreamble).toContain('You are a helpful assistant managing Hashgraph Online HCS-10 connections');
    expect(config.messaging.systemPreamble).toContain(mockAccountId);
  });
});