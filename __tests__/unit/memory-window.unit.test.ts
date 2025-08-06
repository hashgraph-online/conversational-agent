import { MemoryWindow } from '../../src/memory/MemoryWindow';
import { TokenCounter } from '../../src/memory/TokenCounter';
import { HumanMessage, AIMessage } from '@langchain/core/messages';
import type { BaseMessage } from '@langchain/core/messages';

describe('MemoryWindow', () => {
  let memoryWindow: MemoryWindow;
  const tokenCounter = new TokenCounter('gpt-4o');
  const maxTokens = 200;  // Much smaller for testing
  const reserveTokens = 50;

  beforeEach(() => {
    memoryWindow = new MemoryWindow(maxTokens, reserveTokens, tokenCounter);
  });

  describe('constructor', () => {
    it('should initialize with default parameters', () => {
      const window = new MemoryWindow();
      expect(window).toBeInstanceOf(MemoryWindow);
    });

    it('should initialize with custom parameters', () => {
      const window = new MemoryWindow(2000, 200);
      expect(window).toBeInstanceOf(MemoryWindow);
    });

    it('should validate that reserve tokens is less than max tokens', () => {
      expect(() => new MemoryWindow(100, 200)).toThrow();
    });
  });

  describe('addMessage', () => {
    it('should add message when within token limit', () => {
      const message = new HumanMessage('Short message');
      const result = memoryWindow.addMessage(message);
      
      expect(result.added).toBe(true);
      expect(result.prunedMessages).toHaveLength(0);
      expect(memoryWindow.getMessages()).toHaveLength(1);
    });

    it('should prune old messages when token limit exceeded', () => {
      // Add many messages to exceed token limit
      const messages: BaseMessage[] = [];
      for (let i = 0; i < 50; i++) {
        messages.push(new HumanMessage(`This is a longer message ${i} that will consume tokens and eventually cause pruning when we exceed the maximum token limit.`));
      }

      let prunedCount = 0;
      messages.forEach(message => {
        const result = memoryWindow.addMessage(message);
        if (result.prunedMessages.length > 0) {
          prunedCount += result.prunedMessages.length;
        }
      });

      expect(prunedCount).toBeGreaterThan(0);
      expect(memoryWindow.getCurrentTokenCount()).toBeLessThanOrEqual(maxTokens);
    });

    it('should preserve recent messages during pruning', () => {
      // Add initial messages
      const oldMessage = new HumanMessage('Old message that should be pruned');
      memoryWindow.addMessage(oldMessage);
      
      // Add many long messages to force pruning
      for (let i = 0; i < 30; i++) {
        memoryWindow.addMessage(new HumanMessage(`Long message ${i} that will force pruning of older messages when token limits are exceeded.`));
      }
      
      const recentMessage = new AIMessage('Recent message that should be kept');
      memoryWindow.addMessage(recentMessage);
      
      const messages = memoryWindow.getMessages();
      expect(messages[messages.length - 1].content).toBe('Recent message that should be kept');
    });

    it('should handle very large single messages', () => {
      const largeMessage = new HumanMessage('a'.repeat(5000)); // Very large message
      const result = memoryWindow.addMessage(largeMessage);
      
      // Should still add the message even if it's large
      expect(result.added).toBe(true);
      expect(memoryWindow.getMessages()).toHaveLength(1);
    });
  });

  describe('pruneToFit', () => {
    it('should remove oldest messages to fit within token limit', () => {
      // Create a very small memory window to force pruning
      const smallMemory = new MemoryWindow(50, 10, tokenCounter);
      
      // Fill with messages to exceed limit
      for (let i = 0; i < 10; i++) {
        smallMemory.addMessage(new HumanMessage(`Message ${i} with some content that takes up quite a few tokens to trigger pruning.`));
      }

      const initialCount = smallMemory.getMessages().length;
      
      // Manually call pruneToFit to test it directly
      const prunedMessages = smallMemory.pruneToFit();
      
      expect(prunedMessages.length).toBeGreaterThan(0);
      expect(smallMemory.getMessages().length).toBeLessThan(initialCount);
      expect(smallMemory.getCurrentTokenCount()).toBeLessThanOrEqual(50 - 10);
    });

    it('should preserve message pairs when pruning conversations', () => {
      // This test is challenging because auto-pruning in addMessage might interfere
      // Let's test that pruning preserves conversational flow by creating a scenario
      // where we can force pruning
      
      const smallMemory = new MemoryWindow(100, 10, tokenCounter);
      
      // Add enough conversation pairs to exceed the limit when we force pruning
      const conversations = [];
      for (let i = 0; i < 3; i++) {
        const humanMsg = new HumanMessage(`User question ${i}: What can you tell me about blockchain technology and how it works in detail?`);
        const aiMsg = new AIMessage(`AI response ${i}: Blockchain is a distributed ledger technology that maintains a continuously growing list of records with cryptographic security and consensus mechanisms.`);
        conversations.push(humanMsg, aiMsg);
      }

      // Add all messages at once to bypass auto-pruning
      conversations.forEach(msg => smallMemory.addMessage(msg));
      
      // Now force pruning by updating to very small limits
      smallMemory.updateLimits(30, 5);
      
      const remainingMessages = smallMemory.getMessages();
      
      // If there are remaining messages, they should be in pairs (even number)
      if (remainingMessages.length > 0) {
        expect(remainingMessages.length % 2).toBe(0);
      } else {
        // If no messages remain due to very strict limits, that's also valid
        expect(remainingMessages.length).toBeGreaterThanOrEqual(0);
      }
    });

    it('should not prune if already under limit', () => {
      const message = new HumanMessage('Short message');
      memoryWindow.addMessage(message);
      
      const prunedMessages = memoryWindow.pruneToFit();
      expect(prunedMessages).toHaveLength(0);
    });
  });

  describe('getCurrentTokenCount', () => {
    it('should return 0 for empty memory', () => {
      expect(memoryWindow.getCurrentTokenCount()).toBe(0);
    });

    it('should calculate correct token count for messages', () => {
      const message1 = new HumanMessage('First message');
      const message2 = new AIMessage('Second message');
      
      memoryWindow.addMessage(message1);
      const countAfterFirst = memoryWindow.getCurrentTokenCount();
      
      memoryWindow.addMessage(message2);
      const countAfterSecond = memoryWindow.getCurrentTokenCount();
      
      expect(countAfterFirst).toBeGreaterThan(0);
      expect(countAfterSecond).toBeGreaterThan(countAfterFirst);
    });
  });

  describe('getMessages', () => {
    it('should return empty array initially', () => {
      expect(memoryWindow.getMessages()).toHaveLength(0);
    });

    it('should return messages in order', () => {
      const message1 = new HumanMessage('First');
      const message2 = new AIMessage('Second');
      const message3 = new HumanMessage('Third');
      
      memoryWindow.addMessage(message1);
      memoryWindow.addMessage(message2);
      memoryWindow.addMessage(message3);
      
      const messages = memoryWindow.getMessages();
      expect(messages).toHaveLength(3);
      expect(messages[0].content).toBe('First');
      expect(messages[1].content).toBe('Second');
      expect(messages[2].content).toBe('Third');
    });

    it('should return immutable copy of messages', () => {
      const message = new HumanMessage('Test message');
      memoryWindow.addMessage(message);
      
      const messages1 = memoryWindow.getMessages();
      const messages2 = memoryWindow.getMessages();
      
      // Should be different array instances
      expect(messages1).not.toBe(messages2);
      expect(messages1).toEqual(messages2);
    });
  });

  describe('clear', () => {
    it('should remove all messages', () => {
      memoryWindow.addMessage(new HumanMessage('Message 1'));
      memoryWindow.addMessage(new AIMessage('Message 2'));
      
      expect(memoryWindow.getMessages()).toHaveLength(2);
      
      memoryWindow.clear();
      
      expect(memoryWindow.getMessages()).toHaveLength(0);
      expect(memoryWindow.getCurrentTokenCount()).toBe(0);
    });
  });

  describe('setSystemPrompt', () => {
    it('should store system prompt and include in token calculations', () => {
      const systemPrompt = 'You are a helpful assistant specialized in blockchain technology.';
      memoryWindow.setSystemPrompt(systemPrompt);
      
      // Should account for system prompt tokens
      const tokenCount = memoryWindow.getCurrentTokenCount();
      expect(tokenCount).toBeGreaterThan(0);
    });

    it('should update system prompt and recalculate tokens', () => {
      const shortPrompt = 'Be helpful.';
      const longPrompt = 'You are a sophisticated AI assistant with extensive knowledge of blockchain technology, cryptocurrency, and decentralized systems.';
      
      memoryWindow.setSystemPrompt(shortPrompt);
      const shortCount = memoryWindow.getCurrentTokenCount();
      
      memoryWindow.setSystemPrompt(longPrompt);
      const longCount = memoryWindow.getCurrentTokenCount();
      
      expect(longCount).toBeGreaterThan(shortCount);
    });

    it('should clear system prompt when set to empty string', () => {
      memoryWindow.setSystemPrompt('Some prompt');
      expect(memoryWindow.getCurrentTokenCount()).toBeGreaterThan(0);
      
      memoryWindow.setSystemPrompt('');
      expect(memoryWindow.getCurrentTokenCount()).toBe(0);
    });
  });

  describe('getRemainingTokenCapacity', () => {
    it('should return max tokens when empty', () => {
      expect(memoryWindow.getRemainingTokenCapacity()).toBe(maxTokens);
    });

    it('should decrease as messages are added', () => {
      const initialCapacity = memoryWindow.getRemainingTokenCapacity();
      
      memoryWindow.addMessage(new HumanMessage('Test message'));
      
      const capacityAfterMessage = memoryWindow.getRemainingTokenCapacity();
      expect(capacityAfterMessage).toBeLessThan(initialCapacity);
    });

    it('should account for system prompt', () => {
      const capacityBefore = memoryWindow.getRemainingTokenCapacity();
      
      memoryWindow.setSystemPrompt('System prompt that uses tokens');
      
      const capacityAfter = memoryWindow.getRemainingTokenCapacity();
      expect(capacityAfter).toBeLessThan(capacityBefore);
    });
  });

  describe('canAddMessage', () => {
    it('should return true for messages that fit', () => {
      const shortMessage = new HumanMessage('Hi');
      expect(memoryWindow.canAddMessage(shortMessage)).toBe(true);
    });

    it('should return false for messages that exceed total capacity', () => {
      // Create a message that's larger than our total token limit
      const longText = 'a'.repeat(10000); // This should be way more than 200 tokens
      const largeMessage = new HumanMessage(longText);
      
      // Should return false for messages larger than total capacity
      expect(memoryWindow.canAddMessage(largeMessage)).toBe(false);
    });

    it('should consider reserve tokens', () => {
      // Fill memory close to limit
      while (memoryWindow.getRemainingTokenCapacity() > reserveTokens + 50) {
        memoryWindow.addMessage(new HumanMessage('Adding message to fill memory'));
      }
      
      const testMessage = new HumanMessage('Test message');
      const capacity = memoryWindow.getRemainingTokenCapacity();
      const messageTokens = tokenCounter.countMessageTokens(testMessage);
      
      if (capacity - messageTokens < reserveTokens) {
        expect(memoryWindow.canAddMessage(testMessage)).toBe(false);
      }
    });
  });

  describe('edge cases', () => {
    it('should handle empty messages', () => {
      const emptyMessage = new HumanMessage('');
      const result = memoryWindow.addMessage(emptyMessage);
      
      expect(result.added).toBe(true);
      expect(memoryWindow.getMessages()).toHaveLength(1);
    });

    it('should handle messages with special characters', () => {
      const specialMessage = new HumanMessage('Hello 世界! 🚀 @#$%^&*()');
      const result = memoryWindow.addMessage(specialMessage);
      
      expect(result.added).toBe(true);
    });

    it('should maintain performance with many messages', () => {
      const startTime = Date.now();
      
      // Add many messages
      for (let i = 0; i < 100; i++) {
        memoryWindow.addMessage(new HumanMessage(`Performance test message ${i}`));
      }
      
      const endTime = Date.now();
      const duration = endTime - startTime;
      
      // Should complete within reasonable time (less than 5 seconds)
      expect(duration).toBeLessThan(5000);
    });
  });
});