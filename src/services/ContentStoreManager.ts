import { ContentStorage } from '../memory/ContentStorage';
import { 
  ContentStoreService, 
  extractReferenceId, 
  shouldUseReference,
  ContentResolverRegistry,
  type ContentStoreInterface, 
  type ContentResolverInterface, 
  type ReferenceResolutionResult 
} from '@hashgraphonline/standards-sdk';
import type { ContentReferenceConfig } from '../types/content-reference';
import { Logger } from '@hashgraphonline/standards-sdk';

/**
 * Adapter to make ContentStorage compatible with ContentStoreInterface
 */
class ContentStorageAdapter implements ContentStoreInterface {
  constructor(private storage: ContentStorage) {}

  async storeContent(content: Buffer, metadata: any) {
    const contentRef = await this.storage.storeContent(content, metadata);
    return contentRef.referenceId;
  }

  async resolveReference(referenceId: string): Promise<ReferenceResolutionResult> {
    const result = await this.storage.resolveReference(referenceId);
    // Convert to match the interface from standards-sdk
    if (result.success && result.content) {
      const response: ReferenceResolutionResult = {
        content: result.content
      };
      if (result.metadata) {
        response.metadata = {
          ...(result.metadata.mimeType !== undefined && { mimeType: result.metadata.mimeType }),
          ...(result.metadata.fileName !== undefined && { fileName: result.metadata.fileName }),
          originalSize: result.metadata.sizeBytes
        };
      }
      return response;
    } else {
      // If resolution fails, throw an error as the interface expects content to be present
      throw new Error(result.error || 'Reference not found');
    }
  }

  async hasReference(referenceId: string) {
    return await this.storage.hasReference(referenceId);
  }

  async cleanupReference(referenceId: string) {
    await this.storage.cleanupReference(referenceId);
  }

  async getStats() {
    return await this.storage.getStats();
  }

  async updateConfig(config: any) {
    return await this.storage.updateConfig(config);
  }

  async performCleanup() {
    await this.storage.performCleanup();
  }

  async dispose() {
    return Promise.resolve(this.storage.dispose());
  }
}

/**
 * Content resolver implementation for dependency injection
 */
class ContentResolver implements ContentResolverInterface {
  constructor(private adapter: ContentStorageAdapter) {}

  async resolveReference(referenceId: string): Promise<ReferenceResolutionResult> {
    // The adapter already handles the conversion
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
    this.logger = logger || {
      info: console.log,
      debug: console.log,
      warn: console.warn,
      error: console.error
    } as Logger;

    this.contentStorage = new ContentStorage(maxMessageStorage, referenceConfig);
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
      this.logger.info('ContentStoreManager initialized and registered for cross-package access');
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
  async getStats() {
    return await this.contentStorage.getStats();
  }

  /**
   * Update configuration
   */
  async updateConfig(config: Partial<ContentReferenceConfig>) {
    return await this.contentStorage.updateConfig(config);
  }

  /**
   * Perform manual cleanup
   */
  async performCleanup() {
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
  async storeContentIfLarge(content: Buffer | string, metadata: any) {
    return await this.contentStorage.storeContentIfLarge(content, metadata);
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