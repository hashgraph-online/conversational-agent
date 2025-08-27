import { z, ZodError } from 'zod';
import { FormAwareAgentExecutor, ParameterPreprocessingCallback } from '../../../src/langchain/form-aware-agent-executor';
import type { FormSubmission } from '../../../src/forms/types';
import type { StructuredTool } from '@langchain/core/tools';
import type { AgentAction, AgentFinish, AgentStep } from 'langchain/agents';
import type { ChainValues } from '@langchain/core/utils/types';
import type { CallbackManagerForChainRun } from '@langchain/core/callbacks/manager';
import type { RunnableConfig } from '@langchain/core/runnables';

// Mock AgentExecutor before imports
jest.mock('langchain/agents', () => ({
  AgentExecutor: class MockAgentExecutor {
    agent: any;
    tools: any[];
    verbose: boolean;

    constructor(args: any) {
      this.agent = args.agent || {};
      this.tools = args.tools || [];
      this.verbose = args.verbose || false;
    }

    async call(inputs: any): Promise<any> {
      return { output: 'mock output', intermediateSteps: [] };
    }
  },
}));

jest.mock('../../../src/forms/form-generator', () => ({
  FormGenerator: jest.fn().mockImplementation(() => ({
    generateFormFromSchema: jest.fn(),
    generateJsonSchemaForm: jest.fn(),
  })),
}));

jest.mock('../../../src/forms/form-engine', () => ({
  FormEngine: jest.fn().mockImplementation(() => ({
    processFormSubmission: jest.fn(),
    getStatistics: jest.fn().mockReturnValue({
      totalFormsGenerated: 0,
      totalValidationErrors: 0,
      averageFieldsPerForm: 0,
    }),
  })),
}));

interface MockTool extends StructuredTool {
  name: string;
  description: string;
  schema: z.ZodObject<z.ZodRawShape>;
  originalTool?: {
    call?: (args: Record<string, unknown>) => Promise<string>;
  };
  call?: (args: Record<string, unknown>) => Promise<string>;
}

interface MockAgentResponse {
  tool: string;
  toolInput: Record<string, unknown>;
  log: string;
}

interface MockAgentFinish {
  returnValues: {
    output: string;
  };
  log: string;
}

const createMockTool = (
  name: string,
  schema: z.ZodObject<z.ZodRawShape>,
  callResult?: string | Error
): MockTool => ({
  name,
  description: `Mock tool ${name}`,
  schema,
  call: jest.fn().mockImplementation(async (args: Record<string, unknown>) => {
    if (callResult instanceof Error) {
      throw callResult;
    }
    return callResult || `Mock response from ${name}`;
  }),
});

const createMockExecutor = (
  tools: MockTool[],
  agentResponse?: MockAgentResponse | MockAgentFinish | Error
) => {
  const mockAgent = {
    plan: jest.fn().mockImplementation(async () => {
      if (agentResponse instanceof Error) {
        throw agentResponse;
      }
      return agentResponse;
    }),
    returnStoppedResponse: jest.fn(),
  };

  return new FormAwareAgentExecutor({
    agent: mockAgent as any,
    tools,
    verbose: false,
  });
};

describe('FormAwareAgentExecutor Comprehensive Tests', () => {
  describe('Constructor and Initialization', () => {
    it('should initialize with proper defaults', () => {
      const tools: MockTool[] = [];
      const executor = createMockExecutor(tools);
      
      expect(executor).toBeInstanceOf(FormAwareAgentExecutor);
      expect(executor.getPendingForms().size).toBe(0);
      expect(executor.hasPendingForms()).toBe(false);
    });

    it('should initialize with tools', () => {
      const schema = z.object({
        input: z.string(),
      });
      const tool = createMockTool('test-tool', schema);
      const executor = createMockExecutor([tool]);
      
      expect(executor).toBeInstanceOf(FormAwareAgentExecutor);
    });
  });

  describe('Parameter Preprocessing', () => {
    it('should set and use parameter preprocessing callback', async () => {
      const schema = z.object({
        input: z.string(),
      });
      const tool = createMockTool('test-tool', schema, 'processed result');
      const executor = createMockExecutor([tool], {
        tool: 'test-tool',
        toolInput: { input: 'test' },
        log: 'Using test-tool',
      });

      const preprocessCallback: ParameterPreprocessingCallback = jest.fn()
        .mockResolvedValue({ input: 'preprocessed' });

      executor.setParameterPreprocessingCallback(preprocessCallback);

      await executor._takeNextStep(
        { 'test-tool': tool },
        { input: 'test input' },
        [],
        undefined,
        undefined
      );

      expect(preprocessCallback).toHaveBeenCalledWith('test-tool', { input: 'test' });
    });

    it('should work without preprocessing callback', async () => {
      const schema = z.object({
        input: z.string(),
      });
      const tool = createMockTool('test-tool', schema, 'result');
      const executor = createMockExecutor([tool], {
        tool: 'test-tool',
        toolInput: { input: 'test' },
        log: 'Using test-tool',
      });

      const result = await executor._takeNextStep(
        { 'test-tool': tool },
        { input: 'test input' },
        [],
        undefined,
        undefined
      );

      expect(Array.isArray(result)).toBe(true);
    });
  });

  describe('Zod Validation and Form Generation', () => {
    it('should generate form for Zod validation errors', async () => {
      const schema = z.object({
        requiredField: z.string(),
        optionalField: z.string().optional(),
      });
      
      const zodError = new ZodError([
        {
          code: 'invalid_type',
          expected: 'string',
          received: 'undefined',
          path: ['requiredField'],
          message: 'Required',
        },
      ]);

      const tool = createMockTool('test-tool', schema, zodError);
      const executor = createMockExecutor([tool], {
        tool: 'test-tool',
        toolInput: { optionalField: 'test' },
        log: 'Using test-tool',
      });

      const result = await executor._takeNextStep(
        { 'test-tool': tool },
        { input: 'test input' },
        [],
        undefined,
        undefined
      );

      expect(Array.isArray(result)).toBe(true);
      expect(executor.hasPendingForms()).toBe(true);
    });

    it('should handle complex Zod schema validation', async () => {
      const schema = z.object({
        nested: z.object({
          field: z.string(),
        }),
        array: z.array(z.string()).min(1),
        union: z.union([z.string(), z.number()]),
      });
      
      const zodError = new ZodError([
        {
          code: 'invalid_type',
          expected: 'string',
          received: 'undefined',
          path: ['nested', 'field'],
          message: 'Required',
        },
        {
          code: 'too_small',
          minimum: 1,
          type: 'array',
          inclusive: true,
          exact: false,
          path: ['array'],
          message: 'Array must contain at least 1 element(s)',
        },
      ]);

      const tool = createMockTool('complex-tool', schema, zodError);
      const executor = createMockExecutor([tool], {
        tool: 'complex-tool',
        toolInput: { nested: {}, array: [] },
        log: 'Using complex-tool',
      });

      const result = await executor._takeNextStep(
        { 'complex-tool': tool },
        { input: 'test input' },
        [],
        undefined,
        undefined
      );

      expect(Array.isArray(result)).toBe(true);
      expect(executor.hasPendingForms()).toBe(true);
    });

    it('should detect required fields correctly', () => {
      const executor = createMockExecutor([]);
      
      const requiredSchema = z.string();
      const optionalSchema = z.string().optional();
      const defaultSchema = z.string().default('default');
      const nullableSchema = z.string().nullable();

      expect(executor['isFieldRequired'](requiredSchema)).toBe(true);
      expect(executor['isFieldRequired'](optionalSchema)).toBe(false);
      expect(executor['isFieldRequired'](defaultSchema)).toBe(false);
      expect(executor['isFieldRequired'](nullableSchema)).toBe(false);
    });
  });

  describe('Form Processing', () => {
    it('should process valid form submission', async () => {
      const schema = z.object({
        field1: z.string(),
        field2: z.number(),
      });
      
      const tool = createMockTool('form-tool', schema, 'form processed');
      const executor = createMockExecutor([tool]);

      executor.getPendingForms().set('form-123', {
        toolName: 'form-tool',
        originalInput: { field1: '' },
        schema: schema,
        toolRef: tool,
      });

      const formSubmission: FormSubmission = {
        formId: 'form-123',
        values: {
          field1: 'test value',
          field2: 42,
        },
        isValid: true,
      };

      const result = await executor.processFormSubmission(formSubmission);

      expect(result).toBeDefined();
      expect(result.success).toBe(true);
      expect(executor.getPendingForms().has('form-123')).toBe(false);
    });

    it('should handle invalid form submission', async () => {
      const schema = z.object({
        field1: z.string(),
      });
      
      const tool = createMockTool('form-tool', schema);
      const executor = createMockExecutor([tool]);

      executor.getPendingForms().set('form-123', {
        toolName: 'form-tool',
        originalInput: { field1: '' },
        schema: schema,
        toolRef: tool,
      });

      const formSubmission: FormSubmission = {
        formId: 'form-123',
        values: {
          field1: '',
        },
        isValid: false,
      };

      const result = await executor.processFormSubmission(formSubmission);

      expect(result).toBeDefined();
      expect(result.success).toBe(false);
    });

    it('should handle form submission for non-existent form', async () => {
      const executor = createMockExecutor([]);

      const formSubmission: FormSubmission = {
        formId: 'non-existent',
        values: {},
        isValid: true,
      };

      const result = await executor.processFormSubmission(formSubmission);

      expect(result).toBeDefined();
      expect(result.success).toBe(false);
    });
  });

  describe('Tool Detection and Context Analysis', () => {
    it('should extract tool info from error context', () => {
      const executor = createMockExecutor([]);
      
      const errorMessage = 'Tool "test-tool" failed with invalid input';
      const toolInfo = executor['extractToolInfoFromError'](errorMessage);
      
      expect(toolInfo).toContain('test-tool');
    });

    it('should detect tool from error context with schema matching', () => {
      const schema = z.object({
        accountId: z.string(),
        amount: z.number(),
      });
      
      const tool = createMockTool('transfer-tool', schema);
      const executor = createMockExecutor([tool]);
      
      const zodError = new ZodError([
        {
          code: 'invalid_type',
          expected: 'string',
          received: 'undefined',
          path: ['accountId'],
          message: 'Required',
        },
      ]);

      const detectedTool = executor['detectToolFromErrorContext'](
        { 'transfer-tool': tool },
        zodError,
        'transfer some tokens'
      );

      expect(detectedTool).toBe('transfer-tool');
    });

    it('should find tool from context using keywords', () => {
      const schema1 = z.object({ name: z.string() });
      const schema2 = z.object({ accountId: z.string() });
      
      const tool1 = createMockTool('inscribe-tool', schema1);
      const tool2 = createMockTool('transfer-tool', schema2);
      const executor = createMockExecutor([tool1, tool2]);

      const foundTool = executor['findToolFromContext'](
        { 'inscribe-tool': tool1, 'transfer-tool': tool2 },
        'I want to inscribe some content'
      );

      expect(foundTool).toBe('inscribe-tool');
    });

    it('should extract tool keywords correctly', () => {
      const executor = createMockExecutor([]);
      
      const keywords1 = executor['extractToolKeywords']('inscribe-tool');
      expect(keywords1).toContain('inscribe');
      
      const keywords2 = executor['extractToolKeywords']('transfer-hbar-tool');
      expect(keywords2).toContain('transfer');
      expect(keywords2).toContain('hbar');
    });

    it('should check if schema matches error paths', () => {
      const executor = createMockExecutor([]);
      
      const schema = z.object({
        user: z.object({
          name: z.string(),
          email: z.string(),
        }),
        settings: z.object({
          theme: z.string(),
        }),
      });

      const errorPaths = [['user', 'name'], ['settings', 'theme']];
      
      expect(executor['schemaMatchesErrorPaths'](schema, errorPaths)).toBe(true);
      
      const nonMatchingPaths = [['user', 'age'], ['config', 'lang']];
      expect(executor['schemaMatchesErrorPaths'](schema, nonMatchingPaths)).toBe(false);
    });
  });

  describe('HashLink Response Processing', () => {
    it('should detect HashLink blocks in metadata', () => {
      const executor = createMockExecutor([]);
      
      const metadataWithHashLink = {
        hashLinkBlock: {
          blockId: 'block-123',
          hashLink: 'hrl://example.com/block-123',
          template: 'test-template',
          attributes: { key: 'value' },
        },
      };

      expect(executor['hasHashLinkBlock'](metadataWithHashLink)).toBe(true);
      expect(executor['hasHashLinkBlock']({})).toBe(false);
      expect(executor['hasHashLinkBlock'](null)).toBe(false);
    });

    it('should process HashLink response with metadata', async () => {
      const executor = createMockExecutor([]);
      
      const response = 'Tool executed successfully';
      const metadata = {
        hashLinkBlock: {
          blockId: 'block-123',
          hashLink: 'hrl://example.com/block-123',
          template: 'success-template',
          attributes: { success: true },
        },
      };

      const processedResponse = executor['processHashLinkResponse'](response, metadata);
      
      expect(processedResponse).toContain('block-123');
      expect(processedResponse).toContain('hrl://example.com/block-123');
    });
  });

  describe('Type Guards and Validation', () => {
    it('should correctly identify ZodObject types', () => {
      const executor = createMockExecutor([]);
      
      const zodObject = z.object({ field: z.string() });
      const zodString = z.string();
      const zodArray = z.array(z.string());
      
      expect(executor['isZodObject'](zodObject)).toBe(true);
      expect(executor['isZodObject'](zodString)).toBe(false);
      expect(executor['isZodObject'](zodArray)).toBe(false);
      expect(executor['isZodObject'](null)).toBe(false);
    });
  });

  describe('Form State Management', () => {
    it('should manage pending forms correctly', () => {
      const executor = createMockExecutor([]);
      
      expect(executor.hasPendingForms()).toBe(false);
      expect(executor.getPendingForms().size).toBe(0);
      
      executor.getPendingForms().set('form-1', {
        toolName: 'test-tool',
        originalInput: {},
        schema: z.object({}),
      });
      
      expect(executor.hasPendingForms()).toBe(true);
      expect(executor.getPendingForms().size).toBe(1);
      
      const formsInfo = executor.getPendingFormsInfo();
      expect(formsInfo.totalPendingForms).toBe(1);
      expect(formsInfo.formIds).toContain('form-1');
    });

    it('should restore pending forms', () => {
      const executor = createMockExecutor([]);
      
      const formsToRestore = new Map([
        ['form-1', {
          toolName: 'test-tool',
          originalInput: {},
          schema: z.object({}),
        }],
      ]);
      
      executor.restorePendingForms(formsToRestore);
      
      expect(executor.hasPendingForms()).toBe(true);
      expect(executor.getPendingForms().size).toBe(1);
    });

    it('should get form engine statistics', () => {
      const executor = createMockExecutor([]);
      
      const stats = executor.getFormEngineStatistics();
      
      expect(stats).toHaveProperty('totalFormsGenerated');
      expect(stats).toHaveProperty('totalValidationErrors');
      expect(stats).toHaveProperty('averageFieldsPerForm');
    });
  });

  describe('Error Handling', () => {
    it('should handle validation errors gracefully', async () => {
      const schema = z.object({
        field: z.string(),
      });
      
      const zodError = new ZodError([
        {
          code: 'invalid_type',
          expected: 'string',
          received: 'undefined',
          path: ['field'],
          message: 'Required',
        },
      ]);

      const executor = createMockExecutor([]);
      
      const result = await executor['handleValidationError'](
        zodError,
        'test-tool',
        { field: undefined },
        { 'test-tool': createMockTool('test-tool', schema) }
      );

      expect(result).toBeDefined();
      expect(result).toContain('form');
    });

    it('should handle non-Zod errors', async () => {
      const executor = createMockExecutor([]);
      
      const genericError = new Error('Generic tool error');
      
      await expect(async () => {
        const tool = createMockTool('error-tool', z.object({}), genericError);
        await executor._takeNextStep(
          { 'error-tool': tool },
          { input: 'test' },
          [],
          undefined,
          undefined
        );
      }).rejects.toThrow('Generic tool error');
    });
  });

  describe('Response Formatting', () => {
    it('should format form response correctly', () => {
      const executor = createMockExecutor([]);
      
      const formData = {
        formId: 'form-123',
        toolName: 'test-tool',
        fields: [
          {
            name: 'field1',
            type: 'text' as const,
            label: 'Field 1',
            required: true,
          },
        ],
      };

      const formatted = executor['formatFormResponse'](formData);
      
      expect(formatted).toContain('form-123');
      expect(formatted).toContain('test-tool');
      expect(formatted).toContain('Field 1');
    });
  });

  describe('Integration with AgentExecutor', () => {
    it('should handle successful agent execution', async () => {
      const schema = z.object({
        input: z.string(),
      });
      
      const tool = createMockTool('success-tool', schema, 'Success result');
      const executor = createMockExecutor([tool], {
        tool: 'success-tool',
        toolInput: { input: 'test' },
        log: 'Using success-tool',
      });

      const result = await executor._takeNextStep(
        { 'success-tool': tool },
        { input: 'test input' },
        [],
        undefined,
        undefined
      );

      expect(Array.isArray(result)).toBe(true);
      if (Array.isArray(result) && result.length > 0) {
        expect(result[0]).toHaveProperty('action');
        expect(result[0]).toHaveProperty('observation');
      }
    });

    it('should handle agent finish response', async () => {
      const executor = createMockExecutor([], {
        returnValues: { output: 'Final answer' },
        log: 'Task completed',
      });

      const result = await executor._takeNextStep(
        {},
        { input: 'test input' },
        [],
        undefined,
        undefined
      );

      expect(result).toHaveProperty('returnValues');
    });

    it('should handle agent execution with callback manager', async () => {
      const schema = z.object({
        input: z.string(),
      });
      
      const tool = createMockTool('callback-tool', schema, 'Callback result');
      const executor = createMockExecutor([tool], {
        tool: 'callback-tool',
        toolInput: { input: 'test' },
        log: 'Using callback-tool',
      });

      const mockRunManager = {
        getChild: jest.fn().mockReturnValue({}),
      } as unknown as CallbackManagerForChainRun;

      const result = await executor._takeNextStep(
        { 'callback-tool': tool },
        { input: 'test input' },
        [],
        mockRunManager,
        undefined
      );

      expect(Array.isArray(result)).toBe(true);
      expect(mockRunManager.getChild).toHaveBeenCalled();
    });
  });

  describe('Tool Wrapper Integration', () => {
    it('should handle tools with originalTool property', async () => {
      const schema = z.object({
        input: z.string(),
      });
      
      const originalCall = jest.fn().mockResolvedValue('Original result');
      const wrappedTool: MockTool = {
        ...createMockTool('wrapped-tool', schema),
        originalTool: { call: originalCall },
      };

      const executor = createMockExecutor([wrappedTool], {
        tool: 'wrapped-tool',
        toolInput: { input: 'test' },
        log: 'Using wrapped-tool',
      });

      const result = await executor._takeNextStep(
        { 'wrapped-tool': wrappedTool },
        { input: 'test input' },
        [],
        undefined,
        undefined
      );

      expect(Array.isArray(result)).toBe(true);
    });

    it('should handle executeOriginal method on tool wrappers', async () => {
      const schema = z.object({
        input: z.string(),
      });
      
      const executeOriginal = jest.fn().mockResolvedValue('Execute original result');
      const wrappedTool: any = {
        ...createMockTool('executor-tool', schema),
        executeOriginal,
      };

      const executor = createMockExecutor([wrappedTool], {
        tool: 'executor-tool',
        toolInput: { input: 'test' },
        log: 'Using executor-tool',
      });

      await executor._takeNextStep(
        { 'executor-tool': wrappedTool },
        { input: 'test input' },
        [],
        undefined,
        undefined
      );

      expect(executeOriginal).toHaveBeenCalledWith({ input: 'test' });
    });
  });

  describe('Edge Cases and Error Conditions', () => {
    it('should handle empty tool input', async () => {
      const schema = z.object({});
      const tool = createMockTool('empty-tool', schema, 'Empty result');
      const executor = createMockExecutor([tool], {
        tool: 'empty-tool',
        toolInput: {},
        log: 'Using empty-tool',
      });

      const result = await executor._takeNextStep(
        { 'empty-tool': tool },
        { input: 'test input' },
        [],
        undefined,
        undefined
      );

      expect(Array.isArray(result)).toBe(true);
    });

    it('should handle tool not found in nameToolMap', async () => {
      const executor = createMockExecutor([], {
        tool: 'non-existent-tool',
        toolInput: { input: 'test' },
        log: 'Using non-existent-tool',
      });

      await expect(async () => {
        await executor._takeNextStep(
          {},
          { input: 'test input' },
          [],
          undefined,
          undefined
        );
      }).rejects.toThrow();
    });

    it('should handle malformed tool response', async () => {
      const executor = createMockExecutor([], null as any);

      await expect(async () => {
        await executor._takeNextStep(
          {},
          { input: 'test input' },
          [],
          undefined,
          undefined
        );
      }).rejects.toThrow();
    });
  });

  describe('Memory and Performance', () => {
    it('should handle large number of pending forms', () => {
      const executor = createMockExecutor([]);
      
      for (let i = 0; i < 1000; i++) {
        executor.getPendingForms().set(`form-${i}`, {
          toolName: `tool-${i}`,
          originalInput: {},
          schema: z.object({}),
        });
      }
      
      expect(executor.getPendingForms().size).toBe(1000);
      expect(executor.hasPendingForms()).toBe(true);
      
      const info = executor.getPendingFormsInfo();
      expect(info.totalPendingForms).toBe(1000);
    });
  });
});