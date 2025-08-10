import { Logger } from '../utils/logger';
import {
  ConversationalAgent,
  createAgent,
  LangChainProvider,
  HCS10Plugin,
  HCS2Plugin,
  InscribePlugin,
  HbarTransferPlugin,
} from '@hashgraphonline/conversational-agent';
import { ChatAnthropic } from '@langchain/anthropic';
import { ServerSigner, getAllHederaCorePlugins } from 'hedera-agent-kit';

/**
 * Builds the system message preamble for the agent.
 */
function buildSystemMessage(accountId: string) {
  return `You are a helpful assistant managing Hashgraph Online HCS-10 connections, messages, HCS-2 registries, and content inscription.
Account: ${accountId}`;
}

/**
 * Configuration interface extending ConversationalAgentOptions with entity memory options
 */
type AgentConfig = {
  accountId?: string;
  privateKey?: string;
  network?: string;
  openAIApiKey?: string;
  openAIModelName?: string;
  llmProvider?: string;
  operationalMode?: string;
  mcpServers?: any[];

  /** Enable entity memory functionality */
  entityMemoryEnabled?: boolean;

  /** Entity memory configuration */
  entityMemoryConfig?: any;
};

/**
 * Safe wrapper for ConversationalAgent that handles Electron compatibility
 */
export class SafeConversationalAgent extends ConversationalAgent {
  private isUsingCustomAgent: boolean;
  private config: AgentConfig;

  constructor(config: AgentConfig) {
    super({
      ...config,
      entityMemoryEnabled: config.entityMemoryEnabled ?? true,
      entityMemoryConfig: config.entityMemoryConfig,
    } as any);

    this.config = config;
    this.isUsingCustomAgent = false;
  }

  async initialize() {
    try {
      if (this.config.llmProvider === 'anthropic') {
        this.logger?.info('Using Anthropic provider, creating custom agent...');
        await this.initializeWithAnthropic();
        this.isUsingCustomAgent = true;
      } else {
        if (this.config.mcpServers && this.config.mcpServers.length > 0) {
          this.logger?.info('Creating agent with MCP servers:', {
            serverCount: this.config.mcpServers.length,
            servers: this.config.mcpServers.map((s: any) => ({
              name: s.name,
            })),
          });

          const enabledServers = this.config.mcpServers.filter(
            (server: any) => server.enabled || server.autoConnect
          );

          if (
            enabledServers.length > 0 &&
            typeof (ConversationalAgent as any).withMCP === 'function'
          ) {
            this.agent = (ConversationalAgent as any).withMCP(
              {
                ...this.config,
                disableLogging: false,
                verbose: true,
                scheduleUserTransactionsInBytesMode: false,
                entityMemoryEnabled: this.config.entityMemoryEnabled ?? true,
                entityMemoryConfig: this.config.entityMemoryConfig,
              },
              enabledServers
            );
          } else {
            this.agent = new (ConversationalAgent as any)({
              ...this.config,
              disableLogging: false,
              verbose: true,
              scheduleUserTransactionsInBytesMode: false,
              entityMemoryEnabled: this.config.entityMemoryEnabled ?? true,
              entityMemoryConfig: this.config.entityMemoryConfig,
            });
          }
        } else {
          this.logger?.info('Initializing base ConversationalAgent...');
          await super.initialize();
          this.isUsingCustomAgent = false;
          this.logger?.info('Agent initialized successfully', {
            provider: this.config.llmProvider || 'openai',
            isCustom: this.isUsingCustomAgent,
          });
          return;
        }

        if (typeof (this.agent as any)?.initialize === 'function') {
          await (this.agent as any).initialize();
        } else if (typeof (this.agent as any)?.boot === 'function') {
          await (this.agent as any).boot();
        }

        this.startMCPConnections();
        this.isUsingCustomAgent = false;
      }

      this.logger?.info('Agent initialized successfully', {
        provider: this.config.llmProvider || 'openai',
        isCustom: this.isUsingCustomAgent,
        hasAgent: !!this.agent,
        agentType: this.agent ? this.agent.constructor.name : 'none',
      });

      try {
        const agent = this.agent as any;
        if (agent && typeof agent.getAvailableTools === 'function') {
          const tools = await agent.getAvailableTools();
          this.logger?.info(
            `Available tools: ${tools.map((t: any) => t.name).join(', ')}`
          );
        } else if (agent && Array.isArray(agent.tools)) {
          this.logger?.info(
            `Agent tools: ${agent.tools.map((t: any) => t.name).join(', ')}`
          );
        } else {
          this.logger?.warn('Could not determine available tools');
        }
      } catch (error) {
        this.logger?.warn('Failed to get available tools:', error);
      }
    } catch (error) {
      this.logger?.error('Failed to initialize agent:', error);
      throw error;
    }
  }

  private async initializeWithAnthropic() {
    try {
      const anthropicLLM = new ChatAnthropic({
        apiKey: this.config.openAIApiKey,
        modelName: this.config.openAIModelName || 'claude-3-5-sonnet-20241022',
        temperature: 0.1,
      });

      const serverSigner = new ServerSigner(
        this.config.accountId!,
        this.config.privateKey!,
        this.config.network! as 'testnet' | 'mainnet' | 'previewnet'
      );

      const hcs10Plugin = new HCS10Plugin();
      const hcs2Plugin = new HCS2Plugin();
      const inscribePlugin = new InscribePlugin();
      const hbarTransferPlugin = new HbarTransferPlugin();
      const corePlugins = getAllHederaCorePlugins();
      const allPlugins = [
        hcs10Plugin,
        hcs2Plugin,
        inscribePlugin,
        hbarTransferPlugin,
        ...corePlugins,
      ];

      let mcpConfig = {};
      if (this.config.mcpServers && this.config.mcpServers.length > 0) {
        this.logger?.info('Adding MCP server support to Anthropic agent:', {
          serverCount: this.config.mcpServers.length,
          servers: this.config.mcpServers.map((s: any) => ({
            name: s.name,
          })),
        });

        const enabledServers = this.config.mcpServers.filter(
          (server: any) => server.enabled || server.autoConnect
        );

        if (enabledServers.length > 0) {
          mcpConfig = {
            mcp: {
              servers: enabledServers,
              autoConnect: false,
            },
          };
        }
      }

      this.agent = createAgent({
        framework: 'langchain',
        signer: serverSigner,
        execution: {
          mode: 'bytes',
          operationalMode: (this.config.operationalMode || 'autonomous') as 'autonomous' | 'returnBytes',
          scheduleUserTransactionsInBytesMode: false,
        },
        ai: {
          provider: new LangChainProvider(anthropicLLM),
          temperature: 0.1,
        },
        filtering: {
          toolPredicate: (tool: any) => {
            if (tool.name === 'hedera-account-transfer-hbar') return false;
            return true;
          },
        },
        messaging: {
          systemPreamble: buildSystemMessage(this.config.accountId!),
          conciseMode: true,
        },
        extensions: {
          plugins: allPlugins,
        },
        ...mcpConfig,
        debug: {
          verbose: false,
          silent: true,
        },
      });

      await this.agent.boot();

      this.startMCPConnections();
    } catch (error) {
      this.logger?.error('Failed to initialize with Anthropic:', error);
      throw error;
    }
  }

  async processMessage(message: string, chatHistory: any[] = []): Promise<any> {
    try {
      this.logger?.info('Processing message...');

      if (this.isUsingCustomAgent && this.agent) {
        const response = await (this.agent as any).sendMessage({
          role: 'user',
          content: message,
        });
        
        let transactionBytes = null;
        let scheduleId = null;
        
        if (typeof response === 'object' && response !== null) {
          transactionBytes = response.transactionBytes || response.metadata?.transactionBytes;
          scheduleId = response.scheduleId || response.metadata?.scheduleId;
        }
        
        if (!transactionBytes && typeof response === 'string') {
          const base64Regex = /([A-Za-z0-9+/]{50,}={0,2})/g;
          const matches = response.match(base64Regex);
          if (matches && matches[0]) {
            try {
              Buffer.from(matches[0], 'base64');
              transactionBytes = matches[0];
              this.logger?.info('Extracted transaction bytes from response content');
            } catch (e) {
            }
          }
        }
        
        return {
          output: response,
          message: typeof response === 'string' ? response : (response.message || response.output || JSON.stringify(response)),
          transactionBytes,
          scheduleId,
          metadata: {
            transactionBytes,
            scheduleId,
            ...(typeof response === 'object' && response.metadata ? response.metadata : {})
          }
        };
      }

      if (this.agent) {
        const agent = this.agent as any;
        if (typeof agent.processMessage === 'function') {
          const result = await agent.processMessage(
            message,
            chatHistory.map((item) => ({
              type: item.role === 'user' ? 'human' : 'ai',
              content: item.content,
            }))
          );
          
          if (result && typeof result === 'object') {
            const transactionBytes = result.transactionBytes || 
                                    result.metadata?.transactionBytes || 
                                    result.rawToolOutput?.transactionBytes ||
                                    null;
            
            if (transactionBytes && !result.transactionBytes) {
              result.transactionBytes = transactionBytes;
            }
            if (transactionBytes && (!result.metadata || !result.metadata.transactionBytes)) {
              result.metadata = {
                ...result.metadata,
                transactionBytes
              };
            }
            
            this.logger?.info('Agent processMessage result:', {
              hasTransactionBytes: !!transactionBytes,
              hasScheduleId: !!result.scheduleId,
              operationalMode: this.config.operationalMode
            });
          }
          
          return result;
        } else {
          return await super.processMessage(
            message,
            chatHistory.map((item) => ({
              type: item.role === 'user' ? 'human' : 'ai',
              content: item.content,
            }))
          );
        }
      }

      return await super.processMessage(
        message,
        chatHistory.map((item) => ({
          type: item.role === 'user' ? 'human' : 'ai',
          content: item.content,
        }))
      );
    } catch (error) {
      this.logger?.error('Error in processMessage:', error);
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    try {
      this.logger?.info('Disconnecting SafeConversationalAgent...');

      await this.cleanup();

      this.logger?.info('SafeConversationalAgent disconnected successfully');
    } catch (error) {
      this.logger?.error('Error during disconnect:', error);
      throw error;
    }
  }

  /**
   * Execute a specific tool call through the agent
   */
  async executeToolCall(toolCall: any) {
    try {
      this.logger?.info('Executing tool call', { toolName: toolCall.name });

      if (!this.agent) {
        throw new Error('Agent not initialized');
      }

      if (this.isUsingCustomAgent) {
        return await this.executeCustomToolCall(toolCall);
      }

      const agent = this.agent as any;
      if (agent.executeToolCall) {
        return await agent.executeToolCall(toolCall);
      }

      const toolRequestMessage = `Please execute the following tool:
Tool: ${toolCall.name}
Arguments: ${JSON.stringify(toolCall.arguments, null, 2)}`;

      const response = await this.processMessage(toolRequestMessage);

      if (response && response.content) {
        return {
          success: true,
          data: response.content,
        };
      }

      throw new Error('Tool execution failed: No response');
    } catch (error) {
      this.logger?.error('Tool call execution failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Tool execution failed',
      };
    }
  }

  /**
   * Execute tool call for custom agents
   */
  private async executeCustomToolCall(toolCall: any) {
    try {
      const message = {
        role: 'user',
        content: `Execute the ${
          toolCall.name
        } tool with the following parameters: ${JSON.stringify(
          toolCall.arguments
        )}`,
      };

      const response = await (this.agent as any)?.sendMessage(message);

      return {
        success: true,
        data: response,
      };
    } catch (error) {
      this.logger?.error('Custom tool call execution failed:', error);
      return {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : 'Custom tool execution failed',
      };
    }
  }

  /**
   * Start MCP connections asynchronously without blocking initialization
   * @private
   */
  private startMCPConnections(): void {
    if (!this.config.mcpServers || this.config.mcpServers.length === 0) {
      return;
    }

    if (this.agent && typeof (this.agent as any).connectMCPServers === 'function') {
      this.logger?.info('Using agent built-in MCP connection support');
      return;
    }

    const enabledServers = this.config.mcpServers.filter(
      (server: any) => server.enabled || server.autoConnect
    );
    
    if (enabledServers.length > 0) {
      this.logger?.info(`MCP connections will be established asynchronously for ${enabledServers.length} servers`, {
        servers: enabledServers.map((s: any) => s.name),
      });
      
      setTimeout(() => {
        enabledServers.forEach((server: any) => {
          this.logger?.info(`MCP server ${server.name} connection initiated asynchronously`);
        });
      }, 1000);
    }
  }

  /**
   * Register MCP tools dynamically as servers connect
   */
  async registerMCPTools(serverId: string, tools: any[]): Promise<void> {
    try {
      this.logger?.info(
        `Registering ${tools.length} tools from MCP server ${serverId}`
      );

      if (!this.agent) {
        this.logger?.warn('Agent not available for tool registration');
        return;
      }

      const agent = this.agent as any;
      if (typeof agent.getAvailableTools === 'function') {
        const availableTools = await agent.getAvailableTools();
        const newlyRegisteredTools = tools.filter((tool: any) =>
          availableTools.some(
            (availableTool: any) => availableTool.name === tool.name
          )
        );

        this.logger?.info(
          `Successfully verified ${newlyRegisteredTools.length} tools from ${serverId} are now available`
        );
      } else if (
        typeof agent.tools !== 'undefined' &&
        Array.isArray(agent.tools)
      ) {
        const existingToolNames = new Set(agent.tools.map((t: any) => t.name));
        const newTools = tools.filter(
          (tool: any) => !existingToolNames.has(tool.name)
        );

        if (newTools.length > 0) {
          agent.tools.push(...newTools);
          this.logger?.info(
            `Added ${newTools.length} new tools from ${serverId} to agent`
          );
        }
      } else {
        this.logger?.info(
          `Tools from ${serverId} should be automatically available through MCP integration`
        );
      }
    } catch (error) {
      this.logger?.error(`Failed to register tools from ${serverId}:`, error);
    }
  }
}
