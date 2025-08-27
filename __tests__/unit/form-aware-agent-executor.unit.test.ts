import { FormAwareAgentExecutor, ParameterPreprocessingCallback } from '../../src/langchain/form-aware-agent-executor';
import { AgentExecutor } from 'langchain/agents';
import { FormGenerator } from '../../src/forms/form-generator';
import { FormEngine } from '../../src/forms/form-engine';
import { Logger } from '@hashgraphonline/standards-sdk';
import { ResponseFormatter } from '../../src/utils/response-formatter';
import { isFormValidatable } from '@hashgraphonline/standards-agent-kit';
import { z, ZodError } from 'zod';
import type { AgentAction, AgentFinish, AgentStep } from 'langchain/agents';
import type { ToolInterface } from '@langchain/core/tools';
import type { FormMessage, FormSubmission } from '../../src/forms/types';
import type { CallbackManagerForChainRun } from '@langchain/core/callbacks/manager';
import type { RunnableConfig } from '@langchain/core/runnables';
import type { ChainValues } from '@langchain/core/utils/types';

jest.mock('langchain/agents');
jest.mock('../../src/forms/form-generator');
jest.mock('../../src/forms/form-engine');
jest.mock('@hashgraphonline/standards-sdk');
jest.mock('../../src/utils/response-formatter');
jest.mock('@hashgraphonline/standards-agent-kit');

const mockAgentExecutor = AgentExecutor as jest.MockedClass<typeof AgentExecutor>;
const mockFormGenerator = FormGenerator as jest.MockedClass<typeof FormGenerator>;
const mockFormEngine = FormEngine as jest.MockedClass<typeof FormEngine>;
const mockLogger = Logger as jest.MockedClass<typeof Logger>;
const mockResponseFormatter = ResponseFormatter as jest.Mocked<typeof ResponseFormatter>;
const mockIsFormValidatable = isFormValidatable as jest.MockedFunction<typeof isFormValidatable>;

describe('FormAwareAgentExecutor', () => {
  let executor: FormAwareAgentExecutor;
  let mockAgent: any;
  let mockTools: ToolInterface[];
  let mockFormGeneratorInstance: jest.Mocked<FormGenerator>;
  let mockFormEngineInstance: jest.Mocked<FormEngine>;
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

    mockFormGeneratorInstance = {
      generateFormFromError: jest.fn(),
      generateFormFromSchema: jest.fn(),
      generateJsonSchemaForm: jest.fn(),
    } as any;

    mockFormGenerator.mockImplementation(() => mockFormGeneratorInstance);

    mockFormEngineInstance = {
      processFormSubmission: jest.fn(),
      validateSubmission: jest.fn(),
    } as any;

    mockFormEngine.mockImplementation(() => mockFormEngineInstance);

    mockAgent = {
      plan: jest.fn(),
    };

    mockTools = [
      {
        name: 'test-tool',
        description: 'Test tool',
        schema: z.object({ name: z.string() }),
        call: jest.fn(),
      },
    ];

    mockIsFormValidatable.mockReturnValue(false);

    mockResponseFormatter.isInscriptionResponse = jest.fn().mockReturnValue(false);
    mockResponseFormatter.formatInscriptionResponse = jest.fn().mockReturnValue('formatted response');

    executor = new FormAwareAgentExecutor({
      agent: mockAgent,
      tools: mockTools,
    });
  });

  describe('constructor', () => {
    it('should create a FormAwareAgentExecutor instance', () => {
      expect(executor).toBeInstanceOf(FormAwareAgentExecutor);
      expect(executor).toBeInstanceOf(AgentExecutor);
    });

    it('should initialize form generator and engine', () => {
      expect(mockFormGenerator).toHaveBeenCalled();
      expect(mockFormEngine).toHaveBeenCalledWith(expect.any(Logger));
    });

    it('should initialize logger', () => {
      expect(mockLogger).toHaveBeenCalledWith({ module: 'FormAwareAgentExecutor' });
    });
  });

  describe('setParameterPreprocessingCallback', () => {
    it('should set parameter preprocessing callback', () => {
      const callback: ParameterPreprocessingCallback = jest.fn();
      
      executor.setParameterPreprocessingCallback(callback);
      
      expect(executor['parameterPreprocessingCallback']).toBe(callback);
    });

    it('should unset parameter preprocessing callback', () => {
      executor.setParameterPreprocessingCallback(undefined);
      
      expect(executor['parameterPreprocessingCallback']).toBeUndefined();
    });
  });

  describe('type guards', () => {
    describe('isZodObject', () => {
      it('should return true for ZodObject instances', () => {
        const zodObject = z.object({ name: z.string() });
        
        const result = executor['isZodObject'](zodObject);
        
        expect(result).toBe(true);
      });

      it('should return false for non-ZodObject schemas', () => {
        const zodString = z.string();
        
        const result = executor['isZodObject'](zodString);
        
        expect(result).toBe(false);
      });

      it('should return false for non-schema objects', () => {
        const notASchema = { some: 'object' };
        
        const result = executor['isZodObject'](notASchema);
        
        expect(result).toBe(false);
      });
    });

    describe('hasHashLinkBlock', () => {
      it('should return true for valid hashLinkBlock metadata', () => {
        const metadata = {
          hashLinkBlock: {
            blockId: 'test-id',
            hashLink: 'test-link',
            template: 'test-template',
            attributes: {},
          },
        };
        
        const result = executor['hasHashLinkBlock'](metadata);
        
        expect(result).toBe(true);
      });

      it('should return false for metadata without hashLinkBlock', () => {
        const metadata = { someOtherProperty: 'value' };
        
        const result = executor['hasHashLinkBlock'](metadata);
        
        expect(result).toBe(false);
      });

      it('should return false for null or undefined metadata', () => {
        expect(executor['hasHashLinkBlock'](null)).toBe(false);
        expect(executor['hasHashLinkBlock'](undefined)).toBe(false);
      });
    });
  });

  describe('_takeNextStep', () => {
    let mockNameToolMap: Record<string, ToolInterface>;
    let mockInputs: ChainValues;
    let mockIntermediateSteps: AgentStep[];
    let mockRunManager: CallbackManagerForChainRun;

    beforeEach(() => {
      mockNameToolMap = {
        'test-tool': mockTools[0],
      };
      mockInputs = { input: 'test input' };
      mockIntermediateSteps = [];
      mockRunManager = {
        getChild: jest.fn().mockReturnValue({}),
      } as any;
    });

    it('should return AgentFinish when agent returns finish action', async () => {
      const finishAction: AgentFinish = {
        returnValues: { output: 'test output' },
        log: 'test log',
      };

      mockAgent.plan.mockResolvedValue(finishAction);

      const result = await executor['_takeNextStep'](
        mockNameToolMap,
        mockInputs,
        mockIntermediateSteps,
        mockRunManager
      );

      expect(result).toEqual(finishAction);
      expect(mockLoggerInstance.info).toHaveBeenCalledWith(
        'Agent returned finish action, passing through'
      );
    });

    it('should intercept tool calls and check for form validation', async () => {
      const agentAction: AgentAction = {
        tool: 'test-tool',
        toolInput: { name: 'test' },
        log: 'test log',
      };

      mockAgent.plan.mockResolvedValue(agentAction);
      mockIsFormValidatable.mockReturnValue(false);

      const mockTool = mockTools[0];
      mockTool.call = jest.fn().mockResolvedValue('tool result');

      await executor['_takeNextStep'](
        mockNameToolMap,
        mockInputs,
        mockIntermediateSteps,
        mockRunManager
      );

      expect(mockLoggerInstance.info).toHaveBeenCalledWith(
        '🎯 INTERCEPTING TOOL CALL: test-tool',
        expect.any(Object)
      );
      expect(mockTool.call).toHaveBeenCalled();
    });

    it('should throw error when tool is not found', async () => {
      const agentAction: AgentAction = {
        tool: 'nonexistent-tool',
        toolInput: {},
        log: 'test log',
      };

      mockAgent.plan.mockResolvedValue(agentAction);

      await expect(
        executor['_takeNextStep'](
          mockNameToolMap,
          mockInputs,
          mockIntermediateSteps,
          mockRunManager
        )
      ).rejects.toThrow('Tool "nonexistent-tool" not found');
    });

    it('should generate form when FormValidatable tool requires it', async () => {
      const agentAction: AgentAction = {
        tool: 'test-tool',
        toolInput: { name: '' },
        log: 'test log',
      };

      const mockFormValidatableTool = {
        ...mockTools[0],
        shouldGenerateForm: jest.fn().mockReturnValue(true),
        getFormSchema: jest.fn().mockReturnValue(z.object({ name: z.string() })),
        isFieldEmpty: jest.fn().mockReturnValue(true),
        getEssentialFields: jest.fn().mockReturnValue(['name']),
      };

      mockNameToolMap['test-tool'] = mockFormValidatableTool;
      mockAgent.plan.mockResolvedValue(agentAction);
      mockIsFormValidatable.mockReturnValue(true);

      const mockFormMessage: FormMessage = {
        type: 'form',
        id: 'form-123',
        formConfig: {
          title: 'Test Form',
          description: 'Test description',
          fields: [],
          submitLabel: 'Submit',
          cancelLabel: 'Cancel',
        },
        originalPrompt: 'test prompt',
        toolName: 'test-tool',
        validationErrors: [],
      };

      mockFormGeneratorInstance.generateFormFromSchema.mockResolvedValue(mockFormMessage);
      mockFormGeneratorInstance.generateJsonSchemaForm.mockReturnValue({
        jsonSchema: { type: 'object', properties: {} },
        uiSchema: {},
      });

      const result = await executor['_takeNextStep'](
        mockNameToolMap,
        mockInputs,
        mockIntermediateSteps,
        mockRunManager
      );

      expect(mockLoggerInstance.info).toHaveBeenCalledWith(
        '🚨 FORM GENERATION TRIGGERED for test-tool'
      );
      expect(mockFormGeneratorInstance.generateFormFromSchema).toHaveBeenCalled();
      expect(result).toEqual([
        {
          action: agentAction,
          observation: expect.objectContaining({
            requiresForm: true,
            formMessage: mockFormMessage,
          }),
        },
      ]);
    });

    it('should handle errors in shouldGenerateForm gracefully', async () => {
      const agentAction: AgentAction = {
        tool: 'test-tool',
        toolInput: {},
        log: 'test log',
      };

      const mockFormValidatableTool = {
        ...mockTools[0],
        shouldGenerateForm: jest.fn().mockImplementation(() => {
          throw new Error('shouldGenerateForm failed');
        }),
      };

      mockNameToolMap['test-tool'] = mockFormValidatableTool;
      mockAgent.plan.mockResolvedValue(agentAction);
      mockIsFormValidatable.mockReturnValue(true);

      await executor['_takeNextStep'](
        mockNameToolMap,
        mockInputs,
        mockIntermediateSteps,
        mockRunManager
      );

      expect(mockLoggerInstance.error).toHaveBeenCalledWith(
        'Error calling shouldGenerateForm() on test-tool:',
        expect.any(Error)
      );
    });

    it('should fallback to default schema when focused schema fails', async () => {
      const agentAction: AgentAction = {
        tool: 'test-tool',
        toolInput: {},
        log: 'test log',
      };

      const mockFormValidatableTool = {
        ...mockTools[0],
        shouldGenerateForm: jest.fn().mockReturnValue(true),
        getFormSchema: jest.fn().mockImplementation(() => {
          throw new Error('getFormSchema failed');
        }),
      };

      mockNameToolMap['test-tool'] = mockFormValidatableTool;
      mockAgent.plan.mockResolvedValue(agentAction);
      mockIsFormValidatable.mockReturnValue(true);

      mockFormGeneratorInstance.generateFormFromSchema.mockResolvedValue({
        type: 'form',
        id: 'form-123',
        formConfig: {
          title: 'Test Form',
          description: 'Test description',
          fields: [],
          submitLabel: 'Submit',
          cancelLabel: 'Cancel',
        },
        originalPrompt: 'test prompt',
        toolName: 'test-tool',
        validationErrors: [],
      });

      await executor['_takeNextStep'](
        mockNameToolMap,
        mockInputs,
        mockIntermediateSteps,
        mockRunManager
      );

      expect(mockLoggerInstance.error).toHaveBeenCalledWith(
        'Failed to get focused schema from test-tool:',
        expect.any(Error)
      );
      expect(mockFormGeneratorInstance.generateFormFromSchema).toHaveBeenCalled();
    });

    it('should apply parameter preprocessing when callback is set', async () => {
      const agentAction: AgentAction = {
        tool: 'test-tool',
        toolInput: { name: 'original' },
        log: 'test log',
      };

      const preprocessingCallback: ParameterPreprocessingCallback = jest.fn()
        .mockResolvedValue({ name: 'preprocessed' });

      executor.setParameterPreprocessingCallback(preprocessingCallback);

      mockAgent.plan.mockResolvedValue(agentAction);
      mockTools[0].call = jest.fn().mockResolvedValue('tool result');

      await executor['_takeNextStep'](
        mockNameToolMap,
        mockInputs,
        mockIntermediateSteps,
        mockRunManager
      );

      expect(preprocessingCallback).toHaveBeenCalledWith('test-tool', { name: 'original' });
      expect(mockTools[0].call).toHaveBeenCalledWith({ name: 'preprocessed' });
    });

    it('should handle preprocessing errors gracefully', async () => {
      const agentAction: AgentAction = {
        tool: 'test-tool',
        toolInput: { name: 'original' },
        log: 'test log',
      };

      const preprocessingCallback: ParameterPreprocessingCallback = jest.fn()
        .mockRejectedValue(new Error('Preprocessing failed'));

      executor.setParameterPreprocessingCallback(preprocessingCallback);

      mockAgent.plan.mockResolvedValue(agentAction);
      mockTools[0].call = jest.fn().mockResolvedValue('tool result');

      await executor['_takeNextStep'](
        mockNameToolMap,
        mockInputs,
        mockIntermediateSteps,
        mockRunManager
      );

      expect(mockLoggerInstance.warn).toHaveBeenCalledWith(
        'Parameter preprocessing failed, using original parameters:',
        expect.any(Object)
      );
      expect(mockTools[0].call).toHaveBeenCalledWith({ name: 'original' });
    });
  });

  describe('processFormSubmission', () => {
    it('should process form submission and execute tool', async () => {
      const submission: FormSubmission = {
        formId: 'form-123',
        toolName: 'test-tool',
        parameters: { name: 'test-name' },
        timestamp: Date.now(),
      };

      const pendingFormData = {
        toolName: 'test-tool',
        originalInput: { input: 'test' },
        originalToolInput: {},
        schema: z.object({ name: z.string() }),
        toolRef: mockTools[0],
      };

      executor['pendingForms'].set('form-123', pendingFormData);

      mockTools[0].call = jest.fn().mockResolvedValue('tool execution result');

      const result = await executor.processFormSubmission(submission);

      expect(result).toEqual({
        output: 'tool execution result',
        message: 'tool execution result',
        success: true,
        intermediateSteps: [],
      });
      expect(mockTools[0].call).toHaveBeenCalledWith({ name: 'test-name' });
    });

    it('should throw error for unknown form ID', async () => {
      const submission: FormSubmission = {
        formId: 'unknown-form',
        toolName: 'test-tool',
        parameters: {},
        timestamp: Date.now(),
      };

      await expect(executor.processFormSubmission(submission)).rejects.toThrow(
        'Form unknown-form not found in pending forms'
      );
    });

    it('should validate form submission parameters', async () => {
      const submission: FormSubmission = {
        formId: 'form-123',
        toolName: 'test-tool',
        parameters: { name: '' },
        timestamp: Date.now(),
      };

      const zodSchema = z.object({ name: z.string().min(1) });
      const pendingFormData = {
        toolName: 'test-tool',
        originalInput: { input: 'test' },
        originalToolInput: {},
        schema: zodSchema,
        toolRef: mockTools[0],
      };

      executor['pendingForms'].set('form-123', pendingFormData);

      await expect(executor.processFormSubmission(submission)).rejects.toThrow();
    });

    it('should handle tool execution errors', async () => {
      const submission: FormSubmission = {
        formId: 'form-123',
        toolName: 'test-tool',
        parameters: { name: 'test-name' },
        timestamp: Date.now(),
      };

      const pendingFormData = {
        toolName: 'test-tool',
        originalInput: { input: 'test' },
        originalToolInput: {},
        schema: z.object({ name: z.string() }),
        toolRef: mockTools[0],
      };

      executor['pendingForms'].set('form-123', pendingFormData);

      mockTools[0].call = jest.fn().mockRejectedValue(new Error('Tool execution failed'));

      await expect(executor.processFormSubmission(submission)).rejects.toThrow(
        'Tool execution failed'
      );
    });

    it('should handle HashLink responses', async () => {
      const submission: FormSubmission = {
        formId: 'form-123',
        toolName: 'test-tool',
        parameters: { name: 'test-name' },
        timestamp: Date.now(),
      };

      const pendingFormData = {
        toolName: 'test-tool',
        originalInput: { input: 'test' },
        originalToolInput: {},
        schema: z.object({ name: z.string() }),
        toolRef: mockTools[0],
      };

      executor['pendingForms'].set('form-123', pendingFormData);

      const hashLinkResponse = JSON.stringify({
        hashLinkBlock: {
          blockId: 'block-123',
          hashLink: 'test-link',
          template: 'test-template',
          attributes: {},
        },
        message: 'HashLink created',
      });

      mockTools[0].call = jest.fn().mockResolvedValue(hashLinkResponse);

      const result = await executor.processFormSubmission(submission);

      expect(result.metadata).toEqual({
        hashLinkBlock: {
          blockId: 'block-123',
          hashLink: 'test-link',
          template: 'test-template',
          attributes: {},
        },
      });
    });
  });

  describe('pending forms management', () => {
    it('should check if has pending forms', () => {
      expect(executor.hasPendingForms()).toBe(false);

      executor['pendingForms'].set('form-123', {
        toolName: 'test-tool',
        originalInput: {},
        originalToolInput: {},
        schema: z.object({}),
      });

      expect(executor.hasPendingForms()).toBe(true);
    });

    it('should get pending forms info', () => {
      executor['pendingForms'].set('form-123', {
        toolName: 'test-tool',
        originalInput: {},
        originalToolInput: {},
        schema: z.object({}),
      });

      const info = executor.getPendingFormsInfo();

      expect(info).toEqual([
        { formId: 'form-123', toolName: 'test-tool' },
      ]);
    });

    it('should get pending forms map', () => {
      const pendingData = {
        toolName: 'test-tool',
        originalInput: {},
        originalToolInput: {},
        schema: z.object({}),
      };

      executor['pendingForms'].set('form-123', pendingData);

      const forms = executor.getPendingForms();

      expect(forms.get('form-123')).toEqual(pendingData);
    });

    it('should restore pending forms', () => {
      const formsToRestore = new Map([
        [
          'form-123',
          {
            toolName: 'test-tool',
            originalInput: {},
            originalToolInput: {},
            schema: z.object({}),
          },
        ],
      ]);

      executor.restorePendingForms(formsToRestore);

      expect(executor['pendingForms']).toEqual(formsToRestore);
    });
  });

  describe('field requirement analysis', () => {
    it('should determine if field is required from ZodObject', () => {
      const schema = z.object({
        requiredField: z.string(),
        optionalField: z.string().optional(),
        defaultField: z.string().default('default'),
      });

      expect(executor['isFieldRequired'](schema, 'requiredField')).toBe(true);
      expect(executor['isFieldRequired'](schema, 'optionalField')).toBe(false);
      expect(executor['isFieldRequired'](schema, 'defaultField')).toBe(false);
    });

    it('should return false for non-ZodObject schemas', () => {
      const schema = z.string();

      expect(executor['isFieldRequired'](schema, 'anyField')).toBe(false);
    });

    it('should handle errors gracefully', () => {
      const invalidSchema = {} as z.ZodSchema;

      expect(executor['isFieldRequired'](invalidSchema, 'field')).toBe(false);
    });
  });

  describe('tool wrapper handling', () => {
    it('should use original tool when wrapper is detected', async () => {
      const agentAction: AgentAction = {
        tool: 'test-tool',
        toolInput: { name: 'test' },
        log: 'test log',
      };

      const wrappedTool = {
        ...mockTools[0],
        originalTool: {
          call: jest.fn().mockResolvedValue('original tool result'),
        },
      };

      mockAgent.plan.mockResolvedValue(agentAction);

      const result = await executor['_takeNextStep'](
        { 'test-tool': wrappedTool },
        mockInputs,
        [],
      );

      expect(wrappedTool.originalTool.call).toHaveBeenCalledWith({ name: 'test' });
    });

    it('should handle different tool wrapper patterns', async () => {
      const agentAction: AgentAction = {
        tool: 'test-tool',
        toolInput: { name: 'test' },
        log: 'test log',
      };

      const wrapperTool = {
        ...mockTools[0],
        executeOriginal: jest.fn().mockResolvedValue('wrapper tool result'),
      };

      mockAgent.plan.mockResolvedValue(agentAction);

      await executor['_takeNextStep'](
        { 'test-tool': wrapperTool },
        mockInputs,
        [],
      );

      expect(wrapperTool.executeOriginal).toHaveBeenCalledWith({ name: 'test' });
    });
  });

  describe('error handling', () => {
    it('should handle JSON parsing errors in tool responses', async () => {
      const submission: FormSubmission = {
        formId: 'form-123',
        toolName: 'test-tool',
        parameters: { name: 'test-name' },
        timestamp: Date.now(),
      };

      const pendingFormData = {
        toolName: 'test-tool',
        originalInput: { input: 'test' },
        originalToolInput: {},
        schema: z.object({ name: z.string() }),
        toolRef: mockTools[0],
      };

      executor['pendingForms'].set('form-123', pendingFormData);

      mockTools[0].call = jest.fn().mockResolvedValue('invalid json response');

      const result = await executor.processFormSubmission(submission);

      expect(result.output).toBe('invalid json response');
      expect(mockLoggerInstance.debug).toHaveBeenCalledWith(
        'Tool response is not valid JSON, treating as plain text:',
        expect.any(Error)
      );
    });

    it('should handle missing schema in pending form data', async () => {
      const submission: FormSubmission = {
        formId: 'form-123',
        toolName: 'test-tool',
        parameters: { name: 'test-name' },
        timestamp: Date.now(),
      };

      const pendingFormData = {
        toolName: 'test-tool',
        originalInput: { input: 'test' },
        originalToolInput: {},
        schema: undefined,
        toolRef: mockTools[0],
      };

      executor['pendingForms'].set('form-123', pendingFormData);

      mockTools[0].call = jest.fn().mockResolvedValue('tool result');

      const result = await executor.processFormSubmission(submission);

      expect(result.output).toBe('tool result');
      expect(mockLoggerInstance.warn).toHaveBeenCalledWith(
        'No schema found for form form-123, skipping validation'
      );
    });
  });
});