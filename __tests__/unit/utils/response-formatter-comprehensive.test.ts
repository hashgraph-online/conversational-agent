import { describe, test, expect } from '@jest/globals';
import { ResponseFormatter } from '../../../src/utils/response-formatter';

/**
 * Comprehensive tests for ResponseFormatter
 * Tests all edge cases and formatting scenarios
 */

describe('ResponseFormatter Comprehensive Tests', () => {
  describe('isHashLinkResponse', () => {
    test('should return true for valid HashLink response', () => {
      const validResponse = {
        success: true,
        type: 'inscription',
        hashLinkBlock: {
          blockId: 'test-block-id',
          hashLink: 'test-hash-link',
        },
      };

      expect(ResponseFormatter.isHashLinkResponse(validResponse)).toBe(true);
    });

    test('should return false for non-object inputs', () => {
      const nonObjectInputs = [null, undefined, 'string', 123, true, []];

      nonObjectInputs.forEach(input => {
        expect(ResponseFormatter.isHashLinkResponse(input)).toBe(false);
      });
    });

    test('should return false when success is not true', () => {
      const responses = [
        { success: false, type: 'inscription', hashLinkBlock: {} },
        { success: 'true', type: 'inscription', hashLinkBlock: {} },
        { success: undefined, type: 'inscription', hashLinkBlock: {} },
        { type: 'inscription', hashLinkBlock: {} },
      ];

      responses.forEach(response => {
        expect(ResponseFormatter.isHashLinkResponse(response)).toBe(false);
      });
    });

    test('should return false when type is not inscription', () => {
      const responses = [
        { success: true, type: 'other', hashLinkBlock: {} },
        { success: true, type: null, hashLinkBlock: {} },
        { success: true, hashLinkBlock: {} },
      ];

      responses.forEach(response => {
        expect(ResponseFormatter.isHashLinkResponse(response)).toBe(false);
      });
    });

    test('should return false when hashLinkBlock is missing or invalid', () => {
      const responses = [
        { success: true, type: 'inscription' },
        { success: true, type: 'inscription', hashLinkBlock: null },
        { success: true, type: 'inscription', hashLinkBlock: 'string' },
        { success: true, type: 'inscription', hashLinkBlock: 123 },
      ];

      responses.forEach(response => {
        expect(ResponseFormatter.isHashLinkResponse(response)).toBe(false);
      });
    });
  });

  describe('formatHashLinkResponse', () => {
    test('should format complete HashLink response', () => {
      const response = {
        hashLinkBlock: {
          blockId: 'test-block-id',
          attributes: {
            topicId: '0.0.123',
            hrl: 'hrl://test-hrl',
          },
        },
        metadata: {
          name: 'Test Block',
          description: 'A test block description',
          creator: 'test-creator',
        },
        inscription: {
          topicId: '0.0.456',
          hrl: 'hrl://inscription-hrl',
          cdnUrl: 'https://cdn.example.com/content',
        },
      };

      const result = ResponseFormatter.formatHashLinkResponse(response);

      expect(result).toContain('✅ Interactive content created successfully!');
      expect(result).toContain('**Test Block**');
      expect(result).toContain('A test block description');
      expect(result).toContain('📍 **Topic ID:** 0.0.456');
      expect(result).toContain('🔗 **HRL:** hrl://inscription-hrl');
      expect(result).toContain('🌐 **CDN URL:** https://cdn.example.com/content');
      expect(result).toContain('👤 **Creator:** test-creator');
      expect(result).toContain('⚡ Interactive content will load below');
    });

    test('should handle missing metadata gracefully', () => {
      const response = {
        hashLinkBlock: {
          attributes: {
            topicId: '0.0.123',
          },
        },
      };

      const result = ResponseFormatter.formatHashLinkResponse(response);

      expect(result).toContain('✅ Interactive content created successfully!');
      expect(result).toContain('📍 **Topic ID:** 0.0.123');
      expect(result).toContain('⚡ Interactive content will load below');
    });

    test('should handle missing inscription gracefully', () => {
      const response = {
        hashLinkBlock: {
          attributes: {
            topicId: '0.0.123',
            hrl: 'hrl://block-hrl',
          },
        },
        metadata: {
          name: 'Test Block',
        },
      };

      const result = ResponseFormatter.formatHashLinkResponse(response);

      expect(result).toContain('**Test Block**');
      expect(result).toContain('📍 **Topic ID:** 0.0.123');
      expect(result).toContain('🔗 **HRL:** hrl://block-hrl');
    });

    test('should prioritize inscription values over block attributes', () => {
      const response = {
        hashLinkBlock: {
          attributes: {
            topicId: '0.0.block',
            hrl: 'hrl://block',
          },
        },
        inscription: {
          topicId: '0.0.inscription',
          hrl: 'hrl://inscription',
        },
      };

      const result = ResponseFormatter.formatHashLinkResponse(response);

      expect(result).toContain('📍 **Topic ID:** 0.0.inscription');
      expect(result).toContain('🔗 **HRL:** hrl://inscription');
    });

    test('should fallback to block attributes when inscription values are missing', () => {
      const response = {
        hashLinkBlock: {
          attributes: {
            topicId: '0.0.block',
            hrl: 'hrl://block',
          },
        },
        inscription: {
          cdnUrl: 'https://cdn.example.com',
        },
      };

      const result = ResponseFormatter.formatHashLinkResponse(response);

      expect(result).toContain('📍 **Topic ID:** 0.0.block');
      expect(result).toContain('🔗 **HRL:** hrl://block');
      expect(result).toContain('🌐 **CDN URL:** https://cdn.example.com');
    });

    test('should handle empty objects gracefully', () => {
      const response = {
        hashLinkBlock: { attributes: {} },
        metadata: {},
        inscription: {},
      };

      const result = ResponseFormatter.formatHashLinkResponse(response);

      expect(result).toBe('✅ Interactive content created successfully!\n\n\n⚡ Interactive content will load below');
    });
  });

  describe('isInscriptionResponse', () => {
    test('should return true for valid inscription response', () => {
      const validResponse = {
        success: true,
        type: 'inscription',
        inscription: {
          topicId: '0.0.123',
        },
      };

      expect(ResponseFormatter.isInscriptionResponse(validResponse)).toBe(true);
    });

    test('should return false for non-object inputs', () => {
      const nonObjectInputs = [null, undefined, 'string', 123, true, []];

      nonObjectInputs.forEach(input => {
        expect(ResponseFormatter.isInscriptionResponse(input)).toBe(false);
      });
    });

    test('should return false when success is not true', () => {
      const responses = [
        { success: false, type: 'inscription', inscription: {} },
        { success: 'true', type: 'inscription', inscription: {} },
        { type: 'inscription', inscription: {} },
      ];

      responses.forEach(response => {
        expect(ResponseFormatter.isInscriptionResponse(response)).toBe(false);
      });
    });

    test('should return false when type is not inscription', () => {
      const responses = [
        { success: true, type: 'other', inscription: {} },
        { success: true, inscription: {} },
      ];

      responses.forEach(response => {
        expect(ResponseFormatter.isInscriptionResponse(response)).toBe(false);
      });
    });

    test('should return false when inscription is missing or invalid', () => {
      const responses = [
        { success: true, type: 'inscription' },
        { success: true, type: 'inscription', inscription: null },
        { success: true, type: 'inscription', inscription: 'string' },
        { success: true, type: 'inscription', inscription: 123 },
      ];

      responses.forEach(response => {
        expect(ResponseFormatter.isInscriptionResponse(response)).toBe(false);
      });
    });
  });

  describe('formatInscriptionResponse', () => {
    test('should format complete inscription response', () => {
      const response = {
        inscription: {
          topicId: '0.0.123',
          hrl: 'hrl://test-hrl',
          cdnUrl: 'https://cdn.example.com/content',
        },
        metadata: {
          name: 'Test Inscription',
          description: 'A test inscription description',
          creator: 'test-creator',
        },
        title: 'Custom Title',
      };

      const result = ResponseFormatter.formatInscriptionResponse(response);

      expect(result).toContain('✅ Custom Title');
      expect(result).toContain('**Test Inscription**');
      expect(result).toContain('A test inscription description');
      expect(result).toContain('📍 **Topic ID:** 0.0.123');
      expect(result).toContain('🔗 **HRL:** hrl://test-hrl');
      expect(result).toContain('🌐 **CDN URL:** https://cdn.example.com/content');
      expect(result).toContain('👤 **Creator:** test-creator');
    });

    test('should use default title when not provided', () => {
      const response = {
        inscription: {
          topicId: '0.0.123',
        },
      };

      const result = ResponseFormatter.formatInscriptionResponse(response);

      expect(result).toContain('✅ Inscription Complete');
    });

    test('should handle missing metadata gracefully', () => {
      const response = {
        inscription: {
          topicId: '0.0.123',
        },
      };

      const result = ResponseFormatter.formatInscriptionResponse(response);

      expect(result).toContain('✅ Inscription Complete');
      expect(result).toContain('📍 **Topic ID:** 0.0.123');
    });

    test('should handle missing inscription properties gracefully', () => {
      const response = {
        inscription: {},
        metadata: {
          name: 'Test',
        },
      };

      const result = ResponseFormatter.formatInscriptionResponse(response);

      expect(result).toContain('**Test**');
      expect(result).not.toContain('📍 **Topic ID:**');
      expect(result).not.toContain('🔗 **HRL:**');
      expect(result).not.toContain('🌐 **CDN URL:**');
    });

    test('should handle empty title string', () => {
      const response = {
        inscription: {},
        title: '',
      };

      const result = ResponseFormatter.formatInscriptionResponse(response);

      expect(result).toContain('✅ Inscription Complete');
    });
  });

  describe('formatResponse', () => {
    test('should format valid JSON HashLink response', () => {
      const jsonResponse = JSON.stringify({
        success: true,
        type: 'inscription',
        hashLinkBlock: {
          attributes: { topicId: '0.0.123' },
        },
        metadata: { name: 'Test Block' },
      });

      const result = ResponseFormatter.formatResponse(jsonResponse);

      expect(result).toContain('✅ Interactive content created successfully!');
      expect(result).toContain('**Test Block**');
    });

    test('should format valid JSON inscription response', () => {
      const jsonResponse = JSON.stringify({
        success: true,
        type: 'inscription',
        inscription: {
          topicId: '0.0.123',
        },
        metadata: { name: 'Test Inscription' },
      });

      const result = ResponseFormatter.formatResponse(jsonResponse);

      expect(result).toContain('✅ Inscription Complete');
      expect(result).toContain('**Test Inscription**');
    });

    test('should return original string for non-special JSON', () => {
      const jsonResponse = JSON.stringify({
        success: true,
        type: 'other',
        data: 'some data',
      });

      const result = ResponseFormatter.formatResponse(jsonResponse);

      expect(result).toBe(jsonResponse);
    });

    test('should return original string for invalid JSON', () => {
      const invalidJson = 'This is not JSON';

      const result = ResponseFormatter.formatResponse(invalidJson);

      expect(result).toBe(invalidJson);
    });

    test('should handle malformed JSON gracefully', () => {
      const malformedJson = '{"invalid": json}';

      const result = ResponseFormatter.formatResponse(malformedJson);

      expect(result).toBe(malformedJson);
    });

    test('should handle empty string input', () => {
      const result = ResponseFormatter.formatResponse('');

      expect(result).toBe('');
    });

    test('should handle JSON with syntax errors', () => {
      const syntaxErrorJson = '{"missing": "closing brace"';

      const result = ResponseFormatter.formatResponse(syntaxErrorJson);

      expect(result).toBe(syntaxErrorJson);
    });
  });

  describe('Edge cases and error handling', () => {
    test('should handle null values in response objects', () => {
      const responseWithNulls = {
        hashLinkBlock: {
          attributes: {
            topicId: null,
            hrl: null,
          },
        },
        metadata: {
          name: null,
          description: null,
          creator: null,
        },
        inscription: {
          topicId: null,
          hrl: null,
          cdnUrl: null,
        },
      };

      const result = ResponseFormatter.formatHashLinkResponse(responseWithNulls);

      expect(result).toContain('✅ Interactive content created successfully!');
      expect(result).toContain('⚡ Interactive content will load below');
    });

    test('should handle undefined values in response objects', () => {
      const responseWithUndefined = {
        hashLinkBlock: {
          attributes: {
            topicId: undefined,
            hrl: undefined,
          },
        },
        metadata: {
          name: undefined,
          description: undefined,
          creator: undefined,
        },
        inscription: {
          topicId: undefined,
          hrl: undefined,
          cdnUrl: undefined,
        },
      };

      const result = ResponseFormatter.formatHashLinkResponse(responseWithUndefined);

      expect(result).toContain('✅ Interactive content created successfully!');
      expect(result).toContain('⚡ Interactive content will load below');
    });

    test('should prioritize inscription over hashLinkBlock when both have the same property', () => {
      const response = {
        hashLinkBlock: {
          attributes: {
            topicId: 'block-topic',
            hrl: 'block-hrl',
          },
        },
        inscription: {
          topicId: 'inscription-topic',
          hrl: 'inscription-hrl',
        },
      };

      const result = ResponseFormatter.formatHashLinkResponse(response);

      expect(result).toContain('inscription-topic');
      expect(result).toContain('inscription-hrl');
      expect(result).not.toContain('block-topic');
      expect(result).not.toContain('block-hrl');
    });

    test('should handle very long strings in response', () => {
      const longString = 'a'.repeat(10000);
      const response = {
        inscription: {
          topicId: longString,
          hrl: longString,
          cdnUrl: longString,
        },
        metadata: {
          name: longString,
          description: longString,
          creator: longString,
        },
      };

      const result = ResponseFormatter.formatInscriptionResponse(response);

      expect(result).toContain(longString);
      expect(result.length).toBeGreaterThan(50000);
    });
  });
});