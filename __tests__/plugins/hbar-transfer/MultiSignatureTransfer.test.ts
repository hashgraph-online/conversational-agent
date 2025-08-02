import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TransferHbarTool } from '../../../src/plugins/hbar-transfer/TransferHbarTool';
import { AccountBuilder } from '../../../src/plugins/hbar-transfer/AccountBuilder';
import { HederaAgentKit } from 'hedera-agent-kit';
import { Logger } from '@hashgraphonline/standards-sdk';
import { TransferTransaction, Hbar, AccountId } from '@hashgraph/sdk';

vi.mock('@hashgraph/sdk');
vi.mock('hedera-agent-kit');

describe('Multi-Signature Transfer Scenarios', () => {
  let tool: TransferHbarTool;
  let builder: AccountBuilder;
  let mockHederaKit: any;
  let mockLogger: any;
  let mockTransaction: any;

  beforeEach(() => {
    vi.clearAllMocks();

    mockLogger = {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      debug: vi.fn(),
    } as any;

    mockTransaction = {
      addHbarTransfer: vi.fn().mockReturnThis(),
      setTransactionMemo: vi.fn().mockReturnThis(),
    } as any;

    vi.mocked(TransferTransaction).mockImplementation(() => mockTransaction);
    
    vi.mocked(Hbar.fromString).mockImplementation((amount: string) => ({
      toString: () => `${amount} ℏ`,
      toTinybars: () => BigInt(Math.round(parseFloat(amount) * 100000000)),
      negated: () => ({
        toString: () => `-${amount} ℏ`,
        toTinybars: () => BigInt(Math.round(parseFloat(amount) * -100000000)),
      }),
    }));

    vi.mocked(AccountId.fromString).mockImplementation((id: string) => ({
      toString: () => id,
    }));

    mockHederaKit = {
      operationalMode: 'returnBytes',
      userAccountId: '0.0.456',
      logger: mockLogger,
    } as any;

    tool = new TransferHbarTool({
      hederaKit: mockHederaKit,
      logger: mockLogger,
    });

    builder = new AccountBuilder(mockHederaKit);
    (builder as any).logger = mockLogger;
    (builder as any).kit = mockHederaKit;
  });

  describe('Schema Validation for Multi-Signature Transfers', () => {
    it('should accept multi-signature transfer with decimal HBAR amounts', () => {
      const input = {
        transfers: [
          { accountId: '0.0.123', amount: -0.5 },
          { accountId: '0.0.789', amount: -0.5 },
          { accountId: '0.0.98', amount: 1 },
        ],
        memo: 'Multi-signature transfer to Treasury',
      };

      const result = tool.specificInputSchema.safeParse(input);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.transfers).toHaveLength(3);
        expect(result.data.transfers[0].amount).toBe(-0.5);
        expect(result.data.transfers[1].amount).toBe(-0.5);
        expect(result.data.transfers[2].amount).toBe(1);
        
        const sum = result.data.transfers.reduce(
          (acc, t) => acc + Number(t.amount),
          0
        );
        expect(sum).toBe(0);
      }
    });

    it('should handle complex multi-party transfers with varying amounts', () => {
      const input = {
        transfers: [
          { accountId: '0.0.100', amount: -2.5 },
          { accountId: '0.0.200', amount: -1.25 },
          { accountId: '0.0.300', amount: -0.75 },
          { accountId: '0.0.98', amount: 4.5 },
        ],
      };

      const result = tool.specificInputSchema.safeParse(input);
      expect(result.success).toBe(true);
      if (result.success) {
        const sum = result.data.transfers.reduce(
          (acc, t) => acc + Number(t.amount),
          0
        );
        expect(sum).toBeCloseTo(0, 8);
      }
    });
  });

  describe('AccountBuilder Multi-Signature Handling', () => {
    it('should process multi-signature transfer correctly in returnBytes mode', () => {
      const params = {
        transfers: [
          { accountId: '0.0.123', amount: -0.5 },
          { accountId: '0.0.789', amount: -0.5 },
          { accountId: '0.0.98', amount: 1 },
        ],
        memo: 'Multi-signature transfer to Treasury',
      };

      builder.transferHbar(params, true);

      expect(Hbar.fromString).toHaveBeenCalledWith('-0.50000000');
      expect(Hbar.fromString).toHaveBeenCalledWith('-0.50000000');
      expect(Hbar.fromString).toHaveBeenCalledWith('1.00000000');
      
      expect(mockTransaction.addHbarTransfer).toHaveBeenCalledTimes(3);
      expect(mockTransaction.setTransactionMemo).toHaveBeenCalledWith(
        'Multi-signature transfer to Treasury'
      );

      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining('Processing transfer: -0.5 HBAR')
      );
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining('Processing transfer: 1 HBAR')
      );
    });

    it('should handle the example case from tinybars conversion', () => {
      const halfAmount = 0.5;
      
      const params = {
        transfers: [
          { accountId: '0.0.123', amount: -halfAmount },
          { accountId: '0.0.789', amount: -halfAmount },
          { accountId: '0.0.98', amount: halfAmount * 2 },
        ],
      };

      builder.transferHbar(params);

      expect(Hbar.fromString).toHaveBeenCalledWith('-0.50000000');
      expect(Hbar.fromString).toHaveBeenCalledWith('1.00000000');
      expect(mockTransaction.addHbarTransfer).toHaveBeenCalledTimes(3);
    });

    it('should handle scheduled transaction mode correctly', () => {
      mockHederaKit.operationalMode = 'provideBytes';
      builder = new AccountBuilder(mockHederaKit);
      (builder as any).logger = mockLogger;
      (builder as any).kit = mockHederaKit;

      const params = {
        transfers: [
          { accountId: '0.0.123', amount: -0.5 },
          { accountId: '0.0.789', amount: -0.5 },
          { accountId: '0.0.98', amount: 1 },
        ],
      };

      builder.transferHbar(params, true);

      expect(mockTransaction.addHbarTransfer).toHaveBeenCalledTimes(3);
      expect(mockLogger.info).not.toHaveBeenCalledWith(
        expect.stringContaining('Configuring user-initiated scheduled transfer')
      );
    });
  });

  describe('Real-world Scenarios', () => {
    it('should handle the exact ConversationalAgent example', () => {
      
      const amount = 100000000;
      const hbarAmount = amount / 100000000;
      const halfAmount = hbarAmount / 2;

      const input = {
        transfers: [
          { accountId: '0.0.123', amount: -halfAmount },
          { accountId: '0.0.789', amount: -halfAmount },
          { accountId: '0.0.98', amount: halfAmount * 2 },
        ],
      };

      const result = tool.specificInputSchema.safeParse(input);
      expect(result.success).toBe(true);
      
      builder.transferHbar(input);
      
      expect(Hbar.fromString).toHaveBeenCalledWith('-0.50000000');
      expect(Hbar.fromString).toHaveBeenCalledWith('1.00000000');
    });

    it('should correctly interpret LLM response for multi-sig request', () => {
      
      const llmGeneratedInput = {
        transfers: [
          { accountId: '0.0.123', amount: -0.5 },
          { accountId: '0.0.789', amount: -0.5 },
          { accountId: '0.0.98', amount: 1 },
        ],
        memo: 'Multi-signature transaction',
      };

      const result = tool.specificInputSchema.safeParse(llmGeneratedInput);
      expect(result.success).toBe(true);
      
      if (result.success) {
        expect(result.data.transfers[0].amount).toBe(-0.5);
        expect(result.data.transfers[1].amount).toBe(-0.5);
        expect(result.data.transfers[2].amount).toBe(1);
      }
    });
  });
});