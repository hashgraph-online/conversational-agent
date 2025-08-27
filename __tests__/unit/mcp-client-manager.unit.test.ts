import { MCPClientManager } from '../../src/mcp/mcp-client-manager';
import { Logger } from '@hashgraphonline/standards-sdk';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { MCPContentProcessor } from '../../src/mcp/content-processor';
import type { MCPServerConfig, MCPToolInfo } from '../../src/mcp/types';
import type { ContentStorage } from '../../src/memory/content-storage';

jest.mock('@modelcontextprotocol/sdk/client/index.js');
jest.mock('@modelcontextprotocol/sdk/client/stdio.js');
jest.mock('../../src/mcp/content-processor');

const mockClient = Client as jest.MockedClass<typeof Client>;
const mockStdioClientTransport = StdioClientTransport as jest.MockedClass<typeof StdioClientTransport>;
const mockMCPContentProcessor = MCPContentProcessor as jest.MockedClass<typeof MCPContentProcessor>;

describe('MCPClientManager', () => {
  let manager: MCPClientManager;
  let mockLogger: jest.Mocked<Logger>;
  let mockContentStorage: jest.Mocked<ContentStorage>;
  let mockClientInstance: jest.Mocked<Client>;

  const mockConfig: MCPServerConfig = {
    name: 'test-server',
    command: 'test-command',
    args: ['--test'],
    transport: 'stdio',
    env: { TEST_VAR: 'test' },
  };

  beforeEach(() => {
    jest.clearAllMocks();

    mockLogger = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
    } as any;

    mockContentStorage = {
      store: jest.fn(),
      retrieve: jest.fn(),
      exists: jest.fn(),
    } as any;

    mockClientInstance = {
      connect: jest.fn(),
      listTools: jest.fn(),
      callTool: jest.fn(),
      close: jest.fn(),
    } as any;

    mockClient.mockImplementation(() => mockClientInstance);

    manager = new MCPClientManager(mockLogger);
  });

  describe('constructor', () => {
    it('should create manager with logger only', () => {
      expect(manager).toBeInstanceOf(MCPClientManager);
      expect(manager.isContentProcessingEnabled()).toBe(false);
    });

    it('should create manager with logger and content storage', () => {
      const managerWithStorage = new MCPClientManager(mockLogger, mockContentStorage);
      expect(managerWithStorage.isContentProcessingEnabled()).toBe(true);
      expect(mockMCPContentProcessor).toHaveBeenCalledWith(mockContentStorage, mockLogger);
    });
  });

  describe('connectServer', () => {
    beforeEach(() => {
      mockClientInstance.listTools.mockResolvedValue({
        tools: [
          { name: 'tool1', description: 'Test tool 1' },
          { name: 'tool2', description: 'Test tool 2' },
        ],
      });
    });

    it('should successfully connect to MCP server', async () => {
      const result = await manager.connectServer(mockConfig);

      expect(mockStdioClientTransport).toHaveBeenCalledWith({
        command: 'test-command',
        args: ['--test'],
        env: { TEST_VAR: 'test' },
      });

      expect(mockClient).toHaveBeenCalledWith(
        {
          name: 'conversational-agent-test-server',
          version: '1.0.0',
        },
        {
          capabilities: {},
        }
      );

      expect(mockClientInstance.connect).toHaveBeenCalled();
      expect(mockClientInstance.listTools).toHaveBeenCalled();

      expect(result).toEqual({
        serverName: 'test-server',
        connected: true,
        tools: [
          { name: 'tool1', description: 'Test tool 1', serverName: 'test-server' },
          { name: 'tool2', description: 'Test tool 2', serverName: 'test-server' },
        ],
      });

      expect(mockLogger.info).toHaveBeenCalledWith(
        'Connected to MCP server test-server with 2 tools'
      );
    });

    it('should handle already connected server', async () => {
      await manager.connectServer(mockConfig);
      const result = await manager.connectServer(mockConfig);

      expect(result).toEqual({
        serverName: 'test-server',
        connected: false,
        error: 'Server test-server is already connected',
        tools: [],
      });
    });

    it('should handle unsupported transport', async () => {
      const badConfig = { ...mockConfig, transport: 'websocket' as any };
      const result = await manager.connectServer(badConfig);

      expect(result.connected).toBe(false);
      expect(result.error).toContain('Transport websocket not yet supported');
    });

    it('should handle connection errors', async () => {
      const error = new Error('Connection failed');
      mockClientInstance.connect.mockRejectedValue(error);

      const result = await manager.connectServer(mockConfig);

      expect(result).toEqual({
        serverName: 'test-server',
        connected: false,
        error: 'Connection failed',
        tools: [],
      });

      expect(mockLogger.error).toHaveBeenCalledWith(
        'Failed to connect to MCP server test-server:',
        error
      );
    });

    it('should handle config without env', async () => {
      const configWithoutEnv = { ...mockConfig };
      delete configWithoutEnv.env;

      await manager.connectServer(configWithoutEnv);

      expect(mockStdioClientTransport).toHaveBeenCalledWith({
        command: 'test-command',
        args: ['--test'],
      });
    });
  });

  describe('executeTool', () => {
    beforeEach(async () => {
      mockClientInstance.listTools.mockResolvedValue({
        tools: [{ name: 'test-tool', description: 'Test tool' }],
      });
      await manager.connectServer(mockConfig);
    });

    it('should execute tool successfully without content processor', async () => {
      const mockResult = { content: 'test result' };
      mockClientInstance.callTool.mockResolvedValue(mockResult);

      const result = await manager.executeTool('test-server', 'test-tool', { param: 'value' });

      expect(mockClientInstance.callTool).toHaveBeenCalledWith({
        name: 'test-tool',
        arguments: { param: 'value' },
      });

      expect(result).toBe(mockResult);
      expect(mockLogger.debug).toHaveBeenCalledWith(
        'Executing MCP tool test-tool on server test-server',
        { param: 'value' }
      );
    });

    it('should execute tool successfully with content processor', async () => {
      manager.enableContentProcessing(mockContentStorage);
      
      const mockResult = { content: 'test result' };
      const processedResult = {
        content: 'processed result',
        wasProcessed: true,
        referenceCreated: true,
        originalSize: 100,
        errors: [],
      };

      mockClientInstance.callTool.mockResolvedValue(mockResult);
      const mockProcessor = manager['contentProcessor'] as jest.Mocked<MCPContentProcessor>;
      mockProcessor.processResponse.mockResolvedValue(processedResult);

      const result = await manager.executeTool('test-server', 'test-tool', { param: 'value' });

      expect(mockProcessor.processResponse).toHaveBeenCalledWith(
        mockResult,
        'test-server',
        'test-tool'
      );
      expect(result).toBe('processed result');
      expect(mockLogger.debug).toHaveBeenCalledWith(
        'Processed MCP response from test-server::test-tool',
        {
          referenceCreated: true,
          originalSize: 100,
          errors: [],
        }
      );
    });

    it('should handle content processing with warnings', async () => {
      manager.enableContentProcessing(mockContentStorage);
      
      const processedResult = {
        content: 'processed result',
        wasProcessed: true,
        referenceCreated: false,
        originalSize: 50,
        errors: ['Warning: Content too short'],
      };

      mockClientInstance.callTool.mockResolvedValue({ content: 'test' });
      const mockProcessor = manager['contentProcessor'] as jest.Mocked<MCPContentProcessor>;
      mockProcessor.processResponse.mockResolvedValue(processedResult);

      const result = await manager.executeTool('test-server', 'test-tool', {});

      expect(result).toBe('processed result');
      expect(mockLogger.warn).toHaveBeenCalledWith(
        'Content processing warnings for test-server::test-tool:',
        ['Warning: Content too short']
      );
    });

    it('should handle server not connected', async () => {
      await expect(
        manager.executeTool('nonexistent-server', 'test-tool', {})
      ).rejects.toThrow('MCP server nonexistent-server not connected');
    });

    it('should handle tool execution errors', async () => {
      const error = new Error('Tool execution failed');
      mockClientInstance.callTool.mockRejectedValue(error);

      await expect(
        manager.executeTool('test-server', 'test-tool', {})
      ).rejects.toThrow('Tool execution failed');

      expect(mockLogger.error).toHaveBeenCalledWith(
        'Error executing MCP tool test-tool:',
        error
      );
    });
  });

  describe('disconnectAll', () => {
    beforeEach(async () => {
      mockClientInstance.listTools.mockResolvedValue({
        tools: [{ name: 'test-tool', description: 'Test tool' }],
      });
      await manager.connectServer(mockConfig);
    });

    it('should disconnect all clients successfully', async () => {
      await manager.disconnectAll();

      expect(mockClientInstance.close).toHaveBeenCalled();
      expect(mockLogger.info).toHaveBeenCalledWith('Disconnected from MCP server test-server');
      expect(manager.getConnectedServers()).toHaveLength(0);
      expect(manager.getAllTools()).toHaveLength(0);
    });

    it('should handle disconnection errors gracefully', async () => {
      const error = new Error('Disconnection failed');
      mockClientInstance.close.mockRejectedValue(error);

      await manager.disconnectAll();

      expect(mockLogger.error).toHaveBeenCalledWith(
        'Error disconnecting MCP server test-server:',
        error
      );
      expect(manager.getConnectedServers()).toHaveLength(0);
    });
  });

  describe('getAllTools', () => {
    it('should return empty array when no servers connected', () => {
      expect(manager.getAllTools()).toEqual([]);
    });

    it('should return all tools from all connected servers', async () => {
      mockClientInstance.listTools.mockResolvedValue({
        tools: [
          { name: 'tool1', description: 'Tool 1' },
          { name: 'tool2', description: 'Tool 2' },
        ],
      });

      await manager.connectServer(mockConfig);

      const tools = manager.getAllTools();
      expect(tools).toEqual([
        { name: 'tool1', description: 'Tool 1', serverName: 'test-server' },
        { name: 'tool2', description: 'Tool 2', serverName: 'test-server' },
      ]);
    });

    it('should return tools from multiple servers', async () => {
      mockClientInstance.listTools
        .mockResolvedValueOnce({
          tools: [{ name: 'tool1', description: 'Tool 1' }],
        })
        .mockResolvedValueOnce({
          tools: [{ name: 'tool2', description: 'Tool 2' }],
        });

      await manager.connectServer(mockConfig);
      await manager.connectServer({ ...mockConfig, name: 'server2', command: 'cmd2' });

      const tools = manager.getAllTools();
      expect(tools).toHaveLength(2);
      expect(tools.map(t => t.serverName)).toEqual(['test-server', 'server2']);
    });
  });

  describe('getServerTools', () => {
    it('should return empty array for non-existent server', () => {
      expect(manager.getServerTools('nonexistent')).toEqual([]);
    });

    it('should return tools for specific server', async () => {
      mockClientInstance.listTools.mockResolvedValue({
        tools: [{ name: 'server-tool', description: 'Server specific tool' }],
      });

      await manager.connectServer(mockConfig);

      const tools = manager.getServerTools('test-server');
      expect(tools).toEqual([
        { name: 'server-tool', description: 'Server specific tool', serverName: 'test-server' },
      ]);
    });
  });

  describe('isServerConnected', () => {
    it('should return false for non-connected server', () => {
      expect(manager.isServerConnected('test-server')).toBe(false);
    });

    it('should return true for connected server', async () => {
      mockClientInstance.listTools.mockResolvedValue({ tools: [] });
      await manager.connectServer(mockConfig);
      expect(manager.isServerConnected('test-server')).toBe(true);
    });
  });

  describe('getConnectedServers', () => {
    it('should return empty array when no servers connected', () => {
      expect(manager.getConnectedServers()).toEqual([]);
    });

    it('should return list of connected server names', async () => {
      mockClientInstance.listTools.mockResolvedValue({ tools: [] });
      await manager.connectServer(mockConfig);
      expect(manager.getConnectedServers()).toEqual(['test-server']);
    });
  });

  describe('content processing', () => {
    it('should enable content processing', () => {
      manager.enableContentProcessing(mockContentStorage);
      expect(manager.isContentProcessingEnabled()).toBe(true);
      expect(mockLogger.info).toHaveBeenCalledWith('Content processing enabled for MCP responses');
    });

    it('should disable content processing', () => {
      manager.enableContentProcessing(mockContentStorage);
      manager.disableContentProcessing();
      expect(manager.isContentProcessingEnabled()).toBe(false);
      expect(mockLogger.info).toHaveBeenCalledWith('Content processing disabled for MCP responses');
    });

    it('should analyze response content when processing enabled', () => {
      const mockAnalysis = { size: 100, hasImages: false };
      manager.enableContentProcessing(mockContentStorage);
      
      const mockProcessor = manager['contentProcessor'] as jest.Mocked<MCPContentProcessor>;
      mockProcessor.analyzeResponse.mockReturnValue(mockAnalysis);

      const response = { content: 'test content' };
      const result = manager.analyzeResponseContent(response);

      expect(mockProcessor.analyzeResponse).toHaveBeenCalledWith(response);
      expect(result).toBe(mockAnalysis);
    });

    it('should throw error when analyzing without content processing', () => {
      expect(() => {
        manager.analyzeResponseContent({ content: 'test' });
      }).toThrow('Content processing is not enabled');
    });
  });
});