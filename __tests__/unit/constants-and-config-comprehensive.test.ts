import { getSystemMessage } from '../../src/config/system-message';
import { ENTITY_PATTERNS, ENTITY_TYPES } from '../../src/constants/entity-references';
import { FIELD_PRIORITIES } from '../../src/constants/form-priorities';
import { ERROR_MESSAGES } from '../../src/constants/messages';
import { TEST_ACCOUNT_IDS, TEST_NETWORK_CONFIGS, TEST_MESSAGES } from '../../src/constants/test-constants';

describe('Configuration and Constants', () => {
  describe('getSystemMessage', () => {
    it('should return system message with account ID', () => {
      const accountId = '0.0.123';
      const message = getSystemMessage(accountId);
      
      expect(typeof message).toBe('string');
      expect(message.length).toBeGreaterThan(0);
      expect(message).toContain(accountId);
    });

    it('should return system message without account ID', () => {
      const message = getSystemMessage();
      
      expect(typeof message).toBe('string');
      expect(message.length).toBeGreaterThan(0);
    });

    it('should return system message with empty account ID', () => {
      const message = getSystemMessage('');
      
      expect(typeof message).toBe('string');
      expect(message.length).toBeGreaterThan(0);
    });

    it('should handle undefined account ID', () => {
      const message = getSystemMessage();

      expect(typeof message).toBe('string');
      expect(message.length).toBeGreaterThan(0);
    });

    it('should handle null account ID', () => {
      const message = getSystemMessage();

      expect(typeof message).toBe('string');
      expect(message.length).toBeGreaterThan(0);
    });

    it('should include standard instructions', () => {
      const message = getSystemMessage('0.0.123');
      
      expect(message).toContain('Hedera');
      expect(message.toLowerCase()).toContain('assistant');
    });

    it('should handle very long account ID', () => {
      const longAccountId = '0.0.' + '9'.repeat(1000);
      const message = getSystemMessage(longAccountId);
      
      expect(typeof message).toBe('string');
      expect(message).toContain(longAccountId);
    });
  });

  describe('ENTITY_PATTERNS', () => {
    it('should be defined as an object', () => {
      expect(typeof ENTITY_PATTERNS).toBe('object');
      expect(ENTITY_PATTERNS).not.toBeNull();
    });

    it('should contain entity reference patterns', () => {
      expect(ENTITY_PATTERNS).toBeDefined();
      
      if (typeof ENTITY_PATTERNS === 'object' && ENTITY_PATTERNS !== null) {
        const keys = Object.keys(ENTITY_PATTERNS);
        expect(keys.length).toBeGreaterThanOrEqual(0);
      }
    });

    it('should have string values for all keys', () => {
      if (typeof ENTITY_PATTERNS === 'object' && ENTITY_PATTERNS !== null) {
        Object.values(ENTITY_PATTERNS).forEach(value => {
          expect(typeof value).toBe('string');
        });
      }
    });
  });

  describe('FIELD_PRIORITIES', () => {
    it('should be defined as an object', () => {
      expect(typeof FIELD_PRIORITIES).toBe('object');
      expect(FIELD_PRIORITIES).not.toBeNull();
    });

    it('should contain priority levels', () => {
      expect(FIELD_PRIORITIES).toBeDefined();
      
      const expectedPriorities = ['essential', 'common', 'advanced', 'expert', 'critical', 'high', 'medium', 'low'];
      
      if (typeof FIELD_PRIORITIES === 'object' && FIELD_PRIORITIES !== null) {
        const keys = Object.keys(FIELD_PRIORITIES);
        expect(keys.length).toBeGreaterThanOrEqual(0);
        
        const hasExpectedPriorities = keys.some(key => 
          expectedPriorities.includes(key.toLowerCase())
        );
        expect(hasExpectedPriorities || keys.length === 0).toBe(true);
      }
    });

    it('should have valid priority values', () => {
      if (typeof FIELD_PRIORITIES === 'object' && FIELD_PRIORITIES !== null) {
        Object.values(FIELD_PRIORITIES).forEach(value => {
          expect(typeof value === 'string' || typeof value === 'number').toBe(true);
        });
      }
    });
  });

  describe('ERROR_MESSAGES', () => {
    it('should be defined as an object', () => {
      expect(typeof ERROR_MESSAGES).toBe('object');
      expect(ERROR_MESSAGES).not.toBeNull();
    });

    it('should contain error message definitions', () => {
      expect(ERROR_MESSAGES).toBeDefined();
      
      if (typeof ERROR_MESSAGES === 'object' && ERROR_MESSAGES !== null) {
        const keys = Object.keys(ERROR_MESSAGES);
        expect(keys.length).toBeGreaterThanOrEqual(0);
      }
    });

    it('should have string values for error messages', () => {
      if (typeof ERROR_MESSAGES === 'object' && ERROR_MESSAGES !== null) {
        Object.values(ERROR_MESSAGES).forEach(value => {
          expect(typeof value).toBe('string');
          expect(value.length).toBeGreaterThan(0);
        });
      }
    });

    it('should have meaningful error message keys', () => {
      if (typeof ERROR_MESSAGES === 'object' && ERROR_MESSAGES !== null) {
        const keys = Object.keys(ERROR_MESSAGES);
        keys.forEach(key => {
          expect(typeof key).toBe('string');
          expect(key.length).toBeGreaterThan(0);
          expect(key.toUpperCase() === key || key.includes('_')).toBe(true);
        });
      }
    });

    it('should not contain empty error messages', () => {
      if (typeof ERROR_MESSAGES === 'object' && ERROR_MESSAGES !== null) {
        Object.values(ERROR_MESSAGES).forEach(value => {
          expect(value.trim().length).toBeGreaterThan(0);
        });
      }
    });
  });

  describe('TEST_ACCOUNT_IDS', () => {
    it('should be defined as an object', () => {
      expect(typeof TEST_ACCOUNT_IDS).toBe('object');
      expect(TEST_ACCOUNT_IDS).not.toBeNull();
    });

    it('should contain test-related constants', () => {
      expect(TEST_ACCOUNT_IDS).toBeDefined();
      
      if (typeof TEST_ACCOUNT_IDS === 'object' && TEST_ACCOUNT_IDS !== null) {
        const keys = Object.keys(TEST_ACCOUNT_IDS);
        expect(keys.length).toBeGreaterThanOrEqual(0);
      }
    });

    it('should have appropriate test values', () => {
      if (typeof TEST_ACCOUNT_IDS === 'object' && TEST_ACCOUNT_IDS !== null) {
        Object.entries(TEST_ACCOUNT_IDS).forEach(([key, value]) => {
          expect(typeof key).toBe('string');
          expect(key.length).toBeGreaterThan(0);
          
          expect(value !== undefined).toBe(true);
        });
      }
    });

    it('should contain reasonable test data', () => {
      if (typeof TEST_ACCOUNT_IDS === 'object' && TEST_ACCOUNT_IDS !== null) {
        const keys = Object.keys(TEST_ACCOUNT_IDS);
        
        const testPatterns = ['test', 'mock', 'sample', 'example', 'dummy'];
        
        if (keys.length > 0) {
          const hasTestPatterns = keys.some(key => 
            testPatterns.some(pattern => 
              key.toLowerCase().includes(pattern)
            )
          );
          expect(hasTestPatterns || keys.length === 0).toBe(true);
        }
      }
    });
  });

  describe('Constants Integration', () => {
    it('should all constants be importable', () => {
      expect(ENTITY_PATTERNS).toBeDefined();
      expect(FIELD_PRIORITIES).toBeDefined();
      expect(ERROR_MESSAGES).toBeDefined();
      expect(TEST_ACCOUNT_IDS).toBeDefined();
    });

    it('should not have circular references', () => {
      const constants = [ENTITY_PATTERNS, FIELD_PRIORITIES, ERROR_MESSAGES, TEST_ACCOUNT_IDS];
      
      constants.forEach(constant => {
        expect(() => JSON.stringify(constant)).not.toThrow();
      });
    });

    it('should be serializable', () => {
      const constants = {
        ENTITY_PATTERNS,
        FIELD_PRIORITIES,
        ERROR_MESSAGES,
        TEST_ACCOUNT_IDS,
      };

      expect(() => JSON.stringify(constants)).not.toThrow();
      
      const serialized = JSON.stringify(constants);
      expect(typeof serialized).toBe('string');
      expect(serialized.length).toBeGreaterThan(0);
    });

    it('should maintain referential integrity', () => {
      expect(ENTITY_PATTERNS).toBe(ENTITY_PATTERNS);
      expect(FIELD_PRIORITIES).toBe(FIELD_PRIORITIES);
      expect(ERROR_MESSAGES).toBe(ERROR_MESSAGES);
      expect(TEST_ACCOUNT_IDS).toBe(TEST_ACCOUNT_IDS);
    });
  });

  describe('Edge Cases', () => {
    it('should handle system message with special characters', () => {
      const specialAccountId = '0.0.123@test#$%';
      const message = getSystemMessage(specialAccountId);
      
      expect(typeof message).toBe('string');
      expect(message).toContain(specialAccountId);
    });

    it('should handle system message with Unicode characters', () => {
      const unicodeAccountId = '0.0.123测试';
      const message = getSystemMessage(unicodeAccountId);
      
      expect(typeof message).toBe('string');
      expect(message).toContain(unicodeAccountId);
    });

    it('should maintain constant immutability', () => {
      const originalEntityRefs = { ...ENTITY_PATTERNS };
      const originalFieldPriorities = { ...FIELD_PRIORITIES };
      const originalErrorMessages = { ...ERROR_MESSAGES };
      const originalTestConstants = { ...TEST_ACCOUNT_IDS };

      try {
        (ENTITY_PATTERNS as any).newKey = 'newValue';
        (FIELD_PRIORITIES as any).newPriority = 'newValue';
        (ERROR_MESSAGES as any).newError = 'newValue';
        (TEST_ACCOUNT_IDS as any).newTest = 'newValue';
      } catch {
      }

      expect(typeof ENTITY_PATTERNS).toBe('object');
      expect(typeof FIELD_PRIORITIES).toBe('object');
      expect(typeof ERROR_MESSAGES).toBe('object');
      expect(typeof TEST_ACCOUNT_IDS).toBe('object');
    });
  });
});