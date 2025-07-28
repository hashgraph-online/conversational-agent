import { describe, test, expect, vi } from 'vitest';
import { LangChainProvider } from '../../src/providers';

vi.mock('@langchain/openai', () => ({
  ChatOpenAI: vi.fn().mockImplementation(() => ({
    invoke: vi.fn().mockResolvedValue('Test response'),
    stream: vi.fn().mockResolvedValue(['chunk1', 'chunk2']),
  })),
}));

describe('AI Providers Unit Tests', () => {
  describe('LangChainProvider', () => {
    const mockModel = {
      invoke: vi.fn().mockResolvedValue('Test response'),
      stream: vi.fn().mockResolvedValue(['chunk1', 'chunk2']),
    };

    test('Creates provider instance successfully', () => {
      const provider = new LangChainProvider(mockModel as any);
      expect(provider).toBeDefined();
    });

    test('Generates string response', async () => {
      const provider = new LangChainProvider(mockModel as any);
      const response = await provider.generate('test prompt');
      
      expect(response).toBe('Test response');
      expect(mockModel.invoke).toHaveBeenCalledWith('test prompt', undefined);
    });

    test('Generates response with options', async () => {
      const provider = new LangChainProvider(mockModel as any);
      const options = { temperature: 0.5 };
      
      await provider.generate('test prompt', options);
      expect(mockModel.invoke).toHaveBeenCalledWith('test prompt', options);
    });

    test('Handles non-string response from model', async () => {
      const modelWithObject = {
        invoke: vi.fn().mockResolvedValue({ content: 'Response object' }),
      };
      
      const provider = new LangChainProvider(modelWithObject as any);
      const response = await provider.generate('test prompt');
      
      expect(response).toBe('[object Object]');
    });

    test('Streams responses successfully', async () => {
      const provider = new LangChainProvider(mockModel as any);
      const stream = provider.stream?.('test prompt');
      
      expect(stream).toBeDefined();
      
      if (stream) {
        const chunks = [];
        for await (const chunk of stream) {
          chunks.push(chunk);
        }
        
        expect(chunks).toEqual(['chunk1', 'chunk2']);
        expect(mockModel.stream).toHaveBeenCalledWith('test prompt', undefined);
      }
    });

    test('Streams with options', async () => {
      const provider = new LangChainProvider(mockModel as any);
      const options = { temperature: 0.7 };
      
      const stream = provider.stream?.('test prompt', options);
      
      if (stream) {
              for await (const chunk of stream) {
      }
        expect(mockModel.stream).toHaveBeenCalledWith('test prompt', options);
      }
    });

    test('Handles non-string chunks in stream', async () => {
      const modelWithObjectChunks = {
        stream: vi.fn().mockResolvedValue([
          { content: 'chunk1' },
          { content: 'chunk2' },
        ]),
      };
      
      const provider = new LangChainProvider(modelWithObjectChunks as any);
      const stream = provider.stream?.('test prompt');
      
      if (stream) {
        const chunks = [];
        for await (const chunk of stream) {
          chunks.push(chunk);
        }
        
        expect(chunks).toEqual(['[object Object]', '[object Object]']);
      }
    });

    test('Returns underlying model', () => {
      const provider = new LangChainProvider(mockModel as any);
      expect(provider.getModel()).toBe(mockModel);
    });

    test('Stream method exists', () => {
      const provider = new LangChainProvider(mockModel as any);
      expect(typeof provider.stream).toBe('function');
    });

    test('GetModel method exists', () => {
      const provider = new LangChainProvider(mockModel as any);
      expect(typeof provider.getModel).toBe('function');
    });
  });

  describe('Provider Interfaces', () => {
    test('VercelAIProvider interface has correct structure', () => {
      // This is a compile-time test - if it compiles, the interface is correct
      const mockVercelProvider: import('../../src/providers').VercelAIProvider = {
        generate: vi.fn(),
        stream: vi.fn(),
        getModel: vi.fn(),
        streamText: vi.fn(),
      };
      
      expect(typeof mockVercelProvider.generate).toBe('function');
      expect(typeof mockVercelProvider.streamText).toBe('function');
    });

    test('BAMLProvider interface has correct structure', () => {
      // This is a compile-time test - if it compiles, the interface is correct
      const mockBAMLProvider: import('../../src/providers').BAMLProvider = {
        generate: vi.fn(),
        stream: vi.fn(),
        getModel: vi.fn(),
        executeFunction: vi.fn(),
      };
      
      expect(typeof mockBAMLProvider.generate).toBe('function');
      expect(typeof mockBAMLProvider.executeFunction).toBe('function');
    });

    test('AIProvider base interface has correct structure', () => {
      // This is a compile-time test - if it compiles, the interface is correct
      const mockAIProvider: import('../../src/providers').AIProvider = {
        generate: vi.fn(),
      };
      
      expect(typeof mockAIProvider.generate).toBe('function');
    });
  });
});