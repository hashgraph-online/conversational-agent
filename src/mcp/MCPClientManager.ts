import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import type { MCPServerConfig, MCPToolInfo, MCPConnectionStatus } from './types';
import { Logger } from '@hashgraphonline/standards-sdk';

/**
 * Manages connections to MCP servers and tool discovery
 */
export class MCPClientManager {
  private clients: Map<string, Client> = new Map();
  private tools: Map<string, MCPToolInfo[]> = new Map();
  private logger: Logger;

  constructor(logger: Logger) {
    this.logger = logger;
  }

  /**
   * Connect to an MCP server and discover its tools
   */
  async connectServer(config: MCPServerConfig): Promise<MCPConnectionStatus> {
    try {
      if (this.isServerConnected(config.name)) {
        return {
          serverName: config.name,
          connected: false,
          error: `Server ${config.name} is already connected`,
          tools: [],
        };
      }

      if (config.transport && config.transport !== 'stdio') {
        throw new Error(`Transport ${config.transport} not yet supported`);
      }

      const transport = new StdioClientTransport({
        command: config.command,
        args: config.args,
        ...(config.env && { env: config.env }),
      });

      const client = new Client({
        name: `conversational-agent-${config.name}`,
        version: '1.0.0',
      }, {
        capabilities: {},
      });

      await client.connect(transport);
      this.clients.set(config.name, client);

      const toolsResponse = await client.listTools();
      const toolsWithServer: MCPToolInfo[] = toolsResponse.tools.map(tool => ({
        ...tool,
        serverName: config.name,
      }));

      this.tools.set(config.name, toolsWithServer);
      this.logger.info(`Connected to MCP server ${config.name} with ${toolsWithServer.length} tools`);

      return {
        serverName: config.name,
        connected: true,
        tools: toolsWithServer,
      };
    } catch (error) {
      this.logger.error(`Failed to connect to MCP server ${config.name}:`, error);
      return {
        serverName: config.name,
        connected: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        tools: [],
      };
    }
  }

  /**
   * Execute a tool on a specific MCP server
   */
  async executeTool(serverName: string, toolName: string, args: Record<string, unknown>): Promise<unknown> {
    const client = this.clients.get(serverName);
    if (!client) {
      throw new Error(`MCP server ${serverName} not connected`);
    }

    this.logger.debug(`Executing MCP tool ${toolName} on server ${serverName}`, args);

    try {
      const result = await client.callTool({
        name: toolName,
        arguments: args,
      });

      return result;
    } catch (error) {
      this.logger.error(`Error executing MCP tool ${toolName}:`, error);
      throw error;
    }
  }

  /**
   * Disconnect all MCP servers
   */
  async disconnectAll(): Promise<void> {
    for (const [name, client] of this.clients) {
      try {
        await client.close();
        this.logger.info(`Disconnected from MCP server ${name}`);
      } catch (error) {
        this.logger.error(`Error disconnecting MCP server ${name}:`, error);
      }
    }
    this.clients.clear();
    this.tools.clear();
  }

  /**
   * Get all discovered tools from all connected servers
   */
  getAllTools(): MCPToolInfo[] {
    const allTools: MCPToolInfo[] = [];
    for (const tools of this.tools.values()) {
      allTools.push(...tools);
    }
    return allTools;
  }

  /**
   * Get tools from a specific server
   */
  getServerTools(serverName: string): MCPToolInfo[] {
    return this.tools.get(serverName) || [];
  }

  /**
   * Check if a server is connected
   */
  isServerConnected(serverName: string): boolean {
    return this.clients.has(serverName);
  }

  /**
   * Get list of connected server names
   */
  getConnectedServers(): string[] {
    return Array.from(this.clients.keys());
  }
}