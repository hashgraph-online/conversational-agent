import { z } from 'zod';
import { FormGenerator } from '../../../src/forms/form-generator';
import { fieldGuidanceRegistry } from '../../../src/forms/field-guidance-registry';
import type { FieldGuidance } from '../../../src/forms/field-guidance-registry';

describe('FormGenerator - Provider Integration', () => {
  let fg: FormGenerator;

  beforeEach(() => {
    fg = new FormGenerator();
    fieldGuidanceRegistry.clear();
    process.env.CA_FORM_GUIDANCE_ENABLED = 'true';
  });

  it('applies provider guidance to generated form', async () => {
    const provider = {
      getFieldGuidance: (fieldName: string): FieldGuidance | null =>
        fieldName === 'name'
          ? { suggestions: ['prov-name'], contextualHelpText: 'help-from-provider' }
          : null,
    };

    fieldGuidanceRegistry.registerToolProvider(/inscribe.*hashinal/i, provider, { id: 'prov', priority: 5 });

    const schema = z.object({ name: z.string() });
    const form = await fg.generateFormFromSchema(schema, {}, { toolName: 'inscribeHashinal' });

    const nameField = form.formConfig.fields.find((f) => f.name === 'name');
    expect(nameField?.suggestions).toEqual(['prov-name']);
    expect(nameField?.helpText).toBe('help-from-provider');
  });
});

