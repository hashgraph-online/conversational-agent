import { describe, it as _it, expect, beforeEach } from '@jest/globals';
import { z } from 'zod';
import { convertMCPToolToLangChain } from '../../../../src/mcp/adapters/langchain';
import { MCPClientManager as _MCPClientManager } from '../../../../src/mcp/mcp-client-manager';
import type { MCPToolInfo } from '../../../../src/mcp/types';

jest.mock('../../../../src/mcp/mcp-client-manager');

jest.mock('@hashgraphonline/standards-sdk', () => ({
  ContentStoreService: {
    getInstance: jest.fn(),
    setInstance: jest.fn(),
  },
  shouldUseReference: jest.fn(() => false),
}));

interface MockMCPManager {
  executeTool: jest.Mock;
}

const TEST_SERVER_NAME = 'test-server';

describe('LangChain MCP Adapter', () => {
  let mockMCPManager: MockMCPManager;

  beforeEach(() => {
    jest.clearAllMocks();
    mockMCPManager = {
      executeTool: jest.fn(),
    };
  });

  describe('convertMCPToolToLangChain', () => {
    test('should convert a simple MCP tool to LangChain format', async () => {
      const mcpTool: MCPToolInfo = {
        serverName: TEST_SERVER_NAME,
        name: 'test_tool',
        description: 'A test tool',
        inputSchema: {
          type: 'object',
          properties: {
            message: {
              type: 'string',
              description: 'A test message',
            },
          },
          required: ['message'],
        },
      };

      const langchainTool = convertMCPToolToLangChain(mcpTool, mockMCPManager);

      expect(langchainTool.name).toBe('test_server_test_tool');
      expect(langchainTool.description).toBe('A test tool');

      const schema = langchainTool.schema as z.ZodObject<Record<string, z.ZodTypeAny>>;
      expect(schema).toBeDefined();
      expect(schema.parse({ message: 'hello' })).toEqual({ message: 'hello' });
      expect(() => schema.parse({})).toThrow();

      mockMCPManager.executeTool.mockResolvedValueOnce({ result: 'success' });
      const result = await langchainTool.func({ message: 'test' });
      expect(result).toBe('{"result":"success"}');
      expect(mockMCPManager.executeTool).toHaveBeenCalledWith(TEST_SERVER_NAME, 'test_tool', { message: 'test' });
    });

    test('should handle complex nested schemas', async () => {
      const mcpTool: MCPToolInfo = {
        serverName: 'complex-server',
        name: 'complex_tool',
        description: 'A complex tool',
        inputSchema: {
          type: 'object',
          properties: {
            user: {
              type: 'object',
              properties: {
                name: { type: 'string' },
                age: { type: 'number' },
                tags: {
                  type: 'array',
                  items: { type: 'string' },
                },
              },
              required: ['name'],
            },
            settings: {
              type: 'object',
              properties: {
                enabled: { type: 'boolean' },
                level: { type: 'number' },
              },
            },
          },
          required: ['user'],
        },
      };

      const langchainTool = convertMCPToolToLangChain(mcpTool, mockMCPManager);
      const schema = langchainTool.schema as z.ZodObject<Record<string, z.ZodTypeAny>>;

      const validInput = {
        user: {
          name: 'John',
          age: 30,
          tags: ['dev', 'test'],
        },
        settings: {
          enabled: true,
          level: 5,
        },
      };
      expect(schema.parse(validInput)).toEqual(validInput);

      expect(() => schema.parse({ settings: {} })).toThrow();
    });

    test('should handle tools with no input schema', () => {
      const mcpTool: MCPToolInfo = {
        serverName: TEST_SERVER_NAME,
        name: 'no_input_tool',
        description: 'A tool with no inputs',
        inputSchema: {
          type: 'object',
          properties: {},
        },
      };

      const langchainTool = convertMCPToolToLangChain(mcpTool, mockMCPManager);
      const schema = langchainTool.schema as z.ZodObject<Record<string, z.ZodTypeAny>>;

      expect(schema.parse({})).toEqual({});
    });

    test('should handle tool execution errors', async () => {
      const mcpTool: MCPToolInfo = {
        serverName: TEST_SERVER_NAME,
        name: 'error_tool',
        description: 'A tool that fails',
        inputSchema: {
          type: 'object',
          properties: {},
        },
      };

      const langchainTool = convertMCPToolToLangChain(mcpTool, mockMCPManager);

      mockMCPManager.executeTool.mockRejectedValueOnce(new Error('Tool failed'));
      
      const result = await langchainTool.func({});
      expect(result).toContain('Error executing MCP tool error_tool: Tool failed');
    });

    test('should handle array results from MCP tools', async () => {
      const mcpTool: MCPToolInfo = {
        serverName: TEST_SERVER_NAME,
        name: 'array_tool',
        description: 'Returns an array',
        inputSchema: {
          type: 'object',
          properties: {},
        },
      };

      const langchainTool = convertMCPToolToLangChain(mcpTool, mockMCPManager);

      mockMCPManager.executeTool.mockResolvedValueOnce(['item1', 'item2', 'item3']);
      
      const result = await langchainTool.func({});
      expect(result).toBe('["item1","item2","item3"]');
    });

    test('should handle primitive results from MCP tools', async () => {
      const mcpTool: MCPToolInfo = {
        serverName: TEST_SERVER_NAME,
        name: 'string_tool',
        description: 'Returns a string',
        inputSchema: {
          type: 'object',
          properties: {},
        },
      };

      const langchainTool = convertMCPToolToLangChain(mcpTool, mockMCPManager);

      mockMCPManager.executeTool.mockResolvedValueOnce('Simple string result');
      
      const result = await langchainTool.func({});
      expect(result).toBe('Simple string result');
    });

    test('should handle enum types in schema', () => {
      const mcpTool: MCPToolInfo = {
        serverName: TEST_SERVER_NAME,
        name: 'enum_tool',
        description: 'Tool with enum parameter',
        inputSchema: {
          type: 'object',
          properties: {
            status: {
              type: 'string',
              enum: ['active', 'inactive', 'pending'],
              description: 'Status value',
            },
          },
          required: ['status'],
        },
      };

      const langchainTool = convertMCPToolToLangChain(mcpTool, mockMCPManager);
      const schema = langchainTool.schema as z.ZodObject<Record<string, z.ZodTypeAny>>;

      expect(schema.parse({ status: 'active' })).toEqual({ status: 'active' });
      expect(() => schema.parse({ status: 'invalid' })).toThrow();
    });

    test('should handle nullable types', () => {
      const mcpTool: MCPToolInfo = {
        serverName: TEST_SERVER_NAME,
        name: 'nullable_tool',
        description: 'Tool with nullable parameter',
        inputSchema: {
          type: 'object',
          properties: {
            optionalValue: {
              type: ['string', 'null'],
              description: 'Optional value',
            },
          },
        },
      };

      const langchainTool = convertMCPToolToLangChain(mcpTool, mockMCPManager);
      const schema = langchainTool.schema as z.ZodObject<Record<string, z.ZodTypeAny>>;

      expect(schema.parse({ optionalValue: 'test' })).toEqual({ optionalValue: 'test' });
      expect(schema.parse({ optionalValue: null })).toEqual({ optionalValue: null });
      expect(schema.parse({})).toEqual({});
    });
  });
});