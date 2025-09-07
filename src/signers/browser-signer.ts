import {
  AccountId,
  Client,
  PrivateKey,
  PublicKey,
  Transaction,
  TransactionReceipt,
} from '@hashgraph/sdk';
import { AbstractSigner } from 'hedera-agent-kit';
import {
  HederaMirrorNode,
  Logger,
  type NetworkType,
} from '@hashgraphonline/standards-sdk';

/**
 * BrowserSigner (bytes-only)
 *
 * Minimal signer compatible with HederaAgentKit in bytes/Provide Bytes mode.
 * - Does NOT hold a private key
 * - Cannot execute transactions; only provides identity and network context
 * - getOperatorPrivateKey() throws to signal absence of a local key
 */
export class BrowserSigner extends AbstractSigner {
  private readonly account: AccountId;
  private readonly network: 'mainnet' | 'testnet';
  private readonly client: Client;
  private readonly exec: ((
    base64: string,
    network: 'mainnet' | 'testnet'
  ) => Promise<{ transactionId: string }>) | null;
  private readonly ephemeralKey: PrivateKey;

  getAccountId(): AccountId {
    return this.account;
  }

  getNetwork(): 'mainnet' | 'testnet' {
    return this.network;
  }

  constructor(
    accountId: string,
    network: 'mainnet' | 'testnet',
    executor?: (
      base64: string,
      network: 'mainnet' | 'testnet'
    ) => Promise<{ transactionId: string }>
  ) {
    super();
    this.account = AccountId.fromString(accountId);
    this.network = network;
    this.client =
      network === 'mainnet' ? Client.forMainnet() : Client.forTestnet();
    this.exec = executor ?? null;
    this.ephemeralKey = PrivateKey.generateED25519();
  }

  /**
   * Returns an auto-generated ED25519 key for client wiring only.
   * Do not use for signing; wallet performs signing in renderer.
   */
  getOperatorPrivateKey(): PrivateKey {
    return this.ephemeralKey;
  }

  getClient(): Client {
    return this.client;
  }

  async signAndExecuteTransaction(
    tx: Transaction
  ): Promise<TransactionReceipt> {
    if (!this.exec) {
      throw new Error('BrowserSigner executor not available');
    }
    if (!tx.isFrozen()) {
      await tx.freezeWith(this.client);
    }
    const base64 = Buffer.from(tx.toBytes()).toString('base64');
    const { transactionId } = await this.exec(base64, this.network);
    const mirror = new HederaMirrorNode(this.network);
    const deadline = Date.now() + 60000;
    while (Date.now() < deadline) {
      try {
        const details = await mirror.getTransaction(transactionId);
        if (details && details.result) {
          return TransactionReceipt.fromBytes(
            Buffer.from(details.result, 'base64')
          );
        }
      } catch {}
      await new Promise((r) => setTimeout(r, 1200));
    }
    return TransactionReceipt.fromBytes(Buffer.from(''));
  }

  override async getPublicKey(): Promise<PublicKey> {
    const network: NetworkType =
      this.network === 'mainnet' ? 'mainnet' : 'testnet';
    const mirror = new HederaMirrorNode(
      network,
      new Logger({ module: 'BrowserSigner' })
    );
    const anyKey: any = await mirror.getPublicKey(this.account.toString());
    const keyStr = typeof anyKey?.toString === 'function' ? anyKey.toString() : String(anyKey);
    return PublicKey.fromString(keyStr);
  }
}

export default BrowserSigner;
