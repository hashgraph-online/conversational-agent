import { ToolRegistry } from '../../src/core/tool-registry';
import { Logger } from '@hashgraphonline/standards-sdk';
import type { StructuredTool } from '@langchain/core/tools';
import type { ToolRegistrationOptions } from '../../src/core/tool-registry';
import { z } from 'zod';

jest.mock('@hashgraphonline/standards-sdk');

const mockLogger = jest.mocked(Logger);

class MockStructuredTool implements Partial<StructuredTool> {
  name: string;
  description: string;
  schema: any;
  returnDirect = false;
  verboseParsingErrors = false;
  lc_namespace = ['test'];
  _call = jest.fn();

  constructor(name: string, description: string) {
    this.name = name;
    this.description = description;
    this.schema = z.object({});
  }

  async call(input: any): Promise<any> {
    return `result-${this.name}`;
  }

  async invoke(input: any): Promise<any> {
    return this.call(input);
  }
}

describe('ToolRegistry', () => {
  let toolRegistry: ToolRegistry;
  let mockTool1: StructuredTool;
  let mockTool2: StructuredTool;
  let mockTool3: StructuredTool;

  beforeEach(() => {
    jest.clearAllMocks();

    mockTool1 = new MockStructuredTool('test-tool-1', 'Test tool 1 for testing') as unknown as StructuredTool;
    mockTool2 = new MockStructuredTool('test-tool-2', 'Test tool 2 for critical operations') as unknown as StructuredTool;
    mockTool3 = new MockStructuredTool('test-tool-3', 'Test tool 3 for advanced features') as unknown as StructuredTool;

    toolRegistry = new ToolRegistry();
  });

  describe('Constructor', () => {
    it('should create instance with logger', () => {
      expect(toolRegistry).toBeInstanceOf(ToolRegistry);
      expect(mockLogger).toHaveBeenCalledWith({
        module: 'ToolRegistry',
      });
    });
  });

  describe('registerTool', () => {
    it('should register tool with default options', () => {
      toolRegistry.registerTool(mockTool1);

      const tools = toolRegistry.getAllTools();
      expect(tools).toHaveLength(1);
      expect(tools[0]).toBe(mockTool1);
    });

    it('should register tool with custom options', () => {
      const options: ToolRegistrationOptions = {
        metadata: {
          version: '1.0',
          capabilities: {
            priority: 'critical',
            category: 'core',
            supportsFormValidation: true,
            requiresWrapper: false
          }
        },
      };

      toolRegistry.registerTool(mockTool1, options);

      const entries = toolRegistry.getAllRegistryEntries();
      expect(entries[0].metadata.capabilities.priority).toBe('critical');
    });

    it('should not register duplicate tools', () => {
      toolRegistry.registerTool(mockTool1);
      toolRegistry.registerTool(mockTool1);

      const tools = toolRegistry.getAllTools();
      expect(tools).toHaveLength(1);
    });

    it('should handle tool registration with same name', () => {
      const duplicateNameTool = {
        ...mockTool2,
        name: 'test-tool-1',
      } as any;

      toolRegistry.registerTool(mockTool1);
      toolRegistry.registerTool(duplicateNameTool as any);

      const tools = toolRegistry.getAllTools();
      expect(tools).toHaveLength(1);
      expect(tools[0]).toBe(mockTool1);
    });

    it('should register tools with different priorities', () => {
      toolRegistry.registerTool(mockTool1, {
        metadata: { capabilities: { priority: 'low', category: 'core', supportsFormValidation: false, requiresWrapper: false } }
      });
      toolRegistry.registerTool(mockTool2, {
        metadata: { capabilities: { priority: 'critical', category: 'core', supportsFormValidation: true, requiresWrapper: true } }
      });
      toolRegistry.registerTool(mockTool3, {
        metadata: { capabilities: { priority: 'high', category: 'core', supportsFormValidation: false, requiresWrapper: false } }
      });

      const entries = toolRegistry.getAllRegistryEntries();
      const criticalTools = entries.filter(entry => entry.metadata.capabilities.priority === 'critical');
      expect(criticalTools).toHaveLength(1);
      expect(criticalTools[0].tool).toBe(mockTool2);
    });
  });

  describe('unregisterTool', () => {
    beforeEach(() => {
      toolRegistry.registerTool(mockTool1);
      toolRegistry.registerTool(mockTool2);
    });

    it('should unregister tool by name', () => {
      const result = toolRegistry.unregisterTool('test-tool-1');

      expect(result).toBe(true);
      expect(toolRegistry.getAllTools()).toHaveLength(1);
      expect(toolRegistry.getAllTools()[0]).toBe(mockTool2);
    });

    it('should return false for non-existent tool', () => {
      const result = toolRegistry.unregisterTool('non-existent-tool');

      expect(result).toBe(false);
      expect(toolRegistry.getAllTools()).toHaveLength(2);
    });

    it('should handle unregistering from empty registry', () => {
      const emptyRegistry = new ToolRegistry();
      const result = emptyRegistry.unregisterTool('any-tool');

      expect(result).toBe(false);
    });
  });

  describe('getTool', () => {
    beforeEach(() => {
      toolRegistry.registerTool(mockTool1, {
        metadata: { capabilities: { priority: 'high', category: 'core', supportsFormValidation: false, requiresWrapper: false } }
      });
      toolRegistry.registerTool(mockTool2, {
        metadata: { capabilities: { priority: 'critical', category: 'core', supportsFormValidation: true, requiresWrapper: true } }
      });
    });

    it('should get tool by name', () => {
      const entry = toolRegistry.getTool('test-tool-1');

      expect(entry).toBeDefined();
      expect(entry?.options?.priority).toBe('high');
    });

    it('should return undefined for non-existent tool', () => {
      const entry = toolRegistry.getTool('non-existent-tool');

      expect(entry).toBeUndefined();
    });
  });

  describe('getAllTools', () => {
    it('should return empty array for new registry', () => {
      const tools = toolRegistry.getAllTools();

      expect(tools).toEqual([]);
    });

    it('should return all registered tools', () => {
      toolRegistry.registerTool(mockTool1);
      toolRegistry.registerTool(mockTool2);
      toolRegistry.registerTool(mockTool3);

      const tools = toolRegistry.getAllRegistryEntries();

      expect(tools).toHaveLength(3);
      expect(tools.map(t => t.tool.name)).toContain('test-tool-1');
      expect(tools.map(t => t.tool.name)).toContain('test-tool-2');
      expect(tools.map(t => t.tool.name)).toContain('test-tool-3');
    });
  });

  describe('getToolsByPriority', () => {
    beforeEach(() => {
      toolRegistry.registerTool(mockTool1, {
        metadata: { capabilities: { priority: 'low', category: 'core', supportsFormValidation: false, requiresWrapper: false } }
      });
      toolRegistry.registerTool(mockTool2, {
        metadata: { capabilities: { priority: 'critical', category: 'core', supportsFormValidation: true, requiresWrapper: true } }
      });
      toolRegistry.registerTool(mockTool3, {
        metadata: { capabilities: { priority: 'high', category: 'core', supportsFormValidation: false, requiresWrapper: false } }
      });
    });

    it('should get tools by priority', () => {
      const criticalTools = toolRegistry.getToolsByPriority('critical');
      
      expect(criticalTools).toHaveLength(1);
      expect(criticalTools[0].tool).toBe(mockTool2);
    });

    it('should return empty array for non-existent priority', () => {
      const tools = toolRegistry.getToolsByPriority('medium' as any);
      
      expect(tools).toEqual([]);
    });

    it('should get multiple tools with same priority', () => {
      toolRegistry.registerTool({
        ...mockTool1,
        name: 'another-critical-tool',
      } as StructuredTool, {
        metadata: { capabilities: { priority: 'critical', category: 'core', supportsFormValidation: false, requiresWrapper: false } }
      });

      const criticalTools = toolRegistry.getToolsByPriority('critical');
      
      expect(criticalTools).toHaveLength(2);
    });
  });

  describe('getToolsByCapability', () => {
    beforeEach(() => {
      toolRegistry.registerTool(mockTool1, {
        metadata: {
          capabilities: { priority: 'high', category: 'core', supportsFormValidation: true, requiresWrapper: false }
        }
      });
      toolRegistry.registerTool(mockTool2, {
        metadata: {
          capabilities: { priority: 'low', category: 'core', supportsFormValidation: false, requiresWrapper: true }
        }
      });
      toolRegistry.registerTool(mockTool3, {
        metadata: {
          capabilities: { priority: 'critical', category: 'core', supportsFormValidation: true, requiresWrapper: false }
        }
      });
    });

    it('should get tools by capability', () => {
      const coreTools = toolRegistry.getToolsByCapability('category', 'core');

      expect(coreTools.length).toBeGreaterThan(0);
      expect(coreTools.map(t => t.tool.name)).toContain('test-tool-1');
    });

    it('should get tools by capability and priority', () => {
      const criticalInscriptionTools = toolRegistry.getToolsByCapability('priority', 'critical');
      
      expect(criticalInscriptionTools).toHaveLength(1);
      expect(criticalInscriptionTools[0]).toBe(mockTool3);
    });

    it('should return empty array for non-existent capability', () => {
      const tools = toolRegistry.getToolsByCapability('priority' as any, 'non-existent');
      
      expect(tools).toEqual([]);
    });
  });

  describe('getEnabledTools', () => {
    beforeEach(() => {
      toolRegistry.registerTool(mockTool1, {
        metadata: { capabilities: { priority: 'high', category: 'core', supportsFormValidation: true, requiresWrapper: false } }
      });
      toolRegistry.registerTool(mockTool2, {
        metadata: { capabilities: { priority: 'high', category: 'core', supportsFormValidation: false, requiresWrapper: false } }
      });
      toolRegistry.registerTool(mockTool3);
    });

    it('should return only enabled tools', () => {
      const enabledTools = toolRegistry.getEnabledTools();
      
      expect(enabledTools).toHaveLength(2);
      expect(enabledTools.map(t => t.tool.name)).toContain('test-tool-1');
      expect(enabledTools.map(t => t.tool.name)).toContain('test-tool-3');
      expect(enabledTools.map(t => t.tool.name)).not.toContain('test-tool-2');
    });

    it('should return empty array when no tools are enabled', () => {
      const disabledRegistry = new ToolRegistry();
      disabledRegistry.registerTool(mockTool1, {
        metadata: { capabilities: { priority: 'high', category: 'core', supportsFormValidation: false, requiresWrapper: false } }
      });
      disabledRegistry.registerTool(mockTool2, {
        metadata: { capabilities: { priority: 'high', category: 'core', supportsFormValidation: false, requiresWrapper: false } }
      });

      const enabledTools = disabledRegistry.getEnabledTools();
      
      expect(enabledTools).toEqual([]);
    });
  });

  describe('getToolsByNamespace', () => {
    beforeEach(() => {
      toolRegistry.registerTool(mockTool1, {
        metadata: { capabilities: { priority: 'high', category: 'core', supportsFormValidation: false, requiresWrapper: false } }
      });
      toolRegistry.registerTool(mockTool2, {
        metadata: { capabilities: { priority: 'high', category: 'core', supportsFormValidation: false, requiresWrapper: false } }
      });
      toolRegistry.registerTool(mockTool3);
    });

    it('should get tools by namespace', () => {
      const hederaTools = toolRegistry.getToolsByNamespace('hedera');
      
      expect(hederaTools).toHaveLength(1);
      expect(hederaTools[0].tool).toBe(mockTool1);
    });

    it('should return empty array for non-existent namespace', () => {
      const tools = toolRegistry.getToolsByNamespace('non-existent');
      
      expect(tools).toEqual([]);
    });

    it('should handle tools without namespace', () => {
      const noNamespaceTools = toolRegistry.getToolsByNamespace(undefined);
      
      expect(noNamespaceTools).toHaveLength(1);
      expect(noNamespaceTools[0].tool).toBe(mockTool3);
    });
  });

  describe('hasCapability', () => {
    beforeEach(() => {
      toolRegistry.registerTool(mockTool1, {
        metadata: { capabilities: { priority: 'high', category: 'core', supportsFormValidation: false, requiresWrapper: false } }
      });
      toolRegistry.registerTool(mockTool2, {
        metadata: { capabilities: { priority: 'high', category: 'core', supportsFormValidation: false, requiresWrapper: false } }
      });
    });

    it('should return true for existing capability', () => {
      const result = toolRegistry.hasCapability('priority' as any);
      
      expect(result).toBe(true);
    });

    it('should return false for non-existent capability', () => {
      const result = toolRegistry.hasCapability('category' as any);
      
      expect(result).toBe(false);
    });

    it('should return false for empty registry', () => {
      const emptyRegistry = new ToolRegistry();
      const result = emptyRegistry.hasCapability('priority' as any);
      
      expect(result).toBe(false);
    });
  });

  describe('updateToolOptions', () => {
    beforeEach(() => {
      toolRegistry.registerTool(mockTool1, { 
        priority: 'low',
        capability: 'basic',
        enabled: true 
      });
    });

    it('should update tool options', () => {
      const newOptions = { 
        priority: 'critical' as const,
        capability: 'advanced',
        enabled: false 
      };

      const result = toolRegistry.updateToolOptions('test-tool-1', newOptions);

      expect(result).toBe(true);
      
      const tool = toolRegistry.getTool('test-tool-1');
      expect(tool?.options.priority).toBe('critical');
      expect(tool?.options.capability).toBe('advanced');
      expect(tool?.options.enabled).toBe(false);
    });

    it('should return false for non-existent tool', () => {
      const result = toolRegistry.updateToolOptions('non-existent-tool', {});

      expect(result).toBe(false);
    });

    it('should partially update options', () => {
      const partialOptions = { priority: 'high' as const };

      toolRegistry.updateToolOptions('test-tool-1', partialOptions);

      const tool = toolRegistry.getTool('test-tool-1');
      expect(tool?.options.priority).toBe('high');
      expect(tool?.options.capability).toBe('basic');
      expect(tool?.options.enabled).toBe(true);
    });
  });

  describe('clear', () => {
    beforeEach(() => {
      toolRegistry.registerTool(mockTool1);
      toolRegistry.registerTool(mockTool2);
      toolRegistry.registerTool(mockTool3);
    });

    it('should clear all registered tools', () => {
      toolRegistry.clear();

      const tools = toolRegistry.getAllTools();
      expect(tools).toEqual([]);
    });

    it('should allow registration after clearing', () => {
      toolRegistry.clear();
      toolRegistry.registerTool(mockTool1);

      const tools = toolRegistry.getAllTools();
      expect(tools).toHaveLength(1);
      expect(tools[0].tool).toBe(mockTool1);
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('should handle null tool registration', () => {
      expect(() => toolRegistry.registerTool(null as any)).not.toThrow();
      expect(toolRegistry.getAllTools()).toHaveLength(0);
    });

    it('should handle undefined tool registration', () => {
      expect(() => toolRegistry.registerTool(undefined as any)).not.toThrow();
      expect(toolRegistry.getAllTools()).toHaveLength(0);
    });

    it('should handle tool with empty name', () => {
      const emptyNameTool = { ...mockTool1, name: '' };
      
      toolRegistry.registerTool(emptyNameTool as StructuredTool);
      
      const tools = toolRegistry.getAllTools();
      expect(tools).toHaveLength(0);
    });

    it('should handle very long tool names', () => {
      const longNameTool = { ...mockTool1, name: 'a'.repeat(1000) };
      
      toolRegistry.registerTool(longNameTool as StructuredTool);
      
      const tool = toolRegistry.getTool('a'.repeat(1000));
      expect(tool?.tool).toBe(longNameTool);
    });

    it('should handle special characters in tool names', () => {
      const specialNameTool = { ...mockTool1, name: 'tool@#$%^&*()' };
      
      toolRegistry.registerTool(specialNameTool as StructuredTool);
      
      const tool = toolRegistry.getTool('tool@#$%^&*()');
      expect(tool?.tool).toBe(specialNameTool);
    });
  });
});