import { describe, expect, beforeEach } from '@jest/globals';
import { TransferHbarTool } from '../../../src/plugins/hbar/TransferHbarTool';
import { AccountBuilder } from '../../../src/plugins/hbar/AccountBuilder';
import { TransferTransaction, Hbar, AccountId } from '@hashgraph/sdk';
import { TEST_HBAR_AMOUNTS, TEST_MESSAGES } from '../../test-constants';

jest.mock('@hashgraph/sdk');
jest.mock('hedera-agent-kit');

const _ACCOUNT_IDS = {
  PARTICIPANT_1: '0.0.800',
  PARTICIPANT_2: '0.0.801',
  TREASURY: '0.0.900'
} as const;


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
  operationalMode: string;
  userAccountId: string;
  logger: MockLogger;
}


interface BuilderWithLogger {
  logger: MockLogger;
  kit: MockHederaKit;
}


describe('Multi-Signature Transfer Scenarios', () => {
  let tool: TransferHbarTool;
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
      operationalMode: 'returnBytes',
      userAccountId: '0.0.456',
      logger: mockLogger,
    };

    tool = new TransferHbarTool({
      hederaKit: mockHederaKit as unknown,
      logger: mockLogger,
    } as unknown as ConstructorParameters<typeof TransferHbarTool>[0]);

    builder = new AccountBuilder(mockHederaKit as unknown as import('hedera-agent-kit').HederaAgentKit);
    (builder as unknown as BuilderWithLogger).logger = mockLogger;
    (builder as unknown as BuilderWithLogger).kit = mockHederaKit;
  });

  describe('Schema Validation for Multi-Signature Transfers', () => {
    test('should accept multi-signature transfer with decimal HBAR amounts', () => {
      const input = {
        transfers: [
          { accountId: '0.0.123', amount: -0.5 },
          { accountId: '0.0.789', amount: -0.5 },
          { accountId: '0.0.98', amount: 1 },
        ],
        memo: TEST_MESSAGES.MULTI_SIG_TREASURY,
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

    test('should handle complex multi-party transfers with varying amounts', () => {
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
    test('should process multi-signature transfer correctly in returnBytes mode', () => {
      const params = {
        transfers: [
          { accountId: '0.0.123', amount: -0.5 },
          { accountId: '0.0.789', amount: -0.5 },
          { accountId: '0.0.98', amount: 1 },
        ],
        memo: TEST_MESSAGES.MULTI_SIG_TREASURY,
      };

      builder.transferHbar(params, true);

      expect(Hbar.fromString).toHaveBeenCalledWith(TEST_HBAR_AMOUNTS.HALF_HBAR_NEGATIVE);
      expect(Hbar.fromString).toHaveBeenCalledWith(TEST_HBAR_AMOUNTS.HALF_HBAR_NEGATIVE);
      expect(Hbar.fromString).toHaveBeenCalledWith(TEST_HBAR_AMOUNTS.ONE_HBAR);
      
      expect(mockTransaction.addHbarTransfer).toHaveBeenCalledTimes(3);
      expect(mockTransaction.setTransactionMemo).toHaveBeenCalledWith(
        TEST_MESSAGES.MULTI_SIG_TREASURY
      );

      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining('Processing transfer: -0.5 HBAR')
      );
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining('Processing transfer: 1 HBAR')
      );
    });

    test('should handle the example case from tinybars conversion', () => {
      const halfAmount = 0.5;
      
      const params = {
        transfers: [
          { accountId: '0.0.123', amount: -halfAmount },
          { accountId: '0.0.789', amount: -halfAmount },
          { accountId: '0.0.98', amount: halfAmount * 2 },
        ],
      };

      builder.transferHbar(params);

      expect(Hbar.fromString).toHaveBeenCalledWith(TEST_HBAR_AMOUNTS.HALF_HBAR_NEGATIVE);
      expect(Hbar.fromString).toHaveBeenCalledWith(TEST_HBAR_AMOUNTS.ONE_HBAR);
      expect(mockTransaction.addHbarTransfer).toHaveBeenCalledTimes(3);
    });

    test('should handle scheduled transaction mode correctly', () => {
      mockHederaKit.operationalMode = 'provideBytes';
      builder = new AccountBuilder(mockHederaKit as unknown as import('hedera-agent-kit').HederaAgentKit);
      (builder as unknown as BuilderWithLogger).logger = mockLogger;
      (builder as unknown as BuilderWithLogger).kit = mockHederaKit;

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
    test('should handle the exact ConversationalAgent example', () => {
      
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
      
      expect(Hbar.fromString).toHaveBeenCalledWith(TEST_HBAR_AMOUNTS.HALF_HBAR_NEGATIVE);
      expect(Hbar.fromString).toHaveBeenCalledWith(TEST_HBAR_AMOUNTS.ONE_HBAR);
    });

    test('should correctly interpret LLM response for multi-sig request', () => {
      
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