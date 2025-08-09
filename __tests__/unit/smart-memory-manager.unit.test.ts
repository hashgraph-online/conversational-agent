import { SmartMemoryManager } from '../../src/memory/SmartMemoryManager';
import { HumanMessage, AIMessage, SystemMessage } from '@langchain/core/messages';
import type { BaseMessage } from '@langchain/core/messages';

describe('SmartMemoryManager', () => {
  let memoryManager: SmartMemoryManager;

  beforeEach(() => {
    memoryManager = new SmartMemoryManager({
      maxTokens: 1000,
      reserveTokens: 100,
      modelName: 'gpt-4o'
    });
  });

  describe('constructor', () => {
    it('should initialize with default parameters', () => {
      const manager = new SmartMemoryManager();
      expect(manager).toBeInstanceOf(SmartMemoryManager);
    });

    it('should initialize with custom parameters', () => {
      const manager = new SmartMemoryManager({
        maxTokens: 2000,
        reserveTokens: 200,
        modelName: 'gpt-3.5-turbo',
        storageLimit: 500
      });
      expect(manager).toBeInstanceOf(SmartMemoryManager);
    });
  });

  describe('addMessage', () => {
    it('should add message to active memory', () => {
      const message = new HumanMessage('Test message');
      memoryManager.addMessage(message);
      
      const messages = memoryManager.getMessages();
      expect(messages).toHaveLength(1);
      expect(messages[0].content).toBe('Test message');
    });

    it('should handle conversation flow with human and AI messages', () => {
      memoryManager.addMessage(new HumanMessage('Hello'));
      memoryManager.addMessage(new AIMessage('Hi there!'));
      memoryManager.addMessage(new HumanMessage('How are you?'));
      memoryManager.addMessage(new AIMessage('I am doing well, thanks!'));
      
      const messages = memoryManager.getMessages();
      expect(messages).toHaveLength(4);
      expect(messages[0]._getType()).toBe('human');
      expect(messages[1]._getType()).toBe('ai');
      expect(messages[2]._getType()).toBe('human');
      expect(messages[3]._getType()).toBe('ai');
    });

    it('should store pruned messages in content storage', () => {
      const smallManager = new SmartMemoryManager({
        maxTokens: 50,
        reserveTokens: 10,
        modelName: 'gpt-4o'
      });

      const messages = [
        'Tell me about blockchain technology and how it works in detail with examples',
        'Blockchain is a distributed ledger technology that provides transparency and security',
        'What are the specific benefits of using blockchain technology in finance?',
        'Benefits include transparency, security, decentralization, and immutable records',
        'Can you explain smart contracts and their use cases in detail?',
        'Smart contracts are self-executing contracts with terms written in code that automatically execute'
      ];

      messages.forEach((content, i) => {
        if (i % 2 === 0) {
          smallManager.addMessage(new HumanMessage(content));
        } else {
          smallManager.addMessage(new AIMessage(content));
        }
      });

      const activeMessages = smallManager.getMessages();
      const storageStats = smallManager.getStorageStats();
      
      expect(activeMessages.length).toBeLessThan(messages.length);
      expect(storageStats.totalMessages).toBeGreaterThan(0);
    });
  });

  describe('getMessages', () => {
    it('should return empty array initially', () => {
      expect(memoryManager.getMessages()).toHaveLength(0);
    });

    it('should return messages in chronological order', () => {
      const messages = [
        new HumanMessage('First'),
        new AIMessage('Second'),
        new HumanMessage('Third')
      ];

      messages.forEach(msg => memoryManager.addMessage(msg));
      const retrieved = memoryManager.getMessages();

      expect(retrieved).toHaveLength(3);
      expect(retrieved[0].content).toBe('First');
      expect(retrieved[1].content).toBe('Second');
      expect(retrieved[2].content).toBe('Third');
    });
  });

  describe('clear', () => {
    it('should clear active memory but preserve storage', () => {
      memoryManager.addMessage(new HumanMessage('Test message 1'));
      memoryManager.addMessage(new AIMessage('Test response 1'));
      
      expect(memoryManager.getMessages()).toHaveLength(2);
      
      memoryManager.clear();
      
      expect(memoryManager.getMessages()).toHaveLength(0);
      
      const stats = memoryManager.getStorageStats();
      expect(stats).toBeDefined();
    });

    it('should optionally clear storage as well', () => {
      memoryManager.addMessage(new HumanMessage('Test message'));
      
      const smallManager = new SmartMemoryManager({ maxTokens: 50, reserveTokens: 10 });
      for (let i = 0; i < 10; i++) {
        smallManager.addMessage(new HumanMessage(`Long message ${i} with content that should trigger pruning`));
      }
      
      expect(smallManager.getStorageStats().totalMessages).toBeGreaterThan(0);
      
      smallManager.clear(true);
      
      expect(smallManager.getMessages()).toHaveLength(0);
      expect(smallManager.getStorageStats().totalMessages).toBe(0);
    });
  });

  describe('setSystemPrompt', () => {
    it('should set system prompt and include in token calculations', () => {
      const systemPrompt = 'You are a helpful AI assistant.';
      memoryManager.setSystemPrompt(systemPrompt);
      
      const stats = memoryManager.getMemoryStats();
      expect(stats.systemPromptTokens).toBeGreaterThan(0);
    });

    it('should update system prompt', () => {
      const shortPrompt = 'Be helpful.';
      const longPrompt = 'You are a sophisticated AI assistant with extensive knowledge.';
      
      memoryManager.setSystemPrompt(shortPrompt);
      const shortStats = memoryManager.getMemoryStats();
      
      memoryManager.setSystemPrompt(longPrompt);
      const longStats = memoryManager.getMemoryStats();
      
      expect(longStats.systemPromptTokens).toBeGreaterThan(shortStats.systemPromptTokens);
    });
  });

  describe('searchHistory', () => {
    beforeEach(() => {
      const testManager = new SmartMemoryManager({ maxTokens: 50, reserveTokens: 10 });
      
      const testMessages = [
        new HumanMessage('Tell me about blockchain technology'),
        new AIMessage('Blockchain is a distributed ledger'),
        new HumanMessage('What about cryptocurrency?'),
        new AIMessage('Cryptocurrency uses blockchain'),
        new HumanMessage('How does Bitcoin work?'),
        new AIMessage('Bitcoin is a digital currency')
      ];

      testMessages.forEach(msg => testManager.addMessage(msg));
      
      memoryManager = testManager;
    });

    it('should search in stored messages', () => {
      const results = memoryManager.searchHistory('blockchain');
      expect(results.length).toBeGreaterThan(0);
      expect(results.some(msg => (msg.content as string).toLowerCase().includes('blockchain'))).toBe(true);
    });

    it('should search with options', () => {
      const results = memoryManager.searchHistory('Bitcoin', { 
        caseSensitive: true, 
        limit: 1 
      });
      expect(results.length).toBeLessThanOrEqual(1);
    });

    it('should return empty array for no matches', () => {
      const results = memoryManager.searchHistory('nonexistent');
      expect(results).toHaveLength(0);
    });
  });

  describe('getRecentHistory', () => {
    beforeEach(() => {
      const testManager = new SmartMemoryManager({ maxTokens: 50, reserveTokens: 10 });
      
      for (let i = 0; i < 10; i++) {
        testManager.addMessage(new HumanMessage(`Historical message ${i} with content`));
      }
      
      memoryManager = testManager;
    });

    it('should retrieve recent messages from storage', () => {
      const recentHistory = memoryManager.getRecentHistory(5);
      expect(recentHistory.length).toBeLessThanOrEqual(5);
    });

    it('should return empty array when no history', () => {
      const freshManager = new SmartMemoryManager();
      const history = freshManager.getRecentHistory(5);
      expect(history).toHaveLength(0);
    });
  });

  describe('getMemoryStats', () => {
    it('should return memory statistics', () => {
      memoryManager.setSystemPrompt('Test system prompt');
      memoryManager.addMessage(new HumanMessage('Test message'));
      
      const stats = memoryManager.getMemoryStats();
      
      expect(stats).toHaveProperty('totalActiveMessages');
      expect(stats).toHaveProperty('currentTokenCount');
      expect(stats).toHaveProperty('maxTokens');
      expect(stats).toHaveProperty('remainingCapacity');
      expect(stats).toHaveProperty('systemPromptTokens');
      
      expect(stats.totalActiveMessages).toBe(1);
      expect(stats.currentTokenCount).toBeGreaterThan(0);
      expect(stats.systemPromptTokens).toBeGreaterThan(0);
    });

    it('should calculate usage percentage correctly', () => {
      const stats = memoryManager.getMemoryStats();
      expect(stats.usagePercentage).toBeGreaterThanOrEqual(0);
      expect(stats.usagePercentage).toBeLessThanOrEqual(100);
    });
  });

  describe('getStorageStats', () => {
    it('should return storage statistics', () => {
      const stats = memoryManager.getStorageStats();
      
      expect(stats).toHaveProperty('totalMessages');
      expect(stats).toHaveProperty('maxStorageLimit');
      expect(stats).toHaveProperty('usagePercentage');
      
      expect(typeof stats.totalMessages).toBe('number');
      expect(typeof stats.usagePercentage).toBe('number');
    });
  });

  describe('canAddMessage', () => {
    it('should return true for messages that fit', () => {
      const shortMessage = new HumanMessage('Hi');
      expect(memoryManager.canAddMessage(shortMessage)).toBe(true);
    });

    it('should return false for excessively large messages', () => {
      const hugeMessage = new HumanMessage('a'.repeat(50000));
      expect(memoryManager.canAddMessage(hugeMessage)).toBe(false);
    });
  });

  describe('LangChain compatibility', () => {
    it('should work with LangChain memory interface expectations', () => {
      memoryManager.addMessage(new HumanMessage('User input'));
      memoryManager.addMessage(new AIMessage('Assistant response'));
      
      const messages = memoryManager.getMessages();
      expect(messages).toHaveLength(2);
      expect(messages[0]._getType()).toBe('human');
      expect(messages[1]._getType()).toBe('ai');
    });

    it('should handle system messages appropriately', () => {
      const systemMsg = new SystemMessage('System instruction');
      memoryManager.addMessage(systemMsg);
      
      const messages = memoryManager.getMessages();
      expect(messages).toHaveLength(1);
      expect(messages[0]._getType()).toBe('system');
    });
  });

  describe('token management', () => {
    it('should stay within token limits', () => {
      for (let i = 0; i < 50; i++) {
        memoryManager.addMessage(new HumanMessage(`Message ${i} with some content to consume tokens`));
      }
      
      const stats = memoryManager.getMemoryStats();
      expect(stats.currentTokenCount).toBeLessThanOrEqual(stats.maxTokens);
    });

    it('should maintain reserve tokens', () => {
      while (memoryManager.getMemoryStats().remainingCapacity > 150) {
        memoryManager.addMessage(new HumanMessage('Filling memory with content'));
      }
      
      const stats = memoryManager.getMemoryStats();
      expect(stats.remainingCapacity).toBeGreaterThanOrEqual(0);
    });
  });

  describe('edge cases', () => {
    it('should handle empty messages', () => {
      const emptyMessage = new HumanMessage('');
      memoryManager.addMessage(emptyMessage);
      
      expect(memoryManager.getMessages()).toHaveLength(1);
    });

    it('should handle messages with special characters', () => {
      const specialMessage = new HumanMessage('Hello 世界! 🚀 @#$%');
      memoryManager.addMessage(specialMessage);
      
      const retrieved = memoryManager.getMessages();
      expect(retrieved[0].content).toBe('Hello 世界! 🚀 @#$%');
    });

    it('should handle rapid message addition', () => {
      const startTime = Date.now();
      
      for (let i = 0; i < 100; i++) {
        memoryManager.addMessage(new HumanMessage(`Rapid message ${i}`));
      }
      
      const endTime = Date.now();
      const duration = endTime - startTime;
      
      expect(duration).toBeLessThan(5000);
      expect(memoryManager.getMessages().length).toBeGreaterThan(0);
    });
  });

  describe('configuration updates', () => {
    it('should allow updating token limits', () => {
      const newConfig = {
        maxTokens: 2000,
        reserveTokens: 200
      };
      
      memoryManager.updateConfig(newConfig);
      
      const stats = memoryManager.getMemoryStats();
      expect(stats.maxTokens).toBe(2000);
    });

    it('should prune messages when limits are reduced', () => {
      for (let i = 0; i < 10; i++) {
        memoryManager.addMessage(new HumanMessage(`Test message ${i} with content`));
      }
      
      const initialCount = memoryManager.getMessages().length;
      
      memoryManager.updateConfig({
        maxTokens: 50,
        reserveTokens: 10
      });
      
      const finalCount = memoryManager.getMessages().length;
      expect(finalCount).toBeLessThan(initialCount);
    });
  });
});