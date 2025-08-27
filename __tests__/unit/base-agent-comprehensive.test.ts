import { describe, test, expect, jest, beforeEach } from '@jest/globals';
import type { StructuredTool } from '@langchain/core/tools';
import { BaseAgent, HederaAgentConfiguration, ToolFilterConfig } from '../../src/base-agent';
import { createMockServerSigner } from '../mock-factory';
import { Logger } from '@hashgraphonline/standards-sdk';

jest.mock('@hashgraphonline/standards-sdk', () => ({
  Logger: jest.fn().mockImplementation(() => ({
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  })),
}));

class TestableBaseAgent extends BaseAgent {
  constructor(config: HederaAgentConfiguration) {
    super(config);
  }

  async boot(): Promise<void> {}
  async chat(): Promise<any> {
    return { output: 'test' };
  }
  async processFormSubmission(): Promise<any> {
    return { output: 'test' };
  }
  async shutdown(): Promise<void> {}
  switchMode(): void {}
  getUsageStats(): any {
    return { cost: { totalCost: 0 } };
  }
  getUsageLog(): any[] {
    return [];
  }
  clearUsageStats(): void {}
  async connectMCPServers(): Promise<void> {}
  getMCPConnectionStatus(): Map<string, any> {
    return new Map();
  }

  public testFilterTools(tools: StructuredTool[]) {
    return this.filterTools(tools);
  }

  public testBuildSystemPrompt() {
    return this.buildSystemPrompt();
  }
}

describe('BaseAgent', () => {
  let mockSigner: any;
  let baseConfig: HederaAgentConfiguration;

  beforeEach(() => {
    mockSigner = createMockServerSigner();
    baseConfig = {
      signer: mockSigner,
    };
    jest.clearAllMocks();
  });

  describe('constructor', () => {
    test('should initialize logger with correct module name', () => {
      new TestableBaseAgent(baseConfig);
      
      expect(Logger).toHaveBeenCalledWith({
        module: 'BaseAgent',
        silent: false,
      });
    });

    test('should initialize logger with silent mode when debug.silent is true', () => {
      const config = {
        ...baseConfig,
        debug: { silent: true },
      };
      
      new TestableBaseAgent(config);
      
      expect(Logger).toHaveBeenCalledWith({
        module: 'BaseAgent',
        silent: true,
      });
    });

    test('should initialize with default values', () => {
      const agent = new TestableBaseAgent(baseConfig);
      
      expect(agent.isReady()).toBe(false);
      expect(agent.getCore()).toBeUndefined();
    });
  });

  describe('getCore', () => {
    test('should return undefined when agentKit is not set', () => {
      const agent = new TestableBaseAgent(baseConfig);
      
      expect(agent.getCore()).toBeUndefined();
    });
  });

  describe('isReady', () => {
    test('should return initialized status', () => {
      const agent = new TestableBaseAgent(baseConfig);
      
      expect(agent.isReady()).toBe(false);
    });
  });

  describe('filterTools', () => {
    let agent: TestableBaseAgent;
    let mockTools: StructuredTool[];

    beforeEach(() => {
      agent = new TestableBaseAgent(baseConfig);
      mockTools = [
        { name: 'tool1', namespace: 'ns1' } as StructuredTool & { namespace?: string },
        { name: 'tool2', namespace: 'ns2' } as StructuredTool & { namespace?: string },
        { name: 'tool3' } as StructuredTool,
        { name: 'blacklisted' } as StructuredTool,
      ];
    });

    test('should return all tools when no filter is configured', () => {
      const result = agent.testFilterTools(mockTools);
      
      expect(result).toHaveLength(4);
      expect(result).toEqual(mockTools);
    });

    test('should filter by namespace whitelist', () => {
      const config: HederaAgentConfiguration = {
        ...baseConfig,
        filtering: {
          namespaceWhitelist: ['ns1'],
        },
      };
      agent = new TestableBaseAgent(config);
      
      const result = agent.testFilterTools(mockTools);
      
      // Should include tool1 (ns1), tool3 (no namespace), and blacklisted (no namespace)
      expect(result).toHaveLength(3);
      expect(result.map(t => t.name)).toEqual(['tool1', 'tool3', 'blacklisted']);
    });

    test('should filter by tool blacklist', () => {
      const config: HederaAgentConfiguration = {
        ...baseConfig,
        filtering: {
          toolBlacklist: ['blacklisted', 'tool2'],
        },
      };
      agent = new TestableBaseAgent(config);
      
      const result = agent.testFilterTools(mockTools);
      
      expect(result).toHaveLength(2);
      expect(result.map(t => t.name)).toEqual(['tool1', 'tool3']);
    });

    test('should filter by custom predicate', () => {
      const config: HederaAgentConfiguration = {
        ...baseConfig,
        filtering: {
          toolPredicate: (tool: StructuredTool) => tool.name.includes('1'),
        },
      };
      agent = new TestableBaseAgent(config);
      
      const result = agent.testFilterTools(mockTools);
      
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('tool1');
    });

    test('should apply all filters together', () => {
      const config: HederaAgentConfiguration = {
        ...baseConfig,
        filtering: {
          namespaceWhitelist: ['ns1', 'ns2'],
          toolBlacklist: ['tool2'],
          toolPredicate: (tool: StructuredTool) => !tool.name.includes('blacklisted'),
        },
      };
      agent = new TestableBaseAgent(config);
      
      const result = agent.testFilterTools(mockTools);
      
      // After namespace filter: tool1 (ns1), tool2 (ns2), tool3 (no ns), blacklisted (no ns)
      // After blacklist filter: tool1 (ns1), tool3 (no ns), blacklisted (no ns)
      // After predicate filter: tool1 (ns1), tool3 (no ns)
      expect(result).toHaveLength(2);
      expect(result.map(t => t.name)).toEqual(['tool1', 'tool3']);
    });

    test('should create copy of tools array', () => {
      const result = agent.testFilterTools(mockTools);
      
      expect(result).not.toBe(mockTools);
      expect(result).toEqual(mockTools);
    });
  });

  describe('buildSystemPrompt', () => {
    test('should build basic system prompt', () => {
      const agent = new TestableBaseAgent(baseConfig);
      const prompt = agent.testBuildSystemPrompt();
      
      expect(prompt).toContain('You are a helpful Hedera assistant');
      expect(prompt).toContain('0.0.12345');
      expect(prompt).toContain('METADATA QUALITY PRINCIPLES');
      expect(prompt).toContain("OPERATIONAL MODE: 'returnBytes'");
      expect(prompt).toContain('Always be concise');
    });

    test('should include system preamble when provided', () => {
      const config: HederaAgentConfiguration = {
        ...baseConfig,
        messaging: {
          systemPreamble: 'Custom preamble text',
        },
      };
      const agent = new TestableBaseAgent(config);
      const prompt = agent.testBuildSystemPrompt();
      
      expect(prompt).toContain('Custom preamble text');
    });

    test('should include system postamble when provided', () => {
      const config: HederaAgentConfiguration = {
        ...baseConfig,
        messaging: {
          systemPostamble: 'Custom postamble text',
        },
      };
      const agent = new TestableBaseAgent(config);
      const prompt = agent.testBuildSystemPrompt();
      
      expect(prompt).toContain('Custom postamble text');
    });

    test('should include user account information when provided', () => {
      const config: HederaAgentConfiguration = {
        ...baseConfig,
        execution: {
          userAccountId: '0.0.67890',
        },
      };
      const agent = new TestableBaseAgent(config);
      const prompt = agent.testBuildSystemPrompt();
      
      expect(prompt).toContain('personal Hedera account ID: 0.0.67890');
      expect(prompt).toContain('you must set up a transfer where 0.0.67890 sends');
    });

    test('should use autonomous mode when configured', () => {
      const config: HederaAgentConfiguration = {
        ...baseConfig,
        execution: {
          operationalMode: 'autonomous',
          userAccountId: '0.0.67890',
        },
      };
      const agent = new TestableBaseAgent(config);
      const prompt = agent.testBuildSystemPrompt();
      
      expect(prompt).toContain("OPERATIONAL MODE: 'autonomous'");
      expect(prompt).toContain('execute transactions directly');
      expect(prompt).toContain('Your account 0.0.12345 will be the payer');
    });

    test('should use scheduled transactions mode when configured', () => {
      const config: HederaAgentConfiguration = {
        ...baseConfig,
        execution: {
          operationalMode: 'returnBytes',
          scheduleUserTransactionsInBytesMode: true,
          userAccountId: '0.0.67890',
        },
      };
      const agent = new TestableBaseAgent(config);
      const prompt = agent.testBuildSystemPrompt();
      
      expect(prompt).toContain("'returnBytes' with scheduled transactions");
      expect(prompt).toContain('creating a Scheduled Transaction');
      expect(prompt).toContain('The user (with account ID 0.0.67890)');
      expect(prompt).toContain('ScheduleId and details');
    });

    test('should not include concise mode instruction when disabled', () => {
      const config: HederaAgentConfiguration = {
        ...baseConfig,
        messaging: {
          conciseMode: false,
        },
      };
      const agent = new TestableBaseAgent(config);
      const prompt = agent.testBuildSystemPrompt();
      
      expect(prompt).not.toContain('Always be concise');
    });

    test('should handle missing user account in autonomous mode', () => {
      const config: HederaAgentConfiguration = {
        ...baseConfig,
        execution: {
          operationalMode: 'autonomous',
        },
      };
      const agent = new TestableBaseAgent(config);
      const prompt = agent.testBuildSystemPrompt();
      
      expect(prompt).toContain('a specified account');
    });

    test('should handle missing user account in returnBytes mode', () => {
      const config: HederaAgentConfiguration = {
        ...baseConfig,
        execution: {
          operationalMode: 'returnBytes',
        },
      };
      const agent = new TestableBaseAgent(config);
      const prompt = agent.testBuildSystemPrompt();
      
      expect(prompt).toContain('if specified');
    });
  });
});