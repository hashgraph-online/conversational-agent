import { jest } from '@jest/globals';
import { fieldGuidanceRegistry } from '../../../src/forms/field-guidance-registry';
import type { FieldGuidance } from '../../../src/forms/field-guidance-registry';

describe('Field Guidance Provider - Lifecycle', () => {
  const ORIGINAL_ENV = process.env.CA_FORM_GUIDANCE_ENABLED;

  beforeEach(() => {
    fieldGuidanceRegistry.clear();
    process.env.CA_FORM_GUIDANCE_ENABLED = 'true';
  });

  afterEach(() => {
    process.env.CA_FORM_GUIDANCE_ENABLED = ORIGINAL_ENV;
  });

  it('registers, lists, and unregisters providers', () => {
    const providerA = {
      getFieldGuidance: (fieldName: string): FieldGuidance | null =>
        fieldName === 'name' ? { suggestions: ['A1'] } : null,
    };
    const providerB = {
      getFieldGuidance: (fieldName: string): FieldGuidance | null =>
        fieldName === 'name' ? { suggestions: ['B1'] } : null,
    };

    const idA = fieldGuidanceRegistry.registerToolProvider(/inscribe.*hashinal/i, providerA, { id: 'provA', priority: 0 });
    const idB = fieldGuidanceRegistry.registerToolProvider(/inscribe.*hashinal/i, providerB, { id: 'provB', priority: 1 });

    const providers = fieldGuidanceRegistry.listProviders();
    expect(providers.map((p) => p.id)).toEqual([idA, idB]);
    expect(providers[0].pattern).toBeInstanceOf(RegExp);

    fieldGuidanceRegistry.unregisterProvider(idA);
    const providersAfter = fieldGuidanceRegistry.listProviders();
    expect(providersAfter.map((p) => p.id)).toEqual([idB]);
  });

  it('resolves provider guidance when static config is absent', () => {
    const provider = {
      getFieldGuidance: (fieldName: string): FieldGuidance | null =>
        fieldName === 'name' ? { suggestions: ['from-provider'] } : null,
    };
    fieldGuidanceRegistry.registerToolProvider(/inscribe.*hashinal/i, provider, { id: 'p1', priority: 1 });

    const g = fieldGuidanceRegistry.getFieldGuidance('inscribeHashinal', 'name');
    expect(g?.suggestions).toEqual(['from-provider']);
  });

  it('returns null when guidance disabled via CA_FORM_GUIDANCE_ENABLED=false', () => {
    const provider = {
      getFieldGuidance: (fieldName: string): FieldGuidance | null =>
        fieldName === 'name' ? { suggestions: ['from-provider'] } : null,
    };
    fieldGuidanceRegistry.registerToolProvider(/inscribe.*hashinal/i, provider, { id: 'p2', priority: 1 });

    process.env.CA_FORM_GUIDANCE_ENABLED = 'false';
    const g = fieldGuidanceRegistry.getFieldGuidance('inscribeHashinal', 'name');
    expect(g).toBeNull();
  });
});

