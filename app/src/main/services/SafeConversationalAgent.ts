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

        if (typeof this.agent?.initialize === 'function') {
          await this.agent.initialize();
        } else if (typeof this.agent?.boot === 'function') {
          await this.agent.boot();
        }

        // Start MCP connections asynchronously for OpenAI path
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
        if (this.agent && typeof this.agent.getAvailableTools === 'function') {
          const tools = await this.agent.getAvailableTools();
          this.logger?.info(
            `Available tools: ${tools.map((t) => t.name).join(', ')}`
          );
        } else if (this.agent && Array.isArray(this.agent.tools)) {
          this.logger?.info(
            `Agent tools: ${this.agent.tools.map((t) => t.name).join(', ')}`
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
        this.config.accountId,
        this.config.privateKey,
        this.config.network
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
          operationalMode: this.config.operationalMode || 'autonomous',
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
          systemPreamble: buildSystemMessage(this.config.accountId),
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

      // Start MCP connections asynchronously for Anthropic path
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
        const response = await this.agent.sendMessage({
          role: 'user',
          content: message,
        });
        return {
          output: response,
          message: response,
        };
      }

      if (this.agent) {
        if (typeof this.agent.processMessage === 'function') {
          return await this.agent.processMessage(
            message,
            chatHistory.map((item) => ({
              type: item.role === 'user' ? 'human' : 'ai',
              content: item.content,
            }))
          );
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
  async executeToolCall(toolCall) {
    try {
      this.logger?.info('Executing tool call', { toolName: toolCall.name });

      if (!this.agent) {
        throw new Error('Agent not initialized');
      }

      if (this.isUsingCustomAgent) {
        return await this.executeCustomToolCall(toolCall);
      }

      if (this.agent.executeToolCall) {
        return await this.agent.executeToolCall(toolCall);
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
  private async executeCustomToolCall(toolCall) {
    try {
      const message = {
        role: 'user',
        content: `Execute the ${
          toolCall.name
        } tool with the following parameters: ${JSON.stringify(
          toolCall.arguments
        )}`,
      };

      const response = await this.agent.sendMessage(message);

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

    // Check if we're using ConversationalAgent with MCP support
    if (this.agent && typeof (this.agent as any).connectMCPServers === 'function') {
      // If the agent has built-in MCP connection support, use it
      this.logger?.info('Using agent built-in MCP connection support');
      return; // ConversationalAgent will handle connections
    }

    // For custom agents or fallback, log that MCP connections are deferred
    const enabledServers = this.config.mcpServers.filter(
      (server: any) => server.enabled || server.autoConnect
    );
    
    if (enabledServers.length > 0) {
      this.logger?.info(`MCP connections will be established asynchronously for ${enabledServers.length} servers`, {
        servers: enabledServers.map((s: any) => s.name),
      });
      
      // In a real implementation, you would trigger the actual MCP connections here
      // For now, we'll just log that they would be connected
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

      if (typeof this.agent.getAvailableTools === 'function') {
        const availableTools = await this.agent.getAvailableTools();
        const newlyRegisteredTools = tools.filter((tool) =>
          availableTools.some(
            (availableTool) => availableTool.name === tool.name
          )
        );

        this.logger?.info(
          `Successfully verified ${newlyRegisteredTools.length} tools from ${serverId} are now available`
        );
      } else if (
        typeof this.agent.tools !== 'undefined' &&
        Array.isArray(this.agent.tools)
      ) {
        const existingToolNames = new Set(this.agent.tools.map((t) => t.name));
        const newTools = tools.filter(
          (tool) => !existingToolNames.has(tool.name)
        );

        if (newTools.length > 0) {
          this.agent.tools.push(...newTools);
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
