import { describe, test, expect, beforeEach, jest } from '@jest/globals';
import { ZodError, z } from 'zod';
import { Logger } from '@hashgraphonline/standards-sdk';
import { ExecutionPipeline, SessionContext } from '../../../src/execution/execution-pipeline';
import { SmartMemoryManager } from '../../../src/memory/smart-memory-manager';
import { FormEngine } from '../../../src/forms/form-engine';
import { ToolRegistry, ToolRegistryEntry } from '../../../src/core/tool-registry';
import type { FormMessage } from '../../../src/forms/types';
import { StructuredTool } from 'langchain/tools';
import { TEST_ACCOUNT_IDS, TEST_EXECUTION_MESSAGES, TEST_FORM_DATA } from '../../test-constants';

/**
 * Mock tool implementation for testing
 */
class MockTool extends StructuredTool {
  name = 'mock-tool';
  description = 'A mock tool for testing';
  schema = z.object({
    param: z.string(),
  });

  async _call(arg: { param: string }): Promise<string> {
    return `Mock result: ${arg.param}`;
  }
}

/**
 * Mock tool that throws ZodError for validation testing
 */
class MockValidationErrorTool extends StructuredTool {
  name = TEST_EXECUTION_MESSAGES.VALIDATION_ERROR_TOOL;
  description = 'A tool that throws validation errors';
  schema = z.object({
    requiredParam: z.string(),
  });

  async _call(_arg: { requiredParam: string }): Promise<string> {
    throw new ZodError([{
      code: 'invalid_type',
      expected: 'string',
      received: 'undefined',
      path: ['requiredParam'],
      message: 'Required parameter missing'
    }]);
  }
}

/**
 * Mock tool that throws generic error
 */
class MockErrorTool extends StructuredTool {
  name = 'error-tool';
  description = 'A tool that throws generic errors';
  schema = z.object({
    param: z.string(),
  });

  async _call(_arg: { param: string }): Promise<string> {
    throw new Error(TEST_EXECUTION_MESSAGES.TOOL_ERROR);
  }
}

describe('ExecutionPipeline', () => {
  let pipeline: ExecutionPipeline;
  let mockToolRegistry: jest.Mocked<ToolRegistry>;
  let mockFormEngine: jest.Mocked<FormEngine>;
  let mockMemory: jest.Mocked<SmartMemoryManager>;
  let mockLogger: jest.Mocked<Logger>;
  let mockTool: MockTool;
  let mockValidationErrorTool: MockValidationErrorTool;
  let mockErrorTool: MockErrorTool;

  beforeEach(() => {
    mockToolRegistry = {
      getTool: jest.fn(),
      registerTool: jest.fn(),
      getTools: jest.fn(),
      removeTool: jest.fn(),
    } as jest.Mocked<ToolRegistry>;

    mockFormEngine = {
      shouldGenerateForm: jest.fn(),
      generateForm: jest.fn(),
      processSubmission: jest.fn(),
    } as jest.Mocked<FormEngine>;

    mockMemory = {
      addMessage: jest.fn(),
      getRecentMessages: jest.fn(),
      pruneMemory: jest.fn(),
    } as unknown as jest.Mocked<SmartMemoryManager>;

    mockLogger = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
    } as jest.Mocked<Logger>;

    mockTool = new MockTool();
    mockValidationErrorTool = new MockValidationErrorTool();
    mockErrorTool = new MockErrorTool();

    pipeline = new ExecutionPipeline(
      mockToolRegistry,
      mockFormEngine,
      mockMemory,
      mockLogger
    );
  });

  describe('execute', () => {
    test('should execute tool successfully with valid input', async () => {
      const toolName = 'mock-tool';
      const input = { param: 'test-value' };
      const toolEntry: ToolRegistryEntry = {
        tool: mockTool,
        name: toolName,
        originalTool: mockTool,
      };

      mockToolRegistry.getTool.mockReturnValue(toolEntry);
      mockFormEngine.shouldGenerateForm.mockReturnValue(false);

      const result = await pipeline.execute(toolName, input);

      expect(result.success).toBe(true);
      expect(result.output).toBe('Mock result: test-value');
      expect(result.traceId).toMatch(/^trace-\d+-[a-z0-9]{9}$/);
      expect(result.executionTime).toBeGreaterThanOrEqual(0);
      expect(mockToolRegistry.getTool).toHaveBeenCalledWith(toolName);
      expect(mockFormEngine.shouldGenerateForm).toHaveBeenCalledWith(mockTool, input);
    });

    test('should generate form when validation fails', async () => {
      const toolName = 'validation-error-tool';
      const input = { invalidParam: 'test' };
      const toolEntry: ToolRegistryEntry = {
        tool: mockValidationErrorTool,
        name: toolName,
        originalTool: mockValidationErrorTool,
      };
      
      const mockFormMessage: FormMessage = {
        type: 'form',
        formId: TEST_FORM_DATA.TEST_FORM_ID,
        toolName: toolName,
        form: {
          title: 'Test Form',
          fields: [{
            name: 'requiredParam',
            type: 'text',
            label: 'Required Parameter',
            required: true
          }]
        },
        renderConfig: {}
      };

      mockToolRegistry.getTool.mockReturnValue(toolEntry);
      mockFormEngine.shouldGenerateForm.mockReturnValue(true);
      mockFormEngine.generateForm.mockResolvedValue(mockFormMessage);

      const result = await pipeline.execute(toolName, input);

      expect(result.success).toBe(false);
      expect(result.requiresForm).toBe(true);
      expect(result.formMessage).toEqual(mockFormMessage);
      expect(result.output).toBe('Form generation required');
      expect(mockFormEngine.generateForm).toHaveBeenCalledWith(toolName, mockValidationErrorTool, input);
    });

    test('should handle tool not found error', async () => {
      const toolName = 'nonexistent-tool';
      const input = { param: 'test' };

      mockToolRegistry.getTool.mockReturnValue(null);

      await expect(pipeline.execute(toolName, input))
        .rejects
        .toThrow('Tool not found in registry: nonexistent-tool');
    });

    test('should handle ZodError with proper error response', async () => {
      const toolName = 'validation-error-tool';
      const input = { param: 'test' };
      const toolEntry: ToolRegistryEntry = {
        tool: mockValidationErrorTool,
        name: toolName,
        originalTool: mockValidationErrorTool,
      };

      mockToolRegistry.getTool.mockReturnValue(toolEntry);
      mockFormEngine.shouldGenerateForm.mockReturnValue(false);

      const result = await pipeline.execute(toolName, input);

      expect(result.success).toBe(false);
      expect(result.output).toMatch(/(Validation error occurred|Tool execution failed)/);
      expect(result.error).toBeDefined();
    });

    test('should handle generic execution errors', async () => {
      const toolName = 'error-tool';
      const input = { param: 'test' };
      const toolEntry: ToolRegistryEntry = {
        tool: mockErrorTool,
        name: toolName,
        originalTool: mockErrorTool,
      };

      mockToolRegistry.getTool.mockReturnValue(toolEntry);
      mockFormEngine.shouldGenerateForm.mockReturnValue(false);

      const result = await pipeline.execute(toolName, input);

      expect(result.success).toBe(false);
      expect(result.output).toBe('Tool execution failed');
      expect(result.error).toBe('Generic tool execution error');
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('Tool execution failed'),
        expect.objectContaining({
          traceId: expect.any(String),
          error: 'Generic tool execution error'
        })
      );
    });

    test('should handle non-Error exceptions', async () => {
      const toolName = 'error-tool';
      const input = { param: 'test' };

      class StringErrorTool extends StructuredTool {
        name = 'string-error-tool';
        description = 'A tool that throws string errors';
        schema = z.object({
          param: z.string(),
        });

        async _call(): Promise<string> {
          throw 'String error message';
        }
      }

      const stringErrorTool = new StringErrorTool();
      const toolEntry: ToolRegistryEntry = {
        tool: stringErrorTool,
        name: toolName,
        originalTool: stringErrorTool,
      };

      mockToolRegistry.getTool.mockReturnValue(toolEntry);
      mockFormEngine.shouldGenerateForm.mockReturnValue(false);

      const result = await pipeline.execute(toolName, input);

      expect(result.success).toBe(false);
      expect(result.output).toBe('Tool execution failed');
      expect(result.error).toBe('String error message');
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('Tool execution failed'),
        expect.objectContaining({
          traceId: expect.any(String),
          error: 'String error message'
        })
      );
    });

    test('should create default session context when none provided', async () => {
      const toolName = 'mock-tool';
      const input = { param: 'test' };
      const toolEntry: ToolRegistryEntry = {
        tool: mockTool,
        name: toolName,
        originalTool: mockTool,
      };

      mockToolRegistry.getTool.mockReturnValue(toolEntry);
      mockFormEngine.shouldGenerateForm.mockReturnValue(false);

      const result = await pipeline.execute(toolName, input);

      expect(result.success).toBe(true);
      expect(result.traceId).toBeDefined();
    });

    test('should use provided session context', async () => {
      const toolName = 'mock-tool';
      const input = { param: 'test' };
      const sessionContext: SessionContext = {
        sessionId: 'test-session-id',
        userId: TEST_ACCOUNT_IDS.USER_ACCOUNT,
        timestamp: Date.now(),
        conversationId: 'test-conversation-id'
      };
      const toolEntry: ToolRegistryEntry = {
        tool: mockTool,
        name: toolName,
        originalTool: mockTool,
      };

      mockToolRegistry.getTool.mockReturnValue(toolEntry);
      mockFormEngine.shouldGenerateForm.mockReturnValue(false);

      const result = await pipeline.execute(toolName, input, sessionContext);

      expect(result.success).toBe(true);
      expect(result.traceId).toBeDefined();
    });
  });

  describe('executeWithValidation', () => {
    test('should call execute method with same parameters', async () => {
      const toolName = 'mock-tool';
      const input = { param: 'test' };
      const sessionContext: SessionContext = {
        sessionId: 'test-session',
        timestamp: Date.now()
      };
      const toolEntry: ToolRegistryEntry = {
        tool: mockTool,
        name: toolName,
        originalTool: mockTool,
      };

      mockToolRegistry.getTool.mockReturnValue(toolEntry);
      mockFormEngine.shouldGenerateForm.mockReturnValue(false);

      const result = await pipeline.executeWithValidation(toolName, input, sessionContext);

      expect(result.success).toBe(true);
      expect(result.output).toBe('Mock result: test');
    });
  });

  describe('processFormSubmission', () => {
    test('should process valid form submission', async () => {
      const toolName = 'mock-tool';
      const formId = 'test-form-id';
      const parameters = { param: TEST_EXECUTION_MESSAGES.FORM_VALUE };
      const processedInput = { param: TEST_EXECUTION_MESSAGES.FORM_VALUE, __fromForm: true };
      const toolEntry: ToolRegistryEntry = {
        tool: mockTool,
        name: toolName,
        originalTool: mockTool,
      };

      mockFormEngine.processSubmission.mockResolvedValue(processedInput);
      mockToolRegistry.getTool.mockReturnValue(toolEntry);
      mockFormEngine.shouldGenerateForm.mockReturnValue(false);

      const result = await pipeline.processFormSubmission(toolName, formId, parameters);

      expect(result.success).toBe(true);
      expect(result.output).toBe('Mock result: form-value');
      expect(result.traceId).toMatch(/^trace-\d+-[a-z0-9]{9}$/);
      expect(mockFormEngine.processSubmission).toHaveBeenCalledWith({
        formId,
        toolName,
        parameters,
        timestamp: expect.any(Number)
      });
    });

    test('should handle form submission processing errors', async () => {
      const toolName = 'mock-tool';
      const formId = 'test-form-id';
      const parameters = { param: TEST_EXECUTION_MESSAGES.FORM_VALUE };

      mockFormEngine.processSubmission.mockRejectedValue(new Error('Form processing failed'));

      const result = await pipeline.processFormSubmission(toolName, formId, parameters);

      expect(result.success).toBe(false);
      expect(result.output).toBe('Form submission processing failed');
      expect(result.error).toBe('Form processing failed');
      expect(result.traceId).toMatch(/^form-\d+-[a-z0-9]{9}$/);
    });
  });

  describe('form generation logic', () => {
    test('should skip form generation when __fromForm is true', async () => {
      const toolName = 'mock-tool';
      const input = { param: 'test', __fromForm: true };
      const toolEntry: ToolRegistryEntry = {
        tool: mockTool,
        name: toolName,
        originalTool: mockTool,
      };

      mockToolRegistry.getTool.mockReturnValue(toolEntry);

      const result = await pipeline.execute(toolName, input);

      expect(result.success).toBe(true);
      expect(mockFormEngine.shouldGenerateForm).not.toHaveBeenCalled();
      expect(mockFormEngine.generateForm).not.toHaveBeenCalled();
    });

    test('should skip form generation when renderForm is false', async () => {
      const toolName = 'mock-tool';
      const input = { param: 'test', renderForm: false };
      const toolEntry: ToolRegistryEntry = {
        tool: mockTool,
        name: toolName,
        originalTool: mockTool,
      };

      mockToolRegistry.getTool.mockReturnValue(toolEntry);

      const result = await pipeline.execute(toolName, input);

      expect(result.success).toBe(true);
      expect(mockFormEngine.shouldGenerateForm).not.toHaveBeenCalled();
      expect(mockFormEngine.generateForm).not.toHaveBeenCalled();
    });

    test('should skip form generation when shouldGenerateForm returns false', async () => {
      const toolName = 'mock-tool';
      const input = { param: 'test' };
      const toolEntry: ToolRegistryEntry = {
        tool: mockTool,
        name: toolName,
        originalTool: mockTool,
      };

      mockToolRegistry.getTool.mockReturnValue(toolEntry);
      mockFormEngine.shouldGenerateForm.mockReturnValue(false);
      mockFormEngine.generateForm.mockResolvedValue(null);

      const result = await pipeline.execute(toolName, input);

      expect(result.success).toBe(true);
      expect(result.output).toBe('Mock result: test');
      expect(mockFormEngine.shouldGenerateForm).toHaveBeenCalledWith(mockTool, input);
      expect(mockFormEngine.generateForm).not.toHaveBeenCalled();
    });

    test('should handle null form message from generateForm', async () => {
      const toolName = 'mock-tool';
      const input = { param: 'test' };
      const toolEntry: ToolRegistryEntry = {
        tool: mockTool,
        name: toolName,
        originalTool: mockTool,
      };

      mockToolRegistry.getTool.mockReturnValue(toolEntry);
      mockFormEngine.shouldGenerateForm.mockReturnValue(true);
      mockFormEngine.generateForm.mockResolvedValue(null);

      const result = await pipeline.execute(toolName, input);

      expect(result.success).toBe(true);
      expect(result.output).toBe('Mock result: test');
      expect(mockFormEngine.generateForm).toHaveBeenCalledWith(toolName, mockTool, input);
    });
  });

  describe('wrapped tool execution', () => {
    test('should execute wrapped tool with executeOriginal method', async () => {
      const toolName = TEST_EXECUTION_MESSAGES.WRAPPED_TOOL;
      const input = { param: TEST_EXECUTION_MESSAGES.WRAPPED_TEST };
      const mockWrapper = {
        executeOriginal: jest.fn().mockResolvedValue('Wrapped result: wrapped-test')
      };
      const toolEntry: ToolRegistryEntry = {
        tool: mockTool,
        name: toolName,
        originalTool: mockTool,
        wrapper: mockWrapper
      };

      mockToolRegistry.getTool.mockReturnValue(toolEntry);
      mockFormEngine.shouldGenerateForm.mockReturnValue(false);

      const result = await pipeline.execute(toolName, input);

      expect(result.success).toBe(true);
      expect(result.output).toBe('Wrapped result: wrapped-test');
      expect(mockWrapper.executeOriginal).toHaveBeenCalledWith({
        param: 'wrapped-test',
        renderForm: false
      });
    });

    test('should execute wrapped tool with originalTool.call method', async () => {
      const toolName = TEST_EXECUTION_MESSAGES.WRAPPED_TOOL;
      const input = { param: TEST_EXECUTION_MESSAGES.WRAPPED_TEST };
      const mockOriginalTool = {
        call: jest.fn().mockResolvedValue('Original tool result')
      };
      const mockWrapper = {
        originalTool: mockOriginalTool
      };
      const toolEntry: ToolRegistryEntry = {
        tool: mockTool,
        name: toolName,
        originalTool: mockTool,
        wrapper: mockWrapper
      };

      mockToolRegistry.getTool.mockReturnValue(toolEntry);
      mockFormEngine.shouldGenerateForm.mockReturnValue(false);

      const result = await pipeline.execute(toolName, input);

      expect(result.success).toBe(true);
      expect(result.output).toBe('Original tool result');
      expect(mockOriginalTool.call).toHaveBeenCalledWith({
        param: 'wrapped-test',
        renderForm: false
      });
    });

    test('should fallback to originalTool when wrapper methods unavailable', async () => {
      const toolName = TEST_EXECUTION_MESSAGES.WRAPPED_TOOL;
      const input = { param: 'fallback-test' };
      const mockWrapper = {};
      const toolEntry: ToolRegistryEntry = {
        tool: mockTool,
        name: toolName,
        originalTool: mockTool,
        wrapper: mockWrapper
      };

      mockToolRegistry.getTool.mockReturnValue(toolEntry);
      mockFormEngine.shouldGenerateForm.mockReturnValue(false);

      const result = await pipeline.execute(toolName, input);

      expect(result.success).toBe(true);
      expect(result.output).toBe('Mock result: fallback-test');
    });

    test('should execute wrapped tool when executeOriginal is not available', async () => {
      const toolName = TEST_EXECUTION_MESSAGES.WRAPPED_TOOL;
      const input = { param: TEST_EXECUTION_MESSAGES.WRAPPED_TEST };
      const mockOriginalTool = {
        call: jest.fn().mockResolvedValue('Original tool result')
      };
      const mockWrapper = {
        originalTool: mockOriginalTool
      };
      const toolEntry: ToolRegistryEntry = {
        tool: mockTool,
        name: toolName,
        originalTool: mockTool,
        wrapper: mockWrapper
      };

      mockToolRegistry.getTool.mockReturnValue(toolEntry);
      mockFormEngine.shouldGenerateForm.mockReturnValue(false);

      const result = await pipeline.execute(toolName, input);

      expect(result.success).toBe(true);
      expect(result.output).toBe('Original tool result');
      expect(mockOriginalTool.call).toHaveBeenCalledWith({
        param: 'wrapped-test',
        renderForm: false
      });
    });

    test('should execute wrapped tool when neither wrapper method is available', async () => {
      const toolName = TEST_EXECUTION_MESSAGES.WRAPPED_TOOL;
      const input = { param: 'neither-test' };
      const mockWrapper = {
        someOtherMethod: jest.fn()
      };
      const toolEntry: ToolRegistryEntry = {
        tool: mockTool,
        name: toolName,
        originalTool: mockTool,
        wrapper: mockWrapper
      };

      mockToolRegistry.getTool.mockReturnValue(toolEntry);
      mockFormEngine.shouldGenerateForm.mockReturnValue(false);

      const result = await pipeline.execute(toolName, input);

      expect(result.success).toBe(true);
      expect(result.output).toBe('Mock result: neither-test');
    });
  });

  describe('getStatistics', () => {
    test('should return pipeline statistics', () => {
      const stats = pipeline.getStatistics();

      expect(stats).toEqual({
        totalMiddleware: 0,
        registeredMiddleware: []
      });
    });
  });

  describe('trace ID generation', () => {
    test('should generate unique trace IDs for each execution', async () => {
      const toolName = 'mock-tool';
      const input = { param: 'test' };
      const toolEntry: ToolRegistryEntry = {
        tool: mockTool,
        name: toolName,
        originalTool: mockTool,
      };

      mockToolRegistry.getTool.mockReturnValue(toolEntry);
      mockFormEngine.shouldGenerateForm.mockReturnValue(false);

      const result1 = await pipeline.execute(toolName, input);
      const result2 = await pipeline.execute(toolName, input);

      expect(result1.traceId).not.toBe(result2.traceId);
      expect(result1.traceId).toMatch(/^trace-\d+-[a-z0-9]{9}$/);
      expect(result2.traceId).toMatch(/^trace-\d+-[a-z0-9]{9}$/);
    });
  });
});