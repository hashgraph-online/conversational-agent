import { describe, test, expect, vi, beforeEach } from 'vitest';
import { BaseAgent, LangChainAgent, createAgent } from '../../src';
import { LangChainProvider } from '../../src/providers';
import { ChatOpenAI } from '@langchain/openai';

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
    getAllHederaCorePlugins: vi.fn().mockReturnValue([]),
    TokenUsageCallbackHandler: vi.fn().mockImplementation(function(this: any) {
      this.getLatestTokenUsage = vi.fn().mockReturnValue(null);
      this.getTotalTokenUsage = vi.fn().mockReturnValue({ promptTokens: 0, completionTokens: 0, totalTokens: 0 });
      this.getTokenUsageHistory = vi.fn().mockReturnValue([]);
      this.reset = vi.fn();
    }),
    calculateTokenCostSync: vi.fn().mockReturnValue({ totalCost: 0 }),
  };
});

vi.mock('@langchain/openai', () => ({
  ChatOpenAI: vi.fn().mockImplementation(() => ({
    invoke: vi.fn().mockResolvedValue('Test response'),
    stream: vi.fn().mockResolvedValue([]),
  })),
}));

vi.mock('langchain/agents', () => ({
  createOpenAIToolsAgent: vi.fn().mockResolvedValue({}),
  AgentExecutor: vi.fn().mockImplementation(function(this: any) {
    this.invoke = vi.fn().mockResolvedValue({
      output: 'Test response',
      intermediateSteps: [],
    });
  }),
}));

vi.mock('@langchain/core/prompts', () => ({
  ChatPromptTemplate: {
    fromMessages: vi.fn().mockReturnValue({}),
  },
  MessagesPlaceholder: vi.fn().mockImplementation((name: string) => ({ name })),
}));

vi.mock('@hashgraphonline/standards-sdk', () => ({
  Logger: vi.fn().mockImplementation(() => ({
    info: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
  })),
}));

describe('BaseAgent Unit Tests', () => {
  const mockSigner = {
    getAccountId: () => ({ toString: () => '0.0.12345' }),
    getNetwork: () => 'testnet',
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('BaseAgent Abstract Class', () => {
    test('BaseAgent has abstract methods', () => {
          expect(BaseAgent).toBeDefined();
      expect(typeof BaseAgent).toBe('function');
      
      // Test that it's a constructor function (class)
      expect(BaseAgent.prototype.constructor).toBe(BaseAgent);
      
      // Test that concrete methods exist
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

      await expect(agent.chat('test message')).rejects.toThrow(
        'Agent not initialized. Call boot() first.'
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
      const response = await agent.chat('test message');

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

      agent['executor'] = {
        invoke: vi.fn().mockRejectedValue(new Error('Test error')),
      } as any;

      const response = await agent.chat('test message');

      expect(response).toHaveProperty('error');
      expect(response.output).toBe('Sorry, I encountered an error processing your request.');
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
          framework: 'vercel' as any,
        });
      }).toThrow('Vercel AI SDK support coming soon');

      expect(() => {
        createAgent({
          signer: mockSigner,
          framework: 'baml' as any,
        });
      }).toThrow('BAML support coming soon');

      expect(() => {
        createAgent({
          signer: mockSigner,
          framework: 'unknown' as any,
        });
      }).toThrow('Unknown framework: unknown');
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
      const mockModel = {
        stream: vi.fn().mockResolvedValue(['chunk1', 'chunk2']),
      } as any;
      
      const provider = new LangChainProvider(mockModel);
      const stream = provider.stream?.('test prompt');

      if (stream) {
        const chunks = [];
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
          namespaceWhitelist: ['hcs-10'],
        },
      });

      const mockTools = [
        { name: 'tool1', namespace: 'hcs-10' },
        { name: 'tool2', namespace: 'hcs-2' },
        { name: 'tool3' },
      ];

      const filtered = agent['filterTools'](mockTools as any);
      expect(filtered).toHaveLength(2);
    });

    test('Filters tools by blacklist', async () => {
      const agent = new LangChainAgent({
        signer: mockSigner,
        ai: {
          apiKey: 'test-key',
        },
        filtering: {
          toolBlacklist: ['unwanted-tool'],
        },
      });

      const mockTools = [
        { name: 'good-tool' },
        { name: 'unwanted-tool' },
        { name: 'another-tool' },
      ];

      const filtered = agent['filterTools'](mockTools as any);
      expect(filtered).toHaveLength(2);
      expect(filtered.find(t => t.name === 'unwanted-tool')).toBeUndefined();
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
        { name: 'keep-this' },
        { name: 'remove-this' },
        { name: 'keep-that' },
      ];

      const filtered = agent['filterTools'](mockTools as any);
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
      expect(prompt).toContain('0.0.12345');
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