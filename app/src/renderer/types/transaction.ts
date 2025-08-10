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
  TokenAirdropData,
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
    tokenId?: string;
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
  consensusCreateTopic?: {
    topicId?: string;
    memo?: string;
    adminKey?: string;
    submitKey?: string;
    autoRenewPeriod?: string;
    autoRenewAccountId?: string;
  };
  consensusSubmitMessage?: {
    topicId?: string;
    message?: string;
    messageEncoding?: 'utf8' | 'base64';
  };
  consensusUpdateTopic?: {
    topicId?: string;
    memo?: string;
    adminKey?: string;
    submitKey?: string;
    autoRenewPeriod?: string;
    autoRenewAccountId?: string;
    clearAdminKey?: boolean;
    clearSubmitKey?: boolean;
  };
  consensusDeleteTopic?: {
    topicId?: string;
  };
  cryptoCreateAccount?: {
    accountId?: string;
    initialBalance?: string;
    key?: string;
    receiverSigRequired?: boolean;
    autoRenewPeriod?: string;
    memo?: string;
  };
  contractCreate?: {
    contractId?: string;
    initialBalance?: string;
    gas?: string;
    adminKey?: string;
    memo?: string;
  };
  scheduleCreate?: {
    scheduleId?: string;
    scheduledTransactionBody?: string;
    memo?: string;
    adminKey?: string;
  };
  fileCreate?: {
    fileId?: string;
    contents?: string;
    memo?: string;
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