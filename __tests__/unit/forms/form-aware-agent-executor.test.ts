import { z, ZodError } from 'zod';
import { FormAwareAgentExecutor } from '../../../src/langchain/form-aware-agent-executor';
import type { FormSubmission } from '../../../src/forms/types';
import type { StructuredTool } from '@langchain/core/tools';
import { TEST_FORM_CONSTANTS } from '../../test-constants';

interface MockContentAwareAgentExecutorArgs {
  tools: StructuredTool[];
}

interface MockExecutorInputs extends Record<string, unknown> {
  input: string;
  simulateZodError?: boolean;
  intermediateSteps?: Array<{
    action: {
      tool: string;
      toolInput: Record<string, unknown>;
      log: string;
    };
    observation: string;
  }>;
}

interface MockExecutorResponse extends Record<string, unknown> {
  output: string;
  intermediateSteps: unknown[];
}
jest.mock('@langchain/agents', () => {
  return {
    AgentExecutor: class MockAgentExecutor {
      tools: StructuredTool[];

      constructor(args: MockContentAwareAgentExecutorArgs) {
        this.tools = args.tools || [];
      }

      async _call(inputs: MockExecutorInputs): Promise<MockExecutorResponse> {
        if (inputs.simulateZodError) {
          throw new ZodError([
            {
              code: 'invalid_type',
              expected: 'string',
              received: 'undefined',
              path: ['tokenName'],
              message: 'Required',
            },
          ]);
        }

        return {
          output: 'Mock response',
          intermediateSteps: [],
        };
      }
    },
  };
});

/**
 * Test suite for FormAwareAgentExecutor using TDD approach
 */
describe('FormAwareAgentExecutor', () => {
  let executor: FormAwareAgentExecutor;
  let mockTool: StructuredTool;

  beforeEach(() => {
    mockTool = {
      name: 'HederaCreateNftTool',
      description: 'Creates an NFT',
      schema: z.object({
        tokenName: z.string(),
        tokenSymbol: z.string(),
        maxSupply: z.number(),
      }),
      _call: jest.fn(),
    } as StructuredTool;

    executor = new FormAwareAgentExecutor({
      agent: {} as unknown,
      tools: [mockTool],
      verbose: false,
      returnIntermediateSteps: true,
    });
  });

  describe('_call with Zod error handling', () => {
    test('should intercept ZodError and generate form message', async () => {
      const inputs = {
        input: TEST_FORM_CONSTANTS.CREATE_NFT_COLLECTION,
        simulateZodError: true,
        intermediateSteps: [
          {
            action: {
              tool: 'HederaCreateNftTool',
              toolInput: {},
              log: 'Calling tool',
            },
            observation: 'Error',
          },
        ],
      };

      const result = await executor._call(inputs);

      expect(result.requiresForm).toBe(true);
      expect(result.formMessage).toBeDefined();
      expect(result.formMessage.type).toBe('form');
      expect(result.formMessage.toolName).toBe('HederaCreateNftTool');
      expect(result.formMessage.originalPrompt).toBe(
        TEST_FORM_CONSTANTS.CREATE_NFT_COLLECTION
      );
      expect(result.output).toContain('I need some additional information');
    });

    test('should not intercept non-Zod errors', async () => {
      const inputs = { input: 'test' };

      const originalSuper = Object.getPrototypeOf(
        Object.getPrototypeOf(executor)
      )._call;
      Object.getPrototypeOf(Object.getPrototypeOf(executor))._call = jest
        .fn()
        .mockImplementation(() => {
          throw new Error('Regular error');
        });

      await expect(executor._call(inputs)).rejects.toThrow('Regular error');

      Object.getPrototypeOf(Object.getPrototypeOf(executor))._call =
        originalSuper;
    });

    test('should pass through normal responses without interception', async () => {
      const inputs = { input: 'test normal response' };

      const result = await executor._call(inputs);

      expect(result.output).toBe('Mock response');
      expect(result.requiresForm).toBeUndefined();
      expect(result.formMessage).toBeUndefined();
    });
  });

  describe('processFormSubmission', () => {
    beforeEach(async () => {
      const inputs = {
        input: TEST_FORM_CONSTANTS.CREATE_NFT_COLLECTION,
        simulateZodError: true,
        intermediateSteps: [
          {
            action: { tool: 'HederaCreateNftTool', toolInput: {}, log: 'test' },
            observation: 'Error',
          },
        ],
      };

      await executor._call(inputs);
    });

    test('should process form submission and continue execution', async () => {
      const pendingForms = executor.getPendingFormsInfo();
      expect(pendingForms.length).toBe(1);

      const formSubmission: FormSubmission = {
        formId: pendingForms[0].formId,
        data: {
          tokenName: 'Test Token',
          tokenSymbol: 'TEST',
          maxSupply: 1000,
        },
        timestamp: Date.now(),
      };

      const originalSuper = Object.getPrototypeOf(
        Object.getPrototypeOf(executor)
      )._call;
      Object.getPrototypeOf(Object.getPrototypeOf(executor))._call = jest
        .fn()
        .mockResolvedValue({
          output: 'Form submission successful',
          intermediateSteps: [],
        });

      const result = await executor.processFormSubmission(formSubmission);

      expect(result.output).toBeDefined();
      expect(executor.getPendingFormsInfo().length).toBe(0);

      Object.getPrototypeOf(Object.getPrototypeOf(executor))._call =
        originalSuper;
    });

    test('should throw error for non-existent form ID', async () => {
      const formSubmission: FormSubmission = {
        formId: 'non-existent-id',
        data: { test: 'value' },
        timestamp: Date.now(),
      };

      await expect(
        executor.processFormSubmission(formSubmission)
      ).rejects.toThrow('No pending form found for ID: non-existent-id');
    });

    test('should handle validation errors in form submission', async () => {
      const pendingForms = executor.getPendingFormsInfo();

      const formSubmission: FormSubmission = {
        formId: pendingForms[0].formId,
        data: {
        },
        timestamp: Date.now(),
      };

      const result = await executor.processFormSubmission(formSubmission);

      expect(result).toBeDefined();
    });
  });

  describe('tool detection', () => {
    test('should detect tool from intermediate steps', async () => {
      const inputs = {
        input: 'Create an NFT',
        simulateZodError: true,
        intermediateSteps: [
          {
            action: {
              tool: 'HederaCreateNftTool',
              toolInput: { tokenName: 'test' },
              log: 'Executing tool',
            },
            observation: 'Tool executed',
          },
        ],
      };

      const result = await executor._call(inputs);

      expect(result.formMessage.toolName).toBe('HederaCreateNftTool');
    });

    test('should detect tool from input context when no intermediate steps', async () => {
      const inputs = {
        input: 'Create an NFT using HederaCreateNftTool',
        simulateZodError: true,
        intermediateSteps: [],
      };

      const result = await executor._call(inputs);

      expect(result.formMessage).toBeDefined();
    });
  });

  describe('pending forms management', () => {
    test('should track pending forms correctly', async () => {
      expect(executor.hasPendingForms()).toBe(false);
      expect(executor.getPendingFormsInfo()).toEqual([]);

      await executor._call({
        input: 'test',
        simulateZodError: true,
        intermediateSteps: [{ action: { tool: 'HederaCreateNftTool' } }],
      });

      expect(executor.hasPendingForms()).toBe(true);
      expect(executor.getPendingFormsInfo().length).toBe(1);
      expect(executor.getPendingFormsInfo()[0].toolName).toBe(
        'HederaCreateNftTool'
      );
    });
  });
});
