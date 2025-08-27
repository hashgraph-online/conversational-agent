import { TransferHbarTool } from '../../src/plugins/hbar/TransferHbarTool';
import { AccountBuilder } from '../../src/plugins/hbar/AccountBuilder';
import { BaseHederaTransactionTool } from 'hedera-agent-kit';

jest.mock('../../src/plugins/hbar/AccountBuilder');
jest.mock('hedera-agent-kit', () => ({
  BaseHederaTransactionTool: class BaseHederaTransactionTool {
    hederaKit: any;
    name = '';
    description = '';
    namespace = '';
    specificInputSchema: any;

    constructor() {}

    protected getServiceBuilder() {
      return null;
    }

    protected async callBuilderMethod() {}
  },
  BaseServiceBuilder: class BaseServiceBuilder {
    constructor(hederaKit: any) {}
  },
}));

const mockAccountBuilder = AccountBuilder as jest.MockedClass<typeof AccountBuilder>;

describe('TransferHbarTool', () => {
  let transferTool: TransferHbarTool;
  let mockBuilder: jest.Mocked<AccountBuilder>;

  beforeEach(() => {
    jest.clearAllMocks();

    mockBuilder = {
      transferHbar: jest.fn().mockReturnThis(),
    } as any;

    mockAccountBuilder.mockImplementation(() => mockBuilder);

    transferTool = new TransferHbarTool();
  });

  describe('tool properties', () => {
    it('should have correct tool metadata', () => {
      expect(transferTool.name).toBe('hedera-account-transfer-hbar-v2');
      expect(transferTool.description).toContain('PRIMARY TOOL FOR HBAR TRANSFERS');
      expect(transferTool.namespace).toBe('account');
      expect(transferTool.specificInputSchema).toBeDefined();
    });

    it('should extend BaseHederaTransactionTool', () => {
      expect(transferTool).toBeInstanceOf(BaseHederaTransactionTool);
    });
  });

  describe('getServiceBuilder', () => {
    it('should return AccountBuilder instance', () => {
      const builder = transferTool['getServiceBuilder']();

      expect(mockAccountBuilder).toHaveBeenCalledWith(transferTool['hederaKit']);
      expect(builder).toBe(mockBuilder);
    });
  });

  describe('callBuilderMethod', () => {
    it('should call transferHbar on AccountBuilder', async () => {
      const mockArgs = {
        transfers: [
          {
            accountId: '0.0.800',
            amount: 1.5,
          },
        ],
        memo: 'Test transfer',
      };

      await transferTool['callBuilderMethod'](mockBuilder, mockArgs);

      expect(mockBuilder.transferHbar).toHaveBeenCalledWith(mockArgs);
    });

    it('should handle transfers without memo', async () => {
      const mockArgs = {
        transfers: [
          {
            accountId: '0.0.800',
            amount: 2.0,
          },
        ],
      };

      await transferTool['callBuilderMethod'](mockBuilder, mockArgs);

      expect(mockBuilder.transferHbar).toHaveBeenCalledWith(mockArgs);
    });

    it('should handle multiple transfers', async () => {
      const mockArgs = {
        transfers: [
          { accountId: '0.0.800', amount: 5 },
          { accountId: '0.0.801', amount: -2.5 },
          { accountId: '0.0.802', amount: -2.5 },
        ],
        memo: 'Multi-party transfer',
      };

      await transferTool['callBuilderMethod'](mockBuilder, mockArgs);

      expect(mockBuilder.transferHbar).toHaveBeenCalledWith(mockArgs);
    });

    it('should cast args to HbarTransferParams type', async () => {
      const mockArgs = {
        transfers: [{ accountId: '0.0.800', amount: 1 }],
      };

      await transferTool['callBuilderMethod'](mockBuilder, mockArgs);

      expect(mockBuilder.transferHbar).toHaveBeenCalledWith(mockArgs);
    });
  });

  describe('schema validation', () => {
    it('should have proper transfer schema structure', () => {
      const schema = transferTool.specificInputSchema;
      
      expect(schema).toBeDefined();
      expect(schema._def).toBeDefined();
      expect(schema._def.typeName).toBe('ZodObject');
    });

    it('should validate transfer input with required fields', () => {
      const validInput = {
        transfers: [
          {
            accountId: '0.0.800',
            amount: 1.5,
          },
        ],
      };

      const result = transferTool.specificInputSchema.safeParse(validInput);
      expect(result.success).toBe(true);
    });

    it('should validate transfer input with memo', () => {
      const validInput = {
        transfers: [
          {
            accountId: '0.0.800',
            amount: 1.5,
          },
        ],
        memo: 'Test memo',
      };

      const result = transferTool.specificInputSchema.safeParse(validInput);
      expect(result.success).toBe(true);
    });

    it('should accept string amounts', () => {
      const validInput = {
        transfers: [
          {
            accountId: '0.0.800',
            amount: '2.75',
          },
        ],
      };

      const result = transferTool.specificInputSchema.safeParse(validInput);
      expect(result.success).toBe(true);
    });

    it('should accept number amounts', () => {
      const validInput = {
        transfers: [
          {
            accountId: '0.0.800',
            amount: 3.14,
          },
        ],
      };

      const result = transferTool.specificInputSchema.safeParse(validInput);
      expect(result.success).toBe(true);
    });

    it('should require at least one transfer', () => {
      const invalidInput = {
        transfers: [],
      };

      const result = transferTool.specificInputSchema.safeParse(invalidInput);
      expect(result.success).toBe(false);
    });

    it('should require transfers array', () => {
      const invalidInput = {};

      const result = transferTool.specificInputSchema.safeParse(invalidInput);
      expect(result.success).toBe(false);
    });

    it('should require accountId in each transfer', () => {
      const invalidInput = {
        transfers: [
          {
            amount: 1.5,
          },
        ],
      };

      const result = transferTool.specificInputSchema.safeParse(invalidInput);
      expect(result.success).toBe(false);
    });

    it('should require amount in each transfer', () => {
      const invalidInput = {
        transfers: [
          {
            accountId: '0.0.800',
          },
        ],
      };

      const result = transferTool.specificInputSchema.safeParse(invalidInput);
      expect(result.success).toBe(false);
    });

    it('should accept multiple transfers', () => {
      const validInput = {
        transfers: [
          { accountId: '0.0.800', amount: 5 },
          { accountId: '0.0.801', amount: -2.5 },
          { accountId: '0.0.802', amount: -2.5 },
        ],
      };

      const result = transferTool.specificInputSchema.safeParse(validInput);
      expect(result.success).toBe(true);
    });

    it('should accept negative amounts', () => {
      const validInput = {
        transfers: [
          {
            accountId: '0.0.800',
            amount: -1.5,
          },
        ],
      };

      const result = transferTool.specificInputSchema.safeParse(validInput);
      expect(result.success).toBe(true);
    });

    it('should accept zero amounts', () => {
      const validInput = {
        transfers: [
          {
            accountId: '0.0.800',
            amount: 0,
          },
        ],
      };

      const result = transferTool.specificInputSchema.safeParse(validInput);
      expect(result.success).toBe(true);
    });
  });
});