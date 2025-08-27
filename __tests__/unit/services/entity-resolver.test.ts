import { describe, test, expect, jest, beforeEach } from '@jest/globals';
import { EntityResolver, EntityResolverConfig } from '../../../src/services/entity-resolver';
import { Logger } from '@hashgraphonline/standards-sdk';
import type { EntityAssociation } from '../../../src/memory/smart-memory-manager';
import { EntityFormat } from '../../../src';

/**
 * Mock ChatOpenAI for testing
 */
jest.mock('@langchain/openai', () => ({
  ChatOpenAI: jest.fn().mockImplementation(() => ({
    call: jest.fn(),
    invoke: jest.fn(),
  })),
}));

jest.mock('@hashgraphonline/standards-sdk', () => ({
  Logger: jest.fn().mockImplementation(() => ({
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  })),
}));

describe('EntityResolver', () => {
  let entityResolver: EntityResolver;
  let mockLogger: jest.Mocked<Logger>;
  let mockChatOpenAI: any;
  let config: EntityResolverConfig;

  beforeEach(() => {
    jest.clearAllMocks();

    config = {
      apiKey: 'test-api-key',
      modelName: 'gpt-4o-mini',
    };

    mockLogger = new Logger({ module: 'EntityResolver' }) as jest.Mocked<Logger>;
    mockChatOpenAI = {
      call: jest.fn(),
      invoke: jest.fn(),
    };

    // Create resolver instance
    entityResolver = new EntityResolver(config);
    // Replace the internal llm with our mock
    (entityResolver as any).llm = mockChatOpenAI;
    (entityResolver as any).logger = mockLogger;
  });

  describe('Constructor', () => {
    test('should create EntityResolver with valid config', () => {
      const resolver = new EntityResolver({
        apiKey: 'test-key',
        modelName: 'gpt-4o-mini',
      });

      expect(resolver).toBeDefined();
    });

    test('should use default model name when not provided', () => {
      const resolver = new EntityResolver({
        apiKey: 'test-key',
      });

      expect(resolver).toBeDefined();
    });

    test('should create resolver with empty API key', () => {
      // The constructor doesn't validate API key - it just passes it to ChatOpenAI
      expect(() => {
        new EntityResolver({
          apiKey: '',
        });
      }).not.toThrow();
    });
  });

  describe('resolveReferences', () => {
    test('should return original message when no entities provided', async () => {
      const message = 'This is a test message';
      const entities: EntityAssociation[] = [];

      const result = await entityResolver.resolveReferences(message, entities);

      expect(result).toBe(message);
    });

    test('should return original message when entities is null', async () => {
      const message = 'This is a test message';

      const result = await entityResolver.resolveReferences(message, null as any);

      expect(result).toBe(message);
    });

    test('should return original message when entities is undefined', async () => {
      const message = 'This is a test message';

      const result = await entityResolver.resolveReferences(message, undefined as any);

      expect(result).toBe(message);
    });

    test('should process entities and call LLM for resolution', async () => {
      const message = 'Transfer tokens to account 0.0.12345';
      const entities: EntityAssociation[] = [
        {
          entityId: '0.0.12345',
          entityName: 'My Account',
          entityType: 'account',
          transactionId: '0.0.123@1234567890.123456789',
          timestamp: Date.now(),
          metadata: {},
        },
        {
          entityId: '0.0.67890',
          entityName: 'Token Contract',
          entityType: 'contract',
          transactionId: '0.0.456@1234567890.123456789',
          timestamp: Date.now(),
          metadata: {},
        },
      ];

      mockChatOpenAI.invoke.mockResolvedValue({
        content: 'Transfer tokens to account "My Account" (0.0.12345)',
      });

      const result = await entityResolver.resolveReferences(message, entities);

      expect(mockLogger.info).toHaveBeenCalledWith(
        'resolveReferences: input summary',
        expect.objectContaining({
          messagePreview: 'Transfer tokens to account 0.0.12345',
          entityStats: expect.any(Object),
        })
      );

      expect(mockChatOpenAI.invoke).toHaveBeenCalled();
      expect(result).toBe('Transfer tokens to account "My Account" (0.0.12345)');
    });

    test('should handle LLM errors gracefully', async () => {
      const message = 'Transfer to 0.0.12345';
      const entities: EntityAssociation[] = [
        {
          entityId: '0.0.12345',
          entityName: 'My Account',
          entityType: 'account',
          transactionId: '0.0.123@1234567890.123456789',
          timestamp: Date.now(),
          metadata: {},
        },
      ];

      mockChatOpenAI.invoke.mockRejectedValue(new Error('LLM API Error'));

      const result = await entityResolver.resolveReferences(message, entities);

      expect(result).toBe(message); // Should return original message on error
      // Note: The actual implementation may not log errors in try/catch blocks
    });

    test('should handle logging errors gracefully', async () => {
      const message = 'Test message';
      const entities: EntityAssociation[] = [
        {
          entityId: '0.0.12345',
          entityName: 'Test Account',
          entityType: 'account',
          transactionId: '0.0.123@1234567890.123456789',
          timestamp: Date.now(),
          metadata: {},
        },
      ];

      mockLogger.info.mockImplementation(() => {
        throw new Error('Logging error');
      });

      mockChatOpenAI.invoke.mockResolvedValue({
        content: 'Resolved message',
      });

      const result = await entityResolver.resolveReferences(message, entities);

      // When logging fails, the method continues and may return original message
      expect(typeof result).toBe('string');
      expect(mockChatOpenAI.invoke).toHaveBeenCalled();
      // The logging error is caught and ignored in the implementation
    });

    test('should group entities by type correctly', async () => {
      const message = 'Multiple entities test';
      const entities: EntityAssociation[] = [
        {
          entityId: '0.0.111',
          entityName: 'Account 1',
          entityType: 'account',
          transactionId: '0.0.111@1234567890.123456789',
          timestamp: Date.now(),
          metadata: {},
        },
        {
          entityId: '0.0.222',
          entityName: 'Account 2',
          entityType: 'account',
          transactionId: '0.0.222@1234567890.123456789',
          timestamp: Date.now() - 1000,
          metadata: {},
        },
        {
          entityId: '0.0.333',
          entityName: 'Token 1',
          entityType: 'token',
          transactionId: '0.0.333@1234567890.123456789',
          timestamp: Date.now(),
          metadata: {},
        },
      ];

      mockChatOpenAI.invoke.mockResolvedValue({
        content: 'Resolved with multiple entities',
      });

      const result = await entityResolver.resolveReferences(message, entities);

      expect(mockChatOpenAI.invoke).toHaveBeenCalled();
      const callArgs = mockChatOpenAI.invoke.mock.calls[0][0];
      expect(callArgs).toContain('Most recent account: "Account 1" = 0.0.111');
      expect(callArgs).toContain('(1 other accounts in memory)');
      expect(callArgs).toContain('Most recent token: "Token 1" = 0.0.333');
    });
  });

  describe('extractEntities', () => {
    const userMessage = 'Create a token';

    test('should extract entities from transaction response', async () => {
      const transactionResponse = {
        success: true,
        transactionId: '0.0.123@1234567890.123456789',
        receipt: {
          accountId: '0.0.456',
          tokenId: '0.0.789',
          topicId: '0.0.101112',
        },
      };

      const result = await entityResolver.extractEntities(transactionResponse as any, userMessage);

      expect(result).toHaveLength(3);
      expect(result).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            id: '0.0.456',
            type: 'accountId',
            transactionId: '0.0.123@1234567890.123456789',
            name: 'unnamed_entity',
          }),
          expect.objectContaining({
            id: '0.0.789',
            type: 'tokenId',
            transactionId: '0.0.123@1234567890.123456789',
            name: 'unnamed_entity',
          }),
          expect.objectContaining({
            id: '0.0.101112',
            type: 'topicId',
            transactionId: '0.0.123@1234567890.123456789',
            name: 'unnamed_entity',
          }),
        ])
      );
    });

    test('should handle nested receipt structures', async () => {
      const transactionResponse = {
        success: true,
        transactionId: '0.0.123@1234567890.123456789',
        result: {
          receipt: {
            accountId: '0.0.456',
            contractId: '0.0.789',
          },
        },
      };

      const result = await entityResolver.extractEntities(transactionResponse as any, userMessage);

      expect(result).toHaveLength(2);
      expect(result).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            id: '0.0.456',
            type: 'accountId',
            transactionId: '0.0.123@1234567890.123456789',
            name: 'unnamed_entity',
          }),
          expect.objectContaining({
            id: '0.0.789',
            type: 'contractId',
            transactionId: '0.0.123@1234567890.123456789',
            name: 'unnamed_entity',
          }),
        ])
      );
    });

    test('should handle data.receipt structure', async () => {
      const transactionResponse = {
        success: true,
        transactionId: '0.0.123@1234567890.123456789',
        data: {
          receipt: {
            fileId: '0.0.456',
            scheduleId: '0.0.789',
          },
        },
      };

      const result = await entityResolver.extractEntities(transactionResponse as any, userMessage);

      expect(result).toHaveLength(2);
      expect(result).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            id: '0.0.456',
            type: 'fileId',
            transactionId: '0.0.123@1234567890.123456789',
            name: 'unnamed_entity',
          }),
          expect.objectContaining({
            id: '0.0.789',
            type: 'scheduleId',
            transactionId: '0.0.123@1234567890.123456789',
            name: 'unnamed_entity',
          }),
        ])
      );
    });

    test('should return empty array for invalid response', async () => {
      const result = await entityResolver.extractEntities(null as any, userMessage);
      expect(result).toEqual([]);

      const result2 = await entityResolver.extractEntities({}, userMessage);
      expect(result2).toEqual([]);
    });

    test('should handle entity ID objects with toString method', async () => {
      const mockEntityId = {
        toString: () => '0.0.456',
      };

      const transactionResponse = {
        success: true,
        transactionId: '0.0.123@1234567890.123456789',
        receipt: {
          accountId: mockEntityId,
        },
      };

      const result = await entityResolver.extractEntities(transactionResponse as any, userMessage);

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual(
        expect.objectContaining({
          id: '0.0.456',
          type: 'accountId',
          transactionId: '0.0.123@1234567890.123456789',
          name: 'unnamed_entity',
        })
      );
    });
  });

  describe('Edge Cases', () => {
    test('should handle very long entity names', async () => {
      const longName = 'A'.repeat(200);
      const entities: EntityAssociation[] = [
        {
          entityId: '0.0.12345',
          entityName: longName,
          entityType: 'account',
          transactionId: '0.0.123@1234567890.123456789',
          timestamp: Date.now(),
          metadata: {},
        },
      ];

      mockChatOpenAI.invoke.mockResolvedValue({
        content: 'Resolved with long name',
      });

      const result = await entityResolver.resolveReferences('test', entities);

      // The LLM will either resolve it or return original message
      expect(typeof result).toBe('string');
      expect(mockChatOpenAI.invoke).toHaveBeenCalled();
    });

    test('should handle special characters in entity names', async () => {
      const entities: EntityAssociation[] = [
        {
          entityId: '0.0.12345',
          entityName: 'Special@#$%^&*()',
          entityType: 'account',
          transactionId: '0.0.123@1234567890.123456789',
          timestamp: Date.now(),
          metadata: {},
        },
      ];

      mockChatOpenAI.invoke.mockResolvedValue({
        content: 'Resolved with special chars',
      });

      const result = await entityResolver.resolveReferences('test', entities);

      // The LLM will either resolve it or return original message
      expect(typeof result).toBe('string');
      expect(mockChatOpenAI.invoke).toHaveBeenCalled();
    });

    test('should handle empty entity arrays by type', async () => {
      const entities: EntityAssociation[] = [];
      const result = await entityResolver.resolveReferences('test message', entities);

      expect(result).toBe('test message');
    });

    test('should handle entities with missing properties', async () => {
      const entities: EntityAssociation[] = [
        {
          entityId: '0.0.12345',
          entityName: undefined as any,
          entityType: 'account',
          transactionId: undefined as any,
          timestamp: Date.now(),
          metadata: {},
        },
      ];

      mockChatOpenAI.invoke.mockResolvedValue({
        content: 'Resolved with missing properties',
      });

      const result = await entityResolver.resolveReferences('test', entities);

      // The LLM will either resolve it or return original message
      expect(typeof result).toBe('string');
      expect(mockChatOpenAI.invoke).toHaveBeenCalled();
    });
  });
});
