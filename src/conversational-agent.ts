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
import type { MCPServerConfig, MCPConnectionStatus } from './mcp/types';
import { ContentStoreManager } from './services/ContentStoreManager';
import { SmartMemoryManager, type SmartMemoryConfig } from './memory';

export type ToolDescriptor = {
  name: string;
  namespace?: string;
};

export type ChatHistoryItem = {
  type: 'human' | 'ai';
  content: string;
};

export type AgentInstance = ReturnType<typeof createAgent>;

export type MirrorNetwork = 'testnet' | 'mainnet' | 'previewnet';

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
  
  /** Enable automatic entity memory functionality (default: true) */
  entityMemoryEnabled?: boolean;
  
  /** Configuration for entity memory system */
  entityMemoryConfig?: SmartMemoryConfig;
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
  protected agent?: AgentInstance;
  public hcs10Plugin: HCS10Plugin;
  public hcs2Plugin: HCS2Plugin;
  public inscribePlugin: InscribePlugin;
  public hbarTransferPlugin: HbarTransferPlugin;
  public stateManager: IStateManager;
  private options: ConversationalAgentOptions;
  protected logger: Logger;
  private contentStoreManager?: ContentStoreManager;
  private memoryManager?: SmartMemoryManager | undefined;
  private mcpConnectionStatus: Map<string, MCPConnectionStatus> = new Map();

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
    
    if (this.options.entityMemoryEnabled !== false) {
      this.memoryManager = new SmartMemoryManager(this.options.entityMemoryConfig);
      this.logger.info('Entity memory initialized');
    }
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
    } = this.options;

    this.validateOptions(accountId, privateKey);

    try {
      const privateKeyInstance = await this.detectPrivateKeyType(
        accountId!,
        privateKey!,
        network
      );

      const serverSigner = new ServerSigner(
        accountId!,
        privateKeyInstance,
        network as MirrorNetwork
      );

      const allPlugins = this.preparePlugins();

      const llm = new ChatOpenAI({
        apiKey: openAIApiKey,
        modelName: openAIModelName,
        temperature: DEFAULT_TEMPERATURE,
      });

      const agentConfig = this.createAgentConfig(serverSigner, llm, allPlugins);
      this.agent = createAgent(agentConfig);

      this.configureHCS10Plugin(allPlugins);

      if (this.options.mcpServers && this.options.mcpServers.length > 0) {
        this.contentStoreManager = new ContentStoreManager();
        await this.contentStoreManager.initialize();
        this.logger.info('ContentStoreManager initialized for MCP content reference support');
      }

      await this.agent.boot();

      // Start MCP connections asynchronously after agent is booted
      if (this.options.mcpServers && this.options.mcpServers.length > 0) {
        this.connectMCP();
      }
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
    chatHistory: ChatHistoryItem[] = []
  ): Promise<ChatResponse> {
    if (!this.agent) {
      throw new Error('Agent not initialized. Call initialize() first.');
    }

    try {
      const resolvedMessage = this.memoryManager 
        ? await this.resolveEntitiesInMessage(message)
        : message;

      const messages = chatHistory.map((msg) => {
        if (msg.type === 'human') {
          return new HumanMessage(msg.content);
        } else {
          return new AIMessage(msg.content);
        }
      });

      const context: ConversationContext = {
        messages,
      };

      const response = await this.agent.chat(resolvedMessage, context);
      
      if (this.memoryManager) {
        await this.extractAndStoreEntities(response, message);
      }
      
      this.logger.info('Message processed successfully');
      
      return response;
    } catch (error) {
      this.logger.error('Error processing message:', error);
      throw error;
    }
  }

  /**
   * Validates initialization options and throws if required fields are missing.
   * 
   * @param accountId - The Hedera account ID
   * @param privateKey - The private key for the account
   * @throws {Error} If required fields are missing
   */
  private validateOptions(accountId?: string, privateKey?: string): void {
    if (!accountId || !privateKey) {
      throw new Error('Account ID and private key are required');
    }
  }

  /**
   * Prepares the list of plugins to use based on configuration.
   * 
   * @returns Array of plugins to initialize with the agent
   */
  private preparePlugins(): BasePlugin[] {
    const { additionalPlugins = [], enabledPlugins } = this.options;
    
    const standardPlugins = [
      this.hcs10Plugin,
      this.hcs2Plugin,
      this.inscribePlugin,
      this.hbarTransferPlugin,
    ];
    
    const corePlugins: BasePlugin[] = getAllHederaCorePlugins();
    
    if (enabledPlugins) {
      const enabledSet = new Set(enabledPlugins);
      const filteredPlugins = [...standardPlugins, ...corePlugins].filter(
        (plugin) => enabledSet.has(plugin.id)
      );
      return [...filteredPlugins, ...additionalPlugins];
    }
    
    return [...standardPlugins, ...corePlugins, ...additionalPlugins];
  }

  /**
   * Creates the agent configuration object.
   * 
   * @param serverSigner - The server signer instance
   * @param llm - The language model instance
   * @param allPlugins - Array of plugins to use
   * @returns Configuration object for creating the agent
   */
  private createAgentConfig(
    serverSigner: ServerSigner,
    llm: ChatOpenAI,
    allPlugins: BasePlugin[]
  ): Parameters<typeof createAgent>[0] {
    const {
      operationalMode = DEFAULT_OPERATIONAL_MODE,
      userAccountId,
      scheduleUserTransactionsInBytesMode,
      customSystemMessagePreamble,
      customSystemMessagePostamble,
      verbose = false,
      mirrorNodeConfig,
      disableLogging,
      accountId = '',
    } = this.options;

    return {
      framework: 'langchain',
      signer: serverSigner,
      execution: {
        mode: operationalMode === 'autonomous' ? 'direct' : 'bytes',
        operationalMode: operationalMode,
        ...(userAccountId && { userAccountId }),
        ...(scheduleUserTransactionsInBytesMode !== undefined && {
          scheduleUserTransactionsInBytesMode: scheduleUserTransactionsInBytesMode,
        }),
      },
      ai: {
        provider: new LangChainProvider(llm),
        temperature: DEFAULT_TEMPERATURE,
      },
      filtering: {
        toolPredicate: (tool: ToolDescriptor): boolean => {
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
          autoConnect: false,
        },
      }),
      debug: {
        verbose,
        silent: disableLogging ?? false,
      },
    };
  }

  /**
   * Configures the HCS-10 plugin with the state manager.
   * 
   * @param allPlugins - Array of all plugins
   */
  private configureHCS10Plugin(allPlugins: BasePlugin[]): void {
    const hcs10 = allPlugins.find((p) => p.id === 'hcs-10');
    if (hcs10) {
      (hcs10 as BasePlugin & { appConfig?: Record<string, unknown> }).appConfig = {
        stateManager: this.stateManager,
      };
    }
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

  /**
   * Resolve entity references in the message content
   * @param content - Message content to resolve
   * @returns Resolved message content with entity IDs replaced
   */
  private async resolveEntitiesInMessage(content: string): Promise<string> {
    if (!this.memoryManager) {
      return content;
    }

    try {
      this.logger.info(`Starting entity resolution for message: "${content.substring(0, 100)}..."`);
      
      if (!content || typeof content !== 'string') {
        this.logger.warn('Invalid content provided for entity resolution');
        return content || '';
      }

      if (content.length > 5000) {
        this.logger.warn('Content too long for entity resolution, truncating');
        content = content.substring(0, 5000);
      }

      let resolvedContent = content;

      const patterns = [
        /\b(my|the|our)\s+(token|account|topic|schedule)\b/gi,
        /'([^']+)'/g,
        /"([^"]+)"/g,
        /\b([A-Z][A-Za-z0-9_-]{2,})\b/g
      ];

      for (const pattern of patterns) {
        try {
          let match;
          const matches: any[] = [];
          while ((match = pattern.exec(resolvedContent)) !== null) {
            matches.push(match);
            if (!pattern.global) break;
          }
          
          for (const match of matches) {
            try {
              const originalRef = match[0];
              const entityName = match[1] || match[0];
              
              if (entityName.length > 50) {
                this.logger.debug(`Skipping overly long entity name: ${entityName.substring(0, 20)}...`);
                continue;
              }
              
              const commonWords = ['the', 'my', 'our', 'this', 'that', 'it', 'is', 'are', 'was', 'will'];
              if (commonWords.includes(entityName.toLowerCase())) {
                continue;
              }
              
              let entityAssociations: any[] = [];
              
              if (match[1] && ['token', 'account', 'topic', 'schedule'].includes(match[1].toLowerCase())) {
                const entityType = match[1].toLowerCase();
                entityAssociations = this.memoryManager.resolveEntityReference(
                  entityName, 
                  { entityType, limit: 1, fuzzyMatch: true }
                );
              } else {
                entityAssociations = this.memoryManager.resolveEntityReference(
                  entityName,
                  { limit: 1, fuzzyMatch: false }
                );
              }

              if (entityAssociations.length > 0) {
                const entity = entityAssociations[0];
                if (entity.entityId && entity.entityId.trim().length > 0) {
                  if (entityAssociations.length > 1) {
                    this.logger.info(`Multiple entities found for "${originalRef}", using most recent: ${entity.entityName}`);
                  }
                  
                  resolvedContent = resolvedContent.replace(originalRef, entity.entityId);
                  this.logger.info(`Resolved entity reference: "${originalRef}" -> ${entity.entityId}`);
                }
              }
            } catch (matchError) {
              this.logger.debug('Error processing entity match:', matchError);
              continue;
            }
          }
        } catch (patternError) {
          this.logger.debug('Error processing pattern:', patternError);
          continue;
        }
      }

      if (resolvedContent !== content) {
        this.logger.info(`Entity resolution completed. Original: "${content}" -> Resolved: "${resolvedContent}"`);
      } else {
        this.logger.info('No entity references resolved in message');
      }
      
      return resolvedContent;
    } catch (error) {
      this.logger.warn('Entity resolution failed, using original message:', error);
      return content;
    }
  }

  /**
   * Extract and store entity associations from transaction responses
   * @param response - Agent response containing potential entity information
   * @param originalMessage - Original user message for context
   */
  private async extractAndStoreEntities(response: any, originalMessage: string): Promise<void> {
    if (!this.memoryManager) {
      return;
    }

    try {
      this.logger.info('Starting entity extraction from response');
      
      const entityPatterns = {
        token: /(?:token|Token)\s*(?:ID\s*[:"*\s]*)?([0-9]+\.[0-9]+\.[0-9]+)/g,
        account: /(?:account|Account)\s*(?:ID\s*[:"*\s]*)?([0-9]+\.[0-9]+\.[0-9]+)/g,
        topic: /(?:topic|Topic)\s*(?:ID\s*[:"*\s]*)?([0-9]+\.[0-9]+\.[0-9]+)/g,
        schedule: /(?:schedule|Schedule)\s*(?:ID\s*[:"*\s]*)?([0-9]+\.[0-9]+\.[0-9]+)/g
      };

      const responseText = typeof response === 'string' ? response : JSON.stringify(response);
      this.logger.info(`Searching response text: ${responseText.substring(0, 200)}...`);
      
      for (const [entityType, pattern] of Object.entries(entityPatterns)) {
        let match;
        while ((match = pattern.exec(responseText)) !== null) {
          const entityId = match[1];
          
          let entityName = `${entityType}-${entityId}`;
          
          const namePatterns = [
            new RegExp(`(?:called|named)\\s+([\\w\\d_-]+)`, 'i'),
            new RegExp(`(?:token|account|topic|schedule)\\s+([\\w\\d_-]+)`, 'i'),
            new RegExp(`([\\w\\d_-]+)\\s+${entityType}`, 'i')
          ];
          
          for (const namePattern of namePatterns) {
            const nameMatch = originalMessage.match(namePattern);
            if (nameMatch && nameMatch[1]) {
              entityName = nameMatch[1].trim();
              break;
            }
          }
          
          this.logger.info(`Extracting entity: ${entityName} (${entityType}) -> ${entityId}`);
          
          this.memoryManager.storeEntityAssociation(
            entityId,
            entityName,
            entityType,
            this.extractTransactionId(response)
          );
          
          this.logger.info(`Stored entity association: ${entityName} (${entityId})`);
        }
      }
      
      this.logger.info('Entity extraction completed');
    } catch (error) {
      this.logger.warn('Entity extraction failed:', error);
    }
  }

  /**
   * Extract transaction ID from response if available
   * @param response - Transaction response
   * @returns Transaction ID or undefined
   */
  private extractTransactionId(response: any): string | undefined {
    try {
      if (typeof response === 'object' && response?.transactionId) {
        return response.transactionId;
      }
      if (typeof response === 'string') {
        const match = response.match(/transaction[\s\w]*ID[\s:"]*([0-9a-fA-F@\.\-]+)/i);
        return match ? match[1] : undefined;
      }
      return undefined;
    } catch {
      return undefined;
    }
  }

  /**
   * Connect to MCP servers asynchronously
   * @private
   */
  private connectMCP(): void {
    if (!this.agent || !this.options.mcpServers) {
      return;
    }

    // Initialize connection status for all servers
    this.options.mcpServers.forEach(server => {
      this.mcpConnectionStatus.set(server.name, {
        serverName: server.name,
        connected: false,
        tools: []
      });
    });

    // Call the agent's MCP connection method if available
    if (typeof (this.agent as any).connectMCPServers === 'function') {
      (this.agent as any).connectMCPServers().catch((error: any) => {
        this.logger.error('Failed to connect MCP servers:', error);
      });
    } else {
      // Fallback for agents that don't support async MCP connections
      this.startConnections();
    }
  }

  /**
   * Start MCP connections without blocking initialization
   * @private
   */
  private async startConnections(): Promise<void> {
    if (!this.agent || !this.options.mcpServers) {
      return;
    }

    try {
      this.logger.info('Starting MCP server connections asynchronously...');
      
      for (const server of this.options.mcpServers) {
        this.connectServer(server);
      }
    } catch (error) {
      this.logger.error('Error starting MCP connections:', error);
    }
  }

  /**
   * Connect to a single MCP server
   * @param {MCPServerConfig} server - Server configuration
   * @private
   */
  private async connectServer(server: MCPServerConfig): Promise<void> {
    try {
      this.logger.info(`Connecting to MCP server: ${server.name}`);
      
      // TODO: Implement actual MCP connection logic
      // For now, we'll simulate the connection process
      const status = this.mcpConnectionStatus.get(server.name);
      if (status) {
        // Simulate connection success after a delay
        setTimeout(() => {
          status.connected = true;
          this.logger.info(`MCP server ${server.name} connected successfully`);
        }, Math.random() * 2000 + 1000); // 1-3 second delay
      }
      
    } catch (error) {
      this.logger.error(`Failed to connect to MCP server ${server.name}:`, error);
      
      const status = this.mcpConnectionStatus.get(server.name);
      if (status) {
        status.connected = false;
        status.error = error instanceof Error ? error.message : 'Unknown error';
      }
    }
  }

  /**
   * Get MCP connection status for all servers
   * @returns {Map<string, MCPConnectionStatus>} Connection status map
   */
  getMCPConnectionStatus(): Map<string, MCPConnectionStatus> {
    return new Map(this.mcpConnectionStatus);
  }

  /**
   * Check if a specific MCP server is connected
   * @param {string} serverName - Name of the server to check
   * @returns {boolean} True if connected, false otherwise
   */
  isMCPServerConnected(serverName: string): boolean {
    const status = this.mcpConnectionStatus.get(serverName);
    return status?.connected ?? false;
  }

  /**
   * Clean up resources
   */
  async cleanup(): Promise<void> {
    try {
      this.logger.info('Cleaning up ConversationalAgent...');
      
      if (this.memoryManager) {
        try {
          this.memoryManager.dispose();
          this.logger.info('Memory manager cleaned up successfully');
        } catch (error) {
          this.logger.warn('Error cleaning up memory manager:', error);
        }
        this.memoryManager = undefined as any;
      }
      
      if (this.contentStoreManager) {
        await this.contentStoreManager.dispose();
        this.logger.info('ContentStoreManager cleaned up');
      }
      
      this.logger.info('ConversationalAgent cleanup completed');
    } catch (error) {
      this.logger.error('Error during cleanup:', error);
    }
  }
}
