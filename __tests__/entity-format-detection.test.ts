/**
 * @jest-environment node
 */

import { FormatConverterRegistry } from '../src/services/formatters/format-converter-registry';
import { EntityFormat, ConversionContext } from '../src/services/formatters/types';

const TEST_ERRORS = {
  NETWORK_TIMEOUT: 'Network timeout'
} as const;

const TEST_ENTITY_IDS = {
  NONEXISTENT_ID: '0.0.99999999',
  TOPIC_ID: '0.0.123456'
} as const;

const TEST_HRL = {
  TOPIC_HRL: 'hcs://mainnet/0.0.123456'
} as const;

const mockGetAccountBalance = jest.fn();
const mockGetTokenInfo = jest.fn();
const mockGetTopicInfo = jest.fn();
const mockGetContract = jest.fn();

jest.mock('@hashgraphonline/standards-sdk', () => ({
  HederaMirrorNode: jest.fn().mockImplementation(() => ({
    getAccountBalance: mockGetAccountBalance,
    getTokenInfo: mockGetTokenInfo,
    getTopicInfo: mockGetTopicInfo,
    getContract: mockGetContract,
  })),
  Logger: jest.fn().mockImplementation(() => ({
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  })),
  NetworkType: { TESTNET: 'testnet', MAINNET: 'mainnet' }
}));

describe('Entity Format Detection via API', () => {
  let registry: FormatConverterRegistry;

  const NETWORK_ERROR_MESSAGE = 'Network error';
  const TEST_ENTITY_ID = '0.0.2';
  
  beforeEach(() => {
    registry = new FormatConverterRegistry();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('API-based entity type detection', () => {
    it('should correctly identify 0.0.2 as an Account ID (treasury account)', async () => {
      mockGetAccountBalance.mockResolvedValue(1000);
      mockGetTokenInfo.mockRejectedValue(new Error('404'));
      mockGetTopicInfo.mockRejectedValue(new Error('404'));
      mockGetContract.mockResolvedValue(null);

      const context: ConversionContext = { networkType: 'testnet' };
      const format = await registry['detectFormat'](TEST_ENTITY_ID, context);
      
      expect(format).toBe(EntityFormat.ACCOUNT_ID);
      expect(mockGetAccountBalance).toHaveBeenCalledWith(TEST_ENTITY_ID);
    });

    it('should correctly identify 0.0.12345 as a Token ID when token API succeeds', async () => {
      mockGetAccountBalance.mockResolvedValue(null);
      mockGetTokenInfo.mockResolvedValue({
        token_id: '0.0.12345',
        name: 'Test Token',
        symbol: 'TEST'
      });
      mockGetTopicInfo.mockRejectedValue(new Error('404'));
      mockGetContract.mockResolvedValue(null);

      const context: ConversionContext = { networkType: 'mainnet' };
      const format = await registry['detectFormat']('0.0.12345', context);
      
      expect(format).toBe(EntityFormat.TOKEN_ID);
      expect(mockGetTokenInfo).toHaveBeenCalledWith('0.0.12345');
    });

    it('should correctly identify 0.0.67890 as a Topic ID when topic API succeeds', async () => {
      mockGetAccountBalance.mockResolvedValue(null);
      mockGetTokenInfo.mockResolvedValue(null);
      mockGetTopicInfo.mockResolvedValue({
        topic_id: '0.0.67890',
        memo: 'Test Topic'
      });
      mockGetContract.mockResolvedValue(null);

      const context: ConversionContext = { networkType: 'testnet' };
      const format = await registry['detectFormat']('0.0.67890', context);
      
      expect(format).toBe(EntityFormat.TOPIC_ID);
      expect(mockGetTopicInfo).toHaveBeenCalledWith('0.0.67890');
    });

    it('should correctly identify 0.0.55555 as a Contract ID when contract API succeeds', async () => {
      mockGetAccountBalance.mockResolvedValue(null);
      mockGetTokenInfo.mockResolvedValue(null);
      mockGetTopicInfo.mockRejectedValue(new Error('404'));
      mockGetContract.mockResolvedValue({
        contract_id: '0.0.55555',
        evm_address: '0x1234567890abcdef'
      });

      const context: ConversionContext = { networkType: 'mainnet' };
      const format = await registry['detectFormat']('0.0.55555', context);
      
      expect(format).toBe(EntityFormat.CONTRACT_ID);
      expect(mockGetContract).toHaveBeenCalledWith('0.0.55555');
    });

    it('should return EntityFormat.ANY when all API calls return 404 or null', async () => {
      mockGetAccountBalance.mockResolvedValue(null);
      mockGetTokenInfo.mockResolvedValue(null);
      mockGetTopicInfo.mockRejectedValue(new Error('404'));
      mockGetContract.mockResolvedValue(null);

      const context: ConversionContext = { networkType: 'testnet' };
      const format = await registry['detectFormat'](TEST_ENTITY_IDS.NONEXISTENT_ID, context);
      
      expect(format).toBe(EntityFormat.ANY);
    });

    it('should gracefully fallback to EntityFormat.ANY on network errors', async () => {
      mockGetAccountBalance.mockRejectedValue(new Error(TEST_ERRORS.NETWORK_TIMEOUT));
      mockGetTokenInfo.mockRejectedValue(new Error(TEST_ERRORS.NETWORK_TIMEOUT));
      mockGetTopicInfo.mockRejectedValue(new Error(TEST_ERRORS.NETWORK_TIMEOUT));
      mockGetContract.mockRejectedValue(new Error(TEST_ERRORS.NETWORK_TIMEOUT));

      const context: ConversionContext = { networkType: 'testnet' };
      const format = await registry['detectFormat']('0.0.12345', context);
      
      expect(format).toBe(EntityFormat.ANY);
    });
  });

  describe('caching mechanism', () => {
    it('should cache successful entity type resolutions', async () => {
      mockGetAccountBalance.mockResolvedValue(1000);
      mockGetTokenInfo.mockRejectedValue(new Error('404'));
      mockGetTopicInfo.mockRejectedValue(new Error('404'));
      mockGetContract.mockResolvedValue(null);

      const context: ConversionContext = { networkType: 'testnet' };
      
      const format1 = await registry['detectFormatWithFallback'](TEST_ENTITY_ID, context);
      expect(format1).toBe(EntityFormat.ACCOUNT_ID);
      expect(mockGetAccountBalance).toHaveBeenCalledTimes(1);

      const format2 = await registry['detectFormatWithFallback'](TEST_ENTITY_ID, context);
      expect(format2).toBe(EntityFormat.ACCOUNT_ID);
      expect(mockGetAccountBalance).toHaveBeenCalledTimes(1); // No additional API call
    });

    it('should respect cache TTL and refresh after expiry', async () => {
      jest.useFakeTimers();
      
      mockGetAccountBalance.mockResolvedValue(1000);
      mockGetTokenInfo.mockRejectedValue(new Error('404'));
      mockGetTopicInfo.mockRejectedValue(new Error('404'));
      mockGetContract.mockResolvedValue(null);

      const context: ConversionContext = { networkType: 'testnet' };
      
      const format1 = await registry['detectFormatWithFallback'](TEST_ENTITY_ID, context);
      expect(format1).toBe(EntityFormat.ACCOUNT_ID);
      expect(mockGetAccountBalance).toHaveBeenCalledTimes(1);

      jest.advanceTimersByTime(5 * 60 * 1000 + 1000);

      const format2 = await registry['detectFormatWithFallback'](TEST_ENTITY_ID, context);
      expect(format2).toBe(EntityFormat.ACCOUNT_ID);
      expect(mockGetAccountBalance).toHaveBeenCalledTimes(2);

      jest.useRealTimers();
    });

    it('should not cache failed API responses and fall back to legacy detection', async () => {
      mockGetAccountBalance.mockRejectedValue(new Error(NETWORK_ERROR_MESSAGE));
      mockGetTokenInfo.mockRejectedValue(new Error(NETWORK_ERROR_MESSAGE));
      mockGetTopicInfo.mockRejectedValue(new Error(NETWORK_ERROR_MESSAGE));
      mockGetContract.mockRejectedValue(new Error(NETWORK_ERROR_MESSAGE));

      const context: ConversionContext = { networkType: 'testnet' };
      
      const format1 = await registry['detectFormatWithFallback']('0.0.12345', context);
      expect(format1).toBe(EntityFormat.ANY);

      const format2 = await registry['detectFormatWithFallback']('0.0.12345', context);
      expect(format2).toBe(EntityFormat.ANY);
      expect(mockGetAccountBalance).toHaveBeenCalledTimes(2);
    });

    it('should not cache when API returns EntityFormat.ANY (entity does not exist)', async () => {
      mockGetAccountBalance.mockResolvedValue(null);
      mockGetTokenInfo.mockResolvedValue(null);
      mockGetTopicInfo.mockRejectedValue(new Error('404'));
      mockGetContract.mockResolvedValue(null);

      const context: ConversionContext = { networkType: 'testnet' };
      
      const format1 = await registry['detectFormat'](TEST_ENTITY_IDS.NONEXISTENT_ID, context);
      expect(format1).toBe(EntityFormat.ANY);

      const format2 = await registry['detectFormat'](TEST_ENTITY_IDS.NONEXISTENT_ID, context);
      expect(format2).toBe(EntityFormat.ANY);
      expect(mockGetAccountBalance).toHaveBeenCalledTimes(2);
    });
  });

  describe('backward compatibility', () => {
    it('should maintain HRL format detection without API calls', async () => {
      const format = await registry['detectFormatWithFallback'](TEST_HRL.TOPIC_HRL);
      
      expect(format).toBe(EntityFormat.HRL);
      expect(mockGetAccountBalance).not.toHaveBeenCalled();
      expect(mockGetTokenInfo).not.toHaveBeenCalled();
      expect(mockGetTopicInfo).not.toHaveBeenCalled();
      expect(mockGetContract).not.toHaveBeenCalled();
    });

    it('should handle non-Hedera entity formats gracefully', async () => {
      const format = await registry['detectFormatWithFallback']('random-string');
      
      expect(format).toBe(EntityFormat.ANY);
      expect(mockGetAccountBalance).not.toHaveBeenCalled();
    });
  });

  describe('Promise.allSettled concurrent API testing', () => {
    it('should test all entity endpoints concurrently for efficiency', async () => {
      const startTime = Date.now();
      
      mockGetAccountBalance.mockImplementation(() => 
        new Promise((resolve) => setTimeout(() => resolve(null), 100))
      );
      mockGetTokenInfo.mockImplementation(() => 
        new Promise((resolve) => setTimeout(() => resolve({
          token_id: '0.0.12345',
          name: 'Test Token',
          symbol: 'TEST'
        }), 100))
      );
      mockGetTopicInfo.mockImplementation(() => 
        new Promise((_, reject) => setTimeout(() => reject(new Error('404')), 100))
      );
      mockGetContract.mockImplementation(() => 
        new Promise((resolve) => setTimeout(() => resolve(null), 100))
      );

      const context: ConversionContext = { networkType: 'testnet' };
      const format = await registry['detectFormat']('0.0.12345', context);
      
      const endTime = Date.now();
      const duration = endTime - startTime;
      
      expect(format).toBe(EntityFormat.TOKEN_ID);
      expect(duration).toBeLessThan(200);
      
      expect(mockGetAccountBalance).toHaveBeenCalled();
      expect(mockGetTokenInfo).toHaveBeenCalled();
      expect(mockGetTopicInfo).toHaveBeenCalled();
      expect(mockGetContract).toHaveBeenCalled();
    });
  });

  describe('integration with existing convertEntity method', () => {
    it('should use the new API-based detection in convertEntity method', async () => {
      mockGetAccountBalance.mockResolvedValue(null);
      mockGetTokenInfo.mockResolvedValue(null);
      mockGetTopicInfo.mockResolvedValue({
        topic_id: TEST_ENTITY_IDS.TOPIC_ID,
        memo: 'Test Topic'
      });
      mockGetContract.mockResolvedValue(null);

      const mockConverter = {
        sourceFormat: EntityFormat.TOPIC_ID,
        targetFormat: EntityFormat.HRL,
        canConvert: jest.fn().mockReturnValue(true),
        convert: jest.fn().mockResolvedValue(TEST_HRL.TOPIC_HRL)
      };
      
      registry.register(mockConverter);
      
      const context: ConversionContext = { networkType: 'testnet' };
      const result = await registry.convertEntity(TEST_ENTITY_IDS.TOPIC_ID, EntityFormat.HRL, context);
      
      expect(result).toBe(TEST_HRL.TOPIC_HRL);
      expect(mockGetTopicInfo).toHaveBeenCalledWith(TEST_ENTITY_IDS.TOPIC_ID);
      expect(mockConverter.convert).toHaveBeenCalledWith(TEST_ENTITY_IDS.TOPIC_ID, context);
    });
  });
});