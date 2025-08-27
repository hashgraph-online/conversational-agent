import { z, ZodError } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';
import type {
  FormConfig,
  FormField,
  ValidationError,
  FormMessage,
  FormFieldType,
} from './types';
import {
  extractRenderConfigs,
  generateFieldOrdering,
  type RenderConfigSchema,
  type ZodSchemaWithRender,
  type ExtractedRenderConfig,
} from '@hashgraphonline/standards-agent-kit';
import { Logger } from '@hashgraphonline/standards-sdk';
import { fieldTypeRegistry } from './field-type-registry';
import { fieldGuidanceRegistry } from './field-guidance-registry';
import { FIELD_PRIORITIES } from '../constants';

interface ZodObjectSchema extends z.ZodSchema {
  shape?: Record<string, z.ZodSchema>;
}

function isZodObjectSchema(schema: z.ZodSchema): schema is ZodObjectSchema {
  return typeof schema === 'object' && schema !== null && 'shape' in schema;
}

type FieldPriority = 'essential' | 'common' | 'advanced' | 'expert';

/**
 * Generates forms from Zod validation failures
 */
export class FormGenerator {
  private logger: Logger;

  constructor() {
    this.logger = new Logger({ module: 'FormGenerator' });
  }

  /**
   * Creates a form message from a Zod validation error
   * @param error The Zod validation error
   * @param schema The original Zod schema
   * @param toolName Name of the tool that failed validation
   * @param originalPrompt The user's original request
   * @returns FormMessage to send to the chat UI
   */
  generateFormFromError(
    error: ZodError,
    schema: z.ZodSchema,
    toolName: string,
    originalPrompt: string
  ): FormMessage {
    const validationErrors = this.extractValidationErrors(error);
    const missingFields = this.identifyMissingFields(validationErrors, schema);
    const formConfig = this.createFormConfig(schema, missingFields, toolName);

    return {
      type: 'form',
      id: `form_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      formConfig,
      originalPrompt,
      toolName,
      validationErrors,
    };
  }

  /**
   * Generates a form from a schema and partial input
   * @param schema The Zod schema to generate a form from
   * @param partialInput Any partial input already provided
   * @param context Additional context about the tool
   * @param preCalculatedMissingFields Optional pre-calculated missing fields set. If undefined, includes all fields from schema.
   * @returns FormMessage to send to the chat UI
   */
  async generateFormFromSchema(
    schema: z.ZodSchema,
    partialInput: unknown,
    context: { toolName: string; toolDescription?: string },
    preCalculatedMissingFields?: Set<string>
  ): Promise<FormMessage> {
    let missingFields: Set<string>;

    this.logger.info(`🏁 FormGenerator.generateFormFromSchema starting`, {
      toolName: context.toolName,
      partialInput,
      hasSchema: !!schema,
      hasShape: !!(schema && isZodObjectSchema(schema)),
      hasPreCalculatedFields: preCalculatedMissingFields !== undefined,
      preCalculatedFieldsSize: preCalculatedMissingFields?.size || 0,
    });

    if (preCalculatedMissingFields !== undefined) {
      missingFields = preCalculatedMissingFields;
      this.logger.info(`📋 Using pre-calculated missing fields`, {
        missingFieldsCount: missingFields.size,
        missingFields: Array.from(missingFields),
      });
    } else {
      missingFields = new Set<string>();

      const zodObject = this.extractZodObject(schema);
      if (zodObject) {
        const shape = zodObject.shape;
        for (const fieldName of Object.keys(shape)) {
          missingFields.add(fieldName);
          this.logger.info(
            `⭐ Including all fields from focused schema: ${fieldName}`
          );
        }
      }

      this.logger.info(`📋 Using ALL fields from focused schema`, {
        totalFields: zodObject ? Object.keys(zodObject.shape).length : 0,
        missingFieldsCount: missingFields.size,
        missingFields: Array.from(missingFields),
      });
    }

    const formConfig = this.createFormConfig(
      schema,
      missingFields,
      context.toolName,
      preCalculatedMissingFields
    );

    return {
      type: 'form',
      id: `form_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      formConfig,
      originalPrompt: context.toolDescription || `Complete ${context.toolName}`,
      toolName: context.toolName,
      validationErrors: [],
    };
  }

  /**
   * Extracts validation errors from ZodError
   */
  private extractValidationErrors(error: ZodError): ValidationError[] {
    return error.issues.map((issue) => ({
      path: issue.path.map((p) => String(p)),
      message: issue.message,
      code: issue.code,
    }));
  }

  /**
   * Identifies which fields are missing or invalid from validation errors
   */
  private identifyMissingFields(
    errors: ValidationError[],
    _schema: z.ZodSchema
  ): Set<string> {
    const missingFields = new Set<string>();

    errors.forEach((error) => {
      const fieldPath = error.path.join('.');
      if (fieldPath) {
        missingFields.add(fieldPath);
      }
    });

    return missingFields;
  }

  /**
   * Creates form configuration from schema
   */
  private createFormConfig(
    schema: z.ZodSchema,
    missingFields: Set<string>,
    toolName: string,
    preCalculatedMissingFields?: Set<string>
  ): FormConfig {
    const extractedConfig = this.extractRenderConfigsSafely(schema);
    const fieldOrdering = this.generateFieldOrderingSafely(schema);
    const fields = this.generateFormFields(
      schema,
      extractedConfig,
      missingFields,
      fieldOrdering,
      preCalculatedMissingFields,
      toolName
    );

    const globalGuidance = fieldGuidanceRegistry.getGlobalGuidance(toolName);
    let description = this.generateFormDescription(toolName, missingFields.size);
    
    if (globalGuidance?.qualityStandards) {
      description += '\n\nQuality Guidelines:\n' + 
        globalGuidance.qualityStandards.map(standard => `• ${standard}`).join('\n');
    }

    return {
      title: this.generateFormTitle(toolName),
      description,
      fields,
      submitLabel: 'Continue',
      cancelLabel: 'Cancel',
      metadata: {
        toolName,
        missingFieldCount: missingFields.size,
        globalGuidance
      },
    };
  }

  /**
   * Safely extracts render configs from schema
   */
  private extractRenderConfigsSafely(
    schema: z.ZodSchema
  ): ExtractedRenderConfig {
    try {
      if (typeof extractRenderConfigs === 'function') {
        return extractRenderConfigs(schema as unknown as ZodSchemaWithRender);
      }
    } catch (error) {
      this.logger.warn('Could not extract render configs:', error);
    }
    return {
      fields: {},
      groups: {},
      order: [],
      metadata: {},
    };
  }

  /**
   * Safely generates field ordering from schema
   */
  private generateFieldOrderingSafely(schema: z.ZodSchema): {
    sections: Array<{ fields: string[] }>;
  } {
    try {
      if (typeof generateFieldOrdering === 'function') {
        const ordering = generateFieldOrdering(
          schema as unknown as ZodSchemaWithRender
        );

        const sections = Object.values(ordering.sections).map((section) => ({
          fields: section.fields,
        }));
        return { sections };
      }
    } catch (error) {
      this.logger.warn('Could not generate field ordering:', error);
    }
    return { sections: [] };
  }

  /**
   * Determines field priority for progressive disclosure
   */
  private getFieldPriority(
    name: string,
    renderConfig?: RenderConfigSchema,
    isRequired?: boolean
  ): FieldPriority {
    if (renderConfig?.ui?.priority) {
      const priority = renderConfig.ui.priority as string;
      if (Object.values(FIELD_PRIORITIES).includes(priority as FieldPriority)) {
        return priority as FieldPriority;
      }
    }

    if (isRequired === true) {
      return FIELD_PRIORITIES.ESSENTIAL;
    }

    const ui = renderConfig?.ui as Record<string, unknown> | undefined;
    if (ui?.advanced === true) {
      return FIELD_PRIORITIES.ADVANCED;
    }

    if (ui?.expert === true) {
      return FIELD_PRIORITIES.EXPERT;
    }

    return FIELD_PRIORITIES.COMMON;
  }

  /**
   * Determines which fields should be included in the form
   */
  private determineFieldsToInclude(
    schema: z.ZodSchema,
    missingFields: Set<string>,
    preCalculatedMissingFields?: Set<string>
  ): Set<string> {
    const fieldsToInclude = new Set<string>();

    if (preCalculatedMissingFields === undefined) {
      this.logger.info(
        `⭐ Focused schema mode - including ALL fields from schema`
      );
      const allSchemaFields = this.extractFieldsFromSchema(schema);
      allSchemaFields.forEach((fieldName) => {
        fieldsToInclude.add(fieldName);
        this.logger.info(`✅ Including focused schema field: ${fieldName}`);
      });
    } else if (preCalculatedMissingFields.size > 0) {
      this.logger.info(
        `📋 Using ONLY pre-calculated missing fields (${preCalculatedMissingFields.size} fields)`,
        { fields: Array.from(preCalculatedMissingFields) }
      );
      preCalculatedMissingFields.forEach((fieldName) => {
        fieldsToInclude.add(fieldName);
        this.logger.info(`✅ Including pre-calculated field: ${fieldName}`);
      });
    } else {
      this.logger.info(
        '⚠️ No pre-calculated fields, falling back to schema analysis'
      );
      this.includeRequiredMissingFields(schema, missingFields, fieldsToInclude);
    }

    return fieldsToInclude;
  }

  /**
   * Includes required fields that are missing
   */
  private includeRequiredMissingFields(
    schema: z.ZodSchema,
    missingFields: Set<string>,
    fieldsToInclude: Set<string>
  ): void {
    const allSchemaFields = this.extractFieldsFromSchema(schema);
    allSchemaFields.forEach((fieldName) => {
      const isRequired = this.isFieldRequired(schema, fieldName);
      const isMissing = missingFields.has(fieldName);
      const shouldInclude = isMissing && isRequired;

      this.logger.info(`🔍 FormGenerator field inclusion check: ${fieldName}`, {
        isRequired,
        isMissing,
        shouldInclude,
      });

      if (shouldInclude) {
        fieldsToInclude.add(fieldName);
      }
    });
  }

  /**
   * Creates form fields from ordered field names
   */
  private createOrderedFields(
    fieldsToInclude: Set<string>,
    fieldOrdering: { sections: Array<{ fields: string[] }> },
    extractedConfig: ExtractedRenderConfig,
    schema: z.ZodSchema,
    toolName?: string
  ): FormField[] {
    const fields: FormField[] = [];
    const processedFields = new Set<string>();

    if (fieldOrdering.sections.length > 0) {
      const orderedFieldNames = fieldOrdering.sections.flatMap((s) => s.fields);
      orderedFieldNames.forEach((fieldName) => {
        if (fieldsToInclude.has(fieldName) && !processedFields.has(fieldName)) {
          const field = this.createFormField(
            fieldName,
            extractedConfig.fields[fieldName],
            schema,
            fieldName,
            toolName
          );
          if (field) {
            fields.push(field);
            processedFields.add(fieldName);
          }
        }
      });
    }

    fieldsToInclude.forEach((fieldName) => {
      if (!processedFields.has(fieldName)) {
        const field = this.createFormField(
          fieldName,
          extractedConfig.fields[fieldName],
          schema,
          fieldName,
          toolName
        );
        if (field) {
          fields.push(field);
        }
      }
    });

    return fields;
  }

  /**
   * Generates form fields from schema and validation errors
   */
  private generateFormFields(
    schema: z.ZodSchema,
    extractedConfig: ExtractedRenderConfig,
    missingFields: Set<string>,
    fieldOrdering: { sections: Array<{ fields: string[] }> },
    preCalculatedMissingFields?: Set<string>,
    toolName?: string
  ): FormField[] {
    const fieldsToInclude = this.determineFieldsToInclude(
      schema,
      missingFields,
      preCalculatedMissingFields
    );

    let fields = this.createOrderedFields(
      fieldsToInclude,
      fieldOrdering,
      extractedConfig,
      schema,
      toolName
    );

    if (fields.length === 0 && missingFields.size > 0) {
      fields = Array.from(missingFields)
        .map((fieldName) =>
          this.createFormField(
            fieldName,
            extractedConfig.fields[fieldName],
            schema,
            fieldName,
            toolName
          )
        )
        .filter(
          (field): field is FormField => field !== null && field !== undefined
        );
    }

    return fields;
  }

  /**
   * Creates a single form field
   */
  private createFormField(
    fieldName: string,
    renderConfig?: RenderConfigSchema,
    schema?: z.ZodSchema,
    fieldPath?: string,
    toolName?: string
  ): FormField {
    const type = this.mapFieldType(renderConfig?.fieldType, schema, fieldPath);
    const isRequired = this.isFieldRequired(schema, fieldPath || fieldName);
    
    const guidance = toolName ? fieldGuidanceRegistry.getFieldGuidance(toolName, fieldName) : null;
    const finalType = guidance?.fieldTypeOverride || type;

    const field: FormField = {
      name: fieldName,
      label: renderConfig?.ui?.label || this.humanizeFieldName(fieldName),
      type: finalType,
      required: isRequired,
      priority: this.getFieldPriority(fieldName, renderConfig, isRequired),
    };

    if (guidance) {
      if (guidance.suggestions && guidance.suggestions.length > 0) {
        field.suggestions = guidance.suggestions;
        if (!field.placeholder) {
          field.placeholder = `e.g., ${guidance.suggestions[0]}`;
        }
      }

      if (guidance.predefinedOptions) {
        field.options = [...(field.options || []), ...guidance.predefinedOptions];
      }

      if (guidance.contextualHelpText) {
        field.helpText = guidance.contextualHelpText;
      }

      if (guidance.warnings) {
        field.warnings = guidance.warnings.map(w => w.message);
      }

      if (guidance.validationRules) {
        const { qualityChecks } = guidance.validationRules;
        if (qualityChecks) {
          field.contextualGuidance = {
            qualityStandards: [],
            examples: guidance.suggestions || [],
            avoidPatterns: qualityChecks.forbidTechnicalTerms || []
          };

          if (qualityChecks.minNonTechnicalWords) {
            field.contextualGuidance.qualityStandards?.push(
              `Use at least ${qualityChecks.minNonTechnicalWords} meaningful words`
            );
          }

          if (qualityChecks.forbidTechnicalTerms) {
            field.contextualGuidance.qualityStandards?.push(
              `Avoid technical terms like: ${qualityChecks.forbidTechnicalTerms.join(', ')}`
            );
          }
        }
      }
    }

    if (renderConfig) {
      field.renderConfig = renderConfig;
    }

    if (renderConfig?.ui?.placeholder) {
      field.placeholder = renderConfig.ui.placeholder;
    }

    if (renderConfig?.ui?.helpText) {
      field.helpText = renderConfig.ui.helpText;
    }

    if (renderConfig?.constraints) {
      const validation: Record<string, unknown> = {};
      if (renderConfig.constraints.min !== undefined)
        validation.min = renderConfig.constraints.min;
      if (renderConfig.constraints.max !== undefined)
        validation.max = renderConfig.constraints.max;
      if (renderConfig.constraints.minLength !== undefined)
        validation.minLength = renderConfig.constraints.minLength;
      if (renderConfig.constraints.maxLength !== undefined)
        validation.maxLength = renderConfig.constraints.maxLength;
      if (renderConfig.constraints.pattern !== undefined)
        validation.pattern = renderConfig.constraints.pattern;

      if (Object.keys(validation).length > 0) {
        field.validation = validation;
      }
    }

    if (renderConfig?.options) {
      field.options = renderConfig.options.map((opt) => ({
        value: String(opt.value),
        label: opt.label,
        ...(opt.disabled !== undefined && { disabled: opt.disabled }),
      }));
    }

    return field;
  }

  /**
   * Maps render config field type to form field type with fallback inference
   */
  private mapFieldType(
    fieldType?: string,
    schema?: z.ZodSchema,
    fieldPath?: string
  ): FormFieldType {
    if (!fieldType && schema && fieldPath) {
      const inferredType = this.inferTypeFromSchema(schema, fieldPath);
      if (inferredType) {
        return inferredType;
      }
    }

    if (!fieldType && fieldPath) {
      const registryType = fieldTypeRegistry.detectType(fieldPath);
      if (registryType) {
        return registryType;
      }
    }

    if (!fieldType) {
      return 'text';
    }

    const normalizedType = fieldType.toLowerCase();

    if (['text', 'string'].includes(normalizedType)) return 'text';
    if (['number', 'integer', 'float', 'decimal'].includes(normalizedType))
      return 'number';
    if (['select', 'enum', 'dropdown'].includes(normalizedType))
      return 'select';
    if (['checkbox', 'boolean', 'bool'].includes(normalizedType))
      return 'checkbox';
    if (['textarea', 'longtext', 'multiline'].includes(normalizedType))
      return 'textarea';
    if (['file', 'upload', 'attachment'].includes(normalizedType))
      return 'file';
    if (['array', 'list'].includes(normalizedType)) return 'array';
    if (['object', 'json'].includes(normalizedType)) return 'object';
    if (['currency', 'money', 'price'].includes(normalizedType))
      return 'currency';
    if (['percentage', 'percent'].includes(normalizedType)) return 'percentage';

    return 'text';
  }

  /**
   * Converts field name to human-readable label
   */
  private humanizeFieldName(fieldName: string): string {
    return fieldName
      .replace(/([A-Z])/g, ' $1')
      .replace(/_/g, ' ')
      .replace(/\./g, ' ')
      .trim()
      .split(' ')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');
  }

  /**
   * Generates a title for the form
   */
  private generateFormTitle(toolName: string): string {
    const cleanName = toolName
      .replace(/Tool$/, '')
      .replace(/Hedera/g, '')
      .replace(/([A-Z])/g, ' $1')
      .trim();

    return `Complete ${cleanName} Information`;
  }

  /**
   * Safely extracts ZodObject from a schema, returns null if not an object schema
   */
  private extractZodObject(
    schema: z.ZodSchema
  ): z.ZodObject<z.ZodRawShape> | null {
    try {
      const def = (schema as z.ZodType)._def as { typeName?: string };
      if (def && def.typeName === 'ZodObject') {
        return schema as z.ZodObject<z.ZodRawShape>;
      }
    } catch (error) {
      this.logger.debug('Could not extract ZodObject from schema:', error);
    }
    return null;
  }

  /**
   * Extracts field names from Zod schema structure
   */
  private extractFieldsFromSchema(schema: z.ZodSchema): string[] {
    const fields: string[] = [];

    const zodObject = this.extractZodObject(schema);
    if (zodObject) {
      fields.push(...Object.keys(zodObject.shape));
      return fields;
    }

    try {
      const def = (schema as z.ZodType)._def as {
        typeName?: string;
        options?: z.ZodType[];
      };
      if (def && def.typeName === 'ZodUnion' && def.options) {
        const firstOption = def.options[0];
        const firstOptionObject = this.extractZodObject(firstOption);
        if (firstOptionObject) {
          fields.push(...Object.keys(firstOptionObject.shape));
        }
      }
    } catch (error) {
      this.logger.debug(
        'Could not extract fields from schema structure:',
        error
      );
    }

    return fields;
  }

  /**
   * Infers field type from Zod schema
   */
  private inferTypeFromSchema(
    schema: z.ZodSchema,
    fieldPath: string
  ): FormFieldType | null {
    try {
      const zodObject = this.extractZodObject(schema);
      if (!zodObject) return null;

      const shape = zodObject.shape;
      if (!shape) return null;

      let fieldSchema = shape[fieldPath] as z.ZodType | undefined;
      if (!fieldSchema) return null;

      const fieldDef = fieldSchema._def as {
        typeName?: string;
        innerType?: z.ZodType;
      };
      if (
        fieldDef &&
        fieldDef.typeName === 'ZodOptional' &&
        fieldDef.innerType
      ) {
        fieldSchema = fieldDef.innerType;
      }

      if (!fieldSchema || !fieldSchema._def) return null;

      const typeDef = fieldSchema._def as { typeName?: string };
      const fieldTypeName = typeDef.typeName;
      const lowerPath = fieldPath.toLowerCase();

      switch (fieldTypeName) {
        case 'ZodString':
          if (lowerPath.includes('memo') || lowerPath.includes('description')) {
            return 'textarea';
          }
          return 'text';
        case 'ZodNumber':
          if (lowerPath.includes('percent')) {
            return 'percentage';
          }
          if (lowerPath.includes('price') || lowerPath.includes('cost')) {
            return 'currency';
          }
          return 'number';
        case 'ZodBoolean':
          return 'checkbox';
        case 'ZodEnum':
        case 'ZodNativeEnum':
          return 'select';
        case 'ZodArray':
          return 'array';
        case 'ZodObject':
          return 'object';
        default:
          return 'text';
      }
    } catch (error) {
      this.logger.debug('Could not infer type from schema:', error);
    }
    return null;
  }

  /**
   * Determines if a field is required based on the Zod schema
   */
  private isFieldRequired(schema?: z.ZodSchema, fieldPath?: string): boolean {
    if (!schema || !fieldPath) {
      return false;
    }

    try {
      const zodObject = this.extractZodObject(schema);
      if (!zodObject) return false;

      const shape = zodObject.shape;
      if (!shape || !shape[fieldPath]) return false;

      const fieldSchema = shape[fieldPath] as z.ZodType;
      if (!fieldSchema || !fieldSchema._def) return true;

      const fieldDef = fieldSchema._def as {
        typeName?: string;
        defaultValue?: unknown;
      };
      const typeName = fieldDef.typeName;

      if (typeName === 'ZodOptional') {
        return false;
      }

      if (typeName === 'ZodDefault') {
        return false;
      }

      if (fieldDef.defaultValue !== undefined) {
        return false;
      }

      return true;
    } catch (error) {
      this.logger.debug(
        `Could not determine if field ${fieldPath} is required:`,
        error
      );
    }

    return false;
  }

  /**
   * Generates a description for the form
   */
  private generateFormDescription(
    toolName: string,
    fieldCount: number
  ): string {
    if (fieldCount === 0) {
      return 'Please provide the required information to continue with your request.';
    }

    return `Please provide the following ${fieldCount} required field${
      fieldCount !== 1 ? 's' : ''
    } to continue with your request.`;
  }

  /**
   * Generates JSON Schema and uiSchema from a Zod schema for use with @rjsf/core
   * @param zodSchema The Zod schema to convert
   * @param partialInput Existing input data to filter out fields that already have values
   * @param missingFields Set of fields that are missing and should be shown
   * @returns Object containing jsonSchema and uiSchema
   */
  public generateJsonSchemaForm(
    zodSchema: z.ZodObject<z.ZodRawShape>,
    partialInput?: Record<string, unknown>,
    missingFields?: Set<string>
  ): { jsonSchema: Record<string, unknown>; uiSchema: Record<string, unknown> } {
    const fullJsonSchema = zodToJsonSchema(zodSchema, {
      target: 'jsonSchema7',
    });

    const uiSchema: Record<string, Record<string, unknown>> = {};

    let jsonSchema = fullJsonSchema;
    if (missingFields && missingFields.size > 0) {
      const fullSchemaAsObject = fullJsonSchema as {
        properties?: Record<string, unknown>;
        required?: string[];
        [key: string]: unknown;
      };
      if (
        fullSchemaAsObject.properties &&
        typeof fullSchemaAsObject.properties === 'object'
      ) {
        const filteredSchema = {
          ...fullSchemaAsObject,
          type: 'object' as const,
          properties: {} as Record<string, unknown>,
          required: [] as string[],
        };

        let fieldsAdded = 0;
        missingFields.forEach((fieldName) => {
          if (
            fullSchemaAsObject.properties &&
            fullSchemaAsObject.properties[fieldName]
          ) {
            filteredSchema.properties[fieldName] =
              fullSchemaAsObject.properties[fieldName];
            fieldsAdded++;
          }
        });

        if (Array.isArray(fullSchemaAsObject.required)) {
          filteredSchema.required = fullSchemaAsObject.required.filter(
            (field: string) => missingFields.has(field)
          );
        }

        if (fieldsAdded > 0) {
          jsonSchema = filteredSchema;
        }
      }
    }

    const fieldNames = this.extractFieldsFromSchema(zodSchema);

    fieldNames.forEach((fieldName) => {
      const isRequired = this.isFieldRequired(zodSchema, fieldName);
      const priority = this.getFieldPriority(fieldName, undefined, isRequired);
      const lower = fieldName.toLowerCase();

      if (
        lower === 'attributes' ||
        lower === 'metadata' ||
        lower === 'properties'
      ) {
        uiSchema[fieldName] = {
          'ui:options': {
            collapsible: true,
            collapsed: true,
          },
        };
      }

      switch (priority) {
        case 'essential':
          if (isRequired) {
            uiSchema[fieldName] = {
              ...uiSchema[fieldName],
              'ui:help': 'Required field',
            };
          }
          break;
        case 'advanced':
        case 'expert':
          uiSchema[fieldName] = {
            ...uiSchema[fieldName],
            'ui:options': {
              ...(uiSchema[fieldName]?.['ui:options'] as
                | Record<string, unknown>
                | undefined),
              collapsed: true,
            },
          };
          break;
      }
    });

    return { jsonSchema, uiSchema };
  }
}
