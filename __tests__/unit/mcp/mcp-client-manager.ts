import { describe, it as _it, expect, beforeEach } from '@jest/globals';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { Logger } from '@hashgraphonline/standards-sdk';
import { MCPClientManager } from '../../../src/mcp/mcp-client-manager';
import type { MCPServerConfig } from '../../../src/mcp/types';

const TEST_SERVER_NAME = 'test-server';
const TEST_COMMAND = 'test-command';

jest.mock('@modelcontextprotocol/sdk/client/index.js');
jest.mock('@modelcontextprotocol/sdk/client/stdio.js');
jest.mock('@hashgraphonline/standards-sdk');

describe('MCPClientManager', () => {
  let manager: MCPClientManager;
  let mockLogger: jest.Mocked<Logger>;
  let mockClient: jest.Mocked<{
    connect: jest.MockedFunction<() => Promise<void>>;
    request: jest.MockedFunction<() => unknown>;
    close: jest.MockedFunction<() => Promise<void>>;
    listTools: jest.MockedFunction<() => Promise<{ tools: unknown[] }>>;
    callTool: jest.MockedFunction<() => Promise<unknown>>;
  }>;
  let mockTransport: jest.Mocked<{
    start: jest.MockedFunction<() => Promise<void>>;
  }>;

  beforeEach(() => {
    jest.clearAllMocks();

    mockLogger = {
      info: jest.fn(),
      debug: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
    } as jest.Mocked<Logger>;

    mockClient = {
      connect: jest.fn().mockResolvedValue(undefined),
      request: jest.fn(),
      close: jest.fn().mockResolvedValue(undefined),
      listTools: jest.fn(),
      callTool: jest.fn(),
    };

    mockTransport = {
      start: jest.fn().mockResolvedValue(undefined),
    };

    jest.mocked(Logger).mockImplementation(() => mockLogger);
    jest.mocked(Client).mockImplementation(() => mockClient);
    jest.mocked(StdioClientTransport).mockImplementation(() => mockTransport);

    manager = new MCPClientManager(mockLogger);
  });

  describe('connectServer', () => {
    test('should connect to a stdio server successfully', async () => {
      const serverConfig: MCPServerConfig = {
        name: TEST_SERVER_NAME,
        command: TEST_COMMAND,
        args: ['arg1', 'arg2'],
        transport: 'stdio',
      };

      mockClient.listTools.mockResolvedValue({
        tools: [
          {
            name: 'test-tool',
            description: 'A test tool',
            inputSchema: { type: 'object', properties: {} },
          },
        ],
      });

      const result = await manager.connectServer(serverConfig);

      expect(result.connected).toBe(true);
      expect(result.serverName).toBe(TEST_SERVER_NAME);
      expect(result.tools).toHaveLength(1);
      expect(result.tools[0].name).toBe('test-tool');
      expect(mockClient.connect).toHaveBeenCalledWith(mockTransport);
    });

    test('should handle connection errors', async () => {
      const serverConfig: MCPServerConfig = {
        name: 'failing-server',
        command: 'bad-command',
        args: [],
      };

      const error = new Error('Connection failed');
      mockClient.connect.mockRejectedValueOnce(error);

      const result = await manager.connectServer(serverConfig);

      expect(result.connected).toBe(false);
      expect(result.serverName).toBe('failing-server');
      expect(result.error).toBe('Connection failed');
      expect(result.tools).toEqual([]);
    });

    test('should not connect if already connected', async () => {
      const serverConfig: MCPServerConfig = {
        name: TEST_SERVER_NAME,
        command: TEST_COMMAND,
        args: [],
      };

      mockClient.listTools.mockResolvedValue({ tools: [] });
      await manager.connectServer(serverConfig);

      const result = await manager.connectServer(serverConfig);

      expect(result.connected).toBe(false);
      expect(result.error).toBe(`Server ${TEST_SERVER_NAME} is already connected`);
      expect(mockClient.connect).toHaveBeenCalledTimes(1);
    });
  });

  describe('executeTool', () => {
    test('should call a tool on a connected server', async () => {
      const serverConfig: MCPServerConfig = {
        name: TEST_SERVER_NAME,
        command: TEST_COMMAND,
        args: [],
      };

      mockClient.listTools.mockResolvedValue({ tools: [] });
      await manager.connectServer(serverConfig);

      const toolResult = { result: 'success' };
      mockClient.callTool.mockResolvedValueOnce(toolResult);

      const result = await manager.executeTool('test-server', 'test-tool', {
        param: 'value',
      });

      expect(result).toEqual(toolResult);
      expect(mockClient.callTool).toHaveBeenCalledWith({
        name: 'test-tool',
        arguments: { param: 'value' },
      });
    });

    test('should throw error if server not connected', async () => {
      await expect(
        manager.executeTool('non-existent', 'test-tool', {})
      ).rejects.toThrow('MCP server non-existent not connected');
    });

    test('should handle tool call errors', async () => {
      const serverConfig: MCPServerConfig = {
        name: TEST_SERVER_NAME,
        command: TEST_COMMAND,
        args: [],
      };

      mockClient.listTools.mockResolvedValue({ tools: [] });
      await manager.connectServer(serverConfig);

      mockClient.callTool.mockRejectedValueOnce(
        new Error('Tool execution failed')
      );

      await expect(
        manager.executeTool(TEST_SERVER_NAME, 'test-tool', {})
      ).rejects.toThrow('Tool execution failed');
    });
  });

  describe('disconnectAll', () => {
    test('should disconnect all connected servers', async () => {
      const configs: MCPServerConfig[] = [
        { name: 'server1', command: 'cmd1', args: [] },
        { name: 'server2', command: 'cmd2', args: [] },
      ];

      for (const config of configs) {
        mockClient.listTools.mockResolvedValue({ tools: [] });
        await manager.connectServer(config);
        jest.mocked(Client).mockImplementation(() => ({ ...mockClient }));
      }

      await manager.disconnectAll();

      expect(mockClient.close).toHaveBeenCalledTimes(2);
    });
  });

  describe('getConnectedServers', () => {
    test('should return list of connected servers', async () => {
      const configs: MCPServerConfig[] = [
        { name: 'server1', command: 'cmd1', args: [] },
        { name: 'server2', command: 'cmd2', args: [] },
      ];

      for (const config of configs) {
        mockClient.listTools.mockResolvedValue({ tools: [] });
        await manager.connectServer(config);
        jest.mocked(Client).mockImplementation(() => ({ ...mockClient }));
      }

      const servers = manager.getConnectedServers();
      expect(servers).toEqual(['server1', 'server2']);
    });
  });

  describe('isServerConnected', () => {
    test('should return true for connected server', async () => {
      const serverConfig: MCPServerConfig = {
        name: TEST_SERVER_NAME,
        command: TEST_COMMAND,
        args: [],
      };

      mockClient.listTools.mockResolvedValue({ tools: [] });
      await manager.connectServer(serverConfig);

      expect(manager.isServerConnected(TEST_SERVER_NAME)).toBe(true);
    });

    test('should return false for non-connected server', () => {
      expect(manager.isServerConnected('non-existent')).toBe(false);
    });
  });
});
