import { z } from 'zod';
import { HbarTransferParams } from './types';
import { AccountBuilder } from './AccountBuilder';
import { BaseHederaTransactionTool, BaseServiceBuilder } from 'hedera-agent-kit';

const HbarTransferInputSchema = z.object({
  accountId: z
    .string()
    .describe('Account ID for the transfer (e.g., "0.0.xxxx").'),
  amount: z
    .union([z.number(), z.string()])
    .describe(
      'HBAR amount in decimal format (e.g., 1 for 1 HBAR, 0.5 for 0.5 HBAR). Positive for credit, negative for debit. DO NOT multiply by 10^8 for tinybars - just use the HBAR amount directly.'
    ),
});

const TransferHbarZodSchemaCore = z.object({
  transfers: z
    .array(HbarTransferInputSchema)
    .min(1)
    .describe(
      'Array of ALL transfers for this transaction. For multi-party transfers (e.g., "A sends 5 to C and B sends 3 to C"), include all transfers here: [{accountId: "A", amount: -5}, {accountId: "B", amount: -3}, {accountId: "C", amount: 8}]. Amounts must sum to zero.'
    ),
  memo: z.string().optional().describe('Optional. Memo for the transaction.'),
});

/**
 * A Hedera transaction tool for transferring HBAR between accounts.
 * Supports single and multi-party transfers with automatic balance validation.
 * Extends BaseHederaTransactionTool to handle HBAR transfer transactions on the Hedera network.
 */
export class TransferHbarTool extends BaseHederaTransactionTool<
  typeof TransferHbarZodSchemaCore
> {
  name = 'hedera-account-transfer-hbar-v2';
  description =
    'PRIMARY TOOL FOR HBAR TRANSFERS: Transfers HBAR between accounts. Supports multiple transfers in a single transaction - when multiple accounts need to send/receive HBAR (e.g., "A sends 5 HBAR to C and B sends 3 HBAR to C"), include ALL transfers in one transfers array. The sum of all transfers must equal zero. Use this for scheduled transactions and multi-signature scenarios.';
  specificInputSchema = TransferHbarZodSchemaCore;
  namespace = 'account';


  /**
   * Creates and returns the service builder for account operations.
   * 
   * @returns BaseServiceBuilder instance configured for account operations
   */
  protected getServiceBuilder(): BaseServiceBuilder {
    return new AccountBuilder(this.hederaKit) as BaseServiceBuilder;
  }

  /**
   * Executes the HBAR transfer using the provided builder and arguments.
   * Validates that all transfers sum to zero before execution.
   * 
   * @param builder - The service builder instance for executing transactions
   * @param specificArgs - The validated transfer parameters including transfers array and optional memo
   * @returns Promise that resolves when the transfer is complete
   */
  protected async callBuilderMethod(
    builder: BaseServiceBuilder,
    specificArgs: z.infer<typeof TransferHbarZodSchemaCore>
  ): Promise<void> {
    await (builder as AccountBuilder).transferHbar(
      specificArgs as unknown as HbarTransferParams
    );
  }
}