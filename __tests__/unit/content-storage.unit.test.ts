import { ContentStorage } from '../../src/memory/content-storage';
import { Logger } from '@hashgraphonline/standards-sdk';
import fs from 'fs/promises';
import path from 'path';

jest.mock('@hashgraphonline/standards-sdk');
jest.mock('fs/promises');
jest.mock('path');

const mockLogger = Logger as jest.MockedClass<typeof Logger>;
const mockFs = fs as jest.Mocked<typeof fs>;
const mockPath = path as jest.Mocked<typeof path>;

describe('ContentStorage', () => {
  let storage: ContentStorage;
  let mockLoggerInstance: any;

  beforeEach(() => {
    jest.clearAllMocks();

    mockLoggerInstance = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
    };

    mockLogger.mockImplementation(() => mockLoggerInstance);

    storage = new ContentStorage();
  });

  describe('constructor', () => {
    it('should create ContentStorage instance', () => {
      expect(storage).toBeInstanceOf(ContentStorage);
    });

    it('should initialize logger', () => {
      expect(mockLogger).toHaveBeenCalledWith({ module: 'ContentStorage' });
    });
  });

  describe('storeContent', () => {
    it('should store content successfully', async () => {
      const content = Buffer.from('test content');
      const metadata = {
        contentType: 'text' as const,
        sizeBytes: content.length,
        source: 'user_upload' as const,
      };

      mockFs.writeFile.mockResolvedValue(undefined);
      mockPath.join.mockReturnValue('/storage/path');

      const reference = await storage.storeContent(content, metadata);

      expect(typeof reference.referenceId).toBe('string');
      expect(reference.referenceId.length).toBeGreaterThan(0);
      expect(mockFs.writeFile).toHaveBeenCalled();
    });

    it('should handle storage errors', async () => {
      const content = Buffer.from('test content');
      const metadata = {
        contentType: 'text' as const,
        sizeBytes: content.length,
        source: 'user_upload' as const,
      };
      const error = new Error('Storage failed');

      mockFs.writeFile.mockRejectedValue(error);

      await expect(storage.storeContent(content, metadata)).rejects.toThrow('Storage failed');
      expect(mockLoggerInstance.error).toHaveBeenCalled();
    });
  });

  describe('resolveReference', () => {
    it('should resolve reference successfully', async () => {
      const referenceId = 'test-id';
      const expectedContent = Buffer.from('retrieved content');

      mockFs.readFile.mockResolvedValue(expectedContent);
      mockPath.join.mockReturnValue('/storage/path');

      const result = await storage.resolveReference(referenceId);

      expect(result.success).toBe(true);
      expect(result.content).toEqual(expectedContent);
      expect(mockFs.readFile).toHaveBeenCalled();
    });

    it('should handle resolution errors', async () => {
      const referenceId = 'nonexistent-id';
      const error = new Error('File not found');

      mockFs.readFile.mockRejectedValue(error);

      const result = await storage.resolveReference(referenceId);

      expect(result.success).toBe(false);
      expect(mockLoggerInstance.error).toHaveBeenCalled();
    });
  });

  describe('hasReference', () => {
    it('should check if reference exists', async () => {
      const referenceId = 'test-id';

      mockFs.access.mockResolvedValue(undefined);
      mockPath.join.mockReturnValue('/storage/path');

      const exists = await storage.hasReference(referenceId);

      expect(exists).toBe(true);
      expect(mockFs.access).toHaveBeenCalled();
    });

    it('should return false for non-existent reference', async () => {
      const referenceId = 'nonexistent-id';

      mockFs.access.mockRejectedValue(new Error('File not found'));

      const exists = await storage.hasReference(referenceId);

      expect(exists).toBe(false);
    });
  });

  describe('cleanupReference', () => {
    it('should cleanup reference successfully', async () => {
      const referenceId = 'test-id';

      mockFs.unlink.mockResolvedValue(undefined);
      mockPath.join.mockReturnValue('/storage/path');

      const result = await storage.cleanupReference(referenceId);

      expect(result).toBe(true);
      expect(mockFs.unlink).toHaveBeenCalled();
    });

    it('should handle cleanup errors', async () => {
      const referenceId = 'test-id';
      const error = new Error('Deletion failed');

      mockFs.unlink.mockRejectedValue(error);

      const result = await storage.cleanupReference(referenceId);

      expect(result).toBe(false);
      expect(mockLoggerInstance.error).toHaveBeenCalled();
    });
  });

  describe('clear', () => {
    it('should clear all content', async () => {
      const mockFiles = ['file1.txt', 'file2.txt'];

      mockFs.readdir.mockResolvedValue(mockFiles as any);
      mockFs.unlink.mockResolvedValue(undefined);

      await storage.clear();

      expect(mockFs.readdir).toHaveBeenCalled();
      expect(mockFs.unlink).toHaveBeenCalledTimes(mockFiles.length);
    });

    it('should handle clear errors', async () => {
      const error = new Error('Clear failed');

      mockFs.readdir.mockRejectedValue(error);

      await expect(storage.clear()).rejects.toThrow('Clear failed');
    });
  });
});