import type { BaseChatModel } from '@langchain/core/language_models/chat_models';
import type { StructuredTool } from '@langchain/core/tools';
import { createOpenAIToolsAgent } from 'langchain/agents';
import {
  FormAwareAgentExecutor,
  type ParameterPreprocessingCallback,
} from './form-aware-agent-executor';
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
} from '../base-agent';
import { MCPClientManager } from '../mcp/mcp-client-manager';
import { convertMCPToolToLangChain } from '../mcp/adapters/langchain';
import { SmartMemoryManager } from '../memory/smart-memory-manager';
import type { MCPConnectionStatus, MCPServerConfig } from '../mcp/types';
import { ResponseFormatter } from '../utils/response-formatter';
import type { FormSubmission } from '../forms/types';
import type { ToolRegistrationOptions } from '../core/tool-registry';
import { ERROR_MESSAGES } from '../constants';
import {
  HumanMessage,
  AIMessage,
  SystemMessage,
  BaseMessage as _BaseMessage,
} from '@langchain/core/messages';
import { ToolRegistry } from '../core/tool-registry';
import {
  ExecutionPipeline,
  SessionContext,
} from '../execution/execution-pipeline';
import { FormEngine } from '../forms/form-engine';
import type { ChainValues } from '@langchain/core/utils/types';

interface RenderConfigSchema {
  _renderConfig?: Record<string, unknown>;
}

interface ToolExecutionData {
  type: string;
  formId?: string;
  parameters?: Record<string, unknown>;
  toolName?: string;
}

interface ToolWithOriginal {
  originalTool?: {
    call?: (args: Record<string, unknown>) => Promise<string>;
  };
}

interface ExecutorWithRestore {
  restorePendingForms?: (p: Map<string, unknown>) => void;
}

interface ResultWithToolName {
  toolName?: string;
}

interface IntermediateStep {
  action?: {
    tool?: string;
    toolInput?: Record<string, unknown>;
  };
  observation?: unknown;
}

interface HashLinkBlock {
  blockId: string;
  hashLink: string;
  template: string;
  attributes: Record<string, unknown>;
}

interface MetadataWithHashLink {
  hashLinkBlock?: HashLinkBlock;
  memoryStats?: {
    activeMessages: number;
    tokenUsage: number;
    maxTokens: number;
    usagePercentage: number;
  };
  [key: string]: unknown;
}

function _isMetadataWithHashLink(
  metadata: unknown
): metadata is MetadataWithHashLink {
  if (!metadata || typeof metadata !== 'object') {
    return false;
  }
  const meta = metadata as Record<string, unknown>;
  return 'hashLinkBlock' in meta || 'memoryStats' in meta;
}

function hasHashLinkBlock(
  metadata: unknown
): metadata is { hashLinkBlock: HashLinkBlock } {
  if (!metadata || typeof metadata !== 'object') {
    return false;
  }
  const meta = metadata as Record<string, unknown>;
  if (
    !('hashLinkBlock' in meta) ||
    !meta.hashLinkBlock ||
    typeof meta.hashLinkBlock !== 'object'
  ) {
    return false;
  }
  const block = meta.hashLinkBlock as Record<string, unknown>;
  return (
    'blockId' in block &&
    'hashLink' in block &&
    'template' in block &&
    'attributes' in block &&
    typeof block.blockId === 'string' &&
    typeof block.hashLink === 'string' &&
    typeof block.template === 'string' &&
    typeof block.attributes === 'object'
  );
}

export class LangChainAgent extends BaseAgent {
  private executor: FormAwareAgentExecutor | undefined;
  private systemMessage = '';
  private mcpManager?: MCPClientManager;
  private smartMemory: SmartMemoryManager | undefined;
  private mcpConnectionStatus: Map<string, MCPConnectionStatus> = new Map();
  private toolRegistry!: ToolRegistry;
  private executionPipeline!: ExecutionPipeline;
  private formEngine!: FormEngine;
  private addToolRawToMemory(name: string, payload: string): void {
    try {
      const content = `[tool-raw:${name}] ${payload}`;
      this.smartMemory!.addMessage(new SystemMessage(content));
    } catch {}
  }
  private persistToolRaw(toolName: string, output: unknown): void {
    try {
      let payload = '';
      if (typeof output === 'string') {
        payload = this.isJSON(output) ? output : JSON.stringify({ output });
      } else if (output !== undefined) {
        try {
          payload = JSON.stringify(output);
        } catch {
          payload = String(output);
        }
      } else {
        payload = JSON.stringify({ observation: null });
      }
      this.addToolRawToMemory(toolName, payload);
    } catch {}
  }
  private persistIntermediateSteps(
    steps: IntermediateStep[] | undefined
  ): void {
    if (!steps || !Array.isArray(steps)) {
      return;
    }
    try {
      for (const step of steps) {
        const name = step?.action?.tool || 'unknown';
        const obs = step?.observation;
        this.persistToolRaw(name, obs);
      }
    } catch {}
  }
  private pendingParameterPreprocessingCallback:
    | ParameterPreprocessingCallback
    | undefined;

  /**
   * Get inscription tool by capability instead of hardcoded name
   */
  private getInscriptionTool(): StructuredTool | null {
    const criticalTools = this.toolRegistry.getToolsByCapability(
      'priority',
      'critical'
    );

    for (const entry of criticalTools) {
      const tool = entry.tool;
      const name = tool.name.toLowerCase();
      const desc = tool.description?.toLowerCase() || '';

      if (
        name.includes('inscribe') ||
        name.includes('hashinal') ||
        desc.includes('inscribe') ||
        desc.includes('hashinal')
      ) {
        return tool;
      }
    }

    const allTools = this.toolRegistry.getAllRegistryEntries();
    for (const entry of allTools) {
      const tool = entry.tool;
      const name = tool.name.toLowerCase();
      const desc = tool.description?.toLowerCase() || '';

      if (
        name.includes('inscribe') ||
        name.includes('hashinal') ||
        desc.includes('inscribe') ||
        desc.includes('hashinal')
      ) {
        return tool;
      }
    }

    return null;
  }

  /**
   * Execute a tool directly with parameters, optionally using ExecutionPipeline
   */
  private async executeToolDirect(
    toolName: string,
    parameters: Record<string, unknown>,
    useExecutionPipeline = false
  ): Promise<string> {
    if (useExecutionPipeline && this.executionPipeline && this.smartMemory) {
      const sessionContext: SessionContext = {
        sessionId: `session-${Date.now()}`,
        timestamp: Date.now(),
      };

      const result = await this.executionPipeline.execute(
        toolName,
        parameters,
        sessionContext
      );

      if (!result.success) {
        throw new Error(result.error || 'Pipeline execution failed');
      }

      return result.output;
    }

    const entry = this.toolRegistry.getTool(toolName);
    if (!entry) {
      throw new Error(`Tool not found: ${toolName}`);
    }

    let processedParameters = { ...parameters };

    if (this.pendingParameterPreprocessingCallback) {
      this.logger.info(
        'Applying parameter preprocessing in executeToolDirect',
        {
          toolName,
          hasCallback: true,
          parameterKeys: Object.keys(parameters),
        }
      );

      try {
        processedParameters = await this.pendingParameterPreprocessingCallback(
          toolName,
          parameters
        );

        if (
          JSON.stringify(processedParameters) !== JSON.stringify(parameters)
        ) {
          this.logger.info('Parameters preprocessed successfully', {
            toolName,
            originalKeys: Object.keys(parameters),
            processedKeys: Object.keys(processedParameters),
            changes: Object.keys(processedParameters).filter(
              (key) => processedParameters[key] !== parameters[key]
            ),
          });
        }
      } catch (error) {
        this.logger.warn(
          'Parameter preprocessing failed, using original parameters',
          {
            toolName,
            error: error instanceof Error ? error.message : 'Unknown error',
          }
        );
        processedParameters = parameters;
      }
    }

    const mergedArgs = { ...processedParameters, renderForm: false };

    if (entry.wrapper) {
      const maybeWrapper = entry.tool as ToolWithOriginal;
      if (maybeWrapper.originalTool?.call) {
        return await maybeWrapper.originalTool.call(mergedArgs);
      }
    }

    return await entry.tool.call(mergedArgs);
  }

  /**
   * Create a standard ChatResponse from tool output
   */
  private createToolResponse(toolOutput: string): ChatResponse {
    return {
      output: toolOutput,
      message: toolOutput,
      notes: [],
    };
  }

  /**
   * Handle TOOL_EXECUTION format messages
   */
  private async handleToolExecution(
    message: string,
    context?: ConversationContext
  ): Promise<ChatResponse | null> {
    let isToolExecution = false;
    let toolExecutionData: ToolExecutionData | null = null;

    try {
      if (message.includes('TOOL_EXECUTION')) {
        const parsed = JSON.parse(message);
        if (parsed.type === 'TOOL_EXECUTION') {
          isToolExecution = true;
          toolExecutionData = parsed;
        }
      }
    } catch {}

    if (!isToolExecution || !toolExecutionData?.formId) {
      return null;
    }

    try {
      const params = (toolExecutionData.parameters || {}) as Record<
        string,
        unknown
      >;
      const toolName = toolExecutionData.toolName;

      if (toolName) {
        const toolOutput = await this.executeToolDirect(toolName, params);
        try {
          const payload = this.isJSON(toolOutput)
            ? toolOutput
            : JSON.stringify({ output: toolOutput });
          this.addToolRawToMemory(toolName, payload);
        } catch {}
        return this.createToolResponse(toolOutput);
      }
    } catch {}

    const formSubmission: FormSubmission = {
      formId: toolExecutionData.formId,
      toolName: toolExecutionData.toolName || '',
      parameters: toolExecutionData.parameters || {},
      timestamp: Date.now(),
    };

    if (
      this.executor &&
      'processFormSubmission' in this.executor &&
      typeof this.executor.processFormSubmission === 'function'
    ) {
      return this.processFormSubmission(formSubmission, context);
    }

    return null;
  }

  /**
   * Handle direct tool execution commands
   */
  private async handleDirectToolExecution(
    message: string
  ): Promise<ChatResponse | null> {
    if (
      typeof message !== 'string' ||
      !message.includes('Please execute the following tool:')
    ) {
      return null;
    }

    try {
      const toolLineMatch = message.match(/Tool:\s*(.+)/);
      const argsLineIndex = message.indexOf('Arguments:');

      if (toolLineMatch && argsLineIndex !== -1) {
        const toolName = toolLineMatch[1].trim();
        const argsText = message
          .slice(argsLineIndex + 'Arguments:'.length)
          .trim();

        let args: Record<string, unknown> = {};
        try {
          args = JSON.parse(argsText);
        } catch {}

        const toolOutput = await this.executeToolDirect(toolName, args);
        try {
          const payload = this.isJSON(toolOutput)
            ? toolOutput
            : JSON.stringify({ output: toolOutput });
          this.addToolRawToMemory(toolName, payload);
        } catch {}
        return this.createToolResponse(toolOutput);
      }
    } catch {}

    return null;
  }

  /**
   * Handle JSON format tool calls and form submissions
   */
  private async handleJsonToolCalls(
    message: string,
    context?: ConversationContext
  ): Promise<ChatResponse | null> {
    if (typeof message !== 'string') {
      return null;
    }

    try {
      const trimmed = message.trim();
      if (
        !(trimmed.startsWith('{') && trimmed.endsWith('}')) &&
        !(trimmed.startsWith('[') && trimmed.endsWith(']'))
      ) {
        return null;
      }

      const obj = JSON.parse(trimmed) as Record<string, unknown>;
      const formId = obj['formId'] as string | undefined;
      const toolName = (obj['toolName'] as string) || '';
      const parameters = (obj['parameters'] as Record<string, unknown>) || {};

      if (
        formId &&
        this.executor &&
        'processFormSubmission' in this.executor &&
        typeof this.executor.processFormSubmission === 'function'
      ) {
        return this.processFormSubmission(
          { formId, toolName, parameters, timestamp: Date.now() },
          context
        );
      }

      if (toolName) {
        const toolOutput = await this.executeToolDirect(toolName, parameters);
        try {
          const payload = this.isJSON(toolOutput)
            ? toolOutput
            : JSON.stringify({ output: toolOutput });
          this.addToolRawToMemory(toolName, payload);
        } catch {}
        return this.createToolResponse(toolOutput);
      }
    } catch {}

    return null;
  }

  /**
   * Handle content-ref messages for inscription tools
   */
  private async handleContentRefMessages(
    message: string
  ): Promise<ChatResponse | null> {
    if (typeof message !== 'string' || !message.includes('content-ref:')) {
      return null;
    }

    try {
      const tool = this.getInscriptionTool();
      if (!tool) {
        return null;
      }

      const idMatch =
        message.match(/content-ref:([A-Za-z0-9_\-]+)/i) ||
        message.match(/content-ref:([^\s)]+)/i);
      const contentRef =
        idMatch && idMatch[1]
          ? `content-ref:${idMatch[1]}`
          : message.match(/content-ref:[^\s)]+/i)?.[0] || undefined;

      const args = contentRef
        ? ({ contentRef, renderForm: true, withHashLinkBlocks: true } as Record<
            string,
            unknown
          >)
        : ({ renderForm: true, withHashLinkBlocks: true } as Record<
            string,
            unknown
          >);

      const toolOutput = await tool.call(args);
      let parsed: Record<string, unknown> | undefined;

      try {
        parsed =
          typeof toolOutput === 'string'
            ? (JSON.parse(toolOutput) as Record<string, unknown>)
            : (toolOutput as Record<string, unknown>);
      } catch {}

      if (parsed && parsed['requiresForm'] && parsed['formMessage']) {
        const pending = new Map<
          string,
          {
            toolName: string;
            originalInput: Record<string, unknown>;
            originalToolInput?: Record<string, unknown>;
            schema: unknown;
          }
        >();

        const originalInput = {
          input: message,
          chat_history: this.smartMemory!.getMessages(),
        } as Record<string, unknown>;

        const formMessage = parsed['formMessage'] as { id: string };
        pending.set(formMessage.id, {
          toolName: tool.name,
          originalInput,
          originalToolInput: args,
          schema: null,
        });

        const maybeRestore = this.executor as ExecutorWithRestore;

        if (typeof maybeRestore.restorePendingForms === 'function') {
          maybeRestore.restorePendingForms!(pending);
        }

        const outputMsg =
          (parsed['message'] as string) ||
          'Please complete the form to continue.';

        return {
          output: outputMsg,
          message: outputMsg,
          notes: [],
          requiresForm: true,
          formMessage: formMessage as ChatResponse['formMessage'],
        } as ChatResponse;
      }
    } catch {}

    return null;
  }

  /**
   * Process executor result and format response
   */
  private async processExecutorResult(
    result: ChainValues
  ): Promise<ChatResponse> {
    let outputStr = '';
    if (typeof result.output === 'string') {
      outputStr = result.output;
    } else if (result.output) {
      try {
        outputStr = JSON.stringify(result.output);
      } catch {
        outputStr = String(result.output);
      }
    }

    let response: ChatResponse = {
      output: outputStr,
      message: outputStr,
      notes: [],
      intermediateSteps: result.intermediateSteps,
    };

    if (result.requiresForm && result.formMessage) {
      response.formMessage = result.formMessage;
      response.requiresForm = true;
    }

    if (result.intermediateSteps && Array.isArray(result.intermediateSteps)) {
      const toolCalls = result.intermediateSteps.map(
        (step: IntermediateStep, index: number) => ({
          id: `call_${index}`,
          name: step.action?.tool || 'unknown',
          args: step.action?.toolInput || {},
          output:
            typeof step.observation === 'string'
              ? step.observation
              : JSON.stringify(step.observation),
        })
      );

      if (toolCalls.length > 0) {
        response.tool_calls = toolCalls;
      }

      this.persistIntermediateSteps(
        result.intermediateSteps as IntermediateStep[]
      );
    }

    const steps = (result?.intermediateSteps as IntermediateStep[]) || [];
    const lastJsonObservation = [...steps]
      .reverse()
      .find(
        (s) => typeof s?.observation === 'string' && this.isJSON(s.observation as string)
      )?.observation as string | undefined;

    if (lastJsonObservation) {
      try {
        const parsed = JSON.parse(lastJsonObservation);

        if (ResponseFormatter.isInscriptionResponse(parsed)) {
          const formattedMessage = ResponseFormatter.formatInscriptionResponse(parsed);
          response.output = formattedMessage;
          response.message = formattedMessage;
          if (parsed.inscription) {
            response.inscription = parsed.inscription;
          }
          if (parsed.metadata) {
            response.metadata = { ...response.metadata, ...parsed.metadata };
          }
        } else {
          if (typeof parsed.message === 'string' && parsed.message.trim().length > 0) {
            response.message = parsed.message;
            response.output = parsed.message;
          }
          if (parsed.success === true) {
            delete (response as { error?: string }).error;
          }
          if (typeof parsed.transactionBytes === 'string') {
            response.metadata = {
              ...response.metadata,
              transactionBytes: parsed.transactionBytes as string,
            };
          }
          if (typeof parsed.scheduleId === 'string') {
            (response as { scheduleId?: string }).scheduleId = parsed.scheduleId as string;
          }
        }

        const blockMetadata = this.processHashLinkBlocks(parsed);
        if (blockMetadata.hashLinkBlock) {
          response.metadata = { ...response.metadata, ...blockMetadata };
        }
      } catch (error) {
        this.logger.error('Error parsing intermediate steps:', error);
      }
    }


    if (!response.output || response.output.trim() === '') {
      response.output = 'Agent action complete.';
    }

    if (response.output) {
      this.smartMemory!.addMessage(new AIMessage(response.output));
    }

    if (this.tokenTracker) {
      const tokenUsage = this.tokenTracker.getLatestTokenUsage();
      if (tokenUsage) {
        response.tokenUsage = tokenUsage;
        response.cost = calculateTokenCostSync(tokenUsage);
      }
    }

    const finalMemoryStats = this.smartMemory!.getMemoryStats();
    response.metadata = {
      ...response.metadata,
      memoryStats: {
        activeMessages: finalMemoryStats.totalActiveMessages,
        tokenUsage: finalMemoryStats.currentTokenCount,
        maxTokens: finalMemoryStats.maxTokens,
        usagePercentage: finalMemoryStats.usagePercentage,
      },
    };

    this.logger.info('LangChainAgent.chat returning response:', response);
    return response;
  }

  /**
   * Normalize context messages into LangChain message instances and load into memory
   */
  /**
   * Loads context messages into memory, merging with existing messages
   */
  private loadContextMessages(context?: ConversationContext): void {
    if (
      !this.smartMemory ||
      !context?.messages ||
      context.messages.length === 0
    ) {
      return;
    }

    const existingMessages = this.smartMemory.getMessages();
    const existingContent = new Set(
      existingMessages.map((m) => `${m.constructor.name}:${m.content}`)
    );

    for (const msg of context.messages as unknown[]) {
      let messageClass:
        | typeof HumanMessage
        | typeof AIMessage
        | typeof SystemMessage;
      let content: string;

      if (
        msg instanceof HumanMessage ||
        msg instanceof AIMessage ||
        msg instanceof SystemMessage
      ) {
        messageClass = msg.constructor as
          | typeof HumanMessage
          | typeof AIMessage
          | typeof SystemMessage;
        content = msg.content as string;
      } else if (
        msg &&
        typeof msg === 'object' &&
        'content' in msg &&
        'type' in msg
      ) {
        content = String((msg as { content: unknown }).content);
        const type = String((msg as { type: unknown }).type);

        if (type === 'human') messageClass = HumanMessage;
        else if (type === 'ai') messageClass = AIMessage;
        else if (type === 'system') messageClass = SystemMessage;
        else continue;
      } else {
        continue;
      }

      const key = `${messageClass.name}:${content}`;
      if (!existingContent.has(key)) {
        this.smartMemory.addMessage(new messageClass(content));
        existingContent.add(key);
      }
    }
  }

  async boot(): Promise<void> {
    this.logger.info('🚨🚨🚨 LANGCHAIN AGENT BOOT METHOD CALLED 🚨🚨🚨');

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
      try {
        if (typeof (TokenUsageCallbackHandler as unknown as { new (m: string): unknown }) === 'function') {
          this.tokenTracker = new TokenUsageCallbackHandler(modelName);
        } else {
          this.logger.warn('TokenUsageCallbackHandler unavailable or not a constructor; skipping token tracking');
        }
      } catch {
        this.logger.warn('TokenUsageCallbackHandler threw; skipping token tracking');
      }

      this.toolRegistry = new ToolRegistry(this.logger);

      const allTools = this.agentKit.getAggregatedLangChainTools();
      this.logger.info('=== TOOL REGISTRATION START ===');
      this.logger.info(
        'All tools from agentKit:',
        allTools.map((t) => t.name)
      );

      const filteredTools = this.filterTools(allTools);
      this.logger.info(
        'Filtered tools for registration:',
        filteredTools.map((t) => t.name)
      );

      for (const tool of filteredTools) {
        this.logger.info(`🔧 Registering tool: ${tool.name}`);

        const options: ToolRegistrationOptions = {};

        const name = tool.name.toLowerCase();
        const desc = tool.description?.toLowerCase() || '';

        if (tool.name === 'hedera-hts-mint-nft') {
          const originalCall = tool.call.bind(tool);
          tool.call = async (args: Record<string, unknown>) => {
            if (args.metaOptions && typeof args.metaOptions === 'object') {
              const metaOptions = args.metaOptions as Record<string, unknown>;
              if (metaOptions.transactionMemo) {
                this.logger.warn(
                  '🚨 WORKAROUND: Stripping transactionMemo from hedera-hts-mint-nft to avoid bug',
                  { originalMemo: metaOptions.transactionMemo }
                );
                delete metaOptions.transactionMemo;
              }
            }
            return originalCall(args);
          };
        }

        if (
          name.includes('inscribe') ||
          name.includes('hashinal') ||
          desc.includes('inscribe') ||
          desc.includes('hashinal')
        ) {
          options.forceWrapper = true;
          options.metadata = {
            category: 'core' as const,
            version: '1.0.0',
            dependencies: [],
          };

          this.logger.info(`🎯 CRITICAL TOOL DEBUG - ${tool.name} schema:`, {
            hasSchema: !!tool.schema,
            schemaType: tool.schema?.constructor?.name,
            hasRenderConfig: !!(tool.schema as RenderConfigSchema)
              ?._renderConfig,
            renderConfig: (tool.schema as RenderConfigSchema)?._renderConfig,
          });
        }

        this.toolRegistry.registerTool(tool, options);
      }

      this.tools = this.toolRegistry.getAllTools();

      this.logger.info(`🚀 TOOLS REGISTERED: ${this.tools.length} tools`);

      const stats = this.toolRegistry.getStatistics();
      this.logger.info('📊 Tool Registry Statistics:', {
        total: stats.totalTools,
        wrapped: stats.wrappedTools,
        unwrapped: stats.unwrappedTools,
        categories: stats.categoryCounts,
        priorities: stats.priorityCounts,
      });

      const inscriptionTool = this.getInscriptionTool();
      if (inscriptionTool) {
        const entry = this.toolRegistry.getTool(inscriptionTool.name);
        if (entry) {
          this.logger.info(
            `✅ Inscription tool registered: ${inscriptionTool.name}`
          );
        }
      }

      const toolNames = this.toolRegistry.getToolNames();
      const uniqueNames = new Set(toolNames);
      if (toolNames.length !== uniqueNames.size) {
        this.logger.error('DUPLICATE TOOL NAMES DETECTED in registry!');
        const duplicates = toolNames.filter(
          (name, index) => toolNames.indexOf(name) !== index
        );
        throw new Error(
          `Duplicate tool names detected: ${duplicates.join(', ')}`
        );
      }

      if (this.config.mcp?.servers && this.config.mcp.servers.length > 0) {
        if (this.config.mcp.autoConnect !== false) {
          await this.initializeMCP();
        } else {
          this.logger.info(
            'MCP servers configured but autoConnect=false, skipping synchronous connection'
          );
          this.mcpManager = new MCPClientManager(this.logger);
        }
      }

      this.smartMemory = new SmartMemoryManager({
        modelName,
        maxTokens: 90000,
        reserveTokens: 10000,
        storageLimit: 1000,
      });

      this.logger.info('SmartMemoryManager initialized:', {
        modelName,
        toolsCount: this.tools.length,
        maxTokens: 90000,
        reserveTokens: 10000,
      });

      this.formEngine = new FormEngine(this.logger);

      this.executionPipeline = new ExecutionPipeline(
        this.toolRegistry,
        this.formEngine,
        this.smartMemory,
        this.logger
      );

      this.systemMessage = this.buildSystemPrompt();

      this.smartMemory.setSystemPrompt(this.systemMessage);

      await this.createExecutor();

      this.initialized = true;
      this.logger.info('LangChain Hedera agent initialized with ToolRegistry');
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
      const toolExecutionResult = await this.handleToolExecution(
        message,
        context
      );
      if (toolExecutionResult) {
        return toolExecutionResult;
      }

      const directToolResult = await this.handleDirectToolExecution(message);
      if (directToolResult) {
        return directToolResult;
      }

      const jsonToolResult = await this.handleJsonToolCalls(message, context);
      if (jsonToolResult) {
        return jsonToolResult;
      }

      const contentRefResult = await this.handleContentRefMessages(message);
      if (contentRefResult) {
        return contentRefResult;
      }

      this.logger.info('LangChainAgent.chat called with:', {
        message,
        contextLength: context?.messages?.length || 0,
      });

      this.loadContextMessages(context);
      this.smartMemory.addMessage(new HumanMessage(message));

      const memoryStats = this.smartMemory.getMemoryStats();
      this.logger.info('Memory stats before execution:', {
        totalMessages: memoryStats.totalActiveMessages,
        currentTokens: memoryStats.currentTokenCount,
        maxTokens: memoryStats.maxTokens,
        usagePercentage: memoryStats.usagePercentage,
        toolsCount: this.tools.length,
      });

      const currentMessages = this.smartMemory.getMessages();
      this.logger.info('Current messages in memory:', {
        count: currentMessages.length,
      });
      try {
        const instr = currentMessages
          .map((m) => String((m as { content: unknown }).content || ''))
          .filter(
            (c) =>
              typeof c === 'string' &&
              (c.includes('[instruction:') || c.includes('[tool-next-steps:'))
          );
        if (instr.length > 0) {
          this.logger.info('Instruction/next-steps messages in memory:', {
            messages: instr,
          });
        }
      } catch {}

      const result = await this.executor.invoke({
        input: message,
        chat_history: currentMessages,
      });

      this.logger.info('LangChainAgent executor result:', result);

      return this.processExecutorResult(result);
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

    if (this.toolRegistry) {
      this.toolRegistry.clear();
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

  getMCPConnectionStatus(): Map<string, MCPConnectionStatus> {
    return new Map(this.mcpConnectionStatus);
  }

  /**
   * Processes form submission and continues with tool execution
   */
  async processFormSubmission(
    submission: FormSubmission,
    context?: ConversationContext
  ): Promise<ChatResponse> {
    if (!this.initialized || !this.executor || !this.smartMemory) {
      throw new Error('Agent not initialized. Call boot() first.');
    }

    try {
      if (!submission.parameters || typeof submission.parameters !== 'object') {
        this.logger.error('Invalid form submission parameters:', {
          parameters: submission.parameters,
          type: typeof submission.parameters,
        });
        const errorInfo = JSON.stringify(submission, null, 2);
        return this.handleError(
          new Error(`Invalid form submission parameters: ${errorInfo}`)
        );
      }

      this.loadContextMessages(context);

      const safeSubmission = {
        ...submission,
        parameters: submission.parameters || {},
      };

      const result = await this.executor.processFormSubmission(safeSubmission);

      const preservedMetadata = result?.metadata ? { ...result.metadata } : {};

      try {
        const maybeRaw = (
          result as unknown as {
            rawToolOutput?: string;
            toolName?: string;
          }
        ).rawToolOutput;
        const toolName = (result as ResultWithToolName).toolName || 'unknown';
        if (typeof maybeRaw === 'string' && maybeRaw.trim().length > 0) {
          const payload = this.isJSON(maybeRaw)
            ? maybeRaw
            : JSON.stringify({ output: maybeRaw });
          this.addToolRawToMemory(toolName, payload);
        }
      } catch {}

      let outputMessage = 'Form processed successfully.';
      if (typeof result.output === 'string') {
        outputMessage = result.output;
      } else if (result.output) {
        try {
          outputMessage = JSON.stringify(result.output);
        } catch {
          outputMessage = String(result.output);
        }
      }

      let response: ChatResponse = {
        output: outputMessage,
        message: outputMessage,
        notes: [],
        intermediateSteps: result.intermediateSteps as IntermediateStep[],
      };

      if (result.metadata) {
        response.metadata = {
          ...response.metadata,
          ...result.metadata,
        };
        this.logger.info('🔍 DEBUG: Metadata after merge from result:', {
          hasMetadata: !!response.metadata,
          metadataKeys: response.metadata ? Object.keys(response.metadata) : [],
          hasHashLinkBlock: hasHashLinkBlock(response.metadata),
          hashLinkBlockContent: hasHashLinkBlock(response.metadata)
            ? response.metadata.hashLinkBlock
            : undefined,
        });
      }

      if (result.requiresForm && result.formMessage) {
        response.formMessage = result.formMessage;
        response.requiresForm = true;
      }

      if (result.intermediateSteps && Array.isArray(result.intermediateSteps)) {
        const toolCalls = result.intermediateSteps.map(
          (step: IntermediateStep, index: number) => {
            const name = step?.action?.tool || 'unknown';
            const args = step?.action?.toolInput || {};
            const obs = step?.observation;
            let output = '';
            if (typeof obs === 'string') {
              output = obs;
            } else if (obs && typeof obs === 'object') {
              try {
                output = JSON.stringify(obs);
              } catch {
                output = String(obs);
              }
            } else if (obs !== undefined) {
              output = String(obs);
            }
            return { id: `call_${index}`, name, args, output };
          }
        );
        if (toolCalls.length > 0) {
          response.tool_calls = toolCalls;
        }
        this.persistIntermediateSteps(
          result.intermediateSteps as IntermediateStep[]
        );
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

          const blockMetadata = this.processHashLinkBlocks(parsed);
          if (blockMetadata.hashLinkBlock) {
            response.metadata = {
              ...response.metadata,
              ...blockMetadata,
            };
          }
        } catch (error) {
          this.logger.error('Error parsing intermediate steps:', error);
        }
      }

      if (response.output) {
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
      this.logger.info('🔍 DEBUG: Metadata before memoryStats merge:', {
        hasMetadata: !!response.metadata,
        metadataKeys: response.metadata ? Object.keys(response.metadata) : [],
        hasHashLinkBlock: hasHashLinkBlock(response.metadata),
      });

      response.metadata = {
        ...preservedMetadata,
        ...response.metadata,
        memoryStats: {
          activeMessages: finalMemoryStats.totalActiveMessages,
          tokenUsage: finalMemoryStats.currentTokenCount,
          maxTokens: finalMemoryStats.maxTokens,
          usagePercentage: finalMemoryStats.usagePercentage,
        },
      };

      this.logger.info('🔍 DEBUG: Final response metadata before return:', {
        hasMetadata: !!response.metadata,
        metadataKeys: response.metadata ? Object.keys(response.metadata) : [],
        hasHashLinkBlock: hasHashLinkBlock(response.metadata),
        fullMetadata: response.metadata,
      });

      if (
        hasHashLinkBlock(preservedMetadata) &&
        !hasHashLinkBlock(response.metadata)
      ) {
        this.logger.error(
          '❌ CRITICAL: HashLink metadata was lost during processing!'
        );
        this.logger.error(
          'Original metadata had hashLinkBlock:',
          preservedMetadata.hashLinkBlock
        );
        this.logger.error('Final metadata missing hashLinkBlock');
      }

      return response;
    } catch (error) {
      this.logger.error('Form submission processing error:', error);
      return this.handleError(error);
    }
  }

  /**
   * Check if the agent has pending forms that need to be completed
   */
  hasPendingForms(): boolean {
    return this.executor ? this.executor.hasPendingForms() : false;
  }

  /**
   * Get information about pending forms
   */
  getPendingFormsInfo(): Array<{ formId: string; toolName: string }> {
    return this.executor ? this.executor.getPendingFormsInfo() : [];
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
    const existingPendingForms = this.executor?.getPendingForms() || new Map();

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

      const modelName = this.config.ai?.modelName || 'gpt-4o-mini';
      const isGPT5Model =
        modelName.toLowerCase().includes('gpt-5') ||
        modelName.toLowerCase().includes('gpt5');

      llm = new ChatOpenAI({
        apiKey,
        modelName,
        callbacks: this.tokenTracker ? [this.tokenTracker] : [],
        ...(isGPT5Model ? { temperature: 1 } : {}),
      });
    }

    const prompt = ChatPromptTemplate.fromMessages([
      ['system', this.systemMessage],
      new MessagesPlaceholder('chat_history'),
      ['human', '{input}'],
      new MessagesPlaceholder('agent_scratchpad'),
    ]);

    const langchainTools = this.tools as StructuredTool[];

    const inscriptionTool = this.getInscriptionTool();
    if (inscriptionTool) {
      const entry = this.toolRegistry.getTool(inscriptionTool.name);
      if (entry) {
        this.logger.info(
          `✅ Inscription tool registered: ${inscriptionTool.name}`
        );
      }
    }

    const stats = this.toolRegistry.getStatistics();
    this.logger.info('🛡️ TOOL SECURITY REPORT:', {
      totalTools: stats.totalTools,
      wrappedTools: stats.wrappedTools,
      unwrappedTools: stats.unwrappedTools,
      categories: stats.categoryCounts,
      priorities: stats.priorityCounts,
    });

    this.logger.info(
      `📊 Tool Security Summary: ${stats.wrappedTools} wrapped, ${stats.unwrappedTools} unwrapped`
    );

    const agent = await createOpenAIToolsAgent({
      llm,
      tools: langchainTools,
      prompt,
    });

    this.executor = new FormAwareAgentExecutor({
      agent,
      tools: langchainTools,
      verbose: this.config.debug?.verbose ?? false,
      returnIntermediateSteps: true,
    });

    if (this.pendingParameterPreprocessingCallback) {
      this.executor.setParameterPreprocessingCallback(
        this.pendingParameterPreprocessingCallback
      );
      this.logger.info(
        'Parameter preprocessing callback re-applied to new executor',
        { hasCallback: true }
      );
    }

    if (existingPendingForms.size > 0) {
      this.logger.info(
        `Restoring ${existingPendingForms.size} pending forms to new executor`
      );
      this.executor.restorePendingForms(existingPendingForms);
    }

    this.logger.info('FormAwareAgentExecutor initialization complete');
  }

  /**
   * Set parameter preprocessing callback for tool parameter format conversion
   */
  setParameterPreprocessingCallback(
    callback: ParameterPreprocessingCallback | undefined
  ): void {
    this.pendingParameterPreprocessingCallback = callback;
    if (this.executor) {
      this.executor.setParameterPreprocessingCallback(callback);
      this.logger.info('Parameter preprocessing callback configured', {
        hasCallback: !!callback,
      });
    } else {
      this.logger.warn(
        'Cannot set parameter preprocessing callback: executor not initialized'
      );
    }
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

    let userFriendlyMessage = errorMessage;
    let userFriendlyOutput = errorMessage;

    if (errorMessage.includes('429')) {
      if (errorMessage.includes('quota')) {
        userFriendlyMessage =
          'API quota exceeded. Please check your OpenAI billing and usage limits.';
        userFriendlyOutput =
          "I'm currently unable to respond because the API quota has been exceeded. Please check your OpenAI account billing and usage limits, then try again.";
      } else {
        userFriendlyMessage = ERROR_MESSAGES.TOO_MANY_REQUESTS;
        userFriendlyOutput = ERROR_MESSAGES.RATE_LIMITED;
      }
    } else if (
      errorMessage.includes('401') ||
      errorMessage.includes('unauthorized')
    ) {
      userFriendlyMessage =
        'API authentication failed. Please check your API key configuration.';
      userFriendlyOutput =
        "There's an issue with the API authentication. Please check your OpenAI API key configuration in settings.";
    } else if (errorMessage.includes('timeout')) {
      userFriendlyMessage = 'Request timed out. Please try again.';
      userFriendlyOutput =
        'The request took too long to process. Please try again.';
    } else if (
      errorMessage.includes('network') ||
      errorMessage.includes('fetch')
    ) {
      userFriendlyMessage =
        'Network error. Please check your internet connection and try again.';
      userFriendlyOutput =
        'There was a network error. Please check your internet connection and try again.';
    } else if (errorMessage.includes('400')) {
      userFriendlyMessage = errorMessage;
      userFriendlyOutput = errorMessage;
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

          this.toolRegistry.registerTool(langchainTool, {
            metadata: {
              category: 'mcp',
              version: '1.0.0',
              dependencies: [serverConfig.name],
            },
          });
        }

        this.tools = this.toolRegistry.getAllTools();
      } else {
        this.logger.error(
          `Failed to connect to MCP server ${status.serverName}: ${status.error}`
        );
      }
    }
  }

  /**
   * Connect to MCP servers asynchronously after agent boot with background timeout pattern
   */
  async connectMCPServers(): Promise<void> {
    if (!this.config.mcp?.servers || this.config.mcp.servers.length === 0) {
      return;
    }

    if (!this.mcpManager) {
      this.mcpManager = new MCPClientManager(this.logger);
    }

    this.logger.info(
      `Starting background MCP server connections for ${this.config.mcp.servers.length} servers...`
    );

    this.config.mcp.servers.forEach((serverConfig) => {
      this.connectServerInBackground(serverConfig);
    });

    this.logger.info('MCP server connections initiated in background');
  }

  /**
   * Connect to a single MCP server in background with timeout
   */
  private connectServerInBackground(serverConfig: MCPServerConfig): void {
    const serverName = serverConfig.name;

    setTimeout(async () => {
      try {
        this.logger.info(`Background connecting to MCP server: ${serverName}`);

        const status = await this.mcpManager!.connectServer(serverConfig);
        this.mcpConnectionStatus.set(serverName, status);

        if (status.connected) {
          this.logger.info(
            `Successfully connected to MCP server ${status.serverName} with ${status.tools.length} tools`
          );

          for (const mcpTool of status.tools) {
            const langchainTool = convertMCPToolToLangChain(
              mcpTool,
              this.mcpManager!,
              serverConfig
            );

            this.toolRegistry.registerTool(langchainTool, {
              metadata: {
                category: 'mcp',
                version: '1.0.0',
                dependencies: [serverConfig.name],
              },
            });
          }

          this.tools = this.toolRegistry.getAllTools();

          if (this.initialized && this.executor) {
            this.logger.info(
              `Recreating executor with ${this.tools.length} total tools`
            );
            await this.createExecutor();
          }
        } else {
          this.logger.error(
            `Failed to connect to MCP server ${status.serverName}: ${status.error}`
          );
        }
      } catch (error) {
        this.logger.error(
          `Background connection failed for MCP server ${serverName}:`,
          error
        );

        this.mcpConnectionStatus.set(serverName, {
          connected: false,
          serverName,
          tools: [],
          error: error instanceof Error ? error.message : 'Connection failed',
        });
      }
    }, 1000);
  }

  /**
   * Detects and processes HashLink blocks from tool responses
   * @param parsedResponse - The parsed JSON response from a tool
   * @returns Metadata object containing hashLinkBlock if detected
   */
  private processHashLinkBlocks(parsedResponse: unknown): {
    hashLinkBlock?: Record<string, unknown>;
  } {
    try {
      const responseRecord = parsedResponse as Record<string, unknown>;
      if (
        parsedResponse &&
        typeof parsedResponse === 'object' &&
        responseRecord.hashLinkBlock &&
        typeof responseRecord.hashLinkBlock === 'object'
      ) {
        const block = responseRecord.hashLinkBlock as Record<string, unknown>;

        if (
          block.blockId &&
          block.hashLink &&
          block.template &&
          block.attributes &&
          typeof block.blockId === 'string' &&
          typeof block.hashLink === 'string' &&
          typeof block.template === 'string' &&
          typeof block.attributes === 'object'
        ) {
          this.logger.info('HashLink block detected:', {
            blockId: block.blockId,
            hashLink: block.hashLink,
            template: block.template,
            attributeKeys: Object.keys(block.attributes),
          });

          return {
            hashLinkBlock: {
              blockId: block.blockId,
              hashLink: block.hashLink,
              template: block.template,
              attributes: block.attributes,
            },
          };
        } else {
          this.logger.warn('Invalid HashLink block structure detected:', block);
        }
      }
    } catch (error) {
      this.logger.error('Error processing HashLink blocks:', error);
    }

    return {};
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
