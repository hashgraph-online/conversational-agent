import { createAgent } from '../../src/agent-factory';
import { BaseAgent, type HederaAgentConfiguration } from '../../src/base-agent';
import { LangChainAgent } from '../../src/langchain/langchain-agent';
import { ServerSigner } from 'hedera-agent-kit';

jest.mock('../../src/langchain/langchain-agent');
jest.mock('hedera-agent-kit');

const mockLangChainAgent = jest.mocked(LangChainAgent);
const mockServerSigner = jest.mocked(ServerSigner);

describe('createAgent', () => {
  let mockSigner: any;
  let baseConfig: HederaAgentConfiguration;

  beforeEach(() => {
    jest.clearAllMocks();

    mockSigner = {
      getAccountId: jest.fn().mockReturnValue({ toString: () => '0.0.123' }),
    };

    baseConfig = {
      signer: mockSigner,
      execution: {
        mode: 'direct',
        operationalMode: 'autonomous',
      },
      ai: {
        temperature: 0.1,
      },
      debug: {
        verbose: false,
        silent: false,
      },
    };

    mockServerSigner.mockImplementation(() => mockSigner);
    mockLangChainAgent.mockImplementation(() => ({} as any));
  });

  it('should create LangChain agent by default', () => {
    const agent = createAgent(baseConfig);

    expect(mockLangChainAgent).toHaveBeenCalledWith(baseConfig);
    expect(agent).toBeDefined();
  });

  it('should create LangChain agent when explicitly specified', () => {
    const config = { ...baseConfig, framework: 'langchain' as const };

    const agent = createAgent(config);

    expect(mockLangChainAgent).toHaveBeenCalledWith(config);
    expect(agent).toBeDefined();
  });

  it('should throw error for Vercel AI framework', () => {
    const config = { ...baseConfig, framework: 'vercel' as const };

    expect(() => createAgent(config)).toThrow('Vercel AI SDK support coming soon');
  });

  it('should throw error for BAML framework', () => {
    const config = { ...baseConfig, framework: 'baml' as const };

    expect(() => createAgent(config)).toThrow('BAML support coming soon');
  });

  it('should throw error for unknown framework', () => {
    const config = { ...baseConfig, framework: 'unknown' as any };

    expect(() => createAgent(config)).toThrow('Unknown framework: unknown');
  });

  it('should handle complex configuration with all options', () => {
    const complexConfig = {
      ...baseConfig,
      framework: 'langchain' as const,
      execution: {
        mode: 'bytes' as const,
        operationalMode: 'returnBytes' as const,
        userAccountId: '0.0.456',
        scheduleUserTransactions: true,
        scheduleUserTransactionsInBytesMode: true,
      },
      ai: {
        apiKey: 'test-key',
        modelName: 'gpt-4',
        temperature: 0.5,
      },
      filtering: {
        namespaceWhitelist: ['allowed'],
        toolBlacklist: ['blocked'],
        toolPredicate: () => true,
      },
      messaging: {
        systemPreamble: 'Preamble',
        systemPostamble: 'Postamble',
        conciseMode: false,
      },
      extensions: {
        plugins: [],
        mirrorConfig: {},
        modelCapability: 'advanced',
      },
      mcp: {
        servers: [],
        autoConnect: true,
      },
      debug: {
        verbose: true,
        silent: false,
      },
    };

    const agent = createAgent(complexConfig);

    expect(mockLangChainAgent).toHaveBeenCalledWith(complexConfig);
    expect(agent).toBeDefined();
  });

  it('should handle minimal configuration', () => {
    const minimalConfig: HederaAgentConfiguration = {
      signer: mockSigner,
    };

    const agent = createAgent(minimalConfig);

    expect(mockLangChainAgent).toHaveBeenCalledWith(minimalConfig);
    expect(agent).toBeDefined();
  });

  it('should preserve all config properties when creating agent', () => {
    const configWithCustomProps = {
      ...baseConfig,
      framework: 'langchain' as const,
      customProperty: 'test-value',
      nested: {
        deep: {
          value: 123,
        },
      },
    };

    createAgent(configWithCustomProps);

    expect(mockLangChainAgent).toHaveBeenCalledWith(configWithCustomProps);
  });

  it('should handle undefined framework gracefully', () => {
    const configWithUndefinedFramework = {
      ...baseConfig,
      framework: undefined,
    };

    const agent = createAgent(configWithUndefinedFramework);

    expect(mockLangChainAgent).toHaveBeenCalledWith(configWithUndefinedFramework);
    expect(agent).toBeDefined();
  });

  describe('Framework String Validation', () => {
    it('should handle case-sensitive framework names', () => {
      expect(() => createAgent({ ...baseConfig, framework: 'LangChain' as any })).toThrow(
        'Unknown framework: LangChain'
      );
      expect(() => createAgent({ ...baseConfig, framework: 'LANGCHAIN' as any })).toThrow(
        'Unknown framework: LANGCHAIN'
      );
    });

    it('should handle empty string framework', () => {
      expect(() => createAgent({ ...baseConfig, framework: '' as any })).toThrow(
        'Unknown framework: '
      );
    });

    it('should handle null framework', () => {
      expect(() => createAgent({ ...baseConfig, framework: null as any })).toThrow(
        'Unknown framework: null'
      );
    });
  });

  describe('Type Safety', () => {
    it('should accept valid framework types', () => {
      const validFrameworks: Array<'langchain' | 'vercel' | 'baml'> = ['langchain', 'vercel', 'baml'];
      
      validFrameworks.forEach(framework => {
        const config = { ...baseConfig, framework };
        
        if (framework === 'langchain') {
          expect(() => createAgent(config)).not.toThrow();
        } else {
          expect(() => createAgent(config)).toThrow();
        }
      });
    });

    it('should return BaseAgent instance', () => {
      mockLangChainAgent.mockImplementation(() => ({
        boot: jest.fn(),
        chat: jest.fn(),
        processFormSubmission: jest.fn(),
        shutdown: jest.fn(),
        switchMode: jest.fn(),
        getUsageStats: jest.fn(),
        getUsageLog: jest.fn(),
        clearUsageStats: jest.fn(),
        connectMCPServers: jest.fn(),
        getMCPConnectionStatus: jest.fn(),
        getCore: jest.fn(),
        isReady: jest.fn(),
      } as any));

      const agent = createAgent(baseConfig);

      expect(typeof agent).toBe('object');
      expect(agent).toBeDefined();
    });
  });

  describe('Error Handling', () => {
    it('should propagate LangChainAgent constructor errors', () => {
      const error = new Error('LangChain initialization failed');
      mockLangChainAgent.mockImplementation(() => {
        throw error;
      });

      expect(() => createAgent(baseConfig)).toThrow('LangChain initialization failed');
    });

    it('should handle configuration validation errors', () => {
      const invalidConfig = {
        ...baseConfig,
        signer: null,
      } as any;

      mockLangChainAgent.mockImplementation(() => {
        throw new Error('Invalid signer');
      });

      expect(() => createAgent(invalidConfig)).toThrow('Invalid signer');
    });
  });

  describe('Configuration Passthrough', () => {
    it('should pass through all configuration properties', () => {
      const fullConfig = {
        ...baseConfig,
        framework: 'langchain' as const,
        customField: 'custom-value',
        execution: {
          mode: 'bytes' as const,
          operationalMode: 'returnBytes' as const,
          userAccountId: '0.0.999',
          scheduleUserTransactions: false,
          scheduleUserTransactionsInBytesMode: false,
        },
        ai: {
          provider: {} as any,
          llm: {} as any,
          apiKey: 'test-api-key',
          modelName: 'test-model',
          temperature: 0.8,
        },
        filtering: {
          namespaceWhitelist: ['test-namespace'],
          toolBlacklist: ['blocked-tool'],
          toolPredicate: (tool: any) => tool.name !== 'forbidden',
        },
        messaging: {
          systemPreamble: 'Test preamble',
          systemPostamble: 'Test postamble',
          conciseMode: true,
        },
        extensions: {
          plugins: [{ id: 'test-plugin' } as any],
          mirrorConfig: { testKey: 'testValue' },
          modelCapability: 'basic',
        },
        mcp: {
          servers: [{ name: 'test-server', command: 'test', args: [] }],
          autoConnect: false,
        },
        debug: {
          verbose: false,
          silent: true,
        },
      };

      createAgent(fullConfig);

      expect(mockLangChainAgent).toHaveBeenCalledWith(fullConfig);
    });

    it('should not modify the original config object', () => {
      const originalConfig = { ...baseConfig };
      const configCopy = JSON.parse(JSON.stringify(originalConfig));

      createAgent(originalConfig);

      expect(originalConfig).toEqual(configCopy);
    });
  });
});