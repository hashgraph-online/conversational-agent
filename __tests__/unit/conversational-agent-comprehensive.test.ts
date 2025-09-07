import { ConversationalAgent } from '../../src/conversational-agent';
import { Logger } from '@hashgraphonline/standards-sdk';
import { ServerSigner } from 'hedera-agent-kit';
import { ChatOpenAI } from '@langchain/openai';
import { ChatAnthropic } from '@langchain/anthropic';
import { OpenConvaiState } from '@hashgraphonline/standards-agent-kit';
import { SmartMemoryManager } from '../../src/memory';
import { ContentStoreManager } from '../../src/services/content-store-manager';
import { createAgent } from '../../src/agent-factory';
import { HCS10Plugin } from '../../src/plugins/hcs-10/HCS10Plugin';
import { HCS2Plugin } from '../../src/plugins/hcs-2/HCS2Plugin';
import { InscribePlugin } from '../../src/plugins/inscribe/InscribePlugin';
import { HbarPlugin } from '../../src/plugins/hbar/HbarPlugin';
import type { ConversationalAgentOptions, ChatHistoryItem } from '../../src/conversational-agent';
import type { ChatResponse } from '../../src/base-agent';
import type { FormSubmission } from '../../src/forms/types';
import type { MCPServerConfig } from '../../src/mcp/types';

jest.mock('hedera-agent-kit');
jest.mock('@langchain/openai');
jest.mock('@langchain/anthropic');
jest.mock('@hashgraphonline/standards-agent-kit');
jest.mock('../../src/memory');
jest.mock('../../src/services/content-store-manager');
jest.mock('../../src/agent-factory');
jest.mock('../../src/plugins/hcs-10/HCS10Plugin');
jest.mock('../../src/plugins/hcs-2/HCS2Plugin');
jest.mock('../../src/plugins/inscribe/InscribePlugin');
jest.mock('../../src/plugins/hbar/HbarPlugin');

const mockServerSigner = jest.mocked(ServerSigner);
const mockChatOpenAI = jest.mocked(ChatOpenAI);
const mockChatAnthropic = jest.mocked(ChatAnthropic);
const mockOpenConvaiState = jest.mocked(OpenConvaiState);
const mockSmartMemoryManager = jest.mocked(SmartMemoryManager);
const mockContentStoreManager = jest.mocked(ContentStoreManager);
const mockCreateAgent = jest.mocked(createAgent);
const mockHCS10Plugin = jest.mocked(HCS10Plugin);
const mockHCS2Plugin = jest.mocked(HCS2Plugin);
const mockInscribePlugin = jest.mocked(InscribePlugin);
const mockHbarPlugin = jest.mocked(HbarPlugin);

describe('ConversationalAgent', () => {
  let mockAgent: any;
  let mockStateManager: any;
  let mockMemoryManager: any;
  let mockContentManager: any;
  let validOptions: ConversationalAgentOptions;

  beforeEach(() => {
    jest.clearAllMocks();

    mockAgent = {
      boot: jest.fn().mockResolvedValue(undefined),
      chat: jest.fn().mockResolvedValue({ output: 'test response', transactionId: 'tx123' }),
      processFormSubmission: jest.fn().mockResolvedValue({ output: 'form response' }),
      connectMCPServers: jest.fn().mockResolvedValue(undefined),
      getMCPConnectionStatus: jest.fn().mockReturnValue(new Map([['server1', { connected: true }]])),
    };

    mockStateManager = {
      getState: jest.fn(),
      setState: jest.fn(),
    };

    mockMemoryManager = {
      storeEntityAssociation: jest.fn(),
      dispose: jest.fn(),
    };

    mockContentManager = {
      initialize: jest.fn().mockResolvedValue(undefined),
      dispose: jest.fn().mockResolvedValue(undefined),
    };

    mockCreateAgent.mockReturnValue(mockAgent);
    mockOpenConvaiState.mockImplementation(() => mockStateManager);
    mockSmartMemoryManager.mockImplementation(() => mockMemoryManager);
    mockContentStoreManager.mockImplementation(() => mockContentManager);
    
    mockServerSigner.mockImplementation(() => ({} as any));
    mockChatOpenAI.mockImplementation(() => ({} as any));
    mockChatAnthropic.mockImplementation(() => ({} as any));
    
    mockHCS10Plugin.mockImplementation(() => ({ id: 'hcs-10' } as any));
    mockHCS2Plugin.mockImplementation(() => ({ id: 'hcs-2' } as any));
    mockInscribePlugin.mockImplementation(() => ({ id: 'inscribe' } as any));
    mockHbarPlugin.mockImplementation(() => ({ id: 'hbar' } as any));

    validOptions = {
      accountId: '0.0.123',
      privateKey: 'valid-private-key-1234567890',
      openAIApiKey: 'test-api-key',
      network: 'testnet',
    };

    require('hedera-agent-kit').getAllHederaCorePlugins = jest.fn().mockReturnValue([
      { id: 'core-plugin-1' },
      { id: 'core-plugin-2' },
    ]);
  });

  describe('Constructor', () => {
    it('should create instance with valid options', () => {
      const agent = new ConversationalAgent(validOptions);

      expect(agent).toBeInstanceOf(ConversationalAgent);
      expect(agent.logger).toBeDefined();
      expect(agent.stateManager).toBe(mockStateManager);
      expect(agent.hcs10Plugin).toBeDefined();
      expect(agent.hcs2Plugin).toBeDefined();
      expect(agent.inscribePlugin).toBeDefined();
      expect(agent.hbarPlugin).toBeDefined();
    });

    it('should use custom state manager when provided', () => {
      const customStateManager = { custom: true } as any;
      const options = { ...validOptions, stateManager: customStateManager };

      const agent = new ConversationalAgent(options);

      expect(agent.stateManager).toBe(customStateManager);
    });

    it('should initialize entity memory when enabled', () => {
      const options = { ...validOptions, entityMemoryEnabled: true };

      const agent = new ConversationalAgent(options);

      expect(agent.memoryManager).toBeDefined();
      expect(mockSmartMemoryManager).toHaveBeenCalledWith(undefined);
    });

    it('should not initialize entity memory when disabled', () => {
      const options = { ...validOptions, entityMemoryEnabled: false };

      const agent = new ConversationalAgent(options);

      expect(agent.memoryManager).toBeUndefined();
      expect(mockSmartMemoryManager).not.toHaveBeenCalled();
    });

    it('should throw error when API key missing and entity memory enabled', () => {
      const options = { ...validOptions, openAIApiKey: '', entityMemoryEnabled: true };

      expect(() => new ConversationalAgent(options)).toThrow(
        'OpenAI/Anthropic API key is required when entity memory is enabled'
      );
    });

    it('should use custom entity memory config', () => {
      const memoryConfig = { maxEntities: 100 };
      const options = { 
        ...validOptions, 
        entityMemoryEnabled: true,
        entityMemoryConfig: memoryConfig 
      };

      new ConversationalAgent(options);

      expect(mockSmartMemoryManager).toHaveBeenCalledWith(memoryConfig);
    });

    it('should disable logging when specified', () => {
      const options = { ...validOptions, disableLogging: true };

      const agent = new ConversationalAgent(options);

      expect(Logger).toHaveBeenCalledWith({
        module: 'ConversationalAgent',
        silent: true,
      });
    });
  });

  describe('initialize', () => {
    let agent: ConversationalAgent;

    beforeEach(() => {
      agent = new ConversationalAgent(validOptions);
    });

    it('should initialize successfully with valid options', async () => {
      await agent.initialize();

      expect(mockServerSigner).toHaveBeenCalledWith('0.0.123', 'valid-private-key-1234567890', 'testnet');
      expect(mockChatOpenAI).toHaveBeenCalled();
      expect(mockCreateAgent).toHaveBeenCalled();
      expect(mockAgent.boot).toHaveBeenCalled();
      expect(mockContentManager.initialize).toHaveBeenCalled();
    });

    it('should use Anthropic when specified', async () => {
      const options = { ...validOptions, llmProvider: 'anthropic' as const };
      agent = new ConversationalAgent(options);

      await agent.initialize();

      expect(mockChatAnthropic).toHaveBeenCalledWith({
        apiKey: 'test-api-key',
        model: 'claude-3-7-sonnet-latest',
        temperature: 0,
      });
    });

    it('should use GPT-5 temperature when model contains gpt-5', async () => {
      const options = { ...validOptions, openAIModelName: 'gpt-5-turbo' };
      agent = new ConversationalAgent(options);

      await agent.initialize();

      expect(mockChatOpenAI).toHaveBeenCalledWith({
        apiKey: 'test-api-key',
        model: 'gpt-5-turbo',
        temperature: 1,
      });
    });

    it('should use default temperature for non-GPT-5 models', async () => {
      const options = { ...validOptions, openAIModelName: 'gpt-4o' };
      agent = new ConversationalAgent(options);

      await agent.initialize();

      expect(mockChatOpenAI).toHaveBeenCalledWith({
        apiKey: 'test-api-key',
        model: 'gpt-4o',
        temperature: 0.1,
      });
    });

    it('should connect MCP servers when provided', async () => {
      const mcpServers: MCPServerConfig[] = [{ name: 'test-server', command: 'test', args: [] }];
      const options = { ...validOptions, mcpServers };
      agent = new ConversationalAgent(options);

      await agent.initialize();

      expect(mockAgent.connectMCPServers).toHaveBeenCalled();
    });

    it('should validate required options', async () => {
      const invalidOptions = { ...validOptions, accountId: '' };
      agent = new ConversationalAgent(invalidOptions);

      await expect(agent.initialize()).rejects.toThrow('Account ID is required');
    });

    it('should handle initialization errors', async () => {
      mockServerSigner.mockImplementation(() => {
        throw new Error('Server signer error');
      });

      await expect(agent.initialize()).rejects.toThrow('Server signer error');
    });
  });

  describe('Validation', () => {
    it('should validate account ID type', async () => {
      const options = { ...validOptions, accountId: 123 as any };
      const agent = new ConversationalAgent(options);

      await expect(agent.initialize()).rejects.toThrow('Account ID must be a string');
    });

    it('should validate private key type', async () => {
      const options = { ...validOptions, privateKey: 123 as any };
      const agent = new ConversationalAgent(options);

      await expect(agent.initialize()).rejects.toThrow('Private key must be a string');
    });

    it('should validate private key length', async () => {
      const options = { ...validOptions, privateKey: 'short' };
      const agent = new ConversationalAgent(options);

      await expect(agent.initialize()).rejects.toThrow('Private key appears to be invalid (too short)');
    });
  });

  describe('Plugin Management', () => {
    it('should use enabled plugins when specified', async () => {
      const options = { ...validOptions, enabledPlugins: ['hcs-10', 'core-plugin-1'] };
      const agent = new ConversationalAgent(options);

      await agent.initialize();

      const createAgentCall = mockCreateAgent.mock.calls[0][0];
      expect(createAgentCall.extensions.plugins).toHaveLength(2);
    });

    it('should include additional plugins', async () => {
      const additionalPlugin = { id: 'additional-plugin' };
      const options = { ...validOptions, additionalPlugins: [additionalPlugin as any] };
      const agent = new ConversationalAgent(options);

      await agent.initialize();

      const createAgentCall = mockCreateAgent.mock.calls[0][0];
      expect(createAgentCall.extensions.plugins).toContain(additionalPlugin);
    });
  });

  describe('getPlugin', () => {
    it('should return HCS10 plugin instance', () => {
      const agent = new ConversationalAgent(validOptions);
      const plugin = agent.getPlugin();

      expect(plugin).toBe(agent.hcs10Plugin);
    });
  });

  describe('getStateManager', () => {
    it('should return state manager instance', () => {
      const agent = new ConversationalAgent(validOptions);
      const stateManager = agent.getStateManager();

      expect(stateManager).toBe(mockStateManager);
    });
  });

  describe('getAgent and getConversationalAgent', () => {
    let agent: ConversationalAgent;

    beforeEach(() => {
      agent = new ConversationalAgent(validOptions);
    });

    it('should throw error when not initialized', () => {
      expect(() => agent.getAgent()).toThrow('Agent not initialized. Call initialize() first.');
      expect(() => agent.getConversationalAgent()).toThrow('Agent not initialized. Call initialize() first.');
    });

    it('should return agent when initialized', async () => {
      await agent.initialize();

      expect(agent.getAgent()).toBe(mockAgent);
      expect(agent.getConversationalAgent()).toBe(mockAgent);
    });
  });

  describe('processMessage', () => {
    let agent: ConversationalAgent;

    beforeEach(async () => {
      agent = new ConversationalAgent(validOptions);
      await agent.initialize();
    });

    it('should process message successfully', async () => {
      const result = await agent.processMessage('Hello world');

      expect(mockAgent.chat).toHaveBeenCalledWith('Hello world', { messages: [] });
      expect(result).toEqual({ output: 'test response', transactionId: 'tx123' });
    });

    it('should process message with chat history', async () => {
      const chatHistory: ChatHistoryItem[] = [
        { type: 'human', content: 'Previous question' },
        { type: 'ai', content: 'Previous answer' },
        { type: 'system', content: 'System message' },
      ];

      await agent.processMessage('Hello world', chatHistory);

      const expectedContext = {
        messages: expect.arrayContaining([
          expect.objectContaining({ content: 'Previous question' }),
          expect.objectContaining({ content: 'Previous answer' }),
          expect.objectContaining({ content: 'System message' }),
        ]),
      };
      expect(mockAgent.chat).toHaveBeenCalledWith('Hello world', expectedContext);
    });

    it('should extract and store entities when memory enabled', async () => {
      const options = { ...validOptions, entityMemoryEnabled: true };
      agent = new ConversationalAgent(options);
      await agent.initialize();

      const mockEntityTools = {
        extractEntities: {
          call: jest.fn().mockResolvedValue('[{"name":"test","type":"topic","id":"0.0.123"}]'),
        },
      };
      (agent as any).entityTools = mockEntityTools;

      await agent.processMessage('Create topic test');

      expect(mockEntityTools.extractEntities.call).toHaveBeenCalled();
      expect(mockMemoryManager.storeEntityAssociation).toHaveBeenCalledWith(
        '0.0.123',
        'test',
        'topic',
        'tx123'
      );
    });

    it('should skip entity extraction in returnBytes mode', async () => {
      const options = { ...validOptions, entityMemoryEnabled: true, operationalMode: 'returnBytes' as const };
      agent = new ConversationalAgent(options);
      await agent.initialize();

      const mockEntityTools = {
        extractEntities: { call: jest.fn() },
      };
      (agent as any).entityTools = mockEntityTools;

      await agent.processMessage('Create topic test');

      expect(mockEntityTools.extractEntities.call).not.toHaveBeenCalled();
    });

    it('should handle entity extraction errors gracefully', async () => {
      const options = { ...validOptions, entityMemoryEnabled: true };
      agent = new ConversationalAgent(options);
      await agent.initialize();

      const mockEntityTools = {
        extractEntities: {
          call: jest.fn().mockRejectedValue(new Error('Extraction failed')),
        },
      };
      (agent as any).entityTools = mockEntityTools;

      await expect(agent.processMessage('Create topic test')).rejects.toThrow('Extraction failed');
    });

    it('should handle invalid entity JSON', async () => {
      const options = { ...validOptions, entityMemoryEnabled: true };
      agent = new ConversationalAgent(options);
      await agent.initialize();

      const mockEntityTools = {
        extractEntities: {
          call: jest.fn().mockResolvedValue('invalid json'),
        },
      };
      (agent as any).entityTools = mockEntityTools;

      await expect(agent.processMessage('Create topic test')).rejects.toThrow();
    });

    it('should skip non-Hedera ID entities', async () => {
      const options = { ...validOptions, entityMemoryEnabled: true };
      agent = new ConversationalAgent(options);
      await agent.initialize();

      const mockEntityTools = {
        extractEntities: {
          call: jest.fn().mockResolvedValue('[{"name":"test","type":"topic","id":"invalid-id"}]'),
        },
      };
      (agent as any).entityTools = mockEntityTools;

      await agent.processMessage('Create topic test');

      expect(mockMemoryManager.storeEntityAssociation).not.toHaveBeenCalled();
    });

    it('should throw error when not initialized', async () => {
      const uninitializedAgent = new ConversationalAgent(validOptions);

      await expect(uninitializedAgent.processMessage('Hello')).rejects.toThrow(
        'Agent not initialized. Call initialize() first.'
      );
    });

    it('should handle chat errors', async () => {
      mockAgent.chat.mockRejectedValue(new Error('Chat error'));

      await expect(agent.processMessage('Hello')).rejects.toThrow('Chat error');
    });
  });

  describe('processFormSubmission', () => {
    let agent: ConversationalAgent;

    beforeEach(async () => {
      agent = new ConversationalAgent(validOptions);
      await agent.initialize();
    });

    it('should process form submission successfully', async () => {
      const submission: FormSubmission = {
        formId: 'test-form',
        toolName: 'test-tool',
        parameters: { param1: 'value1' },
      };

      const result = await agent.processFormSubmission(submission);

      expect(mockAgent.processFormSubmission).toHaveBeenCalledWith(submission);
      expect(result).toEqual({ output: 'form response' });
    });

    it('should throw error when not initialized', async () => {
      const uninitializedAgent = new ConversationalAgent(validOptions);
      const submission: FormSubmission = { formId: 'test', toolName: 'test' };

      await expect(uninitializedAgent.processFormSubmission(submission)).rejects.toThrow(
        'Agent not initialized. Call initialize() first.'
      );
    });

    it('should handle form processing errors', async () => {
      mockAgent.processFormSubmission.mockRejectedValue(new Error('Form error'));
      const submission: FormSubmission = { formId: 'test', toolName: 'test' };

      await expect(agent.processFormSubmission(submission)).rejects.toThrow('Form error');
    });
  });

  describe('MCP Connection Methods', () => {
    let agent: ConversationalAgent;

    beforeEach(async () => {
      agent = new ConversationalAgent(validOptions);
      await agent.initialize();
    });

    it('should get MCP connection status', () => {
      const status = agent.getMCPConnectionStatus();

      expect(mockAgent.getMCPConnectionStatus).toHaveBeenCalled();
      expect(status).toBeInstanceOf(Map);
      expect(status.get('server1')).toEqual({ connected: true });
    });

    it('should return empty map when agent not initialized', () => {
      const uninitializedAgent = new ConversationalAgent(validOptions);

      const status = uninitializedAgent.getMCPConnectionStatus();

      expect(status).toBeInstanceOf(Map);
      expect(status.size).toBe(0);
    });

    it('should check if MCP server is connected', () => {
      const isConnected = agent.isMCPServerConnected('server1');

      expect(isConnected).toBe(true);
    });

    it('should return false for non-existent server', () => {
      const isConnected = agent.isMCPServerConnected('non-existent');

      expect(isConnected).toBe(false);
    });

    it('should return false when agent not initialized', () => {
      const uninitializedAgent = new ConversationalAgent(validOptions);

      const isConnected = uninitializedAgent.isMCPServerConnected('server1');

      expect(isConnected).toBe(false);
    });
  });

  describe('Static Factory Methods', () => {
    it('should create agent with HTS tools', () => {
      const agent = ConversationalAgent.withHTS(validOptions);

      expect(agent).toBeInstanceOf(ConversationalAgent);
    });

    it('should create agent with HCS2 tools', () => {
      const agent = ConversationalAgent.withHCS2(validOptions);

      expect(agent).toBeInstanceOf(ConversationalAgent);
    });

    it('should create agent with HCS10 tools', () => {
      const agent = ConversationalAgent.withHCS10(validOptions);

      expect(agent).toBeInstanceOf(ConversationalAgent);
    });

    it('should create agent with inscribe tools', () => {
      const agent = ConversationalAgent.withInscribe(validOptions);

      expect(agent).toBeInstanceOf(ConversationalAgent);
    });

    it('should create agent with account tools', () => {
      const agent = ConversationalAgent.withAccount(validOptions);

      expect(agent).toBeInstanceOf(ConversationalAgent);
    });

    it('should create agent with file service tools', () => {
      const agent = ConversationalAgent.withFileService(validOptions);

      expect(agent).toBeInstanceOf(ConversationalAgent);
    });

    it('should create agent with consensus service tools', () => {
      const agent = ConversationalAgent.withConsensusService(validOptions);

      expect(agent).toBeInstanceOf(ConversationalAgent);
    });

    it('should create agent with smart contract tools', () => {
      const agent = ConversationalAgent.withSmartContract(validOptions);

      expect(agent).toBeInstanceOf(ConversationalAgent);
    });

    it('should create agent with all standards', () => {
      const agent = ConversationalAgent.withAllStandards(validOptions);

      expect(agent).toBeInstanceOf(ConversationalAgent);
    });

    it('should create minimal agent', () => {
      const agent = ConversationalAgent.minimal(validOptions);

      expect(agent).toBeInstanceOf(ConversationalAgent);
    });

    it('should create agent with MCP servers', () => {
      const mcpServers: MCPServerConfig[] = [{ name: 'test', command: 'test', args: [] }];
      const agent = ConversationalAgent.withMCP(validOptions, mcpServers);

      expect(agent).toBeInstanceOf(ConversationalAgent);
    });
  });

  describe('cleanup', () => {
    it('should cleanup resources successfully', async () => {
      const options = { ...validOptions, entityMemoryEnabled: true };
      const agent = new ConversationalAgent(options);
      await agent.initialize();

      await agent.cleanup();

      expect(mockMemoryManager.dispose).toHaveBeenCalled();
      expect(mockContentManager.dispose).toHaveBeenCalled();
      expect(agent.memoryManager).toBeUndefined();
    });

    it('should handle cleanup errors gracefully', async () => {
      const options = { ...validOptions, entityMemoryEnabled: true };
      const agent = new ConversationalAgent(options);
      await agent.initialize();

      mockMemoryManager.dispose.mockImplementation(() => {
        throw new Error('Cleanup error');
      });

      await expect(agent.cleanup()).resolves.not.toThrow();
    });

    it('should cleanup without memory manager', async () => {
      const agent = new ConversationalAgent(validOptions);
      await agent.initialize();

      await agent.cleanup();

      expect(mockContentManager.dispose).toHaveBeenCalled();
    });
  });

  describe('Response Text Extraction', () => {
    it('should extract text from string response', () => {
      const agent = new ConversationalAgent(validOptions);
      const result = (agent as any).extractResponseText('Hello world');

      expect(result).toBe('Hello world');
    });

    it('should extract text from object with output', () => {
      const agent = new ConversationalAgent(validOptions);
      const response = { output: 'Hello world' };
      const result = (agent as any).extractResponseText(response);

      expect(result).toBe('Hello world');
    });

    it('should stringify other objects', () => {
      const agent = new ConversationalAgent(validOptions);
      const response = { data: 'test' };
      const result = (agent as any).extractResponseText(response);

      expect(result).toBe('{"data":"test"}');
    });
  });

  describe('Transaction ID Extraction', () => {
    it('should extract transaction ID from object', () => {
      const agent = new ConversationalAgent(validOptions);
      const response = { transactionId: 'tx123' };
      const result = (agent as any).extractTransactionId(response);

      expect(result).toBe('tx123');
    });

    it('should extract transaction ID from string', () => {
      const agent = new ConversationalAgent(validOptions);
      const response = 'Transaction ID tx123';
      const result = (agent as any).extractTransactionId(response);

      expect(result).toBe('tx123');
    });

    it('should return undefined for invalid input', () => {
      const agent = new ConversationalAgent(validOptions);
      const result = (agent as any).extractTransactionId(null);

      expect(result).toBeUndefined();
    });

    it('should handle extraction errors', () => {
      const agent = new ConversationalAgent(validOptions);
      const response = { get transactionId() { throw new Error('test'); } };
      const result = (agent as any).extractTransactionId(response);

      expect(result).toBeUndefined();
    });
  });

  describe('Tool Filtering', () => {
    it('should filter out specific tools by default', async () => {
      const agent = new ConversationalAgent(validOptions);
      await agent.initialize();

      const createAgentCall = mockCreateAgent.mock.calls[0][0];
      const toolPredicate = createAgentCall.filtering.toolPredicate;

      expect(toolPredicate({ name: 'hedera-account-transfer-hbar' })).toBe(false);
      expect(toolPredicate({ name: 'hedera-hts-airdrop-token' })).toBe(false);
      expect(toolPredicate({ name: 'other-tool' })).toBe(true);
    });

    it('should apply custom tool filter', async () => {
      const customFilter = jest.fn().mockReturnValue(false);
      const options = { ...validOptions, toolFilter: customFilter };
      const agent = new ConversationalAgent(options);
      await agent.initialize();

      const createAgentCall = mockCreateAgent.mock.calls[0][0];
      const toolPredicate = createAgentCall.filtering.toolPredicate;

      const result = toolPredicate({ name: 'custom-tool' });

      expect(customFilter).toHaveBeenCalledWith({ name: 'custom-tool' });
      expect(result).toBe(false);
    });
  });

  describe('Error Scenarios', () => {
    it('should handle MCP connection errors', async () => {
      jest.setTimeout(10000);
      const mcpServers: MCPServerConfig[] = [{ name: 'test', command: 'test', args: [] }];
      const options = { ...validOptions, mcpServers };
      const agent = new ConversationalAgent(options);

      mockAgent.connectMCPServers.mockRejectedValue(new Error('MCP connection failed'));

      await agent.initialize();

      await new Promise(resolve => setTimeout(resolve, 10));
    });

    it('should handle agent boot failures', async () => {
      const agent = new ConversationalAgent(validOptions);
      mockAgent.boot.mockRejectedValue(new Error('Boot failed'));

      await expect(agent.initialize()).rejects.toThrow('Boot failed');
    });

    it('should handle content store manager initialization failure', async () => {
      const agent = new ConversationalAgent(validOptions);
      mockContentManager.initialize.mockRejectedValue(new Error('ContentStore init failed'));

      await expect(agent.initialize()).rejects.toThrow('ContentStore init failed');
    });
  });
});