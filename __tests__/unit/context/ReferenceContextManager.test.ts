import { ReferenceContextManager } from './ReferenceContextManager';
import { ContentStorage } from '../memory/ContentStorage';
import type { ContentReference } from '../types/content-reference';
import { Logger } from '@hashgraphonline/standards-sdk';

describe('ReferenceContextManager', () => {
  let manager: ReferenceContextManager;
  let contentStorage: ContentStorage;
  let logger: Logger;

  const mockReference: ContentReference = {
    referenceId: 'abcdefghijklmnopqrstuvwxyz1234567890123456789',
    state: 'active',
    preview: 'This is a test content preview for reference management',
    metadata: {
      contentType: 'text',
      sizeBytes: 1024,
      source: 'mcp_tool',
      fileName: 'test.txt',
      mimeType: 'text/plain'
    },
    createdAt: new Date(),
    format: 'ref://{id}' as const
  };

  beforeEach(() => {
    contentStorage = new ContentStorage(1000, {
      sizeThresholdBytes: 1000,
      enableAutoCleanup: false
    });
    
    logger = {
      info: jest.fn(),
      debug: jest.fn(),
      warn: jest.fn(),
      error: jest.fn()
    } as any;
    
    manager = new ReferenceContextManager(contentStorage, logger);
  });

  afterEach(() => {
    contentStorage.dispose();
  });

  describe('Reference Management', () => {
    it('should add references to conversation context', () => {
      const contextId = manager.addReference(mockReference);
      
      expect(contextId).toMatch(/^ctx_\d+_[a-zA-Z0-9]{8}$/);
      
      const stats = manager.getContextStats();
      expect(stats.activeReferences).toBe(1);
      expect(stats.conversationTurn).toBe(1);
    });

    it('should track multiple references', () => {
      const reference1 = { ...mockReference, referenceId: 'ref1' + 'a'.repeat(39) };
      const reference2 = { ...mockReference, referenceId: 'ref2' + 'b'.repeat(39) };
      
      manager.addReference(reference1);
      manager.addReference(reference2);
      
      const stats = manager.getContextStats();
      expect(stats.activeReferences).toBe(2);
      expect(stats.conversationTurn).toBe(2);
    });

    it('should get most recent reference for inscribe commands', () => {
      const reference1 = { ...mockReference, referenceId: 'ref1' + 'a'.repeat(39) };
      const reference2 = { ...mockReference, referenceId: 'ref2' + 'b'.repeat(39) };
      
      manager.addReference(reference1);
      
      jest.advanceTimersByTime(100);
      
      manager.addReference(reference2);
      
      const mostRecent = manager.getMostRecentReference();
      expect(mostRecent?.referenceId).toBe(reference2.referenceId);
    });

    it('should get reference by context ID', () => {
      const contextId = manager.addReference(mockReference);
      
      const retrieved = manager.getReferenceByContextId(contextId);
      expect(retrieved?.referenceId).toBe(mockReference.referenceId);
    });

    it('should return null for invalid context ID', () => {
      const retrieved = manager.getReferenceByContextId('invalid_context_id');
      expect(retrieved).toBeNull();
    });
  });

  describe('Reference Display', () => {
    beforeEach(async () => {
      const buffer = Buffer.from('Test content for display', 'utf8');
      await contentStorage.storeContent(buffer, {
        contentType: 'text',
        mimeType: 'text/plain',
        sizeBytes: buffer.length,
        source: 'mcp_tool',
        fileName: 'test.txt'
      });
      
      jest.spyOn(contentStorage, 'hasReference').mockResolvedValue(true);
    });

    it('should display reference in card format', async () => {
      const result = await manager.displayReference(mockReference, { format: 'card' });
      
      expect(result.hasValidReference).toBe(true);
      expect(result.displayText).toContain('📄 **Large Content Reference**');
      expect(result.displayText).toContain(mockReference.preview);
      expect(result.displayText).toContain('1KB');
      expect(result.displayText).toContain('test.txt');
      expect(result.displayText).toContain('inscribe it');
      expect(result.contextId).toBeDefined();
    });

    it('should display reference in inline format', async () => {
      const result = await manager.displayReference(mockReference, { format: 'inline' });
      
      expect(result.hasValidReference).toBe(true);
      expect(result.displayText).toContain('📄 [1KB text]');
      expect(result.displayText).toContain(mockReference.preview);
    });

    it('should display reference in compact format', async () => {
      const result = await manager.displayReference(mockReference, { 
        format: 'compact',
        showSize: true 
      });
      
      expect(result.hasValidReference).toBe(true);
      expect(result.displayText).toContain('📄 Referenced content (1KB)');
      expect(result.displayText).toContain('test.txt');
    });

    it('should handle invalid references', async () => {
      jest.spyOn(contentStorage, 'hasReference').mockResolvedValue(false);
      
      const result = await manager.displayReference(mockReference);
      
      expect(result.hasValidReference).toBe(false);
      expect(result.displayText).toContain('❌ **Content Reference Expired**');
      expect(result.suggestedActions).toContain('Request fresh content');
    });

    it('should handle display errors', async () => {
      jest.spyOn(contentStorage, 'hasReference').mockRejectedValue(new Error('Storage error'));
      
      const result = await manager.displayReference(mockReference);
      
      expect(result.hasValidReference).toBe(false);
      expect(result.displayText).toContain('⚠️ **Reference Error**');
      expect(result.suggestedActions).toContain('Try again');
    });

    it('should respect display options', async () => {
      const result = await manager.displayReference(mockReference, {
        maxPreviewLength: 20,
        showMetadata: false,
        showSize: false,
        includeActions: false
      });
      
      expect(result.displayText).not.toContain('**File:**');
      expect(result.displayText).not.toContain('**Size:**');
      expect(result.displayText).not.toContain('inscribe it');
      expect(result.displayText).toMatch(/This is a test conte\.\.\./);
    });
  });

  describe('Reference Validation', () => {
    it('should validate active references', async () => {
      manager.addReference(mockReference);
      
      jest.spyOn(contentStorage, 'hasReference').mockResolvedValue(true);
      
      const result = await manager.validateReferences();
      
      expect(result.valid).toBe(1);
      expect(result.invalid).toBe(0);
      expect(result.removed).toHaveLength(0);
    });

    it('should remove invalid references', async () => {
      manager.addReference(mockReference);
      
      jest.spyOn(contentStorage, 'hasReference').mockResolvedValue(false);
      
      const result = await manager.validateReferences();
      
      expect(result.valid).toBe(0);
      expect(result.invalid).toBe(1);
      expect(result.removed).toHaveLength(1);
      expect(result.removed[0]).toBe(mockReference.referenceId);
      
      const stats = manager.getContextStats();
      expect(stats.activeReferences).toBe(0);
    });

    it('should handle validation errors', async () => {
      manager.addReference(mockReference);
      
      jest.spyOn(contentStorage, 'hasReference').mockRejectedValue(new Error('Validation error'));
      
      const result = await manager.validateReferences();
      
      expect(result.valid).toBe(0);
      expect(result.invalid).toBe(1);
      expect(result.removed).toHaveLength(1);
    });
  });

  describe('Reference Cleanup', () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('should cleanup old references based on age', () => {
      const reference1 = { ...mockReference, referenceId: 'ref1' + 'a'.repeat(39) };
      const reference2 = { ...mockReference, referenceId: 'ref2' + 'b'.repeat(39) };
      
      manager.addReference(reference1);
      
      jest.advanceTimersByTime(20 * 60 * 1000);
      
      manager.addReference(reference2);
      
      jest.advanceTimersByTime(15 * 60 * 1000);
      
      const cleanedUp = manager.cleanupOldReferences(30 * 60 * 1000);
      expect(cleanedUp).toBe(1);
      
      const stats = manager.getContextStats();
      expect(stats.activeReferences).toBe(1);
    });

    it('should not cleanup recent references', () => {
      manager.addReference(mockReference);
      
      const cleanedUp = manager.cleanupOldReferences(30 * 60 * 1000);
      expect(cleanedUp).toBe(0);
      
      const stats = manager.getContextStats();
      expect(stats.activeReferences).toBe(1);
    });

    it('should update access time when getting references', () => {
      const contextId = manager.addReference(mockReference);
      
      jest.advanceTimersByTime(10 * 60 * 1000);
      
      manager.getReferenceByContextId(contextId);
      
      const cleanedUp = manager.cleanupOldReferences(15 * 60 * 1000);
      expect(cleanedUp).toBe(0);
    });
  });

  describe('Context Management', () => {
    it('should provide context statistics', () => {
      const reference1 = { ...mockReference, referenceId: 'ref1' + 'a'.repeat(39) };
      const reference2 = { ...mockReference, referenceId: 'ref2' + 'b'.repeat(39) };
      
      manager.addReference(reference1);
      manager.addReference(reference2);
      
      const stats = manager.getContextStats();
      expect(stats.activeReferences).toBe(2);
      expect(stats.conversationTurn).toBe(2);
      expect(stats.oldestReference).toBeDefined();
      expect(stats.mostRecentReference).toBeDefined();
    });

    it('should clear all references', () => {
      manager.addReference(mockReference);
      
      let stats = manager.getContextStats();
      expect(stats.activeReferences).toBe(1);
      
      manager.clear();
      
      stats = manager.getContextStats();
      expect(stats.activeReferences).toBe(0);
      expect(stats.conversationTurn).toBe(0);
    });

    it('should return null for stats when no references exist', () => {
      const stats = manager.getContextStats();
      expect(stats.activeReferences).toBe(0);
      expect(stats.oldestReference).toBeNull();
      expect(stats.mostRecentReference).toBeNull();
    });
  });
});