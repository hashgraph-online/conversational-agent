import { ToolRegistry } from '../../src/core/tool-registry';
import { Logger } from '@hashgraphonline/standards-sdk';
import type { StructuredTool } from '@langchain/core/tools';
import type { ToolRegistrationOptions } from '../../src/core/tool-registry';

jest.mock('@hashgraphonline/standards-sdk');

const mockLogger = jest.mocked(Logger);

describe('ToolRegistry', () => {
  let toolRegistry: ToolRegistry;
  let mockTool1: StructuredTool;
  let mockTool2: StructuredTool;
  let mockTool3: StructuredTool;

  beforeEach(() => {
    jest.clearAllMocks();

    mockTool1 = {
      name: 'test-tool-1',
      description: 'Test tool 1 for testing',
      call: jest.fn().mockResolvedValue('result1'),
      schema: {} as any,
    } as StructuredTool;

    mockTool2 = {
      name: 'test-tool-2',
      description: 'Test tool 2 for critical operations',
      call: jest.fn().mockResolvedValue('result2'),
      schema: {} as any,
    } as StructuredTool;

    mockTool3 = {
      name: 'test-tool-3',
      description: 'Test tool 3 for advanced features',
      call: jest.fn().mockResolvedValue('result3'),
      schema: {} as any,
    } as StructuredTool;

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
      expect(tools[0].tool).toBe(mockTool1);
    });

    it('should register tool with custom options', () => {
      const options: ToolRegistrationOptions = {
        priority: 'critical',
        capability: 'inscription',
        namespace: 'hedera',
        enabled: true,
        metadata: { version: '1.0' },
      };

      toolRegistry.registerTool(mockTool1, options);

      const tools = toolRegistry.getAllTools();
      expect(tools[0].options).toEqual(options);
    });

    it('should not register duplicate tools', () => {
      toolRegistry.registerTool(mockTool1);
      toolRegistry.registerTool(mockTool1); // Attempt duplicate

      const tools = toolRegistry.getAllTools();
      expect(tools).toHaveLength(1);
    });

    it('should handle tool registration with same name', () => {
      const duplicateNameTool = {
        ...mockTool2,
        name: 'test-tool-1', // Same name as mockTool1
      };

      toolRegistry.registerTool(mockTool1);
      toolRegistry.registerTool(duplicateNameTool);

      // Should only register the first one
      const tools = toolRegistry.getAllTools();
      expect(tools).toHaveLength(1);
      expect(tools[0].tool).toBe(mockTool1);
    });

    it('should register tools with different priorities', () => {
      toolRegistry.registerTool(mockTool1, { priority: 'low' });
      toolRegistry.registerTool(mockTool2, { priority: 'critical' });
      toolRegistry.registerTool(mockTool3, { priority: 'high' });

      const criticalTools = toolRegistry.getToolsByPriority('critical');
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
      expect(toolRegistry.getAllTools()[0].tool).toBe(mockTool2);
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
      toolRegistry.registerTool(mockTool1, { priority: 'high' });
      toolRegistry.registerTool(mockTool2, { priority: 'critical' });
    });

    it('should get tool by name', () => {
      const entry = toolRegistry.getTool('test-tool-1');

      expect(entry).toBeDefined();
      expect(entry?.tool).toBe(mockTool1);
      expect(entry?.options.priority).toBe('high');
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

      const tools = toolRegistry.getAllTools();
      
      expect(tools).toHaveLength(3);
      expect(tools.map(t => t.tool.name)).toContain('test-tool-1');
      expect(tools.map(t => t.tool.name)).toContain('test-tool-2');
      expect(tools.map(t => t.tool.name)).toContain('test-tool-3');
    });
  });

  describe('getToolsByPriority', () => {
    beforeEach(() => {
      toolRegistry.registerTool(mockTool1, { priority: 'low' });
      toolRegistry.registerTool(mockTool2, { priority: 'critical' });
      toolRegistry.registerTool(mockTool3, { priority: 'high' });
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
      } as StructuredTool, { priority: 'critical' });

      const criticalTools = toolRegistry.getToolsByPriority('critical');
      
      expect(criticalTools).toHaveLength(2);
    });
  });

  describe('getToolsByCapability', () => {
    beforeEach(() => {
      toolRegistry.registerTool(mockTool1, { capability: 'inscription', priority: 'high' });
      toolRegistry.registerTool(mockTool2, { capability: 'token', priority: 'low' });
      toolRegistry.registerTool(mockTool3, { capability: 'inscription', priority: 'critical' });
    });

    it('should get tools by capability', () => {
      const inscriptionTools = toolRegistry.getToolsByCapability('capability', 'inscription');
      
      expect(inscriptionTools).toHaveLength(2);
      expect(inscriptionTools.map(t => t.tool.name)).toContain('test-tool-1');
      expect(inscriptionTools.map(t => t.tool.name)).toContain('test-tool-3');
    });

    it('should get tools by capability and priority', () => {
      const criticalInscriptionTools = toolRegistry.getToolsByCapability('priority', 'critical');
      
      expect(criticalInscriptionTools).toHaveLength(1);
      expect(criticalInscriptionTools[0].tool).toBe(mockTool3);
    });

    it('should return empty array for non-existent capability', () => {
      const tools = toolRegistry.getToolsByCapability('capability', 'non-existent');
      
      expect(tools).toEqual([]);
    });
  });

  describe('getEnabledTools', () => {
    beforeEach(() => {
      toolRegistry.registerTool(mockTool1, { enabled: true });
      toolRegistry.registerTool(mockTool2, { enabled: false });
      toolRegistry.registerTool(mockTool3); // Default enabled
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
      disabledRegistry.registerTool(mockTool1, { enabled: false });
      disabledRegistry.registerTool(mockTool2, { enabled: false });

      const enabledTools = disabledRegistry.getEnabledTools();
      
      expect(enabledTools).toEqual([]);
    });
  });

  describe('getToolsByNamespace', () => {
    beforeEach(() => {
      toolRegistry.registerTool(mockTool1, { namespace: 'hedera' });
      toolRegistry.registerTool(mockTool2, { namespace: 'inscription' });
      toolRegistry.registerTool(mockTool3); // No namespace
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
      toolRegistry.registerTool(mockTool1, { capability: 'inscription' });
      toolRegistry.registerTool(mockTool2, { capability: 'token' });
    });

    it('should return true for existing capability', () => {
      const result = toolRegistry.hasCapability('inscription');
      
      expect(result).toBe(true);
    });

    it('should return false for non-existent capability', () => {
      const result = toolRegistry.hasCapability('non-existent');
      
      expect(result).toBe(false);
    });

    it('should return false for empty registry', () => {
      const emptyRegistry = new ToolRegistry();
      const result = emptyRegistry.hasCapability('any-capability');
      
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
      expect(tool?.options.capability).toBe('basic'); // Should remain unchanged
      expect(tool?.options.enabled).toBe(true); // Should remain unchanged
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