import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { MCPContentProcessor } from '../../../src/mcp/content-processor';
import { ContentStorage } from '../../../src/memory/content-storage';
import { Logger } from '@hashgraphonline/standards-sdk';

const TEST_SERVER_NAME = 'test-server';

describe('MCPContentProcessor', () => {
  let processor: MCPContentProcessor;
  let contentStorage: ContentStorage;
  let logger: Logger;

  beforeEach(() => {
    contentStorage = new ContentStorage(1000, {
      sizeThresholdBytes: 1000,
      enableAutoCleanup: false,
    });
    logger = {
      info: jest.fn(),
      debug: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    } as jest.Mocked<Logger>;
    processor = new MCPContentProcessor(contentStorage, logger);
  });

  afterEach(() => {
    contentStorage.dispose();
  });

  describe('analyzeResponse', () => {
    it('should detect small content that does not need processing', () => {
      const response = {
        content: [{ type: 'text', text: 'Small content' }],
      };

      const analysis = processor.analyzeResponse(response);
      expect(analysis.shouldProcess).toBe(false);
      expect(analysis.contents).toHaveLength(1);
      expect(analysis.totalSize).toBeLessThan(1000);
    });

    it('should detect large content that needs processing', () => {
      const largeText = 'x'.repeat(2000);
      const response = {
        content: [{ type: 'text', text: largeText }],
      };

      const analysis = processor.analyzeResponse(response);
      expect(analysis.shouldProcess).toBe(true);
      expect(analysis.contents).toHaveLength(1);
      expect(analysis.totalSize).toBeGreaterThan(1000);
    });

    it('should handle multiple content types in single response', () => {
      const largeText = 'x'.repeat(1500);
      const smallText = 'small';
      const response = {
        content: [
          { type: 'text', text: largeText },
          { type: 'text', text: smallText },
        ],
      };

      const analysis = processor.analyzeResponse(response);
      expect(analysis.shouldProcess).toBe(true);
      expect(analysis.contents).toHaveLength(2);
    });

    it('should handle image content', () => {
      const largeImageData = 'base64data'.repeat(200);
      const response = {
        content: [
          { type: 'image', data: largeImageData, mimeType: 'image/jpeg' },
        ],
      };

      const analysis = processor.analyzeResponse(response);
      expect(analysis.contents).toHaveLength(1);
      expect(analysis.contents[0].type).toBe('image');
      expect(analysis.contents[0].mimeType).toBe('image/jpeg');
    });

    it('should handle resource content', () => {
      const largeResource = {
        data: 'x'.repeat(1500),
        metadata: { type: 'document' },
      };
      const response = {
        content: [{ type: 'resource', resource: largeResource }],
      };

      const analysis = processor.analyzeResponse(response);
      expect(analysis.contents).toHaveLength(1);
      expect(analysis.contents[0].type).toBe('resource');
      expect(analysis.contents[0].mimeType).toBe('application/json');
    });
  });

  describe('processResponse', () => {
    it('should return original response for small content', async () => {
      const response = {
        content: [{ type: 'text', text: 'Small content' }],
      };

      const result = await processor.processResponse(
        response,
        TEST_SERVER_NAME,
        'test-tool'
      );

      expect(result.wasProcessed).toBe(false);
      expect(result.content).toEqual(response);
      expect(result.referenceCreated).toBeUndefined();
    });

    it('should create references for large content', async () => {
      const largeText = 'x'.repeat(2000);
      const response = {
        content: [{ type: 'text', text: largeText }],
      };

      const result = await processor.processResponse(
        response,
        TEST_SERVER_NAME,
        'test-tool'
      );

      expect(result.wasProcessed).toBe(true);
      expect(result.referenceCreated).toBe(true);
      expect(result.originalSize).toBe(largeText.length);
      expect(result.content).not.toEqual(response);

      const processedResponse = result.content as { content: Array<{ type: string; referenceId?: string; preview?: string; _isReference?: boolean; }> };
      expect(processedResponse.content[0].type).toBe('content_reference');
      expect(processedResponse.content[0].referenceId).toBeDefined();
      expect(processedResponse.content[0].preview).toBeDefined();
      expect(processedResponse.content[0]._isReference).toBe(true);
    });

    it('should handle mixed content correctly', async () => {
      const largeText = 'x'.repeat(2000);
      const smallText = 'small';
      const response = {
        content: [
          { type: 'text', text: largeText },
          { type: 'text', text: smallText },
        ],
      };

      const result = await processor.processResponse(
        response,
        TEST_SERVER_NAME,
        'test-tool'
      );

      expect(result.wasProcessed).toBe(true);
      expect(result.referenceCreated).toBe(true);

      const processedResponse = result.content as { content: Array<{ type: string; referenceId?: string; preview?: string; _isReference?: boolean; text?: string; }> };
      expect(processedResponse.content[0].type).toBe('content_reference');
      expect(processedResponse.content[1]).toEqual({
        type: 'text',
        text: smallText,
      });
    });

    it('should include metadata in reference creation', async () => {
      const largeText = JSON.stringify({ data: 'x'.repeat(2000) });
      const response = {
        content: [{ type: 'text', text: largeText }],
      };

      const result = await processor.processResponse(
        response,
        'wiki-server',
        'get-article'
      );

      expect(result.wasProcessed).toBe(true);

      const stats = await contentStorage.getStats();
      expect(stats.activeReferences).toBe(1);

      const references = Array.from(
        (contentStorage as { contentStore: Map<string, unknown> }).contentStore.entries()
      );
      const [, storedContent] = references[0];
      expect(storedContent.metadata.source).toBe('mcp_tool');
      expect(storedContent.metadata.mcpToolName).toBe(
        'wiki-server::get-article'
      );
      expect(storedContent.metadata.tags).toContain('mcp_response');
      expect(storedContent.metadata.tags).toContain('wiki-server');
      expect(storedContent.metadata.tags).toContain('get-article');
    });

    it('should handle processing errors gracefully', async () => {
      const largeText = 'x'.repeat(2000);
      const response = {
        content: [{ type: 'text', text: largeText }],
      };

      jest.spyOn(contentStorage, 'storeContentIfLarge').mockRejectedValue(
        new Error('Storage failed')
      );

      const result = await processor.processResponse(
        response,
        TEST_SERVER_NAME,
        'test-tool'
      );

      expect(result.wasProcessed).toBe(true);
      expect(result.errors).toHaveLength(1);
      expect(result.errors![0]).toContain('Failed to create reference');
      expect(result.content).toEqual(response);
    });
  });

  describe('MIME type detection', () => {
    it('should detect JSON content', () => {
      const response = {
        content: [{ type: 'text', text: '{"key": "value"}' }],
      };

      const analysis = processor.analyzeResponse(response);
      expect(analysis.contents[0].mimeType).toBe('application/json');
    });

    it('should detect HTML content', () => {
      const response = {
        content: [
          {
            type: 'text',
            text: '<!DOCTYPE html><html><body>content</body></html>',
          },
        ],
      };

      const analysis = processor.analyzeResponse(response);
      expect(analysis.contents[0].mimeType).toBe('text/html');
    });

    it('should detect Markdown content', () => {
      const response = {
        content: [
          { type: 'text', text: '# Header\n\nSome content with markdown.' },
        ],
      };

      const analysis = processor.analyzeResponse(response);
      expect(analysis.contents[0].mimeType).toBe('text/markdown');
    });

    it('should default to plain text', () => {
      const response = {
        content: [{ type: 'text', text: 'Just plain text content' }],
      };

      const analysis = processor.analyzeResponse(response);
      expect(analysis.contents[0].mimeType).toBe('text/plain');
    });
  });

  describe('performance requirements', () => {
    it('should process response within 50ms latency target', async () => {
      const largeText = 'x'.repeat(5000);
      const response = {
        content: [{ type: 'text', text: largeText }],
      };

      const startTime = Date.now();
      await processor.processResponse(response, 'test-server', 'test-tool');
      const duration = Date.now() - startTime;

      expect(duration).toBeLessThan(50);
    });
  });
});
