import {
  ServerSigner,
  HederaConversationalAgent,
  getAllHederaCorePlugins,
  BasePlugin,
} from 'hedera-agent-kit';
import type {
  AgentOperationalMode,
  AgentResponse,
  HederaConversationalAgentConfig,
  MirrorNodeConfig,
} from 'hedera-agent-kit';
import { HCS10Plugin } from './plugins/hcs-10/HCS10Plugin';
import { HCS2Plugin } from './plugins/hcs-2/HCS2Plugin';
import { InscribePlugin } from './plugins/inscribe/InscribePlugin';
import { OpenConvaiState } from '@hashgraphonline/standards-agent-kit';
import type { IStateManager } from '@hashgraphonline/standards-agent-kit';
import {
  Logger,
  HederaMirrorNode,
  type NetworkType,
} from '@hashgraphonline/standards-sdk';
import { PrivateKey } from '@hashgraph/sdk';
import { getSystemMessage } from './config/system-message';

export interface ConversationalAgentOptions {
  accountId: string;
  privateKey: string;
  network?: NetworkType;
  openAIApiKey: string;
  openAIModelName?: string;
  verbose?: boolean;
  operationalMode?: AgentOperationalMode;
  userAccountId?: string;
  customSystemMessagePreamble?: string;
  customSystemMessagePostamble?: string;
  additionalPlugins?: BasePlugin[];
  stateManager?: IStateManager;
  scheduleUserTransactionsInBytesMode?: boolean;
  mirrorNodeConfig?: MirrorNodeConfig;
  disableLogging?: boolean;
  enabledPlugins?: string[];
}

/**
 * The ConversationalAgent class is an optional wrapper around the HederaConversationalAgent class,
 * which includes the OpenConvAIPlugin and the OpenConvaiState by default.
 * If you want to use a different plugin or state manager, you can pass them in the options.
 * This class is not required and the plugin can be used directly with the HederaConversationalAgent class.
 *
 * @param options - The options for the ConversationalAgent.
 * @returns A new instance of the ConversationalAgent class.
 */
export class ConversationalAgent {
  public conversationalAgent?: HederaConversationalAgent;
  public hcs10Plugin: HCS10Plugin;
  public hcs2Plugin: HCS2Plugin;
  public inscribePlugin: InscribePlugin;
  public stateManager: IStateManager;
  private options: ConversationalAgentOptions;
  private logger: Logger;

  constructor(options: ConversationalAgentOptions) {
    this.options = options;
    this.stateManager = options.stateManager || new OpenConvaiState();
    this.hcs10Plugin = new HCS10Plugin();
    this.hcs2Plugin = new HCS2Plugin();
    this.inscribePlugin = new InscribePlugin();
    this.logger = new Logger({ module: 'ConversationalAgent' });
  }

  async initialize(): Promise<void> {
    const {
      accountId,
      privateKey,
      network = 'testnet',
      openAIApiKey,
      openAIModelName = 'gpt-4o',
      verbose = false,
      operationalMode = 'autonomous',
      userAccountId,
      customSystemMessagePreamble,
      customSystemMessagePostamble,
      additionalPlugins = [],
      scheduleUserTransactionsInBytesMode,
      mirrorNodeConfig,
      disableLogging,
    } = this.options;

    if (!accountId || !privateKey) {
      throw new Error('Account ID and private key are required');
    }

    try {
      const mirrorNode = new HederaMirrorNode(network, this.logger);
      const accountInfo = await mirrorNode.requestAccount(accountId);
      const keyType = accountInfo?.key?._type || '';

      let privateKeyInstance: PrivateKey;
      if (keyType?.toLowerCase()?.includes('ecdsa')) {
        privateKeyInstance = PrivateKey.fromStringECDSA(privateKey);
      } else {
        privateKeyInstance = PrivateKey.fromStringED25519(privateKey);
      }

      const serverSigner = new ServerSigner(
        accountId,
        privateKeyInstance,
        network
      );

      const standardPlugins = [
        this.hcs10Plugin,
        this.hcs2Plugin,
        this.inscribePlugin,
      ];

      const corePlugins = getAllHederaCorePlugins();

      let allPlugins: BasePlugin[];

      if (this.options.enabledPlugins) {
        const enabledSet = new Set(this.options.enabledPlugins);
        const filteredPlugins = [...standardPlugins, ...corePlugins].filter(
          (plugin) => enabledSet.has(plugin.id)
        );
        allPlugins = [...filteredPlugins, ...additionalPlugins];
      } else {
        allPlugins = [...standardPlugins, ...corePlugins, ...additionalPlugins];
      }

      const agentConfig: HederaConversationalAgentConfig = {
        pluginConfig: {
          plugins: allPlugins,
          appConfig: {
            stateManager: this.stateManager,
          },
        },
        openAIApiKey,
        openAIModelName,
        verbose,
        operationalMode,
        userAccountId,
        customSystemMessagePreamble:
          customSystemMessagePreamble || getSystemMessage(accountId),
        ...(customSystemMessagePostamble !== undefined && {
          customSystemMessagePostamble,
        }),
        ...(scheduleUserTransactionsInBytesMode !== undefined && {
          scheduleUserTransactionsInBytesMode,
        }),
        ...(mirrorNodeConfig !== undefined && { mirrorNodeConfig }),
        ...(disableLogging !== undefined && { disableLogging }),
      };

      this.conversationalAgent = new HederaConversationalAgent(
        serverSigner,
        agentConfig
      );

      await this.conversationalAgent.initialize();
    } catch (error) {
      this.logger.error('Failed to initialize ConversationalAgent:', error);
      throw error;
    }
  }

  getPlugin(): HCS10Plugin {
    return this.hcs10Plugin;
  }

  getStateManager(): IStateManager {
    return this.stateManager;
  }

  getConversationalAgent(): HederaConversationalAgent {
    if (!this.conversationalAgent) {
      throw new Error(
        'ConversationalAgent not initialized. Call initialize() first.'
      );
    }
    return this.conversationalAgent;
  }

  async processMessage(
    message: string,
    chatHistory: {
      type: 'human' | 'ai';
      content: string;
    }[] = []
  ): Promise<AgentResponse> {
    if (!this.conversationalAgent) {
      throw new Error(
        'ConversationalAgent not initialized. Call initialize() first.'
      );
    }
    return this.conversationalAgent.processMessage(message, chatHistory);
  }

  /**
   * Create a ConversationalAgent with only HTS (Hedera Token Service) tools enabled
   */
  static withHTS(options: ConversationalAgentOptions): ConversationalAgent {
    return new ConversationalAgent({
      ...options,
      enabledPlugins: ['hts-token'],
    });
  }

  /**
   * Create a ConversationalAgent with only HCS-2 tools enabled
   */
  static withHCS2(options: ConversationalAgentOptions): ConversationalAgent {
    return new ConversationalAgent({
      ...options,
      enabledPlugins: ['hcs-2'],
    });
  }

  /**
   * Create a ConversationalAgent with only HCS-10 tools enabled
   */
  static withHCS10(options: ConversationalAgentOptions): ConversationalAgent {
    return new ConversationalAgent({
      ...options,
      enabledPlugins: ['hcs-10'],
    });
  }

  /**
   * Create a ConversationalAgent with only inscription tools enabled
   */
  static withInscribe(
    options: ConversationalAgentOptions
  ): ConversationalAgent {
    return new ConversationalAgent({
      ...options,
      enabledPlugins: ['inscribe'],
    });
  }

  /**
   * Create a ConversationalAgent with only account management tools enabled
   */
  static withAccount(options: ConversationalAgentOptions): ConversationalAgent {
    return new ConversationalAgent({
      ...options,
      enabledPlugins: ['account'],
    });
  }

  /**
   * Create a ConversationalAgent with only file service tools enabled
   */
  static withFileService(
    options: ConversationalAgentOptions
  ): ConversationalAgent {
    return new ConversationalAgent({
      ...options,
      enabledPlugins: ['file-service'],
    });
  }

  /**
   * Create a ConversationalAgent with only consensus service tools enabled
   */
  static withConsensusService(
    options: ConversationalAgentOptions
  ): ConversationalAgent {
    return new ConversationalAgent({
      ...options,
      enabledPlugins: ['consensus-service'],
    });
  }

  /**
   * Create a ConversationalAgent with only smart contract tools enabled
   */
  static withSmartContract(
    options: ConversationalAgentOptions
  ): ConversationalAgent {
    return new ConversationalAgent({
      ...options,
      enabledPlugins: ['smart-contract'],
    });
  }

  /**
   * Create a ConversationalAgent with all HCS standards plugins
   */
  static withAllStandards(
    options: ConversationalAgentOptions
  ): ConversationalAgent {
    return new ConversationalAgent({
      ...options,
      enabledPlugins: ['hcs-10', 'hcs-2', 'inscribe'],
    });
  }

  /**
   * Create a ConversationalAgent with minimal Hedera tools (no HCS standards)
   */
  static minimal(options: ConversationalAgentOptions): ConversationalAgent {
    return new ConversationalAgent({
      ...options,
      enabledPlugins: [],
    });
  }
}
