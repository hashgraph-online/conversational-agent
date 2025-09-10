import { ParameterService } from '../../src/services/parameter-service';
import { EntityFormat } from '../../src/services/formatters';
import { NetworkType } from '@hashgraphonline/standards-sdk';

jest.mock('@hashgraphonline/standards-sdk', () => ({
  NetworkType: {
    TESTNET: 'testnet',
    MAINNET: 'mainnet'
  },
  Logger: jest.fn().mockImplementation(() => ({
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn()
  }))
}));

describe('ParameterService - Comprehensive (moved)', () => {
  let parameterService: ParameterService;
  let mockFormatConverterRegistry: any;

  beforeEach(() => {
    jest.clearAllMocks();

    mockFormatConverterRegistry = {
      convertEntity: jest.fn(),
      register: jest.fn(),
      getRegisteredConverters: jest.fn().mockReturnValue(['converter1'])
    };

    parameterService = new ParameterService(mockFormatConverterRegistry, 'testnet');
  });

  describe('preprocessParameters', () => {
    test('returns original parameters when no entities provided', async () => {
      const parameters = { name: 'test', value: '123' };
      const result = await parameterService.preprocessParameters('test-tool', parameters);
      expect(result).toEqual(parameters);
    });

    test('process parameters with AI entity resolver', async () => {
      const parameters = { topic: 'my-topic', account: 'my-account' };
      const entities = [
        { entityId: '0.0.123456', entityName: 'my-topic', entityType: 'topicId', transactionId: 'tx-123' },
        { entityId: '0.0.789012', entityName: 'my-account', entityType: 'accountId', transactionId: 'tx-456' }
      ];
      const mockEntityResolver = {
        resolveReferences: jest.fn().mockImplementation(async (message: string) => {
          if (message === 'my-topic') return '0.0.123456';
          if (message === 'my-account') return '0.0.789012';
          return message;
        })
      };
      mockFormatConverterRegistry.convertEntity
        .mockResolvedValueOnce('topic-123456-hrl')
        .mockResolvedValueOnce('account-789012-hrl');
      const result = await parameterService.preprocessParameters('test-tool', parameters, entities as any, {
        entityResolver: mockEntityResolver,
        preferences: { topic: 'hrl', account: 'hrl' }
      });
      expect(result.topic).toBe('topic-123456-hrl');
      expect(result.account).toBe('account-789012-hrl');
    });

    test('handles mixed parameter types', async () => {
      const parameters = { topic: 'my-topic', number: 123, boolean: true, array: ['item1'], object: { nested: 'value' } } as any;
      const entities = [{ entityId: '0.0.123456', entityName: 'my-topic', entityType: 'topicId', transactionId: 'tx-123' }];
      mockFormatConverterRegistry.convertEntity.mockResolvedValue('converted-topic');
      const result = await parameterService.preprocessParameters('test-tool', parameters, entities as any, { preferences: { topic: 'hrl' } });
      expect(result.topic).toBe('converted-topic');
      expect(result.number).toBe(123);
      expect(result.boolean).toBe(true);
      expect(result.array).toEqual(['item1']);
      expect(result.object).toEqual({ nested: 'value' });
    });
  });

  describe('preprocessToolParameters', () => {
    test('returns original parameters when no entities provided', async () => {
      const parameters = { name: 'test', value: '123' };
      const result = await parameterService.preprocessToolParameters('test-tool', parameters);
      expect(result).toEqual(parameters);
    });

    test('converts entity references in string parameters', async () => {
      const parameters = { topic: 'Use my-topic for inscription', account: 'Transfer to my-account' } as any;
      const entities = [
        { entityId: '0.0.123456', entityName: 'my-topic', entityType: 'topicId', transactionId: 'tx-123' },
        { entityId: '0.0.789012', entityName: 'my-account', entityType: 'accountId', transactionId: 'tx-456' }
      ];
      mockFormatConverterRegistry.convertEntity
        .mockResolvedValueOnce('topic-123456-hrl')
        .mockResolvedValueOnce('account-789012-hrl');
      const result = await parameterService.preprocessToolParameters('test-tool', parameters, entities as any, 'session-123');
      expect(result.topic).toBe('Use topic-123456-hrl for inscription');
      expect(result.account).toBe('Transfer to account-789012-hrl');
    });

    test('converts entity references in array parameters', async () => {
      const parameters = { topics: ['my-topic', 'other-topic'], accounts: ['my-account', 'other-account'] } as any;
      const entities = [
        { entityId: '0.0.123456', entityName: 'my-topic', entityType: 'topicId', transactionId: 'tx-123' },
        { entityId: '0.0.789012', entityName: 'my-account', entityType: 'accountId', transactionId: 'tx-456' }
      ];
      mockFormatConverterRegistry.convertEntity
        .mockResolvedValueOnce('topic-123456-hrl')
        .mockResolvedValueOnce('account-789012-hrl');
      const result = await parameterService.preprocessToolParameters('test-tool', parameters, entities as any);
      expect(result.topics).toEqual(['topic-123456-hrl', 'other-topic']);
      expect(result.accounts).toEqual(['account-789012-hrl', 'other-account']);
    });
  });

  describe('convertParameterEntities', () => {
    test('convert topic ID by preferences', async () => {
      const parameterValue = 'Use my-topic for inscription';
      const entities = [{ entityId: '0.0.123456', entityName: 'my-topic', entityType: 'topicId', transactionId: 'tx-123' }];
      mockFormatConverterRegistry.convertEntity.mockResolvedValue('topic-123456-hrl');
      const result = await parameterService.convertParameterEntities(parameterValue, entities as any, { topic: 'hrl' });
      expect(result).toBe('Use topic-123456-hrl for inscription');
    });

    test('convert token and account based on preferences', async () => {
      const parameterValue = 'Transfer my-token from my-account to other-account';
      const entities = [
        { entityId: '0.0.111111', entityName: 'my-token', entityType: 'tokenId', transactionId: 'tx-1' },
        { entityId: '0.0.222222', entityName: 'my-account', entityType: 'accountId', transactionId: 'tx-2' },
        { entityId: '0.0.333333', entityName: 'other-account', entityType: 'accountId', transactionId: 'tx-3' },
      ];
      mockFormatConverterRegistry.convertEntity
        .mockResolvedValueOnce('TOKEN_SYMBOL')
        .mockResolvedValueOnce('account-222222-alias')
        .mockResolvedValueOnce('account-333333-alias');
      const result = await parameterService.convertParameterEntities(parameterValue, entities as any, {
        token: 'symbol', account: 'alias', supplyKey: 'accountId', adminKey: 'accountId'
      });
      expect(result).toBe('Transfer TOKEN_SYMBOL from account-222222-alias to account-333333-alias');
    });
  });
});

