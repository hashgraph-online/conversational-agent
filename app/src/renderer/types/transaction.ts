/**
 * Type definitions for parsed Hedera transactions.
 * Matches the structure returned by TransactionParser from standards-sdk.
 */
export interface ParsedTransaction {
  type: string;
  humanReadableType?: string;
  details: Record<string, any>;
  transfers?: Array<{
    accountId: string;
    amount: number;
  }>;
  tokenTransfers?: Array<{
    tokenId: string;
    transfers: Array<{
      accountId: string;
      amount: number;
    }>;
  }>;
  memo?: string;
  contractCall?: {
    contractId: string;
    functionName?: string;
    parameters?: any;
  };
  tokenCreation?: {
    name?: string;
    symbol?: string;
    decimals?: number;
  };
  consensusSubmitMessage?: {
    topicId: string;
    message: string;
  };
}