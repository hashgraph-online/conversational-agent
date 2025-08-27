import { FormGenerator } from '../../src/forms/form-generator';
import { z, ZodError } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';
import { Logger } from '@hashgraphonline/standards-sdk';
import { fieldTypeRegistry } from '../../src/forms/field-type-registry';
import { fieldGuidanceRegistry } from '../../src/forms/field-guidance-registry';
import { FIELD_PRIORITIES } from '../../src/constants';
import {
  extractRenderConfigs,
  generateFieldOrdering,
  type RenderConfigSchema,
  type ZodSchemaWithRender,
  type ExtractedRenderConfig,
} from '@hashgraphonline/standards-agent-kit';
import type {
  FormConfig,
  FormField,
  ValidationError,
  FormMessage,
  FormFieldType,
} from '../../src/forms/types';

jest.mock('@hashgraphonline/standards-sdk');
jest.mock('../../src/forms/field-type-registry');
jest.mock('../../src/forms/field-guidance-registry');
jest.mock('../../src/constants', () => ({
  FIELD_PRIORITIES: {
    ESSENTIAL: 'essential',
    COMMON: 'common',
    ADVANCED: 'advanced',
    EXPERT: 'expert',
  },
  FORM_FIELD_TYPES: {
    TEXT: 'text',
    NUMBER: 'number',
    SELECT: 'select',
    CHECKBOX: 'checkbox',
    TEXTAREA: 'textarea',
    FILE: 'file',
    ARRAY: 'array',
    OBJECT: 'object',
    CURRENCY: 'currency',
    PERCENTAGE: 'percentage',
  },
}));
jest.mock('@hashgraphonline/standards-agent-kit', () => ({
  extractRenderConfigs: jest.fn(),
  generateFieldOrdering: jest.fn(),
}));
jest.mock('zod-to-json-schema');

const mockLogger = Logger as jest.MockedClass<typeof Logger>;
const mockFieldTypeRegistry = fieldTypeRegistry as jest.Mocked<typeof fieldTypeRegistry>;
const mockFieldGuidanceRegistry = fieldGuidanceRegistry as jest.Mocked<typeof fieldGuidanceRegistry>;
const mockExtractRenderConfigs = extractRenderConfigs as jest.MockedFunction<typeof extractRenderConfigs>;
const mockGenerateFieldOrdering = generateFieldOrdering as jest.MockedFunction<typeof generateFieldOrdering>;
const mockZodToJsonSchema = zodToJsonSchema as jest.MockedFunction<typeof zodToJsonSchema>;

describe('FormGenerator', () => {
  let formGenerator: FormGenerator;
  let mockLoggerInstance: any;

  beforeEach(() => {
    jest.clearAllMocks();

    mockLoggerInstance = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
    };

    mockLogger.mockImplementation(() => mockLoggerInstance);

    // FIELD_PRIORITIES is now mocked in the jest.mock() above

    mockFieldTypeRegistry.detectType = jest.fn().mockReturnValue('text');
    mockFieldGuidanceRegistry.getGlobalGuidance = jest.fn().mockReturnValue(null);
    mockFieldGuidanceRegistry.getFieldGuidance = jest.fn().mockReturnValue(null);

    mockExtractRenderConfigs.mockReturnValue({
      fields: {},
      groups: {},
      order: [],
      metadata: {},
    });

    mockGenerateFieldOrdering.mockReturnValue({
      sections: {},
    });

    mockZodToJsonSchema.mockReturnValue({
      type: 'object',
      properties: {},
      required: [],
    });

    formGenerator = new FormGenerator();
  });

  describe('constructor', () => {
    it('should create a FormGenerator instance', () => {
      expect(formGenerator).toBeInstanceOf(FormGenerator);
    });

    it('should initialize with a logger', () => {
      expect(mockLogger).toHaveBeenCalledWith({ module: 'FormGenerator' });
    });
  });

  describe('generateFormFromError', () => {
    it('should generate form from ZodError', () => {
      const zodError = new ZodError([
        {
          code: z.ZodIssueCode.invalid_type,
          expected: 'string',
          received: 'undefined',
          path: ['name'],
          message: 'Required',
        },
        {
          code: z.ZodIssueCode.invalid_type,
          expected: 'number',
          received: 'undefined',
          path: ['age'],
          message: 'Required',
        },
      ]);

      const schema = z.object({
        name: z.string(),
        age: z.number(),
      });

      const result = formGenerator.generateFormFromError(
        zodError,
        schema,
        'test-tool',
        'Original prompt'
      );

      expect(result.type).toBe('form');
      expect(result.id).toMatch(/^form_\d+_[a-z0-9]+$/);
      expect(result.toolName).toBe('test-tool');
      expect(result.originalPrompt).toBe('Original prompt');
      expect(result.validationErrors).toHaveLength(2);
      expect(result.formConfig).toBeDefined();
    });

    it('should handle empty validation errors', () => {
      const zodError = new ZodError([]);
      const schema = z.object({});

      const result = formGenerator.generateFormFromError(
        zodError,
        schema,
        'test-tool',
        'Original prompt'
      );

      expect(result.validationErrors).toHaveLength(0);
      expect(result.formConfig).toBeDefined();
    });

    it('should extract validation errors correctly', () => {
      const zodError = new ZodError([
        {
          code: z.ZodIssueCode.invalid_type,
          expected: 'string',
          received: 'undefined',
          path: ['nested', 'field'],
          message: 'Invalid nested field',
        },
      ]);

      const schema = z.object({
        nested: z.object({
          field: z.string(),
        }),
      });

      const result = formGenerator.generateFormFromError(
        zodError,
        schema,
        'test-tool',
        'Original prompt'
      );

      expect(result.validationErrors[0]).toEqual({
        path: ['nested', 'field'],
        message: 'Invalid nested field',
        code: z.ZodIssueCode.invalid_type,
      });
    });
  });

  describe('generateFormFromSchema', () => {
    it('should generate form from schema without pre-calculated fields', async () => {
      const schema = z.object({
        name: z.string(),
        email: z.string().email(),
        age: z.number().optional(),
      });

      const result = await formGenerator.generateFormFromSchema(
        schema,
        {},
        { toolName: 'test-tool', toolDescription: 'Test description' }
      );

      expect(result.type).toBe('form');
      expect(result.toolName).toBe('test-tool');
      expect(result.originalPrompt).toBe('Test description');
      expect(result.validationErrors).toEqual([]);
      expect(result.formConfig).toBeDefined();
    });

    it('should use pre-calculated missing fields when provided', async () => {
      const schema = z.object({
        name: z.string(),
        email: z.string(),
        phone: z.string(),
      });

      const preCalculatedFields = new Set(['email', 'phone']);

      const result = await formGenerator.generateFormFromSchema(
        schema,
        { name: 'John' },
        { toolName: 'test-tool' },
        preCalculatedFields
      );

      expect(mockLoggerInstance.info).toHaveBeenCalledWith(
        '📋 Using pre-calculated missing fields',
        expect.any(Object)
      );
      expect(result.formConfig).toBeDefined();
    });

    it('should fallback to default description when no toolDescription provided', async () => {
      const schema = z.object({ name: z.string() });

      const result = await formGenerator.generateFormFromSchema(
        schema,
        {},
        { toolName: 'test-tool' }
      );

      expect(result.originalPrompt).toBe('Complete test-tool');
    });

    it('should handle non-object schemas gracefully', async () => {
      const schema = z.string();

      const result = await formGenerator.generateFormFromSchema(
        schema,
        {},
        { toolName: 'test-tool' }
      );

      expect(result.formConfig).toBeDefined();
      expect(mockLoggerInstance.info).toHaveBeenCalledWith(
        expect.stringContaining('FormGenerator.generateFormFromSchema starting'),
        expect.any(Object)
      );
    });
  });

  describe('field type mapping', () => {
    it('should map field types correctly', () => {
      const testCases = [
        { input: 'text', expected: 'text' },
        { input: 'string', expected: 'text' },
        { input: 'number', expected: 'number' },
        { input: 'integer', expected: 'number' },
        { input: 'select', expected: 'select' },
        { input: 'enum', expected: 'select' },
        { input: 'checkbox', expected: 'checkbox' },
        { input: 'boolean', expected: 'checkbox' },
        { input: 'textarea', expected: 'textarea' },
        { input: 'longtext', expected: 'textarea' },
        { input: 'file', expected: 'file' },
        { input: 'array', expected: 'array' },
        { input: 'object', expected: 'object' },
        { input: 'currency', expected: 'currency' },
        { input: 'percentage', expected: 'percentage' },
        { input: 'unknown-type', expected: 'text' },
      ];

      testCases.forEach(({ input, expected }) => {
        const result = formGenerator['mapFieldType'](input);
        expect(result).toBe(expected);
      });
    });

    it('should infer type from schema when no explicit type provided', () => {
      const schema = z.object({
        textField: z.string(),
        numberField: z.number(),
        booleanField: z.boolean(),
        memoField: z.string(),
        priceField: z.number(),
      });

      const textType = formGenerator['inferTypeFromSchema'](schema, 'textField');
      const numberType = formGenerator['inferTypeFromSchema'](schema, 'numberField');
      const booleanType = formGenerator['inferTypeFromSchema'](schema, 'booleanField');

      expect(textType).toBe('text');
      expect(numberType).toBe('number');
      expect(booleanType).toBe('checkbox');
    });

    it('should detect field types from field path', () => {
      mockFieldTypeRegistry.detectType.mockReturnValue('email');

      const result = formGenerator['mapFieldType'](undefined, undefined, 'email');

      expect(mockFieldTypeRegistry.detectType).toHaveBeenCalledWith('email');
      expect(result).toBe('email');
    });
  });

  describe('field priority determination', () => {
    it('should return essential priority for required fields', () => {
      const priority = formGenerator['getFieldPriority']('name', undefined, true);
      expect(priority).toBe('essential');
    });

    it('should use render config priority when available', () => {
      const renderConfig: RenderConfigSchema = {
        ui: { priority: 'advanced' },
      };

      const priority = formGenerator['getFieldPriority']('name', renderConfig, false);
      expect(priority).toBe('advanced');
    });

    it('should return advanced priority for advanced UI fields', () => {
      const renderConfig: RenderConfigSchema = {
        ui: { advanced: true },
      };

      const priority = formGenerator['getFieldPriority']('name', renderConfig, false);
      expect(priority).toBe('advanced');
    });

    it('should return expert priority for expert UI fields', () => {
      const renderConfig: RenderConfigSchema = {
        ui: { expert: true },
      };

      const priority = formGenerator['getFieldPriority']('name', renderConfig, false);
      expect(priority).toBe('expert');
    });

    it('should default to common priority', () => {
      const priority = formGenerator['getFieldPriority']('name', undefined, false);
      expect(priority).toBe('common');
    });
  });

  describe('field requirement determination', () => {
    it('should return true for required fields in schema', () => {
      const schema = z.object({
        requiredField: z.string(),
        optionalField: z.string().optional(),
      });

      const isRequired = formGenerator['isFieldRequired'](schema, 'requiredField');
      const isOptional = formGenerator['isFieldRequired'](schema, 'optionalField');

      expect(isRequired).toBe(true);
      expect(isOptional).toBe(false);
    });

    it('should return false for fields with default values', () => {
      const schema = z.object({
        fieldWithDefault: z.string().default('default-value'),
      });

      const result = formGenerator['isFieldRequired'](schema, 'fieldWithDefault');
      expect(result).toBe(false);
    });

    it('should return false when schema or fieldPath is missing', () => {
      expect(formGenerator['isFieldRequired'](undefined, 'field')).toBe(false);
      expect(formGenerator['isFieldRequired'](z.string(), undefined)).toBe(false);
      expect(formGenerator['isFieldRequired'](undefined, undefined)).toBe(false);
    });

    it('should handle errors gracefully', () => {
      const invalidSchema = {} as z.ZodSchema;
      const result = formGenerator['isFieldRequired'](invalidSchema, 'field');
      expect(result).toBe(false);
      expect(mockLoggerInstance.debug).toHaveBeenCalled();
    });
  });

  describe('form field creation', () => {
    it('should create form field with all properties', () => {
      const renderConfig: RenderConfigSchema = {
        ui: {
          label: 'Custom Label',
          placeholder: 'Enter value',
          helpText: 'This is help text',
        },
        constraints: {
          min: 1,
          max: 100,
          minLength: 2,
          maxLength: 50,
          pattern: '^[A-Za-z]+$',
        },
        options: [
          { value: 'option1', label: 'Option 1' },
          { value: 'option2', label: 'Option 2', disabled: true },
        ],
        fieldType: 'text',
      };

      const schema = z.object({
        testField: z.string(),
      });

      const field = formGenerator['createFormField'](
        'testField',
        renderConfig,
        schema,
        'testField',
        'test-tool'
      );

      expect(field).toEqual({
        name: 'testField',
        label: 'Custom Label',
        type: 'text',
        required: true,
        priority: 'essential',
        placeholder: 'Enter value',
        helpText: 'This is help text',
        renderConfig,
        validation: {
          min: 1,
          max: 100,
          minLength: 2,
          maxLength: 50,
          pattern: '^[A-Za-z]+$',
        },
        options: [
          { value: 'option1', label: 'Option 1' },
          { value: 'option2', label: 'Option 2', disabled: true },
        ],
      });
    });

    it('should apply field guidance when available', () => {
      const guidance = {
        fieldTypeOverride: 'textarea' as FormFieldType,
        suggestions: ['example1', 'example2'],
        predefinedOptions: [{ value: 'option1', label: 'Option 1' }],
        contextualHelpText: 'Guidance help text',
        warnings: [{ message: 'Warning message' }],
        validationRules: {
          qualityChecks: {
            minNonTechnicalWords: 5,
            forbidTechnicalTerms: ['tech', 'api'],
          },
        },
      };

      mockFieldGuidanceRegistry.getFieldGuidance.mockReturnValue(guidance);

      const field = formGenerator['createFormField'](
        'testField',
        undefined,
        undefined,
        undefined,
        'test-tool'
      );

      expect(field.type).toBe('textarea');
      expect(field.suggestions).toEqual(['example1', 'example2']);
      expect(field.options).toEqual([{ value: 'option1', label: 'Option 1' }]);
      expect(field.helpText).toBe('Guidance help text');
      expect(field.warnings).toEqual(['Warning message']);
      expect(field.contextualGuidance).toBeDefined();
      expect(field.placeholder).toBe('e.g., example1');
    });

    it('should humanize field names correctly', () => {
      const testCases = [
        { input: 'firstName', expected: 'First Name' },
        { input: 'user_email', expected: 'User Email' },
        { input: 'account.balance', expected: 'Account Balance' },
        { input: 'APIKey', expected: 'A P I Key' },
      ];

      testCases.forEach(({ input, expected }) => {
        const result = formGenerator['humanizeFieldName'](input);
        expect(result).toBe(expected);
      });
    });
  });

  describe('form configuration creation', () => {
    it('should create form config with global guidance', () => {
      const globalGuidance = {
        qualityStandards: ['Standard 1', 'Standard 2'],
      };

      mockFieldGuidanceRegistry.getGlobalGuidance.mockReturnValue(globalGuidance);

      const schema = z.object({ name: z.string() });
      const missingFields = new Set(['name']);

      const config = formGenerator['createFormConfig'](
        schema,
        missingFields,
        'test-tool'
      );

      expect(config.title).toBe('Complete Test Information');
      expect(config.description).toContain('Quality Guidelines:');
      expect(config.description).toContain('Standard 1');
      expect(config.description).toContain('Standard 2');
      expect(config.metadata).toEqual({
        toolName: 'test-tool',
        missingFieldCount: 1,
        globalGuidance,
      });
    });

    it('should generate form title correctly', () => {
      const testCases = [
        { input: 'testTool', expected: 'Complete  Test  Information' },
        { input: 'HederaAccountTool', expected: 'Complete  Account  Information' },
        { input: 'simpleTool', expected: 'Complete Simple  Information' },
      ];

      testCases.forEach(({ input, expected }) => {
        const result = formGenerator['generateFormTitle'](input);
        expect(result).toBe(expected);
      });
    });

    it('should generate form description based on field count', () => {
      const singleField = formGenerator['generateFormDescription']('test-tool', 1);
      const multipleFields = formGenerator['generateFormDescription']('test-tool', 3);
      const noFields = formGenerator['generateFormDescription']('test-tool', 0);

      expect(singleField).toBe(
        'Please provide the following 1 required field to continue with your request.'
      );
      expect(multipleFields).toBe(
        'Please provide the following 3 required fields to continue with your request.'
      );
      expect(noFields).toBe(
        'Please provide the required information to continue with your request.'
      );
    });
  });

  describe('schema field extraction', () => {
    it('should extract fields from ZodObject schema', () => {
      const schema = z.object({
        field1: z.string(),
        field2: z.number(),
        field3: z.boolean(),
      });

      const fields = formGenerator['extractFieldsFromSchema'](schema);
      expect(fields).toEqual(['field1', 'field2', 'field3']);
    });

    it('should extract fields from ZodUnion with object options', () => {
      const schema = z.union([
        z.object({ option1: z.string() }),
        z.object({ option2: z.number() }),
      ]);

      const fields = formGenerator['extractFieldsFromSchema'](schema);
      expect(fields).toEqual(['option1']);
    });

    it('should return empty array for non-extractable schemas', () => {
      const schema = z.string();
      const fields = formGenerator['extractFieldsFromSchema'](schema);
      expect(fields).toEqual([]);
    });

    it('should handle schema extraction errors', () => {
      const invalidSchema = {} as z.ZodSchema;
      const fields = formGenerator['extractFieldsFromSchema'](invalidSchema);
      expect(fields).toEqual([]);
      expect(mockLoggerInstance.debug).toHaveBeenCalled();
    });
  });

  describe('render config extraction', () => {
    it('should extract render configs safely', () => {
      const mockConfig: ExtractedRenderConfig = {
        fields: { name: { ui: { label: 'Name' } } },
        groups: {},
        order: ['name'],
        metadata: { version: '1.0' },
      };

      mockExtractRenderConfigs.mockReturnValue(mockConfig);

      const schema = z.object({ name: z.string() });
      const result = formGenerator['extractRenderConfigsSafely'](schema);

      expect(result).toEqual(mockConfig);
      expect(mockExtractRenderConfigs).toHaveBeenCalledWith(schema);
    });

    it('should handle render config extraction errors', () => {
      mockExtractRenderConfigs.mockImplementation(() => {
        throw new Error('Extraction failed');
      });

      const schema = z.object({ name: z.string() });
      const result = formGenerator['extractRenderConfigsSafely'](schema);

      expect(result).toEqual({
        fields: {},
        groups: {},
        order: [],
        metadata: {},
      });
      expect(mockLoggerInstance.warn).toHaveBeenCalledWith(
        'Could not extract render configs:',
        expect.any(Error)
      );
    });
  });

  describe('field ordering generation', () => {
    it('should generate field ordering safely', () => {
      const mockOrdering = {
        sections: {
          section1: { fields: ['field1', 'field2'] },
          section2: { fields: ['field3'] },
        },
      };

      mockGenerateFieldOrdering.mockReturnValue(mockOrdering);

      const schema = z.object({
        field1: z.string(),
        field2: z.string(),
        field3: z.string(),
      });

      const result = formGenerator['generateFieldOrderingSafely'](schema);

      expect(result.sections).toEqual([
        { fields: ['field1', 'field2'] },
        { fields: ['field3'] },
      ]);
      expect(mockGenerateFieldOrdering).toHaveBeenCalledWith(schema);
    });

    it('should handle field ordering generation errors', () => {
      mockGenerateFieldOrdering.mockImplementation(() => {
        throw new Error('Ordering failed');
      });

      const schema = z.object({ name: z.string() });
      const result = formGenerator['generateFieldOrderingSafely'](schema);

      expect(result).toEqual({ sections: [] });
      expect(mockLoggerInstance.warn).toHaveBeenCalledWith(
        'Could not generate field ordering:',
        expect.any(Error)
      );
    });
  });

  describe('generateJsonSchemaForm', () => {
    it('should generate JSON schema and UI schema', () => {
      const zodSchema = z.object({
        name: z.string(),
        age: z.number(),
        email: z.string().optional(),
      });

      const mockJsonSchema = {
        type: 'object',
        properties: {
          name: { type: 'string' },
          age: { type: 'number' },
          email: { type: 'string' },
        },
        required: ['name', 'age'],
      };

      mockZodToJsonSchema.mockReturnValue(mockJsonSchema);

      const result = formGenerator.generateJsonSchemaForm(zodSchema);

      expect(result.jsonSchema).toEqual(mockJsonSchema);
      expect(result.uiSchema).toBeDefined();
      expect(mockZodToJsonSchema).toHaveBeenCalledWith(zodSchema, {
        target: 'jsonSchema7',
      });
    });

    it('should filter schema by missing fields', () => {
      const zodSchema = z.object({
        name: z.string(),
        age: z.number(),
        email: z.string(),
      });

      const mockJsonSchema = {
        type: 'object',
        properties: {
          name: { type: 'string' },
          age: { type: 'number' },
          email: { type: 'string' },
        },
        required: ['name', 'age', 'email'],
      };

      mockZodToJsonSchema.mockReturnValue(mockJsonSchema);

      const missingFields = new Set(['name', 'email']);
      const result = formGenerator.generateJsonSchemaForm(
        zodSchema,
        { age: 25 },
        missingFields
      );

      expect(result.jsonSchema).toEqual({
        type: 'object',
        properties: {
          name: { type: 'string' },
          email: { type: 'string' },
        },
        required: ['name', 'email'],
      });
    });

    it('should generate appropriate UI schema for different field types', () => {
      const zodSchema = z.object({
        attributes: z.record(z.string()),
        metadata: z.object({}),
        requiredField: z.string(),
        expertField: z.string().optional(),
      });

      const result = formGenerator.generateJsonSchemaForm(zodSchema);

      expect(result.uiSchema.attributes).toEqual({
        'ui:options': {
          collapsible: true,
          collapsed: true,
        },
      });
      expect(result.uiSchema.metadata).toEqual({
        'ui:options': {
          collapsible: true,
          collapsed: true,
        },
      });
      expect(result.uiSchema.requiredField).toEqual({
        'ui:help': 'Required field',
      });
    });
  });

  describe('error handling and edge cases', () => {
    it('should handle undefined render config function gracefully', () => {
      (extractRenderConfigs as any) = undefined;

      const schema = z.object({ name: z.string() });
      const result = formGenerator['extractRenderConfigsSafely'](schema);

      expect(result).toEqual({
        fields: {},
        groups: {},
        order: [],
        metadata: {},
      });
    });

    it('should handle undefined field ordering function gracefully', () => {
      (generateFieldOrdering as any) = undefined;

      const schema = z.object({ name: z.string() });
      const result = formGenerator['generateFieldOrderingSafely'](schema);

      expect(result).toEqual({ sections: [] });
    });

    it('should handle empty missing fields set', () => {
      const schema = z.object({ name: z.string() });
      const missingFields = new Set<string>();

      const fields = formGenerator['generateFormFields'](
        schema,
        { fields: {}, groups: {}, order: [], metadata: {} },
        missingFields,
        { sections: [] }
      );

      expect(fields).toBeDefined();
    });

    it('should handle schema extraction errors gracefully', () => {
      const schema = z.object({ name: z.string() });
      
      // Mock the extractZodObject method to return null
      formGenerator['extractZodObject'] = jest.fn().mockReturnValue(null);

      const fields = formGenerator['extractFieldsFromSchema'](schema);
      expect(fields).toEqual([]);
    });

    it('should handle missing field guidance gracefully', () => {
      mockFieldGuidanceRegistry.getFieldGuidance.mockReturnValue(null);

      const field = formGenerator['createFormField'](
        'testField',
        undefined,
        undefined,
        undefined,
        'test-tool'
      );

      expect(field.type).toBe('text');
      expect(field.name).toBe('testField');
    });
  });
});