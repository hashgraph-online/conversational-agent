import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AccountBuilder } from '../../../src/plugins/hbar-transfer/AccountBuilder';
import { HederaAgentKit } from 'hedera-agent-kit';
import { Logger } from '@hashgraphonline/standards-sdk';
import { TransferTransaction, Hbar, AccountId } from '@hashgraph/sdk';
import BigNumber from 'bignumber.js';

vi.mock('@hashgraph/sdk');

describe('AccountBuilder', () => {
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
      operationalMode: 'standard',
      userAccountId: '0.0.123',
      logger: mockLogger,
    } as any;

    builder = new AccountBuilder(mockHederaKit);
    (builder as any).logger = mockLogger;
  });

  describe('transferHbar', () => {
    it('should handle decimal HBAR amounts correctly', () => {
      const params = {
        transfers: [
          { accountId: '0.0.800', amount: 1 },
          { accountId: '0.0.801', amount: 0.5 },
          { accountId: '0.0.802', amount: -1.5 },
        ],
        memo: 'Test decimal amounts',
      };

      builder.transferHbar(params);

      expect(Hbar.fromString).toHaveBeenCalledWith('1.00000000');
      expect(Hbar.fromString).toHaveBeenCalledWith('0.50000000');
      expect(Hbar.fromString).toHaveBeenCalledWith('-1.50000000');

      expect(mockTransaction.addHbarTransfer).toHaveBeenCalledTimes(3);
      expect(mockTransaction.setTransactionMemo).toHaveBeenCalledWith('Test decimal amounts');
    });

    it('should handle string HBAR amounts', () => {
      const params = {
        transfers: [
          { accountId: '0.0.800', amount: '1.25' },
          { accountId: '0.0.801', amount: '-1.25' },
        ],
      };

      builder.transferHbar(params);

      expect(Hbar.fromString).toHaveBeenCalledWith('1.25000000');
      expect(Hbar.fromString).toHaveBeenCalledWith('-1.25000000');
      expect(mockTransaction.addHbarTransfer).toHaveBeenCalledTimes(2);
    });

    it('should log processing details with HBAR unit', () => {
      const params = {
        transfers: [
          { accountId: '0.0.800', amount: 1 },
        ],
      };

      builder.transferHbar(params);

      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining('Processing transfer: 1 HBAR')
      );
    });

    it('should handle the problematic large number case', () => {
      const params = {
        transfers: [
          { accountId: '0.0.800', amount: 10000000 },
        ],
      };

      builder.transferHbar(params);

      expect(Hbar.fromString).toHaveBeenCalledWith('10000000.00000000');
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining('Processing transfer: 10000000 HBAR')
      );
    });

    it('should handle very small decimal amounts', () => {
      const params = {
        transfers: [
          { accountId: '0.0.800', amount: 0.00000001 },
          { accountId: '0.0.801', amount: -0.00000001 },
        ],
      };

      builder.transferHbar(params);

      expect(Hbar.fromString).toHaveBeenCalledWith('0.00000001');
      expect(Hbar.fromString).toHaveBeenCalledWith('-0.00000001');
    });

    it('should process multiple transfers correctly', () => {
      const params = {
        transfers: [
          { accountId: '0.0.800', amount: -2 },
          { accountId: '0.0.801', amount: 1 },
          { accountId: '0.0.802', amount: 1 },
        ],
      };

      builder.transferHbar(params);

      expect(Hbar.fromString).toHaveBeenCalledWith('-2.00000000');
      expect(Hbar.fromString).toHaveBeenCalledWith('1.00000000');
      expect(Hbar.fromString).toHaveBeenCalledTimes(3);
      
      expect(mockTransaction.addHbarTransfer).toHaveBeenCalledTimes(3);
    });

    it('should handle scheduled transfer mode for user-initiated transfers', () => {
      mockHederaKit.operationalMode = 'provideBytes' as any;
      
      const params = {
        transfers: [
          { accountId: '0.0.800', amount: 5 },
        ],
      };

      builder.transferHbar(params, true);

      expect(mockTransaction.addHbarTransfer).toHaveBeenCalledTimes(2);
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining('Configuring user-initiated scheduled transfer')
      );
    });

    it('should throw error for empty transfers', () => {
      const params = {
        transfers: [],
      };

      expect(() => builder.transferHbar(params)).toThrow(
        'HbarTransferParams must include at least one transfer'
      );
    });
  });
});