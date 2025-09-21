/**
 * Minimal MCP Tool shape used internally to avoid external type dependency resolution issues.
 * Aligns with MCP tool metadata returned by listTools.
 */
export interface BaseMCPTool {
  name: string;
  description?: string;
  /**
   * JSON Schema describing input parameters for the tool.
   * Kept as unknown and validated/converted at the boundary.
   */
  inputSchema?: unknown;
}

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

export interface MCPToolInfo extends BaseMCPTool {
  serverName: string;
}

export interface MCPConnectionStatus {
  serverName: string;
  connected: boolean;
  error?: string;
  tools: MCPToolInfo[];
}
