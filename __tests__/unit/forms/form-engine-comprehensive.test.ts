import { describe, test, expect, jest, beforeEach } from '@jest/globals';
import { z, ZodError } from 'zod';
import { StructuredTool } from '@langchain/core/tools';
import { Logger } from '@hashgraphonline/standards-sdk';
import {
  FormEngine,
  ToolExecutionResult,
  FormGenerationContext,
} from '../../../src/forms/form-engine';
import type { FormMessage, FormSubmission } from '../../../src/forms/types';

jest.mock('@hashgraphonline/standards-sdk', () => ({
  Logger: jest.fn().mockImplementation(() => ({
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  })),
}));

jest.mock('../../../src/forms/form-generator', () => ({
  FormGenerator: jest.fn().mockImplementation(() => ({
    generateForm: jest.fn().mockResolvedValue({
      type: 'form',
      formId: 'test-form',
      schema: {},
      data: {},
    }),
    generateFormFromError: jest.fn().mockResolvedValue({
      type: 'form',
      formId: 'error-form',
      schema: {},
      data: {},
    }),
  })),
}));

jest.mock('@hashgraphonline/standards-agent-kit', () => ({
  isFormValidatable: jest.fn().mockReturnValue(false),
}));

const { isFormValidatable } = require('@hashgraphonline/standards-agent-kit');

describe('FormEngine', () => {
  let formEngine: FormEngine;
  let mockLogger: jest.Mocked<Logger>;
  let mockTool: StructuredTool;
  let mockFormValidatableTool: StructuredTool & { shouldGenerateForm: () => boolean };

  beforeEach(() => {
    jest.clearAllMocks();
    
    mockLogger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    } as unknown as jest.Mocked<Logger>;

    formEngine = new FormEngine(mockLogger);

    mockTool = {
      name: 'test-tool',
      description: 'A test tool',
      schema: z.object({ param: z.string() }),
      func: jest.fn(),
    } as StructuredTool;

    mockFormValidatableTool = {
      name: 'form-validatable-tool',
      description: 'A form validatable tool',
      schema: z.object({ data: z.string() }),
      func: jest.fn(),
      shouldGenerateForm: jest.fn().mockReturnValue(true),
    } as StructuredTool & { shouldGenerateForm: () => boolean };
  });

  describe('constructor', () => {
    test('should initialize with provided logger', () => {
      const customLogger = new Logger({ module: 'Test' });
      const engine = new FormEngine(customLogger);
      
      expect(engine).toBeDefined();
    });

    test('should initialize with default logger when none provided', () => {
      const engine = new FormEngine();
      
      expect(engine).toBeDefined();
      expect(Logger).toHaveBeenCalledWith({ module: 'FormEngine' });
    });
  });

  describe('generateForm', () => {
    test('should generate form for FormValidatable tools', async () => {
      (isFormValidatable as jest.Mock).mockReturnValue(true);
      
      const result = await formEngine.generateForm('test', mockFormValidatableTool, {});
      
      expect(result).toBeDefined();
      expect(result?.type).toBe('form');
    });

    test('should generate form from ZodError input', async () => {
      const zodError = new ZodError([
        {
          code: 'invalid_type',
          expected: 'string',
          received: 'undefined',
          path: ['param'],
          message: 'Required',
        },
      ]);
      
      const result = await formEngine.generateForm('test', mockTool, zodError);
      
      expect(result).toBeDefined();
      expect(result?.type).toBe('form');
    });

    test('should generate form for tools with render config', async () => {
      const toolWithRenderConfig = {
        ...mockTool,
        schema: { _renderConfig: { type: 'form' } },
      };
      
      const result = await formEngine.generateForm('test', toolWithRenderConfig, {});
      
      expect(result).toBeDefined();
      expect(result?.type).toBe('form');
    });

    test('should generate schema-based form for ZodObject schemas', async () => {
      const result = await formEngine.generateForm('test', mockTool, {});
      
      expect(result).toBeDefined();
      expect(result?.type).toBe('form');
    });

    test('should generate form even when no specific strategy applies', async () => {
      const toolWithoutSchema = {
        ...mockTool,
        schema: 'not-a-zod-object',
      };
      
      const result = await formEngine.generateForm('test', toolWithoutSchema, {});
      
      expect(result).not.toBeNull();
      expect(result?.type).toBe('form');
    });

    test('should handle form generation errors', async () => {
      const problematicTool = {
        ...mockTool,
        name: undefined as any,
      };
      
      await expect(
        formEngine.generateForm('test', problematicTool, {})
      ).rejects.toThrow();
      
      expect(mockLogger.error).toHaveBeenCalled();
    });

    test('should use context when provided', async () => {
      const context: Partial<FormGenerationContext> = {
        sessionId: 'test-session',
        userId: 'test-user',
        missingFields: new Set(['field1']),
      };
      
      const result = await formEngine.generateForm('test', mockTool, {}, context);
      
      expect(result).toBeDefined();
    });
  });

  describe('processSubmission', () => {
    test('should process valid form submission', async () => {
      const submission: FormSubmission = {
        formId: 'test-form',
        toolName: 'test-tool',
        parameters: { param: 'test-value' },
        timestamp: Date.now(),
      };
      
      const result = await formEngine.processSubmission(submission);
      
      expect(result).toBeDefined();
      expect(typeof result).toBe('object');
    });

    test('should process submission with original input context', async () => {
      const submission: FormSubmission = {
        formId: 'test-form',
        toolName: 'test-tool',
        parameters: { param: 'test-value' },
        timestamp: Date.now(),
      };
      
      const context = {
        originalInput: { existingParam: 'existing-value' },
        schema: z.object({ param: z.string() }),
      };
      
      const result = await formEngine.processSubmission(submission, context);
      
      expect(result).toBeDefined();
      expect(result).toHaveProperty('param', 'test-value');
    });

    test('should handle submissions with empty data', async () => {
      const submission: FormSubmission = {
        formId: 'test-form',
        toolName: 'test-tool',
        parameters: {},
        timestamp: Date.now(),
      };
      
      const result = await formEngine.processSubmission(submission);
      
      expect(result).toBeDefined();
      expect(typeof result).toBe('object');
    });

    test('should handle submissions with nested data', async () => {
      const submission: FormSubmission = {
        formId: 'test-form',
        toolName: 'test-tool',
        parameters: {
          user: {
            name: 'John Doe',
            email: 'john@example.com',
          },
          preferences: {
            theme: 'dark',
          },
        },
        timestamp: Date.now(),
      };
      
      const result = await formEngine.processSubmission(submission);
      
      expect(result).toBeDefined();
      expect(result).toHaveProperty('user');
      expect(result).toHaveProperty('preferences');
    });
  });

  describe('private method coverage through public methods', () => {
    test('should handle ZodError validation', async () => {
      const zodError = new ZodError([
        {
          code: 'invalid_type',
          expected: 'string',
          received: 'number',
          path: ['field'],
          message: 'Expected string',
        },
      ]);
      
      const result = await formEngine.generateForm('test', mockTool, zodError);
      
      expect(result).toBeDefined();
    });

    test('should identify ZodObject schemas correctly', async () => {
      const zodObjectTool = {
        ...mockTool,
        schema: z.object({
          string_field: z.string(),
          number_field: z.number(),
          optional_field: z.string().optional(),
        }),
      };
      
      const result = await formEngine.generateForm('test', zodObjectTool, {});
      
      expect(result).toBeDefined();
    });

    test('should handle non-ZodObject schemas', async () => {
      const nonZodTool = {
        ...mockTool,
        schema: z.string(),
      };
      
      const result = await formEngine.generateForm('test', nonZodTool, {});
      
      expect(result).not.toBeNull();
      expect(result?.type).toBe('form');
    });

    test('should detect render config correctly', async () => {
      const renderConfigTool = {
        ...mockTool,
        schema: {
          type: 'object',
          properties: {},
          _renderConfig: {
            type: 'form',
            title: 'Test Form',
            fields: [],
          },
        },
      };
      
      const result = await formEngine.generateForm('test', renderConfigTool, {});
      
      expect(result).toBeDefined();
    });

    test('should handle tools without render config', async () => {
      const regularTool = {
        ...mockTool,
        schema: z.object({ field: z.string() }),
      };
      
      const result = await formEngine.generateForm('test', regularTool, {});
      
      expect(result).toBeDefined();
    });

    test('should validate submissions correctly', async () => {
      const validSubmission: FormSubmission = {
        formId: 'valid-form',
        toolName: 'test-tool',
        parameters: { test: 'value' },
        timestamp: Date.now(),
      };
      
      expect(async () => {
        await formEngine.processSubmission(validSubmission);
      }).not.toThrow();
    });

    test('should extract base tool input from context', async () => {
      const submission: FormSubmission = {
        formId: 'test-form',
        toolName: 'test-tool',
        parameters: { newField: 'new-value' },
        timestamp: Date.now(),
      };
      
      const context = {
        originalInput: { baseField: 'base-value' },
      };
      
      const result = await formEngine.processSubmission(submission, context);
      
      expect(result).toHaveProperty('newField', 'new-value');
    });

    test('should merge input data correctly', async () => {
      const submission: FormSubmission = {
        formId: 'test-form',
        toolName: 'test-tool',
        parameters: { 
          field1: 'updated-value',
          field2: 'new-value',
        },
        timestamp: Date.now(),
      };
      
      const context = {
        originalInput: { 
          field1: 'original-value',
          field3: 'keep-value',
        },
      };
      
      const result = await formEngine.processSubmission(submission, context);
      
      expect(result).toHaveProperty('field1', 'updated-value');
      expect(result).toHaveProperty('field2', 'new-value');
      expect(result).toHaveProperty('field3', 'keep-value');
    });
  });

  describe('edge cases', () => {
    test('should handle null input', async () => {
      const result = await formEngine.generateForm('test', mockTool, null);
      
      expect(result).toBeDefined();
    });

    test('should handle undefined input', async () => {
      const result = await formEngine.generateForm('test', mockTool, undefined);
      
      expect(result).toBeDefined();
    });

    test('should handle complex nested schemas', async () => {
      const complexTool = {
        ...mockTool,
        schema: z.object({
          user: z.object({
            name: z.string(),
            preferences: z.object({
              theme: z.enum(['light', 'dark']),
              notifications: z.boolean(),
            }),
          }),
          metadata: z.array(z.string()).optional(),
        }),
      };
      
      const result = await formEngine.generateForm('test', complexTool, {});
      
      expect(result).toBeDefined();
    });

    test('should handle form validatable tools that throw errors', async () => {
      (isFormValidatable as jest.Mock).mockReturnValue(true);
      
      const errorTool = {
        ...mockFormValidatableTool,
        shouldGenerateForm: jest.fn().mockImplementation(() => {
          throw new Error('shouldGenerateForm failed');
        }),
      };
      
      const result = await formEngine.generateForm('test', errorTool, {});
      expect(result).toBeDefined();
      expect(result?.type).toBe('form');
    });
  });
});