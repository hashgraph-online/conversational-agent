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
    amount: string | number;
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
    tokenName?: string;
    tokenSymbol?: string;
    initialSupply?: string;
    decimals?: number;
    maxSupply?: string;
    tokenType?: string;
    supplyType?: string;
    memo?: string;
    treasuryAccountId?: string;
  };
  consensusSubmitMessage?: {
    topicId: string;
    message: string;
  };
  airdrop?: {
    tokenTransfers?: Array<{
      tokenId: string;
      transfers: Array<{
        accountId: string;
        amount: string;
      }>;
    }>;
  };
}