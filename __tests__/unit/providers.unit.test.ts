import { describe, test, expect } from '@jest/globals';
import { LangChainProvider } from '../../src/providers';
import type { BaseChatModel } from '@langchain/core/language_models/chat_models';
import { TEST_PROVIDER_CONSTANTS } from '../test-constants';

const TEST_RESPONSE = 'Test response';
const TEST_PROMPT = TEST_PROVIDER_CONSTANTS.CHAT_MODEL_INVOKE;

jest.mock('@langchain/openai', () => ({
  ChatOpenAI: jest.fn().mockImplementation(() => ({
    invoke: jest.fn().mockResolvedValue(TEST_RESPONSE),
    stream: jest.fn().mockResolvedValue(['chunk1', 'chunk2']),
  })),
}));

describe('AI Providers Unit Tests', () => {
  describe('LangChainProvider', () => {
    const mockModel = {
      invoke: jest.fn().mockResolvedValue(TEST_RESPONSE),
      stream: jest.fn().mockResolvedValue(['chunk1', 'chunk2']),
    };

    test('Creates provider instance successfully', () => {
      const provider = new LangChainProvider(mockModel as unknown as BaseChatModel);
      expect(provider).toBeDefined();
    });

    test('Generates string response', async () => {
      const provider = new LangChainProvider(mockModel as unknown as BaseChatModel);
      const response = await provider.generate(TEST_PROMPT);
      
      expect(response).toBe(TEST_RESPONSE);
      expect(mockModel.invoke).toHaveBeenCalledWith(TEST_PROMPT, undefined);
    });

    test('Generates response with options', async () => {
      const provider = new LangChainProvider(mockModel as unknown as BaseChatModel);
      const options = { temperature: 0.5 };
      
      await provider.generate(TEST_PROMPT, options);
      expect(mockModel.invoke).toHaveBeenCalledWith(TEST_PROMPT, options);
    });

    test('Handles non-string response from model', async () => {
      const modelWithObject = {
        invoke: jest.fn().mockResolvedValue({ content: 'Response object' }),
      };
      
      const provider = new LangChainProvider(modelWithObject as unknown as BaseChatModel);
      const response = await provider.generate(TEST_PROMPT);
      
      expect(response).toBe('[object Object]');
    });

    test('Streams responses successfully', async () => {
      const provider = new LangChainProvider(mockModel as unknown as BaseChatModel);
      const stream = provider.stream?.(TEST_PROVIDER_CONSTANTS.CHAT_MODEL_INVOKE);
      
      expect(stream).toBeDefined();
      
      if (stream) {
        const chunks = [];
        for await (const chunk of stream) {
          chunks.push(chunk);
        }
        
        expect(chunks).toEqual(['chunk1', 'chunk2']);
        expect(mockModel.stream).toHaveBeenCalledWith(TEST_PROVIDER_CONSTANTS.CHAT_MODEL_INVOKE, undefined);
      }
    });

    test('Streams with options', async () => {
      const provider = new LangChainProvider(mockModel as unknown as BaseChatModel);
      const options = { temperature: 0.7 };
      
      const stream = provider.stream?.(TEST_PROVIDER_CONSTANTS.CHAT_MODEL_INVOKE, options);
      
      if (stream) {
              for await (const _chunk of stream) {
      }
        expect(mockModel.stream).toHaveBeenCalledWith(TEST_PROVIDER_CONSTANTS.CHAT_MODEL_INVOKE, options);
      }
    });

    test('Handles non-string chunks in stream', async () => {
      const modelWithObjectChunks = {
        stream: jest.fn().mockResolvedValue([
          { content: 'chunk1' },
          { content: 'chunk2' },
        ]),
      };
      
      const provider = new LangChainProvider(modelWithObjectChunks as unknown as BaseChatModel);
      const stream = provider.stream?.(TEST_PROVIDER_CONSTANTS.CHAT_MODEL_INVOKE);
      
      if (stream) {
        const chunks = [];
        for await (const chunk of stream) {
          chunks.push(chunk);
        }
        
        expect(chunks).toEqual(['[object Object]', '[object Object]']);
      }
    });

    test('Returns underlying model', () => {
      const provider = new LangChainProvider(mockModel as unknown as BaseChatModel);
      expect(provider.getModel()).toBe(mockModel);
    });

    test('Stream method exists', () => {
      const provider = new LangChainProvider(mockModel as unknown as BaseChatModel);
      expect(typeof provider.stream).toBe('function');
    });

    test('GetModel method exists', () => {
      const provider = new LangChainProvider(mockModel as unknown as BaseChatModel);
      expect(typeof provider.getModel).toBe('function');
    });
  });

  describe('Provider Interfaces', () => {
    test('VercelAIProvider interface has correct structure', () => {
      const mockVercelProvider: import('../../src/providers').VercelAIProvider = {
        generate: jest.fn(),
        stream: jest.fn(),
        getModel: jest.fn(),
        streamText: jest.fn(),
      };
      
      expect(typeof mockVercelProvider.generate).toBe('function');
      expect(typeof mockVercelProvider.streamText).toBe('function');
    });

    test('BAMLProvider interface has correct structure', () => {
      const mockBAMLProvider: import('../../src/providers').BAMLProvider = {
        generate: jest.fn(),
        stream: jest.fn(),
        getModel: jest.fn(),
        executeFunction: jest.fn(),
      };
      
      expect(typeof mockBAMLProvider.generate).toBe('function');
      expect(typeof mockBAMLProvider.executeFunction).toBe('function');
    });

    test('AIProvider base interface has correct structure', () => {
      const mockAIProvider: import('../../src/providers').AIProvider = {
        generate: jest.fn(),
      };
      
      expect(typeof mockAIProvider.generate).toBe('function');
    });
  });
});