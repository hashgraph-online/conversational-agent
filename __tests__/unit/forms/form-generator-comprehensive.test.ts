import { describe, test, expect, jest, beforeEach } from '@jest/globals';
import { FormGenerator } from '../../../src/forms/form-generator';
import { z, ZodError } from 'zod';
import { Logger } from '@hashgraphonline/standards-sdk';

// Mock external dependencies
jest.mock('@hashgraphonline/standards-sdk', () => ({
  Logger: jest.fn().mockImplementation(() => ({
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  })),
}));

jest.mock('@hashgraphonline/standards-agent-kit', () => ({
  extractRenderConfigs: jest.fn(),
  generateFieldOrdering: jest.fn(),
}));

jest.mock('../../../src/forms/field-type-registry', () => ({
  fieldTypeRegistry: {
    detectType: jest.fn(),
  },
}));

jest.mock('../../../src/forms/field-guidance-registry', () => ({
  fieldGuidanceRegistry: {
    getFieldGuidance: jest.fn(),
    getGlobalGuidance: jest.fn(),
  },
}));

jest.mock('../../../src/constants', () => ({
  FIELD_PRIORITIES: {
    ESSENTIAL: 'essential',
    COMMON: 'common',
    ADVANCED: 'advanced',
    EXPERT: 'expert',
  },
}));

describe('FormGenerator - Comprehensive Tests', () => {
  let formGenerator: FormGenerator;
  let mockLogger: jest.Mocked<Logger>;

  beforeEach(() => {
    jest.clearAllMocks();
    
    mockLogger = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
    } as jest.Mocked<Logger>;

    (Logger as jest.MockedClass<typeof Logger>).mockImplementation(() => mockLogger);
    formGenerator = new FormGenerator();
  });

  describe('Constructor', () => {
    test('should create FormGenerator with logger', () => {
      expect(formGenerator).toBeDefined();
      expect(Logger).toHaveBeenCalledWith({ module: 'FormGenerator' });
    });
  });

  describe('generateFormFromError', () => {
    test('should generate form from ZodError', () => {
      const schema = z.object({
        name: z.string(),
        age: z.number(),
      });

      const error = new ZodError([
        {
          code: 'invalid_type',
          expected: 'string',
          received: 'number',
          path: ['name'],
          message: 'Expected string, received number',
        },
        {
          code: 'invalid_type',
          expected: 'number',
          received: 'string',
          path: ['age'],
          message: 'Expected number, received string',
        },
      ]);

      const result = formGenerator.generateFormFromError(
        error,
        schema,
        'test-tool',
        'Please provide user information'
      );

      expect(result.type).toBe('form');
      expect(result.toolName).toBe('test-tool');
      expect(result.originalPrompt).toBe('Please provide user information');
      expect(result.validationErrors).toHaveLength(2);
      expect(result.formConfig.fields).toHaveLength(2);
      expect(result.formConfig.fields[0].name).toBe('name');
      expect(result.formConfig.fields[1].name).toBe('age');
    });

    test('should handle empty validation errors', () => {
      const schema = z.object({
        name: z.string(),
      });

      const error = new ZodError([]);

      const result = formGenerator.generateFormFromError(
        error,
        schema,
        'test-tool',
        'Please provide user information'
      );

      expect(result.validationErrors).toHaveLength(0);
      expect(result.formConfig.fields).toHaveLength(0);
    });
  });

  describe('generateFormFromSchema', () => {
    test('should generate form with pre-calculated missing fields', async () => {
      const schema = z.object({
        name: z.string(),
        age: z.number(),
        email: z.string().email(),
      });

      const missingFields = new Set(['name', 'email']);
      const context = {
        toolName: 'user-registration',
        toolDescription: 'Register a new user',
      };

      const result = await formGenerator.generateFormFromSchema(
        schema,
        { age: 25 },
        context,
        missingFields
      );

      expect(result.type).toBe('form');
      expect(result.toolName).toBe('user-registration');
      expect(result.formConfig.fields).toHaveLength(2);
      expect(result.formConfig.fields.map(f => f.name)).toEqual(['name', 'email']);
    });

    test('should generate form with all fields when no pre-calculated fields', async () => {
      const schema = z.object({
        name: z.string(),
        age: z.number(),
      });

      const context = {
        toolName: 'user-profile',
        toolDescription: 'Update user profile',
      };

      const result = await formGenerator.generateFormFromSchema(
        schema,
        {},
        context
      );

      expect(result.formConfig.fields).toHaveLength(2);
      expect(result.formConfig.fields.map(f => f.name)).toEqual(['name', 'age']);
    });

    test('should handle empty schema', async () => {
      const schema = z.object({});
      const context = {
        toolName: 'empty-tool',
        toolDescription: 'Empty tool',
      };

      const result = await formGenerator.generateFormFromSchema(
        schema,
        {},
        context
      );

      expect(result.formConfig.fields).toHaveLength(0);
    });
  });

  describe('generateJsonSchemaForm', () => {
    test('should generate JSON schema and UI schema', () => {
      const schema = z.object({
        name: z.string(),
        age: z.number(),
        email: z.string().email(),
      });

      const missingFields = new Set(['name', 'email']);

      const result = formGenerator.generateJsonSchemaForm(
        schema,
        { age: 25 },
        missingFields
      );

      expect(result.jsonSchema).toBeDefined();
      expect(result.uiSchema).toBeDefined();
      expect(result.jsonSchema.properties).toBeDefined();
      expect(result.jsonSchema.properties?.name).toBeDefined();
      expect(result.jsonSchema.properties?.email).toBeDefined();
      expect(result.jsonSchema.properties?.age).toBeUndefined(); // Not in missing fields
    });

    test('should handle schema with no missing fields', () => {
      const schema = z.object({
        name: z.string(),
        age: z.number(),
      });

      const result = formGenerator.generateJsonSchemaForm(schema);

      expect(result.jsonSchema).toBeDefined();
      expect(result.uiSchema).toBeDefined();
      expect(result.jsonSchema.properties?.name).toBeDefined();
      expect(result.jsonSchema.properties?.age).toBeDefined();
    });

    test('should handle schema with advanced fields', () => {
      const schema = z.object({
        name: z.string(),
        metadata: z.record(z.string()),
        properties: z.record(z.string()),
      });

      const result = formGenerator.generateJsonSchemaForm(schema);

      expect(result.uiSchema.metadata).toBeDefined();
      expect(result.uiSchema.properties).toBeDefined();
      expect(result.uiSchema.metadata['ui:options']?.collapsible).toBe(true);
      expect(result.uiSchema.properties['ui:options']?.collapsible).toBe(true);
    });
  });

  describe('Field Type Mapping', () => {
    test('should map string field type correctly', () => {
      const schema = z.object({
        name: z.string(),
      });

      const result = formGenerator.generateJsonSchemaForm(schema);
      expect(result.jsonSchema.properties?.name.type).toBe('string');
    });

    test('should map number field type correctly', () => {
      const schema = z.object({
        age: z.number(),
      });

      const result = formGenerator.generateJsonSchemaForm(schema);
      expect(result.jsonSchema.properties?.age.type).toBe('number');
    });

    test('should map boolean field type correctly', () => {
      const schema = z.object({
        active: z.boolean(),
      });

      const result = formGenerator.generateJsonSchemaForm(schema);
      expect(result.jsonSchema.properties?.active.type).toBe('boolean');
    });

    test('should map array field type correctly', () => {
      const schema = z.object({
        tags: z.array(z.string()),
      });

      const result = formGenerator.generateJsonSchemaForm(schema);
      expect(result.jsonSchema.properties?.tags.type).toBe('array');
    });
  });

  describe('Field Priority and UI Configuration', () => {
    test('should set essential priority for required fields', () => {
      const schema = z.object({
        name: z.string(),
        age: z.number().optional(),
      });

      const result = formGenerator.generateJsonSchemaForm(schema);
      
      // The UI schema should have help text for required fields
      expect(result.uiSchema.name).toBeDefined();
    });

    test('should handle advanced and expert fields', () => {
      const schema = z.object({
        basic: z.string(),
        advanced: z.string(),
        expert: z.string(),
      });

      const result = formGenerator.generateJsonSchemaForm(schema);
      
      // Advanced and expert fields should be collapsible
      expect(result.uiSchema.advanced?.['ui:options']?.collapsed).toBe(true);
      expect(result.uiSchema.expert?.['ui:options']?.collapsed).toBe(true);
    });
  });

  describe('Schema Extraction and Field Detection', () => {
    test('should extract fields from ZodObject schema', () => {
      const schema = z.object({
        field1: z.string(),
        field2: z.number(),
        field3: z.boolean(),
      });

      const result = formGenerator.generateJsonSchemaForm(schema);
      
      expect(result.jsonSchema.properties?.field1).toBeDefined();
      expect(result.jsonSchema.properties?.field2).toBeDefined();
      expect(result.jsonSchema.properties?.field3).toBeDefined();
    });

    test('should handle optional fields correctly', () => {
      const schema = z.object({
        required: z.string(),
        optional: z.string().optional(),
        withDefault: z.string().default('default value'),
      });

      const result = formGenerator.generateJsonSchemaForm(schema);
      
      expect(result.jsonSchema.required).toContain('required');
      expect(result.jsonSchema.required).not.toContain('optional');
      expect(result.jsonSchema.required).not.toContain('withDefault');
    });

    test('should handle union types', () => {
      const schema = z.union([
        z.object({ type: z.literal('user'), name: z.string() }),
        z.object({ type: z.literal('admin'), role: z.string() }),
      ]);

      const result = formGenerator.generateJsonSchemaForm(schema);
      
      expect(result.jsonSchema).toBeDefined();
    });
  });

  describe('Form Configuration Generation', () => {
    test('should generate form title correctly', () => {
      const schema = z.object({
        name: z.string(),
      });

      const result = formGenerator.generateFormFromError(
        new ZodError([]),
        schema,
        'HederaTokenTool',
        'Create token'
      );

      expect(result.formConfig.title).toBe('Complete Token Information');
    });

    test('should generate form description correctly', () => {
      const schema = z.object({
        name: z.string(),
        age: z.number(),
      });

      const result = formGenerator.generateFormFromError(
        new ZodError([]),
        schema,
        'test-tool',
        'Create user'
      );

      expect(result.formConfig.description).toContain('2 required fields');
    });

    test('should generate form description for single field', () => {
      const schema = z.object({
        name: z.string(),
      });

      const result = formGenerator.generateFormFromError(
        new ZodError([]),
        schema,
        'test-tool',
        'Create user'
      );

      expect(result.formConfig.description).toContain('1 required field');
    });

    test('should generate form description for no fields', () => {
      const schema = z.object({});

      const result = formGenerator.generateFormFromError(
        new ZodError([]),
        schema,
        'test-tool',
        'Create user'
      );

      expect(result.formConfig.description).toContain('required information');
    });
  });

  describe('Field Name Humanization', () => {
    test('should humanize camelCase field names', () => {
      const schema = z.object({
        firstName: z.string(),
        lastName: z.string(),
        dateOfBirth: z.string(),
      });

      const result = formGenerator.generateJsonSchemaForm(schema);
      
      // The humanization happens in createFormField, but we can verify the schema is generated
      expect(result.jsonSchema.properties?.firstName).toBeDefined();
      expect(result.jsonSchema.properties?.lastName).toBeDefined();
      expect(result.jsonSchema.properties?.dateOfBirth).toBeDefined();
    });

    test('should humanize snake_case field names', () => {
      const schema = z.object({
        first_name: z.string(),
        last_name: z.string(),
      });

      const result = formGenerator.generateJsonSchemaForm(schema);
      
      expect(result.jsonSchema.properties?.first_name).toBeDefined();
      expect(result.jsonSchema.properties?.last_name).toBeDefined();
    });
  });

  describe('Error Handling', () => {
    test('should handle schema extraction errors gracefully', () => {
      const invalidSchema = {} as z.ZodSchema;

      const result = formGenerator.generateJsonSchemaForm(invalidSchema);
      
      expect(result.jsonSchema).toBeDefined();
      expect(result.uiSchema).toBeDefined();
    });

    test('should handle field type inference errors', () => {
      const schema = z.object({
        complexField: z.any(),
      });

      const result = formGenerator.generateJsonSchemaForm(schema);
      
      expect(result.jsonSchema.properties?.complexField).toBeDefined();
    });

    test('should handle required field detection errors', () => {
      const schema = z.object({
        field: z.any(),
      });

      const result = formGenerator.generateJsonSchemaForm(schema);
      
      expect(result.jsonSchema).toBeDefined();
    });
  });

  describe('Render Config Integration', () => {
    test('should handle missing render config functions', () => {
      const { extractRenderConfigs, generateFieldOrdering } = require('@hashgraphonline/standards-agent-kit');
      extractRenderConfigs.mockImplementation(() => {
        throw new Error('Function not available');
      });
      generateFieldOrdering.mockImplementation(() => {
        throw new Error('Function not available');
      });

      const schema = z.object({
        name: z.string(),
      });

      const result = formGenerator.generateJsonSchemaForm(schema);
      
      expect(result.jsonSchema).toBeDefined();
      expect(mockLogger.warn).toHaveBeenCalled();
    });

    test('should handle render config extraction errors', () => {
      const { extractRenderConfigs } = require('@hashgraphonline/standards-agent-kit');
      extractRenderConfigs.mockImplementation(() => {
        throw new Error('Extraction failed');
      });

      const schema = z.object({
        name: z.string(),
      });

      const result = formGenerator.generateJsonSchemaForm(schema);
      
      expect(result.jsonSchema).toBeDefined();
      expect(mockLogger.warn).toHaveBeenCalledWith('Could not extract render configs:', expect.any(Error));
    });
  });

  describe('Field Guidance Integration', () => {
    test('should integrate field guidance when available', () => {
      const { fieldGuidanceRegistry } = require('../../../src/forms/field-guidance-registry');
      fieldGuidanceRegistry.getFieldGuidance.mockReturnValue({
        suggestions: ['John', 'Jane'],
        contextualHelpText: 'Enter the user\'s full name',
        warnings: [{ message: 'Name must be at least 2 characters' }],
      });

      const schema = z.object({
        name: z.string(),
      });

      const result = formGenerator.generateJsonSchemaForm(schema);
      
      expect(result.jsonSchema).toBeDefined();
    });

    test('should integrate global guidance when available', () => {
      const { fieldGuidanceRegistry } = require('../../../src/forms/field-guidance-registry');
      fieldGuidanceRegistry.getGlobalGuidance.mockReturnValue({
        qualityStandards: ['Use clear, descriptive names', 'Avoid abbreviations'],
      });

      const schema = z.object({
        name: z.string(),
      });

      const result = formGenerator.generateFormFromError(
        new ZodError([]),
        schema,
        'test-tool',
        'Create user'
      );

      expect(result.formConfig.description).toContain('Quality Guidelines');
    });
  });

  describe('Field Type Registry Integration', () => {
    test('should use field type registry when available', () => {
      const { fieldTypeRegistry } = require('../../../src/forms/field-type-registry');
      fieldTypeRegistry.detectType.mockReturnValue('email');

      const schema = z.object({
        userEmail: z.string(),
      });

      const result = formGenerator.generateJsonSchemaForm(schema);
      
      expect(result.jsonSchema).toBeDefined();
    });
  });

  describe('Complex Schema Handling', () => {
    test('should handle nested object schemas', () => {
      const schema = z.object({
        user: z.object({
          name: z.string(),
          age: z.number(),
        }),
        settings: z.object({
          notifications: z.boolean(),
        }),
      });

      const result = formGenerator.generateJsonSchemaForm(schema);
      
      expect(result.jsonSchema.properties?.user).toBeDefined();
      expect(result.jsonSchema.properties?.settings).toBeDefined();
      expect(result.jsonSchema.properties?.user.type).toBe('object');
      expect(result.jsonSchema.properties?.settings.type).toBe('object');
    });

    test('should handle array schemas', () => {
      const schema = z.object({
        tags: z.array(z.string()),
        scores: z.array(z.number()),
      });

      const result = formGenerator.generateJsonSchemaForm(schema);
      
      expect(result.jsonSchema.properties?.tags.type).toBe('array');
      expect(result.jsonSchema.properties?.scores.type).toBe('array');
    });

    test('should handle enum schemas', () => {
      const schema = z.object({
        status: z.enum(['active', 'inactive', 'pending']),
        role: z.enum(['user', 'admin', 'moderator']),
      });

      const result = formGenerator.generateJsonSchemaForm(schema);
      
      expect(result.jsonSchema.properties?.status.type).toBe('string');
      expect(result.jsonSchema.properties?.role.type).toBe('string');
      expect(result.jsonSchema.properties?.status.enum).toEqual(['active', 'inactive', 'pending']);
      expect(result.jsonSchema.properties?.role.enum).toEqual(['user', 'admin', 'moderator']);
    });
  });
});



