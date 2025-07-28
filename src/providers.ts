import type { 
  BaseLanguageModelCallOptions
} from '@langchain/core/language_models/base';
import type { BaseChatModel } from '@langchain/core/language_models/chat_models';

/**
 * Framework-agnostic AI provider interface for multi-framework support
 */
export interface AIProvider {
  /**
   * Generate a response from the AI model
   */
  generate(
    prompt: string,
    options?: BaseLanguageModelCallOptions
  ): Promise<string>;

  /**
   * Stream a response from the AI model
   */
  stream?(
    prompt: string,
    options?: BaseLanguageModelCallOptions
  ): AsyncGenerator<string>;

  /**
   * Get the underlying model if available
   */
  getModel?(): BaseChatModel | unknown;
}

/**
 * LangChain AI provider implementation
 */
export class LangChainProvider implements AIProvider {
  constructor(private model: BaseChatModel) {}

  async generate(
    prompt: string,
    options?: BaseLanguageModelCallOptions
  ): Promise<string> {
    const result = await this.model.invoke(prompt, options);
    return typeof result === 'string' ? result : result.toString();
  }

  async *stream(
    prompt: string,
    options?: BaseLanguageModelCallOptions
  ): AsyncGenerator<string> {
    const stream = await this.model.stream(prompt, options);
    for await (const chunk of stream) {
      yield typeof chunk === 'string' ? chunk : chunk.toString();
    }
  }

  getModel(): BaseChatModel {
    return this.model;
  }
}

/**
 * Vercel AI SDK provider interface (forward-thinking)
 */
export interface VercelAIProvider extends AIProvider {
  /**
   * Use Vercel AI SDK's streamText function
   */
  streamText?(prompt: string, options?: unknown): Promise<unknown>;
}

/**
 * BAML provider interface (forward-thinking)
 */
export interface BAMLProvider extends AIProvider {
  /**
   * Execute a BAML function
   */
  executeFunction?(
    name: string,
    args: Record<string, unknown>
  ): Promise<unknown>;
}