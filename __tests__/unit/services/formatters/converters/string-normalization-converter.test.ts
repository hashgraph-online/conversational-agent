import { StringNormalizationConverter } from '@/services/formatters/converters/string-normalization-converter';
import { EntityFormat } from '@/services/formatters/types';
import { HederaMirrorNode, HRLResolver, NetworkType } from '@hashgraphonline/standards-sdk';
import { TEST_STRING_NORMALIZER_CONSTANTS, TEST_ENTITY_CONSTANTS } from '../../../../test-constants';

jest.mock('@hashgraphonline/standards-sdk', () => ({
  HederaMirrorNode: jest.fn(),
  HRLResolver: jest.fn(),
  NetworkType: {
    TESTNET: 'testnet',
    MAINNET: 'mainnet'
  }
}));

const MockHederaMirrorNode = HederaMirrorNode as jest.MockedClass<typeof HederaMirrorNode>;
const MockHRLResolver = HRLResolver as jest.MockedClass<typeof HRLResolver>;

describe('StringNormalizationConverter', () => {
  let converter: StringNormalizationConverter;
  let mockMirrorInstance: jest.Mocked<HederaMirrorNode>;
  let mockResolverInstance: jest.Mocked<HRLResolver>;

  beforeEach(() => {
    jest.clearAllMocks();
    converter = new StringNormalizationConverter();
    
    mockMirrorInstance = {
      getTopicInfo: jest.fn(),
      configureRetry: jest.fn(),
    } as unknown as jest.Mocked<HederaMirrorNode>;
    
    mockResolverInstance = {
      resolve: jest.fn(),
      parseHRL: jest.fn(),
    } as unknown as jest.Mocked<HRLResolver>;

    MockHederaMirrorNode.mockImplementation(() => mockMirrorInstance);
    MockHRLResolver.mockImplementation(() => mockResolverInstance);
  });

  describe('constructor and properties', () => {
    it('should initialize with correct formats', () => {
      expect(converter.sourceFormat).toBe(EntityFormat.ANY);
      expect(converter.targetFormat).toBe(EntityFormat.HRL);
    });
  });

  describe('canConvert', () => {
    const mockContext = { networkType: TEST_STRING_NORMALIZER_CONSTANTS.TESTNET_NETWORK };

    it('should return false for non-string input', () => {
      expect(converter.canConvert(123 as unknown as string, mockContext)).toBe(false);
      expect(converter.canConvert(null as unknown as string, mockContext)).toBe(false);
      expect(converter.canConvert(undefined as unknown as string, mockContext)).toBe(false);
      expect(converter.canConvert({} as unknown as string, mockContext)).toBe(false);
    });

    it('should return false for already formatted HRL', () => {
      expect(converter.canConvert(TEST_STRING_NORMALIZER_CONSTANTS.HCS_1_123456, mockContext)).toBe(false);
      expect(converter.canConvert('hcs://2/0.0.789012', mockContext)).toBe(false);
      expect(converter.canConvert('HCS://1/0.0.123456', mockContext)).toBe(false);
    });

    it('should return true for CDN URLs', () => {
      expect(converter.canConvert(TEST_STRING_NORMALIZER_CONSTANTS.INSCRIPTION_CDN_123456, mockContext)).toBe(true);
      expect(converter.canConvert('INSCRIPTION-CDN/0.0.123456', mockContext)).toBe(true);
      expect(converter.canConvert('some/inscription-cdn/0.0.789012/path', mockContext)).toBe(true);
    });

    it('should return true for content-ref format', () => {
      expect(converter.canConvert(TEST_STRING_NORMALIZER_CONSTANTS.CONTENT_REF_123456, mockContext)).toBe(true);
      expect(converter.canConvert('CONTENT-REF:0.0.123456', mockContext)).toBe(true);
    });

    it('should return true for raw topic ID with HRL tool preference', () => {
      const contextWithInscriptionPref = {
        ...mockContext,
        toolPreferences: { inscription: 'hrl' }
      };
      expect(converter.canConvert(TEST_STRING_NORMALIZER_CONSTANTS.TOPIC_123456, contextWithInscriptionPref)).toBe(true);

      const contextWithTopicPref = {
        ...mockContext,
        toolPreferences: { topic: 'hrl' }
      };
      expect(converter.canConvert(TEST_STRING_NORMALIZER_CONSTANTS.TOPIC_123456, contextWithTopicPref)).toBe(true);
    });

    it('should return false for raw topic ID without HRL tool preference', () => {
      expect(converter.canConvert(TEST_STRING_NORMALIZER_CONSTANTS.TOPIC_123456, mockContext)).toBe(false);
      
      const contextWithOtherPref = {
        ...mockContext,
        toolPreferences: { inscription: 'other' }
      };
      expect(converter.canConvert(TEST_STRING_NORMALIZER_CONSTANTS.TOPIC_123456, contextWithOtherPref)).toBe(false);
    });

    it('should return false for invalid topic ID formats', () => {
      expect(converter.canConvert('0.0', mockContext)).toBe(false);
      expect(converter.canConvert('0.0.abc', mockContext)).toBe(false);
      expect(converter.canConvert('1.2.123456', mockContext)).toBe(false);
    });
  });

  describe('convert', () => {
    const mockContext = { 
        networkType: TEST_STRING_NORMALIZER_CONSTANTS.TESTNET_NETWORK,
      toolPreferences: {
        hrlStandard: '2',
        inscriptionHrlStandard: '3'
      }
    };

    describe('CDN URL conversion', () => {
      it('should convert CDN URL to HRL using topic memo standard', async () => {
        const source = TEST_STRING_NORMALIZER_CONSTANTS.INSCRIPTION_CDN_123456;
        mockMirrorInstance.getTopicInfo.mockResolvedValue({
          memo: 'hcs-5-inscription',
          admin_key: {} as any,
          auto_renew_account: '0.0.12345',
          auto_renew_period: 2592000,
          created_timestamp: '1234567890.123456789',
          deleted: false,
          submit_key: {} as any,
          topic_id: TEST_STRING_NORMALIZER_CONSTANTS.TOPIC_123456,
        } as any);

        const result = await converter.convert(source, mockContext);

        expect(mockMirrorInstance.getTopicInfo).toHaveBeenCalledWith(TEST_STRING_NORMALIZER_CONSTANTS.TOPIC_123456);
        expect(result).toBe(TEST_STRING_NORMALIZER_CONSTANTS.HCS_5_123456);
      });

      it('should use default standard "1" when memo does not contain hcs pattern', async () => {
        const source = TEST_STRING_NORMALIZER_CONSTANTS.INSCRIPTION_CDN_123456;
        mockMirrorInstance.getTopicInfo.mockResolvedValue({
          memo: 'random memo',
          admin_key: {} as any,
          auto_renew_account: '0.0.12345',
          auto_renew_period: 2592000,
          created_timestamp: '1234567890.123456789',
          deleted: false,
          submit_key: {} as any,
          topic_id: TEST_STRING_NORMALIZER_CONSTANTS.TOPIC_123456,
        } as any);

        const result = await converter.convert(source, mockContext);

        expect(result).toBe(TEST_STRING_NORMALIZER_CONSTANTS.HCS_1_123456);
      });

      it('should use default standard "1" when memo is empty', async () => {
        const source = TEST_STRING_NORMALIZER_CONSTANTS.INSCRIPTION_CDN_123456;
        mockMirrorInstance.getTopicInfo.mockResolvedValue({
          memo: '',
          admin_key: {} as any,
          auto_renew_account: '0.0.12345',
          auto_renew_period: 2592000,
          created_timestamp: '1234567890.123456789',
          deleted: false,
          submit_key: {} as any,
          topic_id: TEST_STRING_NORMALIZER_CONSTANTS.TOPIC_123456,
        } as any);

        const result = await converter.convert(source, mockContext);

        expect(result).toBe(TEST_STRING_NORMALIZER_CONSTANTS.HCS_1_123456);
      });

      it('should use fallback standard when getTopicInfo fails', async () => {
        const source = TEST_STRING_NORMALIZER_CONSTANTS.INSCRIPTION_CDN_123456;
        mockMirrorInstance.getTopicInfo.mockRejectedValue(new Error(TEST_STRING_NORMALIZER_CONSTANTS.MIRROR_ERROR));

        const result = await converter.convert(source, mockContext);

        expect(result).toBe(TEST_STRING_NORMALIZER_CONSTANTS.HCS_2_123456);
      });

      it('should use default fallback standard when none provided', async () => {
        const source = TEST_STRING_NORMALIZER_CONSTANTS.INSCRIPTION_CDN_123456;
        const contextWithoutStandard = { networkType: TEST_STRING_NORMALIZER_CONSTANTS.TESTNET_NETWORK };
        mockMirrorInstance.getTopicInfo.mockRejectedValue(new Error(TEST_STRING_NORMALIZER_CONSTANTS.MIRROR_ERROR));

        const result = await converter.convert(source, contextWithoutStandard);

        expect(result).toBe(TEST_STRING_NORMALIZER_CONSTANTS.HCS_1_123456);
      });

      it('should handle case-insensitive CDN URLs', async () => {
        const source = 'INSCRIPTION-CDN/0.0.123456';
        mockMirrorInstance.getTopicInfo.mockResolvedValue({
          memo: 'hcs-7',
          admin_key: {} as any,
          auto_renew_account: '0.0.12345',
          auto_renew_period: 2592000,
          created_timestamp: '1234567890.123456789',
          deleted: false,
          submit_key: {} as any,
          topic_id: '0.0.123456',
        } as any);

        const result = await converter.convert(source, mockContext);

        expect(result).toBe(TEST_STRING_NORMALIZER_CONSTANTS.HCS_7_123456);
      });
    });

    describe('content-ref conversion', () => {
      it('should convert content-ref to HRL using resolver', async () => {
        const source = TEST_STRING_NORMALIZER_CONSTANTS.CONTENT_REF_123456;
        mockResolverInstance.resolve.mockResolvedValue({
          topicId: TEST_STRING_NORMALIZER_CONSTANTS.TOPIC_123456
        } as any);
        mockResolverInstance.parseHRL.mockReturnValue({
          standard: '4',
          topicId: TEST_STRING_NORMALIZER_CONSTANTS.TOPIC_123456
        } as any);

        const result = await converter.convert(source, mockContext);

        expect(mockResolverInstance.resolve).toHaveBeenCalledWith(TEST_STRING_NORMALIZER_CONSTANTS.TOPIC_123456, {
          network: TEST_STRING_NORMALIZER_CONSTANTS.TESTNET_NETWORK
        });
        expect(mockResolverInstance.parseHRL).toHaveBeenCalledWith(TEST_STRING_NORMALIZER_CONSTANTS.HCS_1_123456);
        expect(result).toBe('hcs://4/0.0.123456');
      });

      it('should use fallback standard when parseHRL returns undefined', async () => {
        const source = TEST_STRING_NORMALIZER_CONSTANTS.CONTENT_REF_123456;
        mockResolverInstance.resolve.mockResolvedValue({
          topicId: TEST_STRING_NORMALIZER_CONSTANTS.TOPIC_123456
        } as any);
        mockResolverInstance.parseHRL.mockReturnValue(null as any);

        const result = await converter.convert(source, mockContext);

        expect(result).toBe(TEST_STRING_NORMALIZER_CONSTANTS.HCS_2_123456);
      });

      it('should use fallback standard when parseHRL returns no standard', async () => {
        const source = TEST_STRING_NORMALIZER_CONSTANTS.CONTENT_REF_123456;
        mockResolverInstance.resolve.mockResolvedValue({
          topicId: TEST_STRING_NORMALIZER_CONSTANTS.TOPIC_123456
        } as any);
        mockResolverInstance.parseHRL.mockReturnValue({
          standard: '',
          topicId: TEST_STRING_NORMALIZER_CONSTANTS.TOPIC_123456
        } as any);

        const result = await converter.convert(source, mockContext);

        expect(result).toBe(TEST_STRING_NORMALIZER_CONSTANTS.HCS_2_123456);
      });

      it('should use fallback standard when resolver fails', async () => {
        const source = TEST_STRING_NORMALIZER_CONSTANTS.CONTENT_REF_123456;
        mockResolverInstance.resolve.mockRejectedValue(new Error(TEST_STRING_NORMALIZER_CONSTANTS.RESOLVER_ERROR));

        const result = await converter.convert(source, mockContext);

        expect(result).toBe(TEST_STRING_NORMALIZER_CONSTANTS.HCS_2_123456);
      });

      it('should handle case-insensitive content-ref', async () => {
        const source = 'CONTENT-REF:0.0.123456';
        mockResolverInstance.resolve.mockResolvedValue({
          topicId: '0.0.123456'
        } as any);
        mockResolverInstance.parseHRL.mockReturnValue({
          standard: '6',
          topicId: '0.0.123456'
        } as any);

        const result = await converter.convert(source, mockContext as any);

        expect(result).toBe('hcs://6/0.0.123456');
      });
    });

    describe('raw topic ID conversion', () => {
      it('should convert raw topic ID to HRL using resolver', async () => {
        const source = '0.0.123456';
        mockResolverInstance.resolve.mockResolvedValue({
          topicId: '0.0.123456'
        } as any);
        mockResolverInstance.parseHRL.mockReturnValue({
          standard: '8'
        });

        const result = await converter.convert(source, mockContext as any);

        expect(mockResolverInstance.resolve).toHaveBeenCalledWith('0.0.123456', {
          network: 'testnet'
        });
        expect(mockResolverInstance.parseHRL).toHaveBeenCalledWith('hcs://1/0.0.123456');
        expect(result).toBe('hcs://8/0.0.123456');
      });

      it('should use fallback standard when resolver fails for raw topic ID', async () => {
        const source = '0.0.123456';
        mockResolverInstance.resolve.mockRejectedValue(new Error('Resolver error'));

        const result = await converter.convert(source, mockContext as any);

        expect(result).toBe('hcs://2/0.0.123456');
      });

      it('should use fallback standard when parseHRL fails for raw topic ID', async () => {
        const source = '0.0.123456';
        mockResolverInstance.resolve.mockResolvedValue({
          topicId: '0.0.123456'
        } as any);
        mockResolverInstance.parseHRL.mockReturnValue(null as any);

        const result = await converter.convert(source, mockContext as any);

        expect(result).toBe('hcs://2/0.0.123456');
      });
    });

    describe('fallback behavior', () => {
      it('should return original source for unsupported formats', async () => {
        const source = 'unsupported-format';
        
        const result = await converter.convert(source, mockContext as any);

        expect(result).toBe(source);
      });

      it('should use inscriptionHrlStandard as fallback', async () => {
        const source = 'inscription-cdn/0.0.123456';
        const contextWithInscriptionStandard = {
          networkType: 'testnet' as const,
          toolPreferences: {
            inscriptionHrlStandard: '9'
          }
        };
        mockMirrorInstance.getTopicInfo.mockRejectedValue(new Error('Error'));

        const result = await converter.convert(source, contextWithInscriptionStandard as any);

        expect(result).toBe('hcs://9/0.0.123456');
      });

      it('should use hrlStandard over inscriptionHrlStandard', async () => {
        const source = 'inscription-cdn/0.0.123456';
        const contextWithBothStandards = {
          networkType: 'testnet' as const,
          toolPreferences: {
            hrlStandard: '10',
            inscriptionHrlStandard: '9'
          }
        };
        mockMirrorInstance.getTopicInfo.mockRejectedValue(new Error('Error'));

        const result = await converter.convert(source, contextWithBothStandards as any);

        expect(result).toBe('hcs://10/0.0.123456');
      });

      it('should use default standard "1" when no preferences provided', async () => {
        const source = 'inscription-cdn/0.0.123456';
        const contextWithoutPrefs = { networkType: 'testnet' as const };
        mockMirrorInstance.getTopicInfo.mockRejectedValue(new Error('Error'));

        const result = await converter.convert(source, contextWithoutPrefs);

        expect(result).toBe('hcs://1/0.0.123456');
      });
    });

    describe('network type handling', () => {
      it('should use provided network type in context', async () => {
        const source = 'content-ref:0.0.123456';
        const mainnetContext = {
          networkType: 'mainnet' as const,
          toolPreferences: {}
        };
        mockResolverInstance.resolve.mockResolvedValue({
          topicId: '0.0.123456'
        } as any);
        mockResolverInstance.parseHRL.mockReturnValue({
          standard: '1'
        });

        await converter.convert(source, mainnetContext as any);

        expect(mockResolverInstance.resolve).toHaveBeenCalledWith('0.0.123456', {
          network: 'mainnet'
        });
      });

      it('should default to testnet when no network type provided', async () => {
        const source = 'content-ref:0.0.123456';
        const contextWithoutNetwork = {};
        mockResolverInstance.resolve.mockResolvedValue({
          topicId: '0.0.123456'
        } as any);
        mockResolverInstance.parseHRL.mockReturnValue({
          standard: '1'
        });

        await converter.convert(source, contextWithoutNetwork);

        expect(mockResolverInstance.resolve).toHaveBeenCalledWith('0.0.123456', {
          network: 'testnet'
        });
      });
    });
  });
});