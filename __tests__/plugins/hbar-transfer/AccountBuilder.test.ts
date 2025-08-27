import { describe, expect, beforeEach } from '@jest/globals';
import { AccountBuilder } from '../../../src/plugins/hbar/AccountBuilder';
import { TransferTransaction, Hbar, AccountId } from '@hashgraph/sdk';

jest.mock('@hashgraph/sdk');

interface MockLogger {
  info: jest.Mock;
  warn: jest.Mock;
  error: jest.Mock;
  debug: jest.Mock;
}

interface MockTransaction {
  addHbarTransfer: jest.Mock;
  setTransactionMemo: jest.Mock;
}

interface MockHederaKit {
  account: string;
  client: object;
  operationalMode: string;
  userAccountId: string;
  logger: MockLogger;
}


interface BuilderWithLogger {
  logger: MockLogger;
}

describe('AccountBuilder', () => {
  let builder: AccountBuilder;
  let mockHederaKit: MockHederaKit;
  let mockLogger: MockLogger;
  let mockTransaction: MockTransaction;

  beforeEach(() => {
    jest.clearAllMocks();

    mockLogger = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
    };

    mockTransaction = {
      addHbarTransfer: jest.fn().mockReturnThis(),
      setTransactionMemo: jest.fn().mockReturnThis(),
    };

    jest.mocked(TransferTransaction).mockImplementation(() => mockTransaction as unknown as TransferTransaction);
    
    jest.mocked(Hbar.fromString).mockImplementation((amount: string) => ({
      toString: () => `${amount} ℏ`,
      toTinybars: () => BigInt(Math.round(parseFloat(amount) * 100000000)),
      negated: () => ({
        toString: () => `-${amount} ℏ`,
        toTinybars: () => BigInt(Math.round(parseFloat(amount) * -100000000)),
      }),
    } as unknown as import('@hashgraph/sdk').Hbar));

    jest.mocked(AccountId.fromString).mockImplementation((id: string) => ({
      toString: () => id,
    } as unknown as import('@hashgraph/sdk').AccountId));

    mockHederaKit = {
      operationalMode: 'standard',
      userAccountId: '0.0.123',
      logger: mockLogger,
      account: '0.0.123',
      client: {},
    };

    builder = new AccountBuilder(mockHederaKit as unknown as import('hedera-agent-kit').HederaAgentKit);
    (builder as unknown as BuilderWithLogger).logger = mockLogger;
  });

  describe('transferHbar', () => {
    test('should handle decimal HBAR amounts correctly', () => {
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

    test('should handle string HBAR amounts', () => {
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

    test('should log processing details with HBAR unit', () => {
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

    test('should handle the problematic large number case', () => {
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

    test('should handle very small decimal amounts', () => {
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

    test('should process multiple transfers correctly', () => {
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

    test('should handle scheduled transfer mode for user-initiated transfers', () => {
      mockHederaKit.operationalMode = 'provideBytes';
      
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

    test('should throw error for empty transfers', () => {
      const params = {
        transfers: [],
      };

      expect(() => builder.transferHbar(params)).toThrow(
        'HbarTransferParams must include at least one transfer'
      );
    });
  });
});