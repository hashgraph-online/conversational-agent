import { AccountId, Hbar } from '@hashgraph/sdk';

export interface HbarTransferInput {
  accountId: string | AccountId;
  amount: string | number | Hbar;
}

export interface HbarTransferParams {
  transfers: HbarTransferInput[];
  memo?: string;
}