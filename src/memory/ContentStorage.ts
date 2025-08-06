import type { BaseMessage } from '@langchain/core/messages';

/**
 * Stored message with metadata
 */
interface StoredMessage {
  message: BaseMessage;
  storedAt: Date;
  id: string;
}

/**
 * Search options for message queries
 */
interface SearchOptions {
  /** Whether to perform case-sensitive search */
  caseSensitive?: boolean;
  /** Maximum number of results to return */
  limit?: number;
  /** Whether to use regex pattern matching */
  useRegex?: boolean;
}

/**
 * Result of storing messages
 */
interface StoreResult {
  /** Number of messages successfully stored */
  stored: number;
  /** Number of old messages dropped to make room */
  dropped: number;
}

/**
 * Storage statistics
 */
export interface StorageStats {
  /** Total number of messages currently stored */
  totalMessages: number;
  /** Maximum storage capacity */
  maxStorageLimit: number;
  /** Percentage of storage used */
  usagePercentage: number;
  /** Timestamp of oldest message */
  oldestMessageTime: Date | undefined;
  /** Timestamp of newest message */
  newestMessageTime: Date | undefined;
}

/**
 * Content storage for managing pruned conversation messages
 * Provides searchable storage with time-based querying and automatic cleanup
 */
export class ContentStorage {
  private messages: StoredMessage[] = [];
  private maxStorage: number;
  private idCounter: number = 0;

  // Default storage limit for messages
  public static readonly DEFAULT_MAX_STORAGE = 1000;

  constructor(maxStorage: number = ContentStorage.DEFAULT_MAX_STORAGE) {
    this.maxStorage = maxStorage;
  }

  /**
   * Store messages in the content storage
   * Automatically drops oldest messages if storage limit is exceeded
   * @param messages - Messages to store
   * @returns Result indicating how many messages were stored and dropped
   */
  storeMessages(messages: BaseMessage[]): StoreResult {
    if (messages.length === 0) {
      return { stored: 0, dropped: 0 };
    }

    const now = new Date();
    let dropped = 0;

    // Convert messages to stored format
    const storedMessages: StoredMessage[] = messages.map(message => ({
      message,
      storedAt: now,
      id: this.generateId()
    }));

    // Add new messages
    this.messages.push(...storedMessages);

    // Remove oldest messages if we exceed the limit
    while (this.messages.length > this.maxStorage) {
      this.messages.shift();
      dropped++;
    }

    return {
      stored: storedMessages.length,
      dropped
    };
  }

  /**
   * Get the most recent messages from storage
   * @param count - Number of recent messages to retrieve
   * @returns Array of recent messages in chronological order
   */
  getRecentMessages(count: number): BaseMessage[] {
    if (count <= 0 || this.messages.length === 0) {
      return [];
    }

    const startIndex = Math.max(0, this.messages.length - count);
    return this.messages
      .slice(startIndex)
      .map(stored => stored.message);
  }

  /**
   * Search for messages containing specific text or patterns
   * @param query - Search term or regex pattern
   * @param options - Search configuration options
   * @returns Array of matching messages
   */
  searchMessages(query: string, options: SearchOptions = {}): BaseMessage[] {
    if (!query || this.messages.length === 0) {
      return [];
    }

    const {
      caseSensitive = false,
      limit,
      useRegex = false
    } = options;

    let matches: BaseMessage[] = [];

    if (useRegex) {
      try {
        const regex = new RegExp(query, caseSensitive ? 'g' : 'gi');
        matches = this.messages
          .filter(stored => regex.test(stored.message.content as string))
          .map(stored => stored.message);
      } catch (error) {
        console.warn('Invalid regex pattern:', query, error);
        return [];
      }
    } else {
      const searchTerm = caseSensitive ? query : query.toLowerCase();
      matches = this.messages
        .filter(stored => {
          const content = stored.message.content as string;
          const searchContent = caseSensitive ? content : content.toLowerCase();
          return searchContent.includes(searchTerm);
        })
        .map(stored => stored.message);
    }

    return limit ? matches.slice(0, limit) : matches;
  }

  /**
   * Get messages from a specific time range
   * @param startTime - Start of time range (inclusive)
   * @param endTime - End of time range (inclusive)
   * @returns Array of messages within the time range
   */
  getMessagesFromTimeRange(startTime: Date, endTime: Date): BaseMessage[] {
    if (startTime > endTime || this.messages.length === 0) {
      return [];
    }

    return this.messages
      .filter(stored => 
        stored.storedAt >= startTime && stored.storedAt <= endTime
      )
      .map(stored => stored.message);
  }

  /**
   * Get storage statistics and usage information
   * @returns Current storage statistics
   */
  getStorageStats(): StorageStats {
    const totalMessages = this.messages.length;
    const usagePercentage = totalMessages > 0 
      ? Math.round((totalMessages / this.maxStorage) * 100)
      : 0;

    let oldestMessageTime: Date | undefined;
    let newestMessageTime: Date | undefined;

    if (totalMessages > 0) {
      oldestMessageTime = this.messages[0].storedAt;
      newestMessageTime = this.messages[totalMessages - 1].storedAt;
    }

    return {
      totalMessages,
      maxStorageLimit: this.maxStorage,
      usagePercentage,
      oldestMessageTime,
      newestMessageTime
    };
  }

  /**
   * Clear all stored messages
   */
  clear(): void {
    this.messages = [];
    this.idCounter = 0;
  }

  /**
   * Get total number of stored messages
   * @returns Number of messages currently in storage
   */
  getTotalStoredMessages(): number {
    return this.messages.length;
  }

  /**
   * Update the maximum storage limit
   * @param newLimit - New maximum storage limit
   */
  updateStorageLimit(newLimit: number): void {
    if (newLimit <= 0) {
      throw new Error('Storage limit must be greater than 0');
    }

    this.maxStorage = newLimit;

    // Prune messages if the new limit is smaller
    while (this.messages.length > this.maxStorage) {
      this.messages.shift();
    }
  }

  /**
   * Get messages by message type
   * @param messageType - Type of messages to retrieve ('human', 'ai', 'system', etc.)
   * @param limit - Maximum number of messages to return
   * @returns Array of messages of the specified type
   */
  getMessagesByType(messageType: string, limit?: number): BaseMessage[] {
    const filtered = this.messages
      .filter(stored => stored.message._getType() === messageType)
      .map(stored => stored.message);

    return limit ? filtered.slice(0, limit) : filtered;
  }

  /**
   * Get the current storage configuration
   * @returns Storage configuration object
   */
  getConfig() {
    return {
      maxStorage: this.maxStorage,
      currentUsage: this.messages.length,
      utilizationPercentage: (this.messages.length / this.maxStorage) * 100
    };
  }

  /**
   * Generate a unique ID for stored messages
   * @returns Unique string identifier
   */
  private generateId(): string {
    return `msg_${++this.idCounter}_${Date.now()}`;
  }

  /**
   * Get messages stored within the last N minutes
   * @param minutes - Number of minutes to look back
   * @returns Array of messages from the last N minutes
   */
  getRecentMessagesByTime(minutes: number): BaseMessage[] {
    if (minutes <= 0 || this.messages.length === 0) {
      return [];
    }

    const cutoffTime = new Date(Date.now() - (minutes * 60 * 1000));
    
    return this.messages
      .filter(stored => stored.storedAt >= cutoffTime)
      .map(stored => stored.message);
  }

  /**
   * Export messages to a JSON-serializable format
   * @returns Serializable representation of stored messages
   */
  exportMessages() {
    return this.messages.map(stored => ({
      content: stored.message.content,
      type: stored.message._getType(),
      storedAt: stored.storedAt.toISOString(),
      id: stored.id
    }));
  }

  /**
   * Clean up resources
   */
  dispose(): void {
    this.clear();
  }
}