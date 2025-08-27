import { ResolveEntitiesTool, ExtractEntitiesTool, createEntityTools } from '@/tools/entity-resolver-tool';
import { ChatOpenAI } from '@langchain/openai';
import { AIMessage } from '@langchain/core/messages';

jest.mock('@langchain/openai');
jest.mock('@hashgraphonline/standards-sdk', () => ({
  Logger: jest.fn().mockImplementation(() => ({
    error: jest.fn(),
    warn: jest.fn(),
    info: jest.fn(),
    debug: jest.fn(),
  })),
}));

const MockChatOpenAI = ChatOpenAI as jest.MockedClass<typeof ChatOpenAI>;

describe('ResolveEntitiesTool', () => {
  let mockLLM: jest.Mocked<ChatOpenAI>;
  let resolveEntities: ResolveEntitiesTool;

  beforeEach(() => {
    jest.clearAllMocks();
    mockLLM = {
      invoke: jest.fn(),
    } as unknown as { invoke: jest.Mock };
    MockChatOpenAI.mockImplementation(() => mockLLM);
    resolveEntities = new ResolveEntitiesTool('test-api-key', 'gpt-4o-mini');
  });

  describe('constructor', () => {
    it('should initialize with correct properties', () => {
      expect(resolveEntities.name).toBe('resolve_entities');
      expect(resolveEntities.description).toBe('Resolves entity references like "the topic", "it", "that" to actual entity IDs');
      expect(MockChatOpenAI).toHaveBeenCalledWith({
        apiKey: 'test-api-key',
        modelName: 'gpt-4o-mini',
        temperature: 0,
      });
    });

    it('should use default model name when not provided', () => {
      MockChatOpenAI.mockClear();
      new ResolveEntitiesTool('test-key');
      
      expect(MockChatOpenAI).toHaveBeenCalledWith({
        apiKey: 'test-key',
        modelName: 'gpt-4o-mini',
        temperature: 0,
      });
    });
  });

  describe('_call', () => {
    const sampleEntities = [
      { entityId: '0.0.123456', entityName: 'My Token', entityType: 'token' },
      { entityId: '0.0.789012', entityName: 'Test Topic', entityType: 'topic' },
    ];

    it('should return original message when no entities provided', async () => {
      const input = {
        message: 'test message',
        entities: [],
      };

      const result = await resolveEntities._call(input);
      expect(result).toBe('test message');
      expect(mockLLM.invoke).not.toHaveBeenCalled();
    });

    it('should return original message when entities array is empty', async () => {
      const input = {
        message: 'test message',
        entities: [],
      };

      const result = await resolveEntities._call(input);
      expect(result).toBe('test message');
      expect(mockLLM.invoke).not.toHaveBeenCalled();
    });

    it('should resolve entities using LLM when entities are provided', async () => {
      const input = {
        message: 'submit on the topic',
        entities: sampleEntities,
      };

      const mockResponse = new AIMessage('submit on 0.0.789012');
      mockLLM.invoke.mockResolvedValue(mockResponse);

      const result = await resolveEntities._call(input);

      expect(result).toBe('submit on 0.0.789012');
      expect(mockLLM.invoke).toHaveBeenCalledWith(expect.stringContaining('Task: Replace entity references with IDs.'));
      expect(mockLLM.invoke).toHaveBeenCalledWith(expect.stringContaining('Most recent token: "My Token" = 0.0.123456'));
      expect(mockLLM.invoke).toHaveBeenCalledWith(expect.stringContaining('Most recent topic: "Test Topic" = 0.0.789012'));
      expect(mockLLM.invoke).toHaveBeenCalledWith(expect.stringContaining('Message: "submit on the topic"'));
    });

    it('should handle LLM response with whitespace', async () => {
      const input = {
        message: 'airdrop the token',
        entities: sampleEntities,
      };

      const mockResponse = new AIMessage('  airdrop 0.0.123456  ');
      mockLLM.invoke.mockResolvedValue(mockResponse);

      const result = await resolveEntities._call(input);
      expect(result).toBe('airdrop 0.0.123456');
    });

    it('should return original message when LLM fails', async () => {
      const input = {
        message: 'test message',
        entities: sampleEntities,
      };

      mockLLM.invoke.mockRejectedValue(new Error('LLM API error'));

      const result = await resolveEntities._call(input);
      expect(result).toBe('test message');
    });

    it('should build correct prompt with multiple entity types', async () => {
      const multipleEntities = [
        { entityId: '0.0.111', entityName: 'Token A', entityType: 'token' },
        { entityId: '0.0.222', entityName: 'Token B', entityType: 'token' },
        { entityId: '0.0.333', entityName: 'Topic A', entityType: 'topic' },
        { entityId: '0.0.444', entityName: 'Account A', entityType: 'account' },
      ];

      const input = {
        message: 'test message',
        entities: multipleEntities,
      };

      const mockResponse = new AIMessage('resolved message');
      mockLLM.invoke.mockResolvedValue(mockResponse);

      await resolveEntities._call(input);

      const calledPrompt = mockLLM.invoke.mock.calls[0][0] as string;
      expect(calledPrompt).toContain('Most recent token: "Token A" = 0.0.111');
      expect(calledPrompt).toContain('Most recent topic: "Topic A" = 0.0.333');
      expect(calledPrompt).toContain('Most recent account: "Account A" = 0.0.444');
      expect(calledPrompt).not.toContain('Token B');
    });

    it('should include all required prompt sections', async () => {
      const input = {
        message: 'mint 100',
        entities: sampleEntities,
      };

      const mockResponse = new AIMessage('mint 0.0.123456 100');
      mockLLM.invoke.mockResolvedValue(mockResponse);

      await resolveEntities._call(input);

      const calledPrompt = mockLLM.invoke.mock.calls[0][0] as string;
      expect(calledPrompt).toContain('Task: Replace entity references with IDs.');
      expect(calledPrompt).toContain('Available entities:');
      expect(calledPrompt).toContain('Message: "mint 100"');
      expect(calledPrompt).toContain('Rules:');
      expect(calledPrompt).toContain('Examples:');
      expect(calledPrompt).toContain('Return ONLY the resolved message:');
    });
  });
});

describe('ExtractEntitiesTool', () => {
  let mockLLM: jest.Mocked<ChatOpenAI>;
  let extractEntities: ExtractEntitiesTool;

  beforeEach(() => {
    jest.clearAllMocks();
    mockLLM = {
      invoke: jest.fn(),
    } as unknown as { invoke: jest.Mock };
    MockChatOpenAI.mockImplementation(() => mockLLM);
    extractEntities = new ExtractEntitiesTool('test-api-key', 'gpt-4o-mini');
  });

  describe('constructor', () => {
    it('should initialize with correct properties', () => {
      expect(extractEntities.name).toBe('extract_entities');
      expect(extractEntities.description).toBe('Extracts newly created entities from agent responses');
      expect(MockChatOpenAI).toHaveBeenCalledWith({
        apiKey: 'test-api-key',
        modelName: 'gpt-4o-mini',
        temperature: 0,
      });
    });

    it('should use default model name when not provided', () => {
      MockChatOpenAI.mockClear();
      new ExtractEntitiesTool('test-key');
      
      expect(MockChatOpenAI).toHaveBeenCalledWith({
        apiKey: 'test-key',
        modelName: 'gpt-4o-mini',
        temperature: 0,
      });
    });
  });

  describe('_call', () => {
    it('should extract entities from successful response', async () => {
      const input = {
        response: 'Successfully created topic 0.0.123456 with name "Test Topic"',
        userMessage: 'create a topic',
      };

      const mockResponse = new AIMessage('[{"id": "0.0.123456", "name": "Test Topic", "type": "topic"}]');
      mockLLM.invoke.mockResolvedValue(mockResponse);

      const result = await extractEntities._call(input);
      expect(result).toBe('[{"id": "0.0.123456", "name": "Test Topic", "type": "topic"}]');
    });

    it('should return empty array when no entities found', async () => {
      const input = {
        response: 'Operation failed',
        userMessage: 'create a topic',
      };

      const mockResponse = new AIMessage('No entities were created. []');
      mockLLM.invoke.mockResolvedValue(mockResponse);

      const result = await extractEntities._call(input);
      expect(result).toBe('[]');
    });

    it('should extract JSON array from mixed response content', async () => {
      const input = {
        response: 'Here are the results',
        userMessage: 'create entities',
      };

      const mockResponse = new AIMessage('Based on the analysis: [{"id": "0.0.789", "name": "New Token", "type": "token"}] were created.');
      mockLLM.invoke.mockResolvedValue(mockResponse);

      const result = await extractEntities._call(input);
      expect(result).toBe('[{"id": "0.0.789", "name": "New Token", "type": "token"}]');
    });

    it('should handle multiline JSON responses', async () => {
      const input = {
        response: 'Multiple entities created',
        userMessage: 'create multiple',
      };

      const jsonResponse = `[
        {"id": "0.0.111", "name": "Entity 1", "type": "topic"},
        {"id": "0.0.222", "name": "Entity 2", "type": "token"}
      ]`;
      const mockResponse = new AIMessage(`Here are the entities: ${jsonResponse}`);
      mockLLM.invoke.mockResolvedValue(mockResponse);

      const result = await extractEntities._call(input);
      expect(result).toBe(jsonResponse);
    });

    it('should return empty array when no JSON found in response', async () => {
      const input = {
        response: 'No entities created',
        userMessage: 'failed operation',
      };

      const mockResponse = new AIMessage('Nothing was created successfully');
      mockLLM.invoke.mockResolvedValue(mockResponse);

      const result = await extractEntities._call(input);
      expect(result).toBe('[]');
    });

    it('should return empty array when LLM fails', async () => {
      const input = {
        response: 'test response',
        userMessage: 'test message',
      };

      mockLLM.invoke.mockRejectedValue(new Error('LLM API error'));

      const result = await extractEntities._call(input);
      expect(result).toBe('[]');
    });

    it('should truncate long messages in prompt', async () => {
      const longUserMessage = 'a'.repeat(300);
      const longResponse = 'b'.repeat(4000);
      
      const input = {
        response: longResponse,
        userMessage: longUserMessage,
      };

      const mockResponse = new AIMessage('[]');
      mockLLM.invoke.mockResolvedValue(mockResponse);

      await extractEntities._call(input);

      const calledPrompt = mockLLM.invoke.mock.calls[0][0] as string;
      
      const userMessageInPrompt = calledPrompt.match(/User asked: "(.*?)"/)?.[1] || '';
      const responseInPrompt = calledPrompt.match(/Response: (.*?)Look for:/s)?.[1]?.trim() || '';
      
      expect(userMessageInPrompt.length).toBe(200);
      expect(responseInPrompt.length).toBe(3000);
      expect(userMessageInPrompt).toBe(longUserMessage.substring(0, 200));
      expect(responseInPrompt).toBe(longResponse.substring(0, 3000));
    });

    it('should build correct prompt structure', async () => {
      const input = {
        response: 'Created new token successfully',
        userMessage: 'make a token',
      };

      const mockResponse = new AIMessage('[]');
      mockLLM.invoke.mockResolvedValue(mockResponse);

      await extractEntities._call(input);

      const calledPrompt = mockLLM.invoke.mock.calls[0][0] as string;
      expect(calledPrompt).toContain('Extract ONLY newly created entities');
      expect(calledPrompt).toContain('User asked: "make a token"');
      expect(calledPrompt).toContain('Response: Created new token successfully');
      expect(calledPrompt).toContain('Look for:');
      expect(calledPrompt).toContain('Return JSON array of created entities:');
      expect(calledPrompt).toContain('If none created, return: []');
      expect(calledPrompt).toContain('JSON:');
    });
  });
});

describe('createEntityTools', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should create both tools with provided API key', () => {
    const tools = createEntityTools('test-api-key');
    
    expect(tools).toHaveProperty('resolveEntities');
    expect(tools).toHaveProperty('extractEntities');
    expect(tools.resolveEntities).toBeInstanceOf(ResolveEntitiesTool);
    expect(tools.extractEntities).toBeInstanceOf(ExtractEntitiesTool);
  });

  it('should create tools with custom model name', () => {
    const tools = createEntityTools('test-api-key', 'gpt-3.5-turbo');
    
    expect(tools.resolveEntities).toBeInstanceOf(ResolveEntitiesTool);
    expect(tools.extractEntities).toBeInstanceOf(ExtractEntitiesTool);
    expect(MockChatOpenAI).toHaveBeenCalledWith(expect.objectContaining({
      modelName: 'gpt-3.5-turbo',
    }));
  });

  it('should create tools with default model name', () => {
    const _tools = createEntityTools('test-api-key');
    
    expect(MockChatOpenAI).toHaveBeenCalledWith(expect.objectContaining({
      modelName: 'gpt-4o-mini',
    }));
  });
});