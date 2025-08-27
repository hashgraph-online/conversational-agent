import { ResponseFormatter } from '@/utils/response-formatter';

describe('ResponseFormatter', () => {
  describe('isHashLinkResponse', () => {
    it('should return true for valid HashLink response', () => {
      const validResponse = {
        success: true,
        type: 'inscription',
        hashLinkBlock: {
          blockId: 'test-block',
          hashLink: 'test-link',
          template: 'test-template',
          attributes: {}
        }
      };

      expect(ResponseFormatter.isHashLinkResponse(validResponse)).toBe(true);
    });

    it('should return false for null or undefined', () => {
      expect(ResponseFormatter.isHashLinkResponse(null)).toBe(false);
      expect(ResponseFormatter.isHashLinkResponse(undefined)).toBe(false);
    });

    it('should return false for non-object types', () => {
      expect(ResponseFormatter.isHashLinkResponse('string')).toBe(false);
      expect(ResponseFormatter.isHashLinkResponse(123)).toBe(false);
      expect(ResponseFormatter.isHashLinkResponse(true)).toBe(false);
    });

    it('should return false when success is not true', () => {
      const response = {
        success: false,
        type: 'inscription',
        hashLinkBlock: {}
      };

      expect(ResponseFormatter.isHashLinkResponse(response)).toBe(false);
    });

    it('should return false when type is not inscription', () => {
      const response = {
        success: true,
        type: 'other',
        hashLinkBlock: {}
      };

      expect(ResponseFormatter.isHashLinkResponse(response)).toBe(false);
    });

    it('should return false when hashLinkBlock is missing', () => {
      const response = {
        success: true,
        type: 'inscription'
      };

      expect(ResponseFormatter.isHashLinkResponse(response)).toBe(false);
    });

    it('should return false when hashLinkBlock is not an object', () => {
      const response = {
        success: true,
        type: 'inscription',
        hashLinkBlock: 'not-an-object'
      };

      expect(ResponseFormatter.isHashLinkResponse(response)).toBe(false);
    });
  });

  describe('formatHashLinkResponse', () => {
    it('should format minimal HashLink response', () => {
      const response = {
        hashLinkBlock: {
          blockId: 'test-block',
          hashLink: 'test-link',
          template: 'test-template',
          attributes: {}
        }
      };

      const result = ResponseFormatter.formatHashLinkResponse(response);
      expect(result).toContain('✅ Interactive content created successfully!');
      expect(result).toContain('⚡ Interactive content will load below');
    });

    it('should format complete HashLink response with all fields', () => {
      const response = {
        hashLinkBlock: {
          blockId: 'test-block',
          hashLink: 'test-link',
          template: 'test-template',
          attributes: {
            topicId: '0.0.123456',
            hrl: 'hcs://testnet/0.0.123456@123456789'
          }
        },
        metadata: {
          name: 'Test Interactive Content',
          description: 'Test description for interactive content',
          creator: '0.0.987654'
        },
        inscription: {
          topicId: '0.0.654321',
          hrl: 'hcs://testnet/0.0.654321@987654321',
          cdnUrl: 'https://cdn.test.com/content'
        }
      };

      const result = ResponseFormatter.formatHashLinkResponse(response);
      
      expect(result).toContain('✅ Interactive content created successfully!');
      expect(result).toContain('**Test Interactive Content**');
      expect(result).toContain('Test description for interactive content');
      expect(result).toContain('📍 **Topic ID:** 0.0.654321');
      expect(result).toContain('🔗 **HRL:** hcs://testnet/0.0.654321@987654321');
      expect(result).toContain('🌐 **CDN URL:** https://cdn.test.com/content');
      expect(result).toContain('👤 **Creator:** 0.0.987654');
      expect(result).toContain('⚡ Interactive content will load below');
    });

    it('should prioritize inscription data over hashLinkBlock attributes', () => {
      const response = {
        hashLinkBlock: {
          attributes: {
            topicId: '0.0.111111',
            hrl: 'hcs://testnet/0.0.111111@111111111'
          }
        },
        inscription: {
          topicId: '0.0.222222',
          hrl: 'hcs://testnet/0.0.222222@222222222'
        }
      };

      const result = ResponseFormatter.formatHashLinkResponse(response);
      
      expect(result).toContain('0.0.222222');
      expect(result).toContain('hcs://testnet/0.0.222222@222222222');
      expect(result).not.toContain('0.0.111111');
    });

    it('should use hashLinkBlock attributes as fallback', () => {
      const response = {
        hashLinkBlock: {
          attributes: {
            topicId: '0.0.333333',
            hrl: 'hcs://testnet/0.0.333333@333333333'
          }
        },
        inscription: {}
      };

      const result = ResponseFormatter.formatHashLinkResponse(response);
      
      expect(result).toContain('0.0.333333');
      expect(result).toContain('hcs://testnet/0.0.333333@333333333');
    });

    it('should handle missing metadata gracefully', () => {
      const response = {
        hashLinkBlock: {
          attributes: {
            topicId: '0.0.123456'
          }
        }
      };

      const result = ResponseFormatter.formatHashLinkResponse(response);
      
      expect(result).toContain('✅ Interactive content created successfully!');
      expect(result).toContain('📍 **Topic ID:** 0.0.123456');
      expect(result).toContain('⚡ Interactive content will load below');
    });

    it('should handle missing inscription gracefully', () => {
      const response = {
        hashLinkBlock: {
          attributes: {}
        },
        metadata: {
          name: 'Test Content'
        }
      };

      const result = ResponseFormatter.formatHashLinkResponse(response);
      
      expect(result).toContain('✅ Interactive content created successfully!');
      expect(result).toContain('**Test Content**');
      expect(result).toContain('⚡ Interactive content will load below');
    });
  });

  describe('isInscriptionResponse', () => {
    it('should return true for valid inscription response', () => {
      const validResponse = {
        success: true,
        type: 'inscription',
        inscription: {
          topicId: '0.0.123456'
        }
      };

      expect(ResponseFormatter.isInscriptionResponse(validResponse)).toBe(true);
    });

    it('should return false for null or undefined', () => {
      expect(ResponseFormatter.isInscriptionResponse(null)).toBe(false);
      expect(ResponseFormatter.isInscriptionResponse(undefined)).toBe(false);
    });

    it('should return false for non-object types', () => {
      expect(ResponseFormatter.isInscriptionResponse('string')).toBe(false);
      expect(ResponseFormatter.isInscriptionResponse(123)).toBe(false);
      expect(ResponseFormatter.isInscriptionResponse(true)).toBe(false);
    });

    it('should return false when success is not true', () => {
      const response = {
        success: false,
        type: 'inscription',
        inscription: {}
      };

      expect(ResponseFormatter.isInscriptionResponse(response)).toBe(false);
    });

    it('should return false when type is not inscription', () => {
      const response = {
        success: true,
        type: 'other',
        inscription: {}
      };

      expect(ResponseFormatter.isInscriptionResponse(response)).toBe(false);
    });

    it('should return false when inscription is missing', () => {
      const response = {
        success: true,
        type: 'inscription'
      };

      expect(ResponseFormatter.isInscriptionResponse(response)).toBe(false);
    });

    it('should return false when inscription is not an object', () => {
      const response = {
        success: true,
        type: 'inscription',
        inscription: 'not-an-object'
      };

      expect(ResponseFormatter.isInscriptionResponse(response)).toBe(false);
    });
  });

  describe('formatInscriptionResponse', () => {
    it('should format minimal inscription response', () => {
      const response = {
        inscription: {
          topicId: '0.0.123456'
        }
      };

      const result = ResponseFormatter.formatInscriptionResponse(response);
      expect(result).toContain('✅ Inscription Complete');
      expect(result).toContain('📍 **Topic ID:** 0.0.123456');
    });

    it('should format complete inscription response with all fields', () => {
      const response = {
        inscription: {
          topicId: '0.0.123456',
          hrl: 'hcs://testnet/0.0.123456@123456789',
          cdnUrl: 'https://cdn.test.com/inscription'
        },
        metadata: {
          name: 'Test Inscription',
          description: 'Test description for inscription',
          creator: '0.0.987654'
        },
        title: 'Custom Inscription Title'
      };

      const result = ResponseFormatter.formatInscriptionResponse(response);
      
      expect(result).toContain('✅ Custom Inscription Title');
      expect(result).toContain('**Test Inscription**');
      expect(result).toContain('Test description for inscription');
      expect(result).toContain('📍 **Topic ID:** 0.0.123456');
      expect(result).toContain('🔗 **HRL:** hcs://testnet/0.0.123456@123456789');
      expect(result).toContain('🌐 **CDN URL:** https://cdn.test.com/inscription');
      expect(result).toContain('👤 **Creator:** 0.0.987654');
    });

    it('should use default title when not provided', () => {
      const response = {
        inscription: {
          topicId: '0.0.123456'
        }
      };

      const result = ResponseFormatter.formatInscriptionResponse(response);
      expect(result).toContain('✅ Inscription Complete');
    });

    it('should handle missing metadata gracefully', () => {
      const response = {
        inscription: {
          topicId: '0.0.123456',
          hrl: 'hcs://testnet/0.0.123456@123456789'
        }
      };

      const result = ResponseFormatter.formatInscriptionResponse(response);
      
      expect(result).toContain('✅ Inscription Complete');
      expect(result).toContain('📍 **Topic ID:** 0.0.123456');
      expect(result).toContain('🔗 **HRL:** hcs://testnet/0.0.123456@123456789');
    });

    it('should handle empty metadata object', () => {
      const response = {
        inscription: {
          topicId: '0.0.123456'
        },
        metadata: {}
      };

      const result = ResponseFormatter.formatInscriptionResponse(response);
      
      expect(result).toContain('✅ Inscription Complete');
      expect(result).toContain('📍 **Topic ID:** 0.0.123456');
    });

    it('should handle partial inscription data', () => {
      const response = {
        inscription: {
          hrl: 'hcs://testnet/0.0.123456@123456789'
        },
        metadata: {
          name: 'Test Inscription'
        }
      };

      const result = ResponseFormatter.formatInscriptionResponse(response);
      
      expect(result).toContain('✅ Inscription Complete');
      expect(result).toContain('**Test Inscription**');
      expect(result).toContain('🔗 **HRL:** hcs://testnet/0.0.123456@123456789');
      expect(result).not.toContain('📍 **Topic ID:**');
    });
  });

  describe('formatResponse', () => {
    it('should format valid HashLink JSON response', () => {
      const jsonResponse = JSON.stringify({
        success: true,
        type: 'inscription',
        hashLinkBlock: {
          blockId: 'test-block',
          attributes: {
            topicId: '0.0.123456'
          }
        },
        metadata: {
          name: 'Test HashLink'
        }
      });

      const result = ResponseFormatter.formatResponse(jsonResponse);
      
      expect(result).toContain('✅ Interactive content created successfully!');
      expect(result).toContain('**Test HashLink**');
      expect(result).toContain('📍 **Topic ID:** 0.0.123456');
    });

    it('should format valid inscription JSON response', () => {
      const jsonResponse = JSON.stringify({
        success: true,
        type: 'inscription',
        inscription: {
          topicId: '0.0.123456'
        },
        metadata: {
          name: 'Test Inscription'
        }
      });

      const result = ResponseFormatter.formatResponse(jsonResponse);
      
      expect(result).toContain('✅ Inscription Complete');
      expect(result).toContain('**Test Inscription**');
      expect(result).toContain('📍 **Topic ID:** 0.0.123456');
    });

    it('should return original output for non-JSON input', () => {
      const plainText = 'This is plain text output';
      
      const result = ResponseFormatter.formatResponse(plainText);
      
      expect(result).toBe(plainText);
    });

    it('should return original output for invalid JSON', () => {
      const invalidJson = '{ "invalid": json }';
      
      const result = ResponseFormatter.formatResponse(invalidJson);
      
      expect(result).toBe(invalidJson);
    });

    it('should return original output for valid JSON that is not a special response', () => {
      const genericJson = JSON.stringify({
        success: true,
        type: 'generic',
        data: 'some data'
      });
      
      const result = ResponseFormatter.formatResponse(genericJson);
      
      expect(result).toBe(genericJson);
    });

    it('should prioritize HashLink formatting over inscription formatting', () => {
      const jsonResponse = JSON.stringify({
        success: true,
        type: 'inscription',
        hashLinkBlock: {
          blockId: 'test-block',
          attributes: {}
        },
        inscription: {
          topicId: '0.0.123456'
        }
      });

      const result = ResponseFormatter.formatResponse(jsonResponse);
      
      expect(result).toContain('✅ Interactive content created successfully!');
      expect(result).toContain('⚡ Interactive content will load below');
    });

    it('should handle empty JSON object', () => {
      const emptyJson = JSON.stringify({});
      
      const result = ResponseFormatter.formatResponse(emptyJson);
      
      expect(result).toBe(emptyJson);
    });

    it('should handle JSON with null values', () => {
      const nullJson = JSON.stringify({
        success: null,
        type: null,
        inscription: null
      });
      
      const result = ResponseFormatter.formatResponse(nullJson);
      
      expect(result).toBe(nullJson);
    });
  });
});