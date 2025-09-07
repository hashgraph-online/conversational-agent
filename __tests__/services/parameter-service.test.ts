import { ParameterService } from '../../src/services/parameter-service';
import { EntityFormat } from '../../src/services/formatters';

const mockLogger = {
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
  log: jest.fn(),
};

jest.mock('@hashgraphonline/standards-sdk', () => ({
  NetworkType: {
    MAINNET: 'mainnet',
    TESTNET: 'testnet',
    PREVIEWNET: 'previewnet',
  },
  Logger: jest.fn().mockImplementation(() => mockLogger),
}));

import { NetworkType } from '@hashgraphonline/standards-sdk';

interface MockEntityAssociation {
  entityId: string;
  entityName: string;
  entityType: string;
  networkId?: string;
}

describe('ParameterService (moved)', () => {
  let parameterService: ParameterService;
  let mockFormatConverterRegistry: any;

  const mockEntities: MockEntityAssociation[] = [
    { entityId: '0.0.123456', entityName: 'MyAccount', entityType: 'accountId', networkId: '1' },
    { entityId: '0.0.123457', entityName: 'MyToken', entityType: 'tokenId', networkId: '1' },
    { entityId: '0.0.123458', entityName: 'MyTopic', entityType: 'topicId', networkId: '1' },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
    mockFormatConverterRegistry = {
      convertEntity: jest.fn().mockResolvedValue('converted-value'),
      getConverter: jest.fn(),
      hasConverter: jest.fn().mockReturnValue(true),
    };
    parameterService = new ParameterService(mockFormatConverterRegistry, NetworkType.TESTNET as any);
    (parameterService as any).logger = mockLogger;
  });

  test('constructs', () => {
    expect(parameterService).toBeInstanceOf(ParameterService);
  });

  describe('preprocessParameters', () => {
    test('no entities returns original', async () => {
      const parameters = { account: '0.0.123456', amount: '100' };
      const result = await parameterService.preprocessParameters('tool', parameters);
      expect(result).toEqual(parameters);
    });

    test('with entities and resolver', async () => {
      const parameters = { account: 'MyAccount', amount: '100' };
      const mockEntityResolver = {
        resolveReferences: jest.fn().mockImplementation((value: string) =>
          value === 'MyAccount' ? Promise.resolve('0.0.123456') : Promise.resolve(value)
        ),
      };

      (mockFormatConverterRegistry.convertEntity as jest.Mock).mockResolvedValue('0.0.123456');

      const result = await parameterService.preprocessParameters('tool', parameters, mockEntities as any, {
        entityResolver: mockEntityResolver,
        sessionId: 'test-session',
      });

      expect(mockEntityResolver.resolveReferences).toHaveBeenCalledWith('MyAccount', mockEntities);
      expect(result).toEqual({ account: '0.0.123456', amount: '100' });
    });

    test('array parameters', async () => {
      const parameters = { accounts: ['MyAccount', '0.0.123457'] } as Record<string, unknown>;
      const mockEntityResolver = { resolveReferences: jest.fn().mockResolvedValue('MyAccount') };
      (mockFormatConverterRegistry.convertEntity as jest.Mock).mockImplementation((id: string) => Promise.resolve(id));
      const result = await parameterService.preprocessParameters('tool', parameters, mockEntities as any, {
        entityResolver: mockEntityResolver as any,
      });
      expect(result).toEqual({ accounts: ['0.0.123456', '0.0.123457'] });
    });

    test('resolver errors are handled and fallback applied', async () => {
      const parameters = { account: 'MyAccount' };
      const mockEntityResolver = { resolveReferences: jest.fn().mockRejectedValue(new Error('Resolver failed')) };
      (mockFormatConverterRegistry.convertEntity as jest.Mock).mockResolvedValue('0.0.123456');
      const result = await parameterService.preprocessParameters('tool', parameters, mockEntities as any, {
        entityResolver: mockEntityResolver as any,
      });
      expect(result).toEqual({ account: '0.0.123456' });
    });
  });

  describe('attachToAgent', () => {
    test('attaches preprocessing callback to agent', () => {
      const mockAgent = { setParameterPreprocessingCallback: jest.fn() };
      const deps = {
        getSessionId: jest.fn().mockReturnValue('test-session'),
        getEntities: jest.fn().mockResolvedValue(mockEntities),
        entityResolver: { resolveReferences: jest.fn().mockResolvedValue('resolved') },
      };
      parameterService.attachToAgent(mockAgent, deps as any);
      expect(mockAgent.setParameterPreprocessingCallback).toHaveBeenCalled();
      expect(deps.getSessionId).toHaveBeenCalled();
      expect(deps.getEntities).toHaveBeenCalledWith('test-session');
    });

    test('handles underlying agent', () => {
      const underlying = { setParameterPreprocessingCallback: jest.fn() };
      const mockAgent = { getAgent: jest.fn().mockReturnValue(underlying) };
      parameterService.attachToAgent(mockAgent);
      expect(underlying.setParameterPreprocessingCallback).toHaveBeenCalled();
    });
  });

  describe('preprocessToolParameters', () => {
    test('skips when no entities', async () => {
      const parameters = { account: '0.0.123456' };
      const result = await parameterService.preprocessToolParameters('tool', parameters);
      expect(result).toEqual(parameters);
    });

    test('process string and array parameters', async () => {
      (mockFormatConverterRegistry.convertEntity as jest.Mock).mockImplementation((id: string) => Promise.resolve(`converted-${id}`));
      const parameters = { account: '0.0.123456', accounts: ['0.0.123456', '0.0.123457'] } as Record<string, unknown>;
      const result = await parameterService.preprocessToolParameters('tool', parameters, mockEntities as any);
      expect(result).toEqual({ account: 'converted-0.0.123456', accounts: ['converted-0.0.123456', 'converted-0.0.123457'] });
    });
  });

  describe('convertParameterEntities', () => {
    test('converts account entities to accountId', async () => {
      const parameterValue = 'Use MyAccount for this operation';
      const result = await parameterService.convertParameterEntities(parameterValue, [mockEntities[0]] as any, { account: 'accountId' });
      expect(result).toContain('Use');
    });

    test('regex escaping for special entity names', async () => {
      const special = { entityId: '0.0.123459', entityName: 'Special.Token+Name', entityType: EntityFormat.ACCOUNT_ID, createdAt: new Date() } as any;
      (mockFormatConverterRegistry.convertEntity as jest.Mock).mockResolvedValue('0.0.123459');
      const result = await parameterService.convertParameterEntities('Use Special.Token+Name here', [special], { account: 'accountId' });
      expect(result).toBe('Use 0.0.123459 here');
    });
  });
});

