import type { Tool } from '@modelcontextprotocol/sdk/types';

export interface MCPServerConfig {
  name: string;
  command: string;
  args: string[];
  env?: Record<string, string>;
  transport?: 'stdio' | 'http' | 'websocket';
  autoConnect?: boolean;
  /**
   * Additional context to help the AI understand when to use this server's tools
   */
  additionalContext?: string;
  /**
   * Tool-specific descriptions to enhance or override default tool descriptions
   */
  toolDescriptions?: Record<string, string>;
}

export interface MCPToolInfo extends Tool {
  serverName: string;
}

export interface MCPConnectionStatus {
  serverName: string;
  connected: boolean;
  error?: string;
  tools: MCPToolInfo[];
}