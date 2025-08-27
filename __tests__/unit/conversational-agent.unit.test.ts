import { ConversationalAgent, type ConversationalAgentOptions } from '../../src/conversational-agent';
import { ServerSigner, getAllHederaCorePlugins, BasePlugin } from 'hedera-agent-kit';
import { Logger } from '@hashgraphonline/standards-sdk';
import { createAgent } from '../../src/agent-factory';
import { LangChainProvider } from '../../src/providers';
import { ChatOpenAI } from '@langchain/openai';
import { ChatAnthropic } from '@langchain/anthropic';
import { HCS10Plugin } from '../../src/plugins/hcs-10/HCS10Plugin';
import { HCS2Plugin } from '../../src/plugins/hcs-2/HCS2Plugin';
import { InscribePlugin } from '../../src/plugins/inscribe/InscribePlugin';
import { HbarPlugin } from '../../src/plugins/hbar/HbarPlugin';
import { OpenConvaiState } from '@hashgraphonline/standards-agent-kit';
import { getSystemMessage } from '../../src/config/system-message';
import { ContentStoreManager } from '../../src/services/content-store-manager';
import { SmartMemoryManager } from '../../src/memory';
import { createEntityTools } from '../../src/tools/entity-resolver-tool';
import type { ChatResponse, ConversationContext } from '../../src/base-agent';
import type { FormSubmission } from '../../src/forms/types';

jest.mock('hedera-agent-kit', () => ({
  ServerSigner: jest.fn(),
  getAllHederaCorePlugins: jest.fn(),
  BasePlugin: jest.fn(),
}));
jest.mock('@hashgraphonline/standards-sdk');
jest.mock('../../src/agent-factory');
jest.mock('../../src/providers');
jest.mock('@langchain/openai');
jest.mock('@langchain/anthropic');
jest.mock('../../src/plugins/hcs-10/HCS10Plugin');
jest.mock('../../src/plugins/hcs-2/HCS2Plugin');
jest.mock('../../src/plugins/inscribe/InscribePlugin');
jest.mock('../../src/plugins/hbar/HbarPlugin');
jest.mock('@hashgraphonline/standards-agent-kit');
jest.mock('../../src/config/system-message');
jest.mock('../../src/services/content-store-manager');
jest.mock('../../src/memory');
jest.mock('../../src/tools/entity-resolver-tool');

const mockServerSigner = ServerSigner as jest.MockedClass<typeof ServerSigner>;
const mockGetAllHederaCorePlugins = getAllHederaCorePlugins as jest.MockedFunction<typeof getAllHederaCorePlugins>;
const mockLogger = Logger as jest.MockedClass<typeof Logger>;
const mockCreateAgent = createAgent as jest.MockedFunction<typeof createAgent>;
const mockChatOpenAI = ChatOpenAI as jest.MockedClass<typeof ChatOpenAI>;
const mockChatAnthropic = ChatAnthropic as jest.MockedClass<typeof ChatAnthropic>;
const mockHCS10Plugin = HCS10Plugin as jest.MockedClass<typeof HCS10Plugin>;
const mockHCS2Plugin = HCS2Plugin as jest.MockedClass<typeof HCS2Plugin>;
const mockInscribePlugin = InscribePlugin as jest.MockedClass<typeof InscribePlugin>;
const mockHbarPlugin = HbarPlugin as jest.MockedClass<typeof HbarPlugin>;
const mockOpenConvaiState = OpenConvaiState as jest.MockedClass<typeof OpenConvaiState>;
const mockGetSystemMessage = getSystemMessage as jest.MockedFunction<typeof getSystemMessage>;
const mockContentStoreManager = ContentStoreManager as jest.MockedClass<typeof ContentStoreManager>;
const mockSmartMemoryManager = SmartMemoryManager as jest.MockedClass<typeof SmartMemoryManager>;
const mockCreateEntityTools = createEntityTools as jest.MockedFunction<typeof createEntityTools>;

describe('ConversationalAgent', () => {
  let agent: ConversationalAgent;
  let mockOptions: ConversationalAgentOptions;
  let mockLoggerInstance: any;
  let mockAgentInstance: any;

  beforeEach(() => {
    jest.clearAllMocks();

    mockLoggerInstance = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
    };

    mockLogger.mockImplementation(() => mockLoggerInstance);

    mockAgentInstance = {
      boot: jest.fn().mockResolvedValue(undefined),
      chat: jest.fn(),
      shutdown: jest.fn(),
      switchMode: jest.fn(),
      getUsageStats: jest.fn(),
      clearUsageStats: jest.fn(),
      processFormSubmission: jest.fn(),
      hasPendingForms: jest.fn().mockReturnValue(false),
      getPendingFormsInfo: jest.fn().mockReturnValue([]),
      getMCPConnectionStatus: jest.fn().mockReturnValue(new Map()),
      connectMCPServers: jest.fn(),
      setParameterPreprocessingCallback: jest.fn(),
    };

    mockCreateAgent.mockReturnValue(mockAgentInstance);

    mockOptions = {
      accountId: '0.0.12345',
      privateKey: 'test-private-key',
      network: 'testnet',
      openAIApiKey: 'test-openai-key',
      openAIModelName: 'gpt-4o',
      llmProvider: 'openai',
      verbose: false,
      operationalMode: 'autonomous',
    };

    mockGetAllHederaCorePlugins.mockReturnValue([]);
    mockGetSystemMessage.mockReturnValue('system message');

    const mockContentStoreManagerInstance = {
      initialize: jest.fn().mockResolvedValue(undefined),
      store: jest.fn(),
      get: jest.fn(),
    };
    mockContentStoreManager.mockImplementation(() => mockContentStoreManagerInstance as any);

    const mockSmartMemoryManagerInstance = {
      initialize: jest.fn().mockResolvedValue(undefined),
      store: jest.fn(),
      retrieve: jest.fn(),
    };
    mockSmartMemoryManager.mockImplementation(() => mockSmartMemoryManagerInstance as any);

    const mockEntityTools = {
      resolveEntities: { name: 'resolve-entities' },
      extractEntities: { name: 'extract-entities' },
    };
    mockCreateEntityTools.mockReturnValue(mockEntityTools as any);
  });

  describe('constructor', () => {
    it('should create ConversationalAgent instance', () => {
      agent = new ConversationalAgent(mockOptions);

      expect(agent).toBeInstanceOf(ConversationalAgent);
      expect(mockLogger).toHaveBeenCalledWith({
        module: 'ConversationalAgent',
        silent: false,
      });
    });

    it('should initialize plugins', () => {
      agent = new ConversationalAgent(mockOptions);

      expect(mockHCS10Plugin).toHaveBeenCalled();
      expect(mockHCS2Plugin).toHaveBeenCalled();
      expect(mockInscribePlugin).toHaveBeenCalled();
      expect(mockHbarPlugin).toHaveBeenCalled();
    });

    it('should use provided state manager', () => {
      const customStateManager = {} as any;
      const options = { ...mockOptions, stateManager: customStateManager };

      agent = new ConversationalAgent(options);

      expect(agent.stateManager).toBe(customStateManager);
    });

    it('should create default state manager if none provided', () => {
      agent = new ConversationalAgent(mockOptions);

      expect(mockOpenConvaiState).toHaveBeenCalled();
      expect(agent.stateManager).toBeInstanceOf(mockOpenConvaiState);
    });

    it('should initialize entity memory when enabled', () => {
      agent = new ConversationalAgent({ ...mockOptions, entityMemoryEnabled: true });

      expect(mockSmartMemoryManager).toHaveBeenCalledWith(undefined);
      expect(mockCreateEntityTools).toHaveBeenCalledWith('test-openai-key', 'gpt-4o-mini');
      expect(mockLoggerInstance.info).toHaveBeenCalledWith('Entity memory initialized');
    });

    it('should disable entity memory when explicitly disabled', () => {
      agent = new ConversationalAgent({ ...mockOptions, entityMemoryEnabled: false });

      expect(mockSmartMemoryManager).not.toHaveBeenCalled();
      expect(mockCreateEntityTools).not.toHaveBeenCalled();
    });

    it('should throw error if OpenAI key missing when entity memory enabled', () => {
      expect(() => {
        new ConversationalAgent({
          ...mockOptions,
          openAIApiKey: '',
          entityMemoryEnabled: true,
        });
      }).toThrow('OpenAI API key is required when entity memory is enabled');
    });

    it('should configure logging based on options', () => {
      agent = new ConversationalAgent({ ...mockOptions, disableLogging: true });

      expect(mockLogger).toHaveBeenCalledWith({
        module: 'ConversationalAgent',
        silent: true,
      });
    });
  });

  describe('initialize', () => {
    beforeEach(() => {
      agent = new ConversationalAgent(mockOptions);
    });

    it('should initialize successfully with valid options', async () => {
      await agent.initialize();

      expect(mockServerSigner).toHaveBeenCalledWith('0.0.12345', 'test-private-key', 'testnet');
      expect(mockChatOpenAI).toHaveBeenCalledWith({
        apiKey: 'test-openai-key',
        modelName: 'gpt-4o',
        temperature: 0.1,
      });
      expect(mockCreateAgent).toHaveBeenCalled();
      expect(mockAgentInstance.boot).toHaveBeenCalled();
    });

    it('should initialize with Anthropic LLM when specified', async () => {
      agent = new ConversationalAgent({
        ...mockOptions,
        llmProvider: 'anthropic',
        openAIModelName: 'claude-3-5-sonnet-20241022',
      });

      await agent.initialize();

      expect(mockChatAnthropic).toHaveBeenCalledWith({
        apiKey: 'test-openai-key',
        modelName: 'claude-3-5-sonnet-20241022',
        temperature: 0.1,
      });
    });

    it('should handle GPT-5 model with different temperature', async () => {
      agent = new ConversationalAgent({
        ...mockOptions,
        openAIModelName: 'gpt-5-turbo',
      });

      await agent.initialize();

      expect(mockChatOpenAI).toHaveBeenCalledWith({
        apiKey: 'test-openai-key',
        modelName: 'gpt-5-turbo',
        temperature: 1,
      });
    });

    it('should validate required options', async () => {
      agent = new ConversationalAgent({
        ...mockOptions,
        accountId: '',
        privateKey: '',
      });

      await expect(agent.initialize()).rejects.toThrow();
    });

    it('should initialize ContentStoreManager', async () => {
      await agent.initialize();

      expect(mockContentStoreManager).toHaveBeenCalled();
      expect(agent.contentStoreManager).toBeDefined();
    });

    it('should configure tool filtering', async () => {
      const toolFilter = jest.fn().mockReturnValue(true);
      agent = new ConversationalAgent({ ...mockOptions, toolFilter });

      await agent.initialize();

      expect(mockLoggerInstance.info).toHaveBeenCalledWith('Creating agent config...');
    });

    it('should handle initialization errors', async () => {
      mockServerSigner.mockImplementation(() => {
        throw new Error('Invalid credentials');
      });

      await expect(agent.initialize()).rejects.toThrow('Invalid credentials');
      expect(mockLoggerInstance.error).toHaveBeenCalledWith(
        'Failed to initialize ConversationalAgent:',
        expect.any(Error)
      );
    });

    it('should connect to MCP servers if configured', async () => {
      agent = new ConversationalAgent({
        ...mockOptions,
        mcpServers: [{ name: 'test-server', command: 'test-cmd', args: [] }],
      });

      const connectMCPSpy = jest.spyOn(agent as any, 'connectMCP').mockImplementation();

      await agent.initialize();

      expect(connectMCPSpy).toHaveBeenCalled();
    });
  });

  describe('chat functionality', () => {
    beforeEach(async () => {
      agent = new ConversationalAgent(mockOptions);
      await agent.initialize();
    });

    it('should handle chat messages', async () => {
      const mockResponse: ChatResponse = {
        output: 'Test response',
        message: 'Test response',
        notes: [],
      };

      mockAgentInstance.chat.mockResolvedValue(mockResponse);

      const response = await agent.chat('Hello');

      expect(mockAgentInstance.chat).toHaveBeenCalledWith('Hello', undefined);
      expect(response).toEqual(mockResponse);
    });

    it('should handle chat with context', async () => {
      const context: ConversationContext = {
        messages: [
          { type: 'human', content: 'Previous message' },
        ],
      };

      const mockResponse: ChatResponse = {
        output: 'Context response',
        message: 'Context response',
        notes: [],
      };

      mockAgentInstance.chat.mockResolvedValue(mockResponse);

      const response = await agent.chat('Hello', context);

      expect(mockAgentInstance.chat).toHaveBeenCalledWith('Hello', context);
      expect(response).toEqual(mockResponse);
    });

    it('should throw error if not initialized', async () => {
      agent = new ConversationalAgent(mockOptions);

      await expect(agent.chat('Hello')).rejects.toThrow(
        'Agent not initialized. Call initialize() first.'
      );
    });
  });

  describe('form handling', () => {
    beforeEach(async () => {
      agent = new ConversationalAgent(mockOptions);
      await agent.initialize();
    });

    it('should process form submissions', async () => {
      const formSubmission: FormSubmission = {
        formId: 'test-form',
        toolName: 'test-tool',
        parameters: { field: 'value' },
        timestamp: Date.now(),
      };

      const mockResponse: ChatResponse = {
        output: 'Form processed',
        message: 'Form processed',
        notes: [],
      };

      mockAgentInstance.processFormSubmission.mockResolvedValue(mockResponse);

      const response = await agent.processFormSubmission(formSubmission);

      expect(mockAgentInstance.processFormSubmission).toHaveBeenCalledWith(formSubmission, undefined);
      expect(response).toEqual(mockResponse);
    });

    it('should check for pending forms', () => {
      mockAgentInstance.hasPendingForms.mockReturnValue(true);

      const hasPending = agent.hasPendingForms();

      expect(mockAgentInstance.hasPendingForms).toHaveBeenCalled();
      expect(hasPending).toBe(true);
    });

    it('should get pending forms info', () => {
      const mockInfo = [{ formId: 'test-form', toolName: 'test-tool' }];
      mockAgentInstance.getPendingFormsInfo.mockReturnValue(mockInfo);

      const info = agent.getPendingFormsInfo();

      expect(mockAgentInstance.getPendingFormsInfo).toHaveBeenCalled();
      expect(info).toEqual(mockInfo);
    });
  });

  describe('plugin management', () => {
    beforeEach(() => {
      agent = new ConversationalAgent(mockOptions);
    });

    it('should return HCS10 plugin', () => {
      const plugin = agent.getPlugin();
      expect(plugin).toBe(agent.hcs10Plugin);
    });

    it('should prepare plugins correctly', () => {
      const corePlugins = [{ name: 'core-plugin' }];
      const additionalPlugins = [{ name: 'additional-plugin' }];
      
      mockGetAllHederaCorePlugins.mockReturnValue(corePlugins as any);
      agent = new ConversationalAgent({ 
        ...mockOptions, 
        additionalPlugins: additionalPlugins as BasePlugin[] 
      });

      const preparedPlugins = agent['preparePlugins']();

      expect(preparedPlugins).toEqual([
        ...corePlugins,
        ...additionalPlugins,
        agent.hcs10Plugin,
        agent.hcs2Plugin,
        agent.inscribePlugin,
        agent.hbarPlugin,
      ]);
    });

    it('should filter plugins by enabled list', () => {
      agent = new ConversationalAgent({ 
        ...mockOptions, 
        enabledPlugins: ['HCS10Plugin'] 
      });

      const preparedPlugins = agent['preparePlugins']();

      expect(preparedPlugins).toContain(agent.hcs10Plugin);
    });
  });

  describe('operational mode management', () => {
    beforeEach(async () => {
      agent = new ConversationalAgent(mockOptions);
      await agent.initialize();
    });

    it('should switch operational mode', async () => {
      await agent.switchMode('returnBytes');

      expect(mockAgentInstance.switchMode).toHaveBeenCalledWith('returnBytes');
    });

    it('should throw error if not initialized when switching mode', async () => {
      agent = new ConversationalAgent(mockOptions);

      await expect(agent.switchMode('returnBytes')).rejects.toThrow(
        'Agent not initialized. Call initialize() first.'
      );
    });
  });

  describe('usage statistics', () => {
    beforeEach(async () => {
      agent = new ConversationalAgent(mockOptions);
      await agent.initialize();
    });

    it('should get usage stats', () => {
      const mockStats = { promptTokens: 100, completionTokens: 50, totalTokens: 150 };
      mockAgentInstance.getUsageStats.mockReturnValue(mockStats);

      const stats = agent.getUsageStats();

      expect(mockAgentInstance.getUsageStats).toHaveBeenCalled();
      expect(stats).toEqual(mockStats);
    });

    it('should clear usage stats', () => {
      agent.clearUsageStats();

      expect(mockAgentInstance.clearUsageStats).toHaveBeenCalled();
    });
  });

  describe('MCP server management', () => {
    beforeEach(async () => {
      agent = new ConversationalAgent(mockOptions);
      await agent.initialize();
    });

    it('should get MCP connection status', () => {
      const mockStatus = new Map([['server1', { connected: true }]]);
      mockAgentInstance.getMCPConnectionStatus.mockReturnValue(mockStatus);

      const status = agent.getMCPConnectionStatus();

      expect(mockAgentInstance.getMCPConnectionStatus).toHaveBeenCalled();
      expect(status).toEqual(mockStatus);
    });

    it('should connect to MCP servers', async () => {
      await agent.connectMCPServers();

      expect(mockAgentInstance.connectMCPServers).toHaveBeenCalled();
    });
  });

  describe('cleanup', () => {
    beforeEach(async () => {
      agent = new ConversationalAgent(mockOptions);
      await agent.initialize();
    });

    it('should shutdown cleanly', async () => {
      await agent.shutdown();

      expect(mockAgentInstance.shutdown).toHaveBeenCalled();
    });

    it('should handle shutdown when not initialized', async () => {
      agent = new ConversationalAgent(mockOptions);

      await expect(agent.shutdown()).rejects.toThrow(
        'Agent not initialized. Call initialize() first.'
      );
    });
  });

  describe('parameter preprocessing', () => {
    beforeEach(async () => {
      agent = new ConversationalAgent(mockOptions);
      await agent.initialize();
    });

    it('should set parameter preprocessing callback', () => {
      const callback = jest.fn();

      agent.setParameterPreprocessingCallback(callback);

      expect(mockAgentInstance.setParameterPreprocessingCallback).toHaveBeenCalledWith(callback);
    });
  });

  describe('validation', () => {
    beforeEach(() => {
      agent = new ConversationalAgent(mockOptions);
    });

    it('should validate options correctly', () => {
      expect(() => {
        agent['validateOptions']('0.0.12345', 'private-key');
      }).not.toThrow();
    });

    it('should throw error for missing account ID', () => {
      expect(() => {
        agent['validateOptions']('', 'private-key');
      }).toThrow();
    });

    it('should throw error for missing private key', () => {
      expect(() => {
        agent['validateOptions']('0.0.12345', '');
      }).toThrow();
    });
  });

  describe('agent configuration', () => {
    beforeEach(() => {
      agent = new ConversationalAgent(mockOptions);
    });

    it('should create agent config with all required properties', () => {
      const mockSigner = {} as any;
      const mockLLM = {} as any;
      const mockPlugins = [] as any[];

      const config = agent['createAgentConfig'](mockSigner, mockLLM, mockPlugins);

      expect(config).toHaveProperty('signer');
      expect(config).toHaveProperty('ai');
      expect(config).toHaveProperty('extensions');
      expect(config).toHaveProperty('execution');
    });

    it('should include custom system message preamble and postamble', () => {
      agent = new ConversationalAgent({
        ...mockOptions,
        customSystemMessagePreamble: 'Custom preamble',
        customSystemMessagePostamble: 'Custom postamble',
      });

      const mockSigner = {} as any;
      const mockLLM = {} as any;
      const mockPlugins = [] as any[];

      const config = agent['createAgentConfig'](mockSigner, mockLLM, mockPlugins);

      expect(config.messaging?.systemPreamble).toBe('Custom preamble');
      expect(config.messaging?.systemPostamble).toBe('Custom postamble');
    });

    it('should configure MCP servers in agent config', () => {
      const mcpServers = [{ name: 'test-server', command: 'test-cmd', args: [] }];
      agent = new ConversationalAgent({
        ...mockOptions,
        mcpServers,
      });

      const mockSigner = {} as any;
      const mockLLM = {} as any;
      const mockPlugins = [] as any[];

      const config = agent['createAgentConfig'](mockSigner, mockLLM, mockPlugins);

      expect(config.mcp?.servers).toEqual(mcpServers);
    });
  });

  describe('error handling', () => {
    it('should handle agent creation errors', async () => {
      mockCreateAgent.mockImplementation(() => {
        throw new Error('Agent creation failed');
      });

      agent = new ConversationalAgent(mockOptions);

      await expect(agent.initialize()).rejects.toThrow('Agent creation failed');
    });

    it('should handle agent boot errors', async () => {
      mockAgentInstance.boot.mockRejectedValue(new Error('Boot failed'));

      agent = new ConversationalAgent(mockOptions);

      await expect(agent.initialize()).rejects.toThrow('Boot failed');
    });

    it('should handle chat errors gracefully', async () => {
      mockAgentInstance.chat.mockRejectedValue(new Error('Chat failed'));

      agent = new ConversationalAgent(mockOptions);
      await agent.initialize();

      await expect(agent.chat('Hello')).rejects.toThrow('Chat failed');
    });
  });
});