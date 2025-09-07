import { fieldGuidanceRegistry } from '../../../src/forms/field-guidance-registry';
import type { FieldGuidance } from '../../../src/forms/field-guidance-registry';

describe('Field Guidance - Env Compatibility (provider-only)', () => {
  const ORIGINAL_ENABLED = process.env.CA_FORM_GUIDANCE_ENABLED;

  beforeEach(() => {
    process.env.CA_FORM_GUIDANCE_ENABLED = 'true';
    fieldGuidanceRegistry.clear();
  });

  afterEach(() => {
    process.env.CA_FORM_GUIDANCE_ENABLED = ORIGINAL_ENABLED;
  });

  it('does not autoload any legacy guidance; returns null until a provider or static config is registered', () => {
    const g = fieldGuidanceRegistry.getFieldGuidance('inscribeHashinal', 'name');
    expect(g).toBeNull();
  });

  it('applies guidance once a provider is registered (simulating InscribePlugin)', () => {
    const provider = {
      getFieldGuidance: (fieldName: string): FieldGuidance | null =>
        fieldName === 'name' ? { suggestions: ['from-provider'] } : null,
      getGlobalGuidance: () => ({ qualityStandards: ['from-provider'] }),
    };
    fieldGuidanceRegistry.registerToolProvider(/inscribe.*hashinal/i, provider, {
      id: 'test-provider',
      priority: 1,
    });

    const g = fieldGuidanceRegistry.getFieldGuidance('inscribeHashinal', 'name');
    expect(g?.suggestions).toEqual(['from-provider']);
  });
});
