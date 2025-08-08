import { Transaction } from '@hashgraph/sdk';
import { TransactionParser } from '@hashgraphonline/standards-sdk';
import type { ParsedTransaction } from '../types/transaction';
import { proto } from '@hashgraph/proto';

// TODO: move to standards-sdk
export class AutonomousTransactionParser {
  static async parseTransactionBytes(
    transactionBytes: string
  ): Promise<ParsedTransaction> {
    try {
      let bytes: Uint8Array;

      if (typeof transactionBytes === 'string') {
        if (transactionBytes.startsWith('0x')) {
          const hexString = transactionBytes.slice(2);
          bytes = new Uint8Array(Buffer.from(hexString, 'hex'));
        } else {
          bytes = new Uint8Array(Buffer.from(transactionBytes, 'base64'));
        }
      } else {
        throw new Error('Invalid transaction bytes format');
      }

      const transaction = Transaction.fromBytes(bytes);

      const result = this.parseFromTransactionObject(transaction);
      return result;
    } catch (error) {
      try {
        const fallbackResult = await this.parseWithFallback(transactionBytes);
        return fallbackResult;
      } catch (fallbackError) {
        const errorMessage =
          error instanceof Error ? error.message : 'Unknown error';
        const fallbackErrorMessage =
          fallbackError instanceof Error
            ? fallbackError.message
            : 'Unknown fallback error';
        throw new Error(
          `Transaction parsing failed: ${errorMessage}. Fallback also failed: ${fallbackErrorMessage}`
        );
      }
    }
  }

  private static extractTransactionBody(
    transaction: Transaction
  ): Uint8Array | null {
    try {
      const transactionBody = (transaction as any)._transactionBody;
      if (transactionBody) {
        return proto.SchedulableTransactionBody.encode(
          transactionBody
        ).finish();
      }
      return null;
    } catch (error) {
      console.warn('Failed to extract transaction body:', error);
      return null;
    }
  }

  private static parseFromTransactionObject(
    transaction: Transaction
  ): ParsedTransaction {
    const transactionMetadata = {
      transactionId: transaction.transactionId?.toString(),
      nodeAccountIds:
        transaction.nodeAccountIds?.map((id) => id.toString()) || [],
      maxTransactionFee:
        transaction.maxTransactionFee?.toTinybars().toString() || '0',
      memo: (transaction as any)._transactionMemo || undefined,
    };

    const hbarTransfers = this.extractHbarTransfersFromTransaction(transaction);

    const tokenTransfers =
      this.extractTokenTransfersFromTransaction(transaction);

    let transactionType = 'UNKNOWN';
    let humanReadableType = 'Unknown Transaction';

    if (hbarTransfers.length > 0) {
      transactionType = 'CRYPTOTRANSFER';
      humanReadableType = 'HBAR Transfer';
    } else if (tokenTransfers.length > 0) {
      transactionType = 'TOKENTRANSFER';
      humanReadableType = 'Token Transfer';
    }

    const result = {
      type: transactionType,
      humanReadableType,
      details: {
        ...transactionMetadata,
        transferCount: hbarTransfers.length + tokenTransfers.length,
      },
      transfers: hbarTransfers,
      tokenTransfers: tokenTransfers,
      memo: transactionMetadata.memo,
    };

    return result;
  }

  private static extractHbarTransfersFromTransaction(
    transaction: Transaction
  ): Array<{ accountId: string; amount: number }> {
    const transfers: Array<{ accountId: string; amount: number }> = [];

    try {
      const hbarTransfers = (transaction as any)._hbarTransfers;

      if (Array.isArray(hbarTransfers)) {
        hbarTransfers.forEach((transfer: any, index: number) => {
          if (transfer.accountId && transfer.amount) {
            const amountInTinybars = transfer.amount.toTinybars();
            const amountInHbar = Number(amountInTinybars) / 100000000;

            transfers.push({
              accountId: transfer.accountId.toString(),
              amount: amountInHbar,
            });
          }
        });
      } else {
      }
    } catch (error) {}

    return transfers;
  }

  private static extractTokenTransfersFromTransaction(
    transaction: Transaction
  ): Array<{
    tokenId: string;
    transfers: Array<{ accountId: string; amount: number }>;
  }> {
    const tokenTransfers: Array<{
      tokenId: string;
      transfers: Array<{ accountId: string; amount: number }>;
    }> = [];

    try {
      const tokenTransfersList = (transaction as any)._tokenTransfers;
      if (Array.isArray(tokenTransfersList)) {
        tokenTransfersList.forEach((tokenTransfer: any) => {
          if (tokenTransfer.tokenId && Array.isArray(tokenTransfer.transfers)) {
            const transfers = tokenTransfer.transfers.map((transfer: any) => ({
              accountId: transfer.accountId?.toString() || 'Unknown',
              amount: Number(transfer.amount || 0),
            }));

            tokenTransfers.push({
              tokenId: tokenTransfer.tokenId.toString(),
              transfers: transfers,
            });
          }
        });
      }
    } catch (error) {
      console.warn('Failed to extract token transfers:', error);
    }

    return tokenTransfers;
  }

  private static async parseWithFallback(
    transactionBytes: string
  ): Promise<ParsedTransaction> {
    try {
      const parsedTx = TransactionParser.parseTransactionBody(transactionBytes);

      const result = {
        type: parsedTx.type,
        humanReadableType: parsedTx.humanReadableType,
        details: parsedTx.raw || {},
        transfers: parsedTx.transfers,
        tokenTransfers: parsedTx.tokenTransfers,
        memo: parsedTx.memo,
        contractCall: parsedTx.contractCall,
        tokenCreation: parsedTx.tokenCreation,
        consensusSubmitMessage: parsedTx.consensusSubmitMessage,
      };

      return result;
    } catch (fallbackError) {
      const finalFallback = {
        type: 'UNKNOWN',
        humanReadableType: 'Unknown Transaction',
        details: {
          rawBytes: transactionBytes,
          error: 'Unable to parse transaction details',
        },
      };

      return finalFallback;
    }
  }

  static validateTransactionBytes(transactionBytes: string): boolean {
    if (!transactionBytes || typeof transactionBytes !== 'string') {
      return false;
    }

    const base64Regex = /^[A-Za-z0-9+/]*={0,2}$/;
    const hexRegex = /^0x[0-9a-fA-F]+$/;

    if (transactionBytes.startsWith('0x')) {
      return hexRegex.test(transactionBytes) && transactionBytes.length > 2;
    }

    return base64Regex.test(transactionBytes) && transactionBytes.length > 0;
  }

  static async isValidHederaTransaction(
    transactionBytes: string
  ): Promise<boolean> {
    try {
      if (!this.validateTransactionBytes(transactionBytes)) {
        return false;
      }

      let bytes: Uint8Array;

      if (transactionBytes.startsWith('0x')) {
        const hexString = transactionBytes.slice(2);
        bytes = new Uint8Array(Buffer.from(hexString, 'hex'));
      } else {
        bytes = new Uint8Array(Buffer.from(transactionBytes, 'base64'));
      }

      Transaction.fromBytes(bytes);
      return true;
    } catch {
      return false;
    }
  }
}
