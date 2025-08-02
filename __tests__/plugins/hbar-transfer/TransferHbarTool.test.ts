import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TransferHbarTool } from '../../../src/plugins/hbar-transfer/TransferHbarTool';
import { AccountBuilder } from '../../../src/plugins/hbar-transfer/AccountBuilder';
import { HederaAgentKit } from 'hedera-agent-kit';
import { Logger } from '@hashgraphonline/standards-sdk';
import { TransferTransaction, Hbar, AccountId } from '@hashgraph/sdk';

vi.mock('@hashgraph/sdk');
vi.mock('hedera-agent-kit');

describe('TransferHbarTool', () => {
  let tool: TransferHbarTool;
  let mockHederaKit: any;
  let mockLogger: any;
  let mockTransaction: any;

  beforeEach(() => {
    mockLogger = {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    } as any;

    mockTransaction = {
      addHbarTransfer: vi.fn().mockReturnThis(),
      setTransactionMemo: vi.fn().mockReturnThis(),
    } as any;

    vi.mocked(TransferTransaction).mockImplementation(() => mockTransaction);

    mockHederaKit = {
      operationalMode: 'standard',
      userAccountId: '0.0.123',
    } as any;

    tool = new TransferHbarTool({
      hederaKit: mockHederaKit,
      logger: mockLogger,
    });
  });

  describe('Schema Validation', () => {
    it('should accept decimal HBAR amounts', () => {
      const input = {
        transfers: [
          { accountId: '0.0.800', amount: 1 },
          { accountId: '0.0.801', amount: 0.5 },
        ],
        memo: 'Test transfer',
      };

      const result = tool.specificInputSchema.safeParse(input);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.transfers[0].amount).toBe(1);
        expect(result.data.transfers[1].amount).toBe(0.5);
      }
    });

    it('should accept string HBAR amounts', () => {
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

    it('should reject invalid transfer arrays', () => {
      const input = {
        transfers: [],
        memo: 'Test transfer',
      };

      const result = tool.specificInputSchema.safeParse(input);
      expect(result.success).toBe(false);
    });

    it('should handle large numbers that were mistakenly used as tinybars', () => {
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
    it('should have clear description about decimal HBAR format', () => {
      expect(tool.description).toContain('HBAR');
      expect(tool.description).toContain('transfers');
      
      const schema = tool.specificInputSchema.shape.transfers;
      const schemaDescription = (schema as any)._def.description;
      expect(schemaDescription).toBeDefined();
    });

    it('should specify the correct tool name', () => {
      expect(tool.name).toBe('hedera-account-transfer-hbar-v2');
    });
  });

  describe('AccountBuilder Integration', () => {
    it('should create AccountBuilder with correct HBAR amounts', async () => {
      const mockBuilder = {
        transferHbar: vi.fn().mockReturnThis(),
        setCurrentTransaction: vi.fn(),
        clearNotes: vi.fn(),
        addNote: vi.fn(),
        logger: mockLogger,
      } as any;

      vi.spyOn(tool as any, 'getServiceBuilder').mockReturnValue(mockBuilder);

      await (tool as any).callBuilderMethod(mockBuilder, {
        transfers: [
          { accountId: '0.0.800', amount: 1 },
          { accountId: '0.0.801', amount: -1 },
        ],
        memo: 'Test transfer',
      });

      expect(mockBuilder.transferHbar).toHaveBeenCalledWith({
        transfers: [
          { accountId: '0.0.800', amount: 1 },
          { accountId: '0.0.801', amount: -1 },
        ],
        memo: 'Test transfer',
      });
    });
  });

  describe('Edge Cases', () => {
    it('should handle negative amounts for debits', () => {
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

    it('should handle very small decimal amounts', () => {
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

    it('should handle multi-party transfers', () => {
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