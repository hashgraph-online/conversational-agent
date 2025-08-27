import { FormatConverterRegistry } from '@/services/formatters/format-converter-registry';
import { EntityFormat, FormatConverter, ConversionContext } from '@/services/formatters/types';
import { HederaMirrorNode } from '@hashgraphonline/standards-sdk';

jest.mock('@hashgraphonline/standards-sdk', () => ({
  HederaMirrorNode: jest.fn(),
  Logger: jest.fn().mockImplementation(() => ({
    warn: jest.fn(),
    error: jest.fn(),
    info: jest.fn(),
    debug: jest.fn(),
  })),
}));

const MockHederaMirrorNode = HederaMirrorNode as jest.MockedClass<typeof HederaMirrorNode>;

describe('FormatConverterRegistry', () => {
  let registry: FormatConverterRegistry;
  let mockMirrorInstance: jest.Mocked<HederaMirrorNode>;
  let mockConverter: jest.Mocked<FormatConverter<string, string>>;

  beforeEach(() => {
    jest.clearAllMocks();
    registry = new FormatConverterRegistry();
    
    mockMirrorInstance = {
      getAccountBalance: jest.fn(),
      getTokenInfo: jest.fn(),
      getTopicInfo: jest.fn(),
      getContract: jest.fn(),
    } as any;
    
    MockHederaMirrorNode.mockImplementation(() => mockMirrorInstance);
    
    mockConverter = {
      sourceFormat: EntityFormat.TOPIC_ID,
      targetFormat: EntityFormat.HRL,
      canConvert: jest.fn().mockReturnValue(true),
      convert: jest.fn().mockResolvedValue('converted-value'),
    };
  });

  describe('register', () => {
    it('should register a converter', () => {
      registry.register(mockConverter);
      
      expect(registry.hasConverter(EntityFormat.TOPIC_ID, EntityFormat.HRL)).toBe(true);
    });

    it('should register multiple converters', () => {
      const converter2 = {
        ...mockConverter,
        sourceFormat: EntityFormat.ACCOUNT_ID,
        targetFormat: EntityFormat.TOPIC_ID,
      };
      
      registry.register(mockConverter);
      registry.register(converter2);
      
      expect(registry.hasConverter(EntityFormat.TOPIC_ID, EntityFormat.HRL)).toBe(true);
      expect(registry.hasConverter(EntityFormat.ACCOUNT_ID, EntityFormat.TOPIC_ID)).toBe(true);
    });
  });

  describe('findConverter', () => {
    it('should find registered converter', () => {
      registry.register(mockConverter);
      
      const found = registry.findConverter(EntityFormat.TOPIC_ID, EntityFormat.HRL);
      
      expect(found).toBe(mockConverter);
    });

    it('should return null for unregistered converter', () => {
      const found = registry.findConverter(EntityFormat.ACCOUNT_ID, EntityFormat.HRL);
      
      expect(found).toBeNull();
    });
  });

  describe('convertEntity', () => {
    const mockContext: ConversionContext = {
      networkType: 'testnet' as const,
    };

    beforeEach(() => {
      registry.register(mockConverter);
    });

    it('should return entity unchanged when source equals target', async () => {
      const entity = 'hcs://1/0.0.123456';
      
      const result = await registry.convertEntity(entity, EntityFormat.HRL, mockContext);
      
      expect(result).toBe(entity);
      expect(mockConverter.convert).not.toHaveBeenCalled();
    });

    it('should convert entity when converter exists and can convert', async () => {
      const entity = '0.0.123456';
      
      mockMirrorInstance.getTopicInfo.mockResolvedValue({ topicId: '0.0.123456' });
      mockMirrorInstance.getAccountBalance.mockRejectedValue(new Error('Not found'));
      mockMirrorInstance.getTokenInfo.mockRejectedValue(new Error('Not found'));
      mockMirrorInstance.getContract.mockRejectedValue(new Error('Not found'));
      
      const result = await registry.convertEntity(entity, EntityFormat.HRL, mockContext);
      
      expect(mockConverter.canConvert).toHaveBeenCalledWith(entity, mockContext);
      expect(mockConverter.convert).toHaveBeenCalledWith(entity, mockContext);
      expect(result).toBe('converted-value');
    });

    it('should throw error when no converter found', async () => {
      const entity = '0.0.123456';
      
      mockMirrorInstance.getAccountBalance.mockResolvedValue({ accountId: '0.0.123456' });
      mockMirrorInstance.getTokenInfo.mockRejectedValue(new Error('Not found'));
      mockMirrorInstance.getTopicInfo.mockRejectedValue(new Error('Not found'));
      mockMirrorInstance.getContract.mockRejectedValue(new Error('Not found'));
      
      await expect(
        registry.convertEntity(entity, EntityFormat.HRL, mockContext)
      ).rejects.toThrow('No converter found for accountId → hrl');
    });

    it('should throw error when converter cannot convert entity', async () => {
      const entity = '0.0.123456';
      
      mockMirrorInstance.getTopicInfo.mockResolvedValue({ topicId: '0.0.123456' });
      mockMirrorInstance.getAccountBalance.mockRejectedValue(new Error('Not found'));
      mockMirrorInstance.getTokenInfo.mockRejectedValue(new Error('Not found'));
      mockMirrorInstance.getContract.mockRejectedValue(new Error('Not found'));
      
      mockConverter.canConvert.mockReturnValue(false);
      
      await expect(
        registry.convertEntity(entity, EntityFormat.HRL, mockContext)
      ).rejects.toThrow('Converter cannot handle entity: 0.0.123456');
    });
  });

  describe('detectEntityFormat', () => {
    const mockContext: ConversionContext = {
      networkType: 'testnet' as const,
    };

    it('should detect HRL format', async () => {
      const entity = 'hcs://1/0.0.123456';
      
      const format = await registry.detectEntityFormat(entity, mockContext);
      
      expect(format).toBe(EntityFormat.HRL);
    });

    it('should detect TOPIC_ID format via API', async () => {
      const entity = '0.0.123456';
      
      mockMirrorInstance.getAccountBalance.mockRejectedValue(new Error('Not found'));
      mockMirrorInstance.getTokenInfo.mockRejectedValue(new Error('Not found'));
      mockMirrorInstance.getTopicInfo.mockResolvedValue({ topicId: '0.0.123456' });
      mockMirrorInstance.getContract.mockRejectedValue(new Error('Not found'));
      
      const format = await registry.detectEntityFormat(entity, mockContext);
      
      expect(format).toBe(EntityFormat.TOPIC_ID);
    });

    it('should detect ACCOUNT_ID format via API', async () => {
      const entity = '0.0.123456';
      
      mockMirrorInstance.getAccountBalance.mockResolvedValue({ accountId: '0.0.123456' });
      mockMirrorInstance.getTokenInfo.mockRejectedValue(new Error('Not found'));
      mockMirrorInstance.getTopicInfo.mockRejectedValue(new Error('Not found'));
      mockMirrorInstance.getContract.mockRejectedValue(new Error('Not found'));
      
      const format = await registry.detectEntityFormat(entity, mockContext);
      
      expect(format).toBe(EntityFormat.ACCOUNT_ID);
    });

    it('should detect TOKEN_ID format via API', async () => {
      const entity = '0.0.123456';
      
      mockMirrorInstance.getAccountBalance.mockRejectedValue(new Error('Not found'));
      mockMirrorInstance.getTokenInfo.mockResolvedValue({ tokenId: '0.0.123456' });
      mockMirrorInstance.getTopicInfo.mockRejectedValue(new Error('Not found'));
      mockMirrorInstance.getContract.mockRejectedValue(new Error('Not found'));
      
      const format = await registry.detectEntityFormat(entity, mockContext);
      
      expect(format).toBe(EntityFormat.TOKEN_ID);
    });

    it('should detect CONTRACT_ID format via API', async () => {
      const entity = '0.0.123456';
      
      mockMirrorInstance.getAccountBalance.mockRejectedValue(new Error('Not found'));
      mockMirrorInstance.getTokenInfo.mockRejectedValue(new Error('Not found'));
      mockMirrorInstance.getTopicInfo.mockRejectedValue(new Error('Not found'));
      mockMirrorInstance.getContract.mockResolvedValue({ contractId: '0.0.123456' });
      
      const format = await registry.detectEntityFormat(entity, mockContext);
      
      expect(format).toBe(EntityFormat.CONTRACT_ID);
    });

    it('should return ANY when API calls fail', async () => {
      const entity = '0.0.123456';
      
      mockMirrorInstance.getAccountBalance.mockRejectedValue(new Error('Not found'));
      mockMirrorInstance.getTokenInfo.mockRejectedValue(new Error('Not found'));
      mockMirrorInstance.getTopicInfo.mockRejectedValue(new Error('Not found'));
      mockMirrorInstance.getContract.mockRejectedValue(new Error('Not found'));
      
      const format = await registry.detectEntityFormat(entity, mockContext);
      
      expect(format).toBe(EntityFormat.ANY);
    });

    it('should return ANY for non-standard entity format', async () => {
      const entity = 'invalid-entity';
      
      const format = await registry.detectEntityFormat(entity, mockContext);
      
      expect(format).toBe(EntityFormat.ANY);
    });

    it('should use cached format when available', async () => {
      const entity = '0.0.123456';
      
      mockMirrorInstance.getTopicInfo.mockResolvedValue({ topicId: '0.0.123456' });
      mockMirrorInstance.getAccountBalance.mockRejectedValue(new Error('Not found'));
      mockMirrorInstance.getTokenInfo.mockRejectedValue(new Error('Not found'));
      mockMirrorInstance.getContract.mockRejectedValue(new Error('Not found'));
      
      const format1 = await registry.detectEntityFormat(entity, mockContext);
      expect(format1).toBe(EntityFormat.TOPIC_ID);
      
      const format2 = await registry.detectEntityFormat(entity, mockContext);
      expect(format2).toBe(EntityFormat.TOPIC_ID);
      
      expect(mockMirrorInstance.getTopicInfo).toHaveBeenCalledTimes(1);
    });

    it('should handle API detection error and fallback to ANY', async () => {
      const entity = '0.0.123456';
      
      mockMirrorInstance.getAccountBalance.mockRejectedValue(new Error('API Error'));
      mockMirrorInstance.getTokenInfo.mockRejectedValue(new Error('API Error'));
      mockMirrorInstance.getTopicInfo.mockRejectedValue(new Error('API Error'));
      mockMirrorInstance.getContract.mockRejectedValue(new Error('API Error'));
      
      const format = await registry.detectEntityFormat(entity, mockContext);
      
      expect(format).toBe(EntityFormat.ANY);
    });

    it('should handle detectEntityFormat without context', async () => {
      const entity = 'hcs://1/0.0.123456';
      
      const format = await registry.detectEntityFormat(entity);
      
      expect(format).toBe(EntityFormat.HRL);
    });
  });

  describe('getRegisteredConverters', () => {
    it('should return empty array when no converters registered', () => {
      const converters = registry.getRegisteredConverters();
      
      expect(converters).toEqual([]);
    });

    it('should return registered converters', () => {
      const converter2 = {
        ...mockConverter,
        sourceFormat: EntityFormat.ACCOUNT_ID,
        targetFormat: EntityFormat.TOKEN_ID,
      };
      
      registry.register(mockConverter);
      registry.register(converter2);
      
      const converters = registry.getRegisteredConverters();
      
      expect(converters).toHaveLength(2);
      expect(converters).toContainEqual({
        source: EntityFormat.TOPIC_ID,
        target: EntityFormat.HRL,
      });
      expect(converters).toContainEqual({
        source: EntityFormat.ACCOUNT_ID,
        target: EntityFormat.TOKEN_ID,
      });
    });
  });

  describe('hasConverter', () => {
    it('should return false when converter not registered', () => {
      const hasConverter = registry.hasConverter(EntityFormat.TOPIC_ID, EntityFormat.HRL);
      
      expect(hasConverter).toBe(false);
    });

    it('should return true when converter is registered', () => {
      registry.register(mockConverter);
      
      const hasConverter = registry.hasConverter(EntityFormat.TOPIC_ID, EntityFormat.HRL);
      
      expect(hasConverter).toBe(true);
    });
  });

  describe('clear', () => {
    it('should clear all registered converters', () => {
      registry.register(mockConverter);
      
      expect(registry.hasConverter(EntityFormat.TOPIC_ID, EntityFormat.HRL)).toBe(true);
      
      registry.clear();
      
      expect(registry.hasConverter(EntityFormat.TOPIC_ID, EntityFormat.HRL)).toBe(false);
      expect(registry.getRegisteredConverters()).toEqual([]);
    });
  });

  describe('clearCache', () => {
    it('should clear entity type cache', async () => {
      const entity = '0.0.123456';
      const mockContext: ConversionContext = { networkType: 'testnet' as const };
      
      mockMirrorInstance.getTopicInfo.mockResolvedValue({ topicId: '0.0.123456' });
      mockMirrorInstance.getAccountBalance.mockRejectedValue(new Error('Not found'));
      mockMirrorInstance.getTokenInfo.mockRejectedValue(new Error('Not found'));
      mockMirrorInstance.getContract.mockRejectedValue(new Error('Not found'));
      
      await registry.detectEntityFormat(entity, mockContext);
      expect(mockMirrorInstance.getTopicInfo).toHaveBeenCalledTimes(1);
      
      await registry.detectEntityFormat(entity, mockContext);
      expect(mockMirrorInstance.getTopicInfo).toHaveBeenCalledTimes(1);
      
      registry.clearCache();
      
      await registry.detectEntityFormat(entity, mockContext);
      expect(mockMirrorInstance.getTopicInfo).toHaveBeenCalledTimes(2);
    });
  });

  describe('cache expiration', () => {
    it('should expire cached entries based on TTL', async () => {
      const entity = '0.0.123456';
      const mockContext: ConversionContext = { networkType: 'testnet' as const };
      
      const originalDateNow = Date.now;
      let currentTime = 1000000;
      Date.now = jest.fn(() => currentTime);
      
      mockMirrorInstance.getTopicInfo.mockResolvedValue({ topicId: '0.0.123456' });
      mockMirrorInstance.getAccountBalance.mockRejectedValue(new Error('Not found'));
      mockMirrorInstance.getTokenInfo.mockRejectedValue(new Error('Not found'));
      mockMirrorInstance.getContract.mockRejectedValue(new Error('Not found'));
      
      try {
        await registry.detectEntityFormat(entity, mockContext);
        expect(mockMirrorInstance.getTopicInfo).toHaveBeenCalledTimes(1);
        
        currentTime += (5 * 60 * 1000) + 1000;
        
        await registry.detectEntityFormat(entity, mockContext);
        expect(mockMirrorInstance.getTopicInfo).toHaveBeenCalledTimes(2);
      } finally {
        Date.now = originalDateNow;
      }
    });
  });
});