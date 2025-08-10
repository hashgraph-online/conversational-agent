import type { BaseChatModel } from '@langchain/core/language_models/chat_models';
import type { StructuredTool } from '@langchain/core/tools';
import { createOpenAIToolsAgent } from 'langchain/agents';
import { ContentAwareAgentExecutor } from './langchain/ContentAwareAgentExecutor';
import {
  ChatPromptTemplate,
  MessagesPlaceholder,
} from '@langchain/core/prompts';
import { ChatOpenAI } from '@langchain/openai';
import {
  calculateTokenCostSync,
  getAllHederaCorePlugins,
  HederaAgentKit,
  TokenUsageCallbackHandler,
} from 'hedera-agent-kit';
import type { TokenUsage, CostCalculation } from 'hedera-agent-kit';
import {
  BaseAgent,
  type ConversationContext,
  type ChatResponse,
  type OperationalMode,
  type UsageStats,
} from './base-agent';
import { MCPClientManager } from './mcp/MCPClientManager';
import { convertMCPToolToLangChain } from './mcp/adapters/langchain';
import { SmartMemoryManager } from './memory/SmartMemoryManager';

export class LangChainAgent extends BaseAgent {
  private executor: ContentAwareAgentExecutor | undefined;
  private systemMessage = '';
  private mcpManager?: MCPClientManager;
  private smartMemory: SmartMemoryManager | undefined;

  async boot(): Promise<void> {
    if (this.initialized) {
      this.logger.warn('Agent already initialized');
      return;
    }

    try {
      this.agentKit = await this.createAgentKit();
      await this.agentKit.initialize();

      const modelName =
        this.config.ai?.modelName ||
        process.env.OPENAI_MODEL_NAME ||
        'gpt-4o-mini';
      this.tokenTracker = new TokenUsageCallbackHandler(modelName);

      const allTools = this.agentKit.getAggregatedLangChainTools();
      this.tools = this.filterTools(allTools);

      if (this.config.mcp?.servers && this.config.mcp.servers.length > 0) {
        if (this.config.mcp.autoConnect !== false) {
          await this.initializeMCP();
        } else {
          this.logger.info('MCP servers configured but autoConnect=false, skipping synchronous connection');
          this.mcpManager = new MCPClientManager(this.logger);
        }
      }

      this.smartMemory = new SmartMemoryManager({
        modelName,
        maxTokens: 90000,
        reserveTokens: 10000,
        storageLimit: 1000
      });
      
      this.logger.info('SmartMemoryManager initialized:', {
        modelName,
        toolsCount: this.tools.length,
        maxTokens: 90000,
        reserveTokens: 10000
      });

      this.systemMessage = this.buildSystemPrompt();
      
      this.smartMemory.setSystemPrompt(this.systemMessage);

      await this.createExecutor();

      this.initialized = true;
      this.logger.info('LangChain Hedera agent initialized');
    } catch (error) {
      this.logger.error('Failed to initialize agent:', error);
      throw error;
    }
  }

  async chat(
    message: string,
    context?: ConversationContext
  ): Promise<ChatResponse> {
    if (!this.initialized || !this.executor || !this.smartMemory) {
      throw new Error('Agent not initialized. Call boot() first.');
    }

    try {
      this.logger.info('LangChainAgent.chat called with:', { message, contextLength: context?.messages?.length || 0 });
      
      if (context?.messages && context.messages.length > 0) {
        this.smartMemory.clear();
        
        for (const msg of context.messages) {
          this.smartMemory.addMessage(msg);
        }
      }
      
      const { HumanMessage } = await import('@langchain/core/messages');
      this.smartMemory.addMessage(new HumanMessage(message));
      
      const memoryStats = this.smartMemory.getMemoryStats();
      this.logger.info('Memory stats before execution:', {
        totalMessages: memoryStats.totalActiveMessages,
        currentTokens: memoryStats.currentTokenCount,
        maxTokens: memoryStats.maxTokens,
        usagePercentage: memoryStats.usagePercentage,
        toolsCount: this.tools.length
      });
      
      const result = await this.executor.invoke({
        input: message,
        chat_history: this.smartMemory.getMessages(),
      });

      this.logger.info('LangChainAgent executor result:', result);

      let response: ChatResponse = {
        output: result.output || '',
        message: result.output || '',
        notes: [],
        intermediateSteps: result.intermediateSteps,
      };

      if (result.intermediateSteps && Array.isArray(result.intermediateSteps)) {
        const toolCalls = result.intermediateSteps.map((step: any, index: number) => ({
          id: `call_${index}`,
          name: step.action?.tool || 'unknown',
          args: step.action?.toolInput || {},
          output: typeof step.observation === 'string' ? step.observation : JSON.stringify(step.observation)
        }));
        
        if (toolCalls.length > 0) {
          response.tool_calls = toolCalls;
        }
      }

      const parsedSteps = result?.intermediateSteps?.[0]?.observation;
      if (
        parsedSteps &&
        typeof parsedSteps === 'string' &&
        this.isJSON(parsedSteps)
      ) {
        try {
          const parsed = JSON.parse(parsedSteps);
          response = { ...response, ...parsed };
        } catch (error) {
          this.logger.error('Error parsing intermediate steps:', error);
        }
      }

      if (!response.output || response.output.trim() === '') {
        response.output = 'Agent action complete.';
      }

      if (response.output) {
        const { AIMessage } = await import('@langchain/core/messages');
        this.smartMemory.addMessage(new AIMessage(response.output));
      }

      if (this.tokenTracker) {
        const tokenUsage = this.tokenTracker.getLatestTokenUsage();
        if (tokenUsage) {
          response.tokenUsage = tokenUsage;
          response.cost = calculateTokenCostSync(tokenUsage);
        }
      }

      const finalMemoryStats = this.smartMemory.getMemoryStats();
      response.metadata = {
        ...response.metadata,
        memoryStats: {
          activeMessages: finalMemoryStats.totalActiveMessages,
          tokenUsage: finalMemoryStats.currentTokenCount,
          maxTokens: finalMemoryStats.maxTokens,
          usagePercentage: finalMemoryStats.usagePercentage
        }
      };

      this.logger.info('LangChainAgent.chat returning response:', response);
      return response;
    } catch (error) {
      this.logger.error('LangChainAgent.chat error:', error);
      return this.handleError(error);
    }
  }

  async shutdown(): Promise<void> {
    if (this.mcpManager) {
      await this.mcpManager.disconnectAll();
    }

    if (this.smartMemory) {
      this.smartMemory.dispose();
      this.smartMemory = undefined;
    }

    this.executor = undefined;
    this.agentKit = undefined;
    this.tools = [];
    this.initialized = false;
    this.logger.info('Agent cleaned up');
  }

  switchMode(mode: OperationalMode): void {
    if (this.config.execution) {
      this.config.execution.operationalMode = mode;
    } else {
      this.config.execution = { operationalMode: mode };
    }

    if (this.agentKit) {
      this.agentKit.operationalMode = mode;
    }

    this.systemMessage = this.buildSystemPrompt();
    this.logger.info(`Operational mode switched to: ${mode}`);
  }

  getUsageStats(): UsageStats {
    if (!this.tokenTracker) {
      return {
        promptTokens: 0,
        completionTokens: 0,
        totalTokens: 0,
        cost: { totalCost: 0 } as CostCalculation,
      };
    }

    const usage = this.tokenTracker.getTotalTokenUsage();
    const cost = calculateTokenCostSync(usage);
    return { ...usage, cost };
  }

  getUsageLog(): UsageStats[] {
    if (!this.tokenTracker) {
      return [];
    }

    return this.tokenTracker.getTokenUsageHistory().map((usage) => ({
      ...usage,
      cost: calculateTokenCostSync(usage),
    }));
  }

  clearUsageStats(): void {
    if (this.tokenTracker) {
      this.tokenTracker.reset();
      this.logger.info('Usage statistics cleared');
    }
  }


  private async createAgentKit(): Promise<HederaAgentKit> {
    const corePlugins = getAllHederaCorePlugins();
    const extensionPlugins = this.config.extensions?.plugins || [];
    const plugins = [...corePlugins, ...extensionPlugins];

    const operationalMode =
      this.config.execution?.operationalMode || 'returnBytes';
    const modelName = this.config.ai?.modelName || 'gpt-4o';

    return new HederaAgentKit(
      this.config.signer,
      { plugins },
      operationalMode,
      this.config.execution?.userAccountId,
      this.config.execution?.scheduleUserTransactionsInBytesMode ?? false,
      undefined,
      modelName,
      this.config.extensions?.mirrorConfig,
      this.config.debug?.silent ?? false
    );
  }

  private async createExecutor(): Promise<void> {
    let llm: BaseChatModel;
    if (this.config.ai?.provider && this.config.ai.provider.getModel) {
      llm = this.config.ai.provider.getModel() as BaseChatModel;
    } else if (this.config.ai?.llm) {
      llm = this.config.ai.llm as BaseChatModel;
    } else {
      const apiKey = this.config.ai?.apiKey || process.env.OPENAI_API_KEY;
      if (!apiKey) {
        throw new Error('OpenAI API key required');
      }

      llm = new ChatOpenAI({
        apiKey,
        modelName: this.config.ai?.modelName || 'gpt-4o-mini',
        temperature: this.config.ai?.temperature ?? 0.1,
        callbacks: this.tokenTracker ? [this.tokenTracker] : [],
      });
    }

    const prompt = ChatPromptTemplate.fromMessages([
      ['system', this.systemMessage],
      new MessagesPlaceholder('chat_history'),
      ['human', '{input}'],
      new MessagesPlaceholder('agent_scratchpad'),
    ]);

    const langchainTools = this.tools as unknown as StructuredTool[];

    const agent = await createOpenAIToolsAgent({
      llm,
      tools: langchainTools,
      prompt,
    });

    this.executor = new ContentAwareAgentExecutor({
      agent,
      tools: langchainTools,
      verbose: this.config.debug?.verbose ?? false,
      returnIntermediateSteps: true,
    });
  }

  private handleError(error: unknown): ChatResponse {
    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error';
    this.logger.error('Chat error:', error);

    let tokenUsage: TokenUsage | undefined;
    let cost: CostCalculation | undefined;

    if (this.tokenTracker) {
      tokenUsage = this.tokenTracker.getLatestTokenUsage();
      if (tokenUsage) {
        cost = calculateTokenCostSync(tokenUsage);
      }
    }

    let userFriendlyMessage = 'Sorry, I encountered an error processing your request.';
    let userFriendlyOutput = 'Sorry, I encountered an error processing your request.';
    
    if (errorMessage.includes('429')) {
      if (errorMessage.includes('quota')) {
        userFriendlyMessage = 'API quota exceeded. Please check your OpenAI billing and usage limits.';
        userFriendlyOutput = 'I\'m currently unable to respond because the API quota has been exceeded. Please check your OpenAI account billing and usage limits, then try again.';
      } else {
        userFriendlyMessage = 'Too many requests. Please wait a moment and try again.';
        userFriendlyOutput = 'I\'m receiving too many requests right now. Please wait a moment and try again.';
      }
    } else if (errorMessage.includes('401') || errorMessage.includes('unauthorized')) {
      userFriendlyMessage = 'API authentication failed. Please check your API key configuration.';
      userFriendlyOutput = 'There\'s an issue with the API authentication. Please check your OpenAI API key configuration in settings.';
    } else if (errorMessage.includes('timeout')) {
      userFriendlyMessage = 'Request timed out. Please try again.';
      userFriendlyOutput = 'The request took too long to process. Please try again.';
    } else if (errorMessage.includes('network') || errorMessage.includes('fetch')) {
      userFriendlyMessage = 'Network error. Please check your internet connection and try again.';
      userFriendlyOutput = 'There was a network error. Please check your internet connection and try again.';
    }

    const errorResponse: ChatResponse = {
      output: userFriendlyOutput,
      message: userFriendlyMessage,
      error: errorMessage,
      notes: [],
    };

    if (tokenUsage) {
      errorResponse.tokenUsage = tokenUsage;
    }

    if (cost) {
      errorResponse.cost = cost;
    }

    return errorResponse;
  }

  private async initializeMCP(): Promise<void> {
    this.mcpManager = new MCPClientManager(this.logger);

    for (const serverConfig of this.config.mcp!.servers!) {
      if (serverConfig.autoConnect === false) {
        this.logger.info(
          `Skipping MCP server ${serverConfig.name} (autoConnect=false)`
        );
        continue;
      }

      const status = await this.mcpManager.connectServer(serverConfig);

      if (status.connected) {
        this.logger.info(
          `Connected to MCP server ${status.serverName} with ${status.tools.length} tools`
        );

        for (const mcpTool of status.tools) {
          const langchainTool = convertMCPToolToLangChain(
            mcpTool,
            this.mcpManager,
            serverConfig
          );
          this.tools.push(langchainTool);
        }
      } else {
        this.logger.error(
          `Failed to connect to MCP server ${status.serverName}: ${status.error}`
        );
      }
    }
  }

  /**
   * Connect to MCP servers asynchronously after agent boot
   */
  async connectMCPServers(): Promise<void> {
    if (!this.config.mcp?.servers || this.config.mcp.servers.length === 0) {
      return;
    }

    if (!this.mcpManager) {
      this.logger.warn('MCP manager not initialized. Cannot connect to servers.');
      return;
    }

    this.logger.info('Starting async MCP server connections...');

    for (const serverConfig of this.config.mcp.servers) {
      this.connectServer(serverConfig).catch(error => {
        this.logger.error(`Connection to MCP server ${serverConfig.name} failed:`, error);
      });
    }
  }

  /**
   * Connect to a single MCP server
   */
  private async connectServer(serverConfig: any): Promise<void> {
    try {
      this.logger.info(`Connecting to MCP server: ${serverConfig.name}`);
      
      const status = await this.mcpManager!.connectServer(serverConfig);
      
      if (status.connected) {
        this.logger.info(
          `Connected to MCP server ${status.serverName} with ${status.tools.length} tools`
        );
        
        for (const mcpTool of status.tools) {
          const langchainTool = convertMCPToolToLangChain(
            mcpTool,
            this.mcpManager!,
            serverConfig
          );
          this.tools.push(langchainTool);
        }
        
        if (this.initialized && this.executor) {
          await this.createExecutor();
        }
        
      } else {
        this.logger.error(
          `Failed to connect to MCP server ${status.serverName}: ${status.error}`
        );
      }
    } catch (error) {
      this.logger.error(`Error connecting to MCP server ${serverConfig.name}:`, error);
    }
  }

  /**
   * Check if a string is valid JSON
   */
  private isJSON(str: string): boolean {
    if (typeof str !== 'string') return false;

    const trimmed = str.trim();
    if (!trimmed) return false;

    if (
      !(trimmed.startsWith('{') && trimmed.endsWith('}')) &&
      !(trimmed.startsWith('[') && trimmed.endsWith(']'))
    ) {
      return false;
    }

    try {
      JSON.parse(trimmed);
      return true;
    } catch {
      return false;
    }
  }
}
