import { describe, test, expect, jest, beforeEach } from '@jest/globals';
import { FormEngine } from '../../../src/forms/form-engine';
import { StructuredTool } from '@langchain/core/tools';
import { z, ZodError } from 'zod';
import { Logger } from '@hashgraphonline/standards-sdk';

// Mock isFormValidatable
jest.mock('@hashgraphonline/standards-agent-kit', () => ({
  isFormValidatable: jest.fn(),
}));

/**
 * Mock tool classes for testing
 */
class MockFormValidatableTool extends StructuredTool {
  name = 'mock-form-validatable';
  description = 'A mock tool that is form validatable';
  schema = z.object({
    param1: z.string(),
    param2: z.number().optional(),
  });

  async _call(args: { param1: string; param2?: number }): Promise<string> {
    return `Result: ${args.param1}`;
  }
}

class MockZodErrorTool extends StructuredTool {
  name = 'mock-zod-error';
  description = 'A tool for testing ZodError handling';
  schema = z.object({
    requiredField: z.string(),
  });

  async _call(args: { requiredField: string }): Promise<string> {
    return `Result: ${args.requiredField}`;
  }
}

class MockRenderConfigTool extends StructuredTool {
  name = 'mock-render-config';
  description = 'A tool with render config';
  schema = z.object({
    field1: z.string(),
  });

  async _call(args: { field1: string }): Promise<string> {
    return `Result: ${args.field1}`;
  }
}

class MockRegularTool extends StructuredTool {
  name = 'mock-regular';
  description = 'A regular tool';
  schema = z.object({
    input: z.string(),
  });

  async _call(args: { input: string }): Promise<string> {
    return `Result: ${args.input}`;
  }
}

/**
 * Unit tests for FormEngine core functionality
 */
describe('FormEngine - Core Functionality', () => {
  let formEngine: FormEngine;
  let mockLogger: jest.Mocked<Logger>;
  let mockFormValidatableTool: MockFormValidatableTool;
  let mockZodErrorTool: MockZodErrorTool;
  let mockRenderConfigTool: MockRenderConfigTool;
  let mockRegularTool: MockRegularTool;

  beforeEach(() => {
    jest.clearAllMocks();

    mockLogger = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
    } as jest.Mocked<Logger>;

    formEngine = new FormEngine(mockLogger);
    mockFormValidatableTool = new MockFormValidatableTool();
    mockZodErrorTool = new MockZodErrorTool();
    mockRenderConfigTool = new MockRenderConfigTool();
    mockRegularTool = new MockRegularTool();

    // Reset isFormValidatable mock
    const { isFormValidatable } = require('@hashgraphonline/standards-agent-kit');
    isFormValidatable.mockReturnValue(false);
  });

  describe('Constructor', () => {
    test('should create FormEngine with default logger', () => {
      const defaultFormEngine = new FormEngine();
      expect(defaultFormEngine).toBeDefined();
    });

    test('should create FormEngine with custom logger', () => {
      const customLogger = new Logger({ module: 'Custom' });
      const customFormEngine = new FormEngine(customLogger);
      expect(customFormEngine).toBeDefined();
    });
  });

  describe('isZodObject', () => {
    test('should return true for ZodObject schemas', () => {
      const zodObject = z.object({ field: z.string() });
      const result = (formEngine as any).isZodObject(zodObject);
      expect(result).toBe(true);
    });

    test('should return false for non-ZodObject schemas', () => {
      const zodString = z.string();
      const zodNumber = z.number();
      const zodArray = z.array(z.string());

      expect((formEngine as any).isZodObject(zodString)).toBe(false);
      expect((formEngine as any).isZodObject(zodNumber)).toBe(false);
      expect((formEngine as any).isZodObject(zodArray)).toBe(false);
    });

    test('should return false for non-Zod schemas', () => {
      expect((formEngine as any).isZodObject(null)).toBe(false);
      expect((formEngine as any).isZodObject(undefined)).toBe(false);
      expect((formEngine as any).isZodObject('string')).toBe(false);
      expect((formEngine as any).isZodObject({})).toBe(false);
    });
  });

  describe('hasRenderConfig', () => {
    test('should return true when tool has _renderConfig on schema', () => {
      const toolWithConfig = {
        ...mockRegularTool,
        schema: {
          ...mockRegularTool.schema,
          _renderConfig: { fields: [{ name: 'test' }] }
        }
      };

      const result = (formEngine as any).hasRenderConfig(toolWithConfig as any);
      expect(result).toBe(true);
    });

    test('should return false when tool has no _renderConfig', () => {
      const result = (formEngine as any).hasRenderConfig(mockRegularTool);
      expect(result).toBe(false);
    });

    test('should return false when _renderConfig is null or undefined', () => {
      const toolWithNullConfig = {
        ...mockRegularTool,
        schema: {
          ...mockRegularTool.schema,
          _renderConfig: null
        }
      };

      const toolWithUndefinedConfig = {
        ...mockRegularTool,
        schema: {
          ...mockRegularTool.schema,
          _renderConfig: undefined
        }
      };

      expect((formEngine as any).hasRenderConfig(toolWithNullConfig as any)).toBe(false);
      expect((formEngine as any).hasRenderConfig(toolWithUndefinedConfig as any)).toBe(false);
    });
  });

  describe('validateSubmission', () => {
    test('should pass validation for valid submission', () => {
      const validSubmission = {
        formId: 'test-form',
        toolName: 'test-tool',
        parameters: { field1: 'value1' },
        timestamp: Date.now(),
      };

      expect(() => {
        (formEngine as any).validateSubmission(validSubmission);
      }).not.toThrow();
    });

    test('should throw error for missing toolName', () => {
      const invalidSubmission = {
        formId: 'test-form',
        parameters: { field1: 'value1' },
        timestamp: Date.now(),
      };

      expect(() => {
        (formEngine as any).validateSubmission(invalidSubmission);
      }).toThrow('Tool name is required in form submission');
    });

    test('should throw error for missing parameters', () => {
      const invalidSubmission = {
        formId: 'test-form',
        toolName: 'test-tool',
        timestamp: Date.now(),
      };

      expect(() => {
        (formEngine as any).validateSubmission(invalidSubmission);
      }).toThrow('Parameters are required in form submission');
    });

    test('should allow missing formId', () => {
      const submissionWithoutFormId = {
        toolName: 'test-tool',
        parameters: { field1: 'value1' },
        timestamp: Date.now(),
      };

      expect(() => {
        (formEngine as any).validateSubmission(submissionWithoutFormId);
      }).not.toThrow();
    });

    test('should allow parameters as non-objects', () => {
      const submissionWithStringParams = {
        formId: 'test-form',
        toolName: 'test-tool',
        parameters: 'string-params',
        timestamp: Date.now(),
      };

      expect(() => {
        (formEngine as any).validateSubmission(submissionWithStringParams);
      }).not.toThrow();
    });
  });

  describe('extractBaseToolInput', () => {
    test('should return original input when provided', () => {
      const context = {
        originalInput: { baseField: 'baseValue' },
      };

      const result = (formEngine as any).extractBaseToolInput(context);
      expect(result).toEqual({ baseField: 'baseValue' });
    });

    test('should return empty object when no context provided', () => {
      const result = (formEngine as any).extractBaseToolInput(undefined);
      expect(result).toEqual({});
    });

    test('should return empty object when originalInput is not provided', () => {
      const context = {
        schema: z.object({ field: z.string() }),
      };

      const result = (formEngine as any).extractBaseToolInput(context);
      expect(result).toEqual({});
    });
  });

  describe('extractSubmissionData', () => {
    test('should extract parameters from submission and add __fromForm flag', () => {
      const submission = {
        formId: 'test-form',
        toolName: 'test-tool',
        parameters: {
          field1: 'value1',
          field2: 'value2',
        },
        timestamp: Date.now(),
      };

      const result = (formEngine as any).extractSubmissionData(submission);
      expect(result).toEqual({
        field1: 'value1',
        field2: 'value2',
        __fromForm: true,
      });
    });
  });

  describe('mergeInputData', () => {
    test('should merge base input with submission data', () => {
      const baseInput = {
        baseField: 'baseValue',
        sharedField: 'baseShared',
      };

      const submissionData = {
        submissionField: 'submissionValue',
        sharedField: 'submissionShared',
        __fromForm: true,
      };

      const result = (formEngine as any).mergeInputData(baseInput, submissionData);

      expect(result).toEqual({
        baseField: 'baseValue',
        sharedField: 'submissionShared', // submission data takes precedence
        submissionField: 'submissionValue',
        __fromForm: true,
      });
    });

    test('should handle empty base input', () => {
      const baseInput = {};
      const submissionData = {
        field1: 'value1',
        __fromForm: true,
      };

      const result = (formEngine as any).mergeInputData(baseInput, submissionData);

      expect(result).toEqual({
        field1: 'value1',
        __fromForm: true,
      });
    });

    test('should handle empty submission data', () => {
      const baseInput = {
        field1: 'value1',
      };

      const submissionData = {
        __fromForm: true,
      };

      const result = (formEngine as any).mergeInputData(baseInput, submissionData);

      expect(result).toEqual({
        field1: 'value1',
        __fromForm: true,
      });
    });
  });

  describe('processSubmission', () => {
    test('should process valid submission successfully', async () => {
      const submission = {
        formId: 'test-form',
        toolName: 'test-tool',
        parameters: {
          field1: 'value1',
          field2: 'value2',
        },
        timestamp: Date.now(),
      };

      const context = {
        originalInput: { baseField: 'baseValue' },
      };

      const result = await formEngine.processSubmission(submission, context);

      expect(result).toEqual({
        baseField: 'baseValue',
        field1: 'value1',
        field2: 'value2',
        __fromForm: true,
      });
    });

    test('should process submission without context', async () => {
      const submission = {
        formId: 'test-form',
        toolName: 'test-tool',
        parameters: { field1: 'value1' },
        timestamp: Date.now(),
      };

      const result = await formEngine.processSubmission(submission);

      expect(result).toEqual({
        field1: 'value1',
        __fromForm: true,
      });
    });

    test('should process submission even without formId', async () => {
      const submissionWithoutFormId = {
        toolName: 'test-tool',
        parameters: { field1: 'value1' },
        timestamp: Date.now(),
      };

      const result = await formEngine.processSubmission(submissionWithoutFormId as any);

      expect(result).toEqual({
        field1: 'value1',
        __fromForm: true,
      });
    });
  });

  describe('Error Handling', () => {
    test('should log errors when form generation fails', async () => {
      // Create a tool that will cause an error
      const problematicTool = new StructuredTool({
        name: 'problematic-tool',
        description: 'A tool that causes form generation errors',
        schema: z.object({
          field: z.string(),
        }),
        _call: async () => {
          throw new Error('Tool execution error');
        }
      });

      // Mock the formGenerator to throw an error
      const originalGenerateForm = (formEngine as any).formGenerator.generateForm;
      (formEngine as any).formGenerator.generateForm = jest.fn().mockImplementation(() => {
        throw new Error('Form generation failed');
      });

      try {
        await formEngine.generateForm('problematic-tool', problematicTool, {});
      } catch (error) {
        // Verify the error was logged
        expect(mockLogger.error).toHaveBeenCalledWith(
          'Failed to generate form for tool: problematic-tool',
          { error: 'Form generation failed' }
        );
      }

      // Restore original method
      (formEngine as any).formGenerator.generateForm = originalGenerateForm;
    });
  });

  describe('Form Generation Strategies', () => {
    test('should generate form for FormValidatable tools', async () => {
      const { isFormValidatable } = require('@hashgraphonline/standards-agent-kit');
      isFormValidatable.mockReturnValue(true);

      const formValidatableTool = {
        name: 'form-validatable-tool',
        description: 'A FormValidatable tool',
        schema: z.object({ field: z.string() }),
        shouldGenerateForm: jest.fn().mockReturnValue(true),
        getFormSchema: jest.fn().mockReturnValue(z.object({ focusedField: z.string() })),
        getEssentialFields: jest.fn().mockReturnValue(['field']),
        isFieldEmpty: jest.fn().mockReturnValue(false),
      };

      const result = await formEngine.generateForm('form-validatable-tool', formValidatableTool, {});

      expect(result).toBeDefined();
      expect(result?.toolName).toBe('form-validatable-tool');
    });

    test('should generate form for tools with render config', async () => {
      const renderConfigTool = {
        name: 'render-config-tool',
        description: 'A tool with render config',
        schema: z.object({ field: z.string() }),
      };

      // Mock the schema to have _renderConfig
      (renderConfigTool.schema as any)._renderConfig = { renderType: 'custom' };

      const result = await formEngine.generateForm('render-config-tool', renderConfigTool, {});

      expect(result).toBeDefined();
      expect(result?.toolName).toBe('render-config-tool');
    });

    test('should generate form for ZodObject schema tools', async () => {
      const zodObjectTool = {
        name: 'zod-object-tool',
        description: 'A tool with ZodObject schema',
        schema: z.object({ field: z.string() }),
      };

      const result = await formEngine.generateForm('zod-object-tool', zodObjectTool, {});

      expect(result).toBeDefined();
      expect(result?.toolName).toBe('zod-object-tool');
    });

    test('should generate form from ZodError', async () => {
      const zodErrorTool = {
        name: 'zod-error-tool',
        description: 'A tool that generates ZodError',
        schema: z.object({ field: z.string() }),
      };

      const zodError = new ZodError([
        { code: 'invalid_type', expected: 'string', received: 'number', path: ['field'], message: 'Expected string' }
      ]);

      const result = await formEngine.generateForm('zod-error-tool', zodErrorTool, zodError);

      expect(result).toBeDefined();
      expect(result?.toolName).toBe('zod-error-tool');
    });
  });

  describe('Form Generation Context', () => {
    test('should handle form generation with session context', async () => {
      const tool = {
        name: 'session-tool',
        description: 'A tool with session context',
        schema: z.object({ field: z.string() }),
      };

      const context = {
        sessionId: 'session-123',
        userId: 'user-456',
        missingFields: new Set(['field']),
      };

      const result = await formEngine.generateForm('session-tool', tool, {}, context);

      expect(result).toBeDefined();
      expect(result?.toolName).toBe('session-tool');
    });

    test('should handle form generation with missing fields', async () => {
      const tool = {
        name: 'missing-fields-tool',
        description: 'A tool with missing fields',
        schema: z.object({ field1: z.string(), field2: z.string() }),
      };

      const context = {
        missingFields: new Set(['field1', 'field2']),
      };

      const result = await formEngine.generateForm('missing-fields-tool', tool, {}, context);

      expect(result).toBeDefined();
      expect(result?.toolName).toBe('missing-fields-tool');
    });
  });

  describe('Form Generation from Error', () => {
    test('should generate form from ZodError with original prompt', async () => {
      const toolName = 'error-tool';
      const toolSchema = z.object({ field: z.string() });
      const originalPrompt = 'Please provide the field value';

      const zodError = new ZodError([
        { code: 'invalid_type', expected: 'string', received: 'number', path: ['field'], message: 'Expected string' }
      ]);

      const result = await formEngine.generateFormFromError(zodError, toolName, toolSchema, originalPrompt);

      expect(result).toBeDefined();
      expect(result.toolName).toBe(toolName);
    });
  });

  describe('Input Validation', () => {
    test('should validate input successfully', () => {
      const tool = {
        name: 'validation-tool',
        description: 'A tool for validation testing',
        schema: z.object({ field: z.string() }),
      };

      const validInput = { field: 'valid value' };
      const validation = (formEngine as any).validateInput(tool, validInput);

      expect(validation.isValid).toBe(true);
    });

    test('should fail validation for invalid input', () => {
      const tool = {
        name: 'validation-tool',
        description: 'A tool for validation testing',
        schema: z.object({ field: z.string() }),
      };

      const invalidInput = { field: 123 }; // Should be string
      const validation = (formEngine as any).validateInput(tool, invalidInput);

      expect(validation.isValid).toBe(false);
      expect(validation.errors).toBeDefined();
      expect(validation.errors?.length).toBeGreaterThan(0);
    });

    test('should handle validation errors gracefully', () => {
      const tool = {
        name: 'validation-tool',
        description: 'A tool for validation testing',
        schema: z.object({ field: z.string() }),
      };

      const invalidInput = null;
      const validation = (formEngine as any).validateInput(tool, invalidInput);

      expect(validation.isValid).toBe(false);
      expect(validation.errors).toBeDefined();
    });
  });

  describe('Schema Resolution', () => {
    test('should resolve focused schema for FormValidatable tools', () => {
      const tool = {
        name: 'focused-schema-tool',
        description: 'A tool with focused schema',
        schema: z.object({ field: z.string() }),
        getFormSchema: jest.fn().mockReturnValue(z.object({ focusedField: z.string() })),
      };

      const resolution = (formEngine as any).resolveFormSchema(tool);

      expect(resolution.schemaToUse).toBeDefined();
      expect(resolution.isFocusedSchema).toBe(true);
    });

    test('should fallback to main schema when no focused schema', () => {
      const tool = {
        name: 'fallback-schema-tool',
        description: 'A tool without focused schema',
        schema: z.object({ field: z.string() }),
        getFormSchema: jest.fn().mockReturnValue(null),
      };

      const resolution = (formEngine as any).resolveFormSchema(tool);

      expect(resolution.schemaToUse).toBe(tool.schema);
      expect(resolution.isFocusedSchema).toBe(false);
    });

    test('should fallback to main schema when getFormSchema is undefined', () => {
      const tool = {
        name: 'no-schema-tool',
        description: 'A tool without getFormSchema method',
        schema: z.object({ field: z.string() }),
      };

      const resolution = (formEngine as any).resolveFormSchema(tool);

      expect(resolution.schemaToUse).toBe(tool.schema);
      expect(resolution.isFocusedSchema).toBe(false);
    });
  });

  describe('Missing Fields Detection', () => {
    test('should detect missing essential fields', () => {
      const tool = {
        name: 'essential-fields-tool',
        description: 'A tool with essential fields',
        schema: z.object({ field1: z.string(), field2: z.string() }),
        getEssentialFields: jest.fn().mockReturnValue(['field1', 'field2']),
        isFieldEmpty: jest.fn().mockReturnValue(false),
      };

      const input = { field1: 'value1' }; // Missing field2
      const missingFields = (formEngine as any).determineMissingFields(tool, input, tool.schema, false);

      expect(missingFields.has('field2')).toBe(true);
      expect(missingFields.has('field1')).toBe(false);
    });

    test('should detect empty fields using isFieldEmpty', () => {
      const tool = {
        name: 'empty-fields-tool',
        description: 'A tool with empty field detection',
        schema: z.object({ field1: z.string() }),
        getEssentialFields: jest.fn().mockReturnValue(['field1']),
        isFieldEmpty: jest.fn().mockReturnValue(true), // All fields are empty
      };

      const input = { field1: 'value1' };
      const missingFields = (formEngine as any).determineMissingFields(tool, input, tool.schema, false);

      expect(missingFields.has('field1')).toBe(true);
    });

    test('should handle tools without essential fields', () => {
      const tool = {
        name: 'no-essential-tool',
        description: 'A tool without essential fields',
        schema: z.object({ field: z.string() }),
      };

      const input = { field: 'value' };
      const missingFields = (formEngine as any).determineMissingFields(tool, input, tool.schema, false);

      expect(missingFields.size).toBe(0);
    });

    test('should handle null/undefined input', () => {
      const tool = {
        name: 'null-input-tool',
        description: 'A tool with null input',
        schema: z.object({ field: z.string() }),
        getEssentialFields: jest.fn().mockReturnValue(['field']),
      };

      const missingFields = (formEngine as any).determineMissingFields(tool, null, tool.schema, false);

      expect(missingFields.size).toBe(0);
    });
  });

  describe('Form Generation Logic', () => {
    test('should skip form generation when __fromForm is true', () => {
      const tool = {
        name: 'skip-form-tool',
        description: 'A tool that should skip form generation',
        schema: z.object({ field: z.string() }),
      };

      const input = { __fromForm: true };
      const shouldGenerate = formEngine.shouldGenerateForm(tool, input);

      expect(shouldGenerate).toBe(false);
    });

    test('should skip form generation when renderForm is false', () => {
      const tool = {
        name: 'skip-render-tool',
        description: 'A tool that should skip form generation',
        schema: z.object({ field: z.string() }),
      };

      const input = { renderForm: false };
      const shouldGenerate = formEngine.shouldGenerateForm(tool, input);

      expect(shouldGenerate).toBe(false);
    });

    test('should use FormValidatable shouldGenerateForm method', () => {
      const { isFormValidatable } = require('@hashgraphonline/standards-agent-kit');
      isFormValidatable.mockReturnValue(true);

      const tool = {
        name: 'form-validatable-tool',
        description: 'A FormValidatable tool',
        schema: z.object({ field: z.string() }),
        shouldGenerateForm: jest.fn().mockReturnValue(false),
      };

      const input = { field: 'value' };
      const shouldGenerate = formEngine.shouldGenerateForm(tool, input);

      expect(tool.shouldGenerateForm).toHaveBeenCalledWith(input);
      expect(shouldGenerate).toBe(false);
    });

    test('should handle FormValidatable shouldGenerateForm errors', () => {
      const { isFormValidatable } = require('@hashgraphonline/standards-agent-kit');
      isFormValidatable.mockReturnValue(true);

      const tool = {
        name: 'error-form-validatable-tool',
        description: 'A FormValidatable tool with error',
        schema: z.object({ field: z.string() }),
        shouldGenerateForm: jest.fn().mockImplementation(() => {
          throw new Error('shouldGenerateForm error');
        }),
      };

      const input = { field: 'value' };
      const shouldGenerate = formEngine.shouldGenerateForm(tool, input);

      expect(shouldGenerate).toBe(false);
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Error calling shouldGenerateForm() on error-form-validatable-tool:',
        expect.any(Error)
      );
    });
  });

  describe('Utility Methods', () => {
    test('should get registered strategies', () => {
      const strategies = formEngine.getRegisteredStrategies();

      expect(strategies).toContain('FormValidatable');
      expect(strategies).toContain('SchemaBased');
      expect(strategies).toContain('RenderConfig');
      expect(strategies).toContain('ZodErrorBased');
    });

    test('should get registered middleware', () => {
      const middleware = formEngine.getRegisteredMiddleware();

      expect(middleware).toContain('FormSubmissionValidator');
    });
  });
});
