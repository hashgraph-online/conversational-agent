import { ContentStoreManager } from '../../src/services/content-store-manager';
import { Logger } from '@hashgraphonline/standards-sdk';

jest.mock('@hashgraphonline/standards-sdk');

const mockLogger = jest.mocked(Logger);

const mockContentStoreService = {
  setInstance: jest.fn(),
  getInstance: jest.fn(),
};

const mockContentResolverRegistry = {
  register: jest.fn(),
  unregister: jest.fn(),
  getResolver: jest.fn(),
};

const mockAdapter = {
  store: jest.fn(),
  retrieve: jest.fn(),
  exists: jest.fn(),
  delete: jest.fn(),
};

const mockResolver = {
  resolve: jest.fn(),
  canResolve: jest.fn(),
};

describe('ContentStoreManager', () => {
  let contentStoreManager: ContentStoreManager;

  beforeEach(() => {
    jest.clearAllMocks();
    contentStoreManager = new ContentStoreManager();

    mockAdapter.store.mockResolvedValue('stored-id');
    mockAdapter.retrieve.mockResolvedValue('retrieved-content');
    mockAdapter.exists.mockResolvedValue(true);
    mockAdapter.delete.mockResolvedValue(true);
    
    mockResolver.resolve.mockResolvedValue('resolved-content');
    mockResolver.canResolve.mockReturnValue(true);
  });

  describe('Constructor', () => {
    it('should create instance with logger', () => {
      expect(contentStoreManager).toBeInstanceOf(ContentStoreManager);
      expect(mockLogger).toHaveBeenCalledWith({
        module: 'ContentStoreManager',
      });
    });
  });

  describe('initialize', () => {
    it('should initialize successfully', async () => {
      (contentStoreManager as any).adapter = mockAdapter;
      (contentStoreManager as any).resolver = mockResolver;
      
      jest.doMock('../../src/services/content-storage', () => ({
        ContentStoreService: mockContentStoreService,
      }));
      
      jest.doMock('../../src/services/formatters/format-converter-registry', () => ({
        ContentResolverRegistry: mockContentResolverRegistry,
      }));

      await contentStoreManager.initialize();

      expect(contentStoreManager.isRegistered).toBe(true);
    });

    it('should handle initialization failure', async () => {
      (contentStoreManager as any).adapter = undefined;

      await expect(contentStoreManager.initialize()).rejects.toThrow();
    });

    it('should not initialize twice', async () => {
      (contentStoreManager as any).isRegistered = true;
      (contentStoreManager as any).adapter = mockAdapter;
      (contentStoreManager as any).resolver = mockResolver;

      await contentStoreManager.initialize();

      expect(contentStoreManager.isRegistered).toBe(true);
    });
  });

  describe('store', () => {
    beforeEach(async () => {
      (contentStoreManager as any).adapter = mockAdapter;
      (contentStoreManager as any).isRegistered = true;
    });

    it('should store content successfully', async () => {
      const content = 'test content';
      const options = { metadata: { type: 'text' } };

      const result = await contentStoreManager.store(content, options);

      expect(mockAdapter.store).toHaveBeenCalledWith(content, options);
      expect(result).toBe('stored-id');
    });

    it('should store content without options', async () => {
      const content = 'test content';

      const result = await contentStoreManager.store(content);

      expect(mockAdapter.store).toHaveBeenCalledWith(content, undefined);
      expect(result).toBe('stored-id');
    });

    it('should throw error when not initialized', async () => {
      (contentStoreManager as any).isRegistered = false;

      await expect(contentStoreManager.store('content')).rejects.toThrow(
        'ContentStoreManager not initialized'
      );
    });

    it('should handle adapter errors', async () => {
      mockAdapter.store.mockRejectedValue(new Error('Storage failed'));

      await expect(contentStoreManager.store('content')).rejects.toThrow(
        'Storage failed'
      );
    });
  });

  describe('retrieve', () => {
    beforeEach(async () => {
      (contentStoreManager as any).adapter = mockAdapter;
      (contentStoreManager as any).isRegistered = true;
    });

    it('should retrieve content successfully', async () => {
      const contentId = 'test-id';

      const result = await contentStoreManager.retrieve(contentId);

      expect(mockAdapter.retrieve).toHaveBeenCalledWith(contentId);
      expect(result).toBe('retrieved-content');
    });

    it('should throw error when not initialized', async () => {
      (contentStoreManager as any).isRegistered = false;

      await expect(contentStoreManager.retrieve('test-id')).rejects.toThrow(
        'ContentStoreManager not initialized'
      );
    });

    it('should handle adapter errors', async () => {
      mockAdapter.retrieve.mockRejectedValue(new Error('Retrieval failed'));

      await expect(contentStoreManager.retrieve('test-id')).rejects.toThrow(
        'Retrieval failed'
      );
    });
  });

  describe('exists', () => {
    beforeEach(async () => {
      (contentStoreManager as any).adapter = mockAdapter;
      (contentStoreManager as any).isRegistered = true;
    });

    it('should check if content exists', async () => {
      const contentId = 'test-id';

      const result = await contentStoreManager.exists(contentId);

      expect(mockAdapter.exists).toHaveBeenCalledWith(contentId);
      expect(result).toBe(true);
    });

    it('should return false when content does not exist', async () => {
      mockAdapter.exists.mockResolvedValue(false);
      const contentId = 'non-existent-id';

      const result = await contentStoreManager.exists(contentId);

      expect(result).toBe(false);
    });

    it('should throw error when not initialized', async () => {
      (contentStoreManager as any).isRegistered = false;

      await expect(contentStoreManager.exists('test-id')).rejects.toThrow(
        'ContentStoreManager not initialized'
      );
    });
  });

  describe('delete', () => {
    beforeEach(async () => {
      (contentStoreManager as any).adapter = mockAdapter;
      (contentStoreManager as any).isRegistered = true;
    });

    it('should delete content successfully', async () => {
      const contentId = 'test-id';

      const result = await contentStoreManager.delete(contentId);

      expect(mockAdapter.delete).toHaveBeenCalledWith(contentId);
      expect(result).toBe(true);
    });

    it('should return false when deletion fails', async () => {
      mockAdapter.delete.mockResolvedValue(false);
      const contentId = 'test-id';

      const result = await contentStoreManager.delete(contentId);

      expect(result).toBe(false);
    });

    it('should throw error when not initialized', async () => {
      (contentStoreManager as any).isRegistered = false;

      await expect(contentStoreManager.delete('test-id')).rejects.toThrow(
        'ContentStoreManager not initialized'
      );
    });
  });

  describe('resolve', () => {
    beforeEach(async () => {
      (contentStoreManager as any).resolver = mockResolver;
      (contentStoreManager as any).isRegistered = true;
    });

    it('should resolve reference successfully', async () => {
      const reference = 'test-reference';

      const result = await contentStoreManager.resolve(reference);

      expect(mockResolver.resolve).toHaveBeenCalledWith(reference);
      expect(result).toBe('resolved-content');
    });

    it('should throw error when not initialized', async () => {
      (contentStoreManager as any).isRegistered = false;

      await expect(contentStoreManager.resolve('test-reference')).rejects.toThrow(
        'ContentStoreManager not initialized'
      );
    });

    it('should handle resolver errors', async () => {
      mockResolver.resolve.mockRejectedValue(new Error('Resolution failed'));

      await expect(contentStoreManager.resolve('test-reference')).rejects.toThrow(
        'Resolution failed'
      );
    });
  });

  describe('canResolve', () => {
    beforeEach(async () => {
      (contentStoreManager as any).resolver = mockResolver;
      (contentStoreManager as any).isRegistered = true;
    });

    it('should check if reference can be resolved', () => {
      const reference = 'test-reference';

      const result = contentStoreManager.canResolve(reference);

      expect(mockResolver.canResolve).toHaveBeenCalledWith(reference);
      expect(result).toBe(true);
    });

    it('should return false when cannot resolve', () => {
      mockResolver.canResolve.mockReturnValue(false);
      const reference = 'invalid-reference';

      const result = contentStoreManager.canResolve(reference);

      expect(result).toBe(false);
    });

    it('should throw error when not initialized', () => {
      (contentStoreManager as any).isRegistered = false;

      expect(() => contentStoreManager.canResolve('test-reference')).toThrow(
        'ContentStoreManager not initialized'
      );
    });
  });

  describe('dispose', () => {
    it('should dispose successfully when initialized', async () => {
      (contentStoreManager as any).isRegistered = true;
      (contentStoreManager as any).adapter = mockAdapter;
      (contentStoreManager as any).resolver = mockResolver;

      await contentStoreManager.dispose();

      expect(contentStoreManager.isRegistered).toBe(false);
    });

    it('should handle disposal when not initialized', async () => {
      (contentStoreManager as any).isRegistered = false;

      await expect(contentStoreManager.dispose()).resolves.not.toThrow();
      expect(contentStoreManager.isRegistered).toBe(false);
    });

    it('should handle disposal errors gracefully', async () => {
      (contentStoreManager as any).isRegistered = true;
      (contentStoreManager as any).adapter = mockAdapter;

      jest.doMock('../../src/services/formatters/format-converter-registry', () => ({
        ContentResolverRegistry: {
          ...mockContentResolverRegistry,
          unregister: jest.fn(() => { throw new Error('Unregister failed'); }),
        },
      }));

      await expect(contentStoreManager.dispose()).resolves.not.toThrow();
      expect(contentStoreManager.isRegistered).toBe(false);
    });
  });

  describe('getStatus', () => {
    it('should return status when initialized', () => {
      (contentStoreManager as any).isRegistered = true;
      (contentStoreManager as any).adapter = mockAdapter;

      const status = contentStoreManager.getStatus();

      expect(status).toEqual({
        initialized: true,
        hasAdapter: true,
        hasResolver: false,
      });
    });

    it('should return status when not initialized', () => {
      (contentStoreManager as any).isRegistered = false;

      const status = contentStoreManager.getStatus();

      expect(status).toEqual({
        initialized: false,
        hasAdapter: false,
        hasResolver: false,
      });
    });

    it('should return status with resolver', () => {
      (contentStoreManager as any).isRegistered = true;
      (contentStoreManager as any).adapter = mockAdapter;
      (contentStoreManager as any).resolver = mockResolver;

      const status = contentStoreManager.getStatus();

      expect(status).toEqual({
        initialized: true,
        hasAdapter: true,
        hasResolver: true,
      });
    });
  });
});