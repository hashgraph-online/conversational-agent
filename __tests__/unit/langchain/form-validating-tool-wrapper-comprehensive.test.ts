import { z } from 'zod';
import { StructuredTool } from '@langchain/core/tools';
import { CallbackManagerForToolRun } from '@langchain/core/callbacks/manager';
import { FormValidatingToolWrapper, wrapToolWithFormValidation, FormValidationConfig } from '../../../src/langchain/form-validating-tool-wrapper';
import { FormGenerator } from '../../../src/forms/form-generator';
import type { FormMessage } from '../../../src/forms/types';

interface MockFormValidatableTool {
  shouldGenerateForm(input: Record<string, unknown>): boolean;
  getFormSchema(): z.ZodSchema;
  getEssentialFields(): string[];
  isFieldEmpty(fieldName: string, value: unknown): boolean;
}

class MockStructuredTool extends StructuredTool {
  name: string;
  description: string;
  schema: z.ZodObject<z.ZodRawShape>;
  mockCall: jest.Mock;

  constructor(
    name: string, 
    description: string, 
    schema: z.ZodObject<z.ZodRawShape>,
    callResult?: string | Error
  ) {
    super();
    this.name = name;
    this.description = description;
    this.schema = schema;
    this.mockCall = jest.fn();
    
    if (callResult instanceof Error) {
      this.mockCall.mockRejectedValue(callResult);
    } else {
      this.mockCall.mockResolvedValue(callResult || `${name} executed successfully`);
    }
  }

  protected async _call(
    input: z.infer<typeof this.schema>,
    _runManager?: CallbackManagerForToolRun
  ): Promise<string> {
    return this.mockCall(input);
  }
}

class MockFormValidatableStructuredTool extends MockStructuredTool implements MockFormValidatableTool {
  customFormSchema?: z.ZodSchema;
  customEssentialFields?: string[];
  customShouldGenerateForm?: (input: Record<string, unknown>) => boolean;
  customIsFieldEmpty?: (fieldName: string, value: unknown) => boolean;

  shouldGenerateForm(input: Record<string, unknown>): boolean {
    if (this.customShouldGenerateForm) {
      return this.customShouldGenerateForm(input);
    }
    return Object.values(input).some(value => value === '' || value === undefined || value === null);
  }

  getFormSchema(): z.ZodSchema {
    return this.customFormSchema || this.schema;
  }

  getEssentialFields(): string[] {
    return this.customEssentialFields || Object.keys(this.schema.shape);
  }

  isFieldEmpty(fieldName: string, value: unknown): boolean {
    if (this.customIsFieldEmpty) {
      return this.customIsFieldEmpty(fieldName, value);
    }
    return value === undefined || value === null || value === '';
  }
}

const createMockFormGenerator = (): jest.Mocked<FormGenerator> => ({
  generateFormFromSchema: jest.fn().mockResolvedValue({
    id: 'mock-form-id',
    fields: [],
  }),
  generateJsonSchemaForm: jest.fn().mockReturnValue({
    jsonSchema: {},
    uiSchema: {},
  }),
} as any);

describe('FormValidatingToolWrapper Comprehensive Tests', () => {
  let mockFormGenerator: jest.Mocked<FormGenerator>;

  beforeEach(() => {
    mockFormGenerator = createMockFormGenerator();
  });

  describe('Constructor and Initialization', () => {
    it('should initialize with basic tool', () => {
      const schema = z.object({ input: z.string() });
      const originalTool = new MockStructuredTool('test-tool', 'Test tool description', schema);
      
      const wrapper = new FormValidatingToolWrapper(originalTool, mockFormGenerator);
      
      expect(wrapper.name).toBe('test-tool');
      expect(wrapper.description).toBe('Test tool description');
      expect(wrapper.schema).toBe(schema);
    });

    it('should initialize with validation config', () => {
      const schema = z.object({ input: z.string() });
      const originalTool = new MockStructuredTool('test-tool', 'Test tool description', schema);
      const config: FormValidationConfig = {
        requireAllFields: true,
        skipFields: ['optional'],
        customValidation: (input) => typeof input === 'object',
      };
      
      const wrapper = new FormValidatingToolWrapper(originalTool, mockFormGenerator, config);
      
      expect(wrapper).toBeInstanceOf(FormValidatingToolWrapper);
      expect(wrapper.name).toBe('test-tool');
    });
  });

  describe('Input Validation', () => {
    it('should validate valid input', () => {
      const schema = z.object({
        name: z.string(),
        age: z.number(),
      });
      const originalTool = new MockStructuredTool('validation-tool', 'Validation test', schema);
      const wrapper = new FormValidatingToolWrapper(originalTool, mockFormGenerator);
      
      const validation = wrapper['validateInput']({ name: 'John', age: 25 });
      
      expect(validation.isValid).toBe(true);
      expect(validation.errors).toBeUndefined();
    });

    it('should validate invalid input', () => {
      const schema = z.object({
        name: z.string(),
        age: z.number(),
      });
      const originalTool = new MockStructuredTool('validation-tool', 'Validation test', schema);
      const wrapper = new FormValidatingToolWrapper(originalTool, mockFormGenerator);
      
      const validation = wrapper['validateInput']({ name: 'John', age: 'invalid' });
      
      expect(validation.isValid).toBe(false);
      expect(validation.errors).toBeDefined();
      expect(validation.errors!.length).toBeGreaterThan(0);
    });

    it('should skip fields in validation', () => {
      const schema = z.object({
        required: z.string(),
        optional: z.string(),
      });
      const originalTool = new MockStructuredTool('skip-tool', 'Skip test', schema);
      const config: FormValidationConfig = { skipFields: ['optional'] };
      const wrapper = new FormValidatingToolWrapper(originalTool, mockFormGenerator, config);
      
      const validation = wrapper['validateInput']({ required: 'present' });
      
      expect(validation.isValid).toBe(true);
    });

    it('should handle custom validation', () => {
      const schema = z.object({ input: z.string() });
      const originalTool = new MockStructuredTool('custom-tool', 'Custom validation', schema);
      const config: FormValidationConfig = {
        customValidation: (input: unknown) => {
          const record = input as Record<string, unknown>;
          return record.input === 'valid';
        },
      };
      const wrapper = new FormValidatingToolWrapper(originalTool, mockFormGenerator, config);
      
      expect(wrapper['shouldGenerateForm']({ input: 'valid' })).toBe(false);
      expect(wrapper['shouldGenerateForm']({ input: 'invalid' })).toBe(true);
    });
  });

  describe('Schema Shape Analysis', () => {
    it('should extract schema shape for ZodObject', () => {
      const schema = z.object({
        field1: z.string(),
        field2: z.number(),
        field3: z.boolean(),
      });
      const originalTool = new MockStructuredTool('shape-tool', 'Shape test', schema);
      const wrapper = new FormValidatingToolWrapper(originalTool, mockFormGenerator);
      
      const shape = wrapper['getSchemaShape']();
      
      expect(shape).toEqual(['field1', 'field2', 'field3']);
    });

    it('should handle non-ZodObject schemas', () => {
      const schema = z.string() as any;
      const originalTool = new MockStructuredTool('non-object-tool', 'Non-object test', schema);
      const wrapper = new FormValidatingToolWrapper(originalTool, mockFormGenerator);
      
      const shape = wrapper['getSchemaShape']();
      
      expect(shape).toEqual([]);
    });
  });

  describe('Original Tool Execution', () => {
    it('should execute original tool with _call method', async () => {
      const schema = z.object({ input: z.string() });
      const originalTool = new MockStructuredTool('original-tool', 'Original test', schema, 'original result');
      const wrapper = new FormValidatingToolWrapper(originalTool, mockFormGenerator);
      
      const result = await wrapper.executeOriginal({ input: 'test' });
      
      expect(result).toBe('original result');
      expect(originalTool.mockCall).toHaveBeenCalledWith({ input: 'test' });
    });

    it('should execute original tool with call method', async () => {
      const schema = z.object({ input: z.string() });
      const originalTool = new MockStructuredTool('original-tool', 'Original test', schema, 'call result');
      
      delete (originalTool as any)._call;
      (originalTool as any).call = jest.fn().mockResolvedValue('call result');
      
      const wrapper = new FormValidatingToolWrapper(originalTool, mockFormGenerator);
      
      const result = await wrapper.executeOriginal({ input: 'test' });
      
      expect(result).toBe('call result');
    });

    it('should throw error if no callable method exists', async () => {
      const schema = z.object({ input: z.string() });
      const originalTool = new MockStructuredTool('no-call-tool', 'No call test', schema);
      
      delete (originalTool as any)._call;
      delete (originalTool as any).call;
      
      const wrapper = new FormValidatingToolWrapper(originalTool, mockFormGenerator);
      
      await expect(wrapper.executeOriginal({ input: 'test' })).rejects.toThrow('Original tool has no callable implementation');
    });
  });

  describe('Original Tool Access', () => {
    it('should provide access to original tool', () => {
      const schema = z.object({ input: z.string() });
      const originalTool = new MockStructuredTool('access-tool', 'Access test', schema);
      const wrapper = new FormValidatingToolWrapper(originalTool, mockFormGenerator);
      
      const retrieved = wrapper.getOriginalTool();
      
      expect(retrieved).toBe(originalTool);
    });
  });

  describe('FormValidatable Interface Support', () => {
    it('should use custom form schema from FormValidatable tool', () => {
      const originalSchema = z.object({ original: z.string() });
      const customSchema = z.object({ custom: z.string() });
      
      const originalTool = new MockFormValidatableStructuredTool('custom-schema-tool', 'Custom schema', originalSchema);
      originalTool.customFormSchema = customSchema;
      
      const wrapper = new FormValidatingToolWrapper(originalTool, mockFormGenerator);
      
      const schema = wrapper.getFormSchema();
      
      expect(schema).toBe(customSchema);
    });

    it('should fallback to original schema for non-FormValidatable tools', () => {
      const schema = z.object({ input: z.string() });
      const originalTool = new MockStructuredTool('fallback-tool', 'Fallback test', schema);
      const wrapper = new FormValidatingToolWrapper(originalTool, mockFormGenerator);
      
      const formSchema = wrapper.getFormSchema();
      
      expect(formSchema).toBe(schema);
    });

    it('should get essential fields from FormValidatable tool', () => {
      const schema = z.object({ field1: z.string(), field2: z.number() });
      const originalTool = new MockFormValidatableStructuredTool('essential-tool', 'Essential test', schema);
      originalTool.customEssentialFields = ['field1'];
      
      const wrapper = new FormValidatingToolWrapper(originalTool, mockFormGenerator);
      
      const essential = wrapper.getEssentialFields();
      
      expect(essential).toEqual(['field1']);
    });

    it('should return empty array for non-FormValidatable tools', () => {
      const schema = z.object({ field1: z.string() });
      const originalTool = new MockStructuredTool('non-essential-tool', 'Non-essential test', schema);
      const wrapper = new FormValidatingToolWrapper(originalTool, mockFormGenerator);
      
      const essential = wrapper.getEssentialFields();
      
      expect(essential).toEqual([]);
    });

    it('should check field emptiness with custom logic', () => {
      const schema = z.object({ field: z.string() });
      const originalTool = new MockFormValidatableStructuredTool('empty-check-tool', 'Empty check', schema);
      originalTool.customIsFieldEmpty = (fieldName, value) => value === 'custom-empty';
      
      const wrapper = new FormValidatingToolWrapper(originalTool, mockFormGenerator);
      
      expect(wrapper.isFieldEmpty('field', 'custom-empty')).toBe(true);
      expect(wrapper.isFieldEmpty('field', 'not-empty')).toBe(false);
    });

    it('should use default emptiness check for non-FormValidatable tools', () => {
      const schema = z.object({ field: z.string() });
      const originalTool = new MockStructuredTool('default-empty-tool', 'Default empty', schema);
      const wrapper = new FormValidatingToolWrapper(originalTool, mockFormGenerator);
      
      expect(wrapper.isFieldEmpty('field', undefined)).toBe(true);
      expect(wrapper.isFieldEmpty('field', null)).toBe(true);
      expect(wrapper.isFieldEmpty('field', '')).toBe(true);
      expect(wrapper.isFieldEmpty('field', [])).toBe(true);
      expect(wrapper.isFieldEmpty('field', 'value')).toBe(false);
    });
  });

  describe('Missing Fields Calculation', () => {
    it('should calculate missing fields for FormValidatable tools', () => {
      const schema = z.object({ field1: z.string(), field2: z.string() });
      const originalTool = new MockFormValidatableStructuredTool('missing-fields-tool', 'Missing fields', schema);
      originalTool.customEssentialFields = ['field1', 'field2'];
      
      const wrapper = new FormValidatingToolWrapper(originalTool, mockFormGenerator);
      
      const missing = wrapper['calculateMissingFields']({ field1: 'present' }, true);
      
      expect(missing).toEqual(new Set(['field2']));
    });

    it('should return empty set for non-custom tools', () => {
      const schema = z.object({ field1: z.string() });
      const originalTool = new MockStructuredTool('non-custom-tool', 'Non-custom', schema);
      const wrapper = new FormValidatingToolWrapper(originalTool, mockFormGenerator);
      
      const missing = wrapper['calculateMissingFields']({}, false);
      
      expect(missing).toEqual(new Set());
    });
  });

  describe('Form Message Creation', () => {
    it('should create form message for ZodObject schema', async () => {
      const schema = z.object({ field: z.string() });
      const originalTool = new MockStructuredTool('form-message-tool', 'Form message', schema);
      const wrapper = new FormValidatingToolWrapper(originalTool, mockFormGenerator);
      
      const mockFormMessage: FormMessage = {
        id: 'test-form',
        fields: [{ name: 'field', type: 'text', label: 'Field', required: true }],
      };
      
      mockFormGenerator.generateFormFromSchema.mockResolvedValue(mockFormMessage);
      mockFormGenerator.generateJsonSchemaForm.mockReturnValue({
        jsonSchema: { type: 'object' },
        uiSchema: { field: { 'ui:widget': 'text' } },
      });
      
      const formMessage = await wrapper['createFormMessage'](schema, { field: '' }, new Set(['field']));
      
      expect(formMessage).toHaveProperty('id', 'test-form');
      expect(formMessage).toHaveProperty('jsonSchema');
      expect(formMessage).toHaveProperty('uiSchema');
      expect(formMessage).toHaveProperty('partialInput');
    });

    it('should handle JSON schema generation errors', async () => {
      const schema = z.object({ field: z.string() });
      const originalTool = new MockStructuredTool('error-form-tool', 'Error form', schema);
      const wrapper = new FormValidatingToolWrapper(originalTool, mockFormGenerator);
      
      const mockFormMessage: FormMessage = { id: 'test-form', fields: [] };
      mockFormGenerator.generateFormFromSchema.mockResolvedValue(mockFormMessage);
      mockFormGenerator.generateJsonSchemaForm.mockImplementation(() => {
        throw new Error('JSON Schema generation failed');
      });
      
      const formMessage = await wrapper['createFormMessage'](schema, {}, new Set());
      
      expect(formMessage).toHaveProperty('id', 'test-form');
      expect(formMessage).not.toHaveProperty('jsonSchema');
    });
  });

  describe('Form Generation Decision Logic', () => {
    it('should use custom validation when provided', () => {
      const schema = z.object({ input: z.string() });
      const originalTool = new MockStructuredTool('custom-validation-tool', 'Custom validation', schema);
      const config: FormValidationConfig = {
        customValidation: (input) => (input as any).input === 'valid',
      };
      const wrapper = new FormValidatingToolWrapper(originalTool, mockFormGenerator, config);
      
      expect(wrapper['shouldGenerateForm']({ input: 'valid' })).toBe(false);
      expect(wrapper['shouldGenerateForm']({ input: 'invalid' })).toBe(true);
    });

    it('should use FormValidatable logic when available', () => {
      const schema = z.object({ input: z.string() });
      const originalTool = new MockFormValidatableStructuredTool('form-validatable-tool', 'FormValidatable', schema);
      originalTool.customShouldGenerateForm = (input) => input.input === 'generate-form';
      
      const wrapper = new FormValidatingToolWrapper(originalTool, mockFormGenerator);
      
      expect(wrapper['shouldGenerateForm']({ input: 'generate-form' })).toBe(true);
      expect(wrapper['shouldGenerateForm']({ input: 'no-form' })).toBe(false);
    });

    it('should fall back to schema validation', () => {
      const schema = z.object({ required: z.string() });
      const originalTool = new MockStructuredTool('schema-validation-tool', 'Schema validation', schema);
      const wrapper = new FormValidatingToolWrapper(originalTool, mockFormGenerator);
      
      expect(wrapper['shouldGenerateForm']({ required: 'present' })).toBe(false);
      expect(wrapper['shouldGenerateForm']({ required: '' })).toBe(true);
    });
  });

  describe('Form Bypass Logic', () => {
    it('should detect __fromForm bypass flag', () => {
      const schema = z.object({ input: z.string() });
      const originalTool = new MockStructuredTool('bypass-tool', 'Bypass test', schema);
      const wrapper = new FormValidatingToolWrapper(originalTool, mockFormGenerator);
      
      expect(wrapper['hasFormBypassFlags']({ __fromForm: true })).toBe(true);
      expect(wrapper['hasFormBypassFlags']({ __fromForm: false })).toBe(false);
    });

    it('should detect renderForm bypass flag', () => {
      const schema = z.object({ input: z.string() });
      const originalTool = new MockStructuredTool('render-bypass-tool', 'Render bypass', schema);
      const wrapper = new FormValidatingToolWrapper(originalTool, mockFormGenerator);
      
      expect(wrapper['hasFormBypassFlags']({ renderForm: false })).toBe(true);
      expect(wrapper['hasFormBypassFlags']({ renderForm: true })).toBe(false);
    });

    it('should not detect bypass when flags are absent', () => {
      const schema = z.object({ input: z.string() });
      const originalTool = new MockStructuredTool('no-bypass-tool', 'No bypass', schema);
      const wrapper = new FormValidatingToolWrapper(originalTool, mockFormGenerator);
      
      expect(wrapper['hasFormBypassFlags']({ input: 'test' })).toBe(false);
    });
  });

  describe('Type Guards', () => {
    it('should correctly identify ZodObject types', () => {
      const schema = z.object({ field: z.string() });
      const originalTool = new MockStructuredTool('type-guard-tool', 'Type guard', schema);
      const wrapper = new FormValidatingToolWrapper(originalTool, mockFormGenerator);
      
      expect(wrapper['isZodObject'](z.object({ field: z.string() }))).toBe(true);
      expect(wrapper['isZodObject'](z.string())).toBe(false);
      expect(wrapper['isZodObject'](z.array(z.string()))).toBe(false);
    });

    it('should detect FormValidatable methods', () => {
      const schema = z.object({ field: z.string() });
      const originalTool = new MockFormValidatableStructuredTool('method-detection-tool', 'Method detection', schema);
      const wrapper = new FormValidatingToolWrapper(originalTool, mockFormGenerator);
      
      expect(wrapper['hasFormValidatableMethod'](originalTool, 'shouldGenerateForm')).toBe(true);
      expect(wrapper['hasFormValidatableMethod'](originalTool, 'nonExistentMethod')).toBe(false);
      expect(wrapper['hasFormValidatableMethod'](null, 'shouldGenerateForm')).toBe(false);
    });
  });

  describe('Main _call Method', () => {
    it('should bypass form generation when __fromForm is true', async () => {
      const schema = z.object({ input: z.string() });
      const originalTool = new MockStructuredTool('bypass-form-tool', 'Bypass form', schema, 'bypassed result');
      const wrapper = new FormValidatingToolWrapper(originalTool, mockFormGenerator);
      
      const result = await wrapper._call({ input: 'test', __fromForm: true } as any);
      
      expect(result).toBe('bypassed result');
      expect(originalTool.mockCall).toHaveBeenCalledWith({ input: 'test', __fromForm: true });
    });

    it('should bypass form generation when renderForm is false', async () => {
      const schema = z.object({ input: z.string() });
      const originalTool = new MockStructuredTool('render-false-tool', 'Render false', schema, 'no render result');
      const wrapper = new FormValidatingToolWrapper(originalTool, mockFormGenerator);
      
      const result = await wrapper._call({ input: 'test', renderForm: false } as any);
      
      expect(result).toBe('no render result');
    });

    it('should generate form when validation fails', async () => {
      const schema = z.object({ required: z.string() });
      const originalTool = new MockStructuredTool('form-generation-tool', 'Form generation', schema);
      const wrapper = new FormValidatingToolWrapper(originalTool, mockFormGenerator);
      
      const mockFormMessage: FormMessage = {
        id: 'generated-form',
        fields: [{ name: 'required', type: 'text', label: 'Required', required: true }],
      };
      mockFormGenerator.generateFormFromSchema.mockResolvedValue(mockFormMessage);
      
      const result = await wrapper._call({ required: '' } as any);
      
      const parsedResult = JSON.parse(result);
      expect(parsedResult.requiresForm).toBe(true);
      expect(parsedResult.formMessage).toEqual(mockFormMessage);
      expect(parsedResult.message).toContain('form-generation-tool');
    });

    it('should execute original tool when validation passes', async () => {
      const schema = z.object({ input: z.string() });
      const originalTool = new MockStructuredTool('valid-input-tool', 'Valid input', schema, 'validation passed');
      const wrapper = new FormValidatingToolWrapper(originalTool, mockFormGenerator);
      
      const result = await wrapper._call({ input: 'valid' } as any);
      
      expect(result).toBe('validation passed');
      expect(originalTool.mockCall).toHaveBeenCalledWith({ input: 'valid' });
    });

    it('should handle form generation errors gracefully', async () => {
      const schema = z.object({ required: z.string() });
      const originalTool = new MockStructuredTool('error-generation-tool', 'Error generation', schema, 'fallback result');
      const wrapper = new FormValidatingToolWrapper(originalTool, mockFormGenerator);
      
      mockFormGenerator.generateFormFromSchema.mockRejectedValue(new Error('Form generation failed'));
      
      const result = await wrapper._call({ required: '' } as any);
      
      expect(result).toBe('fallback result');
    });

    it('should use custom schema for FormValidatable tools', async () => {
      const originalSchema = z.object({ original: z.string() });
      const customSchema = z.object({ custom: z.string() });
      
      const originalTool = new MockFormValidatableStructuredTool('custom-schema-exec-tool', 'Custom schema exec', originalSchema);
      originalTool.customFormSchema = customSchema;
      originalTool.customShouldGenerateForm = () => true;
      
      const wrapper = new FormValidatingToolWrapper(originalTool, mockFormGenerator);
      
      const mockFormMessage: FormMessage = { id: 'custom-form', fields: [] };
      mockFormGenerator.generateFormFromSchema.mockResolvedValue(mockFormMessage);
      
      const result = await wrapper._call({ custom: '' } as any);
      
      expect(mockFormGenerator.generateFormFromSchema).toHaveBeenCalledWith(
        customSchema,
        { custom: '' },
        expect.any(Object),
        expect.any(Set)
      );
    });
  });

  describe('Wrapper Function', () => {
    it('should create wrapper using convenience function', () => {
      const schema = z.object({ input: z.string() });
      const originalTool = new MockStructuredTool('wrapper-function-tool', 'Wrapper function', schema);
      const config: FormValidationConfig = { requireAllFields: true };
      
      const wrapper = wrapToolWithFormValidation(originalTool, mockFormGenerator, config);
      
      expect(wrapper).toBeInstanceOf(FormValidatingToolWrapper);
      expect(wrapper.name).toBe('wrapper-function-tool');
    });

    it('should create wrapper with default config', () => {
      const schema = z.object({ input: z.string() });
      const originalTool = new MockStructuredTool('default-config-tool', 'Default config', schema);
      
      const wrapper = wrapToolWithFormValidation(originalTool, mockFormGenerator);
      
      expect(wrapper).toBeInstanceOf(FormValidatingToolWrapper);
    });
  });

  describe('Complex Schema Scenarios', () => {
    it('should handle nested object schemas', async () => {
      const schema = z.object({
        user: z.object({
          name: z.string(),
          email: z.string().email(),
        }),
        settings: z.object({
          theme: z.enum(['light', 'dark']),
          notifications: z.boolean(),
        }),
      });
      
      const originalTool = new MockStructuredTool('nested-schema-tool', 'Nested schema', schema);
      const wrapper = new FormValidatingToolWrapper(originalTool, mockFormGenerator);
      
      const invalidInput = {
        user: { name: '', email: 'invalid-email' },
        settings: { theme: 'invalid', notifications: true },
      };
      
      const validation = wrapper['validateInput'](invalidInput);
      expect(validation.isValid).toBe(false);
      expect(validation.errors!.length).toBeGreaterThan(0);
    });

    it('should handle array schemas', async () => {
      const schema = z.object({
        tags: z.array(z.string()).min(1),
        priorities: z.array(z.number()).max(5),
      });
      
      const originalTool = new MockStructuredTool('array-schema-tool', 'Array schema', schema);
      const wrapper = new FormValidatingToolWrapper(originalTool, mockFormGenerator);
      
      expect(wrapper['validateInput']({ tags: ['tag1'], priorities: [1, 2] }).isValid).toBe(true);
      expect(wrapper['validateInput']({ tags: [], priorities: [1, 2, 3, 4, 5, 6] }).isValid).toBe(false);
    });

    it('should handle union schemas', async () => {
      const schema = z.object({
        value: z.union([z.string(), z.number()]),
        optional: z.union([z.string(), z.undefined()]),
      });
      
      const originalTool = new MockStructuredTool('union-schema-tool', 'Union schema', schema);
      const wrapper = new FormValidatingToolWrapper(originalTool, mockFormGenerator);
      
      expect(wrapper['validateInput']({ value: 'string', optional: undefined }).isValid).toBe(true);
      expect(wrapper['validateInput']({ value: 42, optional: 'text' }).isValid).toBe(true);
      expect(wrapper['validateInput']({ value: true, optional: 'text' }).isValid).toBe(false);
    });

    it('should handle optional and default fields', async () => {
      const schema = z.object({
        required: z.string(),
        optional: z.string().optional(),
        withDefault: z.string().default('default-value'),
        nullable: z.string().nullable(),
      });
      
      const originalTool = new MockStructuredTool('optional-schema-tool', 'Optional schema', schema);
      const wrapper = new FormValidatingToolWrapper(originalTool, mockFormGenerator);
      
      expect(wrapper['validateInput']({ required: 'present' }).isValid).toBe(true);
      expect(wrapper['validateInput']({ required: 'present', optional: undefined, nullable: null }).isValid).toBe(true);
    });
  });

  describe('Error Conditions and Edge Cases', () => {
    it('should handle undefined input', async () => {
      const schema = z.object({ input: z.string() });
      const originalTool = new MockStructuredTool('undefined-input-tool', 'Undefined input', schema);
      const wrapper = new FormValidatingToolWrapper(originalTool, mockFormGenerator);
      
      const validation = wrapper['validateInput'](undefined as any);
      expect(validation.isValid).toBe(false);
    });

    it('should handle null input', async () => {
      const schema = z.object({ input: z.string() });
      const originalTool = new MockStructuredTool('null-input-tool', 'Null input', schema);
      const wrapper = new FormValidatingToolWrapper(originalTool, mockFormGenerator);
      
      const validation = wrapper['validateInput'](null as any);
      expect(validation.isValid).toBe(false);
    });

    it('should handle circular reference in input', async () => {
      const schema = z.object({ data: z.any() });
      const originalTool = new MockStructuredTool('circular-input-tool', 'Circular input', schema, 'circular handled');
      const wrapper = new FormValidatingToolWrapper(originalTool, mockFormGenerator);
      
      const circular: any = { self: null };
      circular.self = circular;
      
      const result = await wrapper._call({ data: circular } as any);
      expect(result).toBe('circular handled');
    });

    it('should handle empty string in various field types', () => {
      const schema = z.object({ field: z.string() });
      const originalTool = new MockStructuredTool('empty-string-tool', 'Empty string', schema);
      const wrapper = new FormValidatingToolWrapper(originalTool, mockFormGenerator);
      
      expect(wrapper.isFieldEmpty('field', '')).toBe(true);
      expect(wrapper.isFieldEmpty('field', '   ')).toBe(false);
      expect(wrapper.isFieldEmpty('field', 'value')).toBe(false);
    });

    it('should handle very large objects', async () => {
      const schema = z.object({ data: z.any() });
      const originalTool = new MockStructuredTool('large-object-tool', 'Large object', schema, 'large object handled');
      const wrapper = new FormValidatingToolWrapper(originalTool, mockFormGenerator);
      
      const largeObject = { items: Array.from({ length: 10000 }, (_, i) => ({ id: i, value: `item-${i}` })) };
      
      const result = await wrapper._call({ data: largeObject } as any);
      expect(result).toBe('large object handled');
    });
  });

  describe('Callback Manager Integration', () => {
    it('should pass callback manager to original tool', async () => {
      const schema = z.object({ input: z.string() });
      const originalTool = new MockStructuredTool('callback-tool', 'Callback test', schema, 'with callback');
      const wrapper = new FormValidatingToolWrapper(originalTool, mockFormGenerator);
      
      const mockCallbackManager = {} as CallbackManagerForToolRun;
      
      const result = await wrapper.executeOriginal({ input: 'test' }, mockCallbackManager);
      
      expect(result).toBe('with callback');
      expect(originalTool.mockCall).toHaveBeenCalledWith({ input: 'test' });
    });

    it('should handle callback manager in _call method', async () => {
      const schema = z.object({ input: z.string() });
      const originalTool = new MockStructuredTool('callback-call-tool', 'Callback call', schema, 'callback in call');
      const wrapper = new FormValidatingToolWrapper(originalTool, mockFormGenerator);
      
      const mockCallbackManager = {} as CallbackManagerForToolRun;
      
      const result = await (wrapper as any)._call({ input: 'valid' }, mockCallbackManager);
      
      expect(result).toBe('callback in call');
    });
  });
});