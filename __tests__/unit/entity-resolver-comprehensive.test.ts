import { EntityResolver } from '../../src/services/entity-resolver';
import { Logger } from '@hashgraphonline/standards-sdk';
import { FormatConverterRegistry } from '../../src/services/formatters/format-converter-registry';

jest.mock('@hashgraphonline/standards-sdk');
jest.mock('../../src/services/formatters/format-converter-registry');

const mockLogger = jest.mocked(Logger);
const mockFormatConverterRegistry = jest.mocked(FormatConverterRegistry);

describe('EntityResolver', () => {
  let entityResolver: EntityResolver;
  let mockContext: any;
  let mockRegistry: any;

  beforeEach(() => {
    jest.clearAllMocks();

    mockContext = {
      setFromFormat: jest.fn(),
      setToFormat: jest.fn(),
      setEntityId: jest.fn(),
      setMetadata: jest.fn(),
      getFromFormat: jest.fn().mockReturnValue('hedera-id'),
      getToFormat: jest.fn().mockReturnValue('hrl'),
      getEntityId: jest.fn().mockReturnValue('0.0.123'),
      getMetadata: jest.fn().mockReturnValue({}),
    };

    mockRegistry = {
      convert: jest.fn().mockResolvedValue({
        success: true,
        result: 'hrl://mainnet/0.0.123',
        metadata: { type: 'account', network: 'mainnet' },
      }),
      getConverter: jest.fn().mockReturnValue({ convert: jest.fn() }),
      hasConverter: jest.fn().mockReturnValue(true),
      listConverters: jest.fn().mockReturnValue([]),
    };

    mockFormatConverterRegistry.mockImplementation(() => mockRegistry);

    entityResolver = new EntityResolver({ apiKey: 'test-api-key' });
  });

  describe('Constructor', () => {
    it('should create instance with logger', () => {
      expect(entityResolver).toBeInstanceOf(EntityResolver);
      expect(mockLogger).toHaveBeenCalledWith({
        module: 'EntityResolver',
      });
    });

    it('should initialize with format converter registry', () => {
      expect(mockFormatConverterRegistry).toHaveBeenCalled();
    });
  });
});