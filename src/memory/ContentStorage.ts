import type { BaseMessage } from '@langchain/core/messages';
import { ReferenceIdGenerator } from './ReferenceIdGenerator';
import {
  ReferenceId,
  ContentReference,
  ContentMetadata,
  ReferenceResolutionResult,
  ContentReferenceConfig,
  ContentReferenceStore,
  ContentReferenceStats,
  ContentReferenceError,
  ContentType,
  ContentSource,
  ReferenceLifecycleState,
  DEFAULT_CONTENT_REFERENCE_CONFIG
} from '../types/content-reference';

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
 * Stored content with reference metadata
 */
interface StoredContent {
  /** The actual content buffer */
  content: Buffer;
  
  /** Complete metadata */
  metadata: ContentMetadata;
  
  /** Current lifecycle state */
  state: ReferenceLifecycleState;
  
  /** When this reference expires (if applicable) */
  expiresAt?: Date;
}

/**
 * Content storage for managing pruned conversation messages and large content references
 * Provides searchable storage with time-based querying and automatic cleanup.
 * 
 * Extended to support reference-based storage for large content to optimize context window usage.
 */
export class ContentStorage implements ContentReferenceStore {
  private messages: StoredMessage[] = [];
  private maxStorage: number;
  private idCounter: number = 0;

  private contentStore: Map<ReferenceId, StoredContent> = new Map();
  private referenceConfig: ContentReferenceConfig;
  private cleanupTimer?: NodeJS.Timeout;
  private referenceStats: Omit<ContentReferenceStats, 'performanceMetrics'> & {
    performanceMetrics: ContentReferenceStats['performanceMetrics'] & {
      creationTimes: number[];
      resolutionTimes: number[];
      cleanupTimes: number[];
    };
  };

  public static readonly DEFAULT_MAX_STORAGE = 1000;

  constructor(
    maxStorage: number = ContentStorage.DEFAULT_MAX_STORAGE,
    referenceConfig?: Partial<ContentReferenceConfig>
  ) {
    this.maxStorage = maxStorage;
    
    this.referenceConfig = { ...DEFAULT_CONTENT_REFERENCE_CONFIG, ...referenceConfig };
    this.referenceStats = {
      activeReferences: 0,
      totalStorageBytes: 0,
      recentlyCleanedUp: 0,
      totalResolutions: 0,
      failedResolutions: 0,
      averageContentSize: 0,
      storageUtilization: 0,
      performanceMetrics: {
        averageCreationTimeMs: 0,
        averageResolutionTimeMs: 0,
        averageCleanupTimeMs: 0,
        creationTimes: [],
        resolutionTimes: [],
        cleanupTimes: []
      }
    };
    
    if (this.referenceConfig.enableAutoCleanup) {
      this.startReferenceCleanupTimer();
    }
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

    const storedMessages: StoredMessage[] = messages.map(message => ({
      message,
      storedAt: now,
      id: this.generateId()
    }));

    this.messages.push(...storedMessages);

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
   * Determine if content should be stored as a reference based on size
   */
  shouldUseReference(content: Buffer | string): boolean {
    const size = Buffer.isBuffer(content) ? content.length : Buffer.byteLength(content, 'utf8');
    return size > this.referenceConfig.sizeThresholdBytes;
  }

  /**
   * Store content and return a reference if it exceeds the size threshold
   * Otherwise returns null to indicate direct content should be used
   */
  async storeContentIfLarge(
    content: Buffer | string,
    metadata: {
      contentType?: ContentType;
      mimeType?: string;
      source: ContentSource;
      mcpToolName?: string;
      fileName?: string;
      tags?: string[];
      customMetadata?: Record<string, unknown>;
    }
  ): Promise<ContentReference | null> {
    const buffer = Buffer.isBuffer(content) ? content : Buffer.from(content, 'utf8');
    
    if (!this.shouldUseReference(buffer)) {
      return null;
    }
    
    const storeMetadata: Omit<ContentMetadata, 'createdAt' | 'lastAccessedAt' | 'accessCount'> = {
      contentType: metadata.contentType || this.detectContentType(buffer, metadata.mimeType),
      sizeBytes: buffer.length,
      source: metadata.source,
      tags: []
    };
    
    if (metadata.mimeType !== undefined) {
      storeMetadata.mimeType = metadata.mimeType;
    }
    if (metadata.mcpToolName !== undefined) {
      storeMetadata.mcpToolName = metadata.mcpToolName;
    }
    if (metadata.fileName !== undefined) {
      storeMetadata.fileName = metadata.fileName;
    }
    if (metadata.tags !== undefined) {
      storeMetadata.tags = metadata.tags;
    }
    if (metadata.customMetadata !== undefined) {
      storeMetadata.customMetadata = metadata.customMetadata;
    }
    
    return await this.storeContent(buffer, storeMetadata);
  }

  /**
   * Store content and return a reference (implements ContentReferenceStore)
   */
  async storeContent(
    content: Buffer,
    metadata: Omit<ContentMetadata, 'createdAt' | 'lastAccessedAt' | 'accessCount'>
  ): Promise<ContentReference> {
    const startTime = Date.now();
    
    try {
      const now = new Date();
      const referenceId = ReferenceIdGenerator.generateId(content);
      
      const fullMetadata: ContentMetadata = {
        ...metadata,
        createdAt: now,
        lastAccessedAt: now,
        accessCount: 0
      };
      
      const storedContent: StoredContent = {
        content,
        metadata: fullMetadata,
        state: 'active'
      };
      
      const expirationTime = this.calculateExpirationTime(metadata.source);
      if (expirationTime !== undefined) {
        storedContent.expiresAt = expirationTime;
      }
      
      this.contentStore.set(referenceId, storedContent);
      
      this.updateStatsAfterStore(content.length);
      
      await this.enforceReferenceStorageLimits();
      
      const preview = this.createContentPreview(content, fullMetadata.contentType);
      
      const referenceMetadata: Pick<ContentMetadata, 'contentType' | 'sizeBytes' | 'source' | 'fileName' | 'mimeType'> = {
        contentType: fullMetadata.contentType,
        sizeBytes: fullMetadata.sizeBytes,
        source: fullMetadata.source
      };
      
      if (fullMetadata.fileName !== undefined) {
        referenceMetadata.fileName = fullMetadata.fileName;
      }
      if (fullMetadata.mimeType !== undefined) {
        referenceMetadata.mimeType = fullMetadata.mimeType;
      }
      
      const reference: ContentReference = {
        referenceId,
        state: 'active',
        preview,
        metadata: referenceMetadata,
        createdAt: now,
        format: 'ref://{id}' as const
      };
      
      const duration = Date.now() - startTime;
      this.recordPerformanceMetric('creation', duration);
      
      return reference;
    } catch (error) {
      const duration = Date.now() - startTime;
      this.recordPerformanceMetric('creation', duration);
      
      throw new ContentReferenceError(
        `Failed to store content: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'system_error',
        undefined,
        ['Try again', 'Check storage limits', 'Contact administrator']
      );
    }
  }

  /**
   * Resolve a reference to its content (implements ContentReferenceStore)
   */
  async resolveReference(referenceId: ReferenceId): Promise<ReferenceResolutionResult> {
    const startTime = Date.now();
    
    try {
      if (!ReferenceIdGenerator.isValidReferenceId(referenceId)) {
        this.referenceStats.failedResolutions++;
        return {
          success: false,
          error: 'Invalid reference ID format',
          errorType: 'not_found',
          suggestedActions: ['Check the reference ID format', 'Ensure the reference ID is complete']
        };
      }
      
      const storedContent = this.contentStore.get(referenceId);
      
      if (!storedContent) {
        this.referenceStats.failedResolutions++;
        return {
          success: false,
          error: 'Reference not found',
          errorType: 'not_found',
          suggestedActions: ['Verify the reference ID', 'Check if the content has expired', 'Request fresh content']
        };
      }
      
      if (storedContent.expiresAt && storedContent.expiresAt < new Date()) {
        storedContent.state = 'expired';
        this.referenceStats.failedResolutions++;
        return {
          success: false,
          error: 'Reference has expired',
          errorType: 'expired',
          suggestedActions: ['Request fresh content', 'Use alternative content source']
        };
      }
      
      if (storedContent.state !== 'active') {
        this.referenceStats.failedResolutions++;
        return {
          success: false,
          error: `Reference is ${storedContent.state}`,
          errorType: storedContent.state === 'expired' ? 'expired' : 'corrupted',
          suggestedActions: ['Request fresh content', 'Check reference validity']
        };
      }
      
      storedContent.metadata.lastAccessedAt = new Date();
      storedContent.metadata.accessCount++;
      
      this.referenceStats.totalResolutions++;
      
      const duration = Date.now() - startTime;
      this.recordPerformanceMetric('resolution', duration);
      
      return {
        success: true,
        content: storedContent.content,
        metadata: storedContent.metadata
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      this.recordPerformanceMetric('resolution', duration);
      
      this.referenceStats.failedResolutions++;
      
      return {
        success: false,
        error: `System error resolving reference: ${error instanceof Error ? error.message : 'Unknown error'}`,
        errorType: 'system_error',
        suggestedActions: ['Try again', 'Contact administrator']
      };
    }
  }

  /**
   * Check if a reference exists and is valid
   */
  async hasReference(referenceId: ReferenceId): Promise<boolean> {
    if (!ReferenceIdGenerator.isValidReferenceId(referenceId)) {
      return false;
    }
    
    const storedContent = this.contentStore.get(referenceId);
    if (!storedContent) {
      return false;
    }
    
    if (storedContent.expiresAt && storedContent.expiresAt < new Date()) {
      storedContent.state = 'expired';
      return false;
    }
    
    return storedContent.state === 'active';
  }

  /**
   * Mark a reference for cleanup
   */
  async cleanupReference(referenceId: ReferenceId): Promise<boolean> {
    const storedContent = this.contentStore.get(referenceId);
    if (!storedContent) {
      return false;
    }
    
    this.referenceStats.totalStorageBytes -= storedContent.content.length;
    this.referenceStats.activeReferences--;
    this.referenceStats.recentlyCleanedUp++;
    
    this.contentStore.delete(referenceId);
    
    return true;
  }

  /**
   * Get current reference storage statistics (implements ContentReferenceStore)
   */
  async getStats(): Promise<ContentReferenceStats> {
    this.updateReferenceStorageStats();
    
    return {
      ...this.referenceStats,
      performanceMetrics: {
        averageCreationTimeMs: this.calculateAverage(this.referenceStats.performanceMetrics.creationTimes),
        averageResolutionTimeMs: this.calculateAverage(this.referenceStats.performanceMetrics.resolutionTimes),
        averageCleanupTimeMs: this.calculateAverage(this.referenceStats.performanceMetrics.cleanupTimes)
      }
    };
  }

  /**
   * Update reference configuration
   */
  async updateConfig(config: Partial<ContentReferenceConfig>): Promise<void> {
    this.referenceConfig = { ...this.referenceConfig, ...config };
    
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      delete this.cleanupTimer;
    }
    
    if (this.referenceConfig.enableAutoCleanup) {
      this.startReferenceCleanupTimer();
    }
  }

  /**
   * Perform cleanup based on current policies (implements ContentReferenceStore)
   */
  async performCleanup(): Promise<{ cleanedUp: number; errors: string[] }> {
    const startTime = Date.now();
    const errors: string[] = [];
    let cleanedUp = 0;
    
    try {
      const now = new Date();
      const toCleanup: ReferenceId[] = [];
      
      for (const [referenceId, storedContent] of this.contentStore.entries()) {
        let shouldCleanup = false;
        
        if (storedContent.expiresAt && storedContent.expiresAt < now) {
          shouldCleanup = true;
          storedContent.state = 'expired';
        }
        
        const ageMs = now.getTime() - storedContent.metadata.createdAt.getTime();
        const policy = this.getCleanupPolicy(storedContent.metadata.source);
        
        if (ageMs > policy.maxAgeMs) {
          shouldCleanup = true;
        }
        
        if (storedContent.state === 'cleanup_pending') {
          shouldCleanup = true;
        }
        
        if (shouldCleanup) {
          toCleanup.push(referenceId);
        }
      }
      
      toCleanup.sort((a, b) => {
        const aContent = this.contentStore.get(a)!;
        const bContent = this.contentStore.get(b)!;
        const aPriority = this.getCleanupPolicy(aContent.metadata.source).priority;
        const bPriority = this.getCleanupPolicy(bContent.metadata.source).priority;
        return bPriority - aPriority;
      });
      
      for (const referenceId of toCleanup) {
        try {
          const success = await this.cleanupReference(referenceId);
          if (success) {
            cleanedUp++;
          }
        } catch (error) {
          errors.push(`Failed to cleanup ${referenceId}: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
      }
      
      if (this.contentStore.size > this.referenceConfig.maxReferences) {
        const sortedByAge = Array.from(this.contentStore.entries())
          .sort(([, a], [, b]) => a.metadata.lastAccessedAt.getTime() - b.metadata.lastAccessedAt.getTime());
        
        const excessCount = this.contentStore.size - this.referenceConfig.maxReferences;
        for (let i = 0; i < excessCount && i < sortedByAge.length; i++) {
          const [referenceId] = sortedByAge[i];
          try {
            const success = await this.cleanupReference(referenceId);
            if (success) {
              cleanedUp++;
            }
          } catch (error) {
            errors.push(`Failed to cleanup excess reference ${referenceId}: ${error instanceof Error ? error.message : 'Unknown error'}`);
          }
        }
      }
      
      const duration = Date.now() - startTime;
      this.recordPerformanceMetric('cleanup', duration);
      
      return { cleanedUp, errors };
    } catch (error) {
      const duration = Date.now() - startTime;
      this.recordPerformanceMetric('cleanup', duration);
      
      const errorMessage = `Cleanup process failed: ${error instanceof Error ? error.message : 'Unknown error'}`;
      errors.push(errorMessage);
      
      return { cleanedUp, errors };
    }
  }

  /**
   * Get reference configuration for debugging
   */
  getReferenceConfig(): ContentReferenceConfig {
    return { ...this.referenceConfig };
  }


  private async enforceReferenceStorageLimits(): Promise<void> {
    if (this.contentStore.size >= this.referenceConfig.maxReferences) {
      await this.performCleanup();
    }
    
    if (this.referenceStats.totalStorageBytes >= this.referenceConfig.maxTotalStorageBytes) {
      await this.performCleanup();
    }
  }

  private calculateExpirationTime(source: ContentSource): Date | undefined {
    const policy = this.getCleanupPolicy(source);
    return new Date(Date.now() + policy.maxAgeMs);
  }

  private getCleanupPolicy(source: ContentSource) {
    switch (source) {
      case 'mcp_tool':
        return this.referenceConfig.cleanupPolicies.recent;
      case 'user_upload':
        return this.referenceConfig.cleanupPolicies.userContent;
      case 'agent_generated':
        return this.referenceConfig.cleanupPolicies.agentGenerated;
      default:
        return this.referenceConfig.cleanupPolicies.default;
    }
  }

  private detectContentType(content: Buffer, mimeType?: string): ContentType {
    if (mimeType) {
      if (mimeType === 'text/html') return 'html';
      if (mimeType === 'text/markdown') return 'markdown';
      if (mimeType === 'application/json') return 'json';
      if (mimeType.startsWith('text/')) return 'text';
      return 'binary';
    }
    
    const contentStr = content.toString('utf8', 0, Math.min(content.length, 1000));
    if (contentStr.startsWith('{') || contentStr.startsWith('[')) return 'json';
    if (contentStr.includes('<html>') || contentStr.includes('<!DOCTYPE')) return 'html';
    if (contentStr.includes('#') && contentStr.includes('\n')) return 'markdown';
    
    return 'text';
  }

  private createContentPreview(content: Buffer, contentType: ContentType): string {
    const maxLength = 200;
    let preview = content.toString('utf8', 0, Math.min(content.length, maxLength * 2));
    
    if (contentType === 'html') {
      preview = preview
        .replace(/<[^>]*>/g, '')
        .replace(/\s+/g, ' ')
        .trim();
    } else if (contentType === 'json') {
      try {
        const parsed = JSON.parse(preview);
        preview = JSON.stringify(parsed, null, 0);
      } catch {
      }
    }
    
    preview = preview.trim();
    if (preview.length > maxLength) {
      preview = preview.substring(0, maxLength) + '...';
    }
    
    return preview || '[Binary content]';
  }

  private updateStatsAfterStore(sizeBytes: number): void {
    this.referenceStats.activeReferences++;
    this.referenceStats.totalStorageBytes += sizeBytes;
    this.updateReferenceStorageStats();
  }

  private updateReferenceStorageStats(): void {
    if (this.referenceStats.activeReferences > 0) {
      this.referenceStats.averageContentSize = this.referenceStats.totalStorageBytes / this.referenceStats.activeReferences;
    }
    
    this.referenceStats.storageUtilization = (this.referenceStats.totalStorageBytes / this.referenceConfig.maxTotalStorageBytes) * 100;
    
    let mostAccessedId: ReferenceId | undefined;
    let maxAccess = 0;
    
    for (const [referenceId, storedContent] of this.contentStore.entries()) {
      if (storedContent.metadata.accessCount > maxAccess) {
        maxAccess = storedContent.metadata.accessCount;
        mostAccessedId = referenceId;
      }
    }
    
    if (mostAccessedId !== undefined) {
      this.referenceStats.mostAccessedReferenceId = mostAccessedId;
    } else {
      delete this.referenceStats.mostAccessedReferenceId;
    }
  }

  private recordPerformanceMetric(type: 'creation' | 'resolution' | 'cleanup', timeMs: number): void {
    const metrics = this.referenceStats.performanceMetrics;
    const maxRecords = 100;
    
    switch (type) {
      case 'creation':
        metrics.creationTimes.push(timeMs);
        if (metrics.creationTimes.length > maxRecords) {
          metrics.creationTimes.shift();
        }
        break;
      case 'resolution':
        metrics.resolutionTimes.push(timeMs);
        if (metrics.resolutionTimes.length > maxRecords) {
          metrics.resolutionTimes.shift();
        }
        break;
      case 'cleanup':
        metrics.cleanupTimes.push(timeMs);
        if (metrics.cleanupTimes.length > maxRecords) {
          metrics.cleanupTimes.shift();
        }
        break;
    }
  }

  private calculateAverage(times: number[]): number {
    if (times.length === 0) return 0;
    return times.reduce((sum, time) => sum + time, 0) / times.length;
  }

  private startReferenceCleanupTimer(): void {
    this.cleanupTimer = setInterval(async () => {
      try {
        await this.performCleanup();
      } catch (error) {
      }
    }, this.referenceConfig.cleanupIntervalMs);
  }

  /**
   * Clean up resources (enhanced to include reference cleanup)
   */
  async dispose(): Promise<void> {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      delete this.cleanupTimer;
    }
    
    this.contentStore.clear();
    
    this.clear();
  }
}