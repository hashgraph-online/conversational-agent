import { encoding_for_model } from 'tiktoken';
import type { TiktokenModel } from 'tiktoken';
import type { BaseMessage } from '@langchain/core/messages';

/**
 * Token counter utility for OpenAI models using tiktoken encoding
 * Provides accurate token counting for text content and chat messages
 */
export class TokenCounter {
  private encoding: ReturnType<typeof encoding_for_model>;
  private modelName: string;

  private static readonly MESSAGE_OVERHEAD = 3;
  private static readonly ROLE_OVERHEAD = 1;

  constructor(modelName: string | TiktokenModel = 'gpt-4o') {
    this.modelName = String(modelName);
    try {
      this.encoding = encoding_for_model(modelName as TiktokenModel);
    } catch {
      this.encoding = encoding_for_model('gpt-4o');
      this.modelName = 'gpt-4o';
    }
  }

  /**
   * Count tokens in raw text content
   * @param text - The text to count tokens for
   * @returns Number of tokens
   */
  countTokens(text: string): number {
    if (!text || text.trim() === '') {
      return 0;
    }

    try {
      const tokens = this.encoding.encode(text);
      return tokens.length;
    } catch (error) {
      return Math.ceil(text.split(/\s+/).length * 1.3);
    }
  }

  /**
   * Count tokens for a single chat message including role overhead
   * @param message - The message to count tokens for
   * @returns Number of tokens including message formatting overhead
   */
  countMessageTokens(message: BaseMessage): number {
    const contentTokens = this.countTokens(String(message.content ?? ''));
    const roleTokens = this.countTokens(this.getMessageRole(message));
    
    return contentTokens + roleTokens + TokenCounter.MESSAGE_OVERHEAD + TokenCounter.ROLE_OVERHEAD;
  }

  /**
   * Count tokens for multiple messages
   * @param messages - Array of messages to count
   * @returns Total token count for all messages
   */
  countMessagesTokens(messages: BaseMessage[]): number {
    if (!messages || messages.length === 0) {
      return 0;
    }

    let total = 0;
    for (const message of messages) {
      total += this.countMessageTokens(message);
    }
    return total;
  }

  /**
   * Estimate tokens for system prompt
   * System prompts have slightly different overhead in chat completions
   * @param systemPrompt - The system prompt text
   * @returns Estimated token count
   */
  estimateSystemPromptTokens(systemPrompt: string): number {
    if (!systemPrompt || systemPrompt.trim() === '') {
      return 0;
    }

    const contentTokens = this.countTokens(systemPrompt);
    const roleTokens = this.countTokens('system');
    
    return contentTokens + roleTokens + TokenCounter.MESSAGE_OVERHEAD + TokenCounter.ROLE_OVERHEAD;
  }

  /**
   * Get total context size estimate including system prompt and messages
   * @param systemPrompt - System prompt text
   * @param messages - Conversation messages
   * @returns Total estimated token count
   */
  estimateContextSize(systemPrompt: string, messages: BaseMessage[]): number {
    const systemTokens = this.estimateSystemPromptTokens(systemPrompt);
    const messageTokens = this.countMessagesTokens(messages);
    
    const completionOverhead = 10;
    
    return systemTokens + messageTokens + completionOverhead;
  }

  /**
   * Get the role string for a message
   * @param message - The message to get the role for
   * @returns Role string ('user', 'assistant', 'system', etc.)
   */
  private getMessageRole(message: BaseMessage): string {
    const messageType = message._getType();
    switch (messageType) {
      case 'human':
        return 'user';
      case 'ai':
        return 'assistant';
      case 'system':
        return 'system';
      case 'function':
        return 'function';
      case 'tool':
        return 'tool';
      default:
        return 'user';
    }
  }

  /**
   * Get the model name being used for token counting
   * @returns The tiktoken model name
   */
  getModelName(): string {
    return this.modelName;
  }

  /**
   * Clean up encoding resources
   */
  dispose(): void {
    try {
      this.encoding.free();
    } catch {
    }
  }
}