import { LangChainAgent } from '../../../src/langchain/langchain-agent';
import { FormEngine } from '../../../src/forms/form-engine';
import type { FormSubmission } from '../../../src/forms/types';
import type { ExecutionPipeline } from '../../../src/execution/execution-pipeline';
import type { SmartMemoryManager } from '../../../src/memory/smart-memory-manager';
import type { ToolRegistry } from '../../../src/core/tool-registry';
import type { MCPClientManager } from '../../../src/mcp/mcp-client-manager';
import type { AgentStep } from 'langchain/agents';
import { createMockServerSigner } from '../../mock-factory';

interface MockAgentConfig {
  signer: any;
  apiKey?: string;
  model?: string;
  temperature?: number;
  maxTokens?: number;
  streaming?: boolean;
  systemMessage?: string;
  mcpServers?: Record<string, any>;
  tools?: any[];
}

interface MockChatResponse {
  output: string;
  message: string;
  notes: string[];
  metadata?: {
    hashLinkBlock?: {
      blockId: string;
      hashLink: string;
      template: string;
      attributes: Record<string, unknown>;
    };
    [key: string]: unknown;
  };
}

interface MockToolExecutionResult {
  output: string;
  intermediateSteps: AgentStep[];
  metadata?: {
    hashLinkBlock?: {
      blockId: string;
      hashLink: string;
      template: string;
      attributes: Record<string, unknown>;
    };
  };
}

const createMockLangChainAgent = (config: Partial<MockAgentConfig> = {}) => {
  const mockSigner = config.signer || createMockServerSigner({
    getAccountId: jest.fn().mockReturnValue({ toString: () => '0.0.123' }),
    getNetwork: jest.fn().mockReturnValue({ toString: () => 'testnet' }),
  });

  const fullConfig: MockAgentConfig = {
    signer: mockSigner,
    apiKey: 'test-api-key',
    model: 'gpt-4',
    temperature: 0.1,
    maxTokens: 1000,
    streaming: true,
    systemMessage: 'You are a helpful assistant.',
    mcpServers: {},
    tools: [],
    ...config,
  };

  return new LangChainAgent(fullConfig as any);
};

const createMockFormSubmission = (
  formId: string,
  values: Record<string, unknown>,
  isValid = true
): FormSubmission => ({
  formId,
  toolName: 'test-tool',
  parameters: values,
  timestamp: Date.now(),
});

describe('LangChainAgent Comprehensive Tests', () => {
  describe('Construction and Initialization', () => {
    it('should initialize with minimal config', () => {
      const agent = createMockLangChainAgent();
      
      expect(agent).toBeInstanceOf(LangChainAgent);
      expect(agent.hasPendingForms()).toBe(false);
    });

    it('should initialize with full config', () => {
      const config = {
        apiKey: 'custom-key',
        model: 'gpt-3.5-turbo',
        temperature: 0.5,
        maxTokens: 2000,
        streaming: false,
        systemMessage: 'Custom system message',
        mcpServers: { 'test-server': { url: 'http://test' } },
      };

      const agent = createMockLangChainAgent(config);
      
      expect(agent).toBeInstanceOf(LangChainAgent);
    });

    it('should handle missing required config gracefully', () => {
      expect(() => {
        new LangChainAgent({} as any);
      }).toThrow();
    });
  });

  describe('Boot Process', () => {
    it('should boot successfully with tools', async () => {
      const agent = createMockLangChainAgent();
      
      jest.spyOn(agent as any, 'createAgentKit').mockResolvedValue({
        tools: [],
      });
      jest.spyOn(agent as any, 'createExecutor').mockReturnValue({
        tools: [],
      });
      jest.spyOn(agent as any, 'initializeMCP').mockResolvedValue(undefined);

      await agent.boot();
      
      expect(agent['createAgentKit']).toHaveBeenCalled();
      expect(agent['createExecutor']).toHaveBeenCalled();
    });

    it('should handle boot failure gracefully', async () => {
      const agent = createMockLangChainAgent();
      
      jest.spyOn(agent as any, 'createAgentKit').mockRejectedValue(new Error('Boot failed'));

      await expect(agent.boot()).rejects.toThrow('Boot failed');
    });

    it('should boot with MCP servers', async () => {
      const mcpConfig = {
        'filesystem': { command: 'npx', args: ['@modelcontextprotocol/server-filesystem'] },
      };
      const agent = createMockLangChainAgent({ mcpServers: mcpConfig });
      
      jest.spyOn(agent as any, 'createAgentKit').mockResolvedValue({ tools: [] });
      jest.spyOn(agent as any, 'createExecutor').mockReturnValue({ tools: [] });
      jest.spyOn(agent as any, 'initializeMCP').mockResolvedValue(undefined);

      await agent.boot();
      
      expect(agent['initializeMCP']).toHaveBeenCalled();
    });
  });

  describe('Chat Functionality', () => {
    let agent: LangChainAgent;

    beforeEach(async () => {
      agent = createMockLangChainAgent();
      
      jest.spyOn(agent as any, 'createAgentKit').mockResolvedValue({ tools: [] });
      jest.spyOn(agent as any, 'createExecutor').mockReturnValue({
        call: jest.fn().mockResolvedValue({
          output: 'Test response',
          intermediateSteps: [],
        }),
      });
      jest.spyOn(agent as any, 'initializeMCP').mockResolvedValue(undefined);

      await agent.boot();
    });

    it('should handle basic chat message', async () => {
      const response = await agent.chat('Hello, how are you?');
      
      expect(response).toHaveProperty('output');
      expect(response).toHaveProperty('message');
      expect(response).toHaveProperty('notes');
    });

    it('should handle streaming chat', async () => {
      const streamingAgent = createMockLangChainAgent({ streaming: true });
      
      jest.spyOn(streamingAgent as any, 'createAgentKit').mockResolvedValue({ tools: [] });
      jest.spyOn(streamingAgent as any, 'createExecutor').mockReturnValue({
        stream: jest.fn().mockResolvedValue([
          { output: 'Streaming response' },
        ]),
      });
      jest.spyOn(streamingAgent as any, 'initializeMCP').mockResolvedValue(undefined);

      await streamingAgent.boot();
      
      const response = await streamingAgent.chat('Test streaming');
      
      expect(response).toHaveProperty('output');
    });

    it('should handle chat with content references', async () => {
      const contentRefMessage = 'Please analyze this: [content-ref:inscription:123]';
      
      jest.spyOn(agent as any, 'handleContentRefMessages').mockResolvedValue(contentRefMessage);
      
      const response = await agent.chat(contentRefMessage);
      
      expect(response).toHaveProperty('output');
      expect(agent['handleContentRefMessages']).toHaveBeenCalled();
    });

    it('should handle JSON tool calls', async () => {
      const jsonToolCall = '{"tool": "test-tool", "parameters": {"key": "value"}}';
      
      jest.spyOn(agent as any, 'handleJsonToolCalls').mockResolvedValue({
        output: 'Tool executed',
        metadata: {},
      });
      
      const response = await agent.chat(jsonToolCall);
      
      expect(response).toHaveProperty('output');
    });

    it('should handle direct tool execution', async () => {
      const directToolCall = '/test-tool key=value';
      
      jest.spyOn(agent as any, 'handleDirectToolExecution').mockResolvedValue({
        output: 'Direct tool executed',
        metadata: {},
      });
      
      const response = await agent.chat(directToolCall);
      
      expect(response).toHaveProperty('output');
    });
  });

  describe('Tool Management', () => {
    let agent: LangChainAgent;

    beforeEach(async () => {
      agent = createMockLangChainAgent();
      jest.spyOn(agent as any, 'createAgentKit').mockResolvedValue({ tools: [] });
      jest.spyOn(agent as any, 'createExecutor').mockReturnValue({ tools: [] });
      jest.spyOn(agent as any, 'initializeMCP').mockResolvedValue(undefined);
      await agent.boot();
    });

    it('should execute tool directly', async () => {
      const mockTool = {
        name: 'test-tool',
        call: jest.fn().mockResolvedValue('Tool result'),
      };

      jest.spyOn(agent['toolRegistry'] as any, 'getTool').mockReturnValue(mockTool);
      
      const result = await agent['executeToolDirect']('test-tool', { input: 'test' });
      
      expect(result).toHaveProperty('output');
      expect(mockTool.call).toHaveBeenCalledWith({ input: 'test' });
    });

    it('should handle tool execution errors', async () => {
      const mockTool = {
        name: 'error-tool',
        call: jest.fn().mockRejectedValue(new Error('Tool error')),
      };

      jest.spyOn(agent['toolRegistry'] as any, 'getTool').mockReturnValue(mockTool);
      
      const result = await agent['executeToolDirect']('error-tool', { input: 'test' });

      expect(typeof result).toBe('string');
      expect(result).toContain('error');
    });

    it('should get inscription tool', () => {
      const mockInscriptionTool = { name: 'inscribe-tool' };
      jest.spyOn(agent['toolRegistry'] as any, 'getTool').mockReturnValue(mockInscriptionTool);
      
      const tool = agent['getInscriptionTool']();
      
      expect(tool).toBe(mockInscriptionTool);
    });

    it('should handle missing inscription tool', () => {
      jest.spyOn(agent['toolRegistry'] as any, 'getTool').mockReturnValue(undefined);
      
      const tool = agent['getInscriptionTool']();
      
      expect(tool).toBeUndefined();
    });

    it('should create tool response with metadata', () => {
      const metadata = {
        hashLinkBlock: {
          blockId: 'block-123',
          hashLink: 'hrl://test',
          template: 'test',
          attributes: {},
        },
      };

      const response = agent['createToolResponse']('Test output');
      
      expect(response).toHaveProperty('output', 'Test output');
      expect(response).toHaveProperty('metadata');
      expect(response.metadata).toEqual(metadata);
    });
  });

  describe('Form Processing', () => {
    let agent: LangChainAgent;

    beforeEach(async () => {
      agent = createMockLangChainAgent();
      jest.spyOn(agent as any, 'createAgentKit').mockResolvedValue({ tools: [] });
      jest.spyOn(agent as any, 'createExecutor').mockReturnValue({
        processFormSubmission: jest.fn().mockResolvedValue({
          success: true,
          output: 'Form processed',
        }),
        hasPendingForms: jest.fn().mockReturnValue(false),
        getPendingFormsInfo: jest.fn().mockReturnValue({
          totalPendingForms: 0,
          formIds: [],
        }),
      });
      jest.spyOn(agent as any, 'initializeMCP').mockResolvedValue(undefined);
      await agent.boot();
    });

    it('should process valid form submission', async () => {
      const formSubmission = createMockFormSubmission('form-123', {
        field1: 'value1',
        field2: 'value2',
      });

      const result = await agent.processFormSubmission(formSubmission);
      
      expect(result).toHaveProperty('success', true);
      expect(result).toHaveProperty('output');
    });

    it('should process invalid form submission', async () => {
      const formSubmission = createMockFormSubmission('form-123', {
        field1: '',
      }, false);

      agent['executor']!.processFormSubmission = jest.fn().mockResolvedValue({
        success: false,
        output: 'Form validation failed',
      });

      const result = await agent.processFormSubmission(formSubmission);
      
      expect(result).toHaveProperty('success', false);
    });

    it('should check for pending forms', () => {
      expect(agent.hasPendingForms()).toBe(false);
    });

    it('should get pending forms info', () => {
      const info = agent.getPendingFormsInfo();
      
      expect(info).toHaveProperty('totalPendingForms');
      expect(info).toHaveProperty('formIds');
    });
  });

  describe('Memory Management', () => {
    let agent: LangChainAgent;

    beforeEach(async () => {
      agent = createMockLangChainAgent();
      jest.spyOn(agent as any, 'createAgentKit').mockResolvedValue({ tools: [] });
      jest.spyOn(agent as any, 'createExecutor').mockReturnValue({ tools: [] });
      jest.spyOn(agent as any, 'initializeMCP').mockResolvedValue(undefined);
      await agent.boot();
    });

    it('should persist tool raw data', () => {
      const toolData = {
        tool: 'test-tool',
        input: { key: 'value' },
        output: 'result',
        timestamp: Date.now(),
      };

      agent['persistToolRaw']('test-tool', toolData);

      expect((agent['smartMemory'] as any)?.addToolRaw).toHaveBeenCalledWith(toolData);
    });

    it('should persist intermediate steps', () => {
      const steps: AgentStep[] = [
        {
          action: {
            tool: 'test-tool',
            toolInput: { key: 'value' },
            log: 'Using test-tool',
          },
          observation: 'Tool executed successfully',
        },
      ];

      agent['persistIntermediateSteps'](steps as any);

      expect((agent['smartMemory'] as any)?.addIntermediateSteps).toHaveBeenCalledWith(steps);
    });

    it('should add tool raw to memory', () => {
      const toolRaw = {
        tool: 'test-tool',
        input: { key: 'value' },
        output: 'result',
        timestamp: Date.now(),
      };

      agent['addToolRawToMemory']('test-tool', JSON.stringify(toolRaw));

      expect((agent['smartMemory'] as any)?.addToolRaw).toHaveBeenCalledWith(toolRaw);
    });

    it('should load context messages', async () => {
      const messages = [
        { role: 'user', content: 'Hello' },
        { role: 'assistant', content: 'Hi there' },
      ];

      jest.spyOn(agent['smartMemory'] as any, 'getContextMessages').mockReturnValue(messages);
      
      const loadedMessages = await agent['loadContextMessages']();
      
      expect(loadedMessages).toEqual(messages);
    });
  });

  describe('MCP Server Management', () => {
    let agent: LangChainAgent;

    beforeEach(async () => {
      agent = createMockLangChainAgent({
        mcpServers: {
          'filesystem': { command: 'npx', args: ['@modelcontextprotocol/server-filesystem'] },
        },
      });
    });

    it('should initialize MCP servers', async () => {
      jest.spyOn(agent as any, 'connectMCPServers').mockResolvedValue(undefined);
      
      await agent['initializeMCP']();
      
      expect(agent['connectMCPServers']).toHaveBeenCalled();
    });

    it('should connect MCP servers', async () => {
      jest.spyOn(agent as any, 'connectServerInBackground').mockResolvedValue(undefined);
      
      await agent['connectMCPServers']();
      
      expect(agent['connectServerInBackground']).toHaveBeenCalled();
    });

    it('should get MCP connection status', () => {
      const status = agent.getMCPConnectionStatus();
      
      expect(status).toHaveProperty('connected');
      expect(status).toHaveProperty('servers');
    });

    it('should handle MCP connection errors', async () => {
      jest.spyOn(agent as any, 'connectServerInBackground')
        .mockRejectedValue(new Error('Connection failed'));
      
      await agent['connectMCPServers']();
      
      expect(agent['mcpConnectionStatus'].size).toBe(0);
    });
  });

  describe('Usage Statistics', () => {
    let agent: LangChainAgent;

    beforeEach(async () => {
      agent = createMockLangChainAgent();
      jest.spyOn(agent as any, 'createAgentKit').mockResolvedValue({ tools: [] });
      jest.spyOn(agent as any, 'createExecutor').mockReturnValue({ tools: [] });
      jest.spyOn(agent as any, 'initializeMCP').mockResolvedValue(undefined);
      await agent.boot();
    });

    it('should track usage statistics', () => {
      const stats = agent.getUsageStats();
      
      expect(stats).toHaveProperty('totalChatCalls');
      expect(stats).toHaveProperty('totalToolCalls');
      expect(stats).toHaveProperty('totalTokensUsed');
    });

    it('should get usage log', () => {
      const log = agent.getUsageLog();
      
      expect(Array.isArray(log)).toBe(true);
    });

    it('should clear usage statistics', () => {
      agent.clearUsageStats();
      
      const stats = agent.getUsageStats();
      expect(stats).toBeDefined();
    });
  });

  describe('Mode Switching', () => {
    let agent: LangChainAgent;

    beforeEach(async () => {
      agent = createMockLangChainAgent();
      jest.spyOn(agent as any, 'createAgentKit').mockResolvedValue({ tools: [] });
      jest.spyOn(agent as any, 'createExecutor').mockReturnValue({ tools: [] });
      jest.spyOn(agent as any, 'initializeMCP').mockResolvedValue(undefined);
      await agent.boot();
    });

    it('should switch to streaming mode', () => {
      agent.switchMode({ streaming: true } as any);

      expect(agent['streaming']).toBe(true);
    });

    it('should switch to non-streaming mode', () => {
      agent.switchMode({ streaming: false } as any);

      expect(agent['streaming']).toBe(false);
    });

    it('should switch model', () => {
      agent.switchMode({ model: 'gpt-3.5-turbo' } as any);

      expect(agent['model']).toBe('gpt-3.5-turbo');
    });

    it('should switch temperature', () => {
      agent.switchMode({ temperature: 0.8 } as any);

      expect(agent['temperature']).toBe(0.8);
    });
  });

  describe('Error Handling', () => {
    let agent: LangChainAgent;

    beforeEach(async () => {
      agent = createMockLangChainAgent();
      jest.spyOn(agent as any, 'createAgentKit').mockResolvedValue({ tools: [] });
      jest.spyOn(agent as any, 'createExecutor').mockReturnValue({ tools: [] });
      jest.spyOn(agent as any, 'initializeMCP').mockResolvedValue(undefined);
      await agent.boot();
    });

    it('should handle generic errors', async () => {
      const error = new Error('Generic error');
      
      const result = await agent['handleError'](error);
      
      expect(result).toHaveProperty('output');
      expect(result.output).toContain('error');
    });

    it('should handle network errors', async () => {
      const networkError = new Error('Network error');
      networkError.name = 'NetworkError';
      
      const result = await agent['handleError'](networkError, 'network operation');
      
      expect(result).toHaveProperty('output');
      expect(result.output).toContain('network');
    });

    it('should handle timeout errors', async () => {
      const timeoutError = new Error('Timeout');
      timeoutError.name = 'TimeoutError';
      
      const result = await agent['handleError'](timeoutError, 'timeout operation');
      
      expect(result).toHaveProperty('output');
      expect(result.output).toContain('timeout');
    });
  });

  describe('HashLink Processing', () => {
    let agent: LangChainAgent;

    beforeEach(async () => {
      agent = createMockLangChainAgent();
      jest.spyOn(agent as any, 'createAgentKit').mockResolvedValue({ tools: [] });
      jest.spyOn(agent as any, 'createExecutor').mockReturnValue({ tools: [] });
      jest.spyOn(agent as any, 'initializeMCP').mockResolvedValue(undefined);
      await agent.boot();
    });

    it('should process HashLink blocks', () => {
      const hashLinkBlock = {
        blockId: 'block-123',
        hashLink: 'hrl://test.com/block-123',
        template: 'success-template',
        attributes: { success: true, message: 'Operation completed' },
      };

      const processed = agent['processHashLinkBlocks'](hashLinkBlock);
      
      expect(processed).toContain('block-123');
      expect(processed).toContain('hrl://test.com/block-123');
    });

    it('should handle HashLink blocks with complex attributes', () => {
      const hashLinkBlock = {
        blockId: 'complex-block',
        hashLink: 'hrl://test.com/complex',
        template: 'data-template',
        attributes: {
          data: {
            nested: { value: 42 },
            array: [1, 2, 3],
          },
          metadata: { type: 'complex' },
        },
      };

      const processed = agent['processHashLinkBlocks'](hashLinkBlock);
      
      expect(processed).toContain('complex-block');
      expect(processed).toContain('nested');
      expect(processed).toContain('42');
    });
  });

  describe('Parameter Preprocessing', () => {
    let agent: LangChainAgent;

    beforeEach(async () => {
      agent = createMockLangChainAgent();
      jest.spyOn(agent as any, 'createAgentKit').mockResolvedValue({ tools: [] });
      jest.spyOn(agent as any, 'createExecutor').mockReturnValue({
        setParameterPreprocessingCallback: jest.fn(),
      });
      jest.spyOn(agent as any, 'initializeMCP').mockResolvedValue(undefined);
      await agent.boot();
    });

    it('should set parameter preprocessing callback', () => {
      const callback = jest.fn();
      
      agent.setParameterPreprocessingCallback(callback);
      
      expect(agent['executor']!.setParameterPreprocessingCallback).toHaveBeenCalledWith(callback);
    });

    it('should clear parameter preprocessing callback', () => {
      agent.setParameterPreprocessingCallback(undefined);
      
      expect(agent['executor']!.setParameterPreprocessingCallback).toHaveBeenCalledWith(undefined);
    });
  });

  describe('Shutdown Process', () => {
    let agent: LangChainAgent;

    beforeEach(async () => {
      agent = createMockLangChainAgent();
      jest.spyOn(agent as any, 'createAgentKit').mockResolvedValue({ tools: [] });
      jest.spyOn(agent as any, 'createExecutor').mockReturnValue({ tools: [] });
      jest.spyOn(agent as any, 'initializeMCP').mockResolvedValue(undefined);
      await agent.boot();
    });

    it('should shutdown gracefully', async () => {
      jest.spyOn(agent['mcpManager'] as any, 'shutdown').mockResolvedValue(undefined);
      
      await agent.shutdown();
      
      expect(agent['mcpManager']?.shutdown).toHaveBeenCalled();
    });

    it('should handle shutdown errors gracefully', async () => {
      jest.spyOn(agent['mcpManager'] as any, 'shutdown')
        .mockRejectedValue(new Error('Shutdown failed'));
      
      await expect(agent.shutdown()).resolves.not.toThrow();
    });
  });

  describe('Utility Functions', () => {
    let agent: LangChainAgent;

    beforeEach(async () => {
      agent = createMockLangChainAgent();
      jest.spyOn(agent as any, 'createAgentKit').mockResolvedValue({ tools: [] });
      jest.spyOn(agent as any, 'createExecutor').mockReturnValue({ tools: [] });
      jest.spyOn(agent as any, 'initializeMCP').mockResolvedValue(undefined);
      await agent.boot();
    });

    it('should validate JSON strings', () => {
      expect(agent['isJSON']('{"valid": true}')).toBe(true);
      expect(agent['isJSON']('{"invalid": }')).toBe(false);
      expect(agent['isJSON']('not json at all')).toBe(false);
      expect(agent['isJSON']('')).toBe(false);
      expect(agent['isJSON']('null')).toBe(true);
      expect(agent['isJSON']('[]')).toBe(true);
    });
  });

  describe('Executor Result Processing', () => {
    let agent: LangChainAgent;

    beforeEach(async () => {
      agent = createMockLangChainAgent();
      jest.spyOn(agent as any, 'createAgentKit').mockResolvedValue({ tools: [] });
      jest.spyOn(agent as any, 'createExecutor').mockReturnValue({ tools: [] });
      jest.spyOn(agent as any, 'initializeMCP').mockResolvedValue(undefined);
      await agent.boot();
    });

    it('should process executor result with HashLink blocks', async () => {
      const executorResult: MockToolExecutionResult = {
        output: 'Tool executed successfully',
        intermediateSteps: [],
        metadata: {
          hashLinkBlock: {
            blockId: 'result-block',
            hashLink: 'hrl://result.com/block',
            template: 'result-template',
            attributes: { result: true },
          },
        },
      };

      jest.spyOn(agent as any, 'processHashLinkBlocks').mockReturnValue('Processed HashLink');
      jest.spyOn(agent as any, 'persistIntermediateSteps').mockReturnValue(undefined);

      const result = await agent['processExecutorResult'](executorResult, 'test message');
      
      expect(result).toHaveProperty('output');
      expect(result).toHaveProperty('metadata');
      expect(agent['processHashLinkBlocks']).toHaveBeenCalled();
    });

    it('should process executor result without HashLink blocks', async () => {
      const executorResult: MockToolExecutionResult = {
        output: 'Simple tool result',
        intermediateSteps: [],
      };

      jest.spyOn(agent as any, 'persistIntermediateSteps').mockReturnValue(undefined);

      const result = await agent['processExecutorResult'](executorResult, 'test message');
      
      expect(result).toHaveProperty('output', 'Simple tool result');
      expect(result.metadata).toBeUndefined();
    });
  });

  describe('Content Reference Handling', () => {
    let agent: LangChainAgent;

    beforeEach(async () => {
      agent = createMockLangChainAgent();
      jest.spyOn(agent as any, 'createAgentKit').mockResolvedValue({ tools: [] });
      jest.spyOn(agent as any, 'createExecutor').mockReturnValue({ tools: [] });
      jest.spyOn(agent as any, 'initializeMCP').mockResolvedValue(undefined);
      await agent.boot();
    });

    it('should handle content reference messages', async () => {
      const messageWithRefs = 'Analyze this: [content-ref:inscription:abc123] and this: [content-ref:file:xyz789]';
      
      jest.spyOn(agent['executionPipeline'] as any, 'processContentReferences')
        .mockResolvedValue('Processed content references');
      
      const result = await agent['handleContentRefMessages'](messageWithRefs);
      
      expect(result).toBe('Processed content references');
      expect(agent['executionPipeline'].processContentReferences).toHaveBeenCalledWith(messageWithRefs);
    });

    it('should pass through messages without content references', async () => {
      const normalMessage = 'This is a normal message without references';
      
      const result = await agent['handleContentRefMessages'](normalMessage);
      
      expect(result).toBe(normalMessage);
    });
  });

  describe('Edge Cases and Complex Scenarios', () => {
    let agent: LangChainAgent;

    beforeEach(async () => {
      agent = createMockLangChainAgent();
      jest.spyOn(agent as any, 'createAgentKit').mockResolvedValue({ tools: [] });
      jest.spyOn(agent as any, 'createExecutor').mockReturnValue({
        call: jest.fn(),
        stream: jest.fn(),
        processFormSubmission: jest.fn(),
        hasPendingForms: jest.fn().mockReturnValue(false),
        getPendingFormsInfo: jest.fn().mockReturnValue({
          totalPendingForms: 0,
          formIds: [],
        }),
        setParameterPreprocessingCallback: jest.fn(),
      });
      jest.spyOn(agent as any, 'initializeMCP').mockResolvedValue(undefined);
      await agent.boot();
    });

    it('should handle empty chat messages', async () => {
      const response = await agent.chat('');
      
      expect(response).toHaveProperty('output');
      expect(response).toHaveProperty('message');
    });

    it('should handle very long chat messages', async () => {
      const longMessage = 'A'.repeat(10000);
      
      const response = await agent.chat(longMessage);
      
      expect(response).toHaveProperty('output');
    });

    it('should handle chat messages with special characters', async () => {
      const specialMessage = '{"special": "chars", "unicode": "🚀", "escaped": "\\"quoted\\""}';
      
      const response = await agent.chat(specialMessage);
      
      expect(response).toHaveProperty('output');
    });

    it('should handle concurrent chat requests', async () => {
      const promises = [
        agent.chat('Message 1'),
        agent.chat('Message 2'),
        agent.chat('Message 3'),
      ];
      
      const results = await Promise.all(promises);
      
      expect(results).toHaveLength(3);
      results.forEach(result => {
        expect(result).toHaveProperty('output');
      });
    });
  });
});