import { ContentStorage } from '../../src/memory/ContentStorage';
import { HumanMessage, AIMessage } from '@langchain/core/messages';
import type { BaseMessage } from '@langchain/core/messages';

describe('ContentStorage', () => {
  let contentStorage: ContentStorage;

  beforeEach(() => {
    contentStorage = new ContentStorage();
  });

  describe('constructor', () => {
    it('should initialize with default parameters', () => {
      expect(contentStorage).toBeInstanceOf(ContentStorage);
      expect(contentStorage.getTotalStoredMessages()).toBe(0);
    });

    it('should initialize with custom max storage', () => {
      const storage = new ContentStorage(500);
      expect(storage).toBeInstanceOf(ContentStorage);
    });
  });

  describe('storeMessages', () => {
    it('should store single message', () => {
      const message = new HumanMessage('Test message');
      const result = contentStorage.storeMessages([message]);
      
      expect(result.stored).toBe(1);
      expect(result.dropped).toBe(0);
      expect(contentStorage.getTotalStoredMessages()).toBe(1);
    });

    it('should store multiple messages', () => {
      const messages = [
        new HumanMessage('First message'),
        new AIMessage('Second message'),
        new HumanMessage('Third message')
      ];
      
      const result = contentStorage.storeMessages(messages);
      
      expect(result.stored).toBe(3);
      expect(result.dropped).toBe(0);
      expect(contentStorage.getTotalStoredMessages()).toBe(3);
    });

    it('should drop old messages when storage limit exceeded', () => {
      const storage = new ContentStorage(5);
      
      for (let i = 0; i < 5; i++) {
        storage.storeMessages([new HumanMessage(`Message ${i}`)]);
      }
      
      expect(storage.getTotalStoredMessages()).toBe(5);
      
      const result = storage.storeMessages([
        new HumanMessage('New message 1'),
        new HumanMessage('New message 2')
      ]);
      
      expect(result.stored).toBe(2);
      expect(result.dropped).toBe(2);
      expect(storage.getTotalStoredMessages()).toBe(5);
    });

    it('should handle empty message array', () => {
      const result = contentStorage.storeMessages([]);
      expect(result.stored).toBe(0);
      expect(result.dropped).toBe(0);
    });

    it('should maintain message order', () => {
      const messages = [
        new HumanMessage('First'),
        new AIMessage('Second'),
        new HumanMessage('Third')
      ];
      
      contentStorage.storeMessages(messages);
      const retrieved = contentStorage.getRecentMessages(3);
      
      expect(retrieved).toHaveLength(3);
      expect(retrieved[0].content).toBe('First');
      expect(retrieved[1].content).toBe('Second');
      expect(retrieved[2].content).toBe('Third');
    });
  });

  describe('getRecentMessages', () => {
    beforeEach(() => {
      const messages = [];
      for (let i = 0; i < 10; i++) {
        messages.push(new HumanMessage(`Message ${i}`));
      }
      contentStorage.storeMessages(messages);
    });

    it('should return requested number of recent messages', () => {
      const recent = contentStorage.getRecentMessages(5);
      expect(recent).toHaveLength(5);
      expect(recent[0].content).toBe('Message 5');
      expect(recent[4].content).toBe('Message 9');
    });

    it('should return all messages if count exceeds stored messages', () => {
      const storage = new ContentStorage();
      storage.storeMessages([
        new HumanMessage('Message 1'),
        new HumanMessage('Message 2')
      ]);
      
      const recent = storage.getRecentMessages(10);
      expect(recent).toHaveLength(2);
    });

    it('should return empty array when no messages stored', () => {
      const emptyStorage = new ContentStorage();
      const recent = emptyStorage.getRecentMessages(5);
      expect(recent).toHaveLength(0);
    });

    it('should return empty array when count is 0', () => {
      const recent = contentStorage.getRecentMessages(0);
      expect(recent).toHaveLength(0);
    });
  });

  describe('searchMessages', () => {
    beforeEach(() => {
      const messages = [
        new HumanMessage('Hello world'),
        new AIMessage('Hi there, how can I help you?'),
        new HumanMessage('Tell me about blockchain technology'),
        new AIMessage('Blockchain is a distributed ledger technology'),
        new HumanMessage('What about cryptocurrency?'),
        new AIMessage('Cryptocurrency uses blockchain for secure transactions')
      ];
      contentStorage.storeMessages(messages);
    });

    it('should find messages containing search term', () => {
      const results = contentStorage.searchMessages('blockchain');
      expect(results).toHaveLength(3);
      expect(results.some(r => (r.content as string).includes('blockchain'))).toBe(true);
      expect(results.some(r => (r.content as string).includes('Blockchain'))).toBe(true);
    });

    it('should perform case-insensitive search by default', () => {
      const results = contentStorage.searchMessages('HELLO');
      expect(results).toHaveLength(1);
      expect(results[0].content).toBe('Hello world');
    });

    it('should perform case-sensitive search when specified', () => {
      const results = contentStorage.searchMessages('HELLO', { caseSensitive: true });
      expect(results).toHaveLength(0);
      
      const results2 = contentStorage.searchMessages('Hello', { caseSensitive: true });
      expect(results2).toHaveLength(1);
    });

    it('should limit search results when specified', () => {
      const results = contentStorage.searchMessages('e', { limit: 2 });
      expect(results.length).toBeLessThanOrEqual(2);
    });

    it('should return empty array when no matches found', () => {
      const results = contentStorage.searchMessages('xyz123');
      expect(results).toHaveLength(0);
    });

    it('should handle regex patterns', () => {
      const results = contentStorage.searchMessages('\\bblock\\w+', { useRegex: true });
      expect(results.length).toBeGreaterThan(0);
      results.forEach(result => {
        expect(result.content.toLowerCase()).toMatch(/\bblock\w+/);
      });
    });
  });

  describe('getMessagesFromTimeRange', () => {
    let startTime: Date;
    let messages: BaseMessage[];

    beforeEach(() => {
      startTime = new Date();
      messages = [];
      
      for (let i = 0; i < 5; i++) {
        const message = new HumanMessage(`Message ${i}`);
        messages.push(message);
      }
      
      contentStorage.storeMessages(messages);
    });

    it('should return messages within time range', () => {
      const endTime = new Date();
      const results = contentStorage.getMessagesFromTimeRange(startTime, endTime);
      
      expect(results.length).toBeGreaterThan(0);
      expect(results.length).toBeLessThanOrEqual(5);
    });

    it('should return empty array for future time range', () => {
      const futureStart = new Date(Date.now() + 60000);
      const futureEnd = new Date(Date.now() + 120000);
      
      const results = contentStorage.getMessagesFromTimeRange(futureStart, futureEnd);
      expect(results).toHaveLength(0);
    });

    it('should handle invalid time range (start > end)', () => {
      const start = new Date();
      const end = new Date(start.getTime() - 60000);
      
      const results = contentStorage.getMessagesFromTimeRange(start, end);
      expect(results).toHaveLength(0);
    });
  });

  describe('getStorageStats', () => {
    it('should return correct storage statistics for empty storage', () => {
      const stats = contentStorage.getStorageStats();
      
      expect(stats.totalMessages).toBe(0);
      expect(stats.maxStorageLimit).toBe(ContentStorage.DEFAULT_MAX_STORAGE);
      expect(stats.usagePercentage).toBe(0);
      expect(stats.oldestMessageTime).toBeUndefined();
      expect(stats.newestMessageTime).toBeUndefined();
    });

    it('should return correct storage statistics for filled storage', () => {
      const messages = [];
      for (let i = 0; i < 10; i++) {
        messages.push(new HumanMessage(`Message ${i}`));
      }
      contentStorage.storeMessages(messages);
      
      const stats = contentStorage.getStorageStats();
      
      expect(stats.totalMessages).toBe(10);
      expect(stats.maxStorageLimit).toBe(ContentStorage.DEFAULT_MAX_STORAGE);
      expect(stats.usagePercentage).toBeGreaterThan(0);
      expect(stats.oldestMessageTime).toBeDefined();
      expect(stats.newestMessageTime).toBeDefined();
    });

    it('should calculate usage percentage correctly', () => {
      const storage = new ContentStorage(10);
      const messages = Array.from({ length: 5 }, (_, i) => new HumanMessage(`Message ${i}`));
      storage.storeMessages(messages);
      
      const stats = storage.getStorageStats();
      expect(stats.usagePercentage).toBe(50);
    });
  });

  describe('clear', () => {
    it('should remove all stored messages', () => {
      const messages = [
        new HumanMessage('Message 1'),
        new AIMessage('Message 2'),
        new HumanMessage('Message 3')
      ];
      
      contentStorage.storeMessages(messages);
      expect(contentStorage.getTotalStoredMessages()).toBe(3);
      
      contentStorage.clear();
      expect(contentStorage.getTotalStoredMessages()).toBe(0);
      expect(contentStorage.getRecentMessages(10)).toHaveLength(0);
    });
  });

  describe('getTotalStoredMessages', () => {
    it('should return correct count of stored messages', () => {
      expect(contentStorage.getTotalStoredMessages()).toBe(0);
      
      contentStorage.storeMessages([new HumanMessage('Test 1')]);
      expect(contentStorage.getTotalStoredMessages()).toBe(1);
      
      contentStorage.storeMessages([
        new HumanMessage('Test 2'),
        new AIMessage('Test 3')
      ]);
      expect(contentStorage.getTotalStoredMessages()).toBe(3);
    });

    it('should respect storage limit', () => {
      const storage = new ContentStorage(5);
      
      for (let i = 0; i < 10; i++) {
        storage.storeMessages([new HumanMessage(`Message ${i}`)]);
      }
      
      expect(storage.getTotalStoredMessages()).toBe(5);
    });
  });

  describe('edge cases', () => {
    it('should handle messages with empty content', () => {
      const emptyMessage = new HumanMessage('');
      const result = contentStorage.storeMessages([emptyMessage]);
      
      expect(result.stored).toBe(1);
      expect(contentStorage.getTotalStoredMessages()).toBe(1);
    });

    it('should handle messages with special characters', () => {
      const specialMessage = new HumanMessage('Hello 世界! 🚀 @#$%^&*()');
      const result = contentStorage.storeMessages([specialMessage]);
      
      expect(result.stored).toBe(1);
      const retrieved = contentStorage.getRecentMessages(1);
      expect(retrieved[0].content).toBe('Hello 世界! 🚀 @#$%^&*()');
    });

    it('should handle very long messages', () => {
      const longMessage = new HumanMessage('a'.repeat(10000));
      const result = contentStorage.storeMessages([longMessage]);
      
      expect(result.stored).toBe(1);
      const retrieved = contentStorage.getRecentMessages(1);
      expect(retrieved[0].content).toHaveLength(10000);
    });

    it('should maintain performance with large storage', () => {
      const storage = new ContentStorage(1000);
      const startTime = Date.now();
      
      for (let i = 0; i < 1000; i++) {
        storage.storeMessages([new HumanMessage(`Performance test message ${i}`)]);
      }
      
      const endTime = Date.now();
      const duration = endTime - startTime;
      
      expect(storage.getTotalStoredMessages()).toBe(1000);
      expect(duration).toBeLessThan(5000);
    });
  });
});