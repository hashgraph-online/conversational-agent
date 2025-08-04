import { Logger } from '../utils/logger';
import type { ChatResponse } from '@hashgraphonline/conversational-agent';

/**
 * Safe wrapper for ConversationalAgent that handles Electron compatibility
 */
export class SafeConversationalAgent {
  private logger: Logger;
  private agent: any;
  private config: any;
  private isUsingCustomAgent = false;

  constructor(config: any) {
    this.logger = new Logger({ module: 'SafeConversationalAgent' });
    this.config = config;
  }

  async initialize(): Promise<void> {
    try {
      const originalRequire = require;
      require = new Proxy(originalRequire, {
        apply(target, thisArg, argumentsList) {
          const [moduleName] = argumentsList;

          if (moduleName === 'pino' || moduleName.includes('pino')) {
            return () => ({
              info: () => {},
              error: () => {},
              warn: () => {},
              debug: () => {},
              trace: () => {},
              fatal: () => {},
              child: () => ({
                info: () => {},
                error: () => {},
                warn: () => {},
                debug: () => {},
                trace: () => {},
                fatal: () => {},
              }),
            });
          }

          if (
            moduleName === 'thread-stream' ||
            moduleName.includes('thread-stream')
          ) {
            const { PassThrough } = originalRequire('stream');
            return class ThreadStream extends PassThrough {
              constructor() {
                super();
                this.unref = () => {};
                this.worker = { terminate: () => {} };
              }
            };
          }

          return Reflect.apply(target, thisArg, argumentsList);
        },
      });

      if (this.config.llmProvider === 'anthropic') {
        this.logger.info('Using Anthropic provider, creating custom agent...');
        await this.initializeWithAnthropic(originalRequire);
        this.isUsingCustomAgent = true;
      } else {
        const { ConversationalAgent } = originalRequire(
          '@hashgraphonline/conversational-agent'
        );

        if (this.config.mcpServers && this.config.mcpServers.length > 0) {
          this.logger.info('Creating agent with MCP servers:', {
            serverCount: this.config.mcpServers.length,
            servers: this.config.mcpServers.map((s) => ({
              id: s.id,
              name: s.name,
              enabled: s.enabled,
            })),
          });

          const enabledServers = this.config.mcpServers.filter(
            (server) => server.enabled
          );

          if (enabledServers.length > 0) {
            this.agent = ConversationalAgent.withMCP(
              {
                ...this.config,
                disableLogging: true,
                verbose: false,
              },
              enabledServers
            );
          } else {
            this.agent = new ConversationalAgent({
              ...this.config,
              disableLogging: true,
              verbose: false,
            });
          }
        } else {
          this.agent = new ConversationalAgent({
            ...this.config,
            disableLogging: true,
            verbose: false,
          });
        }

        await this.agent.initialize();
        this.isUsingCustomAgent = false;
      }

      require = originalRequire;
      this.logger.info('Agent initialized successfully', {
        provider: this.config.llmProvider || 'openai',
        isCustom: this.isUsingCustomAgent,
      });
    } catch (error) {
      this.logger.error('Failed to initialize agent:', error);
      throw error;
    }
  }

  private async initializeWithAnthropic(originalRequire: any): Promise<void> {
    try {
      const { createAgent } = originalRequire(
        '@hashgraphonline/conversational-agent'
      );
      const { ChatAnthropic } = originalRequire('@langchain/anthropic');
      const { LangChainProvider } = originalRequire(
        '@hashgraphonline/conversational-agent'
      );
      const { ServerSigner, getAllHederaCorePlugins } =
        originalRequire('hedera-agent-kit');
      const { HCS10Plugin, HCS2Plugin, InscribePlugin, HbarTransferPlugin } =
        originalRequire('@hashgraphonline/conversational-agent');
      const { getSystemMessage } = originalRequire(
        '@hashgraphonline/conversational-agent'
      );

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

      this.agent = createAgent({
        framework: 'langchain',
        signer: serverSigner,
        execution: {
          mode:
            this.config.operationalMode === 'autonomous' ? 'direct' : 'bytes',
          operationalMode: this.config.operationalMode || 'autonomous',
        },
        ai: {
          provider: new LangChainProvider(anthropicLLM),
          temperature: 0.1,
        },
        filtering: {
          toolPredicate: (tool) => {
            if (tool.name === 'hedera-account-transfer-hbar') return false;
            return true;
          },
        },
        messaging: {
          systemPreamble: getSystemMessage(this.config.accountId),
          conciseMode: true,
        },
        extensions: {
          plugins: allPlugins,
        },
        debug: {
          verbose: false,
          silent: true,
        },
      });

      await this.agent.boot();
    } catch (error) {
      this.logger.error('Failed to initialize with Anthropic:', error);
      throw error;
    }
  }

  async processMessage(content: string, chatHistory: any[] = []): Promise<any> {
    if (!this.agent) {
      throw new Error('Agent not initialized');
    }

    try {
      this.logger.info('SafeConversationalAgent.processMessage called with:', {
        content,
        historyLength: chatHistory.length,
        operationalMode: this.config.operationalMode,
        scheduleUserTransactionsInBytesMode:
          this.config.operationalMode === 'returnBytes' ? false : true,
        isCustom: this.isUsingCustomAgent,
      });

      if (this.isUsingCustomAgent) {
        const response = await this.agent.chat(content, {
          messages: chatHistory,
        });
        this.logger.info('Custom agent response:', response);
        return response;
      } else {
        const response = await this.agent.processMessage(content, chatHistory);
        this.logger.info('SafeConversationalAgent.processMessage response:', {
          hasTransactionBytes: !!response.transactionBytes,
          hasScheduleId: !!response.scheduleId,
          hasOutput: !!response.output,
          hasMessage: !!response.message,
          keys: Object.keys(response),
          response,
        });
        return response;
      }
    } catch (error) {
      this.logger.error('Failed to process message:', error);
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    if (this.agent && this.agent.disconnect) {
      await this.agent.disconnect();
    }
  }

  /**
   * Execute a specific tool call through the agent
   */
  async executeToolCall(toolCall: {
    name: string;
    arguments: any;
  }): Promise<any> {
    try {
      this.logger.info('Executing tool call', { toolName: toolCall.name });

      if (!this.agent) {
        throw new Error('Agent not initialized');
      }

      // For custom agents (like Anthropic), we need to handle tool calls differently
      if (this.isUsingCustomAgent) {
        // Custom implementation for tool execution
        return await this.executeCustomToolCall(toolCall);
      }

      // For standard ConversationalAgent, use the built-in tool execution
      if (this.agent.executeToolCall) {
        return await this.agent.executeToolCall(toolCall);
      }

      // Fallback: send as a message with tool request format
      const toolRequestMessage = `Please execute the following tool:
Tool: ${toolCall.name}
Arguments: ${JSON.stringify(toolCall.arguments, null, 2)}`;

      const response = await this.processMessage(toolRequestMessage);

      // Parse the response to extract tool result
      if (response && response.content) {
        return {
          success: true,
          data: response.content,
        };
      }

      throw new Error('Tool execution failed: No response');
    } catch (error) {
      this.logger.error('Tool call execution failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Tool execution failed',
      };
    }
  }

  /**
   * Execute tool call for custom agents
   */
  private async executeCustomToolCall(toolCall: {
    name: string;
    arguments: any;
  }): Promise<any> {
    try {
      // For custom agents, we need to format the tool call as a message
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
      this.logger.error('Custom tool call execution failed:', error);
      return {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : 'Custom tool execution failed',
      };
    }
  }
}
