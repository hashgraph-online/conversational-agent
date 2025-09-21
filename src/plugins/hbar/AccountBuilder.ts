import { AccountId, Hbar, TransferTransaction } from '@hashgraph/sdk';
import BigNumber from 'bignumber.js';
import { HederaAgentKit, BaseServiceBuilder } from 'hedera-agent-kit';
import { HbarTransferParams } from './types';

/**
 * Custom AccountBuilder that properly handles HBAR decimal conversion
 */
export class AccountBuilder extends BaseServiceBuilder {
  constructor(hederaKit: HederaAgentKit) {
    super(hederaKit);
  }

  /**
   * Transfers HBAR between accounts with proper decimal handling
   */
  public transferHbar(
    params: HbarTransferParams,
    isUserInitiated: boolean = true
  ): this {
    this.clearNotes();
    const transaction = new TransferTransaction();

    if (!params.transfers || params.transfers.length === 0) {
      throw new Error('HbarTransferParams must include at least one transfer.');
    }

    let netZeroInTinybars = new BigNumber(0);
    let userTransferProcessedForScheduling = false;

    if (
      isUserInitiated &&
      this.kit.userAccountId &&
      (this.kit.operationalMode as string) === 'provideBytes' &&
      params.transfers.length === 1
    ) {
      const receiverTransfer = params.transfers[0];
      const amountValue =
        typeof receiverTransfer.amount === 'string' ||
        typeof receiverTransfer.amount === 'number'
          ? receiverTransfer.amount
          : receiverTransfer.amount.toString();

      const amountBigNum = new BigNumber(amountValue);

      if (amountBigNum.isPositive()) {
        const recipientAccountId =
          typeof receiverTransfer.accountId === 'string'
            ? AccountId.fromString(receiverTransfer.accountId)
            : receiverTransfer.accountId;

        const roundedAmount = amountBigNum.toFixed(8, BigNumber.ROUND_DOWN);
        const sdkHbarAmount = Hbar.fromString(roundedAmount);

        this.logger.info(
          `[AccountBuilder.transferHbar] Configuring user-initiated scheduled transfer: ${sdkHbarAmount.toString()} from ${
            this.kit.userAccountId
          } to ${recipientAccountId.toString()}`
        );

        this.addNote(
          `Configured HBAR transfer from your account (${
            this.kit.userAccountId
          }) to ${recipientAccountId.toString()} for ${sdkHbarAmount.toString()}.`
        );

        transaction.addHbarTransfer(recipientAccountId, sdkHbarAmount);
        transaction.addHbarTransfer(
          AccountId.fromString(this.kit.userAccountId),
          sdkHbarAmount.negated()
        );

        userTransferProcessedForScheduling = true;
      }
    }

    if (!userTransferProcessedForScheduling) {
      const processedTransfers: Array<{
        accountId: AccountId;
        amount: BigNumber;
        hbar: Hbar;
      }> = [];

      for (const transferInput of params.transfers) {
        const accountId =
          typeof transferInput.accountId === 'string'
            ? AccountId.fromString(transferInput.accountId)
            : transferInput.accountId;

        const amountValue =
          typeof transferInput.amount === 'string' ||
          typeof transferInput.amount === 'number'
            ? transferInput.amount
            : transferInput.amount.toString();

        const amountBigNum = new BigNumber(amountValue);
        const roundedAmount = amountBigNum.toFixed(8, BigNumber.ROUND_DOWN);

        this.logger.info(
          `Processing transfer: ${amountValue} HBAR (rounded to ${roundedAmount}) for account ${accountId.toString()}`
        );

        const sdkHbarAmount = Hbar.fromString(roundedAmount);
        processedTransfers.push({
          accountId,
          amount: amountBigNum,
          hbar: sdkHbarAmount,
        });

        const tinybarsContribution = sdkHbarAmount.toTinybars();
        netZeroInTinybars = netZeroInTinybars.plus(
          tinybarsContribution.toString()
        );
      }

      if (!netZeroInTinybars.isZero()) {
        this.logger.warn(
          `Transfer sum not zero: ${netZeroInTinybars.toString()} tinybars off. Adjusting last transfer.`
        );

        if (processedTransfers.length > 0) {
          const lastTransfer =
            processedTransfers[processedTransfers.length - 1];
          const adjustment = netZeroInTinybars.dividedBy(-100000000);
          const adjustedAmount = lastTransfer.amount.plus(adjustment);
          const adjustedRounded = adjustedAmount.toFixed(
            8,
            BigNumber.ROUND_DOWN
          );
          lastTransfer.hbar = Hbar.fromString(adjustedRounded);

          this.logger.info(
            `Adjusted last transfer for ${lastTransfer.accountId.toString()} to ${adjustedRounded} HBAR`
          );
        }
      }

      for (const transfer of processedTransfers) {
        transaction.addHbarTransfer(transfer.accountId, transfer.hbar);
      }
    }

    if (typeof params.memo !== 'undefined') {
      if (params.memo === null) {
        this.logger.warn('Received null for memo in transferHbar.');
      } else {
        transaction.setTransactionMemo(params.memo);
      }
    }

    this.setCurrentTransaction(transaction);
    return this;
  }
}
