import { AttachmentProcessor, type AttachmentData, type ContentStoreManager } from '../../src/services/attachment-processor';

jest.mock('@hashgraphonline/standards-sdk', () => ({
  Logger: jest.fn().mockImplementation(() => ({
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn()
  }))
}));

describe('AttachmentProcessor', () => {
  let attachmentProcessor: AttachmentProcessor;
  let mockContentStoreManager: jest.Mocked<ContentStoreManager>;

  const mockAttachments: AttachmentData[] = [
    {
      name: 'test-image.png',
      data: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
      type: 'image/png',
      size: 1024
    },
    {
      name: 'test-document.pdf',
      data: 'data:application/pdf;base64,JVBERi0xLjQKMSAwIG9iago8PC9UeXBlIC9DYXRhbG9nIC9QYWdlcyAyIDAgUj4',
      type: 'application/pdf',
      size: 2048
    },
    {
      name: 'large-file.zip',
      data: 'data:application/zip;base64,' + 'A'.repeat(100000),
      type: 'application/zip',
      size: 100000
    }
  ];

  beforeEach(() => {
    jest.clearAllMocks();

    mockContentStoreManager = {
      isInitialized: jest.fn().mockReturnValue(true),
      storeContentIfLarge: jest.fn()
    } as unknown as jest.Mocked<ContentStoreManager>;

    attachmentProcessor = new AttachmentProcessor();
  });

  describe('processAttachments', () => {
    test('should return original content when no attachments', async () => {
      const content = 'Hello world';
      const result = await attachmentProcessor.processAttachments(content, []);

      expect(result).toBe(content);
    });

    test('should process attachments with content store manager', async () => {
      const content = 'Hello world';

      (mockContentStoreManager.storeContentIfLarge as jest.Mock).mockResolvedValue({
        referenceId: 'ref-123'
      });

      const result = await attachmentProcessor.processAttachments(
        content,
        [mockAttachments[0]],
        mockContentStoreManager
      );

      expect(result).toContain('Hello world');
      expect(result).toContain('Attached files:');
      expect(result).toContain('[Image File: test-image.png] (content-ref:ref-123)');
    });

    test('should process attachments without content store manager', async () => {
      const content = 'Hello world';

      const result = await attachmentProcessor.processAttachments(
        content,
        [mockAttachments[0]]
      );

      expect(result).toContain('Hello world');
      expect(result).toContain('Attached files:');
      expect(result).toContain('📎 Image: test-image.png (1.0KB, image/png)');
    });

    test('should handle mixed attachment types', async () => {
      const content = 'Processing files';

      (mockContentStoreManager.storeContentIfLarge as jest.Mock).mockResolvedValue(null);

      const result = await attachmentProcessor.processAttachments(
        content,
        [mockAttachments[0], mockAttachments[1]],
        mockContentStoreManager
      );

      expect(result).toContain('Processing files');
      expect(result).toContain('📎 test-image.png (1.0KB)');
      expect(result).toContain('📎 test-document.pdf (2.0KB)');
      expect(result).toContain('![test-image.png]');
      expect(result).toContain('[File: test-document.pdf (2.0KB)]');
    });

    test('should handle large files with content store', async () => {
      const content = 'Large file test';
      (mockContentStoreManager.storeContentIfLarge as jest.Mock).mockResolvedValue({ referenceId: 'large-ref-123' });

      const result = await attachmentProcessor.processAttachments(
        content,
        [mockAttachments[2]],
        mockContentStoreManager
      );

      expect(result).toContain('Large file test');
      expect(result).toContain('[File: large-file.zip] (content-ref:large-ref-123)');
    });

    test('should handle processing errors gracefully', async () => {
      const content = 'Error test';
      (mockContentStoreManager.storeContentIfLarge as jest.Mock).mockRejectedValue(new Error('Storage failed'));

      const result = await attachmentProcessor.processAttachments(
        content,
        [mockAttachments[0]],
        mockContentStoreManager
      );

      expect(result).toContain('Error test');
      expect(result).toContain('[File: test-image.png - Error processing file: Storage failed]');
    });

    test('should handle empty content', async () => {
      const result = await attachmentProcessor.processAttachments(
        '',
        [mockAttachments[0]],
        mockContentStoreManager
      );

      expect(result).toContain('Attached files:');
      expect(result).toContain('📎 test-image.png (1.0KB)');
    });

    test('should handle base64 data without data URI prefix', async () => {
      const attachmentWithoutPrefix: AttachmentData = {
        name: 'test.txt',
        data: 'SGVsbG8gV29ybGQ=',
        type: 'text/plain',
        size: 11
      };

      (mockContentStoreManager.storeContentIfLarge as jest.Mock).mockResolvedValue(null);

      const result = await attachmentProcessor.processAttachments(
        'Test',
        [attachmentWithoutPrefix],
        mockContentStoreManager
      );

      expect(result).toContain('Test');
      expect(result).toContain('[File: test.txt (0.0KB)]');
    });

    test('should handle invalid base64 data', async () => {
      const invalidAttachment: AttachmentData = {
        name: 'invalid.txt',
        data: 'invalid-base64!',
        type: 'text/plain',
        size: 10
      };

      (mockContentStoreManager.storeContentIfLarge as jest.Mock).mockResolvedValue(null);

      const result = await attachmentProcessor.processAttachments(
        'Test',
        [invalidAttachment],
        mockContentStoreManager
      );

      expect(result).toContain('Test');
      expect(result).toContain('[File: invalid.txt (0.0KB)]');
    });
  });

  describe('formatFileSize', () => {
    test('should format bytes correctly', () => {
      expect((attachmentProcessor as any).formatFileSize(512)).toBe('0.5KB');
      expect((attachmentProcessor as any).formatFileSize(1024)).toBe('1.0KB');
      expect((attachmentProcessor as any).formatFileSize(1536)).toBe('1.5KB');
    });

    test('should format kilobytes correctly', () => {
      expect((attachmentProcessor as any).formatFileSize(1024 * 100)).toBe('100.0KB');
      expect((attachmentProcessor as any).formatFileSize(1024 * 500)).toBe('500.0KB');
    });

    test('should format megabytes correctly', () => {
      expect((attachmentProcessor as any).formatFileSize(1024 * 1024)).toBe('1.0MB');
      expect((attachmentProcessor as any).formatFileSize(1024 * 1024 * 2)).toBe('2.0MB');
      expect((attachmentProcessor as any).formatFileSize(1024 * 1024 * 1.5)).toBe('1.5MB');
    });

    test('should handle edge cases', () => {
      expect((attachmentProcessor as any).formatFileSize(0)).toBe('0.0KB');
      expect((attachmentProcessor as any).formatFileSize(1024 * 1024 - 1)).toBe('1024.0KB');
      expect((attachmentProcessor as any).formatFileSize(1024 * 1024 + 1)).toBe('1.0MB');
    });
  });

  describe('createFileList', () => {
    test('should create file list correctly', () => {
      const fileList = (attachmentProcessor as any).createFileList(mockAttachments);

      expect(fileList).toContain('📎 test-image.png (1.0KB)');
      expect(fileList).toContain('📎 test-document.pdf (2.0KB)');
      expect(fileList).toContain('📎 large-file.zip (97.7KB)');
      expect(fileList.split('\n')).toHaveLength(3);
    });

    test('should handle empty attachment list', () => {
      const fileList = (attachmentProcessor as any).createFileList([]);
      expect(fileList).toBe('');
    });

    test('should handle single attachment', () => {
      const fileList = (attachmentProcessor as any).createFileList([mockAttachments[0]]);
      expect(fileList).toBe('📎 test-image.png (1.0KB)');
    });
  });
});
