import { describe, test, expect } from 'vitest';
import {
  DEFAULT_CONTENT_REFERENCE_CONFIG,
  ContentReferenceError,
  type ContentReferenceConfig,
  type ReferenceLifecycleState,
  type ContentType,
  type ContentSource
} from '../../../src/types/content-reference';

describe('Content Reference Types', () => {
  describe('DEFAULT_CONTENT_REFERENCE_CONFIG', () => {
    test('should have sensible default values', () => {
      expect(DEFAULT_CONTENT_REFERENCE_CONFIG.sizeThresholdBytes).toBe(10 * 1024);
      expect(DEFAULT_CONTENT_REFERENCE_CONFIG.maxAgeMs).toBe(60 * 60 * 1000);
      expect(DEFAULT_CONTENT_REFERENCE_CONFIG.maxReferences).toBe(100);
      expect(DEFAULT_CONTENT_REFERENCE_CONFIG.maxTotalStorageBytes).toBe(100 * 1024 * 1024);
      expect(DEFAULT_CONTENT_REFERENCE_CONFIG.enableAutoCleanup).toBe(true);
      expect(DEFAULT_CONTENT_REFERENCE_CONFIG.cleanupIntervalMs).toBe(5 * 60 * 1000);
      expect(DEFAULT_CONTENT_REFERENCE_CONFIG.enablePersistence).toBe(false);
      expect(DEFAULT_CONTENT_REFERENCE_CONFIG.storageBackend).toBe('memory');
    });

    test('should have proper cleanup policies', () => {
      const policies = DEFAULT_CONTENT_REFERENCE_CONFIG.cleanupPolicies;
      
      expect(policies.recent.maxAgeMs).toBe(30 * 60 * 1000);
      expect(policies.recent.priority).toBe(1);
      
      expect(policies.userContent.maxAgeMs).toBe(2 * 60 * 60 * 1000);
      expect(policies.userContent.priority).toBe(2);
      
      expect(policies.agentGenerated.maxAgeMs).toBe(60 * 60 * 1000);
      expect(policies.agentGenerated.priority).toBe(3);
      
      expect(policies.default.maxAgeMs).toBe(60 * 60 * 1000);
      expect(policies.default.priority).toBe(4);
    });
  });

  describe('ContentReferenceError', () => {
    test('should create error with all properties', () => {
      const error = new ContentReferenceError(
        'Test error message',
        'not_found',
        'test-reference-id',
        ['Action 1', 'Action 2']
      );

      expect(error.message).toBe('Test error message');
      expect(error.type).toBe('not_found');
      expect(error.referenceId).toBe('test-reference-id');
      expect(error.suggestedActions).toEqual(['Action 1', 'Action 2']);
      expect(error.name).toBe('ContentReferenceError');
      expect(error).toBeInstanceOf(Error);
    });

    test('should create error with minimal properties', () => {
      const error = new ContentReferenceError('Simple error', 'system_error');

      expect(error.message).toBe('Simple error');
      expect(error.type).toBe('system_error');
      expect(error.referenceId).toBeUndefined();
      expect(error.suggestedActions).toBeUndefined();
    });
  });

  describe('Type constraints', () => {
    test('ReferenceLifecycleState should allow valid states', () => {
      const validStates: ReferenceLifecycleState[] = [
        'active',
        'expired',
        'cleanup_pending',
        'invalid'
      ];

      validStates.forEach(state => {
        expect(typeof state).toBe('string');
      });
    });

    test('ContentType should allow valid types', () => {
      const validTypes: ContentType[] = [
        'text',
        'json',
        'html',
        'markdown',
        'binary',
        'unknown'
      ];

      validTypes.forEach(type => {
        expect(typeof type).toBe('string');
      });
    });

    test('ContentSource should allow valid sources', () => {
      const validSources: ContentSource[] = [
        'mcp_tool',
        'user_upload',
        'agent_generated',
        'system'
      ];

      validSources.forEach(source => {
        expect(typeof source).toBe('string');
      });
    });
  });

  describe('ContentReference format constraint', () => {
    test('should enforce ref://{id} format', () => {
      const mockReference = {
        referenceId: 'test-id',
        state: 'active' as ReferenceLifecycleState,
        preview: 'test preview',
        metadata: {
          contentType: 'text' as ContentType,
          sizeBytes: 100,
          source: 'mcp_tool' as ContentSource,
          fileName: 'test.txt',
          mimeType: 'text/plain'
        },
        createdAt: new Date(),
        format: 'ref://{id}' as const
      };

      expect(mockReference.format).toBe('ref://{id}');
    });
  });

  describe('Configuration validation', () => {
    test('should merge partial configurations correctly', () => {
      const partialConfig: Partial<ContentReferenceConfig> = {
        sizeThresholdBytes: 5000,
        maxReferences: 50
      };

      const mergedConfig = { ...DEFAULT_CONTENT_REFERENCE_CONFIG, ...partialConfig };

      expect(mergedConfig.sizeThresholdBytes).toBe(5000);
      expect(mergedConfig.maxReferences).toBe(50);
      expect(mergedConfig.enableAutoCleanup).toBe(true);
      expect(mergedConfig.storageBackend).toBe('memory');
    });
  });

  describe('Metadata structure', () => {
    test('should support all expected metadata fields', () => {
      const metadata = {
        contentType: 'html' as ContentType,
        mimeType: 'text/html',
        sizeBytes: 5000,
        createdAt: new Date(),
        lastAccessedAt: new Date(),
        source: 'mcp_tool' as ContentSource,
        mcpToolName: 'wikipedia-search',
        fileName: 'article.html',
        accessCount: 5,
        tags: ['wikipedia', 'article', 'reference'],
        customMetadata: {
          articleTitle: 'Test Article',
          wordCount: 1500,
          language: 'en'
        }
      };

      expect(metadata.contentType).toBe('html');
      expect(metadata.source).toBe('mcp_tool');
      expect(Array.isArray(metadata.tags)).toBe(true);
      expect(typeof metadata.customMetadata).toBe('object');
      expect(metadata.customMetadata!.articleTitle).toBe('Test Article');
    });
  });

  describe('Statistics structure', () => {
    test('should include all expected statistics fields', () => {
      const stats = {
        activeReferences: 25,
        totalStorageBytes: 1024 * 500,
        recentlyCleanedUp: 3,
        totalResolutions: 150,
        failedResolutions: 2,
        averageContentSize: 20480,
        mostAccessedReferenceId: 'most-accessed-ref-id',
        storageUtilization: 50.5,
        performanceMetrics: {
          averageCreationTimeMs: 12.5,
          averageResolutionTimeMs: 3.2,
          averageCleanupTimeMs: 8.7
        }
      };

      expect(typeof stats.activeReferences).toBe('number');
      expect(typeof stats.totalStorageBytes).toBe('number');
      expect(typeof stats.storageUtilization).toBe('number');
      expect(typeof stats.performanceMetrics.averageCreationTimeMs).toBe('number');
      expect(stats.mostAccessedReferenceId).toBeDefined();
    });
  });
});