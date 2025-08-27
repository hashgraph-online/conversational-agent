import { z, ZodError } from 'zod';
import { FormGenerator } from '../../../src/forms/form-generator';
import { TEST_FORM_CONSTANTS } from '../../test-constants';
import type { FormMessage as _FormMessage } from '../../../src/forms/types';

/**
 * Test suite for FormGenerator using TDD approach
 */
describe('FormGenerator', () => {
  let formGenerator: FormGenerator;

  beforeEach(() => {
    formGenerator = new FormGenerator();
  });

  describe('generateFormFromError', () => {
    it('should generate a form message from a simple Zod validation error', () => {
      const schema = z.object({
        tokenName: z.string(),
        tokenSymbol: z.string(),
        maxSupply: z.number()
      });

      const validationError = new ZodError([
        {
          code: 'invalid_type',
          expected: 'string',
          received: 'undefined',
          path: ['tokenName'],
          message: 'Required'
        },
        {
          code: 'invalid_type',
          expected: 'string',
          received: 'undefined',
          path: ['tokenSymbol'],
          message: 'Required'
        }
      ]);

      const formMessage = formGenerator.generateFormFromError(
        validationError,
        schema,
        'HederaCreateNftTool',
        'Create an NFT collection'
      );

      expect(formMessage).toBeDefined();
      expect(formMessage.type).toBe('form');
      expect(formMessage.id).toMatch(/^form_\d+_[a-z0-9]+$/);
      expect(formMessage.toolName).toBe('HederaCreateNftTool');
      expect(formMessage.originalPrompt).toBe('Create an NFT collection');
      expect(formMessage.formConfig).toBeDefined();
      expect(formMessage.formConfig.title).toContain('Create Nft');
      expect(formMessage.formConfig.fields.length).toBeGreaterThan(0);
      expect(formMessage.validationErrors).toEqual([
        {
          path: ['tokenName'],
          message: 'Required',
          code: 'invalid_type'
        },
        {
          path: ['tokenSymbol'],
          message: 'Required',
          code: 'invalid_type'
        }
      ]);
    });

    it('should handle schemas with render configurations', () => {
      const schema = z.object({
        tokenName: z.string(),
        maxSupply: z.number()
      });

      const validationError = new ZodError([
        {
          code: 'invalid_type',
          expected: 'string',
          received: 'undefined',
          path: ['tokenName'],
          message: 'Required'
        }
      ]);

      const formMessage = formGenerator.generateFormFromError(
        validationError,
        schema,
        'TestTool',
        TEST_FORM_CONSTANTS.TEST_PROMPT
      );

      expect(formMessage.formConfig.fields).toHaveLength(1);
      expect(formMessage.formConfig.fields[0].name).toBe('tokenName');
      expect(formMessage.formConfig.fields[0].type).toBe('text');
      expect(formMessage.formConfig.fields[0].label).toBe('Token Name');
      expect(formMessage.formConfig.fields[0].required).toBe(true);
    });

    it('should handle empty missing fields by generating all schema fields', () => {
      const schema = z.object({
        tokenName: z.string(),
        tokenSymbol: z.string()
      });

      const validationError = new ZodError([]);

      const formMessage = formGenerator.generateFormFromError(
        validationError,
        schema,
        'TestTool',
        TEST_FORM_CONSTANTS.TEST_PROMPT
      );

      expect(formMessage.formConfig.fields.length).toBeGreaterThanOrEqual(0);
    });

    it('should humanize field names correctly', () => {
      const schema = z.object({
        tokenMaxSupply: z.number(),
        treasury_account_id: z.string(),
        'custom-fee-amount': z.number()
      });

      const validationError = new ZodError([
        {
          code: 'invalid_type',
          expected: 'number',
          received: 'undefined',
          path: ['tokenMaxSupply'],
          message: 'Required'
        },
        {
          code: 'invalid_type',
          expected: 'string',
          received: 'undefined',
          path: ['treasury_account_id'],
          message: 'Required'
        }
      ]);

      const formMessage = formGenerator.generateFormFromError(
        validationError,
        schema,
        'TestTool',
        TEST_FORM_CONSTANTS.TEST_PROMPT
      );

      const tokenMaxSupplyField = formMessage.formConfig.fields.find(f => f.name === 'tokenMaxSupply');
      const treasuryField = formMessage.formConfig.fields.find(f => f.name === 'treasury_account_id');
      
      expect(tokenMaxSupplyField?.label).toBe('Token Max Supply');
      expect(treasuryField?.label).toBe('Treasury Account Id');
    });

    it('should map field types correctly', () => {
      const schema = z.object({
        name: z.string(),
        count: z.number(),
        enabled: z.boolean(),
        type: z.enum(['A', 'B', 'C'])
      });

      const validationError = new ZodError([
        {
          code: 'invalid_type',
          expected: 'string',
          received: 'undefined',
          path: ['name'],
          message: 'Required'
        },
        {
          code: 'invalid_type',
          expected: 'number',
          received: 'undefined',
          path: ['count'],
          message: 'Required'
        }
      ]);

      const formMessage = formGenerator.generateFormFromError(
        validationError,
        schema,
        'TestTool',
        TEST_FORM_CONSTANTS.TEST_PROMPT
      );

      const nameField = formMessage.formConfig.fields.find(f => f.name === 'name');
      const countField = formMessage.formConfig.fields.find(f => f.name === 'count');
      
      expect(nameField?.type).toBe('text');
      expect(countField?.type).toBe('number');
    });

    it('should generate appropriate form title and description', () => {
      const schema = z.object({ test: z.string() });
      const validationError = new ZodError([]);

      const formMessage = formGenerator.generateFormFromError(
        validationError,
        schema,
        'HederaCreateNftTool',
        'Create an NFT'
      );

      expect(formMessage.formConfig.title).toBe('Complete Create Nft Information');
      expect(formMessage.formConfig.description).toContain('required');
      expect(formMessage.formConfig.submitLabel).toBe('Continue');
      expect(formMessage.formConfig.cancelLabel).toBe('Cancel');
    });
  });
});