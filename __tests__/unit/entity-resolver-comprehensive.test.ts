import { EntityResolver } from '../../src/services/entity-resolver';
import { Logger } from '@hashgraphonline/standards-sdk';
import { ResolutionContext } from '../../src/services/context/resolution-context';
import { FormatConverterRegistry } from '../../src/services/formatters/format-converter-registry';
import type { ResolutionResult, EntityMetadata } from '../../src/services/formatters/types';

jest.mock('@hashgraphonline/standards-sdk');
jest.mock('../../src/services/context/resolution-context');
jest.mock('../../src/services/formatters/format-converter-registry');

const mockLogger = jest.mocked(Logger);
const mockResolutionContext = jest.mocked(ResolutionContext);
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

    mockResolutionContext.mockImplementation(() => mockContext);
    mockFormatConverterRegistry.mockImplementation(() => mockRegistry);

    entityResolver = new EntityResolver();
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

  describe('resolveEntity', () => {
    it('should resolve entity successfully', async () => {
      const result = await entityResolver.resolveEntity(
        '0.0.123',
        'hedera-id',
        'hrl'
      );

      expect(result).toEqual({
        success: true,
        result: 'hrl://mainnet/0.0.123',
        metadata: { type: 'account', network: 'mainnet' },
      });
      expect(mockContext.setEntityId).toHaveBeenCalledWith('0.0.123');
      expect(mockContext.setFromFormat).toHaveBeenCalledWith('hedera-id');
      expect(mockContext.setToFormat).toHaveBeenCalledWith('hrl');
      expect(mockRegistry.convert).toHaveBeenCalledWith(
        '0.0.123',
        'hedera-id',
        'hrl',
        mockContext
      );
    });

    it('should resolve with optional metadata', async () => {
      const metadata = { customField: 'value' };

      await entityResolver.resolveEntity(
        '0.0.456',
        'hrl',
        'hedera-id',
        metadata
      );

      expect(mockContext.setMetadata).toHaveBeenCalledWith(metadata);
    });

    it('should handle resolution failure', async () => {
      mockRegistry.convert.mockResolvedValue({
        success: false,
        error: 'Conversion failed',
      });

      const result = await entityResolver.resolveEntity(
        'invalid-id',
        'hedera-id',
        'hrl'
      );

      expect(result).toEqual({
        success: false,
        error: 'Conversion failed',
      });
    });

    it('should handle registry errors', async () => {
      const error = new Error('Registry error');
      mockRegistry.convert.mockRejectedValue(error);

      const result = await entityResolver.resolveEntity(
        '0.0.123',
        'hedera-id',
        'hrl'
      );

      expect(result).toEqual({
        success: false,
        error: 'Registry error',
      });
    });
  });

  describe('validateFormat', () => {
    it('should validate supported format', () => {
      mockRegistry.hasConverter.mockReturnValue(true);

      const result = entityResolver.validateFormat('hedera-id');

      expect(result).toBe(true);
      expect(mockRegistry.hasConverter).toHaveBeenCalledWith('hedera-id', undefined);
    });

    it('should validate unsupported format', () => {
      mockRegistry.hasConverter.mockReturnValue(false);

      const result = entityResolver.validateFormat('unsupported-format');

      expect(result).toBe(false);
    });

    it('should validate with target format', () => {
      mockRegistry.hasConverter.mockReturnValue(true);

      const result = entityResolver.validateFormat('hedera-id', 'hrl');

      expect(result).toBe(true);
      expect(mockRegistry.hasConverter).toHaveBeenCalledWith('hedera-id', 'hrl');
    });
  });

  describe('getSupportedFormats', () => {
    it('should return supported formats', () => {
      const formats = ['hedera-id', 'hrl', 'topic-id'];
      mockRegistry.listConverters.mockReturnValue(formats);

      const result = entityResolver.getSupportedFormats();

      expect(result).toEqual(formats);
      expect(mockRegistry.listConverters).toHaveBeenCalled();
    });

    it('should return empty array when no formats supported', () => {
      mockRegistry.listConverters.mockReturnValue([]);

      const result = entityResolver.getSupportedFormats();

      expect(result).toEqual([]);
    });
  });

  describe('detectEntityType', () => {
    it('should detect Hedera account ID', () => {
      const result = entityResolver.detectEntityType('0.0.123');

      expect(result).toBe('hedera-account-id');
    });

    it('should detect Hedera topic ID', () => {
      const result = entityResolver.detectEntityType('0.0.456');

      expect(result).toBe('hedera-topic-id');
    });

    it('should detect Hedera token ID', () => {
      const result = entityResolver.detectEntityType('0.0.789');

      expect(result).toBe('hedera-token-id');
    });

    it('should detect HRL format', () => {
      const result = entityResolver.detectEntityType('hrl://mainnet/0.0.123');

      expect(result).toBe('hrl');
    });

    it('should detect URL format', () => {
      const result = entityResolver.detectEntityType('https://example.com');

      expect(result).toBe('url');
    });

    it('should detect file path format', () => {
      const result = entityResolver.detectEntityType('/path/to/file.txt');

      expect(result).toBe('file-path');
    });

    it('should detect IPFS hash', () => {
      const result = entityResolver.detectEntityType('QmXoypizjW3WknFiJnKLwHCnL72vedxjQkDDP1mXWo6uco');

      expect(result).toBe('ipfs-hash');
    });

    it('should return unknown for unrecognized format', () => {
      const result = entityResolver.detectEntityType('random-string-123');

      expect(result).toBe('unknown');
    });

    it('should handle empty string', () => {
      const result = entityResolver.detectEntityType('');

      expect(result).toBe('unknown');
    });

    it('should handle null input', () => {
      const result = entityResolver.detectEntityType(null as any);

      expect(result).toBe('unknown');
    });

    it('should handle undefined input', () => {
      const result = entityResolver.detectEntityType(undefined as any);

      expect(result).toBe('unknown');
    });
  });

  describe('normalizeEntity', () => {
    it('should normalize Hedera ID by trimming whitespace', () => {
      const result = entityResolver.normalizeEntity('  0.0.123  ', 'hedera-id');

      expect(result).toBe('0.0.123');
    });

    it('should normalize HRL by trimming and lowercasing', () => {
      const result = entityResolver.normalizeEntity('  HRL://MAINNET/0.0.123  ', 'hrl');

      expect(result).toBe('hrl://mainnet/0.0.123');
    });

    it('should normalize URL by trimming', () => {
      const result = entityResolver.normalizeEntity('  https://example.com  ', 'url');

      expect(result).toBe('https://example.com');
    });

    it('should normalize unknown format by trimming', () => {
      const result = entityResolver.normalizeEntity('  random-string  ', 'unknown');

      expect(result).toBe('random-string');
    });

    it('should handle empty string', () => {
      const result = entityResolver.normalizeEntity('', 'hedera-id');

      expect(result).toBe('');
    });
  });

  describe('isValidHederaId', () => {
    it('should validate correct Hedera ID format', () => {
      expect(entityResolver.isValidHederaId('0.0.123')).toBe(true);
      expect(entityResolver.isValidHederaId('1.2.3456789')).toBe(true);
      expect(entityResolver.isValidHederaId('99.99.999999')).toBe(true);
    });

    it('should reject invalid Hedera ID formats', () => {
      expect(entityResolver.isValidHederaId('0.0')).toBe(false);
      expect(entityResolver.isValidHederaId('0.0.0.0')).toBe(false);
      expect(entityResolver.isValidHederaId('a.b.c')).toBe(false);
      expect(entityResolver.isValidHederaId('123')).toBe(false);
      expect(entityResolver.isValidHederaId('')).toBe(false);
    });
  });

  describe('isValidHRL', () => {
    it('should validate correct HRL format', () => {
      expect(entityResolver.isValidHRL('hrl://mainnet/0.0.123')).toBe(true);
      expect(entityResolver.isValidHRL('hrl://testnet/0.0.456')).toBe(true);
      expect(entityResolver.isValidHRL('hrl://previewnet/0.0.789')).toBe(true);
    });

    it('should reject invalid HRL formats', () => {
      expect(entityResolver.isValidHRL('hrl://invalidnet/0.0.123')).toBe(false);
      expect(entityResolver.isValidHRL('hrl://mainnet/invalid-id')).toBe(false);
      expect(entityResolver.isValidHRL('http://mainnet/0.0.123')).toBe(false);
      expect(entityResolver.isValidHRL('hrl:mainnet/0.0.123')).toBe(false);
      expect(entityResolver.isValidHRL('')).toBe(false);
    });
  });

  describe('batchResolve', () => {
    it('should resolve multiple entities successfully', async () => {
      mockRegistry.convert
        .mockResolvedValueOnce({
          success: true,
          result: 'hrl://mainnet/0.0.123',
          metadata: { type: 'account' },
        })
        .mockResolvedValueOnce({
          success: true,
          result: 'hrl://mainnet/0.0.456',
          metadata: { type: 'topic' },
        });

      const entities = ['0.0.123', '0.0.456'];
      const result = await entityResolver.batchResolve(
        entities,
        'hedera-id',
        'hrl'
      );

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        success: true,
        result: 'hrl://mainnet/0.0.123',
        metadata: { type: 'account' },
      });
      expect(result[1]).toEqual({
        success: true,
        result: 'hrl://mainnet/0.0.456',
        metadata: { type: 'topic' },
      });
    });

    it('should handle mixed success/failure in batch', async () => {
      mockRegistry.convert
        .mockResolvedValueOnce({
          success: true,
          result: 'hrl://mainnet/0.0.123',
        })
        .mockResolvedValueOnce({
          success: false,
          error: 'Invalid entity',
        });

      const entities = ['0.0.123', 'invalid'];
      const result = await entityResolver.batchResolve(
        entities,
        'hedera-id',
        'hrl'
      );

      expect(result).toHaveLength(2);
      expect(result[0].success).toBe(true);
      expect(result[1].success).toBe(false);
    });

    it('should handle empty batch', async () => {
      const result = await entityResolver.batchResolve(
        [],
        'hedera-id',
        'hrl'
      );

      expect(result).toEqual([]);
    });
  });

  describe('Error Handling', () => {
    it('should handle context creation failure', async () => {
      mockResolutionContext.mockImplementation(() => {
        throw new Error('Context creation failed');
      });

      const result = await entityResolver.resolveEntity(
        '0.0.123',
        'hedera-id',
        'hrl'
      );

      expect(result).toEqual({
        success: false,
        error: 'Context creation failed',
      });
    });

    it('should handle registry initialization failure', () => {
      mockFormatConverterRegistry.mockImplementation(() => {
        throw new Error('Registry init failed');
      });

      expect(() => new EntityResolver()).toThrow('Registry init failed');
    });

    it('should handle malformed entity IDs gracefully', async () => {
      mockRegistry.convert.mockRejectedValue(new Error('Malformed ID'));

      const result = await entityResolver.resolveEntity(
        'malformed-id',
        'hedera-id',
        'hrl'
      );

      expect(result).toEqual({
        success: false,
        error: 'Malformed ID',
      });
    });
  });

  describe('Edge Cases', () => {
    it('should handle very long entity IDs', () => {
      const longId = '0.0.' + '9'.repeat(1000);
      const result = entityResolver.detectEntityType(longId);

      expect(result).toBe('hedera-account-id');
    });

    it('should handle special characters in entity IDs', () => {
      const result = entityResolver.detectEntityType('0.0.123@special');

      expect(result).toBe('unknown');
    });

    it('should handle Unicode characters', () => {
      const result = entityResolver.normalizeEntity('测试', 'unknown');

      expect(result).toBe('测试');
    });
  });
});