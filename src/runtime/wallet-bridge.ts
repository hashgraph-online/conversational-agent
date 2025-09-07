export type WalletNetwork = 'mainnet' | 'testnet';

export interface WalletStatus {
  connected: boolean;
  accountId?: string;
  network?: WalletNetwork;
}

export interface WalletExecutorResult {
  transactionId: string;
}

export interface StartInscriptionResult {
  transactionBytes: string;
  tx_id?: string;
  topic_id?: string;
  status?: string;
  completed?: boolean;
}

export interface WalletBridgeProvider {
  status: () => Promise<WalletStatus> | WalletStatus;
  executeBytes: (
    base64: string,
    network: WalletNetwork
  ) => Promise<WalletExecutorResult>;
  startInscription?: (
    request: Record<string, unknown>,
    network: WalletNetwork
  ) => Promise<StartInscriptionResult>;
}

let providerRef: WalletBridgeProvider | null = null;

export function setWalletBridgeProvider(provider: WalletBridgeProvider): void {
  providerRef = provider;
}

export function getWalletBridgeProvider(): WalletBridgeProvider | null {
  return providerRef;
}
