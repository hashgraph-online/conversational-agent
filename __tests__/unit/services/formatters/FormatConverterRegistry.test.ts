/**
 * @jest-environment node
 */

import { FormatConverterRegistry } from '../../../../src/services/formatters/format-converter-registry';
import { EntityFormat, FormatConverter, ConversionContext } from '../../../../src/services/formatters/types';
import { NetworkType } from '@hashgraphonline/standards-sdk';
import {
  TEST_FORMAT_TYPES,
  TEST_TOPIC_IDS,
  TEST_HRL_VALUES,
  TEST_ACCOUNT_IDS
} from '../../../test-constants';

jest.mock('@hashgraphonline/standards-sdk', () => ({
  HederaMirrorNode: jest.fn().mockImplementation(() => ({
    getAccountBalance: jest.fn().mockResolvedValue(null),
    getTokenInfo: jest.fn().mockResolvedValue(null),
    getTopicInfo: jest.fn().mockImplementation((entity: string) => {
      if (/^0\.0\.\d+$/.test(entity)) {
        return Promise.resolve({ topic_id: entity });
      }
      return Promise.resolve(null);
    }),
    getContract: jest.fn().mockResolvedValue(null)
  })),
  Logger: jest.fn().mockImplementation(() => ({
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn()
  }))
}))

class TopicIdToHrlConverter implements FormatConverter<string, string> {
  sourceFormat = EntityFormat.TOPIC_ID;
  targetFormat = EntityFormat.HRL;
  
  canConvert(source: string): boolean {
    return /^0\.0\.\d+$/.test(source);
  }
  
  async convert(topicId: string, context: ConversionContext): Promise<string> {
    const network = context.networkType || 'testnet';
    const networkId = network === 'mainnet' ? '0' : '1';
    return `hcs://${networkId}/${topicId}`;
  }
}

describe('FormatConverterRegistry', () => {
  let registry: FormatConverterRegistry;
  let topicToHrlConverter: TopicIdToHrlConverter;
  
  beforeEach(() => {
    registry = new FormatConverterRegistry();
    topicToHrlConverter = new TopicIdToHrlConverter();
  });

  describe('converter registration', () => {
    it('should register a converter successfully', () => {
      expect(() => {
        registry.register(topicToHrlConverter);
      }).not.toThrow();
      
      expect(registry.hasConverter(EntityFormat.TOPIC_ID, EntityFormat.HRL)).toBe(true);
    });

    it('should find registered converter', () => {
      registry.register(topicToHrlConverter);
      
      const foundConverter = registry.findConverter(EntityFormat.TOPIC_ID, EntityFormat.HRL);
      expect(foundConverter).toBe(topicToHrlConverter);
    });

    it('should return null for non-existent converter', () => {
      const converter = registry.findConverter(EntityFormat.TOKEN_ID, EntityFormat.ADDRESS);
      expect(converter).toBeNull();
    });

    it('should track registered converters', () => {
      registry.register(topicToHrlConverter);
      
      const converters = registry.getRegisteredConverters();
      expect(converters).toHaveLength(1);
      expect(converters[0]).toEqual({
        source: EntityFormat.TOPIC_ID,
        target: EntityFormat.HRL
      });
    });
  });

  describe('entity conversion', () => {
    beforeEach(() => {
      registry.register(topicToHrlConverter);
    });

    it('should convert topic ID to HRL for testnet', async () => {
      const result = await registry.convertEntity(
        TEST_TOPIC_IDS.TOPIC_6624800,
        EntityFormat.HRL,
        { networkType: 'testnet' }
      );
      
      expect(result).toBe(TEST_HRL_VALUES.HCS_1_6624800);
    });

    it('should convert topic ID to HRL for mainnet', async () => {
      const result = await registry.convertEntity(
        TEST_TOPIC_IDS.TOPIC_6624800, 
        EntityFormat.HRL,
        { networkType: 'mainnet' }
      );
      
      expect(result).toBe(TEST_HRL_VALUES.HCS_0_6624800);
    });

    it('should return entity unchanged if already in target format', async () => {
      const topicId = TEST_TOPIC_IDS.TOPIC_6624800;
      const result = await registry.convertEntity(
        topicId,
        EntityFormat.TOPIC_ID,
        {}
      );
      
      expect(result).toBe(topicId);
    });

    it('should throw error for missing converter', async () => {
      await expect(
        registry.convertEntity(TEST_TOPIC_IDS.TOPIC_123, EntityFormat.ADDRESS, {})
      ).rejects.toThrow('No converter found for topicId → address');
    });

    it('should throw error if converter cannot handle entity', async () => {
      registry.register({
        sourceFormat: EntityFormat.TOPIC_ID,
        targetFormat: EntityFormat.HRL,
        canConvert: () => false,
        convert: async () => 'test'
      });
      
      await expect(
        registry.convertEntity(TEST_TOPIC_IDS.TOPIC_123, EntityFormat.HRL, {})
      ).rejects.toThrow('Converter cannot handle entity: 0.0.123');
    });
  });

  describe('format detection', () => {
    it('should detect topic ID format correctly', async () => {
      registry.register(topicToHrlConverter);
      const context = { networkType: TEST_FORMAT_TYPES.TESTNET };
      
      expect(await registry.detectEntityFormat(TEST_TOPIC_IDS.TOPIC_6624800, context)).toBe(EntityFormat.TOPIC_ID);
      expect(await registry.detectEntityFormat(TEST_TOPIC_IDS.TOPIC_123, context)).toBe(EntityFormat.TOPIC_ID);
    });

    it('should detect HRL format correctly', async () => {
      const context = { networkType: TEST_FORMAT_TYPES.TESTNET };
      expect(await registry.detectEntityFormat(TEST_HRL_VALUES.HCS_1_6624800, context)).toBe(EntityFormat.HRL);
      expect(await registry.detectEntityFormat(TEST_HRL_VALUES.HCS_0_123, context)).toBe(EntityFormat.HRL);
    });

    it('should default to ANY format for unrecognized patterns', async () => {
      const context = { networkType: TEST_FORMAT_TYPES.TESTNET };
      expect(await registry.detectEntityFormat('random-string', context)).toBe(EntityFormat.ANY);
      expect(await registry.detectEntityFormat('not-an-id', context)).toBe(EntityFormat.ANY);
    });
  });

  describe('registry management', () => {
    it('should clear all registered converters', () => {
      registry.register(topicToHrlConverter);
      expect(registry.getRegisteredConverters()).toHaveLength(1);
      
      registry.clear();
      expect(registry.getRegisteredConverters()).toHaveLength(0);
    });

    it('should check converter existence accurately', () => {
      expect(registry.hasConverter(EntityFormat.TOPIC_ID, EntityFormat.HRL)).toBe(false);
      
      registry.register(topicToHrlConverter);
      expect(registry.hasConverter(EntityFormat.TOPIC_ID, EntityFormat.HRL)).toBe(true);
    });
  });

  describe('conversion context', () => {
    beforeEach(() => {
      registry.register(topicToHrlConverter);
    });

    it('should pass context to converter', async () => {
      const mockConverter = {
        sourceFormat: EntityFormat.TOKEN_ID,
        targetFormat: EntityFormat.ADDRESS,
        canConvert: jest.fn().mockReturnValue(true),
        convert: jest.fn().mockResolvedValue('converted-result')
      };
      
      registry.register(mockConverter);
      
      const context = { 
        sessionId: 'test-session',
        toolName: 'test-tool',
        networkType: 'testnet' 
      };
      
      registry['detectFormat'] = jest.fn().mockReturnValue(EntityFormat.TOKEN_ID);
      
      await registry.convertEntity(TEST_TOPIC_IDS.TOPIC_123, EntityFormat.ADDRESS, context);
      
      expect(mockConverter.canConvert).toHaveBeenCalledWith(TEST_TOPIC_IDS.TOPIC_123, context);
      expect(mockConverter.convert).toHaveBeenCalledWith(TEST_TOPIC_IDS.TOPIC_123, context);
    });
  });
});