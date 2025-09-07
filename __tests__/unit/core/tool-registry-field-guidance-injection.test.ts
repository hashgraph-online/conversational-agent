import { z } from 'zod';
import { StructuredTool } from '@langchain/core/tools';
import { ToolRegistry } from '../../../src/core/tool-registry';
import { fieldGuidanceRegistry } from '../../../src/forms/field-guidance-registry';
import type { FieldGuidance, ToolFieldConfiguration } from '../../../src/forms/field-guidance-registry';

class DummyTool extends StructuredTool<typeof schema> {
  name = 'dummy-tool';
  description = 'A dummy tool for testing';
  schema = z.object({
    foo: z.string(),
  });

  async _call(): Promise<string> {
    return 'ok';
  }
}

const schema = z.object({ foo: z.string() });

describe('ToolRegistry - Field Guidance Injection', () => {
  beforeEach(() => {
    fieldGuidanceRegistry.clear();
  });

  it('forwards static fieldGuidance metadata to registry', () => {
    const registry = new ToolRegistry();
    const tool = new DummyTool();

    const staticConfig: ToolFieldConfiguration = {
      toolPattern: 'dummy-tool',
      fields: {
        foo: { suggestions: ['static-suggestion'] },
      },
    };

    registry.registerTool(tool, {
      metadata: {
        fieldGuidance: staticConfig,
      },
    });

    const g = fieldGuidanceRegistry.getFieldGuidance('dummy-tool', 'foo');
    expect(g?.suggestions).toEqual(['static-suggestion']);
  });

  it('forwards provider metadata and merges provider output over static', () => {
    const registry = new ToolRegistry();
    const tool = new DummyTool();

    const staticConfig: ToolFieldConfiguration = {
      toolPattern: 'dummy-tool',
      fields: {
        foo: { contextualHelpText: 'static-help', suggestions: ['static'] },
      },
    };

    const provider = {
      getFieldGuidance: (fieldName: string): FieldGuidance | null =>
        fieldName === 'foo' ? { suggestions: ['from-provider'] } : null,
    };

    registry.registerTool(tool, {
      metadata: {
        fieldGuidance: staticConfig,
        fieldGuidanceProvider: provider,
      },
    });

    const g = fieldGuidanceRegistry.getFieldGuidance('dummy-tool', 'foo');
    expect(g?.suggestions).toEqual(['from-provider']);
    expect(g?.contextualHelpText).toBe('static-help');
  });
});

