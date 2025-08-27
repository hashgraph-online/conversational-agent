import { ZodError } from 'zod';
import { Logger } from '@hashgraphonline/standards-sdk';
import { SmartMemoryManager } from '../memory/smart-memory-manager';
import { FormEngine, ToolExecutionResult } from '../forms/form-engine';
import type { FormMessage, FormSubmission } from '../forms/types';
import type { ToolRegistry, ToolRegistryEntry } from '../core/tool-registry';

/**
 * Session context for tool execution
 */
export interface SessionContext {
  sessionId: string;
  userId?: string;
  timestamp: number;
  conversationId?: string;
}

/**
 * Context passed through execution pipeline
 */
export interface ExecutionContext {
  toolName: string;
  input: unknown;
  session: SessionContext;
  memory: SmartMemoryManager;
  traceId: string;
  toolEntry: ToolRegistryEntry;
}

/**
 * Result of tool execution with metadata
 */
export interface ExecutionResult extends ToolExecutionResult {
  traceId: string;
  executionTime: number;
}

/**
 * ExecutionPipeline handles tool execution coordination
 */
export class ExecutionPipeline {
  private logger: Logger;
  private toolRegistry: ToolRegistry;
  private formEngine: FormEngine;
  private memory: SmartMemoryManager;

  constructor(
    toolRegistry: ToolRegistry,
    formEngine: FormEngine,
    memory: SmartMemoryManager,
    logger?: Logger
  ) {
    this.toolRegistry = toolRegistry;
    this.formEngine = formEngine;
    this.memory = memory;
    this.logger = logger || new Logger({ module: 'ExecutionPipeline' });
  }

  /**
   * Execute a tool through the pipeline
   */
  async execute(
    toolName: string,
    input: unknown,
    sessionContext?: SessionContext
  ): Promise<ExecutionResult> {
    const traceId = `trace-${Date.now()}-${Math.random()
      .toString(36)
      .substr(2, 9)}`;
    const startTime = Date.now();

    const toolEntry = this.toolRegistry.getTool(toolName);
    if (!toolEntry) {
      throw new Error(`Tool not found in registry: ${toolName}`);
    }

    const context: ExecutionContext = {
      toolName,
      input,
      session: sessionContext || this.buildDefaultSession(),
      memory: this.memory,
      traceId,
      toolEntry,
    };

    try {
      const shouldGenerateForm = await this.checkFormGeneration(context);
      if (shouldGenerateForm.requiresForm && shouldGenerateForm.formMessage) {
        return {
          success: false,
          output: 'Form generation required',
          requiresForm: true,
          formMessage: shouldGenerateForm.formMessage,
          traceId,
          executionTime: Date.now() - startTime,
        };
      }

      const result = await this.executeToolDirect(context);

      return {
        success: true,
        output: result,
        traceId,
        executionTime: Date.now() - startTime,
      };
    } catch (error) {
      return this.handleExecutionError(
        error,
        context,
        traceId,
        Date.now() - startTime
      );
    }
  }

  /**
   * Execute tool with validation
   */
  async executeWithValidation(
    toolName: string,
    input: unknown,
    sessionContext?: SessionContext
  ): Promise<ExecutionResult> {
    return this.execute(toolName, input, sessionContext);
  }

  /**
   * Process form submission
   */
  async processFormSubmission(
    toolName: string,
    formId: string,
    parameters: Record<string, unknown>,
    sessionContext?: SessionContext
  ): Promise<ExecutionResult> {
    const traceId = `form-${Date.now()}-${Math.random()
      .toString(36)
      .substr(2, 9)}`;
    const startTime = Date.now();

    try {
      const formSubmission: FormSubmission = {
        formId,
        toolName,
        parameters,
        timestamp: Date.now(),
      };

      const processedInput = await this.formEngine.processSubmission(
        formSubmission
      );

      return this.execute(toolName, processedInput, sessionContext);
    } catch (error) {
      return {
        success: false,
        output: 'Form submission processing failed',
        error: error instanceof Error ? error.message : String(error),
        traceId,
        executionTime: Date.now() - startTime,
      };
    }
  }

  /**
   * Check if form generation is required
   */
  private async checkFormGeneration(context: ExecutionContext): Promise<{
    requiresForm: boolean;
    formMessage?: FormMessage;
  }> {
    const inputRecord = context.input as Record<string, unknown>;
    if (inputRecord?.__fromForm === true || inputRecord?.renderForm === false) {
      return { requiresForm: false };
    }

    if (
      !this.formEngine.shouldGenerateForm(context.toolEntry.tool, context.input)
    ) {
      return { requiresForm: false };
    }

    const formMessage = await this.formEngine.generateForm(
      context.toolName,
      context.toolEntry.tool,
      context.input
    );

    if (formMessage) {
      return { requiresForm: true, formMessage };
    }

    return { requiresForm: false };
  }

  /**
   * Execute tool directly
   */
  private async executeToolDirect(context: ExecutionContext): Promise<string> {
    const { toolEntry, input } = context;
    const parameters = (input as Record<string, unknown>) || {};
    const mergedArgs = { ...parameters, renderForm: false };

    if (toolEntry.wrapper) {
      return this.executeWrappedTool(toolEntry, mergedArgs);
    }

    return await toolEntry.tool.call(mergedArgs);
  }

  /**
   * Execute wrapped tool
   */
  private async executeWrappedTool(
    toolEntry: ToolRegistryEntry,
    mergedArgs: Record<string, unknown>
  ): Promise<string> {
    const wrapper = toolEntry.wrapper;
    if (!wrapper) {
      throw new Error('Tool wrapper not found');
    }

    const wrapperAsAny = wrapper as unknown as {
      executeOriginal?: (args: Record<string, unknown>) => Promise<string>;
      originalTool?: {
        call?: (args: Record<string, unknown>) => Promise<string>;
      };
    };

    if (wrapperAsAny.executeOriginal) {
      return await wrapperAsAny.executeOriginal(mergedArgs);
    }

    if (wrapperAsAny.originalTool?.call) {
      return await wrapperAsAny.originalTool.call(mergedArgs);
    }

    return await toolEntry.originalTool.call(mergedArgs);
  }

  /**
   * Handle execution error
   */
  private handleExecutionError(
    error: unknown,
    context: ExecutionContext,
    traceId: string,
    executionTime: number
  ): ExecutionResult {
    const errorMessage = error instanceof Error ? error.message : String(error);

    if (error instanceof ZodError) {
      return {
        success: false,
        output: 'Validation error occurred',
        error: errorMessage,
        traceId,
        executionTime,
      };
    }

    this.logger.error(`Tool execution failed: ${context.toolName}`, {
      traceId,
      error: errorMessage,
    });

    return {
      success: false,
      output: 'Tool execution failed',
      error: errorMessage,
      traceId,
      executionTime,
    };
  }

  /**
   * Build default session context
   */
  private buildDefaultSession(): SessionContext {
    return {
      sessionId: `session-${Date.now()}-${Math.random()
        .toString(36)
        .substr(2, 9)}`,
      timestamp: Date.now(),
    };
  }

  /**
   * Get statistics about the pipeline
   */
  getStatistics(): {
    totalMiddleware: number;
    registeredMiddleware: string[];
  } {
    return {
      totalMiddleware: 0,
      registeredMiddleware: [],
    };
  }
}
