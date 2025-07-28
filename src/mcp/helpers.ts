import type { MCPServerConfig } from './types';

/**
 * Common MCP server configurations for easy setup
 */
export const MCPServers = {
  /**
   * Filesystem server for file operations
   */
  filesystem: (path: string): MCPServerConfig => ({
    name: 'filesystem',
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-filesystem', path],
    transport: 'stdio',
    autoConnect: true,
    additionalContext: 'This server provides access to files and directories in the current working directory.',
    toolDescriptions: {
      list_directory: 'Use this tool when users ask about files in the "current directory" or "working directory".',
      read_file: 'Use this tool when users ask to see or check files in the current directory.',
    },
  }),

  /**
   * GitHub server for repository operations
   */
  github: (token?: string): MCPServerConfig => ({
    name: 'github',
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-github'],
    ...(token && { env: { GITHUB_TOKEN: token } }),
    transport: 'stdio',
    autoConnect: true,
  }),

  /**
   * Slack server for messaging operations
   */
  slack: (token: string): MCPServerConfig => ({
    name: 'slack',
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-slack'],
    env: { SLACK_TOKEN: token },
    transport: 'stdio',
    autoConnect: true,
  }),

  /**
   * Google Drive server for document operations
   */
  googleDrive: (credentials: string): MCPServerConfig => ({
    name: 'google-drive',
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-google-drive'],
    env: { GOOGLE_CREDENTIALS: credentials },
    transport: 'stdio',
    autoConnect: true,
  }),

  /**
   * PostgreSQL server for database operations
   */
  postgres: (connectionString: string): MCPServerConfig => ({
    name: 'postgres',
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-postgres', connectionString],
    transport: 'stdio',
    autoConnect: true,
  }),

  /**
   * SQLite server for database operations
   */
  sqlite: (dbPath: string): MCPServerConfig => ({
    name: 'sqlite',
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-sqlite', dbPath],
    transport: 'stdio',
    autoConnect: true,
  }),

  /**
   * Custom server configuration
   */
  custom: (config: MCPServerConfig): MCPServerConfig => config,
};

/**
 * Validate MCP server configuration
 */
export function validateServerConfig(config: MCPServerConfig): string[] {
  const errors: string[] = [];

  if (!config.name) {
    errors.push('Server name is required');
  }

  if (!config.command) {
    errors.push('Server command is required');
  }

  if (!config.args || !Array.isArray(config.args)) {
    errors.push('Server args must be an array');
  }

  if (config.transport && !['stdio', 'http', 'websocket'].includes(config.transport)) {
    errors.push('Invalid transport type. Must be stdio, http, or websocket');
  }

  return errors;
}

/**
 * Create a typed MCP configuration for ConversationalAgent
 */
export function createMCPConfig(servers: MCPServerConfig[], autoConnect = true): { mcpServers: MCPServerConfig[] } {
  return {
    mcpServers: servers.map(server => ({
      ...server,
      autoConnect: server.autoConnect ?? autoConnect,
    })),
  };
}