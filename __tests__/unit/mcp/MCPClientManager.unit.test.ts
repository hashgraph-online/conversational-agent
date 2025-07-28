import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { Logger } from '@hashgraphonline/standards-sdk';
import { MCPClientManager } from '../../../src/mcp/MCPClientManager';
import type { MCPServerConfig } from '../../../src/mcp/types';

vi.mock('@modelcontextprotocol/sdk/client/index.js');
vi.mock('@modelcontextprotocol/sdk/client/stdio.js');
vi.mock('@hashgraphonline/standards-sdk');

describe('MCPClientManager', () => {
  let manager: MCPClientManager;
  let mockLogger: any;
  let mockClient: any;
  let mockTransport: any;

  beforeEach(() => {
    vi.clearAllMocks();
    
    mockLogger = {
      info: vi.fn(),
      debug: vi.fn(),
      error: vi.fn(),
      warn: vi.fn(),
    };

    mockClient = {
      connect: vi.fn().mockResolvedValue(undefined),
      request: vi.fn(),
      close: vi.fn().mockResolvedValue(undefined),
      listTools: vi.fn(),
      callTool: vi.fn(),
    };

    mockTransport = {
      start: vi.fn().mockResolvedValue(undefined),
    };

    vi.mocked(Logger).mockImplementation(() => mockLogger);
    vi.mocked(Client).mockImplementation(() => mockClient);
    vi.mocked(StdioClientTransport).mockImplementation(() => mockTransport);

    manager = new MCPClientManager(mockLogger);
  });

  describe('connectServer', () => {
    it('should connect to a stdio server successfully', async () => {
      const serverConfig: MCPServerConfig = {
        name: 'test-server',
        command: 'test-command',
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
      expect(result.serverName).toBe('test-server');
      expect(result.tools).toHaveLength(1);
      expect(result.tools[0].name).toBe('test-tool');
      expect(mockClient.connect).toHaveBeenCalledWith(mockTransport);
    });

    it('should handle connection errors', async () => {
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

    it('should not connect if already connected', async () => {
      const serverConfig: MCPServerConfig = {
        name: 'test-server',
        command: 'test-command',
        args: [],
      };

      mockClient.listTools.mockResolvedValue({ tools: [] });
      await manager.connectServer(serverConfig);

      const result = await manager.connectServer(serverConfig);

      expect(result.connected).toBe(false);
      expect(result.error).toBe('Server test-server is already connected');
      expect(mockClient.connect).toHaveBeenCalledTimes(1);
    });
  });

  describe('executeTool', () => {
    it('should call a tool on a connected server', async () => {
      const serverConfig: MCPServerConfig = {
        name: 'test-server',
        command: 'test-command',
        args: [],
      };

      mockClient.listTools.mockResolvedValue({ tools: [] });
      await manager.connectServer(serverConfig);

      const toolResult = { result: 'success' };
      mockClient.callTool.mockResolvedValueOnce(toolResult);

      const result = await manager.executeTool('test-server', 'test-tool', { param: 'value' });

      expect(result).toEqual(toolResult);
      expect(mockClient.callTool).toHaveBeenCalledWith({
        name: 'test-tool',
        arguments: { param: 'value' },
      });
    });

    it('should throw error if server not connected', async () => {
      await expect(
        manager.executeTool('non-existent', 'test-tool', {})
      ).rejects.toThrow('MCP server non-existent not connected');
    });

    it('should handle tool call errors', async () => {
      const serverConfig: MCPServerConfig = {
        name: 'test-server',
        command: 'test-command',
        args: [],
      };

      mockClient.listTools.mockResolvedValue({ tools: [] });
      await manager.connectServer(serverConfig);

      mockClient.callTool.mockRejectedValueOnce(new Error('Tool execution failed'));

      await expect(
        manager.executeTool('test-server', 'test-tool', {})
      ).rejects.toThrow('Tool execution failed');
    });
  });

  describe('disconnectAll', () => {
    it('should disconnect all connected servers', async () => {
      const configs: MCPServerConfig[] = [
        { name: 'server1', command: 'cmd1', args: [] },
        { name: 'server2', command: 'cmd2', args: [] },
      ];

      for (const config of configs) {
        mockClient.listTools.mockResolvedValue({ tools: [] });
        await manager.connectServer(config);
        vi.mocked(Client).mockImplementation(() => ({...mockClient}));
      }

      await manager.disconnectAll();

      expect(mockClient.close).toHaveBeenCalledTimes(2);
    });
  });

  describe('getConnectedServers', () => {
    it('should return list of connected servers', async () => {
      const configs: MCPServerConfig[] = [
        { name: 'server1', command: 'cmd1', args: [] },
        { name: 'server2', command: 'cmd2', args: [] },
      ];

      for (const config of configs) {
        mockClient.listTools.mockResolvedValue({ tools: [] });
        await manager.connectServer(config);
        vi.mocked(Client).mockImplementation(() => ({...mockClient}));
      }

      const servers = manager.getConnectedServers();
      expect(servers).toEqual(['server1', 'server2']);
    });
  });

  describe('isServerConnected', () => {
    it('should return true for connected server', async () => {
      const serverConfig: MCPServerConfig = {
        name: 'test-server',
        command: 'test-command',
        args: [],
      };

      mockClient.listTools.mockResolvedValue({ tools: [] });
      await manager.connectServer(serverConfig);

      expect(manager.isServerConnected('test-server')).toBe(true);
    });

    it('should return false for non-connected server', () => {
      expect(manager.isServerConnected('non-existent')).toBe(false);
    });
  });
});