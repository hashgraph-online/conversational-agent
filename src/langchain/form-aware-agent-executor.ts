import { AgentExecutor } from 'langchain/agents';
import { ZodError, z } from 'zod';
import { FormGenerator } from '../forms/form-generator';
import type { FormMessage, FormSubmission } from '../forms/types';
import { FormEngine } from '../forms/form-engine';
import { Logger } from '@hashgraphonline/standards-sdk';
import type { AgentAction, AgentFinish, AgentStep } from 'langchain/agents';
import type { ToolInterface } from '@langchain/core/tools';
import { isFormValidatable } from '@hashgraphonline/standards-agent-kit';
import type { ChainValues } from '@langchain/core/utils/types';
import type { CallbackManagerForChainRun } from '@langchain/core/callbacks/manager';
import type { RunnableConfig } from '@langchain/core/runnables';
import { ResponseFormatter } from '../utils/response-formatter';

type BasicFieldType = 'text' | 'number' | 'select' | 'checkbox' | 'textarea';

const globalPendingForms: Map<string, PendingFormData> = new Map();

interface HashLinkBlock {
  blockId: string;
  hashLink: string;
  template: string;
  attributes: Record<string, unknown>;
}

interface HashLinkResponse {
  hasHashLinkBlocks: boolean;
  hashLinkBlock?: HashLinkBlock;
  message: string;
}

interface ToolWithOriginal {
  originalTool?: {
    call?: (args: Record<string, unknown>) => Promise<string>;
  };
}

interface ActionWithToolInput {
  toolInput?: Record<string, unknown>;
}

interface ZodSchemaDefinition {
  _def?: {
    typeName?: string;
    shape?: (() => Record<string, z.ZodTypeAny>) | Record<string, z.ZodTypeAny>;
    innerType?: z.ZodTypeAny;
    defaultValue?: unknown;
  };
}

interface ToolWrapper {
  executeOriginal?: (args: Record<string, unknown>) => Promise<string>;
  getOriginalTool?: () => {
    _call?: (args: Record<string, unknown>) => Promise<string>;
    call?: (args: Record<string, unknown>) => Promise<string>;
  };
  originalTool?: {
    _call?: (args: Record<string, unknown>) => Promise<string>;
    call?: (args: Record<string, unknown>) => Promise<string>;
  };
  call?: (args: Record<string, unknown>) => Promise<string>;
}

interface CallableTool {
  _call?: (args: Record<string, unknown>) => Promise<string>;
  call?: (args: Record<string, unknown>) => Promise<string>;
}

interface ToolWithSchema {
  schema?: Record<string, unknown>;
}

interface PendingFormData {
  toolName: string;
  originalInput: unknown;
  originalToolInput?: unknown;
  schema: unknown;
  toolRef?: ToolInterface | undefined;
  originalToolRef?: ToolWithOriginal['originalTool'];
}

interface ToolResponse {
  requiresForm?: boolean;
  formMessage?: {
    id: string;
    [key: string]: unknown;
  };
  message?: string;
  hashLinkBlock?: HashLinkBlock;
  success?: boolean;
  inscription?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
}

interface IntermediateStepData {
  action?: {
    tool?: string;
    [key: string]: unknown;
  };
  observation?: unknown;
}

interface HashLinkBlock {
  blockId: string;
  hashLink: string;
  template: string;
  attributes: Record<string, unknown>;
}

interface ResponseMetadataWithHashLink {
  hashLinkBlock?: HashLinkBlock;
  [key: string]: unknown;
}

/**
 * Parameter preprocessing callback interface
 */
export interface ParameterPreprocessingCallback {
  (toolName: string, parameters: Record<string, unknown>): Promise<
    Record<string, unknown>
  >;
}

/**
 * Agent executor that intercepts Zod validation errors and generates forms,
 * and processes HashLink block responses for rich UI rendering
 */
export class FormAwareAgentExecutor extends AgentExecutor {
  private formGenerator: FormGenerator;
  private formEngine: FormEngine;
  private formLogger: Logger;
  private pendingForms: Map<string, PendingFormData> = new Map();
  private parameterPreprocessingCallback:
    | ParameterPreprocessingCallback
    | undefined;

  /**
   * Type guard to check if a Zod type is a ZodObject
   */
  private isZodObject(schema: unknown): schema is z.ZodObject<z.ZodRawShape> {
    return schema instanceof z.ZodObject;
  }

  /**
   * Type guard to check if metadata has hashLinkBlock
   */
  private hasHashLinkBlock(
    metadata: unknown
  ): metadata is ResponseMetadataWithHashLink & {
    hashLinkBlock: HashLinkBlock;
  } {
    return (
      typeof metadata === 'object' &&
      metadata !== null &&
      'hashLinkBlock' in metadata &&
      typeof (metadata as Record<string, unknown>).hashLinkBlock === 'object' &&
      (metadata as Record<string, unknown>).hashLinkBlock !== null
    );
  }

  constructor(...args: ConstructorParameters<typeof AgentExecutor>) {
    super(...args);
    this.formGenerator = new FormGenerator();
    this.formEngine = new FormEngine(
      new Logger({ module: 'FormAwareAgentExecutor.FormEngine' })
    );
    this.formLogger = new Logger({ module: 'FormAwareAgentExecutor' });
    this.parameterPreprocessingCallback = undefined;
  }

  /**
   * Set parameter preprocessing callback
   */
  setParameterPreprocessingCallback(
    callback: ParameterPreprocessingCallback | undefined
  ): void {
    this.parameterPreprocessingCallback = callback;
  }

  /**
   * BULLETPROOF TOOL INTERCEPTION
   * Override the single-step execution to intercept tool calls BEFORE LangChain processes them
   */
  override async _takeNextStep(
    nameToolMap: Record<string, ToolInterface>,
    inputs: ChainValues,
    intermediateSteps: AgentStep[],
    runManager?: CallbackManagerForChainRun,
    config?: RunnableConfig
  ): Promise<AgentFinish | AgentStep[]> {
    this.formLogger.info('🛡️ BULLETPROOF INTERCEPTION: _takeNextStep called', {
      availableTools: Object.keys(nameToolMap),
      inputKeys: Object.keys(inputs),
    });

    const result = await this.agent.plan(
      intermediateSteps,
      inputs,
      runManager?.getChild()
    );

    if ('returnValues' in result) {
      this.formLogger.info('Agent returned finish action, passing through');
      return result;
    }

    const action = result as AgentAction;
    const toolName = action.tool;
    const toolInput = action.toolInput;

    this.formLogger.info(`🎯 INTERCEPTING TOOL CALL: ${toolName}`, {
      toolInput,
      hasInNameToolMap: toolName in nameToolMap,
      toolInputKeys: Object.keys(toolInput || {}),
    });

    const tool =
      nameToolMap[toolName] || this.tools.find((t) => t.name === toolName);

    if (!tool) {
      this.formLogger.error(`Tool ${toolName} not found in registry`);
      throw new Error(`Tool "${toolName}" not found`);
    }

    let shouldGenerateForm = false;

    if (isFormValidatable(tool)) {
      this.formLogger.info(
        `🔍 Tool ${toolName} implements FormValidatable, checking shouldGenerateForm()`,
        {
          toolInput,
        }
      );

      try {
        shouldGenerateForm = tool.shouldGenerateForm(toolInput);
        this.formLogger.info(
          `FormValidatable.shouldGenerateForm() result: ${shouldGenerateForm}`,
          {
            toolName,
            toolInput,
          }
        );
      } catch (error) {
        this.formLogger.error(
          `Error calling shouldGenerateForm() on ${toolName}:`,
          error
        );
        shouldGenerateForm = false;
      }
    }

    if (shouldGenerateForm) {
      this.formLogger.info(`🚨 FORM GENERATION TRIGGERED for ${toolName}`);

      try {
        let schemaToUse: z.ZodSchema;
        let isFocusedSchema = false;

        if (isFormValidatable(tool)) {
          this.formLogger.info(
            `🎯 Tool ${toolName} is FormValidatable, attempting to get focused schema`
          );
          try {
            const focusedSchema = tool.getFormSchema();
            if (focusedSchema) {
              schemaToUse = focusedSchema;
              isFocusedSchema = true;
              this.formLogger.info(
                `✅ Successfully obtained focused schema for ${toolName}`
              );
            } else {
              this.formLogger.warn(
                `getFormSchema() returned null/undefined for ${toolName}, using default schema`
              );
              schemaToUse = tool.schema;
              isFocusedSchema = false;
            }
          } catch (error) {
            this.formLogger.error(
              `Failed to get focused schema from ${toolName}:`,
              error
            );
            this.formLogger.info(
              `Falling back to default schema for ${toolName}`
            );
            schemaToUse = tool.schema;
            isFocusedSchema = false;
          }
        } else {
          this.formLogger.info(
            `Tool ${toolName} is not FormValidatable, using default schema`
          );
          schemaToUse = tool.schema;
          isFocusedSchema = false;
        }

        let schemaFieldCount = 'unknown';
        try {
          if (this.isZodObject(schemaToUse)) {
            const zodObject = schemaToUse as z.ZodObject<z.ZodRawShape>;
            const shape = zodObject.shape;
            if (shape && typeof shape === 'object') {
              schemaFieldCount = Object.keys(shape).length.toString();
            }
          }
        } catch {}

        this.formLogger.info(
          `📋 Generating form with ${
            isFocusedSchema ? 'FOCUSED' : 'DEFAULT'
          } schema`,
          {
            toolName,
            schemaType: schemaToUse?.constructor?.name,
            estimatedFieldCount: schemaFieldCount,
            isFocusedSchema,
          }
        );

        let missingFields: Set<string> | undefined;

        if (isFocusedSchema) {
          this.formLogger.info(
            `⭐ Using focused schema - letting FormGenerator determine fields from schema`
          );
          missingFields = undefined;
        } else {
          missingFields = new Set<string>();
          if (this.isZodObject(schemaToUse)) {
            const zodObject = schemaToUse as z.ZodObject<z.ZodRawShape>;
            const shape = zodObject.shape || {};
            for (const fieldName of Object.keys(shape)) {
              const value = (toolInput || {})[fieldName];

              const isEmpty =
                isFormValidatable(tool) && tool.isFieldEmpty
                  ? tool.isFieldEmpty(fieldName, value)
                  : value === undefined ||
                    value === '' ||
                    value === null ||
                    (Array.isArray(value) && value.length === 0);

              const isRequired = this.isFieldRequired(schemaToUse, fieldName);

              const isEssential =
                isFormValidatable(tool) && tool.getEssentialFields
                  ? tool.getEssentialFields().includes(fieldName)
                  : false;

              this.formLogger.info(`🔍 Field analysis: ${fieldName}`, {
                value: value,
                isEmpty: isEmpty,
                isRequired: isRequired,
                isEssential: isEssential,
                willAddToMissingFields: isEmpty && (isRequired || isEssential),
              });

              if (isEmpty && (isRequired || isEssential)) {
                missingFields.add(fieldName);
              }
            }
          }

          this.formLogger.info(`📋 Missing fields analysis complete`, {
            totalFields: this.isZodObject(schemaToUse)
              ? Object.keys(schemaToUse.shape).length
              : 0,
            missingFieldsCount: missingFields.size,
            missingFields: Array.from(missingFields),
          });
        }

        const formMessage = await this.formGenerator.generateFormFromSchema(
          schemaToUse,
          toolInput,
          {
            toolName: toolName,
            toolDescription: tool.description,
          },
          missingFields // Pass undefined for focused schemas, Set<string> for others
        );

        if (this.isZodObject(schemaToUse)) {
          try {
            const { jsonSchema, uiSchema } =
              this.formGenerator.generateJsonSchemaForm(
                schemaToUse,
                toolInput as Record<string, unknown> | undefined,
                missingFields
              );
            formMessage.jsonSchema = jsonSchema;
            formMessage.uiSchema = uiSchema;
          } catch (error) {
            this.formLogger.warn(
              'Failed to generate JSON Schema for RJSF:',
              error
            );
          }
        }

        formMessage.partialInput = toolInput;

        const formData: PendingFormData = {
          toolName: toolName,
          originalInput: inputs,
          originalToolInput: toolInput,
          schema: schemaToUse,
          toolRef: tool as ToolInterface | undefined,
          originalToolRef: (tool as ToolWithOriginal).originalTool,
        };
        this.pendingForms.set(formMessage.id, formData);
        globalPendingForms.set(formMessage.id, formData);

        this.formLogger.info(`✅ FORM INTERCEPT SUCCESS for ${toolName}`);

        const formResult = {
          requiresForm: true,
          formMessage,
        };

        return [
          {
            action: action,
            observation: JSON.stringify(formResult),
          },
        ];
      } catch (error) {
        this.formLogger.error(`Form generation failed for ${toolName}:`, error);
      }
    }

    this.formLogger.info(
      `⚪ Passing through to normal tool execution for ${toolName}`
    );

    if (this.parameterPreprocessingCallback && toolInput) {
      this.formLogger.info(
        `🔄 Applying parameter preprocessing for ${toolName}`
      );
      try {
        const preprocessedInput = await this.parameterPreprocessingCallback(
          toolName,
          toolInput as Record<string, unknown>
        );

        if (
          preprocessedInput &&
          typeof preprocessedInput === 'object' &&
          '__requestForm' in (preprocessedInput as Record<string, unknown>)
        ) {
          const rf = (preprocessedInput as Record<string, unknown>)
            .__requestForm as {
            id?: string;
            title?: string;
            description?: string;
            fields?: Array<{
              name: string;
              label: string;
              type: string;
              required?: boolean;
              options?: Array<{ value: string; label: string }>;
            }>;
            submitLabel?: string;
          };

          const formId =
            rf.id ||
            `form_${Date.now()}_${Math.random().toString(36).slice(2)}`;
          const formMessage = {
            type: 'form',
            id: formId,
            originalPrompt: 'Parameter validation required',
            toolName,
            formConfig: {
              title: rf.title || 'Complete required parameters',
              description:
                rf.description ||
                'One or more parameters require confirmation. Please review and submit.',
              submitLabel: rf.submitLabel || 'Continue',
              fields: (rf.fields || []).map((f) => {
                const allowedTypes: BasicFieldType[] = [
                  'text',
                  'number',
                  'select',
                  'checkbox',
                  'textarea',
                ];
                const resolvedType: BasicFieldType = allowedTypes.includes(
                  f.type as BasicFieldType
                )
                  ? (f.type as BasicFieldType)
                  : 'text';

                return {
                  name: f.name,
                  label: f.label,
                  type: resolvedType,
                  required: f.required ?? true,
                  options: f.options,
                };
              }),
            },
          };

          const resolvedSchema = isFormValidatable(tool)
            ? (() => {
                try {
                  const s = tool.getFormSchema();
                  return s || tool.schema;
                } catch {
                  return tool.schema;
                }
              })()
            : tool.schema;

          this.pendingForms.set(formId, {
            toolName,
            originalInput: inputs,
            originalToolInput: toolInput,
            schema: resolvedSchema,
            toolRef: tool as ToolInterface | undefined,
            originalToolRef: (tool as ToolWithOriginal).originalTool,
          });
          globalPendingForms.set(formId, {
            toolName,
            originalInput: inputs,
            originalToolInput: toolInput,
            schema: resolvedSchema,
          });

          return [
            {
              action,
              observation: JSON.stringify({ requiresForm: true, formMessage }),
            },
          ];
        }

        if (JSON.stringify(preprocessedInput) !== JSON.stringify(toolInput)) {
          this.formLogger.info(`📝 Parameters preprocessed for ${toolName}:`, {
            original: Object.keys(toolInput as Record<string, unknown>),
            preprocessed: Object.keys(preprocessedInput),
            hasChanges: true,
          });

          try {
            (action as ActionWithToolInput).toolInput = preprocessedInput;
          } catch {}
        } else {
          this.formLogger.debug(`No parameter changes needed for ${toolName}`);
        }
      } catch (preprocessError) {
        this.formLogger.warn(
          `Parameter preprocessing failed for ${toolName}, using original parameters:`,
          preprocessError
        );
      }
    }

    return super._takeNextStep(
      nameToolMap,
      inputs,
      intermediateSteps,
      runManager,
      config
    );
  }

  /**
   * Helper to determine if a field is required in the schema
   */
  private isFieldRequired(schema: unknown, fieldPath: string): boolean {
    if (!schema || !fieldPath) {
      return false;
    }

    try {
      const obj = schema as ZodSchemaDefinition;
      const def = obj._def;
      if (!def || def.typeName !== 'ZodObject') {
        return false;
      }
      const rawShape: unknown =
        typeof def.shape === 'function' ? def.shape() : def.shape;
      if (!rawShape || typeof rawShape !== 'object') {
        return false;
      }
      const shape = rawShape as Record<string, z.ZodTypeAny>;
      const fieldSchema = shape[fieldPath];
      if (!fieldSchema) {
        return false;
      }
      const unwrapOptional = (s: z.ZodTypeAny): z.ZodTypeAny => {
        const inner = (s as ZodSchemaDefinition)._def;
        if (inner && inner.typeName === 'ZodOptional' && inner.innerType) {
          return inner.innerType;
        }
        return s;
      };
      const unwrapped = unwrapOptional(fieldSchema);
      const fdef = (unwrapped as ZodSchemaDefinition)._def;
      if (!fdef) {
        return true;
      }
      if (fdef.typeName === 'ZodOptional' || fdef.typeName === 'ZodDefault') {
        return false;
      }
      if (fdef.defaultValue !== undefined) {
        return false;
      }
      return true;
    } catch (error) {
      this.formLogger.debug(
        `Could not determine if field ${fieldPath} is required:`,
        error
      );
    }
    return false;
  }

  /**
   * Override _call to intercept Zod validation errors at the execution level
   */
  override async _call(
    inputs: Record<string, unknown>
  ): Promise<Record<string, unknown>> {
    try {
      const result = await super._call(inputs);

      if (result.intermediateSteps && Array.isArray(result.intermediateSteps)) {
        for (const step of result.intermediateSteps) {
          if (step.observation) {
            try {
              const parsed: ToolResponse =
                typeof step.observation === 'string'
                  ? JSON.parse(step.observation)
                  : (step.observation as ToolResponse);

              if (parsed.requiresForm && parsed.formMessage) {
                this.formLogger.info('Tool requested form generation', {
                  toolName: step.action?.tool,
                  hasForm: true,
                });

                const actionToolName =
                  (step as IntermediateStepData).action?.tool || 'unknown';
                const toolInstance = this.tools.find(
                  (t) => t.name === actionToolName
                ) as ToolInterface | undefined;
                const originalToolCandidate =
                  (toolInstance as ToolWithOriginal) || {};
                const pf: PendingFormData = {
                  toolName: actionToolName,
                  originalInput: inputs,
                  originalToolInput: (step as IntermediateStepData).action
                    ?.toolInput as Record<string, unknown> | undefined,
                  schema: null,
                  toolRef: toolInstance,
                  originalToolRef: originalToolCandidate?.originalTool,
                };
                this.pendingForms.set(parsed.formMessage.id, pf);
                globalPendingForms.set(parsed.formMessage.id, pf);

                return {
                  ...result,
                  requiresForm: true,
                  formMessage: parsed.formMessage,
                  output:
                    parsed.message || 'Please complete the form to continue.',
                };
              }

              if (
                parsed.hashLinkBlock ||
                (parsed.success && parsed.inscription && parsed.hashLinkBlock)
              ) {
                this.formLogger.info('Tool returned HashLink blocks', {
                  toolName: (step as IntermediateStepData).action?.tool,
                  hasHashLink: true,
                  blockId: parsed.hashLinkBlock?.blockId,
                });

                const hashLinkResponse = this.processHashLinkResponse(parsed);

                return {
                  ...result,
                  hasHashLinkBlocks: true,
                  hashLinkBlock: hashLinkResponse.hashLinkBlock,
                  output: hashLinkResponse.message,
                };
              }
            } catch {}
          }
        }
      }

      return result;
    } catch (error) {
      if (error instanceof ZodError) {
        this.formLogger.info('Intercepted ZodError during agent execution');
        return this.handleValidationError(error, inputs, []);
      }
      throw error;
    }
  }

  /**
   * Handles Zod validation errors by generating forms
   */
  private async handleValidationError(
    error: ZodError,
    inputs: Record<string, unknown>,
    intermediateSteps: AgentStep[]
  ): Promise<Record<string, unknown>> {
    this.formLogger.info('Zod validation error detected, generating form', {
      errorIssues: error.issues.length,
      inputKeys: Object.keys(inputs),
    });

    let toolInfo = this.extractToolInfoFromError(
      error,
      inputs,
      intermediateSteps
    );

    if (!toolInfo) {
      this.formLogger.warn(
        'Could not extract tool info from validation error, trying fallback detection'
      );
      const fallbackTool = this.detectToolFromErrorContext(error);
      if (!fallbackTool) {
        this.formLogger.error(
          'No tool detected for form generation, rethrowing error'
        );
        throw error;
      }
      toolInfo = fallbackTool;
    }

    this.formLogger.info('Generating form for tool:', {
      toolName: toolInfo.toolName,
      hasSchema: !!toolInfo.schema,
    });

    const formMessage = this.formGenerator.generateFormFromError(
      error,
      toolInfo.schema as z.ZodType<unknown, z.ZodTypeDef, unknown>,
      toolInfo.toolName,
      (inputs.input as string) || ''
    );

    this.pendingForms.set(formMessage.id, {
      toolName: toolInfo.toolName,
      originalInput: inputs,
      schema: toolInfo.schema,
    });

    globalPendingForms.set(formMessage.id, {
      toolName: toolInfo.toolName,
      originalInput: inputs,
      schema: toolInfo.schema,
    });

    return {
      output: this.formatFormResponse(formMessage),
      formMessage,
      requiresForm: true,
      intermediateSteps: intermediateSteps || [],
    };
  }

  /**
   * Get a copy of pending forms for preservation during executor recreation
   */
  getPendingForms(): Map<string, PendingFormData> {
    return new Map(this.pendingForms);
  }

  /**
   * Restore pending forms from a previous executor instance
   */
  restorePendingForms(forms: Map<string, PendingFormData>): void {
    for (const [formId, formData] of forms) {
      this.pendingForms.set(formId, formData);
    }
  }

  /**
   * Processes form submission and continues tool execution
   */
  async processFormSubmission(
    submission: FormSubmission
  ): Promise<Record<string, unknown>> {
    this.formLogger.info(
      '🚀 FormAwareAgentExecutor.processFormSubmission called!',
      {
        submissionFormId: submission.formId,
        submissionToolName: submission.toolName,
      }
    );
    if (!submission) {
      throw new Error('Form submission is null or undefined');
    }

    if (!submission.formId) {
      throw new Error('Form submission missing formId');
    }

    if (
      !submission.parameters ||
      submission.parameters === null ||
      typeof submission.parameters !== 'object' ||
      Array.isArray(submission.parameters)
    ) {
      throw new Error(
        `Form submission parameters are invalid: ${typeof submission.parameters}, isNull: ${
          submission.parameters === null
        }, isArray: ${Array.isArray(
          submission.parameters
        )}, parameters: ${JSON.stringify(submission.parameters)}`
      );
    }

    this.formLogger.info('Processing form submission:', {
      formId: submission.formId,
      toolName: submission.toolName,
      parameterKeys: Object.keys(submission.parameters),
      parametersType: typeof submission.parameters,
      parametersIsNull: submission.parameters === null,
      parametersIsUndefined: submission.parameters === undefined,
      hasContext: !!submission.context,
    });

    let pendingForm = this.pendingForms.get(submission.formId);

    if (!pendingForm) {
      pendingForm = globalPendingForms.get(submission.formId);
      if (!pendingForm) {
        throw new Error(`No pending form found for ID: ${submission.formId}`);
      }
    }

    this.pendingForms.delete(submission.formId);
    globalPendingForms.delete(submission.formId);

    const tool =
      pendingForm.toolRef ||
      this.tools.find((t) => t.name === pendingForm.toolName);
    if (!tool) {
      throw new Error(
        `Tool not found for form submission: ${pendingForm.toolName}`
      );
    }

    let baseToolInput: Record<string, unknown> = {};
    try {
      if (
        pendingForm.originalToolInput &&
        typeof pendingForm.originalToolInput === 'object'
      ) {
        baseToolInput = {
          ...(pendingForm.originalToolInput as Record<string, unknown>),
        };
      }
    } catch (error) {
      this.formLogger.warn(
        'Failed to extract base tool input, using empty object:',
        error
      );
      baseToolInput = {};
    }

    let submissionData: Record<string, unknown> = {};
    try {
      if (submission.parameters && typeof submission.parameters === 'object') {
        submissionData = {
          ...(submission.parameters as Record<string, unknown>),
        };
      }
    } catch (error) {
      this.formLogger.warn(
        'Failed to extract submission parameters, using empty object:',
        error
      );
      submissionData = {};
    }

    const mergedToolInput: Record<string, unknown> = {};
    try {
      Object.keys(baseToolInput).forEach((key) => {
        const value = baseToolInput[key];
        if (value !== undefined && value !== null) {
          mergedToolInput[key] = value;
        }
      });

      Object.keys(submissionData).forEach((key) => {
        const value = submissionData[key];
        if (value !== undefined && value !== null) {
          mergedToolInput[key] = value;
        }
      });

      mergedToolInput.renderForm = false;
      mergedToolInput.__fromForm = true;

      this.formLogger.info('Successfully merged tool input:', {
        baseKeys: Object.keys(baseToolInput),
        submissionKeys: Object.keys(submissionData),
        mergedKeys: Object.keys(mergedToolInput),
      });
    } catch (error) {
      this.formLogger.error('Failed to merge tool input data:', error);
      throw new Error(
        `Failed to merge tool input data: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`
      );
    }

    try {
      const maybeWrapper = tool as ToolWrapper;
      let toolOutput: string;
      if (typeof maybeWrapper.executeOriginal === 'function') {
        toolOutput = await maybeWrapper.executeOriginal(mergedToolInput);
      } else if (typeof maybeWrapper.getOriginalTool === 'function') {
        const ot = maybeWrapper.getOriginalTool();
        const otCall = ot as CallableTool;
        if (ot && typeof otCall._call === 'function') {
          toolOutput = await otCall._call(mergedToolInput);
        } else if (ot && typeof otCall.call === 'function') {
          toolOutput = await otCall.call(mergedToolInput);
        } else {
          const tcall = tool as CallableTool;
          if (typeof tcall.call === 'function') {
            toolOutput = await tcall.call(mergedToolInput);
          } else {
            throw new Error(
              'No callable tool implementation found for form submission'
            );
          }
        }
      } else if (
        maybeWrapper.originalTool &&
        typeof maybeWrapper.originalTool._call === 'function'
      ) {
        toolOutput = await maybeWrapper.originalTool._call(mergedToolInput);
      } else if (
        maybeWrapper.originalTool &&
        typeof maybeWrapper.originalTool.call === 'function'
      ) {
        toolOutput = await maybeWrapper.originalTool.call(mergedToolInput);
      } else if (typeof (tool as CallableTool).call === 'function') {
        toolOutput = await (tool as CallableTool).call!(mergedToolInput);
      } else {
        throw new Error(
          'No callable tool implementation found for form submission'
        );
      }

      let responseMetadata: Record<string, unknown> = {};
      let formattedOutput: string;

      try {
        const parsed = JSON.parse(toolOutput);
        this.formLogger.info(
          '✅ METADATA EXTRACTION: Successfully parsed JSON',
          {
            jsonKeys: Object.keys(parsed),
            hasHashLinkBlock: !!(parsed as Record<string, unknown>)
              .hashLinkBlock,
          }
        );

        if (parsed && typeof parsed === 'object') {
          if (ResponseFormatter.isHashLinkResponse(parsed)) {
            this.formLogger.info(
              '🔗 HASHLINK DETECTED: Processing HashLink response separately to preserve metadata'
            );

            responseMetadata = {
              ...responseMetadata,
              hashLinkBlock: (parsed as Record<string, unknown>).hashLinkBlock,
            };

            formattedOutput = ResponseFormatter.formatHashLinkResponse(parsed);

            this.formLogger.info(
              '🔗 METADATA PRESERVED: HashLink metadata extracted for component rendering',
              {
                blockId: this.hasHashLinkBlock(responseMetadata)
                  ? responseMetadata.hashLinkBlock.blockId
                  : undefined,
                hasTemplate: this.hasHashLinkBlock(responseMetadata)
                  ? !!responseMetadata.hashLinkBlock.template
                  : false,
              }
            );
          } else {
            formattedOutput = ResponseFormatter.formatResponse(toolOutput);

            responseMetadata = {
              ...responseMetadata,
              hashLinkBlock: (parsed as Record<string, unknown>).hashLinkBlock,
            };
          }
        } else {
          formattedOutput = ResponseFormatter.formatResponse(toolOutput);
        }
      } catch (error) {
        this.formLogger.warn(
          '❌ METADATA EXTRACTION: Tool output is not JSON',
          {
            error: error instanceof Error ? error.message : 'unknown error',
            outputSample:
              typeof toolOutput === 'string'
                ? toolOutput.substring(0, 200)
                : 'not-string',
          }
        );

        formattedOutput = ResponseFormatter.formatResponse(toolOutput);
      }

      return {
        output: formattedOutput,
        formCompleted: true,
        originalFormId: submission.formId,
        intermediateSteps: [],
        metadata: responseMetadata,
        rawToolOutput: toolOutput,
        toolName: pendingForm.toolName,
      };
    } catch (error) {
      if (error instanceof ZodError) {
        return this.handleValidationError(error, mergedToolInput, []);
      }
      throw error;
    }
  }

  /**
   * Extracts tool information from the execution context
   */
  private extractToolInfoFromError(
    error: ZodError,
    inputs: Record<string, unknown>,
    intermediateSteps: AgentStep[]
  ): { toolName: string; schema: unknown } | null {
    try {
      if (intermediateSteps.length > 0) {
        const lastStep = intermediateSteps[intermediateSteps.length - 1];
        if (lastStep.action && lastStep.action.tool) {
          const tool = this.tools.find((t) => t.name === lastStep.action.tool);
          if (tool && 'schema' in tool) {
            this.formLogger.info(
              'Found tool from intermediate steps:',
              lastStep.action.tool
            );
            return {
              toolName: lastStep.action.tool,
              schema: (tool as ToolWithSchema).schema,
            };
          }
        }
      }

      const inputSteps = (inputs.intermediateSteps as unknown[]) || [];
      if (inputSteps.length > 0) {
        const lastStep = inputSteps[inputSteps.length - 1];
        let action: AgentAction;

        if (Array.isArray(lastStep) && lastStep.length > 0) {
          action = lastStep[0] as AgentAction;
        } else if ((lastStep as Record<string, unknown>).action) {
          action = (lastStep as Record<string, unknown>).action as AgentAction;
        } else {
          action = lastStep as AgentAction;
        }

        if (action && action.tool) {
          const tool = this.tools.find((t) => t.name === action.tool);
          if (tool && 'schema' in tool) {
            this.formLogger.info('Found tool from input steps:', action.tool);
            return {
              toolName: action.tool,
              schema: (tool as ToolWithSchema).schema,
            };
          }
        }
      }

      const toolFromContext = this.findToolFromContext(inputs);
      if (toolFromContext) {
        this.formLogger.info(
          'Found tool from context:',
          toolFromContext.toolName
        );
        return toolFromContext;
      }

      return null;
    } catch (err) {
      this.formLogger.error('Error extracting tool info:', err);
      return null;
    }
  }

  /**
   * Attempts to find tool from execution context
   */
  private findToolFromContext(inputs: Record<string, unknown>): {
    toolName: string;
    schema: unknown;
  } | null {
    const inputText = (inputs.input as string) || '';

    for (const tool of this.tools) {
      const keywords = this.extractToolKeywords(tool.name);

      if (
        keywords.some((keyword) =>
          inputText.toLowerCase().includes(keyword.toLowerCase())
        )
      ) {
        if ('schema' in tool) {
          return {
            toolName: tool.name,
            schema: (tool as ToolWithSchema).schema,
          };
        }
      }
    }

    return null;
  }

  /**
   * Additional fallback to detect tool from error context
   */
  private detectToolFromErrorContext(
    error: ZodError
  ): { toolName: string; schema: unknown } | null {
    const errorPaths = error.issues.map((issue) => issue.path.join('.'));

    for (const tool of this.tools) {
      if ('schema' in tool) {
        const toolSchema = (tool as ToolWithSchema).schema;
        if (this.schemaMatchesErrorPaths(toolSchema, errorPaths)) {
          this.formLogger.info(
            'Detected tool from error path analysis:',
            tool.name
          );
          return {
            toolName: tool.name,
            schema: toolSchema,
          };
        }
      }
    }

    return null;
  }

  /**
   * Checks if a schema structure matches error paths
   */
  private schemaMatchesErrorPaths(
    schema: unknown,
    errorPaths: string[]
  ): boolean {
    const schemaRecord = schema as Record<string, unknown>;
    if (!schemaRecord || !schemaRecord._def) return false;

    try {
      const def = schemaRecord._def as Record<string, unknown>;
      if (def.typeName === 'ZodObject') {
        const shape = def.shape as Record<string, unknown>;
        const schemaKeys = Object.keys(shape || {});
        return errorPaths.some((path) => {
          const topLevelKey = path.split('.')[0];
          return schemaKeys.includes(topLevelKey);
        });
      }
    } catch (err) {
      this.formLogger.debug('Error analyzing schema structure:', err);
    }

    return false;
  }

  /**
   * Extracts keywords from tool name for matching
   */
  private extractToolKeywords(toolName: string): string[] {
    const words = toolName
      .replace(/([A-Z])/g, ' $1')
      .toLowerCase()
      .split(/[\s_-]+/)
      .filter((w) => w.length > 2);

    return [...words, toolName.toLowerCase()];
  }

  /**
   * Formats the form message for display
   */
  private formatFormResponse(formMessage: FormMessage): string {
    const fieldCount = formMessage.formConfig.fields.length;
    const fieldList = formMessage.formConfig.fields
      .slice(0, 3)
      .map((f) => `• ${f.label}`)
      .join('\n');

    return `I need some additional information to complete your request.

${formMessage.formConfig.description}

Required fields:
${fieldList}${fieldCount > 3 ? `\n... and ${fieldCount - 3} more` : ''}

Please fill out the form below to continue.`;
  }

  /**
   * Check if there are pending forms
   */
  hasPendingForms(): boolean {
    return this.pendingForms.size > 0;
  }

  /**
   * Get information about pending forms
   */
  getPendingFormsInfo(): Array<{ formId: string; toolName: string }> {
    return Array.from(this.pendingForms.entries()).map(([formId, info]) => ({
      formId,
      toolName: info.toolName,
    }));
  }

  /**
   * Processes HashLink block responses from tools
   */
  private processHashLinkResponse(
    toolResponse: ToolResponse
  ): HashLinkResponse {
    try {
      let hashLinkBlock: HashLinkBlock | undefined;

      if (toolResponse.hashLinkBlock) {
        hashLinkBlock = toolResponse.hashLinkBlock;
      } else if (
        toolResponse.success &&
        toolResponse.inscription &&
        toolResponse.hashLinkBlock
      ) {
        hashLinkBlock = toolResponse.hashLinkBlock;
      }

      if (!hashLinkBlock) {
        throw new Error('HashLink block data not found in response');
      }

      if (
        !hashLinkBlock.blockId ||
        !hashLinkBlock.hashLink ||
        !hashLinkBlock.attributes
      ) {
        throw new Error(
          'Invalid HashLink block structure - missing required fields'
        );
      }

      let message = 'Content processed successfully!';

      if (toolResponse.success && toolResponse.inscription) {
        const inscription = toolResponse.inscription;
        const metadata = toolResponse.metadata || {};

        message = `✅ ${inscription.standard} Hashinal inscription completed!\n\n`;

        if (metadata.name) {
          message += `**${metadata.name}**\n`;
        }

        if (metadata.description) {
          message += `${metadata.description}\n\n`;
        }

        message += `📍 **Topic ID:** ${inscription.topicId}\n`;
        message += `🔗 **HRL:** ${inscription.hrl}\n`;

        if (inscription.cdnUrl) {
          message += `🌐 **CDN URL:** ${inscription.cdnUrl}\n`;
        }

        if (metadata.creator) {
          message += `👤 **Creator:** ${metadata.creator}\n`;
        }
      }

      this.formLogger.info('Processed HashLink response', {
        blockId: hashLinkBlock.blockId,
        hashLink: hashLinkBlock.hashLink,
        hasTemplate: !!hashLinkBlock.template,
        attributeCount: Object.keys(hashLinkBlock.attributes || {}).length,
      });

      return {
        hasHashLinkBlocks: true,
        hashLinkBlock,
        message,
      };
    } catch (error) {
      this.formLogger.error('Error processing HashLink response:', error);

      return {
        hasHashLinkBlocks: false,
        message: 'Content processed, but interactive display is not available.',
      };
    }
  }

  /**
   * Get FormEngine statistics for debugging
   */
  getFormEngineStatistics(): {
    strategies: string[];
    middleware: string[];
  } {
    return {
      strategies: this.formEngine.getRegisteredStrategies(),
      middleware: this.formEngine.getRegisteredMiddleware(),
    };
  }
}
