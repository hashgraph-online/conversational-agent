import { ContentStorage } from '../memory/content-storage';
import {
  ContentStoreService,
  extractReferenceId,
  shouldUseReference,
  ContentResolverRegistry,
  type ContentStoreInterface,
  type ContentResolverInterface,
  type ReferenceResolutionResult,
} from '@hashgraphonline/standards-sdk';
import type {
  ContentReference,
  ContentReferenceConfig,
  ContentReferenceStats,
} from '../types/content-reference';
import { Logger } from '@hashgraphonline/standards-sdk';

/**
 * Content metadata interface for adapter compatibility
 */
interface AdapterContentMetadata {
  mimeType?: string;
  fileName?: string;
  sizeBytes?: number;
  [key: string]: unknown;
}

/**
 * Configuration interface for content storage
 */
interface ContentStoreConfig {
  maxSize?: number;
  enableCompression?: boolean;
  [key: string]: unknown;
}

/**
 * Adapter to make ContentStorage compatible with ContentStoreInterface
 */
class ContentStorageAdapter implements ContentStoreInterface {
  constructor(private storage: ContentStorage) {}

  async storeContent(
    content: Buffer,
    metadata: AdapterContentMetadata
  ): Promise<string> {
    const storeMetadata = {
      contentType: 'binary' as const,
      sizeBytes: content.length,
      source: 'system' as const,
      ...metadata,
    };
    const contentRef = await this.storage.storeContent(content, storeMetadata);
    return contentRef.referenceId;
  }

  async resolveReference(
    referenceId: string
  ): Promise<ReferenceResolutionResult> {
    const result = await this.storage.resolveReference(referenceId);
    if (result.success && result.content) {
      const response: ReferenceResolutionResult = {
        content: result.content,
      };
      if (result.metadata) {
        response.metadata = {
          ...(result.metadata.mimeType !== undefined && {
            mimeType: result.metadata.mimeType,
          }),
          ...(result.metadata.fileName !== undefined && {
            fileName: result.metadata.fileName,
          }),
          originalSize: result.metadata.sizeBytes,
        };
      }
      return response;
    } else {
      throw new Error(result.error || 'Reference not found');
    }
  }

  async hasReference(referenceId: string): Promise<boolean> {
    return await this.storage.hasReference(referenceId);
  }

  async cleanupReference(referenceId: string): Promise<void> {
    await this.storage.cleanupReference(referenceId);
  }

  async getStats(): Promise<unknown> {
    return await this.storage.getStats();
  }

  async updateConfig(config: ContentStoreConfig): Promise<void> {
    const referenceConfig = {
      sizeThresholdBytes: config.maxSize || 10240,
      enableAutoCleanup: config.enableCompression || true,
      ...config,
    };
    return await this.storage.updateConfig(referenceConfig);
  }

  async performCleanup(): Promise<void> {
    await this.storage.performCleanup();
  }

  async dispose(): Promise<void> {
    return Promise.resolve(this.storage.dispose());
  }
}

/**
 * Content resolver implementation for dependency injection
 */
class ContentResolver implements ContentResolverInterface {
  constructor(private adapter: ContentStorageAdapter) {}

  async resolveReference(
    referenceId: string
  ): Promise<ReferenceResolutionResult> {
    return await this.adapter.resolveReference(referenceId);
  }

  shouldUseReference(content: string | Buffer): boolean {
    return shouldUseReference(content);
  }

  extractReferenceId(input: string): string | null {
    return extractReferenceId(input);
  }
}

/**
 * Manages content store lifecycle and cross-package registration
 */
export class ContentStoreManager {
  private contentStorage: ContentStorage;
  private adapter: ContentStorageAdapter;
  private resolver: ContentResolver;
  private logger: Logger;
  private isRegistered = false;

  constructor(
    maxMessageStorage: number = 1000,
    referenceConfig?: Partial<ContentReferenceConfig>,
    logger?: Logger
  ) {
    this.logger = logger || new Logger({ module: 'ContentStoreManager' });

    this.contentStorage = new ContentStorage(
      maxMessageStorage,
      referenceConfig
    );
    this.adapter = new ContentStorageAdapter(this.contentStorage);
    this.resolver = new ContentResolver(this.adapter);
  }

  /**
   * Initialize and register content storage for cross-package access
   */
  async initialize(): Promise<void> {
    if (this.isRegistered) {
      this.logger.warn('ContentStoreManager is already initialized');
      return;
    }

    try {
      await ContentStoreService.setInstance(this.adapter);
      ContentResolverRegistry.register(this.resolver);
      this.isRegistered = true;
      this.logger.info(
        'ContentStoreManager initialized and registered for cross-package access'
      );
    } catch (error) {
      this.logger.error('Failed to initialize ContentStoreManager:', error);
      throw error;
    }
  }

  /**
   * Get the underlying ContentStorage instance
   */
  getContentStorage(): ContentStorage {
    return this.contentStorage;
  }

  /**
   * Get storage statistics
   */
  async getStats(): Promise<ContentReferenceStats> {
    return await this.contentStorage.getStats();
  }

  /**
   * Update configuration
   */
  async updateConfig(config: Partial<ContentReferenceConfig>): Promise<void> {
    return await this.contentStorage.updateConfig(config);
  }

  /**
   * Perform manual cleanup
   */
  async performCleanup(): Promise<{ cleanedUp: number; errors: string[] }> {
    return await this.contentStorage.performCleanup();
  }

  /**
   * Check if content should be stored as reference
   */
  shouldUseReference(content: Buffer | string): boolean {
    return this.contentStorage.shouldUseReference(content);
  }

  /**
   * Store content if it's large enough
   */
  async storeContentIfLarge(
    content: Buffer | string,
    metadata: AdapterContentMetadata
  ): Promise<ContentReference | null> {
    const storeMetadata = {
      source: 'system' as const,
      contentType: 'binary' as const,
      ...metadata,
    };
    return await this.contentStorage.storeContentIfLarge(
      content,
      storeMetadata
    );
  }

  /**
   * Cleanup and unregister
   */
  async dispose(): Promise<void> {
    if (this.isRegistered) {
      this.contentStorage.dispose();
      ContentStoreService.dispose();
      ContentResolverRegistry.unregister();
      this.isRegistered = false;
      this.logger.info('ContentStoreManager disposed and unregistered');
    }
  }

  /**
   * Check if the manager is initialized
   */
  isInitialized(): boolean {
    return this.isRegistered;
  }
}
