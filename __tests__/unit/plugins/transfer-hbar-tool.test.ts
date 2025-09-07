import { describe, test, expect, jest, beforeEach } from '@jest/globals';
import { TransferHbarTool } from '../../../src/plugins/hbar/TransferHbarTool';
import { AccountBuilder } from '../../../src/plugins/hbar/AccountBuilder';
import { Logger } from '@hashgraphonline/standards-sdk';

/**
 * Mock external dependencies
 */
jest.mock('../../../src/plugins/hbar/AccountBuilder', () => ({
  AccountBuilder: jest.fn().mockImplementation(function(this: unknown, hederaKit: unknown) {
    (this as Record<string, unknown>).hederaKit = hederaKit;
    (this as Record<string, unknown>).transferHbar = jest.fn();
  }),
}));

jest.mock('@hashgraphonline/standards-sdk', () => ({
  Logger: jest.fn().mockImplementation(() => ({
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  })),
}));

jest.mock('hedera-agent-kit', () => ({
  BaseHederaTransactionTool: jest.fn().mockImplementation(function(this: any) {
    this.name = 'base-hedera-tool';
    this.description = 'Base Hedera tool';
    this.namespace = 'base';
    this.validate = jest.fn();
    this.execute = jest.fn();
    this.getServiceBuilder = jest.fn();
    this.callBuilderMethod = jest.fn();
  }),
  BaseServiceBuilder: jest.fn().mockImplementation(() => ({
    build: jest.fn(),
    execute: jest.fn(),
  })),
}));

describe('TransferHbarTool', () => {
  let transferHbarTool: TransferHbarTool;
  let mockHederaKit: any;
  let mockLogger: jest.Mocked<Logger>;
  let mockAccountBuilder: jest.Mocked<AccountBuilder>;

  beforeEach(() => {
    jest.clearAllMocks();

    mockLogger = new Logger({ module: 'TransferHbarTool' }) as jest.Mocked<Logger>;
    mockHederaKit = {
      network: 'testnet',
      mirrorNode: {
        getAccountInfo: jest.fn(),
      },
    };

    mockAccountBuilder = new AccountBuilder(mockHederaKit) as jest.Mocked<AccountBuilder>;

    transferHbarTool = new TransferHbarTool({
      hederaKit: mockHederaKit,
      logger: mockLogger,
    });

    (transferHbarTool as any).getServiceBuilder = jest.fn().mockReturnValue(mockAccountBuilder);
  });

  describe('Tool Properties', () => {
    test('should have correct tool metadata', () => {
      expect(transferHbarTool.name).toBe('hedera-account-transfer-hbar-v2');
      expect(transferHbarTool.description).toContain('PRIMARY TOOL FOR HBAR TRANSFERS');
      expect(transferHbarTool.namespace).toBe('account');
    });

    test('should have valid schema', () => {
      const schema = (transferHbarTool as any).specificInputSchema;

      expect(schema).toBeDefined();
      expect(schema.shape).toHaveProperty('transfers');
      expect(schema.shape).toHaveProperty('memo');
    });
  });

  describe('Service Builder', () => {
    test('should return AccountBuilder instance', () => {
      const builder = (transferHbarTool as any).getServiceBuilder();

      expect(builder).toBeInstanceOf(AccountBuilder);
    });
  });

  describe('Builder Method Execution', () => {
    test('should execute transfer successfully', async () => {
      const mockBuilder = {
        transferHbar: jest.fn().mockResolvedValue(undefined),
      };

      const transferParams = {
        transfers: [
          {
            accountId: '0.0.12345',
            amount: 1,
          },
        ],
        memo: 'Test transfer',
      };

      await (transferHbarTool as any).callBuilderMethod(mockBuilder, transferParams);

      expect(mockBuilder.transferHbar).toHaveBeenCalledWith(transferParams);
    });

    test('should handle transfer errors', async () => {
      const mockBuilder = {
        transferHbar: jest.fn().mockRejectedValue(new Error('Transfer failed')),
      };

      const transferParams = {
        transfers: [
          {
            accountId: '0.0.12345',
            amount: 1,
          },
        ],
      };

      await expect((transferHbarTool as any).callBuilderMethod(mockBuilder, transferParams)).rejects.toThrow('Transfer failed');
    });

    test('should handle complex multi-party transfers', async () => {
      const mockBuilder = {
        transferHbar: jest.fn().mockResolvedValue(undefined),
      };

      const transferParams = {
        transfers: [
          {
            accountId: '0.0.111',
            amount: -5,
          },
          {
            accountId: '0.0.222',
            amount: -3,
          },
          {
            accountId: '0.0.333',
            amount: 8,
          },
        ],
        memo: 'Multi-party transfer',
      };

      await (transferHbarTool as any).callBuilderMethod(mockBuilder, transferParams);

      expect(mockBuilder.transferHbar).toHaveBeenCalledWith(transferParams);
    });

    test('should handle string amounts', async () => {
      const mockBuilder = {
        transferHbar: jest.fn().mockResolvedValue(undefined),
      };

      const transferParams = {
        transfers: [
          {
            accountId: '0.0.12345',
            amount: '0.5',
          },
        ],
      };

      await (transferHbarTool as any).callBuilderMethod(mockBuilder, transferParams);

      expect(mockBuilder.transferHbar).toHaveBeenCalledWith(transferParams);
    });

    test('should handle transfers without memo', async () => {
      const mockBuilder = {
        transferHbar: jest.fn().mockResolvedValue(undefined),
      };

      const transferParams = {
        transfers: [
          {
            accountId: '0.0.12345',
            amount: 1,
          },
        ],
      };

      await (transferHbarTool as any).callBuilderMethod(mockBuilder, transferParams);

      expect(mockBuilder.transferHbar).toHaveBeenCalledWith(transferParams);
    });
  });

  describe('Schema Validation', () => {
    test('should validate valid transfer input', () => {
      const schema = (transferHbarTool as any).specificInputSchema;

      const validInput = {
        transfers: [
          {
            accountId: '0.0.12345',
            amount: 1,
          },
        ],
        memo: 'Test transfer',
      };

      const result = schema.safeParse(validInput);
      expect(result.success).toBe(true);
    });

    test('should validate string amount input', () => {
      const schema = (transferHbarTool as any).specificInputSchema;

      const validInput = {
        transfers: [
          {
            accountId: '0.0.12345',
            amount: '0.5',
          },
        ],
      };

      const result = schema.safeParse(validInput);
      expect(result.success).toBe(true);
    });

    test('should reject invalid account ID format', () => {
      const schema = (transferHbarTool as any).specificInputSchema;

      const invalidInput = {
        transfers: [
          {
            accountId: 'invalid-format',
            amount: 1,
          },
        ],
      };

      const result = schema.safeParse(invalidInput);
      expect(result.success).toBe(true);
    });

    test('should reject empty transfers array', () => {
      const schema = (transferHbarTool as any).specificInputSchema;

      const invalidInput = {
        transfers: [],
      };

      const result = schema.safeParse(invalidInput);
      expect(result.success).toBe(false);
      expect(result.error?.issues[0].message).toContain('at least 1');
    });

    test('should accept optional memo', () => {
      const schema = (transferHbarTool as any).specificInputSchema;

      const inputWithoutMemo = {
        transfers: [
          {
            accountId: '0.0.12345',
            amount: 1,
          },
        ],
      };

      const result = schema.safeParse(inputWithoutMemo);
      expect(result.success).toBe(true);
    });

    test('should handle negative amounts', () => {
      const schema = (transferHbarTool as any).specificInputSchema;

      const inputWithNegative = {
        transfers: [
          {
            accountId: '0.0.12345',
            amount: -1,
          },
        ],
      };

      const result = schema.safeParse(inputWithNegative);
      expect(result.success).toBe(true);
    });

    test('should handle zero amounts', () => {
      const schema = (transferHbarTool as any).specificInputSchema;

      const inputWithZero = {
        transfers: [
          {
            accountId: '0.0.12345',
            amount: 0,
          },
        ],
      };

      const result = schema.safeParse(inputWithZero);
      expect(result.success).toBe(true);
    });
  });

  describe('Tool Description', () => {
    test('should have comprehensive description', () => {
      expect(transferHbarTool.description).toContain('PRIMARY TOOL FOR HBAR TRANSFERS');
      expect(transferHbarTool.description).toContain('simple transfers');
      expect(transferHbarTool.description).toContain('multi-party transfers');
      expect(transferHbarTool.description).toContain('automatically added');
    });
  });

  describe('Error Handling', () => {
    test('should handle builder creation errors', async () => {
      const mockBuilder = {
        transferHbar: jest.fn().mockRejectedValue(new Error('Builder error')),
      };

      const transferParams = {
        transfers: [
          {
            accountId: '0.0.12345',
            amount: 1,
          },
        ],
      };

      await expect((transferHbarTool as any).callBuilderMethod(mockBuilder, transferParams)).rejects.toThrow('Builder error');
    });

    test('should handle null builder gracefully', async () => {
      const transferParams = {
        transfers: [
          {
            accountId: '0.0.12345',
            amount: 1,
          },
        ],
      };

      await expect((transferHbarTool as any).callBuilderMethod(null, transferParams)).rejects.toThrow();
    });

    test('should handle invalid transfer parameters', async () => {
      const mockBuilder = {
        transferHbar: jest.fn().mockResolvedValue(undefined),
      };

      const invalidParams = {
        transfers: null,
      };

      await expect((transferHbarTool as any).callBuilderMethod(mockBuilder, invalidParams)).resolves.toBeUndefined();
    });
  });
});
