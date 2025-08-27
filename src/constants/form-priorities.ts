/**
 * Form field priorities for progressive disclosure
 */
export const FIELD_PRIORITIES = {
  ESSENTIAL: 'essential',
  COMMON: 'common', 
  ADVANCED: 'advanced',
  EXPERT: 'expert'
} as const;

/**
 * Form field types
 */
export const FORM_FIELD_TYPES = {
  TEXT: 'text',
  NUMBER: 'number',
  SELECT: 'select',
  CHECKBOX: 'checkbox',
  TEXTAREA: 'textarea',
  FILE: 'file',
  ARRAY: 'array',
  OBJECT: 'object',
  CURRENCY: 'currency',
  PERCENTAGE: 'percentage',
} as const;