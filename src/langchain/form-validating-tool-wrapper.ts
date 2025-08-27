import { StructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import { CallbackManagerForToolRun } from '@langchain/core/callbacks/manager';
import { Logger } from '@hashgraphonline/standards-sdk';
import { FormGenerator } from '../forms/form-generator';
import type { FormMessage } from '../forms/types';
import { isFormValidatable } from '@hashgraphonline/standards-agent-kit';

export interface FormValidationConfig {
  requireAllFields?: boolean;
  skipFields?: string[];
  customValidation?: (input: unknown) => boolean;
}

/**
 * Generic wrapper for StructuredTools that intercepts execution to check for missing required fields
 * and generates forms when validation would benefit from user input.
 *
 * Tools can implement the FormValidatable interface to provide custom validation logic.
 * Otherwise, falls back to schema-based validation.
 */
export class FormValidatingToolWrapper<
  TSchema extends z.ZodObject<z.ZodRawShape, z.UnknownKeysParam, z.ZodTypeAny>
> extends StructuredTool<TSchema> {
  private originalTool: StructuredTool<TSchema>;
  private formGenerator: FormGenerator;
  private validationConfig: FormValidationConfig;
  private logger: Logger;

  name: string;
  description: string;
  schema: TSchema;

  constructor(
    originalTool: StructuredTool<TSchema>,
    formGenerator: FormGenerator,
    config: FormValidationConfig = {}
  ) {
    super();
    this.originalTool = originalTool;
    this.formGenerator = formGenerator;
    this.validationConfig = config;
    this.logger = new Logger({ module: 'FormValidatingToolWrapper' });

    this.name = originalTool.name;
    this.description = originalTool.description;
    this.schema = originalTool.schema;
    
    this.logger.info(`🔧 FormValidatingToolWrapper created for tool: ${this.name}`, {
      originalToolName: originalTool.name,
      originalToolType: originalTool.constructor.name,
      wrapperType: this.constructor.name
    });
  }

  /**
   * Validate the input against the schema
   */
  private validateInput(input: Record<string, unknown>): { isValid: boolean; errors?: string[] } {
    try {
      this.schema.parse(input);
      return { isValid: true };
    } catch (error) {
      if (error instanceof z.ZodError) {
        const errors = error.errors
          .filter(err => {
            const fieldName = err.path[0] as string;
            return !this.validationConfig.skipFields?.includes(fieldName);
          })
          .map(err => `${err.path.join('.')}: ${err.message}`);
        return { isValid: false, errors };
      }
      return { isValid: false, errors: ['Validation failed'] };
    }
  }

  /**
   * Gets the shape keys from the schema if it's a ZodObject
   */
  private getSchemaShape(): string[] {
    if (this.isZodObject(this.schema)) {
      return Object.keys(this.schema.shape);
    }
    return [];
  }

  /**
   * Executes the wrapped tool's original implementation directly, bypassing wrapper logic.
   */
  public async executeOriginal(
    input: Record<string, unknown>,
    runManager?: CallbackManagerForToolRun
  ): Promise<string> {
    type CallableMethod = (
      args: Record<string, unknown>,
      runManager?: CallbackManagerForToolRun
    ) => Promise<string>;
    
    const tool = this.originalTool as unknown as Record<string, unknown>;
    
    if ('_call' in tool && typeof tool._call === 'function') {
      return (tool._call as CallableMethod)(input, runManager);
    }
    if ('call' in tool && typeof tool.call === 'function') {
      return (tool.call as CallableMethod)(input, runManager);
    }
    throw new Error('Original tool has no callable implementation');
  }

  /**
   * Provides access to the wrapped tool instance for executors that want to bypass the wrapper.
   */
  public getOriginalTool(): StructuredTool<TSchema> {
    return this.originalTool;
  }

  /**
   * Checks if tool implements FormValidatable method
   */
  private hasFormValidatableMethod<T>(
    tool: unknown,
    methodName: string
  ): tool is Record<string, T> {
    return (
      tool !== null &&
      typeof tool === 'object' &&
      methodName in tool &&
      typeof (tool as Record<string, unknown>)[methodName] === 'function'
    );
  }

  /**
   * Expose FormValidatable methods by delegating to the underlying tool when available.
   */
  public getFormSchema(): z.ZodSchema {
    if (this.hasFormValidatableMethod<() => z.ZodSchema>(this.originalTool, 'getFormSchema')) {
      return this.originalTool.getFormSchema();
    }
    return this.schema as z.ZodSchema;
  }

  public getEssentialFields(): string[] {
    if (this.hasFormValidatableMethod<() => string[]>(this.originalTool, 'getEssentialFields')) {
      return this.originalTool.getEssentialFields();
    }
    return [];
  }

  public isFieldEmpty(fieldName: string, value: unknown): boolean {
    if (this.hasFormValidatableMethod<(n: string, v: unknown) => boolean>(this.originalTool, 'isFieldEmpty')) {
      return this.originalTool.isFieldEmpty(fieldName, value);
    }
    if (value === undefined || value === null || value === '') {
      return true;
    }
    if (Array.isArray(value) && value.length === 0) {
      return true;
    }
    return false;
  }

  /**
   * Calculates which fields are missing from the input
   */
  private calculateMissingFields(
    input: Record<string, unknown>,
    isCustom: boolean
  ): Set<string> {
    const missingFields = new Set<string>();
    
    if (!isCustom) {
      return missingFields;
    }

    const essentialFields = this.getEssentialFields();
    for (const fieldName of essentialFields) {
      const value = input[fieldName];
      if (this.isFieldEmpty(fieldName, value)) {
        missingFields.add(fieldName);
      }
    }
    
    return missingFields;
  }

  /**
   * Creates a form message with optional JSON schema
   */
  private async createFormMessage(
    schema: z.ZodSchema,
    input: Record<string, unknown>,
    missingFields: Set<string>
  ): Promise<FormMessage> {
    let formMessage = await this.formGenerator.generateFormFromSchema(
      schema,
      input,
      {
        toolName: this.name,
        toolDescription: this.description
      },
      missingFields
    );

    if (this.isZodObject(schema)) {
      try {
        const { jsonSchema, uiSchema } = this.formGenerator.generateJsonSchemaForm(
          schema,
          input,
          missingFields
        );
        formMessage = {
          ...formMessage,
          jsonSchema,
          uiSchema
        };
      } catch (error) {
        this.logger.warn('Failed to generate JSON Schema for RJSF:', error);
      }
    }

    formMessage.partialInput = input;
    return formMessage;
  }

  /**
   * Type guard to check if a schema is a ZodObject
   */
  private isZodObject(schema: z.ZodSchema): schema is z.ZodObject<z.ZodRawShape> {
    const def = (schema as z.ZodType)._def as { typeName?: string };
    return !!(def && def.typeName === 'ZodObject');
  }

  /**
   * Check if we should generate a form for this tool invocation
   */
  private shouldGenerateForm(input: Record<string, unknown>): boolean {
    this.logger.info(`shouldGenerateForm called for ${this.name}/${this.originalTool.name}`, {
      input,
      hasCustomValidation: !!this.validationConfig.customValidation
    });

    if (this.validationConfig.customValidation) {
      const result = !this.validationConfig.customValidation(input);
      this.logger.info(`Custom validation result: ${result}`);
      return result;
    }

    if (isFormValidatable(this.originalTool)) {
      this.logger.info(`Tool ${this.originalTool.name} implements FormValidatable, using custom logic`);
      return this.originalTool.shouldGenerateForm(input);
    }

    this.logger.info(`Tool ${this.originalTool.name} using schema validation only`);
    const validation = this.validateInput(input);
    this.logger.info(`Schema validation for ${this.originalTool.name}:`, {
      isValid: validation.isValid,
      errors: validation.errors
    });
    return !validation.isValid;
  }

  /**
   * Checks if input has bypass flags that skip form generation
   */
  private hasFormBypassFlags(input: Record<string, unknown>): boolean {
    return (
      (input.__fromForm === true) ||
      (input.renderForm === false)
    );
  }

  /**
   * Override _call to intercept tool execution
   */
  protected async _call(
    input: z.infer<TSchema>,
    runManager?: CallbackManagerForToolRun
  ): Promise<string> {
    this.logger.info(`🚨🚨🚨 FormValidatingToolWrapper._call INTERCEPTING ${this.name} 🚨🚨🚨`, {
      input,
      inputKeys: Object.keys(input as Record<string, unknown>),
      schemaShape: this.getSchemaShape(),
      stackTrace: new Error().stack?.split('\n').slice(0, 5)
    });

    const inputRecord = input as unknown as Record<string, unknown>;
    
    if (this.hasFormBypassFlags(inputRecord)) {
      this.logger.info('Bypassing form generation and executing original tool due to submission flags');
      return this.executeOriginal(inputRecord, runManager);
    }

    const shouldGenerate = this.shouldGenerateForm(input as Record<string, unknown>);
    this.logger.info(`FormValidatingToolWrapper decision for ${this.name}:`, {
      shouldGenerateForm: shouldGenerate,
      toolName: this.name,
      originalToolName: this.originalTool.name
    });

    if (shouldGenerate) {
      this.logger.info(`Generating form for incomplete input in ${this.name}`);

      try {
        const isCustom = isFormValidatable(this.originalTool);
        const schemaToUse = isCustom ? this.getFormSchema() : this.schema;
        const missingFields = this.calculateMissingFields(
          input as Record<string, unknown>,
          isCustom
        );

        const schemaFields = this.isZodObject(schemaToUse) 
          ? Object.keys(schemaToUse.shape)
          : [];
        
        this.logger.info(`Using ${isCustom ? 'CUSTOM' : 'DEFAULT'} schema for form generation`, {
          toolName: this.originalTool.name,
          schemaType: schemaToUse.constructor?.name,
          schemaFields,
          isCustomSchema: isCustom
        });

        const formMessage = await this.createFormMessage(
          schemaToUse,
          input as Record<string, unknown>,
          missingFields
        );

        const result = {
          requiresForm: true,
          formMessage,
          message: `Please complete the form to provide the required information for ${this.name}.`
        };

        this.logger.info(`FormValidatingToolWrapper returning form result for ${this.name}`);
        return JSON.stringify(result);
      } catch (error) {
        this.logger.error('Failed to generate form:', error);
      }
    }

    this.logger.info(`FormValidatingToolWrapper passing through to original tool ${this.name}`);
    return this.executeOriginal(input as Record<string, unknown>, runManager);
  }

}

/**
 * Wrap a tool with form validation capabilities
 */
export function wrapToolWithFormValidation<TSchema extends z.ZodObject<z.ZodRawShape, z.UnknownKeysParam, z.ZodTypeAny>>(
  tool: StructuredTool<TSchema>,
  formGenerator: FormGenerator,
  config: FormValidationConfig = {}
): FormValidatingToolWrapper<TSchema> {
  return new FormValidatingToolWrapper(tool, formGenerator, config);
}