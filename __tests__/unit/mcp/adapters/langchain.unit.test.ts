import { describe, it, expect, vi, beforeEach } from 'vitest';
import { z } from 'zod';
import { convertMCPToolToLangChain } from '../../../../src/mcp/adapters/langchain';
import { MCPClientManager } from '../../../../src/mcp/MCPClientManager';
import type { MCPToolInfo } from '../../../../src/mcp/types';

vi.mock('../../../../src/mcp/MCPClientManager');

describe('LangChain MCP Adapter', () => {
  let mockMCPManager: any;

  beforeEach(() => {
    vi.clearAllMocks();
    mockMCPManager = {
      executeTool: vi.fn(),
    };
  });

  describe('convertMCPToolToLangChain', () => {
    it('should convert a simple MCP tool to LangChain format', async () => {
      const mcpTool: MCPToolInfo = {
        serverName: 'test-server',
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

      const schema = langchainTool.schema as z.ZodObject<any>;
      expect(schema).toBeDefined();
      expect(schema.parse({ message: 'hello' })).toEqual({ message: 'hello' });
      expect(() => schema.parse({})).toThrow();

      mockMCPManager.executeTool.mockResolvedValueOnce({ result: 'success' });
      const result = await langchainTool.func({ message: 'test' });
      expect(result).toBe('{"result":"success"}');
      expect(mockMCPManager.executeTool).toHaveBeenCalledWith('test-server', 'test_tool', { message: 'test' });
    });

    it('should handle complex nested schemas', async () => {
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
      const schema = langchainTool.schema as z.ZodObject<any>;

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

    it('should handle tools with no input schema', () => {
      const mcpTool: MCPToolInfo = {
        serverName: 'test-server',
        name: 'no_input_tool',
        description: 'A tool with no inputs',
        inputSchema: {
          type: 'object',
          properties: {},
        },
      };

      const langchainTool = convertMCPToolToLangChain(mcpTool, mockMCPManager);
      const schema = langchainTool.schema as z.ZodObject<any>;

      expect(schema.parse({})).toEqual({});
    });

    it('should handle tool execution errors', async () => {
      const mcpTool: MCPToolInfo = {
        serverName: 'test-server',
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

    it('should handle array results from MCP tools', async () => {
      const mcpTool: MCPToolInfo = {
        serverName: 'test-server',
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

    it('should handle primitive results from MCP tools', async () => {
      const mcpTool: MCPToolInfo = {
        serverName: 'test-server',
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

    it('should handle enum types in schema', () => {
      const mcpTool: MCPToolInfo = {
        serverName: 'test-server',
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
      const schema = langchainTool.schema as z.ZodObject<any>;

      expect(schema.parse({ status: 'active' })).toEqual({ status: 'active' });
      expect(() => schema.parse({ status: 'invalid' })).toThrow();
    });

    it('should handle nullable types', () => {
      const mcpTool: MCPToolInfo = {
        serverName: 'test-server',
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
      const schema = langchainTool.schema as z.ZodObject<any>;

      expect(schema.parse({ optionalValue: 'test' })).toEqual({ optionalValue: 'test' });
      expect(schema.parse({ optionalValue: null })).toEqual({ optionalValue: null });
      expect(schema.parse({})).toEqual({});
    });
  });
});