import { describe, test, expect, vi, beforeEach } from 'vitest';
import { ConversationalAgent } from '../../src';
import { BasePlugin } from 'hedera-agent-kit';
import type { GenericPluginContext } from 'hedera-agent-kit';

// Mock hedera-agent-kit modules
vi.mock('hedera-agent-kit', async () => {
  const actual = await vi.importActual('hedera-agent-kit');
  return {
    ...actual,
    ServerSigner: vi.fn().mockImplementation(() => ({
      getAccountId: () => ({ toString: () => '0.0.12345' }),
    })),
    HederaConversationalAgent: vi.fn().mockImplementation(function(this: any, signer: any, config: any) {
      this.config = config;
      this.initialize = vi.fn().mockResolvedValue(undefined);
      this.processMessage = vi.fn().mockResolvedValue({
        output: 'Test response',
        transactionId: '0.0.12345@1234567890.123',
      });
    }),
    getAllHederaCorePlugins: vi.fn().mockReturnValue([]),
  };
});

// Mock the HCS10Builder to prevent actual client initialization
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

// Mock HederaMirrorNode
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

// Mock @hashgraph/sdk
vi.mock('@hashgraph/sdk', () => ({
  PrivateKey: {
    fromStringED25519: vi.fn().mockReturnValue('mock-private-key-instance'),
    fromStringECDSA: vi.fn().mockReturnValue('mock-private-key-instance'),
  },
}));

/**
 * Unit tests for ConversationalAgent additional plugins functionality
 */
describe('ConversationalAgent Plugin Support', () => {
  const mockAccountId = '0.0.12345';
  const mockPrivateKey = '302e020100300506032b657004220420a689b974df063cc7e19fd4ddeaf6dd412b5efec4e4a3cee7f181d29d40b3fc1e';
  const mockOpenAIKey = 'sk-test-key';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  // Create a mock plugin
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

    // Get the HederaConversationalAgent mock instance
    const { HederaConversationalAgent } = await import('hedera-agent-kit');
    const lastCall = (HederaConversationalAgent as any).mock.calls[(HederaConversationalAgent as any).mock.calls.length - 1];
    const config = lastCall[1];
    
    // Check that the config includes our additional plugin
    expect(config.pluginConfig.plugins).toHaveLength(2); // OpenConvAI + MockPlugin (getAllHederaCorePlugins returns empty array in mock)
    
    // Verify OpenConvAI plugin is first
    expect(config.pluginConfig.plugins[0].id).toBe('openconvai-standards-agent-kit');
    
    // Verify our mock plugin is second
    expect(config.pluginConfig.plugins[1]).toBe(mockPlugin);
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

    // Verify the custom state manager is used
    expect(agent.getStateManager()).toBe(customStateManager);
    
    // Get the HederaConversationalAgent mock instance
    const { HederaConversationalAgent } = await import('hedera-agent-kit');
    const lastCall = (HederaConversationalAgent as any).mock.calls[(HederaConversationalAgent as any).mock.calls.length - 1];
    const config = lastCall[1];
    
    // Check that the config includes our custom state manager
    expect(config.pluginConfig.appConfig.stateManager).toBe(customStateManager);
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

    // Get the HederaConversationalAgent mock instance
    const { HederaConversationalAgent } = await import('hedera-agent-kit');
    const lastCall = (HederaConversationalAgent as any).mock.calls[(HederaConversationalAgent as any).mock.calls.length - 1];
    const config = lastCall[1];
    
    // Verify all optional configs are passed correctly
    expect(config.operationalMode).toBe('returnBytes');
    expect(config.userAccountId).toBe('0.0.99999');
    expect(config.customSystemMessagePreamble).toBe(customPreamble);
    expect(config.customSystemMessagePostamble).toBe(customPostamble);
    expect(config.scheduleUserTransactionsInBytesMode).toBe(true);
    expect(config.disableLogging).toBe(true);
    expect(config.verbose).toBe(true);
  });

  test('ConversationalAgent uses default system message when no custom preamble provided', async () => {
    const agent = new ConversationalAgent({
      accountId: mockAccountId,
      privateKey: mockPrivateKey,
      network: 'testnet',
      openAIApiKey: mockOpenAIKey
    });

    await agent.initialize();

    // Get the HederaConversationalAgent mock instance
    const { HederaConversationalAgent } = await import('hedera-agent-kit');
    const lastCall = (HederaConversationalAgent as any).mock.calls[(HederaConversationalAgent as any).mock.calls.length - 1];
    const config = lastCall[1];
    
    // Verify default system message is used
    expect(config.customSystemMessagePreamble).toContain('You are a helpful assistant managing Hedera HCS-10 connections');
    expect(config.customSystemMessagePreamble).toContain(mockAccountId);
  });
});