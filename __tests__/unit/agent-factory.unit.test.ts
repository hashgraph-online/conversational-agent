import { describe, test, expect } from '@jest/globals';

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

interface _MockLogger {
  info: jest.Mock;
  warn: jest.Mock;
  error: jest.Mock;
  debug: jest.Mock;
}

interface MockTool {
  name: string;
}
import { createAgent } from '../../src/agent-factory';
import { LangChainAgent } from '../../src/langchain/langchain-agent';
import { createMockServerSigner, createMockPlugin } from '../mock-factory';

jest.mock('hedera-agent-kit', async () => {
  const actual = await jest.requireActual('hedera-agent-kit') as Record<string, unknown>;
  return {
    ...actual,
    ServerSigner: jest.fn().mockImplementation(() => ({
      getAccountId: () => ({ toString: () => '0.0.12345' }),
      getNetwork: () => 'testnet',
      client: {},
      accountIdInternal: '0.0.12345',
      privateKey: 'mock-private-key',
      networkInternal: 'testnet',
      operationalMode: 'mock',
      balance: jest.fn(),
      getBalance: jest.fn(),
      getAccountInfo: jest.fn(),
      createAccount: jest.fn(),
      sign: jest.fn(),
      signMessage: jest.fn(),
      freeze: jest.fn(),
      submit: jest.fn(),
      submitAndWait: jest.fn(),
      getLiveHashQuery: jest.fn(),
      getTokenBalance: jest.fn(),
    })),
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

jest.mock('@hashgraphonline/standards-sdk', () => ({
  Logger: jest.fn().mockImplementation(() => ({
    info: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
    warn: jest.fn(),
  })),
}));

describe('Agent Factory Unit Tests', () => {
  const mockSigner = createMockServerSigner();

  describe('createAgent function', () => {
    test('Creates LangChain agent by default', () => {
      const agent = createAgent({
        signer: mockSigner,
        ai: {
          apiKey: 'test-key',
        },
      });

      expect(agent).toBeInstanceOf(LangChainAgent);
    });

    test('Creates LangChain agent when explicitly specified', () => {
      const agent = createAgent({
        signer: mockSigner,
        framework: 'langchain',
        ai: {
          apiKey: 'test-key',
        },
      });

      expect(agent).toBeInstanceOf(LangChainAgent);
    });

    test('Throws error for Vercel AI SDK (not yet implemented)', () => {
      expect(() => {
        createAgent({
          signer: mockSigner,
          framework: 'vercel',
        });
      }).toThrow('Vercel AI SDK support coming soon');
    });

    test('Throws error for BAML (not yet implemented)', () => {
      expect(() => {
        createAgent({
          signer: mockSigner,
          framework: 'baml',
        });
      }).toThrow('BAML support coming soon');
    });

    test('Throws error for unknown framework', () => {
      expect(() => {
        createAgent({
          signer: mockSigner,
          framework: 'unknown-framework' as unknown as 'langchain',
        });
      }).toThrow('Unknown framework: unknown-framework');
    });

    test('Passes configuration correctly to LangChain agent', () => {
      const config = {
        signer: mockSigner,
        framework: 'langchain' as const,
        ai: {
          apiKey: 'test-key',
          modelName: 'gpt-4o',
          temperature: 0.7,
        },
        execution: {
          operationalMode: 'autonomous' as const,
          userAccountId: '0.0.54321',
        },
        messaging: {
          systemPreamble: 'Custom preamble',
          conciseMode: false,
        },
        debug: {
          verbose: true,
          silent: false,
        },
      };

      const agent = createAgent(config);
      expect(agent).toBeInstanceOf(LangChainAgent);
      
      expect(agent['config'].ai?.apiKey).toBe('test-key');
      expect(agent['config'].ai?.modelName).toBe('gpt-4o');
      expect(agent['config'].ai?.temperature).toBe(0.7);
      expect(agent['config'].execution?.operationalMode).toBe('autonomous');
      expect(agent['config'].execution?.userAccountId).toBe('0.0.54321');
      expect(agent['config'].messaging?.systemPreamble).toBe('Custom preamble');
      expect(agent['config'].messaging?.conciseMode).toBe(false);
      expect(agent['config'].debug?.verbose).toBe(true);
      expect(agent['config'].debug?.silent).toBe(false);
    });

    test('Handles minimal configuration', () => {
      const agent = createAgent({
        signer: mockSigner,
      });

      expect(agent).toBeInstanceOf(LangChainAgent);
      expect(agent['config'].signer).toBe(mockSigner);
    });

    test('Handles complex configuration with all options', () => {
      const mockPlugin = createMockPlugin('test-plugin', {
        name: 'Test Plugin',
        description: 'Test plugin',
        namespace: 'test',
      });

      const _mockMCPTool = {
        name: 'test-mcp',
        description: 'Test MCP tool',
        schema: {},
        execute: jest.fn(),
      };

      const config = {
        signer: mockSigner,
        framework: 'langchain' as const,
        execution: {
          mode: 'bytes' as const,
          operationalMode: 'returnBytes' as const,
          userAccountId: '0.0.54321',
          scheduleUserTransactions: true,
        },
        ai: {
          apiKey: 'test-key',
          modelName: 'gpt-4o-mini',
          temperature: 0.5,
        },
        filtering: {
          namespaceWhitelist: ['test'],
          toolBlacklist: ['unwanted-tool'],
          toolPredicate: (tool: MockTool) => tool.name !== 'forbidden',
        },
        messaging: {
          systemPreamble: 'Custom start',
          systemPostamble: 'Custom end',
          conciseMode: true,
        },
        extensions: {
          plugins: [mockPlugin],
          mirrorConfig: { customUrl: 'https://test.com' },
          modelCapability: 'advanced',
        },
        debug: {
          verbose: false,
          silent: true,
        },
      };

      const agent = createAgent(config as any);
      expect(agent).toBeInstanceOf(LangChainAgent);
      
      expect(agent['config'].execution?.mode).toBe('bytes');
      expect(agent['config'].execution?.operationalMode).toBe('returnBytes');
      expect(agent['config'].execution?.userAccountId).toBe('0.0.54321');
      expect(agent['config'].execution?.scheduleUserTransactions).toBe(true);
      
      expect(agent['config'].filtering?.namespaceWhitelist).toEqual(['test']);
      expect(agent['config'].filtering?.toolBlacklist).toEqual(['unwanted-tool']);
      expect(typeof agent['config'].filtering?.toolPredicate).toBe('function');
      
      expect(agent['config'].messaging?.systemPreamble).toBe('Custom start');
      expect(agent['config'].messaging?.systemPostamble).toBe('Custom end');
      expect(agent['config'].messaging?.conciseMode).toBe(true);
      
      expect(agent['config'].extensions?.plugins).toEqual([mockPlugin]);
      expect(agent['config'].extensions?.mirrorConfig).toEqual({ customUrl: 'https://test.com' });
      expect(agent['config'].extensions?.modelCapability).toBe('advanced');
      
      expect(agent['config'].debug?.verbose).toBe(false);
      expect(agent['config'].debug?.silent).toBe(true);
    });
  });

  describe('Framework selection logic', () => {
    test('Defaults to langchain when no framework specified', () => {
      const agent = createAgent({
        signer: mockSigner,
      });

      expect(agent).toBeInstanceOf(LangChainAgent);
    });

    test('Framework parameter is optional', () => {
      const config = {
        signer: mockSigner,
        ai: { apiKey: 'test' },
      };

      expect(() => createAgent(config)).not.toThrow();
    });

    test('Framework selection is case-sensitive', () => {
      expect(() => {
        createAgent({
          signer: mockSigner,
          framework: 'LangChain' as unknown as 'langchain',
        });
      }).toThrow('Unknown framework: LangChain');

      expect(() => {
        createAgent({
          signer: mockSigner,
          framework: 'LANGCHAIN' as unknown as 'langchain',
        });
      }).toThrow('Unknown framework: LANGCHAIN');
    });
  });

  describe('Configuration validation', () => {
    test('Handles missing signer parameter gracefully', () => {
            expect(() => {
        createAgent({} as Parameters<typeof createAgent>[0]);
      }).not.toThrow();
    });

    test('Handles undefined configuration gracefully', () => {
      const agent = createAgent({
        signer: mockSigner,
      });

      expect(agent).toBeInstanceOf(LangChainAgent);
    });
  });
});