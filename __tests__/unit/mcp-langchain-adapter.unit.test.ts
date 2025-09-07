import { convertMCPToolToLangChain } from '../../src/mcp/adapters/langchain';
import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import type { MCPToolInfo, MCPServerConfig } from '../../src/mcp/types';
import type { MCPClientManager } from '../../src/mcp/mcp-client-manager';
import { ContentStoreService, shouldUseReference } from '@hashgraphonline/standards-sdk';

jest.mock('@hashgraphonline/standards-sdk', () => ({
  ContentStoreService: {
    getInstance: jest.fn(),
  },
  shouldUseReference: jest.fn(),
}));

const mockContentStoreService = ContentStoreService as jest.Mocked<typeof ContentStoreService>;
const mockShouldUseReference = shouldUseReference as jest.MockedFunction<typeof shouldUseReference>;

describe('MCP LangChain Adapter', () => {
  let mockMCPManager: jest.Mocked<MCPClientManager>;
  let mockContentStore: jest.Mocked<any>;

  const sampleTool: MCPToolInfo = {
    name: 'sample_tool',
    description: 'A sample MCP tool',
    serverName: 'test-server',
    inputSchema: {
      type: 'object',
      properties: {
        param1: {
          type: 'string',
          description: 'First parameter',
        },
        param2: {
          type: 'number',
          description: 'Second parameter',
        },
      },
      required: ['param1'],
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();

    mockMCPManager = {
      executeTool: jest.fn(),
    } as any;

    mockContentStore = {
      storeContent: jest.fn(),
    };

    mockContentStoreService.getInstance.mockReturnValue(mockContentStore);
    mockShouldUseReference.mockReturnValue(false);
  });

  describe('convertMCPToolToLangChain', () => {
    it('should convert basic MCP tool to LangChain tool', () => {
      const langchainTool = convertMCPToolToLangChain(sampleTool, mockMCPManager);

      expect(langchainTool).toBeInstanceOf(DynamicStructuredTool);
      expect(langchainTool.name).toBe('test_server_sample_tool');
      expect(langchainTool.description).toBe('A sample MCP tool');
      expect(langchainTool.schema).toBeDefined();
    });

    it('should sanitize tool names with special characters', () => {
      const toolWithSpecialChars: MCPToolInfo = {
        ...sampleTool,
        name: 'special-tool@name!',
        serverName: 'server.name',
      };

      const langchainTool = convertMCPToolToLangChain(toolWithSpecialChars, mockMCPManager);
      expect(langchainTool.name).toBe('server_name_special_tool_name_');
    });

    it('should enhance description with server config', () => {
      const serverConfig: MCPServerConfig = {
        name: 'test-server',
        command: 'test-cmd',
        toolDescriptions: {
          sample_tool: 'Enhanced description for sample tool',
        },
        additionalContext: 'Additional context information',
      };

      const langchainTool = convertMCPToolToLangChain(sampleTool, mockMCPManager, serverConfig);
      
      expect(langchainTool.description).toContain('Enhanced description for sample tool');
      expect(langchainTool.description).toContain('Additional context information');
    });

    it('should handle missing description gracefully', () => {
      const toolWithoutDescription: MCPToolInfo = {
        ...sampleTool,
        description: undefined,
      };

      const langchainTool = convertMCPToolToLangChain(toolWithoutDescription, mockMCPManager);
      expect(langchainTool.description).toBe('MCP tool sample_tool from test-server');
    });
  });

  describe('tool execution', () => {
    let langchainTool: DynamicStructuredTool;

    beforeEach(() => {
      langchainTool = convertMCPToolToLangChain(sampleTool, mockMCPManager);
    });

    it('should execute tool and return string result', async () => {
      const mockResult = 'Simple string result';
      mockMCPManager.executeTool.mockResolvedValue(mockResult);

      const result = await langchainTool.func({ param1: 'test' });

      expect(mockMCPManager.executeTool).toHaveBeenCalledWith(
        'test-server',
        'sample_tool',
        { param1: 'test' }
      );
      expect(result).toBe(mockResult);
    });

    it('should extract text from MCP content array response', async () => {
      const mockResult = {
        content: [
          { type: 'text', text: 'First text part' },
          { type: 'text', text: 'Second text part' },
          { type: 'other', data: 'ignored' },
        ],
      };
      mockMCPManager.executeTool.mockResolvedValue(mockResult);

      const result = await langchainTool.func({ param1: 'test' });

      expect(result).toBe('First text part\nSecond text part');
    });

    it('should handle content object with non-array content', async () => {
      const mockResult = {
        content: { key: 'value', nested: { data: 'test' } },
      };
      mockMCPManager.executeTool.mockResolvedValue(mockResult);

      const result = await langchainTool.func({ param1: 'test' });

      expect(result).toBe(JSON.stringify(mockResult.content));
    });

    it('should handle non-string, non-content object results', async () => {
      const mockResult = { result: 'success', data: [1, 2, 3] };
      mockMCPManager.executeTool.mockResolvedValue(mockResult);

      const result = await langchainTool.func({ param1: 'test' });

      expect(result).toBe(JSON.stringify(mockResult));
    });

    it('should store large content as reference', async () => {
      const largeContent = 'a'.repeat(15000);
      mockMCPManager.executeTool.mockResolvedValue(largeContent);
      mockContentStore.storeContent.mockResolvedValue('ref-12345');

      const result = await langchainTool.func({ param1: 'test' });

      expect(mockContentStore.storeContent).toHaveBeenCalledWith(
        expect.any(Buffer),
        expect.objectContaining({
          contentType: 'text',
          source: 'mcp',
          mcpToolName: 'test-server_sample_tool',
          originalSize: 15000,
        })
      );
      expect(result).toBe('content-ref:ref-12345');
    });

    it('should store content when shouldUseReference returns true', async () => {
      const content = 'Small but should use reference';
      mockMCPManager.executeTool.mockResolvedValue(content);
      mockShouldUseReference.mockReturnValue(true);
      mockContentStore.storeContent.mockResolvedValue('ref-small');

      const result = await langchainTool.func({ param1: 'test' });

      expect(mockContentStore.storeContent).toHaveBeenCalled();
      expect(result).toBe('content-ref:ref-small');
    });

    it('should fallback to normal response when content store fails', async () => {
      const largeContent = 'a'.repeat(15000);
      mockMCPManager.executeTool.mockResolvedValue(largeContent);
      mockContentStore.storeContent.mockRejectedValue(new Error('Storage failed'));

      const result = await langchainTool.func({ param1: 'test' });

      expect(result).toBe(largeContent);
    });

    it('should handle case when content store is not available', async () => {
      const largeContent = 'a'.repeat(15000);
      mockMCPManager.executeTool.mockResolvedValue(largeContent);
      mockContentStoreService.getInstance.mockReturnValue(null);

      const result = await langchainTool.func({ param1: 'test' });

      expect(result).toBe(largeContent);
    });

    it('should handle tool execution errors', async () => {
      const error = new Error('Tool execution failed');
      mockMCPManager.executeTool.mockRejectedValue(error);

      const result = await langchainTool.func({ param1: 'test' });

      expect(result).toBe('Error executing MCP tool sample_tool: Tool execution failed');
    });

    it('should handle unknown errors', async () => {
      mockMCPManager.executeTool.mockRejectedValue('Unknown error type');

      const result = await langchainTool.func({ param1: 'test' });

      expect(result).toBe('Error executing MCP tool sample_tool: Unknown error');
    });
  });

  describe('JSON Schema to Zod conversion', () => {
    it('should convert string properties', () => {
      const tool: MCPToolInfo = {
        name: 'test',
        serverName: 'server',
        inputSchema: {
          type: 'object',
          properties: {
            stringProp: { type: 'string' },
            enumProp: { type: 'string', enum: ['a', 'b', 'c'] },
          },
          required: ['stringProp'],
        },
      };

      const langchainTool = convertMCPToolToLangChain(tool, mockMCPManager);
      const schema = langchainTool.schema as z.ZodObject<any>;
      
      expect(schema.shape.stringProp).toBeDefined();
      expect(schema.shape.enumProp).toBeDefined();
    });

    it('should convert number properties with constraints', () => {
      const tool: MCPToolInfo = {
        name: 'test',
        serverName: 'server',
        inputSchema: {
          type: 'object',
          properties: {
            numberProp: { type: 'number', minimum: 0, maximum: 100 },
            integerProp: { type: 'integer', minimum: 1 },
          },
        },
      };

      const langchainTool = convertMCPToolToLangChain(tool, mockMCPManager);
      expect(langchainTool.schema).toBeDefined();
    });

    it('should convert boolean properties', () => {
      const tool: MCPToolInfo = {
        name: 'test',
        serverName: 'server',
        inputSchema: {
          type: 'object',
          properties: {
            booleanProp: { type: 'boolean' },
          },
        },
      };

      const langchainTool = convertMCPToolToLangChain(tool, mockMCPManager);
      expect(langchainTool.schema).toBeDefined();
    });

    it('should convert array properties', () => {
      const tool: MCPToolInfo = {
        name: 'test',
        serverName: 'server',
        inputSchema: {
          type: 'object',
          properties: {
            arrayProp: { 
              type: 'array',
              items: { type: 'string' }
            },
            unknownArray: { type: 'array' },
          },
        },
      };

      const langchainTool = convertMCPToolToLangChain(tool, mockMCPManager);
      expect(langchainTool.schema).toBeDefined();
    });

    it('should convert nested objects', () => {
      const tool: MCPToolInfo = {
        name: 'test',
        serverName: 'server',
        inputSchema: {
          type: 'object',
          properties: {
            nestedObject: {
              type: 'object',
              properties: {
                innerProp: { type: 'string' },
              },
            },
            passthroughObject: { type: 'object' },
          },
        },
      };

      const langchainTool = convertMCPToolToLangChain(tool, mockMCPManager);
      expect(langchainTool.schema).toBeDefined();
    });

    it('should handle properties with descriptions', () => {
      const tool: MCPToolInfo = {
        name: 'test',
        serverName: 'server',
        inputSchema: {
          type: 'object',
          properties: {
            describedProp: { 
              type: 'string',
              description: 'This is a described property'
            },
          },
        },
      };

      const langchainTool = convertMCPToolToLangChain(tool, mockMCPManager);
      expect(langchainTool.schema).toBeDefined();
    });

    it('should handle invalid or missing schemas', () => {
      const invalidCases: Array<{ inputSchema: unknown; description: string }> = [
        { inputSchema: null, description: 'null schema' },
        { inputSchema: undefined, description: 'undefined schema' },
        { inputSchema: 'string', description: 'string schema' },
        { inputSchema: {}, description: 'empty object schema' },
        { inputSchema: { type: 'string' }, description: 'non-object type schema' },
        { inputSchema: { type: 'object' }, description: 'object without properties' },
        { inputSchema: { type: 'object', properties: null }, description: 'null properties' },
      ];

      invalidCases.forEach(({ inputSchema, description }) => {
        const tool: MCPToolInfo = {
          name: 'test',
          serverName: 'server',
          inputSchema,
        };

        expect(() => {
          const langchainTool = convertMCPToolToLangChain(tool, mockMCPManager);
          expect(langchainTool.schema).toBeDefined();
        }).not.toThrow(`Should handle ${description}`);
      });
    });

    it('should handle unknown property types', () => {
      const tool: MCPToolInfo = {
        name: 'test',
        serverName: 'server',
        inputSchema: {
          type: 'object',
          properties: {
            unknownProp: { type: 'unknown-type' },
            notypeProp: {},
          },
        },
      };

      const langchainTool = convertMCPToolToLangChain(tool, mockMCPManager);
      expect(langchainTool.schema).toBeDefined();
    });

    it('should handle optional properties correctly', () => {
      const tool: MCPToolInfo = {
        name: 'test',
        serverName: 'server',
        inputSchema: {
          type: 'object',
          properties: {
            required1: { type: 'string' },
            required2: { type: 'string' },
            optional1: { type: 'string' },
            optional2: { type: 'number' },
          },
          required: ['required1', 'required2'],
        },
      };

      const langchainTool = convertMCPToolToLangChain(tool, mockMCPManager);
      const schema = langchainTool.schema as z.ZodObject<any>;
      
      expect(Object.keys(schema.shape)).toHaveLength(4);
    });
  });
});