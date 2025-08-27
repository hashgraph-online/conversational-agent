import { StructuredTool } from '@langchain/core/tools';
import { ZodError, z } from 'zod';
import { Logger } from '@hashgraphonline/standards-sdk';
import { FormGenerator } from './form-generator';
import { isFormValidatable } from '@hashgraphonline/standards-agent-kit';
import type { FormMessage, FormSubmission } from './types';

/**
 * Tool execution result with optional form requirement
 */
export interface ToolExecutionResult {
  success: boolean;
  output: string;
  metadata?: Record<string, unknown>;
  requiresForm?: boolean;
  formMessage?: FormMessage;
  error?: string;
}

/**
 * Context for form generation operations
 */
export interface FormGenerationContext {
  tool: StructuredTool;
  input: unknown;
  sessionId?: string;
  userId?: string;
  missingFields?: Set<string>;
}

/**
 * FormEngine handles all form generation and validation logic
 */
export class FormEngine {
  private formGenerator: FormGenerator;
  private logger: Logger;

  constructor(logger?: Logger) {
    this.formGenerator = new FormGenerator();
    this.logger = logger || new Logger({ module: 'FormEngine' });
  }

  /**
   * Generate a form for a tool with the given input
   */
  async generateForm(
    toolName: string,
    tool: StructuredTool,
    input: unknown,
    context?: Partial<FormGenerationContext>
  ): Promise<FormMessage | null> {
    const fullContext: FormGenerationContext = {
      tool,
      input,
      ...context,
    };

    try {
      if (isFormValidatable(tool)) {
        return await this.generateFormValidatableForm(tool, input, fullContext);
      }

      if (input instanceof ZodError) {
        return await this.generateErrorBasedForm(tool, input, fullContext);
      }

      if (this.hasRenderConfig(tool)) {
        return await this.generateRenderConfigForm(tool, input, fullContext);
      }

      if (this.isZodObject(tool.schema)) {
        return await this.generateSchemaBasedForm(tool, input, fullContext);
      }

      return null;
    } catch (error) {
      this.logger.error(`Failed to generate form for tool: ${toolName}`, {
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Process a form submission
   */
  async processSubmission(
    submission: FormSubmission,
    context?: {
      originalInput?: Record<string, unknown>;
      schema?: unknown;
    }
  ): Promise<Record<string, unknown>> {
    this.validateSubmission(submission);

    const baseToolInput = this.extractBaseToolInput(context);
    const submissionData = this.extractSubmissionData(submission);

    return this.mergeInputData(baseToolInput, submissionData);
  }

  /**
   * Check if a tool requires form generation based on input
   */
  shouldGenerateForm(tool: StructuredTool, input: unknown): boolean {
    const inputRecord = input as Record<string, unknown>;
    if (inputRecord?.__fromForm === true || inputRecord?.renderForm === false) {
      return false;
    }

    if (isFormValidatable(tool)) {
      try {
        const formValidatableTool = tool as {
          shouldGenerateForm: (input: unknown) => boolean;
        };
        return formValidatableTool.shouldGenerateForm(input);
      } catch (error) {
        this.logger.error(
          `Error calling shouldGenerateForm() on ${tool.name}:`,
          error
        );
        return false;
      }
    }

    const validation = this.validateInput(tool, input);
    return !validation.isValid;
  }

  /**
   * Generate form from error context
   */
  async generateFormFromError(
    error: ZodError,
    toolName: string,
    toolSchema: z.ZodSchema,
    originalPrompt: string
  ): Promise<FormMessage> {
    return this.formGenerator.generateFormFromError(
      error,
      toolSchema as z.ZodType<unknown, z.ZodTypeDef, unknown>,
      toolName,
      originalPrompt
    );
  }

  /**
   * Generate form for FormValidatable tools
   */
  private async generateFormValidatableForm(
    tool: StructuredTool,
    input: unknown,
    _context: FormGenerationContext
  ): Promise<FormMessage> {
    const { schemaToUse, isFocusedSchema } = this.resolveFormSchema(tool);
    const missingFields = this.determineMissingFields(
      tool,
      input,
      schemaToUse,
      isFocusedSchema
    );

    return this.generateFormWithSchema(tool, input, schemaToUse, missingFields);
  }

  /**
   * Generate form based on schema validation
   */
  private async generateSchemaBasedForm(
    tool: StructuredTool,
    input: unknown,
    context: FormGenerationContext
  ): Promise<FormMessage> {
    const schema = tool.schema;

    const formMessage = await this.formGenerator.generateFormFromSchema(
      schema as z.ZodType<unknown, z.ZodTypeDef, unknown>,
      input,
      {
        toolName: tool.name,
        toolDescription: tool.description,
      },
      context.missingFields
    );

    if (this.isZodObject(schema)) {
      try {
        const { jsonSchema, uiSchema } =
          this.formGenerator.generateJsonSchemaForm(
            schema,
            input as Record<string, unknown> | undefined,
            context.missingFields || new Set()
          );
        formMessage.jsonSchema = jsonSchema;
        formMessage.uiSchema = uiSchema;
      } catch (error) {
        this.logger.warn(
          'Failed to generate JSON Schema for schema-based tool:',
          error
        );
      }
    }

    formMessage.partialInput = input;
    return formMessage;
  }

  /**
   * Generate form based on render config
   */
  private async generateRenderConfigForm(
    tool: StructuredTool,
    input: unknown,
    context: FormGenerationContext
  ): Promise<FormMessage> {
    const schema = tool.schema;
    const renderConfig = this.extractRenderConfig(tool);

    const formMessage = await this.formGenerator.generateFormFromSchema(
      schema as z.ZodType<unknown, z.ZodTypeDef, unknown>,
      input,
      {
        toolName: tool.name,
        toolDescription: tool.description,
      },
      context.missingFields
    );

    if (renderConfig) {
      formMessage.formConfig.metadata = {
        ...formMessage.formConfig.metadata,
        renderConfig,
      };
    }

    formMessage.partialInput = input;
    return formMessage;
  }

  /**
   * Generate form from Zod validation error
   */
  private async generateErrorBasedForm(
    tool: StructuredTool,
    error: ZodError,
    context: FormGenerationContext
  ): Promise<FormMessage> {
    return this.formGenerator.generateFormFromError(
      error,
      tool.schema as z.ZodType<unknown, z.ZodTypeDef, unknown>,
      tool.name,
      context.input ? String(context.input) : ''
    );
  }

  /**
   * Validate input against tool schema
   */
  private validateInput(
    tool: StructuredTool,
    input: unknown
  ): { isValid: boolean; errors?: string[] } {
    try {
      const zodSchema = tool.schema as z.ZodType<
        unknown,
        z.ZodTypeDef,
        unknown
      >;
      zodSchema.parse(input);
      return { isValid: true };
    } catch (error) {
      if (error instanceof ZodError) {
        const errors = error.errors.map(
          (err) => `${err.path.join('.')}: ${err.message}`
        );
        return { isValid: false, errors };
      }
      return { isValid: false, errors: ['Validation failed'] };
    }
  }

  /**
   * Check if schema is ZodObject
   */
  private isZodObject(schema: unknown): schema is z.ZodObject<z.ZodRawShape> {
    if (!schema || typeof schema !== 'object') {
      return false;
    }
    const candidate = schema as { _def?: { typeName?: string } };
    return Boolean(candidate._def && candidate._def.typeName === 'ZodObject');
  }

  /**
   * Check if tool has render configuration
   */
  private hasRenderConfig(tool: StructuredTool): boolean {
    const schema = tool.schema as Record<string, unknown>;
    return !!(schema && schema._renderConfig);
  }

  /**
   * Extract render configuration from tool
   */
  private extractRenderConfig(
    tool: StructuredTool
  ): Record<string, unknown> | undefined {
    const schema = tool.schema as Record<string, unknown>;
    return schema?._renderConfig as Record<string, unknown> | undefined;
  }

  /**
   * Resolve form schema for FormValidatable tools
   */
  private resolveFormSchema(tool: StructuredTool): {
    schemaToUse: z.ZodSchema;
    isFocusedSchema: boolean;
  } {
    const formValidatableTool = tool as {
      getFormSchema?: () => z.ZodSchema | null;
    };

    if (formValidatableTool.getFormSchema) {
      const focusedSchema = formValidatableTool.getFormSchema();
      if (focusedSchema) {
        return { schemaToUse: focusedSchema, isFocusedSchema: true };
      }
    }

    return { schemaToUse: tool.schema as z.ZodSchema, isFocusedSchema: false };
  }

  /**
   * Determine missing fields for form generation
   */
  private determineMissingFields(
    tool: StructuredTool,
    input: unknown,
    _schema: z.ZodSchema,
    _isFocusedSchema: boolean
  ): Set<string> {
    const missingFields = new Set<string>();

    if (!input || typeof input !== 'object') {
      return missingFields;
    }

    const inputRecord = input as Record<string, unknown>;
    const formValidatableTool = tool as {
      isFieldEmpty?: (fieldName: string, value: unknown) => boolean;
      getEssentialFields?: () => string[];
    };

    if (formValidatableTool.getEssentialFields) {
      const essentialFields = formValidatableTool.getEssentialFields();
      for (const field of essentialFields) {
        if (
          !(field in inputRecord) ||
          (formValidatableTool.isFieldEmpty &&
            formValidatableTool.isFieldEmpty(field, inputRecord[field]))
        ) {
          missingFields.add(field);
        }
      }
    }

    return missingFields;
  }

  /**
   * Generate form with resolved schema
   */
  private async generateFormWithSchema(
    tool: StructuredTool,
    input: unknown,
    schema: z.ZodSchema,
    missingFields: Set<string>
  ): Promise<FormMessage> {
    const formMessage = await this.formGenerator.generateFormFromSchema(
      schema as z.ZodType<unknown, z.ZodTypeDef, unknown>,
      input,
      {
        toolName: tool.name,
        toolDescription: tool.description,
      },
      missingFields
    );

    if (this.isZodObject(schema)) {
      try {
        const { jsonSchema, uiSchema } =
          this.formGenerator.generateJsonSchemaForm(
            schema,
            input as Record<string, unknown> | undefined,
            missingFields
          );
        formMessage.jsonSchema = jsonSchema;
        formMessage.uiSchema = uiSchema;
      } catch (error) {
        this.logger.warn('Failed to generate JSON Schema:', error);
      }
    }

    formMessage.partialInput = input;
    return formMessage;
  }

  /**
   * Validate form submission
   */
  private validateSubmission(submission: FormSubmission): void {
    if (!submission.toolName) {
      throw new Error('Tool name is required in form submission');
    }
    if (!submission.parameters) {
      throw new Error('Parameters are required in form submission');
    }
  }

  /**
   * Extract base tool input from context
   */
  private extractBaseToolInput(context?: {
    originalInput?: Record<string, unknown>;
  }): Record<string, unknown> {
    return context?.originalInput || {};
  }

  /**
   * Extract submission data
   */
  private extractSubmissionData(
    submission: FormSubmission
  ): Record<string, unknown> {
    return {
      ...submission.parameters,
      __fromForm: true,
    };
  }

  /**
   * Merge input data
   */
  private mergeInputData(
    baseInput: Record<string, unknown>,
    submissionData: Record<string, unknown>
  ): Record<string, unknown> {
    return {
      ...baseInput,
      ...submissionData,
    };
  }

  /**
   * Get registered strategies
   */
  getRegisteredStrategies(): string[] {
    return ['FormValidatable', 'SchemaBased', 'RenderConfig', 'ZodErrorBased'];
  }

  /**
   * Get registered middleware
   */
  getRegisteredMiddleware(): string[] {
    return ['FormSubmissionValidator'];
  }
}
