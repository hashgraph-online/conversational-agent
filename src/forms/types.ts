import type { RenderConfigSchema } from '@hashgraphonline/standards-agent-kit';

/**
 * JSON Schema definition for form rendering
 */
export type JSONSchemaDefinition = Record<string, unknown>;

/**
 * UI Schema configuration for form rendering customization
 */
export type UISchemaDefinition = Record<string, unknown>;

/**
 * Represents a form message that can be sent to the chat UI
 */
export interface FormMessage {
  type: 'form';
  id: string;
  formConfig: FormConfig;
  originalPrompt: string;
  toolName: string;
  validationErrors?: ValidationError[];
  partialInput?: unknown;
  jsonSchema?: JSONSchemaDefinition;
  uiSchema?: UISchemaDefinition;
}

/**
 * Configuration for generating a form from Zod schema
 */
export interface FormConfig {
  title: string;
  description?: string;
  fields: FormField[];
  submitLabel?: string;
  cancelLabel?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Individual form field configuration
 */
export interface FormField {
  name: string;
  label: string;
  type: FormFieldType;
  required: boolean;
  placeholder?: string;
  helpText?: string;
  defaultValue?: unknown;
  validation?: FieldValidation;
  options?: FieldOption[];
  renderConfig?: RenderConfigSchema;
  priority?: 'essential' | 'common' | 'advanced' | 'expert';
  suggestions?: string[];
  warnings?: string[];
  contextualGuidance?: {
    qualityStandards?: string[];
    examples?: string[];
    avoidPatterns?: string[];
  };
}

/**
 * Form field types supported by the UI
 */
export type FormFieldType = 
  | 'text'
  | 'number'
  | 'select'
  | 'checkbox'
  | 'textarea'
  | 'file'
  | 'array'
  | 'object'
  | 'currency'
  | 'percentage';

/**
 * Field validation rules
 */
export interface FieldValidation {
  min?: number;
  max?: number;
  minLength?: number;
  maxLength?: number;
  pattern?: string;
  custom?: string;
}

/**
 * Option for select/radio fields
 */
export interface FieldOption {
  value: string;
  label: string;
  description?: string;
  disabled?: boolean;
}

/**
 * Validation error from Zod
 */
export interface ValidationError {
  path: string[];
  message: string;
  code: string;
}

/**
 * Form submission data
 */
export interface FormSubmission {
  formId: string;
  toolName: string;
  parameters: Record<string, unknown>;
  timestamp: number;
  context?: {
    originalPrompt?: string;
    partialInput?: Record<string, unknown>;
    chatHistory?: Array<{type: 'human' | 'ai' | 'system'; content: string}>;
  };
}

/**
 * Response after form submission
 */
export interface FormResponse {
  success: boolean;
  message?: string;
  data?: unknown;
  error?: string;
}