import type { BaseMessage } from '@langchain/core/messages';
import { MemoryWindow } from './MemoryWindow';
import { ContentStorage } from './ContentStorage';
import { TokenCounter } from './TokenCounter';

/**
 * Configuration for SmartMemoryManager
 */
export interface SmartMemoryConfig {
  /** Maximum tokens for active memory window */
  maxTokens?: number;
  /** Reserve tokens for response generation */
  reserveTokens?: number;
  /** Model name for token counting */
  modelName?: string;
  /** Maximum messages to store in content storage */
  storageLimit?: number;
}

/**
 * Search options for history search
 */
export interface SearchOptions {
  /** Whether to perform case-sensitive search */
  caseSensitive?: boolean;
  /** Maximum number of results to return */
  limit?: number;
  /** Whether to use regex pattern matching */
  useRegex?: boolean;
}

/**
 * Memory statistics for active memory window
 */
export interface MemoryStats {
  /** Total active messages in memory window */
  totalActiveMessages: number;
  /** Current token count including system prompt */
  currentTokenCount: number;
  /** Maximum token capacity */
  maxTokens: number;
  /** Remaining token capacity */
  remainingCapacity: number;
  /** System prompt token count */
  systemPromptTokens: number;
  /** Memory usage percentage */
  usagePercentage: number;
}

/**
 * Smart memory manager that combines active memory window with long-term storage
 * Provides context-aware memory management with automatic pruning and searchable history
 */
export class SmartMemoryManager {
  private memoryWindow: MemoryWindow;
  private contentStorage: ContentStorage;
  private tokenCounter: TokenCounter;
  private config: Required<SmartMemoryConfig>;

  // Default configuration values
  private static readonly DEFAULT_CONFIG: Required<SmartMemoryConfig> = {
    maxTokens: 8000,
    reserveTokens: 1000,
    modelName: 'gpt-4o',
    storageLimit: 1000
  };

  constructor(config: SmartMemoryConfig = {}) {
    this.config = { ...SmartMemoryManager.DEFAULT_CONFIG, ...config };
    
    // Initialize components
    this.tokenCounter = new TokenCounter(this.config.modelName as any);
    this.contentStorage = new ContentStorage(this.config.storageLimit);
    this.memoryWindow = new MemoryWindow(
      this.config.maxTokens,
      this.config.reserveTokens,
      this.tokenCounter
    );
  }

  /**
   * Add a message to the active memory window
   * Automatically handles pruning and storage of displaced messages
   * @param message - Message to add
   */
  addMessage(message: BaseMessage): void {
    const result = this.memoryWindow.addMessage(message);
    
    // Store any pruned messages in content storage
    if (result.prunedMessages.length > 0) {
      this.contentStorage.storeMessages(result.prunedMessages);
    }
  }

  /**
   * Get all active messages from the memory window
   * @returns Array of active messages in chronological order
   */
  getMessages(): BaseMessage[] {
    return this.memoryWindow.getMessages();
  }

  /**
   * Clear active memory window
   * @param clearStorage - Whether to also clear the content storage (default: false)
   */
  clear(clearStorage: boolean = false): void {
    this.memoryWindow.clear();
    
    if (clearStorage) {
      this.contentStorage.clear();
    }
  }

  /**
   * Set the system prompt for the memory window
   * @param systemPrompt - System prompt text
   */
  setSystemPrompt(systemPrompt: string): void {
    this.memoryWindow.setSystemPrompt(systemPrompt);
  }

  /**
   * Get the current system prompt
   * @returns Current system prompt text
   */
  getSystemPrompt(): string {
    return this.memoryWindow.getSystemPrompt();
  }

  /**
   * Search through stored message history
   * @param query - Search term or pattern
   * @param options - Search configuration
   * @returns Array of matching messages from history
   */
  searchHistory(query: string, options: SearchOptions = {}): BaseMessage[] {
    return this.contentStorage.searchMessages(query, options);
  }

  /**
   * Get recent messages from storage history
   * @param count - Number of recent messages to retrieve
   * @returns Array of recent messages from storage
   */
  getRecentHistory(count: number): BaseMessage[] {
    return this.contentStorage.getRecentMessages(count);
  }

  /**
   * Check if a message can be added without exceeding limits
   * @param message - Message to test
   * @returns True if message can be added
   */
  canAddMessage(message: BaseMessage): boolean {
    return this.memoryWindow.canAddMessage(message);
  }

  /**
   * Get statistics about the active memory window
   * @returns Memory usage statistics
   */
  getMemoryStats(): MemoryStats {
    const windowStats = this.memoryWindow.getStats();
    
    return {
      totalActiveMessages: windowStats.totalMessages,
      currentTokenCount: windowStats.currentTokens,
      maxTokens: windowStats.maxTokens,
      remainingCapacity: windowStats.remainingCapacity,
      systemPromptTokens: windowStats.systemPromptTokens,
      usagePercentage: windowStats.usagePercentage
    };
  }

  /**
   * Get statistics about the content storage
   * @returns Storage usage statistics
   */
  getStorageStats() {
    return this.contentStorage.getStorageStats();
  }

  /**
   * Get combined statistics for both active memory and storage
   * @returns Combined memory and storage statistics
   */
  getOverallStats() {
    const memoryStats = this.getMemoryStats();
    const storageStats = this.getStorageStats();
    
    return {
      activeMemory: memoryStats,
      storage: storageStats,
      totalMessagesManaged: memoryStats.totalActiveMessages + storageStats.totalMessages,
      activeMemoryUtilization: memoryStats.usagePercentage,
      storageUtilization: storageStats.usagePercentage
    };
  }

  /**
   * Update the configuration and apply changes
   * @param newConfig - New configuration options
   */
  updateConfig(newConfig: Partial<SmartMemoryConfig>): void {
    this.config = { ...this.config, ...newConfig };
    
    // Update components with new configuration
    if (newConfig.maxTokens !== undefined || newConfig.reserveTokens !== undefined) {
      this.memoryWindow.updateLimits(
        this.config.maxTokens,
        this.config.reserveTokens
      );
    }
    
    if (newConfig.storageLimit !== undefined) {
      this.contentStorage.updateStorageLimit(this.config.storageLimit);
    }
    
    // Note: Model name changes would require recreating the token counter
    // This is not implemented to avoid disrupting ongoing operations
  }

  /**
   * Get current configuration
   * @returns Current configuration settings
   */
  getConfig(): Required<SmartMemoryConfig> {
    return { ...this.config };
  }

  /**
   * Get messages from storage within a time range
   * @param startTime - Start of time range
   * @param endTime - End of time range
   * @returns Messages within the specified time range
   */
  getHistoryFromTimeRange(startTime: Date, endTime: Date): BaseMessage[] {
    return this.contentStorage.getMessagesFromTimeRange(startTime, endTime);
  }

  /**
   * Get messages from storage by message type
   * @param messageType - Type of messages to retrieve ('human', 'ai', 'system', etc.)
   * @param limit - Maximum number of messages to return
   * @returns Messages of the specified type
   */
  getHistoryByType(messageType: string, limit?: number): BaseMessage[] {
    return this.contentStorage.getMessagesByType(messageType, limit);
  }

  /**
   * Get recent messages from storage within the last N minutes
   * @param minutes - Number of minutes to look back
   * @returns Messages from the last N minutes
   */
  getRecentHistoryByTime(minutes: number): BaseMessage[] {
    return this.contentStorage.getRecentMessagesByTime(minutes);
  }

  /**
   * Export the current state for persistence or analysis
   * @returns Serializable representation of memory state
   */
  exportState() {
    return {
      config: this.config,
      activeMessages: this.memoryWindow.getMessages().map(msg => ({
        content: msg.content,
        type: msg._getType()
      })),
      systemPrompt: this.memoryWindow.getSystemPrompt(),
      memoryStats: this.getMemoryStats(),
      storageStats: this.getStorageStats(),
      storedMessages: this.contentStorage.exportMessages()
    };
  }

  /**
   * Get a summary of conversation context for external use
   * Useful for providing context to other systems or for logging
   * @param includeStoredContext - Whether to include recent stored messages
   * @returns Context summary object
   */
  getContextSummary(includeStoredContext: boolean = false) {
    const activeMessages = this.getMessages();
    const summary = {
      activeMessageCount: activeMessages.length,
      systemPrompt: this.getSystemPrompt(),
      recentMessages: activeMessages.slice(-5), // Last 5 active messages
      memoryUtilization: this.getMemoryStats().usagePercentage,
      hasStoredHistory: this.getStorageStats().totalMessages > 0
    };

    if (includeStoredContext) {
      return {
        ...summary,
        recentStoredMessages: this.getRecentHistory(10), // Last 10 stored messages
        storageStats: this.getStorageStats()
      };
    }

    return summary;
  }

  /**
   * Perform maintenance operations
   * Optimizes storage and cleans up resources
   */
  performMaintenance(): void {
    // No specific maintenance needed currently
    // This method is reserved for future optimizations
  }

  /**
   * Clean up resources and dispose of components
   */
  dispose(): void {
    this.memoryWindow.dispose();
    this.contentStorage.dispose();
    this.tokenCounter.dispose();
  }
}