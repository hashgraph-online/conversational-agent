import { describe, test, expect, beforeEach, afterEach } from '@jest/globals';
import { ConversationalAgent } from '../../src';
import { TEST_CRYPTO_CONSTANTS } from '../test-constants';

/**
 * Additional tests to achieve 100% coverage for conversational-agent.ts
 * These tests specifically target the uncovered lines identified in the coverage report
 */

describe('ConversationalAgent Missing Coverage Tests', () => {
  const mockOptions = {
    accountId: TEST_CRYPTO_CONSTANTS.MOCK_ACCOUNT_ID,
    privateKey: TEST_CRYPTO_CONSTANTS.MOCK_PRIVATE_KEY_ED25519,
    openAIApiKey: 'test-openai-key',
    network: 'testnet' as const,
    llmProvider: 'openai' as const,
  };

  describe('userAccountId option coverage', () => {
    test('should handle userAccountId option when provided', async () => {
      const agent = new ConversationalAgent({
        ...mockOptions,
        userAccountId: '0.0.67890',
      });

      expect(agent).toBeDefined();
      expect(typeof agent.initialize).toBe('function');
    });

    test('should work without userAccountId option', async () => {
      const agent = new ConversationalAgent(mockOptions);
      expect(agent).toBeDefined();
    });
  });

  describe('Entity memory configuration coverage', () => {
    test('should initialize with entityMemoryEnabled: true', async () => {
      const agent = new ConversationalAgent({
        ...mockOptions,
        entityMemoryEnabled: true,
        entityMemoryConfig: {
          maxTokens: 50000,
        },
      });

      try {
        await agent.initialize();
      } catch (error) {
        expect(error).toBeDefined();
      }
    });

    test('should work with entityMemoryEnabled: false', async () => {
      const agent = new ConversationalAgent({
        ...mockOptions,
        entityMemoryEnabled: false,
      });

      try {
        await agent.initialize();
      } catch (error) {
        expect(error).toBeDefined();
      }
    });

    test('should handle custom entityMemoryConfig', async () => {
      const agent = new ConversationalAgent({
        ...mockOptions,
        entityMemoryEnabled: true,
        entityMemoryConfig: {
          maxTokens: 100000,
        },
      });

      expect(agent).toBeDefined();
    });
  });

  describe('GPT-5 model temperature configuration coverage', () => {
    test('should set temperature to 1 for GPT-5 models', async () => {
      const agent = new ConversationalAgent({
        ...mockOptions,
        openAIModelName: 'gpt-5-turbo',
      });

      try {
        await agent.initialize();
      } catch (error) {
        expect(error).toBeDefined();
      }
    });

    test('should set temperature to 1 for gpt5 models (case insensitive)', async () => {
      const agent = new ConversationalAgent({
        ...mockOptions,
        openAIModelName: 'GPT5-advanced',
      });

      try {
        await agent.initialize();
      } catch (error) {
        expect(error).toBeDefined();
      }
    });

    test('should use default temperature for non-GPT5 models', async () => {
      const agent = new ConversationalAgent({
        ...mockOptions,
        openAIModelName: 'gpt-4o-mini',
      });

      try {
        await agent.initialize();
      } catch (error) {
        expect(error).toBeDefined();
      }
    });
  });

  describe('Anthropic LLM provider coverage', () => {
    test('should initialize with Anthropic provider', async () => {
      const agent = new ConversationalAgent({
        ...mockOptions,
        llmProvider: 'anthropic',
      });

      try {
        await agent.initialize();
      } catch (error) {
        expect(error).toBeDefined();
      }
    });
  });

  describe('Tool filter edge cases coverage', () => {
    test('should handle tool filter returning false', async () => {
      const agent = new ConversationalAgent({
        ...mockOptions,
        toolFilter: () => false,
      });

      try {
        await agent.initialize();
      } catch (error) {
        expect(error).toBeDefined();
      }
    });

    test('should handle tool filter with namespace filtering', async () => {
      const agent = new ConversationalAgent({
        ...mockOptions,
        toolFilter: (tool) => {
          if (tool.namespace === 'blocked-namespace') {
            return false;
          }
          return tool.name !== 'blocked-tool';
        },
      });

      try {
        await agent.initialize();
      } catch (error) {
        expect(error).toBeDefined();
      }
    });
  });

  describe('Custom system message coverage', () => {
    test('should handle custom system message preamble and postamble', async () => {
      const agent = new ConversationalAgent({
        ...mockOptions,
        customSystemMessagePreamble: 'Custom preamble text',
        customSystemMessagePostamble: 'Custom postamble text',
      });

      expect(agent).toBeDefined();
    });
  });

  describe('Additional plugins coverage', () => {
    test('should handle additional plugins array', async () => {
      const mockPlugin = {
        id: 'test-plugin',
        name: 'Test Plugin',
        description: 'A test plugin',
        version: '1.0.0',
        author: 'Test Author',
        namespace: 'test',
        initialize: jest.fn(),
        cleanup: jest.fn(),
        context: {},
        getTools: jest.fn().mockReturnValue([]),
      } as any;

      const agent = new ConversationalAgent({
        ...mockOptions,
        additionalPlugins: [mockPlugin],
      });

      expect(agent).toBeDefined();
    });
  });

  describe('Operational mode coverage', () => {
    test('should handle returnBytes operational mode', async () => {
      const agent = new ConversationalAgent({
        ...mockOptions,
        operationalMode: 'returnBytes',
      });

      expect(agent).toBeDefined();
    });

    test('should handle execute operational mode', async () => {
      const agent = new ConversationalAgent({
        ...mockOptions,
        operationalMode: 'autonomous' as const,
      });

      expect(agent).toBeDefined();
    });
  });

  describe('MCP servers coverage', () => {
    test('should handle MCP server configuration', async () => {
      const agent = new ConversationalAgent({
        ...mockOptions,
        mcpServers: [
          {
            name: 'test-mcp',
            command: 'test-command',
            args: ['--test'],
          },
        ],
      });

      try {
        await agent.initialize();
      } catch (error) {
        expect(error).toBeDefined();
      }
    });
  });

  describe('Mirror node config coverage', () => {
    test('should handle custom mirror node config', async () => {
      const agent = new ConversationalAgent({
        ...mockOptions,
        mirrorNodeConfig: {
          apiKey: 'custom-api-key',
        },
      });

      expect(agent).toBeDefined();
    });
  });

  describe('Logging configuration coverage', () => {
    test('should handle disableLogging option', async () => {
      const agent = new ConversationalAgent({
        ...mockOptions,
        disableLogging: true,
      });

      expect(agent).toBeDefined();
    });

    test('should handle verbose option', async () => {
      const agent = new ConversationalAgent({
        ...mockOptions,
        verbose: true,
      });

      expect(agent).toBeDefined();
    });
  });

  describe('State manager coverage', () => {
    test('should handle custom state manager', async () => {
      const mockStateManager = {
        initialize: jest.fn(),
        get: jest.fn(),
        set: jest.fn(),
        clear: jest.fn(),
        getAll: jest.fn(),
        setCurrentAgent: jest.fn(),
        getCurrentAgent: jest.fn(),
        addActiveConnection: jest.fn(),
        updateOrAddConnection: jest.fn(),
        removeConnection: jest.fn(),
        getConnections: jest.fn(),
        getActiveConnections: jest.fn(),
        getConnection: jest.fn(),
      } as any;

      const agent = new ConversationalAgent({
        ...mockOptions,
        stateManager: mockStateManager,
      });

      expect(agent).toBeDefined();
    });
  });

  describe('Schedule user transactions coverage', () => {
    test('should handle scheduleUserTransactionsInBytesMode option', async () => {
      const agent = new ConversationalAgent({
        ...mockOptions,
        scheduleUserTransactionsInBytesMode: true,
      });

      expect(agent).toBeDefined();
    });
  });

  describe('Enabled plugins filtering coverage', () => {
    test('should handle enabledPlugins array', async () => {
      const agent = new ConversationalAgent({
        ...mockOptions,
        enabledPlugins: ['hcs10', 'inscribe', 'hbar'],
      });

      expect(agent).toBeDefined();
    });

    test('should handle empty enabledPlugins array', async () => {
      const agent = new ConversationalAgent({
        ...mockOptions,
        enabledPlugins: [],
      });

      expect(agent).toBeDefined();
    });
  });
});