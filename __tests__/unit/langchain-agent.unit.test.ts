import { LangChainAgent } from '../../src/langchain/langchain-agent';
import { BaseAgent } from '../../src/base-agent';
import { FormAwareAgentExecutor } from '../../src/langchain/form-aware-agent-executor';
import { MCPClientManager } from '../../src/mcp/mcp-client-manager';
import { SmartMemoryManager } from '../../src/memory/smart-memory-manager';
import { ResponseFormatter } from '../../src/utils/response-formatter';
import { ToolRegistry } from '../../src/core/tool-registry';
import { ExecutionPipeline } from '../../src/execution/execution-pipeline';
import { FormEngine } from '../../src/forms/form-engine';
import { ChatPromptTemplate, MessagesPlaceholder } from '@langchain/core/prompts';
import { ChatOpenAI } from '@langchain/openai';
import { HumanMessage, AIMessage, SystemMessage } from '@langchain/core/messages';
import { createOpenAIToolsAgent } from 'langchain/agents';
import {
  HederaAgentKit,
  TokenUsageCallbackHandler,
  getAllHederaCorePlugins,
  calculateTokenCostSync,
} from 'hedera-agent-kit';
import { convertMCPToolToLangChain } from '../../src/mcp/adapters/langchain';
import type {
  ChatResponse,
  ConversationContext,
  OperationalMode,
  UsageStats,
} from '../../src/base-agent';
import type { FormSubmission } from '../../src/forms/types';
import type { ToolRegistrationOptions } from '../../src/core/tool-registry';
import type { MCPConnectionStatus, MCPServerConfig } from '../../src/mcp/types';

jest.mock('../../src/langchain/form-aware-agent-executor');
jest.mock('../../src/mcp/mcp-client-manager');
jest.mock('../../src/memory/smart-memory-manager');
jest.mock('../../src/utils/response-formatter');
jest.mock('../../src/core/tool-registry');
jest.mock('../../src/execution/execution-pipeline');
jest.mock('../../src/forms/form-engine');
jest.mock('@langchain/core/prompts');
jest.mock('@langchain/openai');
jest.mock('@langchain/core/messages');
jest.mock('langchain/agents');
jest.mock('hedera-agent-kit', () => ({
  HederaAgentKit: jest.fn(),
  TokenUsageCallbackHandler: jest.fn(),
  getAllHederaCorePlugins: jest.fn(),
  calculateTokenCostSync: jest.fn(),
}));
jest.mock('../../src/mcp/adapters/langchain');

const mockCreateOpenAIToolsAgent = createOpenAIToolsAgent as jest.MockedFunction<typeof createOpenAIToolsAgent>;
const mockHederaAgentKit = HederaAgentKit as jest.MockedClass<typeof HederaAgentKit>;
const mockTokenUsageCallbackHandler = TokenUsageCallbackHandler as jest.MockedClass<typeof TokenUsageCallbackHandler>;
const mockGetAllHederaCorePlugins = getAllHederaCorePlugins as jest.MockedFunction<typeof getAllHederaCorePlugins>;
const mockCalculateTokenCostSync = calculateTokenCostSync as jest.MockedFunction<typeof calculateTokenCostSync>;
const mockFormAwareAgentExecutor = FormAwareAgentExecutor as jest.MockedClass<typeof FormAwareAgentExecutor>;
const mockMCPClientManager = MCPClientManager as jest.MockedClass<typeof MCPClientManager>;
const mockSmartMemoryManager = SmartMemoryManager as jest.MockedClass<typeof SmartMemoryManager>;
const mockResponseFormatter = ResponseFormatter as jest.Mocked<typeof ResponseFormatter>;
const mockToolRegistry = ToolRegistry as jest.MockedClass<typeof ToolRegistry>;
const mockExecutionPipeline = ExecutionPipeline as jest.MockedClass<typeof ExecutionPipeline>;
const mockFormEngine = FormEngine as jest.MockedClass<typeof FormEngine>;
const mockChatOpenAI = ChatOpenAI as jest.MockedClass<typeof ChatOpenAI>;
const mockConvertMCPToolToLangChain = convertMCPToolToLangChain as jest.MockedFunction<typeof convertMCPToolToLangChain>;

describe('LangChainAgent', () => {
  let agent: LangChainAgent;
  let mockLogger: any;
  let mockConfig: any;

  beforeEach(() => {
    jest.clearAllMocks();

    mockLogger = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };

    mockConfig = {
      signer: {
        accountId: 'test-account',
        privateKey: 'test-private-key',
        getAccountId: jest.fn().mockReturnValue({
          toString: jest.fn().mockReturnValue('0.0.12345'),
        }),
      },
      ai: {
        apiKey: 'test-api-key',
        modelName: 'gpt-4o-mini',
      },
      execution: {
        operationalMode: 'returnBytes' as OperationalMode,
      },
      debug: {
        verbose: false,
        silent: false,
      },
    };

    mockGetAllHederaCorePlugins.mockReturnValue([]);
    mockHederaAgentKit.mockImplementation(() => ({
      initialize: jest.fn().mockResolvedValue(undefined),
      getAggregatedLangChainTools: jest.fn().mockReturnValue([]),
      operationalMode: 'returnBytes',
    } as any));

    mockToolRegistry.mockImplementation(() => ({
      registerTool: jest.fn(),
      getAllTools: jest.fn().mockReturnValue([]),
      getTool: jest.fn(),
      getToolNames: jest.fn().mockReturnValue([]),
      getStatistics: jest.fn().mockReturnValue({
        totalTools: 0,
        wrappedTools: 0,
        unwrappedTools: 0,
        categoryCounts: {},
        priorityCounts: {},
      }),
      getToolsByCapability: jest.fn().mockReturnValue([]),
      getAllRegistryEntries: jest.fn().mockReturnValue([]),
      clear: jest.fn(),
    } as any));

    mockSmartMemoryManager.mockImplementation(() => ({
      addMessage: jest.fn(),
      getMessages: jest.fn().mockReturnValue([]),
      setSystemPrompt: jest.fn(),
      getMemoryStats: jest.fn().mockReturnValue({
        totalActiveMessages: 0,
        currentTokenCount: 0,
        maxTokens: 90000,
        usagePercentage: 0,
      }),
      dispose: jest.fn(),
    } as any));

    mockFormEngine.mockImplementation(() => ({}) as any);

    mockExecutionPipeline.mockImplementation(() => ({
      execute: jest.fn(),
    } as any));

    mockFormAwareAgentExecutor.mockImplementation(() => ({
      invoke: jest.fn(),
      processFormSubmission: jest.fn(),
      hasPendingForms: jest.fn().mockReturnValue(false),
      getPendingFormsInfo: jest.fn().mockReturnValue([]),
      getPendingForms: jest.fn().mockReturnValue(new Map()),
      restorePendingForms: jest.fn(),
      setParameterPreprocessingCallback: jest.fn(),
    } as any));

    mockTokenUsageCallbackHandler.mockImplementation(() => ({
      getLatestTokenUsage: jest.fn(),
      getTotalTokenUsage: jest.fn().mockReturnValue({
        promptTokens: 0,
        completionTokens: 0,
        totalTokens: 0,
      }),
      getTokenUsageHistory: jest.fn().mockReturnValue([]),
      reset: jest.fn(),
    } as any));

    mockChatOpenAI.mockImplementation(() => ({}) as any);

    mockCreateOpenAIToolsAgent.mockResolvedValue({} as any);

    mockCalculateTokenCostSync.mockReturnValue({ totalCost: 0 } as any);

    mockResponseFormatter.isInscriptionResponse = jest.fn().mockReturnValue(false);
    mockResponseFormatter.formatInscriptionResponse = jest.fn().mockReturnValue('formatted response');

    agent = new LangChainAgent(mockConfig);
    
    // Spy on the actual logger methods
    jest.spyOn(agent['logger'], 'info');
    jest.spyOn(agent['logger'], 'warn');
    jest.spyOn(agent['logger'], 'error');
    jest.spyOn(agent['logger'], 'debug');
  });

  describe('constructor', () => {
    it('should create a LangChainAgent instance', () => {
      expect(agent).toBeInstanceOf(LangChainAgent);
      expect(agent).toBeInstanceOf(BaseAgent);
    });

    it('should initialize with the provided config and logger', () => {
      expect(agent['config']).toBe(mockConfig);
      expect(agent['logger']).toEqual(expect.objectContaining({
        info: expect.any(Function),
        warn: expect.any(Function),
        error: expect.any(Function),
        debug: expect.any(Function),
      }));
    });
  });

  describe('boot', () => {
    it('should initialize the agent successfully', async () => {
      await agent.boot();

      expect(mockHederaAgentKit).toHaveBeenCalledWith(
        mockConfig.signer,
        { plugins: [] },
        'returnBytes',
        undefined,
        false,
        undefined,
        'gpt-4o-mini',
        undefined,
        false
      );
      expect(agent['initialized']).toBe(true);
    });

    it('should not reinitialize if already initialized', async () => {
      agent['initialized'] = true;
      
      await agent.boot();

      expect(mockHederaAgentKit).not.toHaveBeenCalled();
      expect(agent['logger'].warn).toHaveBeenCalledWith('Agent already initialized');
    });

    it('should handle boot errors properly', async () => {
      const error = new Error('Boot failed');
      mockHederaAgentKit.mockImplementation(() => {
        throw error;
      });

      await expect(agent.boot()).rejects.toThrow('Boot failed');
      expect(agent['logger'].error).toHaveBeenCalledWith('Failed to initialize agent:', error);
    });

    it('should detect and throw error on duplicate tool names', async () => {
      const mockTool1 = { name: 'duplicate-tool', description: 'Tool 1' };
      const mockTool2 = { name: 'duplicate-tool', description: 'Tool 2' };
      
      mockHederaAgentKit.mockImplementation(() => ({
        initialize: jest.fn().mockResolvedValue(undefined),
        getAggregatedLangChainTools: jest.fn().mockReturnValue([mockTool1, mockTool2]),
        operationalMode: 'returnBytes',
      } as any));

      mockToolRegistry.mockImplementation(() => ({
        registerTool: jest.fn(),
        getAllTools: jest.fn().mockReturnValue([mockTool1, mockTool2]),
        getToolNames: jest.fn().mockReturnValue(['duplicate-tool', 'duplicate-tool']),
        getStatistics: jest.fn().mockReturnValue({
          totalTools: 2,
          wrappedTools: 0,
          unwrappedTools: 2,
          categoryCounts: {},
          priorityCounts: {},
        }),
        getToolsByCapability: jest.fn().mockReturnValue([]),
        getAllRegistryEntries: jest.fn().mockReturnValue([]),
        clear: jest.fn(),
      } as any));

      await expect(agent.boot()).rejects.toThrow('Duplicate tool names detected: duplicate-tool');
    });

    it('should initialize MCP servers if configured', async () => {
      const mcpConfig = {
        servers: [
          {
            name: 'test-server',
            command: 'test-command',
            args: [],
            autoConnect: true,
          },
        ],
        autoConnect: true,
      };

      agent = new LangChainAgent({ ...mockConfig, mcp: mcpConfig }, mockLogger);

      const mockConnectionStatus = {
        connected: true,
        serverName: 'test-server',
        tools: [],
        error: undefined,
      };

      mockMCPClientManager.mockImplementation(() => ({
        connectServer: jest.fn().mockResolvedValue(mockConnectionStatus),
        disconnectAll: jest.fn(),
      } as any));

      await agent.boot();

      expect(mockMCPClientManager).toHaveBeenCalled();
    });
  });

  describe('chat', () => {
    beforeEach(async () => {
      await agent.boot();
    });

    it('should throw error if not initialized', async () => {
      agent['initialized'] = false;

      await expect(agent.chat('test message')).rejects.toThrow(
        'Agent not initialized. Call boot() first.'
      );
    });

    it('should handle basic chat messages', async () => {
      const mockResult = {
        output: 'Test response',
        intermediateSteps: [],
      };

      const mockExecutor = agent['executor'] as jest.Mocked<FormAwareAgentExecutor>;
      mockExecutor.invoke.mockResolvedValue(mockResult);

      const response = await agent.chat('test message');

      expect(response.output).toBe('Test response');
      expect(response.message).toBe('Test response');
      
      const smartMemoryInstance = agent['smartMemory'] as jest.Mocked<SmartMemoryManager>;
      expect(smartMemoryInstance.addMessage).toHaveBeenCalledWith(
        expect.any(HumanMessage)
      );
    });

    it('should handle TOOL_EXECUTION format messages', async () => {
      const toolExecutionMessage = JSON.stringify({
        type: 'TOOL_EXECUTION',
        formId: 'test-form-id',
        toolName: 'test-tool',
        parameters: { param1: 'value1' },
      });

      const mockTool = {
        name: 'test-tool',
        call: jest.fn().mockResolvedValue('tool result'),
      };

      const mockToolRegistry = agent['toolRegistry'] as jest.Mocked<ToolRegistry>;
      mockToolRegistry.getTool.mockReturnValue({
        tool: mockTool,
        wrapper: false,
      });

      const response = await agent.chat(toolExecutionMessage);

      expect(response.output).toBe('tool result');
    });

    it('should handle direct tool execution commands', async () => {
      const directToolMessage = `Please execute the following tool:
Tool: test-tool
Arguments: {"param1": "value1"}`;

      const mockTool = {
        name: 'test-tool',
        call: jest.fn().mockResolvedValue('direct tool result'),
      };

      const mockToolRegistry = agent['toolRegistry'] as jest.Mocked<ToolRegistry>;
      mockToolRegistry.getTool.mockReturnValue({
        tool: mockTool,
        wrapper: false,
      });

      const response = await agent.chat(directToolMessage);

      expect(response.output).toBe('direct tool result');
    });

    it('should handle JSON format tool calls', async () => {
      const jsonToolCall = JSON.stringify({
        toolName: 'test-tool',
        parameters: { param1: 'value1' },
      });

      const mockTool = {
        name: 'test-tool',
        call: jest.fn().mockResolvedValue('json tool result'),
      };

      const mockToolRegistry = agent['toolRegistry'] as jest.Mocked<ToolRegistry>;
      mockToolRegistry.getTool.mockReturnValue({
        tool: mockTool,
        wrapper: false,
      });

      const response = await agent.chat(jsonToolCall);

      expect(response.output).toBe('json tool result');
    });

    it('should handle content-ref messages', async () => {
      const contentRefMessage = 'content-ref:test-content-id';

      const mockInscriptionTool = {
        name: 'inscription-tool',
        description: 'inscribe content',
        call: jest.fn().mockResolvedValue(JSON.stringify({
          requiresForm: true,
          formMessage: { id: 'test-form' },
          message: 'Please complete the form',
        })),
      };

      const mockToolRegistry = agent['toolRegistry'] as jest.Mocked<ToolRegistry>;
      mockToolRegistry.getToolsByCapability.mockReturnValue([
        { tool: mockInscriptionTool, wrapper: false },
      ]);

      const response = await agent.chat(contentRefMessage);

      expect(response.output).toBe('Please complete the form');
      expect(response.requiresForm).toBe(true);
    });

    it('should load context messages properly', async () => {
      const context: ConversationContext = {
        messages: [
          new HumanMessage('previous message'),
          new AIMessage('previous response'),
        ],
      };

      const mockResult = {
        output: 'Context-aware response',
        intermediateSteps: [],
      };

      const mockExecutor = agent['executor'] as jest.Mocked<FormAwareAgentExecutor>;
      mockExecutor.invoke.mockResolvedValue(mockResult);

      const mockMemory = agent['smartMemory'] as jest.Mocked<SmartMemoryManager>;
      mockMemory.getMessages.mockReturnValue([]);

      await agent.chat('test message', context);

      expect(mockMemory.addMessage).toHaveBeenCalledWith(
        expect.any(HumanMessage)
      );
    });

    it('should handle chat errors properly', async () => {
      const error = new Error('Chat error');
      const mockExecutor = agent['executor'] as jest.Mocked<FormAwareAgentExecutor>;
      mockExecutor.invoke.mockRejectedValue(error);

      const response = await agent.chat('test message');

      expect(response.error).toBe('Chat error');
      expect(agent['logger'].error).toHaveBeenCalledWith('Chat error:', error);
    });
  });

  describe('processFormSubmission', () => {
    beforeEach(async () => {
      await agent.boot();
    });

    it('should throw error if not initialized', async () => {
      agent['initialized'] = false;
      const submission: FormSubmission = {
        formId: 'test-form',
        toolName: 'test-tool',
        parameters: {},
        timestamp: Date.now(),
      };

      await expect(agent.processFormSubmission(submission)).rejects.toThrow(
        'Agent not initialized. Call boot() first.'
      );
    });

    it('should process valid form submission', async () => {
      const submission: FormSubmission = {
        formId: 'test-form',
        toolName: 'test-tool',
        parameters: { param1: 'value1' },
        timestamp: Date.now(),
      };

      const mockResult = {
        output: 'Form processed',
        metadata: { test: 'metadata' },
        intermediateSteps: [],
      };

      const mockExecutor = agent['executor'] as jest.Mocked<FormAwareAgentExecutor>;
      mockExecutor.processFormSubmission.mockResolvedValue(mockResult);

      const response = await agent.processFormSubmission(submission);

      expect(response.output).toBe('Form processed');
      expect(response.metadata).toEqual(expect.objectContaining({ test: 'metadata' }));
    });

    it('should handle invalid form submission parameters', async () => {
      const submission: FormSubmission = {
        formId: 'test-form',
        toolName: 'test-tool',
        parameters: null as any,
        timestamp: Date.now(),
      };

      const response = await agent.processFormSubmission(submission);

      expect(response.error).toContain('Invalid form submission parameters');
    });
  });

  describe('shutdown', () => {
    beforeEach(async () => {
      await agent.boot();
    });

    it('should cleanup resources properly', async () => {
      await agent.shutdown();

      expect(agent['initialized']).toBe(false);
      expect(agent['executor']).toBeUndefined();
      expect(agent['agentKit']).toBeUndefined();
      expect(agent['tools']).toEqual([]);
      expect(agent['logger'].info).toHaveBeenCalledWith('Agent cleaned up');
    });

    it('should disconnect MCP clients if present', async () => {
      const mockMCPManager = {
        disconnectAll: jest.fn().mockResolvedValue(undefined),
      } as any;
      agent['mcpManager'] = mockMCPManager;

      await agent.shutdown();

      expect(mockMCPManager.disconnectAll).toHaveBeenCalled();
    });
  });

  describe('switchMode', () => {
    beforeEach(async () => {
      await agent.boot();
    });

    it('should switch operational mode successfully', () => {
      const newMode: OperationalMode = 'submitTransactions';
      
      agent.switchMode(newMode);

      expect(agent['config'].execution?.operationalMode).toBe(newMode);
      expect(agent['logger'].info).toHaveBeenCalledWith(`Operational mode switched to: ${newMode}`);
    });

    it('should create execution config if not present', () => {
      delete agent['config'].execution;
      const newMode: OperationalMode = 'submitTransactions';
      
      agent.switchMode(newMode);

      expect(agent['config'].execution?.operationalMode).toBe(newMode);
    });
  });

  describe('getUsageStats', () => {
    it('should return zero stats if no token tracker', () => {
      agent['tokenTracker'] = undefined;

      const stats = agent.getUsageStats();

      expect(stats).toEqual({
        promptTokens: 0,
        completionTokens: 0,
        totalTokens: 0,
        cost: { totalCost: 0 },
      });
    });

    it('should return usage stats from token tracker', async () => {
      await agent.boot();

      const mockUsage = {
        promptTokens: 100,
        completionTokens: 50,
        totalTokens: 150,
      };

      const mockTokenTracker = agent['tokenTracker'] as jest.Mocked<TokenUsageCallbackHandler>;
      mockTokenTracker.getTotalTokenUsage.mockReturnValue(mockUsage);

      const stats = agent.getUsageStats();

      expect(stats).toEqual({
        ...mockUsage,
        cost: { totalCost: 0 },
      });
    });
  });

  describe('getUsageLog', () => {
    it('should return empty array if no token tracker', () => {
      agent['tokenTracker'] = undefined;

      const log = agent.getUsageLog();

      expect(log).toEqual([]);
    });

    it('should return usage log from token tracker', async () => {
      await agent.boot();

      const mockHistory = [
        { promptTokens: 50, completionTokens: 25, totalTokens: 75 },
        { promptTokens: 100, completionTokens: 50, totalTokens: 150 },
      ];

      const mockTokenTracker = agent['tokenTracker'] as jest.Mocked<TokenUsageCallbackHandler>;
      mockTokenTracker.getTokenUsageHistory.mockReturnValue(mockHistory);

      const log = agent.getUsageLog();

      expect(log).toHaveLength(2);
      expect(log[0]).toEqual({
        ...mockHistory[0],
        cost: { totalCost: 0 },
      });
    });
  });

  describe('clearUsageStats', () => {
    it('should clear stats if token tracker exists', async () => {
      await agent.boot();

      agent.clearUsageStats();

      const mockTokenTracker = agent['tokenTracker'] as jest.Mocked<TokenUsageCallbackHandler>;
      expect(mockTokenTracker.reset).toHaveBeenCalled();
      expect(agent['logger'].info).toHaveBeenCalledWith('Usage statistics cleared');
    });

    it('should handle missing token tracker gracefully', () => {
      agent['tokenTracker'] = undefined;

      agent.clearUsageStats();

      expect(mockLogger.info).not.toHaveBeenCalledWith('Usage statistics cleared');
    });
  });

  describe('hasPendingForms', () => {
    it('should return false if no executor', () => {
      agent['executor'] = undefined;

      expect(agent.hasPendingForms()).toBe(false);
    });

    it('should return executor pending forms status', async () => {
      await agent.boot();

      const mockExecutor = agent['executor'] as jest.Mocked<FormAwareAgentExecutor>;
      mockExecutor.hasPendingForms.mockReturnValue(true);

      expect(agent.hasPendingForms()).toBe(true);
    });
  });

  describe('getPendingFormsInfo', () => {
    it('should return empty array if no executor', () => {
      agent['executor'] = undefined;

      expect(agent.getPendingFormsInfo()).toEqual([]);
    });

    it('should return executor pending forms info', async () => {
      await agent.boot();

      const mockInfo = [{ formId: 'test-form', toolName: 'test-tool' }];
      const mockExecutor = agent['executor'] as jest.Mocked<FormAwareAgentExecutor>;
      mockExecutor.getPendingFormsInfo.mockReturnValue(mockInfo);

      expect(agent.getPendingFormsInfo()).toEqual(mockInfo);
    });
  });

  describe('getMCPConnectionStatus', () => {
    it('should return copy of MCP connection status', () => {
      const mockStatus = new Map<string, MCPConnectionStatus>();
      mockStatus.set('test-server', {
        connected: true,
        serverName: 'test-server',
        tools: [],
      });

      agent['mcpConnectionStatus'] = mockStatus;

      const result = agent.getMCPConnectionStatus();

      expect(result).toEqual(mockStatus);
      expect(result).not.toBe(mockStatus);
    });
  });

  describe('connectMCPServers', () => {
    it('should return early if no MCP servers configured', async () => {
      await agent.connectMCPServers();

      expect(mockMCPClientManager).not.toHaveBeenCalled();
    });

    it('should initiate background connections for configured servers', async () => {
      const mcpConfig = {
        servers: [
          { name: 'server1', command: 'cmd1', args: [] },
          { name: 'server2', command: 'cmd2', args: [] },
        ],
      };

      agent['config'].mcp = mcpConfig;

      await agent.connectMCPServers();

      expect(agent['logger'].info).toHaveBeenCalledWith(
        'Starting background MCP server connections for 2 servers...'
      );
      expect(agent['logger'].info).toHaveBeenCalledWith('MCP server connections initiated in background');
    });
  });

  describe('setParameterPreprocessingCallback', () => {
    it('should set callback if executor exists', async () => {
      await agent.boot();

      const callback = jest.fn();
      agent.setParameterPreprocessingCallback(callback);

      const mockExecutor = agent['executor'] as jest.Mocked<FormAwareAgentExecutor>;
      expect(mockExecutor.setParameterPreprocessingCallback).toHaveBeenCalledWith(callback);
    });

    it('should warn if executor not initialized', () => {
      const callback = jest.fn();
      agent.setParameterPreprocessingCallback(callback);

      expect(agent['logger'].warn).toHaveBeenCalledWith(
        'Cannot set parameter preprocessing callback: executor not initialized'
      );
    });
  });

  describe('private helper methods', () => {
    beforeEach(async () => {
      await agent.boot();
    });

    describe('isJSON', () => {
      it('should return true for valid JSON strings', () => {
        const validJsonObject = '{"key": "value"}';
        const validJsonArray = '[1, 2, 3]';

        expect(agent['isJSON'](validJsonObject)).toBe(true);
        expect(agent['isJSON'](validJsonArray)).toBe(true);
      });

      it('should return false for invalid JSON strings', () => {
        const invalidJson = 'not json';
        const emptyString = '';
        const nonString = 123;

        expect(agent['isJSON'](invalidJson)).toBe(false);
        expect(agent['isJSON'](emptyString)).toBe(false);
        expect(agent['isJSON'](nonString as any)).toBe(false);
      });
    });

    describe('getInscriptionTool', () => {
      it('should find inscription tool by capability first', () => {
        const inscriptionTool = {
          name: 'inscription-tool',
          description: 'inscribe content',
        };

        const mockToolRegistry = agent['toolRegistry'] as jest.Mocked<ToolRegistry>;
        mockToolRegistry.getToolsByCapability.mockReturnValue([
          { tool: inscriptionTool, wrapper: false },
        ]);

        const result = agent['getInscriptionTool']();

        expect(result).toBe(inscriptionTool);
      });

      it('should return null if no inscription tool found', () => {
        const mockToolRegistry = agent['toolRegistry'] as jest.Mocked<ToolRegistry>;
        mockToolRegistry.getToolsByCapability.mockReturnValue([]);
        mockToolRegistry.getAllRegistryEntries.mockReturnValue([]);

        const result = agent['getInscriptionTool']();

        expect(result).toBeNull();
      });
    });

    describe('processHashLinkBlocks', () => {
      it('should process valid hashLink blocks', () => {
        const validBlock = {
          hashLinkBlock: {
            blockId: 'test-block-id',
            hashLink: 'test-hash-link',
            template: 'test-template',
            attributes: { key: 'value' },
          },
        };

        const result = agent['processHashLinkBlocks'](validBlock);

        expect(result.hashLinkBlock).toEqual(validBlock.hashLinkBlock);
      });

      it('should return empty object for invalid blocks', () => {
        const invalidBlock = { invalidData: true };

        const result = agent['processHashLinkBlocks'](invalidBlock);

        expect(result).toEqual({});
      });
    });

    describe('executeToolDirect', () => {
      it('should execute tool directly without pipeline', async () => {
        const toolName = 'test-tool';
        const parameters = { param1: 'value1' };
        const expectedOutput = 'tool output';

        const mockTool = {
          call: jest.fn().mockResolvedValue(expectedOutput),
        };

        const mockToolRegistry = agent['toolRegistry'] as jest.Mocked<ToolRegistry>;
        mockToolRegistry.getTool.mockReturnValue({
          tool: mockTool,
          wrapper: false,
        });

        const result = await agent['executeToolDirect'](toolName, parameters, false);

        expect(result).toBe(expectedOutput);
        expect(mockTool.call).toHaveBeenCalledWith({
          ...parameters,
          renderForm: false,
        });
      });

      it('should throw error if tool not found', async () => {
        const toolName = 'nonexistent-tool';
        const parameters = {};

        const mockToolRegistry = agent['toolRegistry'] as jest.Mocked<ToolRegistry>;
        mockToolRegistry.getTool.mockReturnValue(undefined);

        await expect(
          agent['executeToolDirect'](toolName, parameters, false)
        ).rejects.toThrow(`Tool not found: ${toolName}`);
      });
    });

    describe('createToolResponse', () => {
      it('should create standardized tool response', () => {
        const toolOutput = 'test output';

        const result = agent['createToolResponse'](toolOutput);

        expect(result).toEqual({
          output: toolOutput,
          message: toolOutput,
          notes: [],
        });
      });
    });

    describe('error handling', () => {
      it('should handle 429 rate limit errors', () => {
        const error = new Error('429 Too Many Requests');

        const response = agent['handleError'](error);

        expect(response.error).toBe('429 Too Many Requests');
        expect(response.output).toContain('receiving too many requests');
      });

      it('should handle 401 authentication errors', () => {
        const error = new Error('401 Unauthorized');

        const response = agent['handleError'](error);

        expect(response.output).toContain('authentication');
      });

      it('should handle timeout errors', () => {
        const error = new Error('Request timeout');

        const response = agent['handleError'](error);

        expect(response.output).toContain('took too long to process');
      });

      it('should handle network errors', () => {
        const error = new Error('Network error');

        const response = agent['handleError'](error);

        expect(response.output).toContain('Network error');
      });
    });
  });
});