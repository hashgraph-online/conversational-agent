import { encoding_for_model } from 'tiktoken';
import type { TiktokenModel } from 'tiktoken';
import type { BaseMessage } from '@langchain/core/messages';

/**
 * Token counter utility for OpenAI models using tiktoken encoding
 * Provides accurate token counting for text content and chat messages
 */
export class TokenCounter {
  private encoding: ReturnType<typeof encoding_for_model>;
  private modelName: TiktokenModel;

  // Token overhead per message for chat completion format
  private static readonly MESSAGE_OVERHEAD = 3; // <|start|>role<|end|>content<|end|>
  private static readonly ROLE_OVERHEAD = 1; // Additional token for role specification

  constructor(modelName: TiktokenModel = 'gpt-4o') {
    this.modelName = modelName;
    try {
      this.encoding = encoding_for_model(modelName);
    } catch (error) {
      // Fallback to gpt-4o if specific model encoding is not available
      console.warn(`Model ${modelName} not found, falling back to gpt-4o encoding`);
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
      console.warn('Error counting tokens, falling back to word-based estimation:', error);
      // Fallback: rough estimation based on words (typically 1.3 tokens per word)
      return Math.ceil(text.split(/\s+/).length * 1.3);
    }
  }

  /**
   * Count tokens for a single chat message including role overhead
   * @param message - The message to count tokens for
   * @returns Number of tokens including message formatting overhead
   */
  countMessageTokens(message: BaseMessage): number {
    const contentTokens = this.countTokens(message.content as string);
    const roleTokens = this.countTokens(this.getMessageRole(message));
    
    // Add overhead for message structure and role
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

    return messages.reduce((total, message) => {
      return total + this.countMessageTokens(message);
    }, 0);
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
    
    // System messages have similar overhead to regular messages
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
    
    // Add a small buffer for chat completion overhead
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
        return 'user'; // Default fallback
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
    } catch (error) {
      console.warn('Error disposing encoding:', error);
    }
  }
}