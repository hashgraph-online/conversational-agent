/**
 * Type definitions for parsed Hedera transactions.
 * Matches the structure returned by TransactionParser from standards-sdk.
 */

export type { 
  AccountAmount,
  TokenAmount,
  ContractCallData,
  TokenCreationData,
  ConsensusSubmitMessageData,
  ParsedTransaction as SDKParsedTransaction
} from '@hashgraphonline/standards-sdk/dist/es/utils/transaction-parser-types';

export interface ParsedTransaction {
  type: string;
  humanReadableType?: string;
  details: Record<string, any>;
  transfers?: Array<{
    accountId: string;
    amount: string | number;
    isDecimal?: boolean;
  }>;
  tokenTransfers?: Array<{
    tokenId: string;
    accountId: string;
    amount: number;
  }>;
  memo?: string;
  contractCall?: {
    contractId: string;
    gas?: number;
    amount?: number;
    functionName?: string;
    parameters?: any;
    functionParameters?: string;
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
    topicId?: string;
    message?: string;
    messageEncoding?: 'utf8' | 'base64';
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
  tokenAirdrop?: {
    tokenTransfers?: Array<{
      tokenId: string;
      transfers: Array<{
        accountId: string;
        amount: string;
      }>;
    }>;
  };
}

export type SDKToLocalTransaction = (sdkTransaction: any) => ParsedTransaction;