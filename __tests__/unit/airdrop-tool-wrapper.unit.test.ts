import { AirdropToolWrapper } from '../../src/plugins/hbar/AirdropToolWrapper';
import { StructuredTool } from '@langchain/core/tools';
import { Logger } from '@hashgraphonline/standards-sdk';

jest.mock('@hashgraphonline/standards-sdk', () => ({
  Logger: jest.fn().mockImplementation(() => ({
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  })),
}));

global.fetch = jest.fn();

describe('AirdropToolWrapper', () => {
  let wrapper: AirdropToolWrapper;
  let mockOriginalTool: jest.Mocked<StructuredTool & { _call: jest.Mock }>;
  let mockAgentKit: jest.Mocked<any>;
  let mockLogger: jest.Mocked<Logger>;

  beforeEach(() => {
    jest.clearAllMocks();
    (fetch as jest.MockedFunction<typeof fetch>).mockClear();

    mockLogger = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
    } as any;

    (Logger as jest.MockedClass<typeof Logger>).mockImplementation(() => mockLogger);

    mockOriginalTool = {
      _call: jest.fn(),
      name: 'original-airdrop-tool',
      description: 'Original tool',
      schema: {} as any,
    } as any;

    mockAgentKit = {
      network: 'testnet',
      mirrorNode: {
        getTokenInfo: jest.fn(),
      },
    };

    wrapper = new AirdropToolWrapper(mockOriginalTool, mockAgentKit);
  });

  describe('constructor', () => {
    it('should create wrapper with correct properties', () => {
      expect(wrapper.name).toBe('hedera-hts-airdrop-token');
      expect(wrapper.description).toContain('Airdrops fungible tokens');
      expect(wrapper.schema).toBeDefined();
      expect(Logger).toHaveBeenCalledWith({ module: 'AirdropToolWrapper' });
    });

    it('should extend StructuredTool', () => {
      expect(wrapper).toBeInstanceOf(StructuredTool);
    });
  });

  describe('schema validation', () => {
    it('should validate correct input', () => {
      const validInput = {
        tokenId: '0.0.123',
        recipients: [
          { accountId: '0.0.456', amount: 10 },
          { accountId: '0.0.789', amount: '5.5' },
        ],
        memo: 'Test airdrop',
      };

      const result = wrapper.schema.safeParse(validInput);
      expect(result.success).toBe(true);
    });

    it('should require tokenId', () => {
      const invalidInput = {
        recipients: [{ accountId: '0.0.456', amount: 10 }],
      };

      const result = wrapper.schema.safeParse(invalidInput);
      expect(result.success).toBe(false);
    });

    it('should require recipients array', () => {
      const invalidInput = {
        tokenId: '0.0.123',
      };

      const result = wrapper.schema.safeParse(invalidInput);
      expect(result.success).toBe(false);
    });

    it('should require at least one recipient', () => {
      const invalidInput = {
        tokenId: '0.0.123',
        recipients: [],
      };

      const result = wrapper.schema.safeParse(invalidInput);
      expect(result.success).toBe(false);
    });

    it('should accept optional memo', () => {
      const validInput = {
        tokenId: '0.0.123',
        recipients: [{ accountId: '0.0.456', amount: 10 }],
      };

      const result = wrapper.schema.safeParse(validInput);
      expect(result.success).toBe(true);
    });
  });

  describe('_call', () => {
    const validInput = {
      tokenId: '0.0.123',
      recipients: [
        { accountId: '0.0.456', amount: 10 },
        { accountId: '0.0.789', amount: '5.5' },
      ],
      memo: 'Test airdrop',
    };

    it('should process airdrop with mirror node', async () => {
      mockAgentKit.mirrorNode.getTokenInfo.mockResolvedValue({
        decimals: 2,
        name: 'Test Token',
      });
      mockOriginalTool._call.mockResolvedValue('Airdrop successful');

      const result = await wrapper._call(validInput);

      expect(mockAgentKit.mirrorNode.getTokenInfo).toHaveBeenCalledWith('0.0.123');
      expect(mockOriginalTool._call).toHaveBeenCalledWith({
        ...validInput,
        recipients: [
          { accountId: '0.0.456', amount: '1000' }, // 10 * 10^2
          { accountId: '0.0.789', amount: '550' }, // 5.5 * 10^2
        ],
      });
      expect(result).toBe('Airdrop successful');
    });

    it('should handle token with 0 decimals', async () => {
      mockAgentKit.mirrorNode.getTokenInfo.mockResolvedValue({
        decimals: 0,
        name: 'Test NFT',
      });
      mockOriginalTool._call.mockResolvedValue('Airdrop successful');

      const result = await wrapper._call(validInput);

      expect(mockOriginalTool._call).toHaveBeenCalledWith({
        ...validInput,
        recipients: [
          { accountId: '0.0.456', amount: '10' }, // 10 * 10^0
          { accountId: '0.0.789', amount: '5' }, // 5.5 * 10^0 = 5 (floored)
        ],
      });
    });

    it('should handle token with 8 decimals', async () => {
      mockAgentKit.mirrorNode.getTokenInfo.mockResolvedValue({
        decimals: 8,
        name: 'High Precision Token',
      });
      mockOriginalTool._call.mockResolvedValue('Airdrop successful');

      const result = await wrapper._call(validInput);

      expect(mockOriginalTool._call).toHaveBeenCalledWith({
        ...validInput,
        recipients: [
          { accountId: '0.0.456', amount: '1000000000' }, // 10 * 10^8
          { accountId: '0.0.789', amount: '550000000' }, // 5.5 * 10^8
        ],
      });
    });

    it('should fallback to fetch when mirrorNode is not available', async () => {
      mockAgentKit.mirrorNode = undefined;
      (fetch as jest.MockedFunction<typeof fetch>).mockResolvedValue({
        ok: true,
        json: async () => ({
          decimals: 6,
          name: 'Fetched Token',
        }),
      } as any);
      mockOriginalTool._call.mockResolvedValue('Airdrop successful');

      await wrapper._call(validInput);

      expect(fetch).toHaveBeenCalledWith(
        'https://testnet.mirrornode.hedera.com/api/v1/tokens/0.0.123'
      );
      expect(mockOriginalTool._call).toHaveBeenCalledWith({
        ...validInput,
        recipients: [
          { accountId: '0.0.456', amount: '10000000' }, // 10 * 10^6
          { accountId: '0.0.789', amount: '5500000' }, // 5.5 * 10^6
        ],
      });
    });

    it('should use mainnet URL for mainnet network', async () => {
      mockAgentKit.network = 'mainnet';
      mockAgentKit.mirrorNode = undefined;
      (fetch as jest.MockedFunction<typeof fetch>).mockResolvedValue({
        ok: true,
        json: async () => ({ decimals: 4 }),
      } as any);
      mockOriginalTool._call.mockResolvedValue('Airdrop successful');

      await wrapper._call(validInput);

      expect(fetch).toHaveBeenCalledWith(
        'https://mainnet.mirrornode.hedera.com/api/v1/tokens/0.0.123'
      );
    });

    it('should handle fetch failure gracefully', async () => {
      mockAgentKit.mirrorNode = undefined;
      (fetch as jest.MockedFunction<typeof fetch>).mockResolvedValue({
        ok: false,
        status: 404,
      } as any);
      mockOriginalTool._call.mockResolvedValue('Airdrop successful');

      await wrapper._call(validInput);

      expect(mockLogger.warn).toHaveBeenCalled();
      expect(mockLogger.info).toHaveBeenCalledWith(
        'Falling back to assumed 0 decimal places (smallest units)'
      );
      expect(mockOriginalTool._call).toHaveBeenCalledWith({
        ...validInput,
        recipients: [
          { accountId: '0.0.456', amount: '10' }, // Fallback to 0 decimals
          { accountId: '0.0.789', amount: '5' },
        ],
      });
    });

    it('should handle mirrorNode.getTokenInfo failure', async () => {
      mockAgentKit.mirrorNode.getTokenInfo.mockRejectedValue(
        new Error('Token not found')
      );
      mockOriginalTool._call.mockResolvedValue('Airdrop successful');

      await wrapper._call(validInput);

      expect(mockLogger.warn).toHaveBeenCalled();
      expect(mockOriginalTool._call).toHaveBeenCalledWith({
        ...validInput,
        recipients: [
          { accountId: '0.0.456', amount: '10' }, // Fallback to 0 decimals
          { accountId: '0.0.789', amount: '5' },
        ],
      });
    });

    it('should handle token info with missing decimals', async () => {
      mockAgentKit.mirrorNode.getTokenInfo.mockResolvedValue({
        name: 'Token Without Decimals',
        // No decimals field
      });
      mockOriginalTool._call.mockResolvedValue('Airdrop successful');

      await wrapper._call(validInput);

      expect(mockOriginalTool._call).toHaveBeenCalledWith({
        ...validInput,
        recipients: [
          { accountId: '0.0.456', amount: '10' }, // Uses 0 as default
          { accountId: '0.0.789', amount: '5' },
        ],
      });
    });

    it('should handle string amounts correctly', async () => {
      mockAgentKit.mirrorNode.getTokenInfo.mockResolvedValue({ decimals: 3 });
      mockOriginalTool._call.mockResolvedValue('Airdrop successful');

      const inputWithStringAmounts = {
        tokenId: '0.0.123',
        recipients: [
          { accountId: '0.0.456', amount: '12.345' },
          { accountId: '0.0.789', amount: '0.001' },
        ],
      };

      await wrapper._call(inputWithStringAmounts);

      expect(mockOriginalTool._call).toHaveBeenCalledWith({
        ...inputWithStringAmounts,
        recipients: [
          { accountId: '0.0.456', amount: '12345' }, // 12.345 * 10^3
          { accountId: '0.0.789', amount: '1' }, // 0.001 * 10^3
        ],
      });
    });

    it('should floor fractional smallest units', async () => {
      mockAgentKit.mirrorNode.getTokenInfo.mockResolvedValue({ decimals: 2 });
      mockOriginalTool._call.mockResolvedValue('Airdrop successful');

      const inputWithFractionalResult = {
        tokenId: '0.0.123',
        recipients: [
          { accountId: '0.0.456', amount: 1.234 }, // 1.234 * 100 = 123.4 → 123
        ],
      };

      await wrapper._call(inputWithFractionalResult);

      expect(mockOriginalTool._call).toHaveBeenCalledWith({
        ...inputWithFractionalResult,
        recipients: [
          { accountId: '0.0.456', amount: '123' }, // Floored
        ],
      });
    });

    it('should propagate original tool errors', async () => {
      mockAgentKit.mirrorNode.getTokenInfo.mockResolvedValue({ decimals: 2 });
      const toolError = new Error('Original tool failed');
      mockOriginalTool._call.mockRejectedValue(toolError);

      await expect(wrapper._call(validInput)).rejects.toThrow('Original tool failed');
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Error in airdrop tool wrapper:',
        toolError
      );
    });

    it('should handle network field absence', async () => {
      delete mockAgentKit.network;
      mockAgentKit.mirrorNode = undefined;
      (fetch as jest.MockedFunction<typeof fetch>).mockResolvedValue({
        ok: true,
        json: async () => ({ decimals: 1 }),
      } as any);
      mockOriginalTool._call.mockResolvedValue('Success');

      await wrapper._call(validInput);

      expect(fetch).toHaveBeenCalledWith(
        'https://testnet.mirrornode.hedera.com/api/v1/tokens/0.0.123'
      );
    });
  });

  describe('convertToSmallestUnits', () => {
    it('should convert correctly for various decimals', () => {
      const testCases = [
        { amount: 1, decimals: 0, expected: 1 },
        { amount: 1, decimals: 2, expected: 100 },
        { amount: 1.5, decimals: 2, expected: 150 },
        { amount: 10.234, decimals: 3, expected: 10234 },
        { amount: 0.001, decimals: 6, expected: 1000 },
        { amount: 1.9999, decimals: 2, expected: 199 }, // Floor 199.99
      ];

      testCases.forEach(({ amount, decimals, expected }) => {
        const result = wrapper['convertToSmallestUnits'](amount, decimals);
        expect(result).toBe(expected);
      });
    });

    it('should handle zero amounts', () => {
      expect(wrapper['convertToSmallestUnits'](0, 8)).toBe(0);
    });

    it('should handle very large amounts', () => {
      expect(wrapper['convertToSmallestUnits'](1000000, 2)).toBe(100000000);
    });
  });
});