import { describe, test, expect, jest, beforeEach } from '@jest/globals';
import { ContentStoreManager } from '../../../src/services/content-store-manager';
import { ContentStorage } from '../../../src/memory/content-storage';
import { Logger } from '@hashgraphonline/standards-sdk';

/**
 * Mock ContentStorage for testing
 */
const mockStoreContentIfLarge = jest.fn();
const mockShouldUseReference = jest.fn();
const mockGetStats = jest.fn();
const mockUpdateConfig = jest.fn();
const mockPerformCleanup = jest.fn();
const mockDispose = jest.fn();

jest.mock('../../../src/memory/content-storage', () => ({
  ContentStorage: jest.fn().mockImplementation(() => ({
    storeContent: jest.fn(),
    resolveReference: jest.fn(),
    hasReference: jest.fn(),
    cleanupReference: jest.fn(),
    getStats: mockGetStats,
    updateConfig: mockUpdateConfig,
    performCleanup: mockPerformCleanup,
    dispose: mockDispose,
    shouldUseReference: mockShouldUseReference,
    storeContentIfLarge: mockStoreContentIfLarge,
  })),
}));

jest.mock('@hashgraphonline/standards-sdk', () => ({
  Logger: jest.fn().mockImplementation(() => ({
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  })),
      ContentStoreService: {
      setInstance: jest.fn().mockResolvedValue(undefined),
      dispose: jest.fn().mockResolvedValue(undefined),
    },
    ContentResolverRegistry: {
      register: jest.fn().mockResolvedValue(undefined),
      unregister: jest.fn().mockResolvedValue(undefined),
    },
  extractReferenceId: jest.fn(),
  shouldUseReference: jest.fn(),
}));

describe('ContentStoreManager', () => {
  let contentStoreManager: ContentStoreManager;
  let mockContentStorage: jest.Mocked<ContentStorage>;
  let mockLogger: jest.Mocked<Logger>;

  beforeEach(() => {
    jest.clearAllMocks();

    mockLogger = new Logger({ module: 'ContentStoreManager' }) as jest.Mocked<Logger>;

    contentStoreManager = new ContentStoreManager(
      1000,
      {
        sizeThresholdBytes: 10240,
        enableAutoCleanup: true,
      },
      mockLogger
    );
  });

  describe('Constructor', () => {
    test('should create ContentStoreManager with valid config', () => {
      const manager = new ContentStoreManager(
        1000,
        {
          sizeThresholdBytes: 10240,
          enableAutoCleanup: true,
        }
      );

      expect(manager).toBeDefined();
    });

    test('should create ContentStoreManager with minimal config', () => {
      const manager = new ContentStoreManager();

      expect(manager).toBeDefined();
    });

    test('should create ContentStoreManager with undefined config', () => {
      const manager = new ContentStoreManager(undefined, undefined, undefined);

      expect(manager).toBeDefined();
    });
  });

  describe('State Checking', () => {
    test('should return false when not initialized', () => {
      const result = contentStoreManager.isInitialized();

      expect(result).toBe(false);
    });
  });

  describe('Content Storage Access', () => {
    test('should return content storage instance', () => {
      const result = contentStoreManager.getContentStorage();

      expect(result).toBeDefined();
      expect(typeof result).toBe('object');
    });
  });

  describe('Reference Checking', () => {
    test('should check if content should use reference', () => {
      const largeContent = Buffer.from('x'.repeat(20000));
      const result = contentStoreManager.shouldUseReference(largeContent);

      expect(typeof result).toBe('boolean');
    });

    test('should handle string content', () => {
      const stringContent = 'test string';
      const result = contentStoreManager.shouldUseReference(stringContent);

      expect(typeof result).toBe('boolean');
    });

    test('should handle buffer content', () => {
      const bufferContent = Buffer.from('test buffer');
      const result = contentStoreManager.shouldUseReference(bufferContent);

      expect(typeof result).toBe('boolean');
    });
  });

  describe('Initialization', () => {
    test('should initialize successfully', async () => {
      const { ContentStoreService, ContentResolverRegistry } = require('@hashgraphonline/standards-sdk');

      await contentStoreManager.initialize();

      expect(ContentStoreService.setInstance).toHaveBeenCalled();
      expect(ContentResolverRegistry.register).toHaveBeenCalled();
      expect(mockLogger.info).toHaveBeenCalledWith(
        'ContentStoreManager initialized and registered for cross-package access'
      );
      expect(contentStoreManager.isInitialized()).toBe(true);
    });

    test('should handle initialization errors', async () => {
      const { ContentStoreService } = require('@hashgraphonline/standards-sdk');
      const error = new Error('Initialization failed');
      ContentStoreService.setInstance.mockRejectedValue(error);

      await expect(contentStoreManager.initialize()).rejects.toThrow('Initialization failed');
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Failed to initialize ContentStoreManager:',
        error
      );
    });

    test('should warn when already initialized', async () => {
      await contentStoreManager.initialize();
      await contentStoreManager.initialize();

      expect(mockLogger.warn).toHaveBeenCalledWith('ContentStoreManager is already initialized');
    });
  });

  describe('Storage Operations', () => {
    test('should get stats successfully', async () => {
      const mockStats = { totalReferences: 10, totalSize: 1024 };
      mockGetStats.mockResolvedValue(mockStats);

      const stats = await contentStoreManager.getStats();

      expect(mockGetStats).toHaveBeenCalled();
      expect(stats).toEqual(mockStats);
    });

    test('should update config successfully', async () => {
      const config = { sizeThresholdBytes: 5000 };
      mockUpdateConfig.mockResolvedValue(undefined);

      await contentStoreManager.updateConfig(config);

      expect(mockUpdateConfig).toHaveBeenCalledWith(config);
    });

    test('should perform cleanup successfully', async () => {
      const cleanupResult = { cleanedUp: 5, errors: [] };
      mockPerformCleanup.mockResolvedValue(cleanupResult);

      const result = await contentStoreManager.performCleanup();

      expect(mockPerformCleanup).toHaveBeenCalled();
      expect(result).toEqual(cleanupResult);
    });

    test('should store content if large', async () => {
      const content = Buffer.from('test content');
      const metadata = { mimeType: 'text/plain', fileName: 'test.txt' };
      const mockReference = { referenceId: 'ref123', sizeBytes: 1024 };
      mockStoreContentIfLarge.mockResolvedValue(mockReference);

      const result = await contentStoreManager.storeContentIfLarge(content, metadata);

      expect(mockStoreContentIfLarge).toHaveBeenCalledWith(content, {
        source: 'system',
        contentType: 'binary',
        ...metadata,
      });
      expect(result).toEqual(mockReference);
    });

    test('should store content if large with string content', async () => {
      const content = 'test string content';
      const metadata = { mimeType: 'text/plain' };
      const mockReference = { referenceId: 'ref456', sizeBytes: 512 };
      mockStoreContentIfLarge.mockResolvedValue(mockReference);

      const result = await contentStoreManager.storeContentIfLarge(content, metadata);

      expect(mockStoreContentIfLarge).toHaveBeenCalledWith(content, {
        source: 'system',
        contentType: 'binary',
        ...metadata,
      });
      expect(result).toEqual(mockReference);
    });
  });

  describe('Disposal', () => {
    test('should dispose when initialized', async () => {
      const { ContentStoreService, ContentResolverRegistry } = require('@hashgraphonline/standards-sdk');

      await contentStoreManager.initialize();
      await contentStoreManager.dispose();

      expect(mockDispose).toHaveBeenCalled();
      expect(ContentStoreService.dispose).toHaveBeenCalled();
      expect(ContentResolverRegistry.unregister).toHaveBeenCalled();
      expect(mockLogger.info).toHaveBeenCalledWith('ContentStoreManager disposed and unregistered');
      expect(contentStoreManager.isInitialized()).toBe(false);
    });

    test('should not dispose when not initialized', async () => {
      const { ContentStoreService, ContentResolverRegistry } = require('@hashgraphonline/standards-sdk');

      await contentStoreManager.dispose();

      expect(mockDispose).not.toHaveBeenCalled();
      expect(ContentStoreService.dispose).not.toHaveBeenCalled();
      expect(ContentResolverRegistry.unregister).not.toHaveBeenCalled();
    });
  });

  describe('Error Handling', () => {
    test('should handle storage operation errors', async () => {
      const error = new Error('Storage operation failed');
      mockGetStats.mockRejectedValue(error);

      await expect(contentStoreManager.getStats()).rejects.toThrow('Storage operation failed');
    });

    test('should handle cleanup errors', async () => {
      const error = new Error('Cleanup failed');
      mockPerformCleanup.mockRejectedValue(error);

      await expect(contentStoreManager.performCleanup()).rejects.toThrow('Cleanup failed');
    });

    test('should handle config update errors', async () => {
      const error = new Error('Config update failed');
      mockUpdateConfig.mockRejectedValue(error);

      await expect(contentStoreManager.updateConfig({})).rejects.toThrow('Config update failed');
    });
  });

  describe('Adapter Integration', () => {
    test('should create adapter with correct configuration', async () => {
      await contentStoreManager.initialize();

      const { ContentStoreService } = require('@hashgraphonline/standards-sdk');
      expect(ContentStoreService.setInstance).toHaveBeenCalledWith(
        expect.objectContaining({
          storeContent: expect.any(Function),
          resolveReference: expect.any(Function),
          hasReference: expect.any(Function),
          cleanupReference: expect.any(Function),
          getStats: expect.any(Function),
          updateConfig: expect.any(Function),
          performCleanup: expect.any(Function),
          dispose: expect.any(Function),
        })
      );
    });
  });
});
