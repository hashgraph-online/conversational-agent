import type { BaseMessage } from '@langchain/core/messages';
import { TokenCounter } from './token-counter';

/**
 * Result of adding a message to the memory window
 */
export interface AddMessageResult {
  /** Whether the message was successfully added */
  added: boolean;
  /** Messages that were pruned to make room */
  prunedMessages: BaseMessage[];
  /** Current token count after operation */
  currentTokenCount: number;
  /** Remaining token capacity */
  remainingCapacity: number;
}

/**
 * Memory window that manages conversation history with token-based size limits
 * Automatically prunes old messages to stay within token limits while preserving conversational context
 */
export class MemoryWindow {
  private messages: BaseMessage[] = [];
  private maxTokens: number;
  private reserveTokens: number;
  private tokenCounter: TokenCounter;
  private systemPrompt: string = '';
  private systemPromptTokens: number = 0;

  public static readonly DEFAULT_MAX_TOKENS = 8000;
  public static readonly DEFAULT_RESERVE_TOKENS = 1000;
  public static readonly PRUNING_BATCH_SIZE = 2;

  constructor(
    maxTokens: number = MemoryWindow.DEFAULT_MAX_TOKENS,
    reserveTokens: number = MemoryWindow.DEFAULT_RESERVE_TOKENS,
    tokenCounter?: TokenCounter
  ) {
    if (reserveTokens >= maxTokens) {
      throw new Error('Reserve tokens must be less than max tokens');
    }

    this.maxTokens = maxTokens;
    this.reserveTokens = reserveTokens;
    this.tokenCounter = tokenCounter || new TokenCounter();
  }

  /**
   * Add a message to the memory window, pruning old messages if necessary
   * @param message - The message to add
   * @returns Result of the add operation including any pruned messages
   */
  addMessage(message: BaseMessage): AddMessageResult {
    this.tokenCounter.countMessageTokens(message);

    this.messages.push(message);

    const currentTokens = this.getCurrentTokenCount();
    const availableTokens = this.maxTokens - this.reserveTokens;

    let prunedMessages: BaseMessage[] = [];

    if (currentTokens > availableTokens) {
      this.messages.pop();

      prunedMessages = this.pruneToFit();

      this.messages.push(message);
    }

    return {
      added: true,
      prunedMessages,
      currentTokenCount: this.getCurrentTokenCount(),
      remainingCapacity: this.getRemainingTokenCapacity(),
    };
  }

  /**
   * Prune old messages to fit within token limits
   * Removes messages in pairs to maintain conversational flow
   * @returns Array of pruned messages
   */
  pruneToFit(): BaseMessage[] {
    const prunedMessages: BaseMessage[] = [];
    const targetTokens = this.maxTokens - this.reserveTokens;

    while (
      this.getCurrentTokenCount() > targetTokens &&
      this.messages.length > 0
    ) {
      const batchSize = Math.min(
        MemoryWindow.PRUNING_BATCH_SIZE,
        this.messages.length
      );

      for (let i = 0; i < batchSize; i++) {
        const prunedMessage = this.messages.shift();
        if (prunedMessage) {
          prunedMessages.push(prunedMessage);
        }
      }

      if (prunedMessages.length > 1000) {
        break;
      }
    }

    return prunedMessages;
  }

  /**
   * Get current token count including system prompt and messages
   * @returns Current token count
   */
  getCurrentTokenCount(): number {
    const messageTokens = this.tokenCounter.countMessagesTokens(this.messages);
    return this.systemPromptTokens + messageTokens;
  }

  /**
   * Get remaining token capacity before hitting the reserve limit
   * @returns Remaining tokens that can be used
   */
  getRemainingTokenCapacity(): number {
    return Math.max(0, this.maxTokens - this.getCurrentTokenCount());
  }

  /**
   * Check if a message can be added without exceeding limits
   * @param message - The message to check
   * @returns True if message can be added within reserve limits
   */
  canAddMessage(message: BaseMessage): boolean {
    const messageTokens = this.tokenCounter.countMessageTokens(message);
    const currentTokens = this.getCurrentTokenCount();
    const wouldExceedReserve =
      currentTokens + messageTokens > this.maxTokens - this.reserveTokens;

    if (messageTokens > this.maxTokens) {
      return false;
    }

    return !wouldExceedReserve || this.messages.length > 0;
  }

  /**
   * Get all messages in the memory window
   * @returns Copy of current messages array
   */
  getMessages(): BaseMessage[] {
    return [...this.messages];
  }

  /**
   * Clear all messages from the memory window
   */
  clear(): void {
    this.messages = [];
  }

  /**
   * Set the system prompt and update token calculations
   * @param systemPrompt - The system prompt text
   */
  setSystemPrompt(systemPrompt: string): void {
    this.systemPrompt = systemPrompt;
    this.systemPromptTokens =
      this.tokenCounter.estimateSystemPromptTokens(systemPrompt);
  }

  /**
   * Get the current system prompt
   * @returns Current system prompt
   */
  getSystemPrompt(): string {
    return this.systemPrompt;
  }

  /**
   * Get current configuration
   * @returns Memory window configuration
   */
  getConfig(): {
    maxTokens: number;
    reserveTokens: number;
    currentTokens: number;
    messageCount: number;
    systemPromptTokens: number;
  } {
    return {
      maxTokens: this.maxTokens,
      reserveTokens: this.reserveTokens,
      currentTokens: this.getCurrentTokenCount(),
      messageCount: this.messages.length,
      systemPromptTokens: this.systemPromptTokens,
    };
  }

  /**
   * Update token limits
   * @param maxTokens - New maximum token limit
   * @param reserveTokens - New reserve token amount
   */
  updateLimits(maxTokens: number, reserveTokens?: number): void {
    if (reserveTokens !== undefined && reserveTokens >= maxTokens) {
      throw new Error('Reserve tokens must be less than max tokens');
    }

    this.maxTokens = maxTokens;
    if (reserveTokens !== undefined) {
      this.reserveTokens = reserveTokens;
    }

    if (this.getCurrentTokenCount() > this.maxTokens - this.reserveTokens) {
      this.pruneToFit();
    }
  }

  /**
   * Get statistics about the memory window
   * @returns Memory usage statistics
   */
  getStats(): {
    totalMessages: number;
    currentTokens: number;
    maxTokens: number;
    reserveTokens: number;
    systemPromptTokens: number;
    usagePercentage: number;
    remainingCapacity: number;
    canAcceptMore: boolean;
  } {
    const currentTokens = this.getCurrentTokenCount();
    const capacity = this.maxTokens;
    const usagePercentage = (currentTokens / capacity) * 100;

    return {
      totalMessages: this.messages.length,
      currentTokens,
      maxTokens: capacity,
      reserveTokens: this.reserveTokens,
      systemPromptTokens: this.systemPromptTokens,
      usagePercentage: Math.round(usagePercentage * 100) / 100,
      remainingCapacity: this.getRemainingTokenCapacity(),
      canAcceptMore: this.getRemainingTokenCapacity() > this.reserveTokens,
    };
  }

  /**
   * Clean up resources
   */
  dispose(): void {
    this.clear();
    this.tokenCounter.dispose();
  }
}
