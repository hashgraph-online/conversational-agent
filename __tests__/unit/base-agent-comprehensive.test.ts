import { BaseAgent, type HederaAgentConfiguration } from '../../src/base-agent';
import { Logger } from '@hashgraphonline/standards-sdk';
import { ServerSigner, TokenUsageCallbackHandler, HederaAgentKit } from 'hedera-agent-kit';
import type { StructuredTool } from '@langchain/core/tools';
import type { FormSubmission } from '../../src/forms/types';

jest.mock('@hashgraphonline/standards-sdk');
jest.mock('hedera-agent-kit');

const mockLogger = jest.mocked(Logger);
const mockServerSigner = jest.mocked(ServerSigner);
const mockTokenUsageCallbackHandler = jest.mocked(TokenUsageCallbackHandler);
const mockHederaAgentKit = jest.mocked(HederaAgentKit);

class TestAgent extends BaseAgent {
  async boot(): Promise<void> {
    this.initialized = true;
  }

  async chat(message: string): Promise<any> {
    return { output: `Response to: ${message}` };
  }

  async processFormSubmission(submission: FormSubmission): Promise<any> {
    return { output: `Form processed: ${submission.formId}` };
  }

  async shutdown(): Promise<void> {
    this.initialized = false;
  }

  switchMode(): void {
    // Test implementation
  }

  getUsageStats(): any {
    return { tokens: 100, cost: { total: 0.01 } };
  }

  getUsageLog(): any[] {
    return [{ tokens: 50, cost: { total: 0.005 } }];
  }

  clearUsageStats(): void {
    // Test implementation
  }

  async connectMCPServers(): Promise<void> {
    // Test implementation
  }

  getMCPConnectionStatus(): Map<string, any> {
    return new Map([['test-server', { connected: true }]]);
  }

  // Expose protected methods for testing
  public testFilterTools(tools: StructuredTool[]): StructuredTool[] {
    return this.filterTools(tools);
  }

  public testBuildSystemPrompt(): string {
    return this.buildSystemPrompt();
  }

  public setAgentKit(kit: HederaAgentKit): void {
    this.agentKit = kit;
  }

  public setTokenTracker(tracker: TokenUsageCallbackHandler): void {
    this.tokenTracker = tracker;
  }
}

describe('BaseAgent', () => {
  let mockSigner: any;
  let validConfig: HederaAgentConfiguration;

  beforeEach(() => {
    jest.clearAllMocks();

    mockSigner = {
      getAccountId: jest.fn().mockReturnValue({ toString: () => '0.0.123' }),
    };

    validConfig = {
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
  });

  describe('Constructor', () => {
    it('should create instance with valid configuration', () => {
      const agent = new TestAgent(validConfig);

      expect(agent).toBeInstanceOf(BaseAgent);
      expect(mockLogger).toHaveBeenCalledWith({
        module: 'BaseAgent',
        silent: false,
      });
    });

    it('should respect silent debug mode', () => {
      const config = { ...validConfig, debug: { silent: true } };
      
      new TestAgent(config);

      expect(mockLogger).toHaveBeenCalledWith({
        module: 'BaseAgent',
        silent: true,
      });
    });

    it('should initialize with default values', () => {
      const agent = new TestAgent(validConfig);

      expect(agent.isReady()).toBe(false);
      expect(agent.getCore()).toBeUndefined();
    });
  });

  describe('getCore', () => {
    it('should return agent kit when set', () => {
      const agent = new TestAgent(validConfig);
      const mockKit = {} as HederaAgentKit;
      
      agent.setAgentKit(mockKit);

      expect(agent.getCore()).toBe(mockKit);
    });

    it('should return undefined when not set', () => {
      const agent = new TestAgent(validConfig);

      expect(agent.getCore()).toBeUndefined();
    });
  });

  describe('isReady', () => {
    it('should return false before initialization', () => {
      const agent = new TestAgent(validConfig);

      expect(agent.isReady()).toBe(false);
    });

    it('should return true after initialization', async () => {
      const agent = new TestAgent(validConfig);
      await agent.boot();

      expect(agent.isReady()).toBe(true);
    });

    it('should return false after shutdown', async () => {
      const agent = new TestAgent(validConfig);
      await agent.boot();
      await agent.shutdown();

      expect(agent.isReady()).toBe(false);
    });
  });

  describe('filterTools', () => {
    let agent: TestAgent;
    let mockTools: StructuredTool[];

    beforeEach(() => {
      agent = new TestAgent(validConfig);
      mockTools = [
        { name: 'tool1' } as StructuredTool,
        { name: 'tool2', namespace: 'allowed' } as StructuredTool & { namespace: string },
        { name: 'tool3', namespace: 'blocked' } as StructuredTool & { namespace: string },
        { name: 'blacklisted-tool' } as StructuredTool,
      ];
    });

    it('should return all tools when no filtering configured', () => {
      const result = agent.testFilterTools(mockTools);

      expect(result).toHaveLength(4);
      expect(result).toEqual(mockTools);
    });

    it('should filter by namespace whitelist', () => {
      const config = {
        ...validConfig,
        filtering: {
          namespaceWhitelist: ['allowed'],
        },
      };
      agent = new TestAgent(config);

      const result = agent.testFilterTools(mockTools);

      expect(result).toHaveLength(2); // tool1 (no namespace) and tool2 (allowed namespace)
      expect(result.map(t => t.name)).toContain('tool1');
      expect(result.map(t => t.name)).toContain('tool2');
      expect(result.map(t => t.name)).not.toContain('tool3');
    });

    it('should filter by tool blacklist', () => {
      const config = {
        ...validConfig,
        filtering: {
          toolBlacklist: ['blacklisted-tool'],
        },
      };
      agent = new TestAgent(config);

      const result = agent.testFilterTools(mockTools);

      expect(result).toHaveLength(3);
      expect(result.map(t => t.name)).not.toContain('blacklisted-tool');
    });

    it('should apply custom tool predicate', () => {
      const config = {
        ...validConfig,
        filtering: {
          toolPredicate: (tool: StructuredTool) => tool.name !== 'tool1',
        },
      };
      agent = new TestAgent(config);

      const result = agent.testFilterTools(mockTools);

      expect(result).toHaveLength(3);
      expect(result.map(t => t.name)).not.toContain('tool1');
    });

    it('should apply multiple filters in sequence', () => {
      const config = {
        ...validConfig,
        filtering: {
          namespaceWhitelist: ['allowed'],
          toolBlacklist: ['tool2'],
        },
      };
      agent = new TestAgent(config);

      const result = agent.testFilterTools(mockTools);

      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('tool1');
    });

    it('should handle empty filter arrays', () => {
      const config = {
        ...validConfig,
        filtering: {
          namespaceWhitelist: [],
          toolBlacklist: [],
        },
      };
      agent = new TestAgent(config);

      const result = agent.testFilterTools(mockTools);

      expect(result).toHaveLength(4);
    });
  });

  describe('buildSystemPrompt', () => {
    let agent: TestAgent;

    beforeEach(() => {
      agent = new TestAgent(validConfig);
    });

    it('should build basic system prompt', () => {
      const prompt = agent.testBuildSystemPrompt();

      expect(prompt).toContain('You are a helpful Hedera assistant');
      expect(prompt).toContain('Your primary operator account is 0.0.123');
      expect(prompt).toContain('METADATA QUALITY PRINCIPLES');
    });

    it('should include system preamble when configured', () => {
      const config = {
        ...validConfig,
        messaging: {
          systemPreamble: 'Custom preamble message',
        },
      };
      agent = new TestAgent(config);

      const prompt = agent.testBuildSystemPrompt();

      expect(prompt).toContain('Custom preamble message');
    });

    it('should include system postamble when configured', () => {
      const config = {
        ...validConfig,
        messaging: {
          systemPostamble: 'Custom postamble message',
        },
      };
      agent = new TestAgent(config);

      const prompt = agent.testBuildSystemPrompt();

      expect(prompt).toContain('Custom postamble message');
    });

    it('should include user account information', () => {
      const config = {
        ...validConfig,
        execution: {
          ...validConfig.execution,
          userAccountId: '0.0.456',
        },
      };
      agent = new TestAgent(config);

      const prompt = agent.testBuildSystemPrompt();

      expect(prompt).toContain('personal Hedera account ID: 0.0.456');
      expect(prompt).toContain('you MUST use 0.0.456 as the sender/from account');
    });

    it('should build autonomous mode prompt', () => {
      const config = {
        ...validConfig,
        execution: {
          mode: 'direct',
          operationalMode: 'autonomous',
        },
      };
      agent = new TestAgent(config);

      const prompt = agent.testBuildSystemPrompt();

      expect(prompt).toContain("OPERATIONAL MODE: 'autonomous'");
      expect(prompt).toContain('execute transactions directly');
    });

    it('should build returnBytes mode prompt', () => {
      const config = {
        ...validConfig,
        execution: {
          mode: 'bytes',
          operationalMode: 'returnBytes',
        },
      };
      agent = new TestAgent(config);

      const prompt = agent.testBuildSystemPrompt();

      expect(prompt).toContain("OPERATIONAL MODE: 'returnBytes'");
      expect(prompt).toContain('provide transaction bytes');
    });

    it('should build scheduled transactions prompt', () => {
      const config = {
        ...validConfig,
        execution: {
          mode: 'bytes',
          operationalMode: 'returnBytes',
          userAccountId: '0.0.456',
          scheduleUserTransactionsInBytesMode: true,
        },
      };
      agent = new TestAgent(config);

      const prompt = agent.testBuildSystemPrompt();

      expect(prompt).toContain("'returnBytes' with scheduled transactions");
      expect(prompt).toContain("metaOption 'schedule: true'");
      expect(prompt).toContain('ScheduleId and details');
    });

    it('should include concise mode instruction by default', () => {
      const prompt = agent.testBuildSystemPrompt();

      expect(prompt).toContain('Always be concise');
    });

    it('should exclude concise mode when disabled', () => {
      const config = {
        ...validConfig,
        messaging: {
          conciseMode: false,
        },
      };
      agent = new TestAgent(config);

      const prompt = agent.testBuildSystemPrompt();

      expect(prompt).not.toContain('Always be concise');
    });

    it('should handle default operational mode', () => {
      const config = {
        ...validConfig,
        execution: {
          mode: 'direct',
          // operationalMode not specified, should default to 'returnBytes'
        },
      };
      agent = new TestAgent(config);

      const prompt = agent.testBuildSystemPrompt();

      expect(prompt).toContain("OPERATIONAL MODE: 'returnBytes'");
    });

    it('should handle missing execution config', () => {
      const config = {
        ...validConfig,
        execution: undefined,
      };
      agent = new TestAgent(config);

      const prompt = agent.testBuildSystemPrompt();

      expect(prompt).toContain("OPERATIONAL MODE: 'returnBytes'");
    });
  });

  describe('Abstract Methods Implementation', () => {
    let agent: TestAgent;

    beforeEach(() => {
      agent = new TestAgent(validConfig);
    });

    it('should implement boot method', async () => {
      await agent.boot();

      expect(agent.isReady()).toBe(true);
    });

    it('should implement chat method', async () => {
      const result = await agent.chat('Hello');

      expect(result).toEqual({ output: 'Response to: Hello' });
    });

    it('should implement processFormSubmission method', async () => {
      const submission: FormSubmission = {
        formId: 'test-form',
        toolName: 'test-tool',
      };

      const result = await agent.processFormSubmission(submission);

      expect(result).toEqual({ output: 'Form processed: test-form' });
    });

    it('should implement shutdown method', async () => {
      await agent.boot();
      await agent.shutdown();

      expect(agent.isReady()).toBe(false);
    });

    it('should implement switchMode method', () => {
      expect(() => agent.switchMode('autonomous')).not.toThrow();
    });

    it('should implement getUsageStats method', () => {
      const stats = agent.getUsageStats();

      expect(stats).toEqual({ tokens: 100, cost: { total: 0.01 } });
    });

    it('should implement getUsageLog method', () => {
      const log = agent.getUsageLog();

      expect(log).toEqual([{ tokens: 50, cost: { total: 0.005 } }]);
    });

    it('should implement clearUsageStats method', () => {
      expect(() => agent.clearUsageStats()).not.toThrow();
    });

    it('should implement connectMCPServers method', async () => {
      await expect(agent.connectMCPServers()).resolves.not.toThrow();
    });

    it('should implement getMCPConnectionStatus method', () => {
      const status = agent.getMCPConnectionStatus();

      expect(status).toBeInstanceOf(Map);
      expect(status.get('test-server')).toEqual({ connected: true });
    });
  });

  describe('Configuration Handling', () => {
    it('should handle minimal configuration', () => {
      const minimalConfig: HederaAgentConfiguration = {
        signer: mockSigner,
      };

      const agent = new TestAgent(minimalConfig);

      expect(agent).toBeInstanceOf(BaseAgent);
    });

    it('should handle full configuration', () => {
      const fullConfig: HederaAgentConfiguration = {
        signer: mockSigner,
        execution: {
          mode: 'bytes',
          operationalMode: 'returnBytes',
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

      const agent = new TestAgent(fullConfig);

      expect(agent).toBeInstanceOf(BaseAgent);
    });

    it('should handle undefined debug configuration', () => {
      const config = {
        ...validConfig,
        debug: undefined,
      };

      const agent = new TestAgent(config);

      expect(mockLogger).toHaveBeenCalledWith({
        module: 'BaseAgent',
        silent: false,
      });
    });
  });

  describe('Tool Filtering Edge Cases', () => {
    let agent: TestAgent;

    beforeEach(() => {
      agent = new TestAgent(validConfig);
    });

    it('should handle empty tools array', () => {
      const result = agent.testFilterTools([]);

      expect(result).toEqual([]);
    });

    it('should handle tools with undefined namespace', () => {
      const config = {
        ...validConfig,
        filtering: {
          namespaceWhitelist: ['allowed'],
        },
      };
      agent = new TestAgent(config);

      const tools = [
        { name: 'tool1' } as StructuredTool,
        { name: 'tool2', namespace: undefined } as StructuredTool & { namespace?: string },
      ];

      const result = agent.testFilterTools(tools);

      expect(result).toHaveLength(2); // Both should pass because undefined namespace is allowed
    });

    it('should handle tools with null namespace', () => {
      const config = {
        ...validConfig,
        filtering: {
          namespaceWhitelist: ['allowed'],
        },
      };
      agent = new TestAgent(config);

      const tools = [
        { name: 'tool1', namespace: null } as StructuredTool & { namespace: string | null },
      ];

      const result = agent.testFilterTools(tools);

      expect(result).toHaveLength(1); // null namespace should be treated as allowed
    });
  });
});