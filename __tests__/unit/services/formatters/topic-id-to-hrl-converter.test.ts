/**
 * @jest-environment node
 */

import { TopicIdToHrlConverter } from '../../../../src/services/formatters/converters/topic-id-to-hrl-converter';
import { EntityFormat, ConversionContext } from '../../../../src/services/formatters/types';
import {
  TEST_TOPIC_IDS,
  TEST_CONVERTER_TOPIC_IDS,
  TEST_HRL_VALUES,
  TEST_FORMAT_TYPES,
  TEST_ACCOUNT_IDS
} from '../../../test-constants';

describe('TopicIdToHrlConverter', () => {
  let converter: TopicIdToHrlConverter;
  
  beforeEach(() => {
    converter = new TopicIdToHrlConverter();
  });

  describe('interface compliance', () => {
    it('should have correct source and target formats', () => {
      expect(converter.sourceFormat).toBe(EntityFormat.TOPIC_ID);
      expect(converter.targetFormat).toBe(EntityFormat.HRL);
    });
  });

  describe('canConvert method', () => {
    it('should accept valid topic ID format', () => {
      expect(converter.canConvert(TEST_TOPIC_IDS.TOPIC_6624800, {})).toBe(true);
      expect(converter.canConvert(TEST_TOPIC_IDS.TOPIC_123, {})).toBe(true);
      expect(converter.canConvert('0.0.999999999', {})).toBe(true);
    });

    it('should reject invalid topic ID formats', () => {
      expect(converter.canConvert('invalid', {})).toBe(false);
      expect(converter.canConvert('0.0', {})).toBe(false);
      expect(converter.canConvert('0.0.', {})).toBe(false);
      expect(converter.canConvert('0.0.abc', {})).toBe(false);
      expect(converter.canConvert('1.0.123', {})).toBe(false);
      expect(converter.canConvert(TEST_HRL_VALUES.HCS_1_123, {})).toBe(false);
    });

    it('should handle edge cases', () => {
      expect(converter.canConvert('', {})).toBe(false);
      expect(converter.canConvert('  0.0.123  ', {})).toBe(false);
      expect(converter.canConvert('0.0.123.456', {})).toBe(false);
    });
  });

  describe('convert method', () => {
    it('should convert to testnet HRL by default', async () => {
      const result = await converter.convert(TEST_TOPIC_IDS.TOPIC_6624800, {});
      expect(result).toBe(TEST_HRL_VALUES.HCS_1_6624800);
    });

    it('should convert to testnet HRL with explicit context', async () => {
      const context: ConversionContext = {
        networkType: TEST_FORMAT_TYPES.TESTNET
      };
      const result = await converter.convert(TEST_TOPIC_IDS.TOPIC_123, context);
      expect(result).toBe(TEST_HRL_VALUES.HCS_1_123);
    });

    it('should convert to mainnet HRL when specified', async () => {
      const context: ConversionContext = {
        networkType: TEST_FORMAT_TYPES.MAINNET
      };
      const result = await converter.convert(TEST_TOPIC_IDS.TOPIC_6624800, context);
      expect(result).toBe(TEST_HRL_VALUES.HCS_0_6624800);
    });

    it('should handle unknown network type as testnet', async () => {
      const context: ConversionContext = {
        networkType: 'unknown-network'
      };
      const result = await converter.convert(TEST_TOPIC_IDS.TOPIC_123, context);
      expect(result).toBe(TEST_HRL_VALUES.HCS_1_123);
    });

    it('should preserve additional context information', async () => {
      const context: ConversionContext = {
        networkType: TEST_FORMAT_TYPES.MAINNET,
        sessionId: 'test-session',
        toolName: 'mint-nft-tool'
      };
      const result = await converter.convert(TEST_ACCOUNT_IDS.USER_ACCOUNT_456, context);
      expect(result).toBe('hcs://0/0.0.456');
    });

    it('should work with various valid topic IDs', async () => {
      const testCases = [
        '0.0.1',
        '0.0.999',
        '0.0.123456789',
        TEST_TOPIC_IDS.TOPIC_6624800
      ];
      
      for (const topicId of testCases) {
        const result = await converter.convert(topicId, { networkType: TEST_FORMAT_TYPES.TESTNET });
        expect(result).toBe(`hcs://1/${topicId}`);
      }
    });
  });

  describe('integration scenarios', () => {
    it('should handle real NFT minting scenario', async () => {
      const topicId = TEST_TOPIC_IDS.TOPIC_6624800;
      const context: ConversionContext = {
        networkType: TEST_FORMAT_TYPES.TESTNET,
        sessionId: 'nft-session-123',
        toolName: 'mint-nft-tool'
      };
      
      expect(converter.canConvert(topicId, context)).toBe(true);
      const result = await converter.convert(topicId, context);
      expect(result).toBe(TEST_HRL_VALUES.HCS_1_6624800);
    });

    it('should handle mainnet production scenario', async () => {
      const topicId = TEST_CONVERTER_TOPIC_IDS.CONVERTER_TOPIC_1;
      const context: ConversionContext = {
        networkType: TEST_FORMAT_TYPES.MAINNET,
        sessionId: 'prod-session',
        toolName: 'inscription-tool'
      };
      
      expect(converter.canConvert(topicId, context)).toBe(true);
      const result = await converter.convert(topicId, context);
      expect(result).toBe('hcs://0/0.0.123456');
    });
  });

  describe('error handling', () => {
    it('should not throw during canConvert with invalid input', () => {
      expect(() => converter.canConvert('invalid', {})).not.toThrow();
    });

    it('should handle conversion with empty context', async () => {
      const result = await converter.convert(TEST_TOPIC_IDS.TOPIC_123, {});
      expect(result).toBe(TEST_HRL_VALUES.HCS_1_123);
    });
  });
});