import type { BaseChatModel } from '@langchain/core/language_models/chat_models';
import type { StructuredTool } from '@langchain/core/tools';
import { createOpenAIToolsAgent, AgentExecutor } from 'langchain/agents';
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

export class LangChainAgent extends BaseAgent {
  private executor: AgentExecutor | undefined;
  private systemMessage = '';
  private mcpManager?: MCPClientManager;

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
        await this.initializeMCP();
      }

      this.systemMessage = this.buildSystemPrompt();

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
    if (!this.initialized || !this.executor) {
      throw new Error('Agent not initialized. Call boot() first.');
    }

    try {
      const result = await this.executor.invoke({
        input: message,
        chat_history: context?.messages || [],
      });

      let response: ChatResponse = {
        output: result.output || '',
        message: result.output || '',
        notes: [],
      };

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

      if (this.tokenTracker) {
        const tokenUsage = this.tokenTracker.getLatestTokenUsage();
        if (tokenUsage) {
          response.tokenUsage = tokenUsage;
          response.cost = calculateTokenCostSync(tokenUsage);
        }
      }

      return response;
    } catch (error) {
      return this.handleError(error);
    }
  }

  async shutdown(): Promise<void> {
    if (this.mcpManager) {
      await this.mcpManager.disconnectAll();
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
      this.config.execution?.scheduleUserTransactionsInBytesMode ?? true,
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

    this.executor = new AgentExecutor({
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

    const errorResponse: ChatResponse = {
      output: 'Sorry, I encountered an error processing your request.',
      message: 'Error processing request.',
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
