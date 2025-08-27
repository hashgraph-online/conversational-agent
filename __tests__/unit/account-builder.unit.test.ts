import { AccountBuilder } from '../../src/plugins/hbar/AccountBuilder';
import { AccountId, Hbar, TransferTransaction } from '@hashgraph/sdk';
import { HederaAgentKit } from 'hedera-agent-kit';
import BigNumber from 'bignumber.js';

jest.mock('@hashgraph/sdk', () => ({
  AccountId: {
    fromString: jest.fn(),
  },
  Hbar: {
    fromString: jest.fn(),
  },
  TransferTransaction: jest.fn(),
}));

jest.mock('hedera-agent-kit', () => ({
  BaseServiceBuilder: class BaseServiceBuilder {
    protected kit: any;
    protected logger: any;

    constructor(hederaKit: any) {
      this.kit = hederaKit;
      this.logger = { info: jest.fn(), warn: jest.fn(), error: jest.fn() };
    }

    clearNotes() {}
    addNote() {}
    setCurrentTransaction() {}
  },
}));

const mockAccountId = AccountId as jest.Mocked<typeof AccountId>;
const mockHbar = Hbar as jest.Mocked<typeof Hbar>;
const mockTransferTransaction = TransferTransaction as jest.MockedClass<typeof TransferTransaction>;

describe('AccountBuilder', () => {
  let accountBuilder: AccountBuilder;
  let mockHederaKit: jest.Mocked<HederaAgentKit>;
  let mockTransaction: jest.Mocked<TransferTransaction>;
  let mockHbarInstance: jest.Mocked<Hbar>;

  beforeEach(() => {
    jest.clearAllMocks();

    mockHederaKit = {
      userAccountId: '0.0.123',
      operationalMode: 'returnBytes',
    } as any;

    mockTransaction = {
      addHbarTransfer: jest.fn(),
      setTransactionMemo: jest.fn(),
    } as any;

    mockHbarInstance = {
      toString: jest.fn(() => '1 ℏ'),
      toTinybars: jest.fn(() => new BigNumber('100000000')),
      negated: jest.fn(() => mockHbarInstance),
    } as any;

    mockTransferTransaction.mockImplementation(() => mockTransaction);
    mockHbar.fromString.mockReturnValue(mockHbarInstance);
    mockAccountId.fromString.mockImplementation((id) => ({ toString: () => id }) as any);

    accountBuilder = new AccountBuilder(mockHederaKit);
  });

  describe('constructor', () => {
    it('should create AccountBuilder with HederaAgentKit', () => {
      expect(accountBuilder).toBeInstanceOf(AccountBuilder);
    });
  });

  describe('transferHbar', () => {
    it('should throw error for empty transfers array', () => {
      expect(() => {
        accountBuilder.transferHbar({ transfers: [] });
      }).toThrow('HbarTransferParams must include at least one transfer.');
    });

    it('should throw error for undefined transfers', () => {
      expect(() => {
        accountBuilder.transferHbar({ transfers: undefined as any });
      }).toThrow('HbarTransferParams must include at least one transfer.');
    });

    it('should handle simple transfer with string amount', () => {
      const params = {
        transfers: [
          {
            accountId: '0.0.800',
            amount: '1.5',
          },
        ],
      };

      const result = accountBuilder.transferHbar(params);

      expect(mockTransferTransaction).toHaveBeenCalled();
      expect(mockAccountId.fromString).toHaveBeenCalledWith('0.0.800');
      expect(mockHbar.fromString).toHaveBeenCalled();
      expect(mockTransaction.addHbarTransfer).toHaveBeenCalled();
      expect(result).toBe(accountBuilder);
    });

    it('should handle simple transfer with number amount', () => {
      const params = {
        transfers: [
          {
            accountId: '0.0.800',
            amount: 2.75,
          },
        ],
      };

      accountBuilder.transferHbar(params);

      expect(mockHbar.fromString).toHaveBeenCalled();
      expect(mockTransaction.addHbarTransfer).toHaveBeenCalled();
    });

    it('should handle transfers with AccountId objects', () => {
      const mockAccountIdObj = { toString: () => '0.0.800' };
      const params = {
        transfers: [
          {
            accountId: mockAccountIdObj as any,
            amount: 1,
          },
        ],
      };

      accountBuilder.transferHbar(params);

      expect(mockAccountId.fromString).not.toHaveBeenCalled();
      expect(mockHbar.fromString).toHaveBeenCalled();
    });

    it('should handle user-initiated scheduled transfer', () => {
      mockHederaKit.operationalMode = 'provideBytes';
      
      const params = {
        transfers: [
          {
            accountId: '0.0.800',
            amount: 1,
          },
        ],
      };

      accountBuilder.transferHbar(params, true);

      expect(mockTransaction.addHbarTransfer).toHaveBeenCalledTimes(2); // recipient and sender
    });

    it('should skip user-initiated logic for multiple transfers', () => {
      mockHederaKit.operationalMode = 'provideBytes';
      
      const params = {
        transfers: [
          { accountId: '0.0.800', amount: 1 },
          { accountId: '0.0.801', amount: -1 },
        ],
      };

      accountBuilder.transferHbar(params, true);

      // Should process normally, not use user-initiated logic
      expect(mockTransaction.addHbarTransfer).toHaveBeenCalledTimes(2);
    });

    it('should skip user-initiated logic for negative amounts', () => {
      mockHederaKit.operationalMode = 'provideBytes';
      
      const params = {
        transfers: [
          {
            accountId: '0.0.800',
            amount: -1, // negative amount
          },
        ],
      };

      accountBuilder.transferHbar(params, true);

      // Should process normally, not add user transfer
      expect(mockTransaction.addHbarTransfer).toHaveBeenCalledTimes(1);
    });

    it('should handle multi-party transfers', () => {
      const params = {
        transfers: [
          { accountId: '0.0.800', amount: 5 },
          { accountId: '0.0.801', amount: -2 },
          { accountId: '0.0.802', amount: -3 },
        ],
      };

      accountBuilder.transferHbar(params, false);

      expect(mockTransaction.addHbarTransfer).toHaveBeenCalledTimes(3);
    });

    it('should adjust transfers when sum is not zero', () => {
      // Mock toTinybars to return values that don't sum to zero
      mockHbarInstance.toTinybars
        .mockReturnValueOnce(new BigNumber('500000000')) // 5 HBAR
        .mockReturnValueOnce(new BigNumber('-200000000')) // -2 HBAR  
        .mockReturnValueOnce(new BigNumber('-200000000')); // -2 HBAR (total: 1 HBAR off)

      const params = {
        transfers: [
          { accountId: '0.0.800', amount: 5 },
          { accountId: '0.0.801', amount: -2 },
          { accountId: '0.0.802', amount: -2 }, // Should be adjusted to -3
        ],
      };

      accountBuilder.transferHbar(params, false);

      expect(mockTransaction.addHbarTransfer).toHaveBeenCalledTimes(3);
      expect(mockHbar.fromString).toHaveBeenCalled(); // Multiple calls including adjustment
    });

    it('should set memo when provided', () => {
      const params = {
        transfers: [{ accountId: '0.0.800', amount: 1 }],
        memo: 'Test transfer memo',
      };

      accountBuilder.transferHbar(params);

      expect(mockTransaction.setTransactionMemo).toHaveBeenCalledWith('Test transfer memo');
    });

    it('should handle null memo gracefully', () => {
      const params = {
        transfers: [{ accountId: '0.0.800', amount: 1 }],
        memo: null as any,
      };

      accountBuilder.transferHbar(params);

      expect(mockTransaction.setTransactionMemo).not.toHaveBeenCalled();
    });

    it('should handle undefined memo', () => {
      const params = {
        transfers: [{ accountId: '0.0.800', amount: 1 }],
        memo: undefined,
      };

      accountBuilder.transferHbar(params);

      expect(mockTransaction.setTransactionMemo).not.toHaveBeenCalled();
    });

    it('should round amounts to 8 decimal places', () => {
      const params = {
        transfers: [
          {
            accountId: '0.0.800',
            amount: '1.123456789', // 9 decimal places
          },
        ],
      };

      accountBuilder.transferHbar(params);

      expect(mockHbar.fromString).toHaveBeenCalledWith('1.12345678'); // Rounded down to 8 decimals
    });

    it('should handle BigNumber amounts', () => {
      const bigNumberAmount = new BigNumber('3.14159265');
      const params = {
        transfers: [
          {
            accountId: '0.0.800',
            amount: bigNumberAmount as any,
          },
        ],
      };

      accountBuilder.transferHbar(params);

      expect(mockHbar.fromString).toHaveBeenCalled();
    });

    it('should process zero amounts', () => {
      const params = {
        transfers: [
          {
            accountId: '0.0.800',
            amount: 0,
          },
        ],
      };

      accountBuilder.transferHbar(params);

      expect(mockTransaction.addHbarTransfer).toHaveBeenCalled();
    });

    it('should handle very small amounts', () => {
      const params = {
        transfers: [
          {
            accountId: '0.0.800',
            amount: 0.00000001, // 1 tinybar
          },
        ],
      };

      accountBuilder.transferHbar(params);

      expect(mockHbar.fromString).toHaveBeenCalledWith('0.00000001');
    });

    it('should handle very large amounts', () => {
      const params = {
        transfers: [
          {
            accountId: '0.0.800',
            amount: '50000000000', // 50 billion HBAR
          },
        ],
      };

      accountBuilder.transferHbar(params);

      expect(mockHbar.fromString).toHaveBeenCalled();
    });

    it('should handle when userAccountId is not set', () => {
      const kitWithoutUser = {
        ...mockHederaKit,
        userAccountId: undefined,
        operationalMode: 'provideBytes',
      };

      const builderWithoutUser = new AccountBuilder(kitWithoutUser);
      const params = {
        transfers: [
          {
            accountId: '0.0.800',
            amount: 1,
          },
        ],
      };

      builderWithoutUser.transferHbar(params, true);

      // Should fall back to normal processing
      expect(mockTransaction.addHbarTransfer).toHaveBeenCalledTimes(1);
    });

    it('should handle when operationalMode is not provideBytes', () => {
      const kitWithDifferentMode = {
        ...mockHederaKit,
        operationalMode: 'returnBytes',
      };

      const builderWithDifferentMode = new AccountBuilder(kitWithDifferentMode);
      const params = {
        transfers: [
          {
            accountId: '0.0.800',
            amount: 1,
          },
        ],
      };

      builderWithDifferentMode.transferHbar(params, true);

      // Should fall back to normal processing
      expect(mockTransaction.addHbarTransfer).toHaveBeenCalledTimes(1);
    });
  });
});