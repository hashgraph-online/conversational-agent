import { Transaction } from '@hashgraph/sdk';
import { TransactionParser } from '@hashgraphonline/standards-sdk';
import type { ParsedTransaction } from '../types/transaction';
import { proto } from '@hashgraph/proto';

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
    // Debug logging
    console.log('[TransactionParser] Parsing transaction object:', {
      constructorName: (transaction as any).constructor?.name,
      hasTransactionBody: !!(transaction as any)._transactionBody,
      transactionBodyKeys: (transaction as any)._transactionBody ? Object.keys((transaction as any)._transactionBody) : [],
      directKeys: Object.keys(transaction as any).filter(k => k.startsWith('_')),
    });

    const transactionMetadata = {
      transactionId: transaction.transactionId?.toString(),
      nodeAccountIds:
        transaction.nodeAccountIds?.map((id) => id.toString()) || [],
      maxTransactionFee:
        transaction.maxTransactionFee?.toTinybars().toString() || '0',
      memo: (transaction as any)._transactionMemo || undefined,
    };

    const hbarTransfers = this.extractHbarTransfersFromTransaction(transaction);
    const tokenTransfers = this.extractTokenTransfersFromTransaction(transaction);
    const tokenCreationInfo = this.extractTokenCreationFromTransaction(transaction);
    const airdropInfo = this.extractAirdropFromTransaction(transaction);

    console.log('[TransactionParser] Extraction results:', {
      hbarTransfersCount: hbarTransfers.length,
      tokenTransfersCount: tokenTransfers.length,
      hasTokenCreationInfo: !!tokenCreationInfo,
      tokenCreationInfo: tokenCreationInfo,
      hasAirdropInfo: !!airdropInfo,
      airdropInfo: airdropInfo,
    });

    let transactionType = 'UNKNOWN';
    let humanReadableType = 'Unknown Transaction';

    if (tokenCreationInfo) {
      transactionType = 'TOKENCREATE';
      humanReadableType = 'Token Creation';
    } else if (airdropInfo) {
      transactionType = 'TOKENAIRDROP';
      humanReadableType = 'Token Airdrop';
    } else if (hbarTransfers.length > 0) {
      transactionType = 'CRYPTOTRANSFER';
      humanReadableType = 'HBAR Transfer';
    } else if (tokenTransfers.length > 0) {
      transactionType = 'TOKENTRANSFER';
      humanReadableType = 'Token Transfer';
    }

    console.log('[TransactionParser] Final transaction type:', {
      transactionType,
      humanReadableType,
    });

    const result = {
      type: transactionType,
      humanReadableType,
      details: {
        ...transactionMetadata,
        transferCount: hbarTransfers.length + tokenTransfers.length,
      },
      transfers: hbarTransfers,
      tokenTransfers: tokenTransfers,
      tokenCreation: tokenCreationInfo,
      airdrop: airdropInfo,
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

  private static extractTokenCreationFromTransaction(
    transaction: Transaction
  ): any | null {
    try {
      console.log('[TokenExtraction] Starting token creation extraction');
      
      // First check if transaction body has tokenCreation field
      const transactionBody = (transaction as any)._transactionBody;
      console.log('[TokenExtraction] Transaction body:', {
        hasTransactionBody: !!transactionBody,
        bodyKeys: transactionBody ? Object.keys(transactionBody) : [],
        tokenCreationField: transactionBody?.tokenCreation,
        tokenNameField: transactionBody?.tokenName,
        tokenSymbolField: transactionBody?.tokenSymbol,
      });
      
      if (transactionBody) {
        // Check for tokenCreation field in transaction body (most reliable)
        if (transactionBody.tokenCreation) {
          const tokenCreation = transactionBody.tokenCreation;
          console.log('[TokenExtraction] Found tokenCreation field:', tokenCreation);
          
          return {
            name: tokenCreation.name || 'Unknown Token',
            symbol: tokenCreation.symbol || 'UNKNOWN',
            initialSupply: tokenCreation.initialSupply?.toString() || '0',
            decimals: Number(tokenCreation.decimals || 0),
            maxSupply: tokenCreation.maxSupply?.toString(),
            tokenType: tokenCreation.tokenType?.toString?.() || tokenCreation.tokenType?._code || tokenCreation.tokenType || 'FUNGIBLE_COMMON',
            supplyType: tokenCreation.supplyType?.toString?.() || tokenCreation.supplyType?._code || tokenCreation.supplyType || 'INFINITE',
            memo: tokenCreation.memo || '',
            treasuryAccountId: tokenCreation.treasury?.toString() || 'Unknown',
          };
        }
        
        // Also check for direct token properties on transaction body
        if (transactionBody.tokenName || transactionBody.tokenSymbol) {
          console.log('[TokenExtraction] Found token properties on transaction body');
          return {
            name: transactionBody.tokenName || 'Unknown Token',
            symbol: transactionBody.tokenSymbol || 'UNKNOWN',
            initialSupply: transactionBody.initialSupply?.toString() || '0',
            decimals: Number(transactionBody.decimals || 0),
            maxSupply: transactionBody.maxSupply?.toString(),
            tokenType: transactionBody.tokenType?.toString?.() || transactionBody.tokenType?._code || transactionBody.tokenType || 'FUNGIBLE_COMMON',
            supplyType: transactionBody.supplyType?.toString?.() || transactionBody.supplyType?._code || transactionBody.supplyType || 'INFINITE',
            memo: transactionBody.tokenMemo || '',
            treasuryAccountId: transactionBody.treasuryAccountId?.toString() || 'Unknown',
          };
        }
      }

      // Check if it's a TokenCreateTransaction instance (less reliable due to deserialization)
      const isTokenCreateTx = (transaction as any).constructor.name === 'TokenCreateTransaction';
      console.log('[TokenExtraction] Constructor check:', {
        constructorName: (transaction as any).constructor?.name,
        isTokenCreateTx,
      });
      
      if (isTokenCreateTx) {
        // Extract data directly from TokenCreateTransaction properties
        const tx = transaction as any;
        console.log('[TokenExtraction] TokenCreateTransaction properties:', {
          _tokenName: tx._tokenName,
          tokenName: tx.tokenName,
          _tokenSymbol: tx._tokenSymbol,
          tokenSymbol: tx.tokenSymbol,
        });
        
        const result = {
          name: tx._tokenName || tx.tokenName || 'Unknown Token',
          symbol: tx._tokenSymbol || tx.tokenSymbol || 'UNKNOWN',
          initialSupply: (tx._initialSupply || tx.initialSupply)?.toString() || '0',
          decimals: Number((tx._decimals || tx.decimals) || 0),
          maxSupply: (tx._maxSupply || tx.maxSupply)?.toString(),
          tokenType: (tx._tokenType || tx.tokenType)?.toString?.() || (tx._tokenType || tx.tokenType)?._code || tx._tokenType || tx.tokenType || 'FUNGIBLE_COMMON',
          supplyType: (tx._supplyType || tx.supplyType)?.toString?.() || (tx._supplyType || tx.supplyType)?._code || tx._supplyType || tx.supplyType || 'INFINITE',
          memo: tx._tokenMemo || tx.tokenMemo || '',
          treasuryAccountId: (tx._treasuryAccountId || tx.treasuryAccountId)?.toString() || 'Unknown',
          autoRenewPeriod: (tx._autoRenewPeriod || tx.autoRenewPeriod)?.toString(),
          expirationTime: (tx._expirationTime || tx.expirationTime)?.toString(),
        };

        console.log('[TokenExtraction] Extracted from TokenCreateTransaction:', result);
        return result;
      }

      // Check for token properties directly on the transaction object
      const tx = transaction as any;
      console.log('[TokenExtraction] Direct property check:', {
        _tokenName: tx._tokenName,
        tokenName: tx.tokenName,
        _tokenSymbol: tx._tokenSymbol,
        tokenSymbol: tx.tokenSymbol,
        hasTokenProps: !!(tx._tokenName || tx.tokenName || tx._tokenSymbol || tx.tokenSymbol),
      });
      
      if (tx._tokenName || tx.tokenName || tx._tokenSymbol || tx.tokenSymbol) {
        const result = {
          name: tx._tokenName || tx.tokenName || 'Unknown Token',
          symbol: tx._tokenSymbol || tx.tokenSymbol || 'UNKNOWN',
          initialSupply: (tx._initialSupply || tx.initialSupply)?.toString() || '0',
          decimals: Number((tx._decimals || tx.decimals) || 0),
          maxSupply: (tx._maxSupply || tx.maxSupply)?.toString(),
          tokenType: (tx._tokenType || tx.tokenType)?.toString?.() || (tx._tokenType || tx.tokenType)?._code || tx._tokenType || tx.tokenType || 'FUNGIBLE_COMMON',
          supplyType: (tx._supplyType || tx.supplyType)?.toString?.() || (tx._supplyType || tx.supplyType)?._code || tx._supplyType || tx.supplyType || 'INFINITE',
          memo: tx._tokenMemo || tx.tokenMemo || '',
          treasuryAccountId: (tx._treasuryAccountId || tx.treasuryAccountId)?.toString() || 'Unknown',
        };
        
        console.log('[TokenExtraction] Extracted from direct properties:', result);
        return result;
      }

      console.log('[TokenExtraction] No token creation data found');
      return null;
    } catch (error) {
      console.warn('Failed to extract token creation info:', error);
      return null;
    }
  }

  private static extractAirdropFromTransaction(
    transaction: Transaction
  ): any | null {
    try {
      console.log('[AirdropExtraction] Starting airdrop extraction');
      
      // Check transaction body for airdrop fields
      const transactionBody = (transaction as any)._transactionBody;
      
      if (transactionBody) {
        console.log('[AirdropExtraction] Transaction body keys:', Object.keys(transactionBody));
        
        // Check for tokenAirdrop field
        if (transactionBody.tokenAirdrop) {
          const airdrop = transactionBody.tokenAirdrop;
          console.log('[AirdropExtraction] Found tokenAirdrop field:', airdrop);
          
          const tokenTransfers = airdrop.tokenTransfers || [];
          const airdropData = {
            tokenTransfers: tokenTransfers.map((transfer: any) => ({
              tokenId: transfer.token?.toString() || 'Unknown',
              transfers: (transfer.transfers || []).map((t: any) => ({
                accountId: t.accountID?.toString() || 'Unknown',
                amount: t.amount?.toString() || '0',
              })),
            })),
          };
          
          console.log('[AirdropExtraction] Extracted airdrop data:', airdropData);
          return airdropData;
        }
      }
      
      // Check if it's an AirdropTokenTransaction instance
      const isAirdropTx = (transaction as any).constructor.name === 'TokenAirdropTransaction';
      console.log('[AirdropExtraction] Constructor check:', {
        constructorName: (transaction as any).constructor?.name,
        isAirdropTx,
      });
      
      if (isAirdropTx) {
        const tx = transaction as any;
        
        // Try to extract token transfers from the transaction
        const tokenTransfersList = tx._tokenTransfers || [];
        
        if (tokenTransfersList.length > 0) {
          const airdropData = {
            tokenTransfers: tokenTransfersList.map((transfer: any) => ({
              tokenId: transfer.tokenId?.toString() || 'Unknown',
              transfers: (transfer.transfers || []).map((t: any) => ({
                accountId: t.accountId?.toString() || 'Unknown',
                amount: t.amount?.toString() || '0',
              })),
            })),
          };
          
          console.log('[AirdropExtraction] Extracted from TokenAirdropTransaction:', airdropData);
          return airdropData;
        }
      }
      
      console.log('[AirdropExtraction] No airdrop data found');
      return null;
    } catch (error) {
      console.warn('Failed to extract airdrop info:', error);
      return null;
    }
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
