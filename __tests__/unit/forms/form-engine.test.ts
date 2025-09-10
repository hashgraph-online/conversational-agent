import { describe, test, expect, beforeEach, jest } from '@jest/globals';
import { ZodError, z } from 'zod';
import { StructuredTool } from '@langchain/core/tools';
import { Logger } from '@hashgraphonline/standards-sdk';
import { TEST_FORM_GENERATION, TEST_FORM_DATA } from '../../test-constants';
import { FormEngine } from '../../../src/forms/form-engine';
import { FormGenerator } from '../../../src/forms/form-generator';
import type { FormMessage, FormSubmission } from '../../../src/forms/types';

jest.mock('../../../src/forms/form-generator');
jest.mock('@hashgraphonline/standards-agent-kit', () => ({
  isFormValidatable: jest.fn(),
}));

/**
 * Mock tool that implements FormValidatable interface
 */
class MockFormValidatableTool extends StructuredTool {
  name = TEST_FORM_GENERATION.FORM_VALIDATABLE_TOOL;
  description = 'A tool that supports FormValidatable interface';
  schema = z.object({
    param: z.string(),
  });

  shouldGenerateForm(input: unknown): boolean {
    const inputRecord = input as Record<string, unknown>;
    return !inputRecord?.param;
  }

  async _call(arg: { param: string }): Promise<string> {
    return `Result: ${arg.param}`;
  }
}

/**
 * Mock standard tool with Zod schema
 */
class MockStandardTool extends StructuredTool {
  name = TEST_FORM_GENERATION.STANDARD_TOOL;
  description = 'A standard tool with Zod schema';
  schema = z.object({
    requiredParam: z.string(),
    optionalParam: z.string().optional(),
  });

  async _call(arg: { requiredParam: string; optionalParam?: string }): Promise<string> {
    return `Result: ${arg.requiredParam}`;
  }
}

/**
 * Mock tool with render config
 */
class MockRenderConfigTool extends StructuredTool {
  name = TEST_FORM_GENERATION.RENDER_CONFIG_TOOL;
  description = 'A tool with render configuration';
  schema = z.object({
    param: z.string(),
  });
  
  renderConfig = {
    title: 'Custom Form',
    fields: [
      {
        name: 'param',
        type: 'text',
        label: 'Parameter',
        required: true,
      },
    ],
  };

  async _call(arg: { param: string }): Promise<string> {
    return `Result: ${arg.param}`;
  }
}

describe('FormEngine', () => {
  let formEngine: FormEngine;
  let mockFormGenerator: any;
  let mockLogger: any;
  let mockFormValidatableTool: MockFormValidatableTool;
  let mockStandardTool: MockStandardTool;
  let mockRenderConfigTool: MockRenderConfigTool;

  beforeEach(() => {
    jest.clearAllMocks();

    mockLogger = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
    } as any;

    mockFormGenerator = {
      generateForm: jest.fn(),
      generateFormFromError: jest.fn(),
    } as any;

    const MockedFormGenerator = FormGenerator as jest.MockedClass<typeof FormGenerator>;
    MockedFormGenerator.mockImplementation(() => mockFormGenerator);

    formEngine = new FormEngine(mockLogger);

    mockFormValidatableTool = new MockFormValidatableTool();
    mockStandardTool = new MockStandardTool();
    mockRenderConfigTool = new MockRenderConfigTool();
  });

  describe('generateForm', () => {
    test('should generate form for FormValidatable tools', async () => {
      const { isFormValidatable } = require('@hashgraphonline/standards-agent-kit');
      isFormValidatable.mockReturnValue(true);
      
      const mockFormMessage = {
        type: 'form',
        formId: TEST_FORM_DATA.TEST_FORM_ID,
        toolName: TEST_FORM_GENERATION.FORM_VALIDATABLE_TOOL,
        form: {
          title: TEST_FORM_GENERATION.FORM_VALIDATABLE_TITLE,
          fields: [{
            name: 'param',
            type: 'text',
            label: 'Parameter',
            required: true
          }]
        },
        renderConfig: {}
      } as any;

      mockFormGenerator.generateForm.mockResolvedValue(mockFormMessage);
      const input = { invalidParam: 'test' };

      const result = await formEngine.generateForm(
        TEST_FORM_GENERATION.FORM_VALIDATABLE_TOOL,
        mockFormValidatableTool,
        input
      );

      expect(result).toEqual(mockFormMessage);
      expect(mockFormGenerator.generateForm).toHaveBeenCalledWith(
        mockFormValidatableTool,
        input,
        expect.objectContaining({
          tool: mockFormValidatableTool,
          input: input
        })
      );
    });

    test('should generate form from ZodError input', async () => {
      const { isFormValidatable } = require('@hashgraphonline/standards-agent-kit');
      isFormValidatable.mockReturnValue(false);
      
      const zodError = new ZodError([{
        code: 'invalid_type',
        expected: 'string',
        received: 'undefined',
        path: ['requiredParam'],
        message: TEST_FORM_GENERATION.REQUIRED_PARAMETER_MISSING
      }]);

      const mockFormMessage = {
        type: 'form',
        formId: TEST_FORM_GENERATION.ERROR_FORM_ID,
        toolName: TEST_FORM_GENERATION.STANDARD_TOOL,
        form: {
          title: 'Error Form',
          fields: [{
            name: 'requiredParam',
            type: 'text',
            label: TEST_FORM_GENERATION.REQUIRED_PARAMETER,
            required: true,
            error: TEST_FORM_GENERATION.REQUIRED_PARAMETER_MISSING
          }]
        },
        renderConfig: {}
      };

      mockFormGenerator.generateFormFromError.mockResolvedValue(mockFormMessage as never);

      const result = await formEngine.generateForm(
        TEST_FORM_GENERATION.STANDARD_TOOL,
        mockStandardTool,
        zodError
      );

      expect(result).toEqual(mockFormMessage);
      expect(mockFormGenerator.generateFormFromError).toHaveBeenCalledWith(
        zodError,
        mockStandardTool.schema,
        TEST_FORM_GENERATION.STANDARD_TOOL,
        undefined
      );
    });

    test('should generate form from render config', async () => {
      const { isFormValidatable } = require('@hashgraphonline/standards-agent-kit');
      isFormValidatable.mockReturnValue(false);
      
      const mockFormMessage = {
        type: 'form',
        formId: 'render-config-form-id',
        toolName: 'render-config-tool',
        form: {
          title: 'Custom Form',
          fields: [{
            name: 'param',
            type: 'text',
            label: 'Parameter',
            required: true
          }]
        },
        renderConfig: mockRenderConfigTool.renderConfig
      };

      mockFormGenerator.generateForm.mockResolvedValue(mockFormMessage);
      const input = { param: 'test' };

      const result = await formEngine.generateForm(
        'render-config-tool',
        mockRenderConfigTool,
        input
      );

      expect(result).toEqual(mockFormMessage);
    });

    test('should generate schema-based form for ZodObject schemas', async () => {
      const { isFormValidatable } = require('@hashgraphonline/standards-agent-kit');
      isFormValidatable.mockReturnValue(false);
      
      const mockFormMessage = {
        type: 'form',
        formId: 'schema-form-id',
        toolName: TEST_FORM_GENERATION.STANDARD_TOOL,
        form: {
          title: 'Standard Tool',
          fields: [
            {
              name: 'requiredParam',
              type: 'text',
              label: TEST_FORM_GENERATION.REQUIRED_PARAMETER,
              required: true
            },
            {
              name: 'optionalParam',
              type: 'text',
              label: 'Optional Parameter',
              required: false
            }
          ]
        },
        renderConfig: {}
      };

      mockFormGenerator.generateForm.mockResolvedValue(mockFormMessage);
      const input = { invalidParam: 'test' };

      const result = await formEngine.generateForm(
        TEST_FORM_GENERATION.STANDARD_TOOL,
        mockStandardTool,
        input
      );

      expect(result).toEqual(mockFormMessage);
    });

    test('should return null when no form generation strategy applies', async () => {
      const { isFormValidatable } = require('@hashgraphonline/standards-agent-kit');
      isFormValidatable.mockReturnValue(false);
      
      const nonZodTool = {
        name: 'non-zod-tool',
        description: 'Tool without Zod schema',
        schema: 'string-schema',
      } as any;

      const result = await formEngine.generateForm('non-zod-tool', nonZodTool, {});

      expect(result).toBeNull();
    });

    test('should handle form generation errors', async () => {
      const { isFormValidatable } = require('@hashgraphonline/standards-agent-kit');
      isFormValidatable.mockReturnValue(true);
      
      const error = new Error(TEST_FORM_GENERATION.FORM_GENERATION_FAILED);
      mockFormGenerator.generateForm.mockRejectedValue(error);

      await expect(formEngine.generateForm(
        TEST_FORM_GENERATION.FORM_VALIDATABLE_TOOL,
        mockFormValidatableTool,
        {}
      )).rejects.toThrow(TEST_FORM_GENERATION.FORM_GENERATION_FAILED);
      
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Failed to generate form for tool: form-validatable-tool',
        {
          error: TEST_FORM_GENERATION.FORM_GENERATION_FAILED
        }
      );
    });
  });

  describe('processSubmission', () => {
    test('should process valid form submission', async () => {
      const submission: FormSubmission = {
        formId: TEST_FORM_DATA.TEST_FORM_ID,
        toolName: TEST_FORM_GENERATION.STANDARD_TOOL,
        parameters: {
          requiredParam: TEST_FORM_GENERATION.SUBMITTED_VALUE,
          optionalParam: TEST_FORM_GENERATION.OPTIONAL_VALUE
        },
        timestamp: Date.now()
      };

      const context = {
        originalInput: { existingParam: 'existing' },
        schema: mockStandardTool.schema
      };

      const result = await formEngine.processSubmission(submission, context);

      expect(result).toEqual({
        existingParam: 'existing',
        requiredParam: TEST_FORM_GENERATION.SUBMITTED_VALUE,
        optionalParam: TEST_FORM_GENERATION.OPTIONAL_VALUE,
        __fromForm: true
      });
    });

    test('should process submission without original input', async () => {
      const submission: FormSubmission = {
        formId: TEST_FORM_DATA.TEST_FORM_ID,
        toolName: TEST_FORM_GENERATION.STANDARD_TOOL,
        parameters: {
          requiredParam: TEST_FORM_GENERATION.SUBMITTED_VALUE
        },
        timestamp: Date.now()
      };

      const result = await formEngine.processSubmission(submission);

      expect(result).toEqual({
        requiredParam: TEST_FORM_GENERATION.SUBMITTED_VALUE,
        __fromForm: true
      });
    });

    test('should handle submission validation errors', async () => {
      const invalidSubmission = {
        toolName: TEST_FORM_GENERATION.STANDARD_TOOL,
        parameters: {},
        timestamp: Date.now()
      } as FormSubmission;

      await expect(formEngine.processSubmission(invalidSubmission))
        .rejects.toThrow();
    });
  });

  describe('shouldGenerateForm', () => {
    test('should return false when input has __fromForm=true', () => {
      const input = { param: 'test', __fromForm: true };

      const result = formEngine.shouldGenerateForm(mockStandardTool, input);

      expect(result).toBe(false);
    });

    test('should return false when input has renderForm=false', () => {
      const input = { param: 'test', renderForm: false };

      const result = formEngine.shouldGenerateForm(mockStandardTool, input);

      expect(result).toBe(false);
    });

    test('should use tool shouldGenerateForm method for FormValidatable tools', () => {
      const { isFormValidatable } = require('@hashgraphonline/standards-agent-kit');
      isFormValidatable.mockReturnValue(true);
      
      const input = { param: '' };

      const result = formEngine.shouldGenerateForm(mockFormValidatableTool, input);

      expect(result).toBe(true);
      expect(isFormValidatable).toHaveBeenCalledWith(mockFormValidatableTool);
    });

    test('should handle errors from FormValidatable shouldGenerateForm', () => {
      const { isFormValidatable } = require('@hashgraphonline/standards-agent-kit');
      isFormValidatable.mockReturnValue(true);
      
      const faultyTool = {
        ...mockFormValidatableTool,
        shouldGenerateForm: jest.fn().mockImplementation(() => {
          throw new Error('Tool error');
        })
      };

      const result = formEngine.shouldGenerateForm(faultyTool as unknown as StructuredTool, {});

      expect(result).toBe(false);
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('Error calling shouldGenerateForm()'),
        expect.any(Error)
      );
    });

    test('should validate input for non-FormValidatable tools', () => {
      const { isFormValidatable } = require('@hashgraphonline/standards-agent-kit');
      isFormValidatable.mockReturnValue(false);
      
      const invalidInput = { invalidParam: 'test' };
      const validInput = { requiredParam: 'test' };

      const invalidResult = formEngine.shouldGenerateForm(mockStandardTool, invalidInput);
      const validResult = formEngine.shouldGenerateForm(mockStandardTool, validInput);

      expect(invalidResult).toBe(true);
      expect(validResult).toBe(false);
    });
  });

  describe('generateFormFromError', () => {
    test('should generate form from ZodError', async () => {
      const zodError = new ZodError([{
        code: 'invalid_type',
        expected: 'string',
        received: 'undefined',
        path: ['requiredParam'],
        message: TEST_FORM_GENERATION.REQUIRED_PARAMETER_MISSING
      }]);

      const mockFormMessage = {
        type: 'form',
        formId: TEST_FORM_GENERATION.ERROR_FORM_ID,
        toolName: TEST_FORM_GENERATION.STANDARD_TOOL,
        form: {
          title: 'Error Form',
          fields: [{
            name: 'requiredParam',
            type: 'text',
            label: TEST_FORM_GENERATION.REQUIRED_PARAMETER,
            required: true,
            error: TEST_FORM_GENERATION.REQUIRED_PARAMETER_MISSING
          }]
        },
        renderConfig: {}
      };

      mockFormGenerator.generateFormFromError.mockResolvedValue(mockFormMessage as never);

      const result = await formEngine.generateFormFromError(
        zodError,
        TEST_FORM_GENERATION.STANDARD_TOOL,
        mockStandardTool.schema,
        'Original prompt text'
      );

      expect(result).toEqual(mockFormMessage);
      expect(mockFormGenerator.generateFormFromError).toHaveBeenCalledWith(
        zodError,
        mockStandardTool.schema,
        TEST_FORM_GENERATION.STANDARD_TOOL,
        'Original prompt text'
      );
    });
  });

  describe('private methods through public interface', () => {
    test('should validate input correctly', () => {
      const { isFormValidatable } = require('@hashgraphonline/standards-agent-kit');
      isFormValidatable.mockReturnValue(false);
      
      expect(formEngine.shouldGenerateForm(mockStandardTool, {
        requiredParam: 'valid'
      })).toBe(false);

      expect(formEngine.shouldGenerateForm(mockStandardTool, {
        invalidParam: 'invalid'
      })).toBe(true);
    });

    test('should identify ZodObject schemas', () => {
      const { isFormValidatable } = require('@hashgraphonline/standards-agent-kit');
      isFormValidatable.mockReturnValue(false);
      
      const mockFormMessage = {
        type: 'form',
        formId: 'schema-form',
        toolName: 'test-tool',
        form: { title: 'Test', fields: [] },
        renderConfig: {}
      };

      mockFormGenerator.generateForm.mockResolvedValue(mockFormMessage);

      expect(formEngine.generateForm('test', mockStandardTool, {}))
        .resolves.toEqual(mockFormMessage);
    });

    test('should merge input data correctly', async () => {
      const submission: FormSubmission = {
        formId: 'test-form',
        toolName: 'test-tool',
        parameters: { newParam: 'new' },
        timestamp: Date.now()
      };

      const result = await formEngine.processSubmission(submission, {
        originalInput: { existingParam: 'existing' }
      });

      expect(result).toEqual({
        existingParam: 'existing',
        newParam: 'new',
        __fromForm: true
      });
    });
  });
});