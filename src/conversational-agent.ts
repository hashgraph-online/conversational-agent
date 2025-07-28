import {
  ServerSigner,
  getAllHederaCorePlugins,
  BasePlugin,
} from 'hedera-agent-kit';
import {
  HederaMirrorNode,
  Logger,
  type NetworkType,
} from '@hashgraphonline/standards-sdk';
import { createAgent } from './agent-factory';
import { LangChainProvider } from './providers';
import type { ChatResponse, ConversationContext } from './base-agent';
import { ChatOpenAI } from '@langchain/openai';
import { HumanMessage, AIMessage } from '@langchain/core/messages';
import type { AgentOperationalMode, MirrorNodeConfig } from 'hedera-agent-kit';
import { HCS10Plugin } from './plugins/hcs-10/HCS10Plugin';
import { HCS2Plugin } from './plugins/hcs-2/HCS2Plugin';
import { InscribePlugin } from './plugins/inscribe/InscribePlugin';
import { HbarTransferPlugin } from './plugins/hbar-transfer/HbarTransferPlugin';
import { OpenConvaiState } from '@hashgraphonline/standards-agent-kit';
import type { IStateManager } from '@hashgraphonline/standards-agent-kit';
import { PrivateKey } from '@hashgraph/sdk';
import { getSystemMessage } from './config/system-message';
import type { MCPServerConfig } from './mcp/types';

const DEFAULT_MODEL_NAME = 'gpt-4o';
const DEFAULT_TEMPERATURE = 0.1;
const DEFAULT_NETWORK = 'testnet';
const DEFAULT_OPERATIONAL_MODE: AgentOperationalMode = 'autonomous';

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
  toolFilter?: (tool: { name: string; namespace?: string }) => boolean;
  mcpServers?: MCPServerConfig[];
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
  private agent?: ReturnType<typeof createAgent>;
  public hcs10Plugin: HCS10Plugin;
  public hcs2Plugin: HCS2Plugin;
  public inscribePlugin: InscribePlugin;
  public hbarTransferPlugin: HbarTransferPlugin;
  public stateManager: IStateManager;
  private options: ConversationalAgentOptions;
  private logger: Logger;

  constructor(options: ConversationalAgentOptions) {
    this.options = options;
    this.stateManager = options.stateManager || new OpenConvaiState();
    this.hcs10Plugin = new HCS10Plugin();
    this.hcs2Plugin = new HCS2Plugin();
    this.inscribePlugin = new InscribePlugin();
    this.hbarTransferPlugin = new HbarTransferPlugin();
    this.logger = new Logger({
      module: 'ConversationalAgent',
      silent: options.disableLogging || false,
    });
  }

  /**
   * Initialize the conversational agent with Hedera network connection and AI configuration
   * @throws {Error} If account ID or private key is missing
   * @throws {Error} If initialization fails
   */
  async initialize(): Promise<void> {
    const {
      accountId,
      privateKey,
      network = DEFAULT_NETWORK,
      openAIApiKey,
      openAIModelName = DEFAULT_MODEL_NAME,
      verbose = false,
      operationalMode = DEFAULT_OPERATIONAL_MODE,
      userAccountId,
      customSystemMessagePreamble,
      customSystemMessagePostamble,
      additionalPlugins = [],
      mirrorNodeConfig,
      disableLogging,
      scheduleUserTransactionsInBytesMode,
    } = this.options;

    if (!accountId || !privateKey) {
      throw new Error('Account ID and private key are required');
    }

    try {
      const privateKeyInstance = await this.detectPrivateKeyType(
        accountId,
        privateKey,
        network
      );

      const serverSigner = new ServerSigner(
        accountId,
        privateKeyInstance,
        network as 'testnet' | 'mainnet' | 'previewnet'
      );

      const standardPlugins = [
        this.hcs10Plugin,
        this.hcs2Plugin,
        this.inscribePlugin,
        this.hbarTransferPlugin,
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

      const llm = new ChatOpenAI({
        apiKey: openAIApiKey,
        modelName: openAIModelName,
        temperature: DEFAULT_TEMPERATURE,
      });

      this.agent = createAgent({
        framework: 'langchain',
        signer: serverSigner,
        execution: {
          mode: operationalMode === 'autonomous' ? 'direct' : 'bytes',
          operationalMode: operationalMode,
          ...(userAccountId && { userAccountId }),
          ...(scheduleUserTransactionsInBytesMode !== undefined && {
            scheduleUserTransactions: scheduleUserTransactionsInBytesMode,
          }),
        },
        ai: {
          provider: new LangChainProvider(llm),
          temperature: DEFAULT_TEMPERATURE,
        },
        filtering: {
          toolPredicate: (tool) => {
            if (tool.name === 'hedera-account-transfer-hbar') return false;
            if (this.options.toolFilter && !this.options.toolFilter(tool)) {
              return false;
            }
            return true;
          },
        },
        messaging: {
          systemPreamble:
            customSystemMessagePreamble || getSystemMessage(accountId),
          ...(customSystemMessagePostamble && { systemPostamble: customSystemMessagePostamble }),
          conciseMode: true,
        },
        extensions: {
          plugins: allPlugins,
          ...(mirrorNodeConfig && {
            mirrorConfig: mirrorNodeConfig as Record<string, unknown>,
          }),
        },
        ...(this.options.mcpServers && {
          mcp: {
            servers: this.options.mcpServers,
            autoConnect: true,
          },
        }),
        debug: {
          verbose,
          silent: disableLogging ?? false,
        },
      });

      const hcs10 = allPlugins.find((p) => p.id === 'hcs-10');
      if (hcs10) {
        (hcs10 as { appConfig?: Record<string, unknown> }).appConfig = {
          stateManager: this.stateManager,
        };
      }

      await this.agent.boot();
    } catch (error) {
      this.logger.error('Failed to initialize ConversationalAgent:', error);
      throw error;
    }
  }

  /**
   * Get the HCS-10 plugin instance
   * @returns {HCS10Plugin} The HCS-10 plugin instance
   */
  getPlugin(): HCS10Plugin {
    return this.hcs10Plugin;
  }

  /**
   * Get the state manager instance
   * @returns {IStateManager} The state manager instance
   */
  getStateManager(): IStateManager {
    return this.stateManager;
  }

  /**
   * Get the underlying agent instance
   * @returns {ReturnType<typeof createAgent>} The agent instance
   * @throws {Error} If agent is not initialized
   */
  getAgent(): ReturnType<typeof createAgent> {
    if (!this.agent) {
      throw new Error('Agent not initialized. Call initialize() first.');
    }
    return this.agent;
  }

  /**
   * Get the conversational agent instance (alias for getAgent)
   * @returns {ReturnType<typeof createAgent>} The agent instance
   * @throws {Error} If agent is not initialized
   */
  getConversationalAgent(): ReturnType<typeof createAgent> {
    return this.getAgent();
  }

  /**
   * Process a message through the conversational agent
   * @param {string} message - The message to process
   * @param {Array<{type: 'human' | 'ai'; content: string}>} chatHistory - Previous chat history
   * @returns {Promise<ChatResponse>} The agent's response
   * @throws {Error} If agent is not initialized
   */
  async processMessage(
    message: string,
    chatHistory: {
      type: 'human' | 'ai';
      content: string;
    }[] = []
  ): Promise<ChatResponse> {
    if (!this.agent) {
      throw new Error('Agent not initialized. Call initialize() first.');
    }

    const messages = chatHistory.map((msg) =>
      msg.type === 'human'
        ? new HumanMessage(msg.content)
        : new AIMessage(msg.content)
    );

    const context: ConversationContext = {
      messages,
    };

    return this.agent.chat(message, context);
  }

  /**
   * Create a ConversationalAgent with specific plugins enabled
   */
  private static withPlugins(
    options: ConversationalAgentOptions,
    plugins: string[]
  ): ConversationalAgent {
    return new ConversationalAgent({
      ...options,
      enabledPlugins: plugins,
    });
  }

  /**
   * Create a ConversationalAgent with only HTS (Hedera Token Service) tools enabled
   */
  static withHTS(options: ConversationalAgentOptions): ConversationalAgent {
    return this.withPlugins(options, ['hts-token']);
  }

  /**
   * Create a ConversationalAgent with only HCS-2 tools enabled
   */
  static withHCS2(options: ConversationalAgentOptions): ConversationalAgent {
    return this.withPlugins(options, ['hcs-2']);
  }

  /**
   * Create a ConversationalAgent with only HCS-10 tools enabled
   */
  static withHCS10(options: ConversationalAgentOptions): ConversationalAgent {
    return this.withPlugins(options, ['hcs-10']);
  }

  /**
   * Create a ConversationalAgent with only inscription tools enabled
   */
  static withInscribe(
    options: ConversationalAgentOptions
  ): ConversationalAgent {
    return this.withPlugins(options, ['inscribe']);
  }

  /**
   * Create a ConversationalAgent with only account management tools enabled
   */
  static withAccount(options: ConversationalAgentOptions): ConversationalAgent {
    return this.withPlugins(options, ['account']);
  }

  /**
   * Create a ConversationalAgent with only file service tools enabled
   */
  static withFileService(
    options: ConversationalAgentOptions
  ): ConversationalAgent {
    return this.withPlugins(options, ['file-service']);
  }

  /**
   * Create a ConversationalAgent with only consensus service tools enabled
   */
  static withConsensusService(
    options: ConversationalAgentOptions
  ): ConversationalAgent {
    return this.withPlugins(options, ['consensus-service']);
  }

  /**
   * Create a ConversationalAgent with only smart contract tools enabled
   */
  static withSmartContract(
    options: ConversationalAgentOptions
  ): ConversationalAgent {
    return this.withPlugins(options, ['smart-contract']);
  }

  /**
   * Create a ConversationalAgent with all HCS standards plugins
   */
  static withAllStandards(
    options: ConversationalAgentOptions
  ): ConversationalAgent {
    return this.withPlugins(options, ['hcs-10', 'hcs-2', 'inscribe']);
  }

  /**
   * Create a ConversationalAgent with minimal Hedera tools (no HCS standards)
   */
  static minimal(options: ConversationalAgentOptions): ConversationalAgent {
    return this.withPlugins(options, []);
  }

  /**
   * Create a ConversationalAgent with MCP servers configured
   */
  static withMCP(
    options: ConversationalAgentOptions,
    mcpServers: MCPServerConfig[]
  ): ConversationalAgent {
    return new ConversationalAgent({
      ...options,
      mcpServers,
    });
  }

  /**
   * Detect the private key type by querying the account info from mirror node
   * @param {string} accountId - The Hedera account ID
   * @param {string} privateKey - The private key string
   * @param {NetworkType} network - The Hedera network
   * @returns {Promise<PrivateKey>} The appropriate PrivateKey instance
   */
  private async detectPrivateKeyType(
    accountId: string,
    privateKey: string,
    network: NetworkType
  ): Promise<PrivateKey> {
    const mirrorNode = new HederaMirrorNode(network as 'testnet' | 'mainnet');
    const accountInfo = await mirrorNode.requestAccount(accountId);

    const keyType = accountInfo?.key?._type || '';

    if (keyType?.toLowerCase()?.includes('ecdsa')) {
      return PrivateKey.fromStringECDSA(privateKey);
    } else {
      return PrivateKey.fromStringED25519(privateKey);
    }
  }
}
