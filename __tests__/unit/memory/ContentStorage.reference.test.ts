import { describe, test, expect, beforeEach, afterEach } from 'vitest';
import { ContentStorage } from '../../../src/memory/ContentStorage';
import { ReferenceIdGenerator } from '../../../src/memory/ReferenceIdGenerator';
import type { ContentReferenceConfig } from '../../../src/types/content-reference';

describe('ContentStorage - Reference-Based Storage', () => {
  let storage: ContentStorage;
  let testConfig: Partial<ContentReferenceConfig>;

  beforeEach(() => {
    testConfig = {
      sizeThresholdBytes: 100,
      maxAgeMs: 1000,
      maxReferences: 10,
      maxTotalStorageBytes: 1024 * 1024,
      enableAutoCleanup: false,
      cleanupIntervalMs: 100,
      enablePersistence: false,
      storageBackend: 'memory',
      cleanupPolicies: {
        recent: { maxAgeMs: 1000, priority: 1 },
        userContent: { maxAgeMs: 1000, priority: 2 },
        agentGenerated: { maxAgeMs: 1000, priority: 3 },
        default: { maxAgeMs: 1000, priority: 4 }
      }
    };
    
    storage = new ContentStorage(1000, testConfig);
  });

  afterEach(async () => {
    if (storage) {
      await storage.dispose();
    }
  });

  describe('shouldUseReference', () => {
    test('should return true for content above threshold', () => {
      const largeContent = 'x'.repeat(200);
      expect(storage.shouldUseReference(largeContent)).toBe(true);
    });

    test('should return false for content below threshold', () => {
      const smallContent = 'small content';
      expect(storage.shouldUseReference(smallContent)).toBe(false);
    });

    test('should work with Buffer input', () => {
      const largeBuffer = Buffer.from('x'.repeat(200));
      const smallBuffer = Buffer.from('small');
      
      expect(storage.shouldUseReference(largeBuffer)).toBe(true);
      expect(storage.shouldUseReference(smallBuffer)).toBe(false);
    });
  });

  describe('storeContentIfLarge', () => {
    test('should store large content and return reference', async () => {
      const largeContent = 'x'.repeat(200);
      const metadata = {
        source: 'mcp_tool' as const,
        mcpToolName: 'test-tool',
        fileName: 'test.txt'
      };

      const reference = await storage.storeContentIfLarge(largeContent, metadata);
      
      expect(reference).not.toBeNull();
      expect(reference!.referenceId).toBeDefined();
      expect(reference!.state).toBe('active');
      expect(reference!.metadata.sizeBytes).toBe(200);
      expect(reference!.metadata.source).toBe('mcp_tool');
      expect(reference!.preview).toContain('xxx');
      expect(reference!.format).toBe('ref://{id}');
    });

    test('should return null for small content', async () => {
      const smallContent = 'small';
      const metadata = {
        source: 'user_upload' as const,
        fileName: 'small.txt'
      };

      const reference = await storage.storeContentIfLarge(smallContent, metadata);
      
      expect(reference).toBeNull();
    });

    test('should detect content type from MIME type', async () => {
      const htmlContent = '<html><body>test</body></html>'.repeat(10);
      const metadata = {
        source: 'mcp_tool' as const,
        mimeType: 'text/html',
        fileName: 'test.html'
      };

      const reference = await storage.storeContentIfLarge(htmlContent, metadata);
      
      expect(reference).not.toBeNull();
      expect(reference!.metadata.contentType).toBe('html');
    });
  });

  describe('storeContent', () => {
    test('should store content and return valid reference', async () => {
      const content = Buffer.from('test content for storage');
      const metadata = {
        contentType: 'text' as const,
        mimeType: 'text/plain',
        sizeBytes: content.length,
        source: 'user_upload' as const,
        fileName: 'test.txt',
        tags: ['test', 'content']
      };

      const reference = await storage.storeContent(content, metadata);
      
      expect(reference.referenceId).toBeDefined();
      expect(ReferenceIdGenerator.isValidReferenceId(reference.referenceId)).toBe(true);
      expect(reference.state).toBe('active');
      expect(reference.metadata.sizeBytes).toBe(content.length);
      expect(reference.metadata.contentType).toBe('text');
      expect(reference.createdAt).toBeInstanceOf(Date);
    });

    test('should update statistics after storing', async () => {
      const content = Buffer.from('test content');
      const metadata = {
        contentType: 'text' as const,
        sizeBytes: content.length,
        source: 'mcp_tool' as const
      };

      await storage.storeContent(content, metadata);
      
      const stats = await storage.getStats();
      expect(stats.activeReferences).toBe(1);
      expect(stats.totalStorageBytes).toBe(content.length);
    });
  });

  describe('resolveReference', () => {
    test('should resolve valid reference to content', async () => {
      const originalContent = Buffer.from('test content for resolution');
      const metadata = {
        contentType: 'text' as const,
        sizeBytes: originalContent.length,
        source: 'mcp_tool' as const,
        fileName: 'test.txt'
      };

      const reference = await storage.storeContent(originalContent, metadata);
      const result = await storage.resolveReference(reference.referenceId);
      
      expect(result.success).toBe(true);
      expect(result.content).toEqual(originalContent);
      expect(result.metadata!.contentType).toBe('text');
      expect(result.metadata!.fileName).toBe('test.txt');
      expect(result.metadata!.accessCount).toBe(1);
    });

    test('should return error for non-existent reference', async () => {
      const fakeId = ReferenceIdGenerator.generateTestId('fake-id');
      const result = await storage.resolveReference(fakeId);
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('Reference not found');
      expect(result.errorType).toBe('not_found');
      expect(result.suggestedActions).toContain('Verify the reference ID');
    });

    test('should return error for invalid reference ID format', async () => {
      const result = await storage.resolveReference('invalid-id');
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid reference ID format');
      expect(result.errorType).toBe('not_found');
    });

    test('should update access tracking on successful resolution', async () => {
      const content = Buffer.from('test content');
      const metadata = {
        contentType: 'text' as const,
        sizeBytes: content.length,
        source: 'mcp_tool' as const
      };

      const reference = await storage.storeContent(content, metadata);
      
      await storage.resolveReference(reference.referenceId);
      await storage.resolveReference(reference.referenceId);
      const result = await storage.resolveReference(reference.referenceId);
      
      expect(result.metadata!.accessCount).toBe(3);
      expect(result.metadata!.lastAccessedAt).toBeInstanceOf(Date);
    });
  });

  describe('hasReference', () => {
    test('should return true for existing valid reference', async () => {
      const content = Buffer.from('test content');
      const metadata = {
        contentType: 'text' as const,
        sizeBytes: content.length,
        source: 'mcp_tool' as const
      };

      const reference = await storage.storeContent(content, metadata);
      const exists = await storage.hasReference(reference.referenceId);
      
      expect(exists).toBe(true);
    });

    test('should return false for non-existent reference', async () => {
      const fakeId = ReferenceIdGenerator.generateTestId('fake-id');
      const exists = await storage.hasReference(fakeId);
      
      expect(exists).toBe(false);
    });

    test('should return false for invalid reference format', async () => {
      const exists = await storage.hasReference('invalid-format');
      
      expect(exists).toBe(false);
    });
  });

  describe('cleanupReference', () => {
    test('should cleanup existing reference', async () => {
      const content = Buffer.from('test content');
      const metadata = {
        contentType: 'text' as const,
        sizeBytes: content.length,
        source: 'mcp_tool' as const
      };

      const reference = await storage.storeContent(content, metadata);
      const cleaned = await storage.cleanupReference(reference.referenceId);
      
      expect(cleaned).toBe(true);
      
      const exists = await storage.hasReference(reference.referenceId);
      expect(exists).toBe(false);
    });

    test('should return false for non-existent reference', async () => {
      const fakeId = ReferenceIdGenerator.generateTestId('fake-id');
      const cleaned = await storage.cleanupReference(fakeId);
      
      expect(cleaned).toBe(false);
    });

    test('should update statistics after cleanup', async () => {
      const content = Buffer.from('test content');
      const metadata = {
        contentType: 'text' as const,
        sizeBytes: content.length,
        source: 'mcp_tool' as const
      };

      const reference = await storage.storeContent(content, metadata);
      await storage.cleanupReference(reference.referenceId);
      
      const stats = await storage.getStats();
      expect(stats.activeReferences).toBe(0);
      expect(stats.totalStorageBytes).toBe(0);
      expect(stats.recentlyCleanedUp).toBe(1);
    });
  });

  describe('performCleanup', () => {
    test('should cleanup expired references', async () => {
      const content = Buffer.from('test content');
      const metadata = {
        contentType: 'text' as const,
        sizeBytes: content.length,
        source: 'mcp_tool' as const
      };

      const reference = await storage.storeContent(content, metadata);
      
      await new Promise(resolve => setTimeout(resolve, 1100));
      
      const result = await storage.performCleanup();
      
      expect(result.cleanedUp).toBe(1);
      expect(result.errors).toHaveLength(0);
      
      const exists = await storage.hasReference(reference.referenceId);
      expect(exists).toBe(false);
    });

    test('should cleanup based on storage limits', async () => {
      const testStorageConfig = {
        ...testConfig,
        maxReferences: 2
      };
      
      const limitedStorage = new ContentStorage(1000, testStorageConfig);
      
      try {
        const content1 = Buffer.from('content 1');
        const content2 = Buffer.from('content 2');
        const content3 = Buffer.from('content 3');
        
        const metadata = {
          contentType: 'text' as const,
          sizeBytes: 0,
          source: 'mcp_tool' as const
        };
        
        await limitedStorage.storeContent(content1, { ...metadata, sizeBytes: content1.length });
        await limitedStorage.storeContent(content2, { ...metadata, sizeBytes: content2.length });
        
        await limitedStorage.storeContent(content3, { ...metadata, sizeBytes: content3.length });
        
        await limitedStorage.performCleanup();
        
        const stats = await limitedStorage.getStats();
        expect(stats.activeReferences).toBeLessThanOrEqual(2);
      } finally {
        await limitedStorage.dispose();
      }
    });
  });

  describe('updateConfig', () => {
    test('should update configuration', async () => {
      const newConfig = {
        sizeThresholdBytes: 500,
        maxReferences: 50
      };

      await storage.updateConfig(newConfig);
      
      const config = storage.getReferenceConfig();
      expect(config.sizeThresholdBytes).toBe(500);
      expect(config.maxReferences).toBe(50);
    });
  });

  describe('getStats', () => {
    test('should return comprehensive statistics', async () => {
      const content1 = Buffer.from('first content');
      const content2 = Buffer.from('second content for testing');
      
      const metadata1 = {
        contentType: 'text' as const,
        sizeBytes: content1.length,
        source: 'mcp_tool' as const
      };
      
      const metadata2 = {
        contentType: 'json' as const,
        sizeBytes: content2.length,
        source: 'user_upload' as const
      };

      const ref1 = await storage.storeContent(content1, metadata1);
      const ref2 = await storage.storeContent(content2, metadata2);
      
      await storage.resolveReference(ref1.referenceId);
      await storage.resolveReference(ref1.referenceId);
      
      const stats = await storage.getStats();
      
      expect(stats.activeReferences).toBe(2);
      expect(stats.totalStorageBytes).toBe(content1.length + content2.length);
      expect(stats.totalResolutions).toBe(2);
      expect(stats.averageContentSize).toBe((content1.length + content2.length) / 2);
      expect(stats.mostAccessedReferenceId).toBe(ref1.referenceId);
      expect(stats.performanceMetrics.averageCreationTimeMs).toBeGreaterThanOrEqual(0);
      expect(stats.performanceMetrics.averageResolutionTimeMs).toBeGreaterThanOrEqual(0);
    });
  });

  describe('integration with message storage', () => {
    test('should maintain backward compatibility with message storage', () => {
      const messages = [
        { content: 'test message 1', _getType: () => 'human' } as any,
        { content: 'test message 2', _getType: () => 'ai' } as any
      ];

      const result = storage.storeMessages(messages);
      
      expect(result.stored).toBe(2);
      expect(result.dropped).toBe(0);
      expect(storage.getTotalStoredMessages()).toBe(2);
      
      const recent = storage.getRecentMessages(1);
      expect(recent).toHaveLength(1);
      expect(recent[0].content).toBe('test message 2');
    });
  });

  describe('content type detection', () => {
    test('should detect JSON content', async () => {
      const jsonContent = JSON.stringify({ test: 'data', array: [1, 2, 3] }).repeat(10);
      const reference = await storage.storeContentIfLarge(jsonContent, {
        source: 'mcp_tool',
        fileName: 'test.json'
      });

      expect(reference).not.toBeNull();
      expect(reference!.metadata.contentType).toBe('json');
    });

    test('should detect HTML content', async () => {
      const htmlContent = '<html><head><title>Test</title></head><body>Content</body></html>'.repeat(5);
      const reference = await storage.storeContentIfLarge(htmlContent, {
        source: 'mcp_tool',
        fileName: 'test.html'
      });

      expect(reference).not.toBeNull();
      expect(reference!.metadata.contentType).toBe('html');
    });

    test('should detect markdown content', async () => {
      const markdownContent = ('# Title\n\nThis is **bold** text.\n').repeat(10);
      const reference = await storage.storeContentIfLarge(markdownContent, {
        source: 'mcp_tool',
        fileName: 'test.md'
      });

      expect(reference).not.toBeNull();
      expect(reference!.metadata.contentType).toBe('markdown');
    });
  });

  describe('content preview generation', () => {
    test('should generate appropriate previews for different content types', async () => {
      const htmlContent = '<html><body><h1>Title</h1><p>This is a test paragraph with <strong>bold</strong> text.</p></body></html>'.repeat(2);
      const reference = await storage.storeContentIfLarge(htmlContent, {
        source: 'mcp_tool',
        mimeType: 'text/html',
        fileName: 'test.html'
      });

      expect(reference).not.toBeNull();
      expect(reference!.preview).not.toContain('<html>');
      expect(reference!.preview).not.toContain('<body>');
      expect(reference!.preview).toContain('Title');
      expect(reference!.preview).toContain('test paragraph');
    });

    test('should truncate long previews', async () => {
      const longContent = 'x'.repeat(500);
      const reference = await storage.storeContentIfLarge(longContent, {
        source: 'mcp_tool',
        fileName: 'long.txt'
      });

      expect(reference!.preview.length).toBeLessThanOrEqual(203);
      expect(reference!.preview).toContain('...');
    });
  });
});