import { z } from 'zod';
import { FormGenerator } from '../../../src/forms/form-generator';
import { fieldGuidanceRegistry } from '../../../src/forms/field-guidance-registry';
import { TEST_FORM_CONSTANTS } from '../../test-constants';

describe('FormGenerator with Field Guidance', () => {
  let formGenerator: FormGenerator;

  beforeEach(() => {
    formGenerator = new FormGenerator();
    fieldGuidanceRegistry.clear();

    fieldGuidanceRegistry.registerToolConfiguration({
      toolPattern: /inscribe.*hashinal/i,
      globalGuidance: {
        qualityStandards: [
          TEST_FORM_CONSTANTS.USE_MEANINGFUL_NAMES,
          'Include collectible attributes like rarity'
        ]
      },
      fields: {
        name: {
          suggestions: [TEST_FORM_CONSTANTS.TEST_NFT_1, 'Digital Art Piece'],
          contextualHelpText: 'Create a distinctive name for collectors',
          validationRules: {
            qualityChecks: {
              forbidTechnicalTerms: ['MIME', 'upload', 'file']
            }
          }
        },
        description: {
          fieldTypeOverride: 'textarea',
          contextualHelpText: 'Describe the artistic vision behind this NFT',
          suggestions: ['A beautiful piece representing...']
        },
        attributes: {
          predefinedOptions: [
            { value: 'Rarity', label: 'Rarity', description: 'Common, Rare, Epic' },
            { value: 'Style', label: 'Style', description: 'Abstract, Realistic' }
          ]
        }
      }
    });
  });

  describe('field guidance integration', () => {
    it('should apply field suggestions to form fields', async () => {
      const schema = z.object({
        name: z.string(),
        description: z.string(),
        attributes: z.array(z.object({
          trait_type: z.string(),
          value: z.string()
        })).optional()
      });

      const formMessage = await formGenerator.generateFormFromSchema(
        schema,
        {},
        { toolName: 'inscribeHashinal' }
      );

      const nameField = formMessage.formConfig.fields.find(f => f.name === 'name');
      expect(nameField?.suggestions).toContain(TEST_FORM_CONSTANTS.TEST_NFT_1);
      expect(nameField?.helpText).toBe('Create a distinctive name for collectors');
      expect(nameField?.placeholder).toBe(`e.g., ${TEST_FORM_CONSTANTS.TEST_NFT_1}`);

      const descField = formMessage.formConfig.fields.find(f => f.name === 'description');
      expect(descField?.type).toBe('textarea');
      expect(descField?.helpText).toBe('Describe the artistic vision behind this NFT');

      const attrField = formMessage.formConfig.fields.find(f => f.name === 'attributes');
      expect(attrField?.options).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ value: 'Rarity', label: 'Rarity' })
        ])
      );
    });

    it('should apply global guidance to form description', async () => {
      const schema = z.object({
        name: z.string()
      });

      const formMessage = await formGenerator.generateFormFromSchema(
        schema,
        {},
        { toolName: 'inscribeHashinal' }
      );

      expect(formMessage.formConfig.description).toContain(TEST_FORM_CONSTANTS.QUALITY_GUIDELINES);
      expect(formMessage.formConfig.description).toContain(TEST_FORM_CONSTANTS.USE_MEANINGFUL_NAMES);
      expect(formMessage.formConfig.description).toContain('Include collectible attributes like rarity');
    });

    it('should include contextual guidance in field configuration', async () => {
      const schema = z.object({
        name: z.string()
      });

      const formMessage = await formGenerator.generateFormFromSchema(
        schema,
        {},
        { toolName: 'inscribeHashinal' }
      );

      const nameField = formMessage.formConfig.fields.find(f => f.name === 'name');
      expect(nameField?.contextualGuidance).toBeDefined();
      expect(nameField?.contextualGuidance?.avoidPatterns).toContain('MIME');
      expect(nameField?.contextualGuidance?.avoidPatterns).toContain('upload');
      expect(nameField?.contextualGuidance?.examples).toContain(TEST_FORM_CONSTANTS.TEST_NFT_1);
    });

    it('should not apply guidance for non-matching tools', async () => {
      const schema = z.object({
        name: z.string()
      });

      const formMessage = await formGenerator.generateFormFromSchema(
        schema,
        {},
        { toolName: 'someOtherTool' }
      );

      const nameField = formMessage.formConfig.fields.find(f => f.name === 'name');
      expect(nameField?.suggestions).toBeUndefined();
      expect(nameField?.contextualGuidance).toBeUndefined();
      expect(formMessage.formConfig.description).not.toContain(TEST_FORM_CONSTANTS.QUALITY_GUIDELINES);
    });

    it('should override field types when specified in guidance', async () => {
      const schema = z.object({
        description: z.string()
      });

      const formMessage = await formGenerator.generateFormFromSchema(
        schema,
        {},
        { toolName: 'inscribeHashinal' }
      );

      const descField = formMessage.formConfig.fields.find(f => f.name === 'description');
      expect(descField?.type).toBe('textarea'); // Overridden from 'text'
    });

    it('should include global guidance in form metadata', async () => {
      const schema = z.object({
        name: z.string()
      });

      const formMessage = await formGenerator.generateFormFromSchema(
        schema,
        {},
        { toolName: 'inscribeHashinal' }
      );

      expect(formMessage.formConfig.metadata?.globalGuidance).toBeDefined();
      expect(formMessage.formConfig.metadata?.globalGuidance.qualityStandards).toContain(
        TEST_FORM_CONSTANTS.USE_MEANINGFUL_NAMES
      );
    });
  });

  describe('backward compatibility', () => {
    it('should work without field guidance', async () => {
      fieldGuidanceRegistry.clear();

      const schema = z.object({
        name: z.string(),
        value: z.number()
      });

      const formMessage = await formGenerator.generateFormFromSchema(
        schema,
        {},
        { toolName: 'anyTool' }
      );

      expect(formMessage.formConfig.fields).toHaveLength(2);
      expect(formMessage.formConfig.fields[0].name).toBe('name');
      expect(formMessage.formConfig.fields[1].name).toBe('value');
      
      expect(formMessage.formConfig.fields[0].suggestions).toBeUndefined();
      expect(formMessage.formConfig.description).not.toContain(TEST_FORM_CONSTANTS.QUALITY_GUIDELINES);
    });
  });
});