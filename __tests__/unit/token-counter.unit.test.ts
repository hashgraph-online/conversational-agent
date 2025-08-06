import { TokenCounter } from '../../src/memory/TokenCounter';
import type { BaseMessage } from '@langchain/core/messages';
import { HumanMessage, AIMessage } from '@langchain/core/messages';

describe('TokenCounter', () => {
  let tokenCounter: TokenCounter;

  beforeEach(() => {
    tokenCounter = new TokenCounter('gpt-4o');
  });

  describe('constructor', () => {
    it('should initialize with default model', () => {
      const counter = new TokenCounter();
      expect(counter).toBeInstanceOf(TokenCounter);
    });

    it('should initialize with specific model', () => {
      const counter = new TokenCounter('gpt-3.5-turbo');
      expect(counter).toBeInstanceOf(TokenCounter);
    });
  });

  describe('countTokens', () => {
    it('should count tokens in simple text', () => {
      const text = 'Hello world';
      const count = tokenCounter.countTokens(text);
      expect(count).toBeGreaterThan(0);
      expect(typeof count).toBe('number');
    });

    it('should count tokens in complex text with multiple words', () => {
      const text = 'This is a longer piece of text with multiple words and punctuation.';
      const count = tokenCounter.countTokens(text);
      expect(count).toBeGreaterThan(5);
    });

    it('should handle empty string', () => {
      const count = tokenCounter.countTokens('');
      expect(count).toBe(0);
    });

    it('should handle special characters and Unicode', () => {
      const text = 'Hello 世界! 🚀 This is a test with émojis and special chars: @#$%';
      const count = tokenCounter.countTokens(text);
      expect(count).toBeGreaterThan(0);
    });
  });

  describe('countMessageTokens', () => {
    it('should count tokens in human message', () => {
      const message = new HumanMessage('Hello, how are you?');
      const count = tokenCounter.countMessageTokens(message);
      expect(count).toBeGreaterThan(0);
    });

    it('should count tokens in AI message', () => {
      const message = new AIMessage('I am doing well, thank you for asking!');
      const count = tokenCounter.countMessageTokens(message);
      expect(count).toBeGreaterThan(0);
    });

    it('should include message overhead in token count', () => {
      const shortContent = 'Hi';
      const message = new HumanMessage(shortContent);
      const contentTokens = tokenCounter.countTokens(shortContent);
      const messageTokens = tokenCounter.countMessageTokens(message);
      
      // Message should have more tokens due to role and formatting overhead
      expect(messageTokens).toBeGreaterThan(contentTokens);
    });

    it('should handle messages with different roles differently', () => {
      const content = 'This is the same content';
      const humanMessage = new HumanMessage(content);
      const aiMessage = new AIMessage(content);
      
      const humanTokens = tokenCounter.countMessageTokens(humanMessage);
      const aiTokens = tokenCounter.countMessageTokens(aiMessage);
      
      // Both should be greater than 0, might differ based on role overhead
      expect(humanTokens).toBeGreaterThan(0);
      expect(aiTokens).toBeGreaterThan(0);
    });
  });

  describe('countMessagesTokens', () => {
    it('should count tokens for multiple messages', () => {
      const messages: BaseMessage[] = [
        new HumanMessage('Hello'),
        new AIMessage('Hi there!'),
        new HumanMessage('How are you?'),
        new AIMessage('I am doing well, thank you!')
      ];
      
      const totalCount = tokenCounter.countMessagesTokens(messages);
      expect(totalCount).toBeGreaterThan(0);
      
      // Verify it's the sum of individual messages
      const individualSum = messages.reduce((sum, msg) => 
        sum + tokenCounter.countMessageTokens(msg), 0
      );
      expect(totalCount).toBe(individualSum);
    });

    it('should return 0 for empty messages array', () => {
      const count = tokenCounter.countMessagesTokens([]);
      expect(count).toBe(0);
    });

    it('should handle large conversation history', () => {
      const messages: BaseMessage[] = [];
      for (let i = 0; i < 100; i++) {
        messages.push(new HumanMessage(`User message ${i} with some content`));
        messages.push(new AIMessage(`AI response ${i} with detailed explanation and multiple sentences.`));
      }
      
      const totalCount = tokenCounter.countMessagesTokens(messages);
      expect(totalCount).toBeGreaterThan(1000); // Should be substantial for 200 messages
    });
  });

  describe('estimateSystemPromptTokens', () => {
    it('should estimate tokens for system prompt', () => {
      const systemPrompt = 'You are a helpful assistant. Please respond thoughtfully and accurately.';
      const count = tokenCounter.estimateSystemPromptTokens(systemPrompt);
      expect(count).toBeGreaterThan(0);
    });

    it('should handle empty system prompt', () => {
      const count = tokenCounter.estimateSystemPromptTokens('');
      expect(count).toBe(0);
    });

    it('should estimate more tokens for longer system prompts', () => {
      const shortPrompt = 'Be helpful.';
      const longPrompt = 'You are a sophisticated AI assistant specialized in Hedera network operations. You have access to various tools for blockchain interactions including token transfers, topic management, and smart contract operations. Always provide accurate and detailed responses while being mindful of transaction costs and security implications.';
      
      const shortCount = tokenCounter.estimateSystemPromptTokens(shortPrompt);
      const longCount = tokenCounter.estimateSystemPromptTokens(longPrompt);
      
      expect(longCount).toBeGreaterThan(shortCount);
    });
  });

  describe('model compatibility', () => {
    it('should work with different OpenAI models', () => {
      const models = ['gpt-4o', 'gpt-4o-mini', 'gpt-3.5-turbo', 'gpt-4'];
      
      models.forEach(model => {
        const counter = new TokenCounter(model);
        const count = counter.countTokens('Test message');
        expect(count).toBeGreaterThan(0);
      });
    });
  });

  describe('edge cases', () => {
    it('should handle very long text', () => {
      const longText = 'a'.repeat(10000);
      const count = tokenCounter.countTokens(longText);
      expect(count).toBeGreaterThan(1000);
    });

    it('should handle text with only whitespace', () => {
      const whitespaceText = '   \n\t  \r\n  ';
      const count = tokenCounter.countTokens(whitespaceText);
      expect(count).toBeGreaterThanOrEqual(0);
    });

    it('should handle mixed content types', () => {
      const mixedContent = 'Regular text 123 @#$% 世界 🌍 {"json": "data"} https://example.com';
      const count = tokenCounter.countTokens(mixedContent);
      expect(count).toBeGreaterThan(0);
    });
  });
});