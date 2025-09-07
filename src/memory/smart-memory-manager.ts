import type { BaseMessage } from '@langchain/core/messages';
import { SystemMessage } from '@langchain/core/messages';
import { Logger } from '@hashgraphonline/standards-sdk';
import { MemoryWindow } from './memory-window';
import { ContentStorage } from './content-storage';
import { TokenCounter } from './token-counter';

/**
 * Entity association for storing blockchain entity contexts
 */
export interface EntityAssociation {
  /** The blockchain entity ID (e.g., tokenId, accountId, topicId) */
  entityId: string;
  /** User-provided or derived friendly name */
  entityName: string;
  /** Type of entity (token, account, topic, schedule, etc.) */
  entityType: string;
  /** When the entity was created/associated */
  createdAt: Date;
  /** Transaction ID that created this entity */
  transactionId?: string;
  /** Optional session identifier to scope associations */
  sessionId?: string;
}

/**
 * Options for resolving entity references
 */
export interface EntityResolutionOptions {
  /** Filter by specific entity type */
  entityType?: string;
  /** Maximum number of results to return */
  limit?: number;
  /** Whether to use fuzzy matching for natural language queries */
  fuzzyMatch?: boolean;
}

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

const IS_ENTITY_ASSOCIATION_FLAG = '"isEntityAssociation":true';

/**
 * TODO: investigate using chroma / rag for long term memory
 * Smart memory manager that combines active memory window with long-term storage
 * Provides context-aware memory management with automatic pruning and searchable history
 */
export class SmartMemoryManager {
  private memoryWindow: MemoryWindow;
  private _contentStorage: ContentStorage;
  private tokenCounter: TokenCounter;
  private config: Required<SmartMemoryConfig>;
  private logger: Logger;

  private static readonly DEFAULT_CONFIG: Required<SmartMemoryConfig> = {
    maxTokens: 8000,
    reserveTokens: 1000,
    modelName: 'gpt-4o',
    storageLimit: 1000,
  };

  constructor(config: SmartMemoryConfig = {}) {
    this.config = { ...SmartMemoryManager.DEFAULT_CONFIG, ...config };
    this.logger = new Logger({ module: 'SmartMemoryManager' });

    this.tokenCounter = new TokenCounter(this.config.modelName);
    this._contentStorage = new ContentStorage(this.config.storageLimit);
    this.memoryWindow = new MemoryWindow(
      this.config.maxTokens,
      this.config.reserveTokens,
      this.tokenCounter
    );
  }

  /**
   * Get the content storage instance for file/content reference operations
   * @returns ContentStorage instance
   */
  get contentStorage(): ContentStorage {
    return this._contentStorage;
  }

  /**
   * Add a message to the active memory window
   * Automatically handles pruning and storage of displaced messages
   * @param message - Message to add
   */
  addMessage(message: BaseMessage): void {
    const result = this.memoryWindow.addMessage(message);

    if (result.prunedMessages.length > 0) {
      this._contentStorage.storeMessages(result.prunedMessages);
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
      this._contentStorage.clear();
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
    return this._contentStorage.searchMessages(query, options);
  }

  /**
   * Get recent messages from storage history
   * @param count - Number of recent messages to retrieve
   * @returns Array of recent messages from storage
   */
  getRecentHistory(count: number): BaseMessage[] {
    return this._contentStorage.getRecentMessages(count);
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
      usagePercentage: windowStats.usagePercentage,
    };
  }

  /**
   * Get statistics about the content storage
   * @returns Storage usage statistics
   */
  getStorageStats(): ReturnType<ContentStorage['getStorageStats']> {
    return this._contentStorage.getStorageStats();
  }

  /**
   * Get combined statistics for both active memory and storage
   * @returns Combined memory and storage statistics
   */
  getOverallStats(): {
    activeMemory: MemoryStats;
    storage: ReturnType<ContentStorage['getStorageStats']>;
    totalMessagesManaged: number;
    activeMemoryUtilization: number;
    storageUtilization: number;
  } {
    const memoryStats = this.getMemoryStats();
    const storageStats = this.getStorageStats();

    return {
      activeMemory: memoryStats,
      storage: storageStats,
      totalMessagesManaged:
        memoryStats.totalActiveMessages + storageStats.totalMessages,
      activeMemoryUtilization: memoryStats.usagePercentage,
      storageUtilization: storageStats.usagePercentage,
    };
  }

  /**
   * Update the configuration and apply changes
   * @param newConfig - New configuration options
   */
  updateConfig(newConfig: Partial<SmartMemoryConfig>): void {
    this.config = { ...this.config, ...newConfig };

    if (
      newConfig.maxTokens !== undefined ||
      newConfig.reserveTokens !== undefined
    ) {
      this.memoryWindow.updateLimits(
        this.config.maxTokens,
        this.config.reserveTokens
      );
    }

    if (newConfig.storageLimit !== undefined) {
      this._contentStorage.updateStorageLimit(this.config.storageLimit);
    }
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
    return this._contentStorage.getMessagesFromTimeRange(startTime, endTime);
  }

  /**
   * Get messages from storage by message type
   * @param messageType - Type of messages to retrieve ('human', 'ai', 'system', etc.)
   * @param limit - Maximum number of messages to return
   * @returns Messages of the specified type
   */
  getHistoryByType(messageType: string, limit?: number): BaseMessage[] {
    return this._contentStorage.getMessagesByType(messageType, limit);
  }

  /**
   * Get recent messages from storage within the last N minutes
   * @param minutes - Number of minutes to look back
   * @returns Messages from the last N minutes
   */
  getRecentHistoryByTime(minutes: number): BaseMessage[] {
    return this._contentStorage.getRecentMessagesByTime(minutes);
  }

  /**
   * Export the current state for persistence or analysis
   * @returns Serializable representation of memory state
   */
  exportState(): {
    config: Required<SmartMemoryConfig>;
    activeMessages: Array<{ content: unknown; type: string }>;
    systemPrompt: string;
    memoryStats: MemoryStats;
    storageStats: ReturnType<ContentStorage['getStorageStats']>;
    storedMessages: ReturnType<ContentStorage['exportMessages']>;
  } {
    return {
      config: this.config,
      activeMessages: this.memoryWindow.getMessages().map((msg) => ({
        content: msg.content,
        type: msg._getType(),
      })),
      systemPrompt: this.memoryWindow.getSystemPrompt(),
      memoryStats: this.getMemoryStats(),
      storageStats: this.getStorageStats(),
      storedMessages: this._contentStorage.exportMessages(),
    };
  }

  /**
   * Get a summary of conversation context for external use
   * Useful for providing context to other systems or for logging
   * @param includeStoredContext - Whether to include recent stored messages
   * @returns Context summary object
   */
  getContextSummary(includeStoredContext: boolean = false): {
    activeMessageCount: number;
    systemPrompt: string;
    recentMessages: BaseMessage[];
    memoryUtilization: number;
    hasStoredHistory: boolean;
    recentStoredMessages?: BaseMessage[];
    storageStats?: ReturnType<ContentStorage['getStorageStats']>;
  } {
    const activeMessages = this.getMessages();
    const summary = {
      activeMessageCount: activeMessages.length,
      systemPrompt: this.getSystemPrompt(),
      recentMessages: activeMessages.slice(-5),
      memoryUtilization: this.getMemoryStats().usagePercentage,
      hasStoredHistory: this.getStorageStats().totalMessages > 0,
    };

    if (includeStoredContext) {
      return {
        ...summary,
        recentStoredMessages: this.getRecentHistory(10),
        storageStats: this.getStorageStats(),
      };
    }

    return summary;
  }

  /**
   * Perform maintenance operations
   * Optimizes storage and cleans up resources
   */
  performMaintenance(): void {}

  /**
   * Store an entity association for later resolution
   * @param entityId - The blockchain entity ID
   * @param entityName - User-provided or derived friendly name
   * @param entityType - Type of entity (token, account, topic, etc.)
   * @param transactionId - Optional transaction ID that created this entity
   */
  storeEntityAssociation(
    entityId: string,
    entityName: string,
    entityType: string,
    transactionId?: string,
    sessionId?: string
  ): void {
    try {
      if (
        !entityId ||
        typeof entityId !== 'string' ||
        entityId.trim().length === 0
      ) {
        return;
      }

      if (
        !entityName ||
        typeof entityName !== 'string' ||
        entityName.trim().length === 0
      ) {
        return;
      }

      if (
        !entityType ||
        typeof entityType !== 'string' ||
        entityType.trim().length === 0
      ) {
        return;
      }

      const sanitizedEntityId = entityId.trim();
      const sanitizedEntityName = entityName.trim().substring(0, 100);
      const sanitizedEntityType = this.normalizeEntityType(entityType);

      let usageHint = '';
      if (sanitizedEntityType === 'tokenid') {
        usageHint = 'Use this as tokenId for HTS operations';
      } else if (sanitizedEntityType === 'topicid') {
        usageHint =
          'Can be used for HCS operations, HRLs for minting with the format hcs://1/<topicId>, etc.';
      } else if (sanitizedEntityType === 'accountid') {
        usageHint = 'Can be used for account based operations';
      }

      const association: EntityAssociation & {
        isEntityAssociation: boolean;
        usage?: string;
        hrl?: string;
      } = {
        entityId: sanitizedEntityId,
        entityName: sanitizedEntityName,
        entityType: sanitizedEntityType,
        createdAt: new Date(),
        isEntityAssociation: true,
        ...(usageHint ? { usage: usageHint } : {}),
        ...(sanitizedEntityType === 'topicId'
          ? { hrl: `hcs://1/${sanitizedEntityId}` }
          : {}),
        ...(transactionId !== undefined &&
        transactionId !== null &&
        transactionId.trim() !== ''
          ? { transactionId: transactionId.trim() }
          : {}),
        ...(sessionId && sessionId.trim() !== '' ? { sessionId: sessionId.trim() } : {}),
      };

      const content = JSON.stringify(association);
      type LangChainLikeMessage = {
        _getType: () => string;
        content: unknown;
        id: string;
        name?: string;
        additional_kwargs?: Record<string, unknown>;
      };

      const entityMessage: LangChainLikeMessage = {
        _getType: () => 'system',
        content: content,
        id: `entity_${sanitizedEntityId}_${Date.now()}`,
        name: 'entity_association',
        additional_kwargs: {
          entityId: sanitizedEntityId,
          entityName: sanitizedEntityName,
          entityType: sanitizedEntityType,
          isEntityAssociation: true,
          ...(sessionId && sessionId.trim() !== '' ? { sessionId: sessionId.trim() } : {}),
        },
      };

      try {
        this.memoryWindow.addMessage(new SystemMessage(content));
      } catch {}

      this._contentStorage.storeMessages([entityMessage as BaseMessage]);
    } catch (error) {
      this.logger.error('Failed to store entity association', {
        entityId,
        entityName,
        entityType,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Normalize various type aliases to canonical EntityFormat strings using a registry.
   */
  private normalizeEntityType(input: string): string {
    const raw = (input || '').trim();
    if (raw.length === 0) {
      return '';
    }

    const key = raw.replace(/[^a-z]/gi, '').toLowerCase();

    const REGISTRY: Record<string, string> = {
      topic: 'topicId',
      topicid: 'topicId',
      token: 'tokenId',
      tokenid: 'tokenId',
      account: 'accountId',
      accountid: 'accountId',
      contract: 'contractId',
      contractid: 'contractId',
      file: 'fileId',
      fileid: 'fileId',
      schedule: 'scheduleId',
      scheduleid: 'scheduleId',
    };

    if (Object.prototype.hasOwnProperty.call(REGISTRY, key)) {
      return REGISTRY[key];
    }

    if (/^[a-z]+Id$/.test(raw)) {
      return raw;
    }

    return raw;
  }

  /**
   * Resolve entity references from natural language queries
   * @param query - Search query (entity name or natural language reference)
   * @param options - Resolution options for filtering and fuzzy matching
   * @returns Array of matching entity associations
   */
  resolveEntityReference(
    query: string,
    options: EntityResolutionOptions = {}
  ): EntityAssociation[] {
    try {
      if (!query || typeof query !== 'string') {
        return [];
      }

      const sanitizedQuery = query.trim();
      if (sanitizedQuery.length === 0) {
        return [];
      }

      if (sanitizedQuery.length > 200) {
      }

      const { entityType, limit = 10, fuzzyMatch = true } = options;

      const safeLimit = Math.max(1, Math.min(limit || 10, 100));

      const isEntityIdQuery = /^0\.0\.\d+$/.test(sanitizedQuery);

      const searchResults = this._contentStorage.searchMessages(
        sanitizedQuery.substring(0, 200),
        {
          caseSensitive: false,
          limit: safeLimit * 2,
        }
      );

      const associations: EntityAssociation[] = [];

      for (const message of searchResults) {
        try {
          const content = message.content as string;
          if (
            content.includes(IS_ENTITY_ASSOCIATION_FLAG) ||
            content.includes('entityId')
          ) {
            const parsed = JSON.parse(content);
            if (parsed.entityId && parsed.entityName && parsed.entityType) {
              if (entityType && parsed.entityType !== entityType) {
                continue;
              }

              if (isEntityIdQuery) {
                if (parsed.entityId !== sanitizedQuery) {
                  continue;
                }
              }

              associations.push(parsed as EntityAssociation);
            }
          }
        } catch {
          continue;
        }
      }

      if (fuzzyMatch && associations.length === 0 && !isEntityIdQuery) {
        const fuzzyQueries = [
          query.toLowerCase(),
          `token`,
          `account`,
          entityType || '',
        ].filter(Boolean);

        for (const fuzzyQuery of fuzzyQueries) {
          if (fuzzyQuery === query.toLowerCase()) continue;

          const fuzzyResults = this._contentStorage.searchMessages(fuzzyQuery, {
            caseSensitive: false,
            limit: limit,
          });

          for (const message of fuzzyResults) {
            try {
              const content = message.content as string;
              if (content.includes(IS_ENTITY_ASSOCIATION_FLAG)) {
                const parsed = JSON.parse(content);
                if (parsed.entityId && parsed.entityName && parsed.entityType) {
                  if (entityType && parsed.entityType !== entityType) {
                    continue;
                  }
                  associations.push(parsed as EntityAssociation);
                }
              }
            } catch {
              continue;
            }
          }
        }
      }

      const uniqueAssociations = associations
        .filter(
          (assoc, index, arr) =>
            arr.findIndex((a) => a.entityId === assoc.entityId) === index
        )
        .sort(
          (a, b) =>
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );

      const results = uniqueAssociations.slice(0, safeLimit);

      return results;
    } catch (error) {
      this.logger.error('Failed to resolve entity reference', {
        query,
        options,
        error: error instanceof Error ? error.message : String(error),
      });
      return [];
    }
  }

  /**
   * Get all entity associations, optionally filtered by type
   * @param entityType - Optional filter by entity type
   * @returns Array of entity associations
   */
  getEntityAssociations(entityType?: string): EntityAssociation[] {
    try {
      const rawFilter = entityType ? entityType.trim() : undefined;
      const filterCanonical = rawFilter ? this.normalizeEntityType(rawFilter) : undefined;

      if (entityType && (!rawFilter || rawFilter.length === 0)) {
        return [];
      }

      const SEARCH_ANY_ENTITY = 'entityId';
      const searchQuery = filterCanonical || SEARCH_ANY_ENTITY;
      const searchResults = this._contentStorage.searchMessages(searchQuery, {
        caseSensitive: false,
        limit: 100,
      });

      const associations: EntityAssociation[] = [];

      for (const message of searchResults) {
        try {
          const content = message.content as string;
          if (content.includes(IS_ENTITY_ASSOCIATION_FLAG)) {
            const parsed = JSON.parse(content);

            if (parsed.entityId && parsed.entityName && parsed.entityType) {
              if (filterCanonical && parsed.entityType !== filterCanonical) {
                continue;
              }

              if (parsed.createdAt && typeof parsed.createdAt === 'string') {
                parsed.createdAt = new Date(parsed.createdAt);
              }

              associations.push(parsed as EntityAssociation);
            }
          }
        } catch (parseError) {
          this.logger.warn('Failed to parse entity association from message', {
            messageContent:
              typeof message.content === 'string'
                ? message.content.substring(0, 100)
                : 'non-string',
            error:
              parseError instanceof Error
                ? parseError.message
                : String(parseError),
          });
          continue;
        }
      }

      const mergedById = new Map<string, EntityAssociation>();
      const getTime = (d: Date | string): number =>
        d instanceof Date ? d.getTime() : new Date(d).getTime();

      for (const assoc of associations) {
        const existing = mergedById.get(assoc.entityId);
        if (!existing) {
          mergedById.set(assoc.entityId, assoc);
          continue;
        }

        const existingTime = getTime(existing.createdAt);
        const currentTime = getTime(assoc.createdAt);

        const preferCurrent =
          currentTime > existingTime ||
          (!!assoc.transactionId && !existing.transactionId);

        if (preferCurrent) {
          mergedById.set(assoc.entityId, {
            ...existing,
            ...assoc,
          });
        }
      }

      const results = Array.from(mergedById.values()).sort((a, b) =>
        getTime(b.createdAt) - getTime(a.createdAt)
      );

      return results;
    } catch (error) {
      this.logger.error('Failed to get entity associations', {
        entityType,
        error: error instanceof Error ? error.message : String(error),
      });
      return [];
    }
  }

  /**
   * Clean up resources and dispose of components
   */
  dispose(): void {
    this.memoryWindow.dispose();
    this._contentStorage.dispose();
    this.tokenCounter.dispose();
  }
}
