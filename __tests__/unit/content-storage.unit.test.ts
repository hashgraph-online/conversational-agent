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

  describe('store', () => {
    it('should store content successfully', async () => {
      const content = 'test content';
      const expectedId = 'content-123';

      mockFs.writeFile.mockResolvedValue(undefined);
      mockPath.join.mockReturnValue('/storage/path');

      const id = await storage.store(content);

      expect(typeof id).toBe('string');
      expect(id.length).toBeGreaterThan(0);
      expect(mockFs.writeFile).toHaveBeenCalled();
    });

    it('should handle storage errors', async () => {
      const content = 'test content';
      const error = new Error('Storage failed');

      mockFs.writeFile.mockRejectedValue(error);

      await expect(storage.store(content)).rejects.toThrow('Storage failed');
      expect(mockLoggerInstance.error).toHaveBeenCalled();
    });
  });

  describe('retrieve', () => {
    it('should retrieve content successfully', async () => {
      const contentId = 'test-id';
      const expectedContent = 'retrieved content';

      mockFs.readFile.mockResolvedValue(Buffer.from(expectedContent));
      mockPath.join.mockReturnValue('/storage/path');

      const content = await storage.retrieve(contentId);

      expect(content).toBe(expectedContent);
      expect(mockFs.readFile).toHaveBeenCalled();
    });

    it('should handle retrieval errors', async () => {
      const contentId = 'nonexistent-id';
      const error = new Error('File not found');

      mockFs.readFile.mockRejectedValue(error);

      await expect(storage.retrieve(contentId)).rejects.toThrow('File not found');
      expect(mockLoggerInstance.error).toHaveBeenCalled();
    });
  });

  describe('exists', () => {
    it('should check if content exists', async () => {
      const contentId = 'test-id';

      mockFs.access.mockResolvedValue(undefined);
      mockPath.join.mockReturnValue('/storage/path');

      const exists = await storage.exists(contentId);

      expect(exists).toBe(true);
      expect(mockFs.access).toHaveBeenCalled();
    });

    it('should return false for non-existent content', async () => {
      const contentId = 'nonexistent-id';

      mockFs.access.mockRejectedValue(new Error('File not found'));

      const exists = await storage.exists(contentId);

      expect(exists).toBe(false);
    });
  });

  describe('delete', () => {
    it('should delete content successfully', async () => {
      const contentId = 'test-id';

      mockFs.unlink.mockResolvedValue(undefined);
      mockPath.join.mockReturnValue('/storage/path');

      await storage.delete(contentId);

      expect(mockFs.unlink).toHaveBeenCalled();
      expect(mockLoggerInstance.info).toHaveBeenCalled();
    });

    it('should handle deletion errors', async () => {
      const contentId = 'test-id';
      const error = new Error('Deletion failed');

      mockFs.unlink.mockRejectedValue(error);

      await expect(storage.delete(contentId)).rejects.toThrow('Deletion failed');
      expect(mockLoggerInstance.error).toHaveBeenCalled();
    });
  });

  describe('list', () => {
    it('should list all stored content', async () => {
      const mockFiles = ['file1.txt', 'file2.txt', 'file3.txt'];

      mockFs.readdir.mockResolvedValue(mockFiles as any);

      const files = await storage.list();

      expect(files).toEqual(mockFiles);
      expect(mockFs.readdir).toHaveBeenCalled();
    });

    it('should handle listing errors', async () => {
      const error = new Error('Directory not found');

      mockFs.readdir.mockRejectedValue(error);

      await expect(storage.list()).rejects.toThrow('Directory not found');
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

  describe('getSize', () => {
    it('should get storage size', async () => {
      const mockFiles = ['file1.txt', 'file2.txt'];
      const mockStats = { size: 1024 };

      mockFs.readdir.mockResolvedValue(mockFiles as any);
      mockFs.stat.mockResolvedValue(mockStats as any);

      const size = await storage.getSize();

      expect(size).toBe(mockStats.size * mockFiles.length);
      expect(mockFs.stat).toHaveBeenCalledTimes(mockFiles.length);
    });

    it('should handle size calculation errors', async () => {
      const error = new Error('Size calculation failed');

      mockFs.readdir.mockRejectedValue(error);

      await expect(storage.getSize()).rejects.toThrow('Size calculation failed');
    });
  });
});