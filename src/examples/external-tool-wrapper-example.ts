/**
 * Mock examples for external tool wrapper functionality
 * These are placeholders to satisfy import statements in test scripts
 */

export const examples = {
  basicWrapping: () => ({
    name: 'mock-basic-tool',
    description: 'Mock basic external tool wrapper example',
    schema: { constructor: { name: 'ZodSchema' } },
    _call: async (_input: unknown) => `Mock result: ${JSON.stringify(_input)}`
  }),

  presetConfigurations: () => ({
    name: 'mock-preset-tool',
    description: 'Mock preset configuration tool example',
    schema: { constructor: { name: 'ZodSchema' } }
  }),

  batchWrapping: () => [
    { name: 'mock-batch-tool-1' },
    { name: 'mock-batch-tool-2' }
  ],

  formValidationIntegration: () => ({
    name: 'mock-form-tool',
    description: 'Mock form validation integration example',
    constructor: { name: 'FormValidatingToolWrapper' },
    _call: async (_input: unknown) => JSON.stringify({
      requiresForm: true,
      formMessage: {
        id: 'mock-form-id',
        formConfig: {
          title: 'Mock Form',
          fields: [
            { name: 'toAccountId', type: 'text' },
            { name: 'amount', type: 'number' }
          ]
        }
      }
    })
  }),

  customFieldConfigs: () => ({
    name: 'mock-custom-tool',
    description: 'Mock custom field configuration example',
    schema: {
      _def: {
        shape: () => ({
          field1: { _renderConfig: { type: 'text' } },
          field2: { _renderConfig: { type: 'number' } }
        })
      }
    }
  })
};