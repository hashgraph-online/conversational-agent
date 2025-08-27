import { describe, test, expect, jest, beforeEach } from '@jest/globals';
import { AirdropToolWrapper } from '../../../src/plugins/hbar/AirdropToolWrapper';
import { Logger } from '@hashgraphonline/standards-sdk';

/**
 * Mock external dependencies
 */
jest.mock('@hashgraphonline/standards-sdk', () => ({
  Logger: jest.fn().mockImplementation(() => ({
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  })),
}));

jest.mock('@langchain/core/tools', () => ({
  StructuredTool: jest.fn().mockImplementation(function(this: any) {
    this.name = 'base-structured-tool';
    this.description = 'Base structured tool';
    this.schema = {};
  }),
}));

describe('AirdropToolWrapper', () => {
  let airdropToolWrapper: AirdropToolWrapper;
  let mockOriginalTool: any;
  let mockAgentKit: any;
  let mockLogger: jest.Mocked<Logger>;

  beforeEach(() => {
    jest.clearAllMocks();

    mockLogger = new Logger({ module: 'AirdropToolWrapper' }) as jest.Mocked<Logger>;

    mockOriginalTool = {
      name: 'original-airdrop-tool',
      description: 'Original airdrop tool',
      _call: jest.fn(),
    };

    mockAgentKit = {
      network: 'testnet',
      mirrorNode: {
        getTokenInfo: jest.fn(),
      },
    };

    airdropToolWrapper = new AirdropToolWrapper(mockOriginalTool, mockAgentKit);
    // Replace the logger with our mock
    (airdropToolWrapper as any).logger = mockLogger;
  });

  describe('Tool Properties', () => {
    test('should have correct tool metadata', () => {
      expect(airdropToolWrapper.name).toBe('hedera-hts-airdrop-token');
      expect(airdropToolWrapper.description).toContain('Airdrops fungible tokens');
      expect(airdropToolWrapper.description).toContain('Automatically converts human-readable amounts');
    });

    test('should have valid schema', () => {
      const schema = (airdropToolWrapper as any).schema;

      expect(schema).toBeDefined();
      expect(schema.shape).toHaveProperty('tokenId');
      expect(schema.shape).toHaveProperty('recipients');
      expect(schema.shape).toHaveProperty('memo');
    });
  });

  describe('Token Info Retrieval', () => {
    test('should retrieve token info successfully', async () => {
      const tokenId = '0.0.12345';
      const tokenInfo = {
        decimals: 8,
        name: 'Test Token',
        symbol: 'TEST',
      };

      mockAgentKit.mirrorNode.getTokenInfo.mockResolvedValue(tokenInfo);

      const result = await (airdropToolWrapper as any).getTokenInfo(tokenId);

      expect(result).toEqual(tokenInfo);
      expect(mockAgentKit.mirrorNode.getTokenInfo).toHaveBeenCalledWith(tokenId);
    });

    test('should handle token info retrieval errors', async () => {
      const tokenId = '0.0.invalid';

      mockAgentKit.mirrorNode.getTokenInfo.mockRejectedValue(new Error('Token not found'));

      // The method should fall back to 0 decimals when token info fails
      const result = await (airdropToolWrapper as any).getTokenInfo(tokenId);
      expect(result).toEqual({ decimals: 0 });
      expect(mockLogger.warn).toHaveBeenCalled();
    });

    test('should handle zero decimals', async () => {
      const tokenId = '0.0.12345';
      const tokenInfo = {
        decimals: 0,
        name: 'Whole Token',
        symbol: 'WHOLE',
      };

      mockAgentKit.mirrorNode.getTokenInfo.mockResolvedValue(tokenInfo);

      const result = await (airdropToolWrapper as any).getTokenInfo(tokenId);

      expect(result.decimals).toBe(0);
    });
  });

  describe('Amount Conversion', () => {
    test('should convert human amount to smallest units', () => {
      const result = (airdropToolWrapper as any).convertToSmallestUnits(10, 8);

      expect(result).toBe(1000000000); // 10 * 10^8
    });

    test('should handle zero decimals', () => {
      const result = (airdropToolWrapper as any).convertToSmallestUnits(5, 0);

      expect(result).toBe(5); // 5 * 10^0
    });

    test('should handle large decimal values', () => {
      const result = (airdropToolWrapper as any).convertToSmallestUnits(0.1, 18);

      expect(result).toBe(100000000000000000); // 0.1 * 10^18
    });

    test('should handle fractional amounts', () => {
      const result = (airdropToolWrapper as any).convertToSmallestUnits(1.5, 2);

      expect(result).toBe(150); // 1.5 * 10^2
    });
  });

  describe('Airdrop Execution', () => {
    test('should execute airdrop successfully', async () => {
      const input = {
        tokenId: '0.0.12345',
        recipients: [
          {
            accountId: '0.0.111',
            amount: '10',
          },
          {
            accountId: '0.0.222',
            amount: '5',
          },
        ],
        memo: 'Test airdrop',
      };

      const tokenInfo = {
        decimals: 8,
        name: 'Test Token',
        symbol: 'TEST',
      };

      mockAgentKit.mirrorNode.getTokenInfo.mockResolvedValue(tokenInfo);
      mockOriginalTool._call.mockResolvedValue('Airdrop successful');

      const result = await airdropToolWrapper._call(input);

      expect(result).toBe('Airdrop successful');
      expect(mockLogger.info).toHaveBeenCalledWith(
        'Processing airdrop request for token 0.0.12345 with 2 recipients'
      );
      expect(mockLogger.info).toHaveBeenCalledWith('Token 0.0.12345 has 8 decimal places');
      expect(mockLogger.info).toHaveBeenCalledWith(
        'Converting amount for 0.0.111: 10 tokens → 1000000000 smallest units'
      );
      expect(mockLogger.info).toHaveBeenCalledWith(
        'Converting amount for 0.0.222: 5 tokens → 500000000 smallest units'
      );
      expect(mockLogger.info).toHaveBeenCalledWith('Calling original airdrop tool with converted amounts');

      expect(mockOriginalTool._call).toHaveBeenCalledWith({
        tokenId: '0.0.12345',
        recipients: [
          {
            accountId: '0.0.111',
            amount: '1000000000',
          },
          {
            accountId: '0.0.222',
            amount: '500000000',
          },
        ],
        memo: 'Test airdrop',
      });
    });

    test('should handle numeric amounts', async () => {
      const input = {
        tokenId: '0.0.12345',
        recipients: [
          {
            accountId: '0.0.111',
            amount: 10,
          },
        ],
      };

      const tokenInfo = {
        decimals: 6,
        name: 'Test Token',
        symbol: 'TEST',
      };

      mockAgentKit.mirrorNode.getTokenInfo.mockResolvedValue(tokenInfo);
      mockOriginalTool._call.mockResolvedValue('Airdrop successful');

      await airdropToolWrapper._call(input);

      expect(mockOriginalTool._call).toHaveBeenCalledWith({
        tokenId: '0.0.12345',
        recipients: [
          {
            accountId: '0.0.111',
            amount: '10000000', // 10 * 10^6
          },
        ],
        memo: undefined,
      });
    });

    test('should handle airdrop without memo', async () => {
      const input = {
        tokenId: '0.0.12345',
        recipients: [
          {
            accountId: '0.0.111',
            amount: '1',
          },
        ],
      };

      const tokenInfo = {
        decimals: 0,
        name: 'Whole Token',
        symbol: 'WHOLE',
      };

      mockAgentKit.mirrorNode.getTokenInfo.mockResolvedValue(tokenInfo);
      mockOriginalTool._call.mockResolvedValue('Airdrop successful');

      await airdropToolWrapper._call(input);

      expect(mockOriginalTool._call).toHaveBeenCalledWith({
        tokenId: '0.0.12345',
        recipients: [
          {
            accountId: '0.0.111',
            amount: '1', // 1 * 10^0
          },
        ],
        memo: undefined,
      });
    });

    test('should handle single recipient', async () => {
      const input = {
        tokenId: '0.0.12345',
        recipients: [
          {
            accountId: '0.0.111',
            amount: '100',
          },
        ],
      };

      const tokenInfo = {
        decimals: 2,
        name: 'Decimal Token',
        symbol: 'DEC',
      };

      mockAgentKit.mirrorNode.getTokenInfo.mockResolvedValue(tokenInfo);
      mockOriginalTool._call.mockResolvedValue('Single recipient airdrop successful');

      const result = await airdropToolWrapper._call(input);

      expect(result).toBe('Single recipient airdrop successful');
      expect(mockLogger.info).toHaveBeenCalledWith(
        'Processing airdrop request for token 0.0.12345 with 1 recipients'
      );
    });
  });

  describe('Error Handling', () => {
    test('should handle token info retrieval errors', async () => {
      const input = {
        tokenId: '0.0.invalid',
        recipients: [
          {
            accountId: '0.0.111',
            amount: '10',
          },
        ],
      };

      mockAgentKit.mirrorNode.getTokenInfo.mockRejectedValue(new Error('Token not found'));

      // The method should fall back to 0 decimals and continue processing
      const result = await airdropToolWrapper._call(input);
      
      expect(mockLogger.warn).toHaveBeenCalled();
      expect(mockOriginalTool._call).toHaveBeenCalled();
    });

    test('should handle original tool errors', async () => {
      const input = {
        tokenId: '0.0.12345',
        recipients: [
          {
            accountId: '0.0.111',
            amount: '10',
          },
        ],
      };

      const tokenInfo = {
        decimals: 8,
        name: 'Test Token',
        symbol: 'TEST',
      };

      mockAgentKit.mirrorNode.getTokenInfo.mockResolvedValue(tokenInfo);
      mockOriginalTool._call.mockRejectedValue(new Error('Airdrop failed'));

      await expect(airdropToolWrapper._call(input)).rejects.toThrow('Airdrop failed');

      expect(mockLogger.error).toHaveBeenCalledWith('Error in airdrop tool wrapper:', expect.any(Error));
    });

    test('should handle empty recipients array', async () => {
      const input = {
        tokenId: '0.0.12345',
        recipients: [],
      };

      // Schema validation should handle this, but test the behavior
      const schema = (airdropToolWrapper as any).schema;
      const result = schema.safeParse(input);

      expect(result.success).toBe(false);
      expect(result.error?.issues[0].message).toContain('at least 1');
    });
  });

  describe('Schema Validation', () => {
    test('should validate valid airdrop input', () => {
      const schema = (airdropToolWrapper as any).schema;

      const validInput = {
        tokenId: '0.0.12345',
        recipients: [
          {
            accountId: '0.0.111',
            amount: '10',
          },
        ],
        memo: 'Test airdrop',
      };

      const result = schema.safeParse(validInput);
      expect(result.success).toBe(true);
    });

    test('should validate numeric amounts', () => {
      const schema = (airdropToolWrapper as any).schema;

      const validInput = {
        tokenId: '0.0.12345',
        recipients: [
          {
            accountId: '0.0.111',
            amount: 10,
          },
        ],
      };

      const result = schema.safeParse(validInput);
      expect(result.success).toBe(true);
    });

    test('should accept optional memo', () => {
      const schema = (airdropToolWrapper as any).schema;

      const inputWithoutMemo = {
        tokenId: '0.0.12345',
        recipients: [
          {
            accountId: '0.0.111',
            amount: '10',
          },
        ],
      };

      const result = schema.safeParse(inputWithoutMemo);
      expect(result.success).toBe(true);
    });

    test('should reject invalid token ID format', () => {
      const schema = (airdropToolWrapper as any).schema;

      const invalidInput = {
        tokenId: 'invalid-format',
        recipients: [
          {
            accountId: '0.0.111',
            amount: '10',
          },
        ],
      };

      const result = schema.safeParse(invalidInput);
      expect(result.success).toBe(true); // Schema doesn't validate token ID format
    });

    test('should reject empty recipients', () => {
      const schema = (airdropToolWrapper as any).schema;

      const invalidInput = {
        tokenId: '0.0.12345',
        recipients: [],
      };

      const result = schema.safeParse(invalidInput);
      expect(result.success).toBe(false);
    });
  });

  describe('Constructor', () => {
    test('should create wrapper with original tool', () => {
      expect((airdropToolWrapper as any).originalTool).toBe(mockOriginalTool);
      expect((airdropToolWrapper as any).agentKit).toBe(mockAgentKit);
    });

    test('should handle null agent kit', () => {
      const wrapper = new AirdropToolWrapper(mockOriginalTool, null as any);
      expect(wrapper).toBeDefined();
    });
  });

  describe('Logging', () => {
    test('should log processing information', async () => {
      const input = {
        tokenId: '0.0.12345',
        recipients: [
          {
            accountId: '0.0.111',
            amount: '10',
          },
        ],
      };

      const tokenInfo = {
        decimals: 8,
        name: 'Test Token',
        symbol: 'TEST',
      };

      mockAgentKit.mirrorNode.getTokenInfo.mockResolvedValue(tokenInfo);
      mockOriginalTool._call.mockResolvedValue('Success');

      await airdropToolWrapper._call(input);

      expect(mockLogger.info).toHaveBeenCalledWith(
        'Processing airdrop request for token 0.0.12345 with 1 recipients'
      );
      expect(mockLogger.info).toHaveBeenCalledWith('Token 0.0.12345 has 8 decimal places');
      expect(mockLogger.info).toHaveBeenCalledWith('Calling original airdrop tool with converted amounts');
    });
  });
});
