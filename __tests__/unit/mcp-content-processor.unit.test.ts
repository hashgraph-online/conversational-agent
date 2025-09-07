import { MCPContentProcessor, ProcessedResponse } from '../../src/mcp/content-processor';
import { Logger } from '@hashgraphonline/standards-sdk';
import type { ContentStorage } from '../../src/memory/content-storage';

describe('MCPContentProcessor', () => {
  let processor: MCPContentProcessor;
  let mockLogger: jest.Mocked<Logger>;
  let mockContentStorage: jest.Mocked<ContentStorage>;

  beforeEach(() => {
    mockLogger = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
    } as any;

    mockContentStorage = {
      shouldUseReference: jest.fn(),
      storeContentIfLarge: jest.fn(),
    } as any;

    processor = new MCPContentProcessor(mockContentStorage, mockLogger);
  });

  describe('constructor', () => {
    it('should create processor with content storage and logger', () => {
      expect(processor).toBeInstanceOf(MCPContentProcessor);
    });
  });

  describe('analyzeResponse', () => {
    it('should analyze text content response', () => {
      const response = {
        content: [
          {
            type: 'text',
            text: 'This is a long text content that should be processed because it exceeds the minimum threshold for content processing and analysis',
          },
        ],
      };

      mockContentStorage.shouldUseReference.mockReturnValue(true);

      const analysis = processor.analyzeResponse(response);

      expect(analysis.contents).toHaveLength(1);
      expect(analysis.contents[0].type).toBe('text');
      expect(analysis.contents[0].sizeBytes).toBeGreaterThan(0);
      expect(analysis.contents[0].mimeType).toBe('text/plain');
      expect(analysis.shouldProcess).toBe(true);
      expect(analysis.totalSize).toBeGreaterThan(0);
    });

    it('should analyze image content response', () => {
      const response = {
        content: [
          {
            type: 'image',
            data: 'base64encodeddata',
            mimeType: 'image/png',
          },
        ],
      };

      mockContentStorage.shouldUseReference.mockReturnValue(true);

      const analysis = processor.analyzeResponse(response);

      expect(analysis.contents).toHaveLength(1);
      expect(analysis.contents[0].type).toBe('image');
      expect(analysis.contents[0].mimeType).toBe('image/png');
      expect(analysis.contents[0].sizeBytes).toBeGreaterThan(0);
    });

    it('should analyze resource content response', () => {
      const response = {
        content: [
          {
            type: 'resource',
            resource: {
              uri: 'file://test.txt',
              name: 'test',
              mimeType: 'text/plain',
            },
          },
        ],
      };

      mockContentStorage.shouldUseReference.mockReturnValue(true);

      const analysis = processor.analyzeResponse(response);

      expect(analysis.contents).toHaveLength(1);
      expect(analysis.contents[0].type).toBe('resource');
      expect(analysis.contents[0].mimeType).toBe('application/json');
    });

    it('should analyze large string content', () => {
      const largeString = 'a'.repeat(2000);
      mockContentStorage.shouldUseReference.mockReturnValue(true);

      const analysis = processor.analyzeResponse(largeString);

      expect(analysis.contents).toHaveLength(1);
      expect(analysis.contents[0].type).toBe('text');
      expect(analysis.contents[0].sizeBytes).toBe(2000);
    });

    it('should skip small strings', () => {
      const smallString = 'small';
      const analysis = processor.analyzeResponse(smallString);

      expect(analysis.contents).toHaveLength(0);
      expect(analysis.shouldProcess).toBe(false);
    });

    it('should handle array responses', () => {
      const response = [
        {
          type: 'text',
          text: 'First text content that is long enough to be processed',
        },
        {
          type: 'text',
          text: 'Second text content that is also long enough to be processed',
        },
      ];

      mockContentStorage.shouldUseReference.mockReturnValue(true);

      const analysis = processor.analyzeResponse(response);

      expect(analysis.contents).toHaveLength(2);
      expect(analysis.totalSize).toBeGreaterThan(0);
      expect(analysis.largestContentSize).toBeGreaterThan(0);
    });

    it('should handle null and undefined responses', () => {
      expect(processor.analyzeResponse(null)).toEqual({
        shouldProcess: false,
        contents: [],
        totalSize: 0,
        largestContentSize: 0,
      });

      expect(processor.analyzeResponse(undefined)).toEqual({
        shouldProcess: false,
        contents: [],
        totalSize: 0,
        largestContentSize: 0,
      });
    });
  });

  describe('processResponse', () => {
    beforeEach(() => {
      mockContentStorage.shouldUseReference.mockReturnValue(false);
    });

    it('should return unprocessed response when no processing needed', async () => {
      const response = { simple: 'response' };

      const result = await processor.processResponse(response, 'server', 'tool');

      expect(result).toEqual({
        content: response,
        wasProcessed: false,
      });
    });

    it('should process response with content references', async () => {
      const response = {
        content: [
          {
            type: 'text',
            text: 'Long text content that needs to be processed and stored as a reference',
          },
        ],
      };

      mockContentStorage.shouldUseReference.mockReturnValue(true);
      mockContentStorage.storeContentIfLarge.mockResolvedValue({
        referenceId: 'ref-123',
        preview: 'Long text content...',
        metadata: {
          sizeBytes: 100,
          contentType: 'text',
        },
      });

      const result = await processor.processResponse(response, 'test-server', 'test-tool');

      expect(result.wasProcessed).toBe(true);
      expect(result.referenceCreated).toBe(true);
      expect(result.originalSize).toBeGreaterThan(0);

      expect(mockContentStorage.storeContentIfLarge).toHaveBeenCalledWith(
        expect.any(Buffer),
        expect.objectContaining({
          contentType: 'text',
          source: 'mcp_tool',
          mcpToolName: 'test-server::test-tool',
          tags: ['mcp_response', 'test-server', 'test-tool'],
        })
      );
    });

    it('should handle processing errors gracefully', async () => {
      const response = {
        content: [
          {
            type: 'text',
            text: 'Content that will cause an error during processing',
          },
        ],
      };

      mockContentStorage.shouldUseReference.mockReturnValue(true);
      mockContentStorage.storeContentIfLarge.mockRejectedValue(new Error('Storage failed'));

      const result = await processor.processResponse(response, 'server', 'tool');

      expect(result.wasProcessed).toBe(true);
      expect(result.referenceCreated).toBe(false);
      expect(result.errors).toContain('Failed to create reference: Storage failed');
    });

    it('should handle processing exceptions', async () => {
      const response = {
        content: [
          {
            type: 'text',
            text: 'Content for error testing',
          },
        ],
      };

      jest.spyOn(processor, 'analyzeResponse').mockImplementation(() => {
        throw new Error('Analysis failed');
      });

      const result = await processor.processResponse(response, 'server', 'tool');

      expect(result.wasProcessed).toBe(false);
      expect(result.content).toBe(response);
      expect(result.errors).toContain('Analysis failed');
      expect(mockLogger.error).toHaveBeenCalledWith('Error processing MCP response:', expect.any(Error));
    });

    it('should handle multiple content items with mixed processing results', async () => {
      const response = {
        content: [
          {
            type: 'text',
            text: 'First content item for processing',
          },
          {
            type: 'text',
            text: 'Second content item for processing',
          },
        ],
      };

      mockContentStorage.shouldUseReference.mockReturnValue(true);
      mockContentStorage.storeContentIfLarge
        .mockResolvedValueOnce({
          referenceId: 'ref-1',
          preview: 'First content...',
          metadata: { sizeBytes: 50, contentType: 'text' },
        })
        .mockResolvedValueOnce(null);

      const result = await processor.processResponse(response, 'server', 'tool');

      expect(result.wasProcessed).toBe(true);
      expect(result.referenceCreated).toBe(true);
      expect(mockContentStorage.storeContentIfLarge).toHaveBeenCalledTimes(2);
    });
  });

  describe('mime type detection', () => {
    it('should detect JSON mime type', () => {
      const jsonResponse = { type: 'text', text: '{"key": "value"}' };
      mockContentStorage.shouldUseReference.mockReturnValue(false);

      const analysis = processor.analyzeResponse(jsonResponse);
      expect(analysis.contents[0]?.mimeType).toBe('application/json');
    });

    it('should detect HTML mime type', () => {
      const htmlResponse = { type: 'text', text: '<html><body>Content</body></html>' };
      mockContentStorage.shouldUseReference.mockReturnValue(false);

      const analysis = processor.analyzeResponse(htmlResponse);
      expect(analysis.contents[0]?.mimeType).toBe('text/html');
    });

    it('should detect markdown mime type', () => {
      const markdownResponse = { type: 'text', text: '# Heading\n## Subheading' };
      mockContentStorage.shouldUseReference.mockReturnValue(false);

      const analysis = processor.analyzeResponse(markdownResponse);
      expect(analysis.contents[0]?.mimeType).toBe('text/markdown');
    });

    it('should default to plain text', () => {
      const plainTextResponse = { type: 'text', text: 'Just plain text content here' };
      mockContentStorage.shouldUseReference.mockReturnValue(false);

      const analysis = processor.analyzeResponse(plainTextResponse);
      expect(analysis.contents[0]?.mimeType).toBe('text/plain');
    });
  });

  describe('content type mapping', () => {
    it('should map mime types to content types correctly', async () => {
      const testCases = [
        { mimeType: 'text/plain', expectedType: 'text' },
        { mimeType: 'application/json', expectedType: 'json' },
        { mimeType: 'text/html', expectedType: 'html' },
        { mimeType: 'text/markdown', expectedType: 'markdown' },
        { mimeType: 'text/css', expectedType: 'text' },
        { mimeType: 'application/pdf', expectedType: 'binary' },
      ];

      for (const testCase of testCases) {
        const response = {
          content: [
            {
              type: 'text',
              text: 'Test content for mime type mapping',
            },
          ],
        };

        jest.spyOn(processor as any, 'detectMimeType').mockReturnValue(testCase.mimeType);
        
        mockContentStorage.shouldUseReference.mockReturnValue(true);
        mockContentStorage.storeContentIfLarge.mockResolvedValue({
          referenceId: 'ref-test',
          preview: 'Test...',
          metadata: { sizeBytes: 100, contentType: testCase.expectedType },
        });

        await processor.processResponse(response, 'server', 'tool');

        expect(mockContentStorage.storeContentIfLarge).toHaveBeenCalledWith(
          expect.any(Buffer),
          expect.objectContaining({
            contentType: testCase.expectedType,
            mimeType: testCase.mimeType,
          })
        );

        jest.restoreAllMocks();
        mockContentStorage.storeContentIfLarge.mockClear();
      }
    });
  });

  describe('deep cloning', () => {
    it('should handle deep cloning of complex objects', () => {
      const complexObject = {
        simple: 'value',
        nested: {
          array: [1, 2, { deep: 'value' }],
          date: new Date('2023-01-01'),
        },
        nullValue: null,
        undefinedValue: undefined,
      };

      const cloned = processor['deepClone'](complexObject);

      expect(cloned).toEqual(complexObject);
      expect(cloned).not.toBe(complexObject);
      expect(cloned.nested).not.toBe(complexObject.nested);
      expect(cloned.nested.array).not.toBe(complexObject.nested.array);
      expect(cloned.nested.date).not.toBe(complexObject.nested.date);
      expect(cloned.nested.date).toBeInstanceOf(Date);
    });

    it('should handle primitive values', () => {
      expect(processor['deepClone']('string')).toBe('string');
      expect(processor['deepClone'](42)).toBe(42);
      expect(processor['deepClone'](true)).toBe(true);
      expect(processor['deepClone'](null)).toBe(null);
      expect(processor['deepClone'](undefined)).toBe(undefined);
    });

    it('should handle arrays', () => {
      const array = [1, 'two', { three: 3 }];
      const cloned = processor['deepClone'](array);

      expect(cloned).toEqual(array);
      expect(cloned).not.toBe(array);
      expect(cloned[2]).not.toBe(array[2]);
    });
  });

  describe('content replacement', () => {
    it('should replace content in nested objects', async () => {
      const response = {
        content: [
          {
            type: 'text',
            text: 'Original content to be replaced',
          },
        ],
        metadata: {
          source: 'test',
        },
      };

      mockContentStorage.shouldUseReference.mockReturnValue(true);
      mockContentStorage.storeContentIfLarge.mockResolvedValue({
        referenceId: 'ref-replace',
        preview: 'Original content...',
        metadata: { sizeBytes: 100, contentType: 'text' },
      });

      const result = await processor.processResponse(response, 'server', 'tool');

      expect(result.wasProcessed).toBe(true);
      expect(result.content).not.toEqual(response);
      
      const processedContent = result.content as any;
      expect(processedContent.content[0].type).toBe('content_reference');
      expect(processedContent.content[0].referenceId).toBe('ref-replace');
      expect(processedContent.metadata.source).toBe('test');
    });
  });
});