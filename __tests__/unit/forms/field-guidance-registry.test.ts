import { fieldGuidanceRegistry } from '../../../src/forms/field-guidance-registry';
import { TEST_FORM_CONSTANTS } from '../../test-constants';

describe('FieldGuidanceRegistry', () => {
  beforeEach(() => {
    fieldGuidanceRegistry.clear();
  });

  describe('NFT tool configuration', () => {
    beforeEach(() => {
      fieldGuidanceRegistry.registerToolConfiguration({
        toolPattern: /inscribe.*hashinal/i,
        globalGuidance: {
          warnings: [
            'Avoid auto-generating technical metadata like file types or upload sources',
            'Focus on collectible traits that add value to the NFT'
          ],
          qualityStandards: [
            'Use meaningful names that describe the artwork or content',
            'Include collectible attributes like rarity, style, or theme',
            'Provide descriptions that tell a story or explain the concept'
          ]
        },
        fields: {
          name: {
            suggestions: [
              'Sunset Landscape #42',
              'Digital Abstract Art'
            ],
            validationRules: {
              rejectPatterns: [
                {
                  pattern: /^untitled$/i,
                  reason: 'Generic names like "Untitled" are not valuable for NFTs'
                }
              ],
              qualityChecks: {
                forbidTechnicalTerms: ['MIME', 'upload', 'file type']
              }
            }
          },
          attributes: {
            validationRules: {
              rejectPatterns: [
                {
                  pattern: /^(mime.?type|file.?type|source)$/i,
                  reason: 'Technical attributes are not collectible traits'
                }
              ],
              qualityChecks: {
                forbidTechnicalTerms: ['MIME Type', 'File Type', 'Source']
              }
            }
          }
        }
      });
    });

    it('should provide field guidance for inscribeHashinal tool', () => {
      const nameGuidance = fieldGuidanceRegistry.getFieldGuidance('inscribeHashinal', 'name');
      
      expect(nameGuidance).toBeDefined();
      expect(nameGuidance?.suggestions).toContain('Sunset Landscape #42');
      expect(nameGuidance?.validationRules?.qualityChecks?.forbidTechnicalTerms).toContain('MIME');
    });

    it('should provide global guidance for NFT tools', () => {
      const globalGuidance = fieldGuidanceRegistry.getGlobalGuidance('inscribeHashinal');
      
      expect(globalGuidance).toBeDefined();
      expect(globalGuidance?.qualityStandards).toContain(
        'Use meaningful names that describe the artwork or content'
      );
    });

    it('should validate field values against guidance rules', () => {
      const result1 = fieldGuidanceRegistry.validateFieldValue(
        'inscribeHashinal',
        'name',
        'untitled'
      );
      
      expect(result1.isValid).toBe(false);
      expect(result1.errors).toContain('Rejected: Generic names like "Untitled" are not valuable for NFTs');

      const result2 = fieldGuidanceRegistry.validateFieldValue(
        'inscribeHashinal',
        'name',
        'Beautiful Sunset Artwork'
      );
      
      expect(result2.isValid).toBe(true);
      expect(result2.errors).toHaveLength(0);
    });

    it('should reject technical metadata in attributes', () => {
      const result = fieldGuidanceRegistry.validateFieldValue(
        'inscribeHashinal',
        'attributes',
        'MIME Type'
      );
      
      expect(result.isValid).toBe(false);
      expect(result.errors[0]).toContain('Technical attributes are not collectible traits');
    });

    it('should warn about technical terms', () => {
      const result = fieldGuidanceRegistry.validateFieldValue(
        'inscribeHashinal',
        'name',
        'Image with MIME type specification'
      );
      
      expect(result.isValid).toBe(false);
      expect(result.errors[0]).toContain('Avoid technical terms like "MIME"');
    });

    it('should not provide guidance for non-matching tools', () => {
      const guidance = fieldGuidanceRegistry.getFieldGuidance('someOtherTool', 'name');
      expect(guidance).toBeNull();
    });

    it('should handle missing field gracefully', () => {
      const guidance = fieldGuidanceRegistry.getFieldGuidance('inscribeHashinal', 'nonexistentField');
      expect(guidance).toBeNull();
    });
  });

  describe('Custom tool configurations', () => {
    it('should register and retrieve custom tool configurations', () => {
      fieldGuidanceRegistry.registerToolConfiguration({
        toolPattern: 'customTool',
        fields: {
          testField: {
            suggestions: ['test suggestion'],
            contextualHelpText: 'Test help text'
          }
        }
      });

      const guidance = fieldGuidanceRegistry.getFieldGuidance('customTool', 'testField');
      expect(guidance?.suggestions).toContain('test suggestion');
      expect(guidance?.contextualHelpText).toBe('Test help text');
    });

    it('should support regex patterns for tool matching', () => {
      fieldGuidanceRegistry.registerToolConfiguration({
        toolPattern: /test.*tool/i,
        fields: {
          field1: {
            suggestions: [TEST_FORM_CONSTANTS.REGEX_TEST]
          }
        }
      });

      const guidance1 = fieldGuidanceRegistry.getFieldGuidance('testTool', 'field1');
      const guidance2 = fieldGuidanceRegistry.getFieldGuidance('TestMyTool', 'field1');
      const guidance3 = fieldGuidanceRegistry.getFieldGuidance('otherTool', 'field1');

      expect(guidance1?.suggestions).toContain(TEST_FORM_CONSTANTS.REGEX_TEST);
      expect(guidance2?.suggestions).toContain(TEST_FORM_CONSTANTS.REGEX_TEST);
      expect(guidance3).toBeNull();
    });
  });
});