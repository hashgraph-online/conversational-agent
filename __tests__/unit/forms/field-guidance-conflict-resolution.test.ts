import { fieldGuidanceRegistry } from '../../../src/forms/field-guidance-registry';
import type { FieldGuidance, ToolFieldConfiguration } from '../../../src/forms/field-guidance-registry';

describe('Field Guidance Provider - Conflict Resolution', () => {
  beforeEach(() => {
    fieldGuidanceRegistry.clear();
    process.env.CA_FORM_GUIDANCE_ENABLED = 'true';
  });

  it('applies higher priority provider overrides; lower priority fills gaps; static fills remaining', () => {
    const staticConfig: ToolFieldConfiguration = {
      toolPattern: /inscribe.*hashinal/i,
      fields: {
        name: {
          suggestions: ['static-suggestion'],
          contextualHelpText: 'static-help',
        },
      },
      globalGuidance: { qualityStandards: ['static-quality'] },
    };
    fieldGuidanceRegistry.registerToolConfiguration(staticConfig);

    const lowPriorityProvider = {
      getFieldGuidance: (fieldName: string): FieldGuidance | null =>
        fieldName === 'name' ? { fieldTypeOverride: 'textarea' } : null,
    };
    const highPriorityProvider = {
      getFieldGuidance: (fieldName: string): FieldGuidance | null =>
        fieldName === 'name' ? { suggestions: ['provider-suggestion'] } : null,
    };

    fieldGuidanceRegistry.registerToolProvider(/inscribe.*hashinal/i, lowPriorityProvider, {
      id: 'lp',
      priority: 0,
    });
    fieldGuidanceRegistry.registerToolProvider(/inscribe.*hashinal/i, highPriorityProvider, {
      id: 'hp',
      priority: 10,
    });

    const guidance = fieldGuidanceRegistry.getFieldGuidance('inscribeHashinal', 'name');
    expect(guidance).not.toBeNull();
    expect(guidance?.suggestions).toEqual(['provider-suggestion']);
    expect(guidance?.fieldTypeOverride).toBe('textarea');
    expect(guidance?.contextualHelpText).toBe('static-help');
  });

  it('last-in wins when priorities are equal', () => {
    const providerA = {
      getFieldGuidance: (fieldName: string): FieldGuidance | null =>
        fieldName === 'name' ? { suggestions: ['A'] } : null,
    };
    const providerB = {
      getFieldGuidance: (fieldName: string): FieldGuidance | null =>
        fieldName === 'name' ? { suggestions: ['B'] } : null,
    };

    fieldGuidanceRegistry.registerToolProvider(/inscribe.*hashinal/i, providerA, { id: 'pa', priority: 1 });
    fieldGuidanceRegistry.registerToolProvider(/inscribe.*hashinal/i, providerB, { id: 'pb', priority: 1 });

    const guidance = fieldGuidanceRegistry.getFieldGuidance('inscribeHashinal', 'name');
    expect(guidance?.suggestions).toEqual(['B']);
  });
});

