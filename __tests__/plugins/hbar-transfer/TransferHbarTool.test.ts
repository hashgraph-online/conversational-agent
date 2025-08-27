import { describe, expect, beforeEach } from '@jest/globals';
import { TransferHbarTool } from '../../../src/plugins/hbar/TransferHbarTool';
import { TransferTransaction } from '@hashgraph/sdk';

jest.mock('@hashgraph/sdk');
jest.mock('hedera-agent-kit');

const TEST_MEMO = 'Test transfer';

interface MockLogger {
  info: jest.Mock;
  warn: jest.Mock;
  error: jest.Mock;
}

interface MockTransaction {
  addHbarTransfer: jest.Mock;
  setTransactionMemo: jest.Mock;
}

interface MockHederaKit {
  operationalMode: string;
  userAccountId: string;
}



interface MockBuilder {
  transferHbar: jest.Mock;
  setCurrentTransaction: jest.Mock;
  clearNotes: jest.Mock;
  addNote: jest.Mock;
  logger: MockLogger;
}

interface ToolWithServiceBuilder {
  getServiceBuilder(): MockBuilder;
}

interface ToolWithCallBuilder {
  callBuilderMethod(builder: MockBuilder, params: unknown): Promise<void>;
}

describe('TransferHbarTool', () => {
  let tool: TransferHbarTool;
  let mockHederaKit: MockHederaKit;
  let mockLogger: MockLogger;
  let mockTransaction: MockTransaction;

  beforeEach(() => {
    mockLogger = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };

    mockTransaction = {
      addHbarTransfer: jest.fn().mockReturnThis(),
      setTransactionMemo: jest.fn().mockReturnThis(),
    };

    jest.mocked(TransferTransaction).mockImplementation(() => mockTransaction as unknown as TransferTransaction);

    mockHederaKit = {
      operationalMode: 'standard',
      userAccountId: '0.0.123',
    };

    tool = new TransferHbarTool({
      hederaKit: mockHederaKit as unknown,
      logger: mockLogger,
    } as unknown as ConstructorParameters<typeof TransferHbarTool>[0]);
  });

  describe('Schema Validation', () => {
    test('should accept decimal HBAR amounts', () => {
      const input = {
        transfers: [
          { accountId: '0.0.800', amount: 1 },
          { accountId: '0.0.801', amount: 0.5 },
        ],
        memo: TEST_MEMO,
      };

      const result = tool.specificInputSchema.safeParse(input);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.transfers[0].amount).toBe(1);
        expect(result.data.transfers[1].amount).toBe(0.5);
      }
    });

    test('should accept string HBAR amounts', () => {
      const input = {
        transfers: [
          { accountId: '0.0.800', amount: '1.25' },
          { accountId: '0.0.801', amount: '0.75' },
        ],
      };

      const result = tool.specificInputSchema.safeParse(input);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.transfers[0].amount).toBe('1.25');
        expect(result.data.transfers[1].amount).toBe('0.75');
      }
    });

    test('should reject invalid transfer arrays', () => {
      const input = {
        transfers: [],
        memo: TEST_MEMO,
      };

      const result = tool.specificInputSchema.safeParse(input);
      expect(result.success).toBe(false);
    });

    test('should handle large numbers that were mistakenly used as tinybars', () => {
      const input = {
        transfers: [
          { accountId: '0.0.800', amount: 10000000 },
        ],
      };

      const result = tool.specificInputSchema.safeParse(input);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.transfers[0].amount).toBe(10000000);
      }
    });
  });

  describe('Tool Description', () => {
    test('should have clear description about decimal HBAR format', () => {
      expect(tool.description).toContain('HBAR');
      expect(tool.description).toContain('transfers');
      
      const schema = tool.specificInputSchema.shape.transfers;
      const schemaDescription = (schema as {_def?: {description?: string}})._def?.description;
      expect(schemaDescription).toBeDefined();
    });

    test('should specify the correct tool name', () => {
      expect(tool.name).toBe('hedera-account-transfer-hbar-v2');
    });
  });

  describe('AccountBuilder Integration', () => {
    test('should create AccountBuilder with correct HBAR amounts', async () => {
      const mockBuilder: MockBuilder = {
        transferHbar: jest.fn().mockReturnThis(),
        setCurrentTransaction: jest.fn(),
        clearNotes: jest.fn(),
        addNote: jest.fn(),
        logger: mockLogger,
      };

      jest.spyOn(tool as unknown as ToolWithServiceBuilder, 'getServiceBuilder').mockReturnValue(mockBuilder);

      await (tool as unknown as ToolWithCallBuilder).callBuilderMethod(mockBuilder, {
        transfers: [
          { accountId: '0.0.800', amount: 1 },
          { accountId: '0.0.801', amount: -1 },
        ],
        memo: TEST_MEMO,
      });

      expect(mockBuilder.transferHbar).toHaveBeenCalledWith({
        transfers: [
          { accountId: '0.0.800', amount: 1 },
          { accountId: '0.0.801', amount: -1 },
        ],
        memo: TEST_MEMO,
      });
    });
  });

  describe('Edge Cases', () => {
    test('should handle negative amounts for debits', () => {
      const input = {
        transfers: [
          { accountId: '0.0.800', amount: -5 },
          { accountId: '0.0.801', amount: 5 },
        ],
      };

      const result = tool.specificInputSchema.safeParse(input);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.transfers[0].amount).toBe(-5);
        expect(result.data.transfers[1].amount).toBe(5);
      }
    });

    test('should handle very small decimal amounts', () => {
      const input = {
        transfers: [
          { accountId: '0.0.800', amount: 0.00000001 },
          { accountId: '0.0.801', amount: -0.00000001 },
        ],
      };

      const result = tool.specificInputSchema.safeParse(input);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.transfers[0].amount).toBe(0.00000001);
        expect(result.data.transfers[1].amount).toBe(-0.00000001);
      }
    });

    test('should handle multi-party transfers', () => {
      const input = {
        transfers: [
          { accountId: '0.0.800', amount: -5 },
          { accountId: '0.0.801', amount: -3 },
          { accountId: '0.0.802', amount: 8 },
        ],
        memo: 'Multi-party transfer',
      };

      const result = tool.specificInputSchema.safeParse(input);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.transfers).toHaveLength(3);
        const sum = result.data.transfers.reduce(
          (acc, t) => acc + Number(t.amount),
          0
        );
        expect(sum).toBe(0);
      }
    });
  });
});