import { ParameterService } from '../../src/services/parameter-service';
import { EntityFormat } from '../../src/services/formatters';

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

describe('ParameterService - Core Functionality (moved simple)', () => {
  let parameterService: ParameterService;
  let mockFormatConverterRegistry: any;

  beforeEach(() => {
    jest.clearAllMocks();

    mockFormatConverterRegistry = {
      convertEntity: jest.fn(),
      register: jest.fn(),
      getRegisteredConverters: jest.fn().mockReturnValue(['converter1'])
    };

    const { NetworkType } = require('@hashgraphonline/standards-sdk');
    parameterService = new ParameterService(mockFormatConverterRegistry, NetworkType.TESTNET);
  });

  test('should return original parameters when no entities provided', async () => {
    const parameters = { name: 'test', value: '123' };
    const result = await parameterService.preprocessParameters('test-tool', parameters);
    expect(result).toEqual(parameters);
  });

  test('should process parameters with AI entity resolver', async () => {
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

    const result = await parameterService.preprocessParameters(
      'test-tool',
      parameters,
      entities as any,
      { entityResolver: mockEntityResolver, preferences: { topic: 'hrl', account: 'hrl' } }
    );

    expect(result.topic).toBe('topic-123456-hrl');
    expect(result.account).toBe('account-789012-hrl');
  });
});
