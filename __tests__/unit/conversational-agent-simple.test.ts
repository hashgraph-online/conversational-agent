import { describe, test, expect, jest } from '@jest/globals';

// Mock all dependencies before importing
jest.mock('../../src/plugins/hcs-10/HCS10Plugin', () => ({
  HCS10Plugin: jest.fn().mockImplementation(() => ({
    initialize: jest.fn(),
    cleanup: jest.fn(),
    getTools: jest.fn(() => []),
  })),
}));

jest.mock('../../src/plugins/hcs-2/HCS2Plugin', () => ({
  HCS2Plugin: jest.fn().mockImplementation(() => ({
    initialize: jest.fn(),
    cleanup: jest.fn(),
    getTools: jest.fn(() => []),
  })),
}));

jest.mock('../../src/plugins/inscribe/InscribePlugin', () => ({
  InscribePlugin: jest.fn().mockImplementation(() => ({
    initialize: jest.fn(),
    cleanup: jest.fn(),
    getTools: jest.fn(() => []),
  })),
}));

jest.mock('../../src/plugins/hbar/HbarPlugin', () => ({
  HbarPlugin: jest.fn().mockImplementation(() => ({
    initialize: jest.fn(),
    cleanup: jest.fn(),
    getTools: jest.fn(() => []),
  })),
}));

jest.mock('@hashgraphonline/standards-agent-kit', () => ({
  OpenConvaiState: jest.fn().mockImplementation(() => ({
    setCurrentAgent: jest.fn(),
    getCurrentAgent: jest.fn(),
    initializeConnectionsManager: jest.fn(),
  })),
}));

jest.mock('../../src/memory', () => ({
  SmartMemoryManager: jest.fn().mockImplementation(() => ({
    dispose: jest.fn(),
  })),
}));

jest.mock('../../src/tools/entity-resolver-tool', () => ({
  createEntityTools: jest.fn(() => []),
}));

jest.mock('../../src/config/system-message', () => ({
  getSystemMessage: jest.fn(() => 'Test system message'),
}));

jest.mock('../../src/services/content-store-manager', () => ({
  ContentStoreManager: jest.fn().mockImplementation(() => ({
    initialize: jest.fn(),
    dispose: jest.fn(),
  })),
}));

jest.mock('hedera-agent-kit', () => ({
  ServerSigner: jest.fn().mockImplementation((accountId, privateKey, network) => ({
    getAccountId: jest.fn(() => ({ toString: () => accountId })),
    getNetwork: jest.fn(() => network),
    sign: jest.fn(),
    freeze: jest.fn().mockReturnThis(),
    submit: jest.fn().mockResolvedValue({}),
  })),
  getAllHederaCorePlugins: jest.fn(() => []),
}));

jest.mock('@hashgraphonline/standards-sdk', () => ({
  Logger: jest.fn().mockImplementation(() => ({
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  })),
  NetworkType: { TESTNET: 'testnet', MAINNET: 'mainnet' },
}));

jest.mock('../../src/agent-factory', () => ({
  createAgent: jest.fn(() => ({
    chat: jest.fn().mockResolvedValue({
      output: 'Test response',
      intermediateSteps: [],
    }),
    boot: jest.fn().mockResolvedValue(undefined),
  })),
}));

// Now import after mocks are set up
import { ConversationalAgent } from '../../src/conversational-agent';

/**
 * Simple unit tests for ConversationalAgent
 * Focus on core functionality that can be tested without complex setup
 */
describe('ConversationalAgent - Basic Functionality', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Constructor', () => {
    test('Creates ConversationalAgent with required options', () => {
      const agent = new ConversationalAgent({
        accountId: '0.0.12345',
        privateKey: 'mock-private-key',
        openAIApiKey: 'sk-test'
      });

      expect(agent).toBeDefined();
      expect(agent.getStateManager()).toBeDefined();
    });

    test('Throws error when OpenAI key is missing but entity memory is enabled', () => {
      expect(() => {
        new ConversationalAgent({
          accountId: '0.0.12345',
          privateKey: 'mock-private-key',
          entityMemoryEnabled: true
          // missing openAIApiKey
        });
      }).toThrow('OpenAI API key is required when entity memory is enabled');
    });

    test('Creates entity tools when OpenAI key is provided and entity memory is enabled', () => {
      // Test that the agent can be created with entity memory enabled
      const agent = new ConversationalAgent({
        accountId: '0.0.12345',
        privateKey: 'mock-private-key',
        openAIApiKey: 'sk-test',
        entityMemoryEnabled: true
      });

      expect(agent).toBeDefined();
      // The entity tools creation happens in constructor, we just verify it doesn't throw
    });

    test('Creates agent without entity tools when entity memory is disabled', () => {
      const agent = new ConversationalAgent({
        accountId: '0.0.12345',
        privateKey: 'mock-private-key',
        openAIApiKey: 'sk-test',
        entityMemoryEnabled: false
      });

      expect(agent).toBeDefined();
      // When entityMemoryEnabled is false, no entity tools should be created
    });
  });

  describe('Configuration Validation', () => {
    test('Throws error during initialization for empty account ID', async () => {
      const agent = new ConversationalAgent({
        accountId: '',
        privateKey: 'mock-private-key',
        openAIApiKey: 'sk-test'
      });

      await expect(agent.initialize()).rejects.toThrow('Account ID and private key are required');
    });

    test('Throws error during initialization for empty private key', async () => {
      const agent = new ConversationalAgent({
        accountId: '0.0.12345',
        privateKey: '',
        openAIApiKey: 'sk-test'
      });

      await expect(agent.initialize()).rejects.toThrow('Account ID and private key are required');
    });

    test('Throws error during initialization for undefined account ID', async () => {
      const agent = new ConversationalAgent({
        accountId: undefined as any,
        privateKey: 'mock-private-key',
        openAIApiKey: 'sk-test'
      });

      await expect(agent.initialize()).rejects.toThrow('Account ID and private key are required');
    });

    test('Throws error during initialization for undefined private key', async () => {
      const agent = new ConversationalAgent({
        accountId: '0.0.12345',
        privateKey: undefined as any,
        openAIApiKey: 'sk-test'
      });

      await expect(agent.initialize()).rejects.toThrow('Account ID and private key are required');
    });

    test('Throws error for invalid account ID type', async () => {
      const agent = new ConversationalAgent({
        accountId: 12345 as any,
        privateKey: 'mock-private-key',
        openAIApiKey: 'sk-test'
      });

      await expect(agent.initialize()).rejects.toThrow('Account ID must be a string');
    });

    test('Throws error for invalid private key type', async () => {
      const agent = new ConversationalAgent({
        accountId: '0.0.12345',
        privateKey: 12345 as any,
        openAIApiKey: 'sk-test'
      });

      await expect(agent.initialize()).rejects.toThrow('Private key must be a string');
    });

    test('Accepts valid configuration with minimal options', () => {
      const agent = new ConversationalAgent({
        accountId: '0.0.12345',
        privateKey: 'mock-private-key',
        openAIApiKey: 'sk-test'
      });

      expect(agent).toBeDefined();
    });

    test('Accepts configuration with all optional parameters', () => {
      const agent = new ConversationalAgent({
        accountId: '0.0.12345',
        privateKey: 'mock-private-key',
        network: 'testnet',
        openAIApiKey: 'sk-test',
        openAIModelName: 'gpt-4',
        framework: 'langchain',
        operationalMode: 'autonomous',
        disableLogging: false,
        stateManager: {} as any,
        entityMemoryEnabled: true,
        entityMemoryConfig: { maxMessages: 100 },
        mcpServers: [],
        toolFilter: () => true
      });

      expect(agent).toBeDefined();
    });
  });

  describe('Message Processing', () => {
    test('Throws error if not initialized', async () => {
      const agent = new ConversationalAgent({
        accountId: '0.0.12345',
        privateKey: 'mock-private-key',
        openAIApiKey: 'sk-test'
      });

      await expect(agent.processMessage('test message')).rejects.toThrow(
        'Agent not initialized. Call initialize() first.'
      );
    });

    test('Throws error for empty message', async () => {
      const agent = new ConversationalAgent({
        accountId: '0.0.12345',
        privateKey: 'mock-private-key',
        openAIApiKey: 'sk-test'
      });

      await expect(agent.processMessage('')).rejects.toThrow(
        'Agent not initialized. Call initialize() first.'
      );
    });

    test('Throws error for whitespace only message', async () => {
      const agent = new ConversationalAgent({
        accountId: '0.0.12345',
        privateKey: 'mock-private-key',
        openAIApiKey: 'sk-test'
      });

      await expect(agent.processMessage('   ')).rejects.toThrow(
        'Agent not initialized. Call initialize() first.'
      );
    });
  });

  describe('Form Submission', () => {
    test('Throws error if not initialized', async () => {
      const agent = new ConversationalAgent({
        accountId: '0.0.12345',
        privateKey: 'mock-private-key',
        openAIApiKey: 'sk-test'
      });

      const submission = {
        formId: 'test-form',
        toolName: 'test-tool',
        parameters: { field: 'value' },
        timestamp: Date.now()
      };

      await expect(agent.processFormSubmission(submission)).rejects.toThrow(
        'Agent not initialized. Call initialize() first.'
      );
    });

    test('Accepts valid form submission structure', async () => {
      const agent = new ConversationalAgent({
        accountId: '0.0.12345',
        privateKey: 'mock-private-key',
        openAIApiKey: 'sk-test'
      });

      const submission = {
        formId: 'test-form',
        toolName: 'test-tool',
        parameters: { field: 'value' },
        timestamp: Date.now()
      };

      // This should throw because agent is not initialized, not because of invalid submission
      await expect(agent.processFormSubmission(submission)).rejects.toThrow(
        'Agent not initialized. Call initialize() first.'
      );
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

    test('getStateManager returns state manager', () => {
      const agent = new ConversationalAgent({
        accountId: '0.0.12345',
        privateKey: 'mock-private-key',
        openAIApiKey: 'sk-test'
      });

      const stateManager = agent.getStateManager();
      expect(stateManager).toBeDefined();
    });

    test('getPlugin returns HCS10 plugin', () => {
      const agent = new ConversationalAgent({
        accountId: '0.0.12345',
        privateKey: 'mock-private-key',
        openAIApiKey: 'sk-test'
      });

      const plugin = agent.getPlugin();
      expect(plugin).toBeDefined();
      expect(plugin.constructor.name).toBe('HCS10Plugin');
    });
  });

  describe('Cleanup', () => {
    test('Cleanup completes successfully even if not initialized', async () => {
      const agent = new ConversationalAgent({
        accountId: '0.0.12345',
        privateKey: 'mock-private-key',
        openAIApiKey: 'sk-test'
      });

      // Cleanup should not throw an error even when not initialized
      await expect(agent.cleanup()).resolves.toBeUndefined();
    });
  });

  describe('Edge Cases', () => {
    test('Handles long account IDs', () => {
      const longAccountId = '0.0.' + '1'.repeat(50);
      const agent = new ConversationalAgent({
        accountId: longAccountId,
        privateKey: 'mock-private-key',
        openAIApiKey: 'sk-test'
      });

      expect(agent).toBeDefined();
    });

    test('Handles special characters in account ID', () => {
      const specialAccountId = '0.0.test_123-special';
      const agent = new ConversationalAgent({
        accountId: specialAccountId,
        privateKey: 'mock-private-key',
        openAIApiKey: 'sk-test'
      });

      expect(agent).toBeDefined();
    });

    test('Handles very short private key', () => {
      const agent = new ConversationalAgent({
        accountId: '0.0.12345',
        privateKey: 'x',
        openAIApiKey: 'sk-test'
      });

      expect(agent).toBeDefined();
    });

    test('Handles empty tool filter', () => {
      const agent = new ConversationalAgent({
        accountId: '0.0.12345',
        privateKey: 'mock-private-key',
        openAIApiKey: 'sk-test',
        toolFilter: undefined
      });

      expect(agent).toBeDefined();
    });
  });
});
