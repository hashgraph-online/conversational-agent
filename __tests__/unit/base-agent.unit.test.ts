import { describe, test, expect, beforeEach } from '@jest/globals';
import { BaseAgent, LangChainAgent, createAgent } from '../../src';
import { LangChainProvider } from '../../src/providers';
import { ChatOpenAI } from '@langchain/openai';
import { BaseChatModel } from '@langchain/core/language_models/chat_models';
import { createMockServerSigner, createMockTool, createMockAgentExecutor, MockStructuredToolInterface, MockAgentExecutorInterface } from '../mock-factory';
import { TEST_RESPONSE_MESSAGES, TEST_MCP_DATA, TEST_FRAMEWORK_VALUES, TEST_TOOL_VALUES } from '../test-constants';

// Mock BasePlugin before importing anything that uses it
jest.mock('hedera-agent-kit', () => ({
  BasePlugin: class MockBasePlugin {
    context = {
      logger: {
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
        debug: jest.fn(),
      },
      config: {},
    };

    async initialize(context: any) {
      this.context = { ...this.context, ...context };
    }

    async cleanup() {}
  },
  BaseServiceBuilder: class MockBaseServiceBuilder {
    constructor(hederaKit: any) {
      this.hederaKit = hederaKit;
    }
    hederaKit: any;
  },
  HederaAgentKit: jest.fn().mockImplementation(() => ({
    initialize: jest.fn().mockResolvedValue(undefined),
    getAggregatedLangChainTools: jest.fn().mockReturnValue([]),
    operationalMode: 'returnBytes',
  })),
}));

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


interface MockStreamModel {
  stream: jest.Mock;
}


jest.mock('hedera-agent-kit', async () => {
  const actual = await (jest.requireActual as jest.Mock)('hedera-agent-kit') as Record<string, unknown>;
  return {
    ...actual,
    ServerSigner: jest.fn().mockImplementation(() => createMockServerSigner()),
    HederaAgentKit: jest.fn().mockImplementation(function(this: MockHederaKit) {
      this.initialize = jest.fn().mockResolvedValue(undefined);
      this.getAggregatedLangChainTools = jest.fn().mockReturnValue([]);
      this.operationalMode = 'returnBytes';
    }),
    getAllHederaCorePlugins: jest.fn().mockReturnValue([]),
    TokenUsageCallbackHandler: jest.fn().mockImplementation(function(this: MockTokenUsageCallbackHandler) {
      this.getLatestTokenUsage = jest.fn().mockReturnValue(null);
      this.getTotalTokenUsage = jest.fn().mockReturnValue({ promptTokens: 0, completionTokens: 0, totalTokens: 0 });
      this.getTokenUsageHistory = jest.fn().mockReturnValue([]);
      this.reset = jest.fn();
    }),
    calculateTokenCostSync: jest.fn().mockReturnValue({ totalCost: 0 }),
  };
});

jest.mock('@langchain/openai', () => ({
  ChatOpenAI: jest.fn().mockImplementation(() => ({
    invoke: jest.fn().mockResolvedValue('Test response'),
    stream: jest.fn().mockResolvedValue([]),
  })),
}));

jest.mock('langchain/agents', () => ({
  createOpenAIToolsAgent: jest.fn().mockResolvedValue({}),
  AgentExecutor: jest.fn().mockImplementation(function(this: MockAgentExecutor) {
    this.invoke = jest.fn().mockResolvedValue({
      output: 'Test response',
      intermediateSteps: [],
    });
  }),
}));

jest.mock('@langchain/core/prompts', () => ({
  ChatPromptTemplate: {
    fromMessages: jest.fn().mockReturnValue({}),
  },
  MessagesPlaceholder: jest.fn().mockImplementation((name: string) => ({ name })),
}));

jest.mock('@hashgraphonline/standards-sdk', () => ({
  Logger: jest.fn().mockImplementation(() => ({
    info: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
    warn: jest.fn(),
  })),
}));

describe('BaseAgent Unit Tests', () => {
  const mockSigner = createMockServerSigner();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('BaseAgent Abstract Class', () => {
    test('BaseAgent has abstract methods', () => {
          expect(BaseAgent).toBeDefined();
      expect(typeof BaseAgent).toBe('function');
      
      expect(BaseAgent.prototype.constructor).toBe(BaseAgent);
      expect(BaseAgent.prototype.getCore).toBeDefined();
      expect(BaseAgent.prototype.isReady).toBeDefined();
    });
  });

  describe('LangChainAgent', () => {
    test('Creates LangChainAgent instance successfully', () => {
      const agent = new LangChainAgent({
        signer: mockSigner,
        ai: {
          apiKey: 'test-key',
          modelName: 'gpt-4o-mini',
        },
      });

      expect(agent).toBeInstanceOf(LangChainAgent);
      expect(agent).toBeInstanceOf(BaseAgent);
    });

    test('Initializes agent successfully', async () => {
      const agent = new LangChainAgent({
        signer: mockSigner,
        ai: {
          apiKey: 'test-key',
        },
      });

      await agent.boot();
      expect(agent.isReady()).toBe(true);
    });

    test('Throws error when chatting before initialization', async () => {
      const agent = new LangChainAgent({
        signer: mockSigner,
        ai: {
          apiKey: 'test-key',
        },
      });

      await expect(agent.chat(TEST_RESPONSE_MESSAGES.TEST_MESSAGE)).rejects.toThrow(
        TEST_RESPONSE_MESSAGES.INIT_ERROR
      );
    });

    test('Processes messages successfully after initialization', async () => {
      const agent = new LangChainAgent({
        signer: mockSigner,
        ai: {
          apiKey: 'test-key',
        },
      });

      await agent.boot();
      const response = await agent.chat(TEST_RESPONSE_MESSAGES.TEST_MESSAGE);

      expect(response).toHaveProperty('output');
      expect(typeof response.output).toBe('string');
    });

    test('Switches operational mode successfully', async () => {
      const agent = new LangChainAgent({
        signer: mockSigner,
        ai: {
          apiKey: 'test-key',
        },
        execution: {
          operationalMode: 'autonomous',
        },
      });

      agent.switchMode('returnBytes');
      
      expect(agent['config'].execution?.operationalMode).toBe('returnBytes');
    });

    test('Returns usage statistics', async () => {
      const agent = new LangChainAgent({
        signer: mockSigner,
        ai: {
          apiKey: 'test-key',
        },
      });

      await agent.boot();
      const stats = agent.getUsageStats();

      expect(stats).toHaveProperty('promptTokens');
      expect(stats).toHaveProperty('completionTokens');
      expect(stats).toHaveProperty('totalTokens');
      expect(stats).toHaveProperty('cost');
    });

    test('Clears usage statistics', async () => {
      const agent = new LangChainAgent({
        signer: mockSigner,
        ai: {
          apiKey: 'test-key',
        },
      });

      await agent.boot();
      agent.clearUsageStats();

      const mockTokenTracker = agent['tokenTracker'];
      expect(mockTokenTracker?.reset).toHaveBeenCalled();
    });

    test('Shuts down successfully', async () => {
      const agent = new LangChainAgent({
        signer: mockSigner,
        ai: {
          apiKey: 'test-key',
        },
      });

      await agent.boot();
      await agent.shutdown();

      expect(agent.isReady()).toBe(false);
      expect(agent['executor']).toBeUndefined();
      expect(agent['agentKit']).toBeUndefined();
    });

    test('Handles errors gracefully', async () => {
      const agent = new LangChainAgent({
        signer: mockSigner,
        ai: {
          apiKey: 'test-key',
        },
      });

      await agent.boot();

      const mockExecutor = createMockAgentExecutor({
        invoke: jest.fn().mockRejectedValue(new Error(TEST_RESPONSE_MESSAGES.TEST_ERROR)),
      });
      agent['executor'] = mockExecutor as MockAgentExecutorInterface;

      const response = await agent.chat(TEST_RESPONSE_MESSAGES.TEST_MESSAGE);

      expect(response).toHaveProperty('error');
      expect(response.output).toBe(TEST_RESPONSE_MESSAGES.PROCESSING_ERROR);
    });
  });

  describe('Agent Factory', () => {
    test('Creates LangChain agent by default', () => {
      const agent = createAgent({
        signer: mockSigner,
        ai: {
          apiKey: 'test-key',
        },
      });

      expect(agent).toBeInstanceOf(LangChainAgent);
    });

    test('Creates LangChain agent explicitly', () => {
      const agent = createAgent({
        signer: mockSigner,
        framework: 'langchain',
        ai: {
          apiKey: 'test-key',
        },
      });

      expect(agent).toBeInstanceOf(LangChainAgent);
    });

    test('Throws error for unsupported frameworks', () => {
      expect(() => {
        createAgent({
          signer: mockSigner,
          framework: TEST_FRAMEWORK_VALUES.VERCEL,
        });
      }).toThrow(TEST_RESPONSE_MESSAGES.VERCEL_AI_COMING_SOON);

      expect(() => {
        createAgent({
          signer: mockSigner,
          framework: TEST_FRAMEWORK_VALUES.BAML,
        });
      }).toThrow(TEST_RESPONSE_MESSAGES.BAML_COMING_SOON);

      expect(() => {
        createAgent({
          signer: mockSigner,
          framework: 'unknown' as 'langchain',
        });
      }).toThrow(`${TEST_RESPONSE_MESSAGES.UNKNOWN_FRAMEWORK_PREFIX}unknown`);
    });
  });

  describe('AI Providers', () => {
    test('LangChainProvider generates responses', async () => {
      const mockModel = new ChatOpenAI();
      const provider = new LangChainProvider(mockModel);

      const response = await provider.generate('test prompt');
      expect(typeof response).toBe('string');
    });

    test('LangChainProvider streams responses', async () => {
      const mockModel: MockStreamModel = {
        stream: jest.fn().mockResolvedValue(['chunk1', 'chunk2']),
      };
      
      const provider = new LangChainProvider(mockModel as unknown as BaseChatModel);
      const stream = provider.stream?.('test prompt');

      if (stream) {
        const chunks: string[] = [];
        for await (const chunk of stream) {
          chunks.push(chunk);
        }
        expect(chunks).toHaveLength(2);
      }
    });

    test('LangChainProvider returns model', () => {
      const mockModel = new ChatOpenAI();
      const provider = new LangChainProvider(mockModel);

      expect(provider.getModel()).toBe(mockModel);
    });
  });

  describe('Tool Filtering', () => {
    test('Filters tools by namespace whitelist', async () => {
      const agent = new LangChainAgent({
        signer: mockSigner,
        ai: {
          apiKey: 'test-key',
        },
        filtering: {
          namespaceWhitelist: [TEST_TOOL_VALUES.HCS_10_NAMESPACE],
        },
      });

      const mockTools = [
        createMockTool('tool1', TEST_TOOL_VALUES.HCS_10_NAMESPACE),
        createMockTool('tool2', TEST_TOOL_VALUES.HCS_2_NAMESPACE),
        createMockTool('tool3'),
      ];

      const filtered = agent['filterTools'](mockTools as MockStructuredToolInterface[]);
      expect(filtered).toHaveLength(2);
    });

    test('Filters tools by blacklist', async () => {
      const agent = new LangChainAgent({
        signer: mockSigner,
        ai: {
          apiKey: 'test-key',
        },
        filtering: {
          toolBlacklist: [TEST_TOOL_VALUES.UNWANTED_TOOL],
        },
      });

      const mockTools = [
        createMockTool(TEST_TOOL_VALUES.GOOD_TOOL),
        createMockTool(TEST_TOOL_VALUES.UNWANTED_TOOL),
        createMockTool(TEST_TOOL_VALUES.ANOTHER_TOOL),
      ];

      const filtered = agent['filterTools'](mockTools as MockStructuredToolInterface[]);
      expect(filtered).toHaveLength(2);
      expect(filtered.find(t => t.name === TEST_TOOL_VALUES.UNWANTED_TOOL)).toBeUndefined();
    });

    test('Filters tools by custom predicate', async () => {
      const agent = new LangChainAgent({
        signer: mockSigner,
        ai: {
          apiKey: 'test-key',
        },
        filtering: {
          toolPredicate: (tool) => tool.name.startsWith('keep-'),
        },
      });

      const mockTools = [
        createMockTool(TEST_TOOL_VALUES.KEEP_THIS),
        createMockTool(TEST_TOOL_VALUES.REMOVE_THIS),
        createMockTool(TEST_TOOL_VALUES.KEEP_THAT),
      ];

      const filtered = agent['filterTools'](mockTools as MockStructuredToolInterface[]);
      expect(filtered).toHaveLength(2);
      expect(filtered.every(t => t.name.startsWith('keep-'))).toBe(true);
    });
  });

  describe('System Prompt Building', () => {
    test('Builds basic system prompt', async () => {
      const agent = new LangChainAgent({
        signer: mockSigner,
        ai: {
          apiKey: 'test-key',
        },
      });

      const prompt = agent['buildSystemPrompt']();
      expect(prompt).toContain('You are a helpful Hedera assistant');
      expect(prompt).toContain(TEST_MCP_DATA.DEFAULT_ACCOUNT_ID);
    });

    test('Includes user account ID in prompt', async () => {
      const agent = new LangChainAgent({
        signer: mockSigner,
        ai: {
          apiKey: 'test-key',
        },
        execution: {
          userAccountId: '0.0.54321',
        },
      });

      const prompt = agent['buildSystemPrompt']();
      expect(prompt).toContain('0.0.54321');
      expect(prompt).toContain('IMPORTANT: When the user says');
    });

    test('Includes custom messaging', async () => {
      const agent = new LangChainAgent({
        signer: mockSigner,
        ai: {
          apiKey: 'test-key',
        },
        messaging: {
          systemPreamble: 'Custom preamble',
          systemPostamble: 'Custom postamble',
        },
      });

      const prompt = agent['buildSystemPrompt']();
      expect(prompt).toContain('Custom preamble');
      expect(prompt).toContain('Custom postamble');
    });

    test('Includes metadata quality principles', async () => {
      const agent = new LangChainAgent({
        signer: mockSigner,
        ai: {
          apiKey: 'test-key',
        },
      });

      const prompt = agent['buildSystemPrompt']();
      expect(prompt).toContain('METADATA QUALITY PRINCIPLES');
      expect(prompt).toContain('Prioritize meaningful, valuable content over technical file information');
      expect(prompt).toContain('Focus on attributes that add value for end users and collectors');
      expect(prompt).toContain('Avoid auto-generating meaningless technical attributes');
      expect(prompt).toContain('When fields are missing or inadequate, use forms to collect quality metadata');
      expect(prompt).toContain('Encourage descriptive names, collectible traits, and storytelling elements');
    });
  });

  describe('MCP Tools', () => {
    test('Does not initialize MCP when no servers configured', async () => {
      const agent = new LangChainAgent({
        signer: mockSigner,
        ai: {
          apiKey: 'test-key',
        },
      });

      await agent.boot();
      expect(agent['mcpManager']).toBeUndefined();
    });

    test('Does not initialize MCP when servers array is empty', async () => {
      const agent = new LangChainAgent({
        signer: mockSigner,
        ai: {
          apiKey: 'test-key',
        },
        mcp: {
          servers: [],
        },
      });

      await agent.boot();
      expect(agent['mcpManager']).toBeUndefined();
    });
  });
});