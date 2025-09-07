import { describe, test, expect, jest, beforeEach } from '@jest/globals';
import { z } from 'zod';
import { Logger } from '@hashgraphonline/standards-sdk';
import { StructuredTool } from '@langchain/core/tools';
import {
  ToolRegistry,
  ToolCapabilities,
  ToolMetadata,
  ToolRegistryEntry,
  ToolRegistrationOptions,
  ToolQuery,
  EntityResolutionPreferences,
} from '../../../src/core/tool-registry';

jest.mock('@hashgraphonline/standards-sdk', () => ({
  Logger: jest.fn().mockImplementation(() => ({
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  })),
}));

jest.mock('../../../src/forms/form-generator', () => ({
  FormGenerator: jest.fn().mockImplementation(() => ({
    generateForm: jest.fn(),
    processSubmission: jest.fn(),
  })),
}));

jest.mock('../../../src/langchain/form-validating-tool-wrapper', () => ({
  FormValidatingToolWrapper: jest.fn(),
  wrapToolWithFormValidation: jest.fn().mockReturnValue({
    name: 'wrapped-tool',
    description: 'wrapped description',
    schema: {},
    func: jest.fn(),
  }),
}));

jest.mock('@hashgraphonline/standards-agent-kit', () => ({
  isFormValidatable: jest.fn().mockReturnValue(false),
}));

const { isFormValidatable } = require('@hashgraphonline/standards-agent-kit');
const { wrapToolWithFormValidation } = require('../../../src/langchain/form-validating-tool-wrapper');

describe('ToolRegistry', () => {
  let registry: ToolRegistry;
  let mockLogger: jest.Mocked<Logger>;
  let mockTool: StructuredTool;
  let mockZodObjectTool: StructuredTool;
  let mockFormValidatableTool: StructuredTool & { shouldGenerateForm?: () => boolean };

  beforeEach(() => {
    jest.clearAllMocks();
    
    mockLogger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    } as unknown as jest.Mocked<Logger>;

    registry = new ToolRegistry(mockLogger);

    mockTool = {
      name: 'test-tool',
      description: 'A test tool',
      schema: z.object({ input: z.string() }),
      func: jest.fn(),
    } as StructuredTool;

    mockZodObjectTool = {
      name: 'zod-tool',
      description: 'A ZodObject tool',
      schema: z.object({
        input: z.string(),
        metadata: z.array(z.string()),
      }),
      func: jest.fn(),
    } as StructuredTool;

    mockFormValidatableTool = {
      name: 'form-tool',
      description: 'A form validatable tool',
      schema: z.object({ data: z.string() }),
      func: jest.fn(),
      shouldGenerateForm: jest.fn().mockReturnValue(true),
    } as StructuredTool & { shouldGenerateForm?: () => boolean };
  });

  describe('constructor', () => {
    test('should initialize with provided logger', () => {
      const customLogger = new Logger({ module: 'Test' });
      const customRegistry = new ToolRegistry(customLogger);
      
      expect(customRegistry).toBeDefined();
    });

    test('should initialize with default logger when none provided', () => {
      const defaultRegistry = new ToolRegistry();
      
      expect(defaultRegistry).toBeDefined();
      expect(Logger).toHaveBeenCalledWith({ module: 'ToolRegistry' });
    });
  });

  describe('registerTool', () => {
    test('should register a basic tool with default options', () => {
      registry.registerTool(mockTool);
      
      expect(registry.hasTool('test-tool')).toBe(true);
      const entry = registry.getTool('test-tool');
      expect(entry).not.toBeNull();
      expect(entry!.metadata.name).toBe('test-tool');
      expect(entry!.metadata.category).toBe('core');
      expect(entry!.metadata.version).toBe('1.0.0');
    });

    test('should register tool with custom metadata', () => {
      const options: ToolRegistrationOptions = {
        metadata: {
          category: 'extension',
          version: '2.0.0',
          description: 'Custom description',
        },
      };
      
      registry.registerTool(mockTool, options);
      
      const entry = registry.getTool('test-tool')!;
      expect(entry.metadata.category).toBe('extension');
      expect(entry.metadata.version).toBe('2.0.0');
      expect(entry.metadata.description).toBe('Custom description');
    });

    test('should identify when tools should be wrapped', () => {
      (isFormValidatable as jest.Mock).mockReturnValue(true);
      
      const zodTool = {
        ...mockFormValidatableTool,
        schema: z.object({ data: z.string() }),
      };
      
      registry.registerTool(zodTool);
      
      const entry = registry.getTool('form-tool')!;
      expect(entry).toBeDefined();
      expect(entry.metadata.capabilities.supportsFormValidation).toBe(true);
    });

    test('should handle forceWrapper option', () => {
      const options: ToolRegistrationOptions = {
        forceWrapper: true,
      };
      
      registry.registerTool(mockTool, options);
      
      const entry = registry.getTool('test-tool')!;
      expect(entry).toBeDefined();
      expect(entry.metadata.name).toBe('test-tool');
    });

    test('should skip wrapper when skipWrapper option is true', () => {
      (isFormValidatable as jest.Mock).mockReturnValue(true);
      
      const options: ToolRegistrationOptions = {
        skipWrapper: true,
      };
      
      registry.registerTool(mockFormValidatableTool, options);
      
      expect(wrapToolWithFormValidation).not.toHaveBeenCalled();
      const entry = registry.getTool('form-tool')!;
      expect(entry.wrapper).toBeUndefined();
    });

    test('should extract entity resolution preferences from schema', () => {
      const schemaWithPrefs = {
        ...mockTool.schema,
        _entityResolutionPreferences: {
          inscription: 'hrl' as const,
          token: 'tokenId' as const,
        },
      };
      
      const toolWithPrefs = {
        ...mockTool,
        schema: schemaWithPrefs,
      };
      
      registry.registerTool(toolWithPrefs);
      
      const entry = registry.getTool('test-tool')!;
      expect(entry.metadata.entityResolutionPreferences).toEqual({
        inscription: 'hrl',
        token: 'tokenId',
      });
    });

    test('should add hashlink note to inscription tools', () => {
      const inscriptionTool = {
        ...mockZodObjectTool,
        name: 'inscription-tool',
        description: 'Tool for inscriptions',
      };
      
      registry.registerTool(inscriptionTool);
      
      const entry = registry.getTool('inscription-tool')!;
      expect(entry.tool.description).toContain('Hashlink Resource Locators');
    });

    test('should not duplicate hashlink note', () => {
      const inscriptionTool = {
        ...mockZodObjectTool,
        name: 'inscription-tool',
        description: 'Tool for inscriptions. NOTE: When referencing inscriptions or media, provide canonical Hashlink Resource Locators',
      };
      
      registry.registerTool(inscriptionTool);
      
      const entry = registry.getTool('inscription-tool')!;
      const noteCount = (entry.tool.description.match(/Hashlink Resource Locators/g) || []).length;
      expect(noteCount).toBe(1);
    });

    test('should handle schema parsing errors gracefully', () => {
      const toolWithBadSchema = {
        ...mockTool,
        schema: { invalid: 'schema' },
      };
      
      expect(() => registry.registerTool(toolWithBadSchema)).not.toThrow();
      expect(registry.hasTool('test-tool')).toBe(true);
    });
  });

  describe('getTool', () => {
    beforeEach(() => {
      registry.registerTool(mockTool);
    });

    test('should return tool entry when tool exists', () => {
      const entry = registry.getTool('test-tool');
      
      expect(entry).not.toBeNull();
      expect(entry!.metadata.name).toBe('test-tool');
    });

    test('should return null when tool does not exist', () => {
      const entry = registry.getTool('non-existent-tool');
      
      expect(entry).toBeNull();
    });
  });

  describe('getToolsByCapability', () => {
    beforeEach(() => {
      registry.registerTool(mockTool);
      registry.registerTool({
        ...mockTool,
        name: 'high-priority-tool',
      });
      
      (isFormValidatable as jest.Mock).mockReturnValue(true);
      registry.registerTool(mockFormValidatableTool);
    });

    test('should find tools by capability value', () => {
      const tools = registry.getToolsByCapability('priority', 'critical');
      
      expect(tools.length).toBeGreaterThan(0);
      expect(tools.every(t => t.metadata.capabilities.priority === 'critical')).toBe(true);
    });

    test('should find tools with any truthy capability value', () => {
      const tools = registry.getToolsByCapability('supportsFormValidation');
      
      expect(tools.length).toBeGreaterThan(0);
      expect(tools.every(t => t.metadata.capabilities.supportsFormValidation)).toBe(true);
    });
  });

  describe('getToolsByQuery', () => {
    beforeEach(() => {
      registry.clear();
      registry.registerTool(mockTool);
      registry.registerTool({
        ...mockTool,
        name: 'extension-tool',
      }, { metadata: { category: 'extension' } });
    });

    test('should find tools by name', () => {
      const query: ToolQuery = { name: 'test-tool' };
      const tools = registry.getToolsByQuery(query);
      
      expect(tools).toHaveLength(1);
      expect(tools[0].metadata.name).toBe('test-tool');
    });

    test('should find tools by category', () => {
      const query: ToolQuery = { category: 'extension' };
      const tools = registry.getToolsByQuery(query);
      
      expect(tools).toHaveLength(1);
      expect(tools[0].metadata.name).toBe('extension-tool');
    });

    test('should find tools by capabilities', () => {
      const query: ToolQuery = { 
        capabilities: { 
          supportsFormValidation: false
        } 
      };
      const tools = registry.getToolsByQuery(query);
      
      expect(tools.length).toBeGreaterThanOrEqual(0);
      tools.forEach(tool => {
        expect(tool.metadata.capabilities.supportsFormValidation).toBe(false);
      });
    });

    test('should return empty array when no matches', () => {
      const query: ToolQuery = { name: 'non-existent' };
      const tools = registry.getToolsByQuery(query);
      
      expect(tools).toHaveLength(0);
    });
  });

  describe('getAllTools', () => {
    test('should return all tool instances', () => {
      registry.registerTool(mockTool);
      registry.registerTool({ ...mockTool, name: 'tool2' });
      
      const tools = registry.getAllTools();
      
      expect(tools).toHaveLength(2);
      expect(tools.every(t => t && typeof t === 'object' && 'name' in t)).toBe(true);
    });

    test('should return empty array when no tools registered', () => {
      const tools = registry.getAllTools();
      
      expect(tools).toHaveLength(0);
    });
  });

  describe('getAllRegistryEntries', () => {
    test('should return all registry entries', () => {
      registry.registerTool(mockTool);
      registry.registerTool({ ...mockTool, name: 'tool2' });
      
      const entries = registry.getAllRegistryEntries();
      
      expect(entries).toHaveLength(2);
      expect(entries.every(e => 'tool' in e && 'metadata' in e)).toBe(true);
    });
  });

  describe('getToolNames', () => {
    test('should return all tool names', () => {
      registry.registerTool(mockTool);
      registry.registerTool({ ...mockTool, name: 'tool2' });
      
      const names = registry.getToolNames();
      
      expect(names).toHaveLength(2);
      expect(names).toContain('test-tool');
      expect(names).toContain('tool2');
    });
  });

  describe('hasTool', () => {
    beforeEach(() => {
      registry.registerTool(mockTool);
    });

    test('should return true for registered tool', () => {
      expect(registry.hasTool('test-tool')).toBe(true);
    });

    test('should return false for unregistered tool', () => {
      expect(registry.hasTool('non-existent')).toBe(false);
    });
  });

  describe('unregisterTool', () => {
    beforeEach(() => {
      registry.registerTool(mockTool);
    });

    test('should remove registered tool and return true', () => {
      expect(registry.hasTool('test-tool')).toBe(true);
      
      const result = registry.unregisterTool('test-tool');
      
      expect(result).toBe(true);
      expect(registry.hasTool('test-tool')).toBe(false);
    });

    test('should return false when tool does not exist', () => {
      const result = registry.unregisterTool('non-existent');
      
      expect(result).toBe(false);
    });
  });

  describe('clear', () => {
    test('should remove all tools', () => {
      registry.registerTool(mockTool);
      registry.registerTool({ ...mockTool, name: 'tool2' });
      
      expect(registry.getAllTools()).toHaveLength(2);
      
      registry.clear();
      
      expect(registry.getAllTools()).toHaveLength(0);
    });
  });

  describe('getStatistics', () => {
    beforeEach(() => {
      registry.registerTool(mockTool);
      registry.registerTool({ ...mockTool, name: 'tool2' }, { metadata: { category: 'extension' } });
      
      (isFormValidatable as jest.Mock).mockReturnValue(true);
      registry.registerTool(mockFormValidatableTool);
    });

    test('should return correct statistics', () => {
      const stats = registry.getStatistics();
      
      expect(stats.totalTools).toBe(3);
      expect(stats.wrappedTools).toBeGreaterThanOrEqual(0);
      expect(stats.unwrappedTools).toBeGreaterThanOrEqual(0);
      expect(stats.wrappedTools + stats.unwrappedTools).toBe(3);
      expect(stats.categoryCounts).toHaveProperty('core');
      expect(stats.categoryCounts).toHaveProperty('extension');
      expect(stats.categoryCounts).toHaveProperty('mcp');
      expect(stats.priorityCounts).toHaveProperty('low');
      expect(stats.priorityCounts).toHaveProperty('medium');
      expect(stats.priorityCounts).toHaveProperty('high');
      expect(stats.priorityCounts).toHaveProperty('critical');
    });
  });

  describe('analyzeToolCapabilities (private method through registration)', () => {
    test('should identify form validatable tools', () => {
      (isFormValidatable as jest.Mock).mockReturnValue(true);
      
      registry.registerTool(mockFormValidatableTool);
      
      const entry = registry.getTool('form-tool')!;
      expect(entry.metadata.capabilities.supportsFormValidation).toBe(true);
    });

    test('should identify tools with render config', () => {
      const toolWithRenderConfig = {
        ...mockTool,
        schema: { _renderConfig: { type: 'form' } },
      };
      
      registry.registerTool(toolWithRenderConfig);
      
      const entry = registry.getTool('test-tool')!;
      expect(entry.metadata.capabilities.supportsFormValidation).toBe(true);
    });

    test('should analyze tool capabilities correctly', () => {
      const queryTool = {
        ...mockTool,
        name: 'query-tool',
        description: 'A tool for querying data',
      };
      
      registry.registerTool(queryTool);
      
      const entry = registry.getTool('query-tool')!;
      expect(entry.metadata.capabilities).toBeDefined();
      expect(typeof entry.metadata.capabilities.priority).toBe('string');
    });

    test('should categorize tools correctly', () => {
      const testTool = {
        ...mockTool,
        name: 'categorized-tool',
      };
      
      registry.registerTool(testTool);
      
      const entry = registry.getTool('categorized-tool')!;
      expect(entry.metadata.category).toBeDefined();
      expect(['core', 'extension', 'mcp']).toContain(entry.metadata.category);
    });

    test('should handle tools with different schema types', () => {
      const schemas = [
        null,
        undefined,
        'string-schema',
        { _def: { typeName: 'ZodObject', shape: {} } },
        z.object({ test: z.string() }),
      ];
      
      schemas.forEach((schema, index) => {
        const tool = {
          ...mockTool,
          name: `schema-test-tool-${index}`,
          schema,
        };
        
        expect(() => registry.registerTool(tool)).not.toThrow();
        expect(registry.hasTool(`schema-test-tool-${index}`)).toBe(true);
      });
    });
  });

  describe('isZodObjectLike (private method through registration)', () => {
    test('should identify ZodObject instances', () => {
      const zodObjectTool = {
        ...mockTool,
        schema: z.object({ test: z.string() }),
      };
      
      registry.registerTool(zodObjectTool);
      
      const entry = registry.getTool('test-tool')!;
      expect(entry.originalTool).toBeDefined();
    });

    test('should handle non-object schemas', () => {
      const stringTool = {
        ...mockTool,
        schema: 'not an object',
      };
      
      expect(() => registry.registerTool(stringTool)).not.toThrow();
    });

    test('should handle null schemas', () => {
      const nullSchemaTool = {
        ...mockTool,
        schema: null,
      };
      
      expect(() => registry.registerTool(nullSchemaTool)).not.toThrow();
    });
  });
});