import { describe, test, expect, beforeEach } from '@jest/globals';
import { ConversationalAgent } from '../../src';
import { BasePlugin, HederaConversationalAgent } from 'hedera-agent-kit';
import type { GenericPluginContext } from 'hedera-agent-kit';

interface MockAgent {
  boot: jest.Mock;
  chat: jest.Mock;
  generateFormFields: jest.Mock;
  callTool: jest.Mock;
}

interface MockHederaKit {
  initialize: jest.Mock;
  getAggregatedLangChainTools: jest.Mock;
  operationalMode: string;
}

interface MockTokenUsageCallbackHandler {
  getLatestTokenUsage: jest.Mock;
  getTotalTokenUsage: jest.Mock;
  getTokenUsageHistory: jest.Mock;
  reset: jest.Mock;
}

interface MockConversationalAgent {
  boot: jest.Mock;
  chat: jest.Mock;
  config: {
    extensions: {
      plugins: MockPlugin[];
    };
  };
}

interface MockPlugin {
  id: string;
  name?: string;
}

interface MockCustomStateManager {
  custom: string;
  someMethod: jest.Mock;
}

let mockAgent: MockAgent;

jest.mock('hedera-agent-kit', () => ({
    ServerSigner: jest.fn().mockImplementation(() => ({
      getAccountId: () => ({ toString: () => '0.0.12345' }),
      getNetwork: () => 'testnet',
    })),
    HederaAgentKit: jest.fn().mockImplementation(function(this: MockHederaKit) {
      this.initialize = jest.fn().mockResolvedValue(undefined);
      this.getAggregatedLangChainTools = jest.fn().mockReturnValue([]);
      this.operationalMode = 'returnBytes';
    }),
    HederaConversationalAgent: jest.fn(),
    getAllHederaCorePlugins: jest.fn().mockReturnValue([
      { id: 'hedera-token-service', name: 'Hedera Token Service Plugin' },
      { id: 'hedera-consensus-service', name: 'Hedera Consensus Service Plugin' },
      { id: 'hedera-account', name: 'Hedera Account Plugin' },
      { id: 'hedera-smart-contract-service', name: 'Hedera Smart Contract Service Plugin' },
      { id: 'hedera-network', name: 'Hedera Network Plugin' }
    ]),
    TokenUsageCallbackHandler: jest.fn().mockImplementation(function(this: MockTokenUsageCallbackHandler) {
      this.getLatestTokenUsage = jest.fn().mockReturnValue(null);
      this.getTotalTokenUsage = jest.fn().mockReturnValue({ promptTokens: 0, completionTokens: 0, totalTokens: 0 });
      this.getTokenUsageHistory = jest.fn().mockReturnValue([]);
      this.reset = jest.fn();
    }),
    calculateTokenCostSync: jest.fn().mockReturnValue({ totalCost: 0 }),
    BasePlugin: class MockBasePlugin {
      id = '';
      name = '';
      description = '';
      version = '';
      author = '';
      namespace = '';
      async initialize() {}
      async cleanup() {}
    },
    BaseServiceBuilder: class MockBaseServiceBuilder {
      constructor(_hederaKit: unknown) {}
    },
    BaseHederaTransactionTool: class MockBaseHederaTransactionTool {
      name = '';
      description = '';
      constructor() {}
    }
}));

jest.mock('@hashgraphonline/standards-agent-kit', () => ({
    HCS10Builder: jest.fn().mockImplementation(() => ({
      getStandardClient: jest.fn(),
      getOperatorId: jest.fn().mockReturnValue('0.0.12345'),
      getNetwork: jest.fn().mockReturnValue('testnet')
    })),
    OpenConvaiState: jest.fn(),
    RegisterAgentTool: jest.fn(),
    FindRegistrationsTool: jest.fn(),
    InitiateConnectionTool: jest.fn(),
    ListConnectionsTool: jest.fn(),
    SendMessageToConnectionTool: jest.fn(),
    CheckMessagesTool: jest.fn(),
    ConnectionMonitorTool: jest.fn(),
    ManageConnectionRequestsTool: jest.fn(),
    AcceptConnectionRequestTool: jest.fn(),
    RetrieveProfileTool: jest.fn(),
    ListUnapprovedConnectionRequestsTool: jest.fn(),
}));

jest.mock('@hashgraphonline/standards-sdk', () => ({
    HederaMirrorNode: jest.fn().mockImplementation(() => ({
      requestAccount: jest.fn().mockResolvedValue({
        key: { _type: 'ED25519' }
      })
    })),
    Logger: jest.fn().mockImplementation(() => ({
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
    })),
    HCS10Client: jest.fn(),
    ContentStoreService: {
      setInstance: jest.fn(),
      getInstance: jest.fn(),
    },
    ContentResolverRegistry: {
      register: jest.fn(),
      resolve: jest.fn(),
    },
    extractReferenceId: jest.fn(),
    shouldUseReference: jest.fn(),
}));

jest.mock('@hashgraph/sdk', () => ({
  PrivateKey: {
    fromStringED25519: jest.fn().mockReturnValue('mock-private-key-instance'),
    fromStringECDSA: jest.fn().mockReturnValue('mock-private-key-instance'),
  },
}));

jest.mock('../../src/agent-factory', () => ({
  createAgent: jest.fn(() => mockAgent)
}));

/**
 * Unit tests for ConversationalAgent additional plugins functionality
 */
describe('ConversationalAgent Plugin Support', () => {
  const mockAccountId = '0.0.12345';
  const mockPrivateKey = '302e020100300506032b657004220420a689b974df063cc7e19fd4ddeaf6dd412b5efec4e4a3cee7f181d29d40b3fc1e';
  const mockOpenAIKey = 'sk-test-key';
  let mockConversationalAgent: MockConversationalAgent;

  beforeEach(() => {
    jest.clearAllMocks();
    
    mockAgent = {
      boot: jest.fn().mockResolvedValue(undefined),
      chat: jest.fn().mockResolvedValue({
        output: 'Test response',
        intermediateSteps: []
      })
    };
    
    mockConversationalAgent = {
      initialize: jest.fn().mockResolvedValue(undefined),
      processMessage: jest.fn().mockResolvedValue({
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
    
    const hcs10Plugin = config.extensions.plugins.find((p: MockPlugin) => p.id === 'hcs-10');
    expect(hcs10Plugin).toBeDefined();
    
    expect(config.extensions.plugins).toContain(mockPlugin);
  });

  test('ConversationalAgent works with custom state manager', async () => {
    const customStateManager: MockCustomStateManager = {
      custom: 'state',
      someMethod: jest.fn()
    };
    
    const agent = new ConversationalAgent({
      accountId: mockAccountId,
      privateKey: mockPrivateKey,
      network: 'testnet',
      openAIApiKey: mockOpenAIKey,
      stateManager: customStateManager as unknown
    });

    await agent.initialize();

    expect(agent.getStateManager()).toBe(customStateManager);
    
    const { createAgent } = await import('../../src/agent-factory');
    const createAgentCall = (createAgent as unknown as Mock).mock.calls[0];
    const _config = createAgentCall[0];
    
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