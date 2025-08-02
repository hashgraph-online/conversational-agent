import { describe, it, expect } from 'vitest';
import { MCPServers, validateServerConfig, createMCPConfig } from '../../../src/mcp/helpers';
import type { MCPServerConfig } from '../../../src/mcp/types';

describe('MCP Helpers', () => {
  describe('MCPServers', () => {
    it('should create filesystem server config', () => {
      const config = MCPServers.filesystem('/tmp/test');
      
      expect(config).toEqual({
        name: 'filesystem',
        command: 'npx',
        args: ['-y', '@modelcontextprotocol/server-filesystem', '/tmp/test'],
        transport: 'stdio',
        autoConnect: true,
        additionalContext: 'This server provides access to files and directories in the current working directory.',
        toolDescriptions: {
          list_directory: 'Use this tool when users ask about files in the "current directory" or "working directory".',
          read_file: 'Use this tool when users ask to see or check files in the current directory.',
        },
      });
    });

    it('should create github server config without token', () => {
      const config = MCPServers.github();
      
      expect(config).toEqual({
        name: 'github',
        command: 'npx',
        args: ['-y', '@modelcontextprotocol/server-github'],
        env: undefined,
        transport: 'stdio',
        autoConnect: true,
      });
    });

    it('should create github server config with token', () => {
      const config = MCPServers.github('github-token-123');
      
      expect(config).toEqual({
        name: 'github',
        command: 'npx',
        args: ['-y', '@modelcontextprotocol/server-github'],
        env: { GITHUB_TOKEN: 'github-token-123' },
        transport: 'stdio',
        autoConnect: true,
      });
    });

    it('should create slack server config', () => {
      const config = MCPServers.slack('slack-token-123');
      
      expect(config).toEqual({
        name: 'slack',
        command: 'npx',
        args: ['-y', '@modelcontextprotocol/server-slack'],
        env: { SLACK_TOKEN: 'slack-token-123' },
        transport: 'stdio',
        autoConnect: true,
      });
    });

    it('should create postgres server config', () => {
      const config = MCPServers.postgres('postgresql://user:pass@localhost/db');
      
      expect(config).toEqual({
        name: 'postgres',
        command: 'npx',
        args: ['-y', '@modelcontextprotocol/server-postgres', 'postgresql://user:pass@localhost/db'],
        transport: 'stdio',
        autoConnect: true,
      });
    });

    it('should create sqlite server config', () => {
      const config = MCPServers.sqlite('/path/to/database.db');
      
      expect(config).toEqual({
        name: 'sqlite',
        command: 'npx',
        args: ['-y', '@modelcontextprotocol/server-sqlite', '/path/to/database.db'],
        transport: 'stdio',
        autoConnect: true,
      });
    });

    it('should pass through custom config', () => {
      const customConfig: MCPServerConfig = {
        name: 'custom',
        command: 'custom-command',
        args: ['--custom', 'args'],
        transport: 'websocket',
        autoConnect: false,
      };
      
      const config = MCPServers.custom(customConfig);
      expect(config).toEqual(customConfig);
    });
  });

  describe('validateServerConfig', () => {
    it('should return no errors for valid config', () => {
      const config: MCPServerConfig = {
        name: 'test',
        command: 'test-command',
        args: ['arg1', 'arg2'],
        transport: 'stdio',
      };
      
      const errors = validateServerConfig(config);
      expect(errors).toEqual([]);
    });

    it('should validate missing name', () => {
      const config = {
        command: 'test-command',
        args: [],
      } as any;
      
      const errors = validateServerConfig(config);
      expect(errors).toContain('Server name is required');
    });

    it('should validate missing command', () => {
      const config = {
        name: 'test',
        args: [],
      } as any;
      
      const errors = validateServerConfig(config);
      expect(errors).toContain('Server command is required');
    });

    it('should validate missing or invalid args', () => {
      const config1 = {
        name: 'test',
        command: 'test-command',
      } as any;
      
      const errors1 = validateServerConfig(config1);
      expect(errors1).toContain('Server args must be an array');

      const config2 = {
        name: 'test',
        command: 'test-command',
        args: 'not-an-array',
      } as any;
      
      const errors2 = validateServerConfig(config2);
      expect(errors2).toContain('Server args must be an array');
    });

    it('should validate invalid transport type', () => {
      const config: MCPServerConfig = {
        name: 'test',
        command: 'test-command',
        args: [],
        transport: 'invalid' as any,
      };
      
      const errors = validateServerConfig(config);
      expect(errors).toContain('Invalid transport type. Must be stdio, http, or websocket');
    });

    it('should return multiple errors', () => {
      const config = {
        transport: 'invalid',
      } as any;
      
      const errors = validateServerConfig(config);
      expect(errors).toHaveLength(4);
    });
  });

  describe('createMCPConfig', () => {
    it('should create MCP config with default autoConnect', () => {
      const servers: MCPServerConfig[] = [
        { name: 'server1', command: 'cmd1', args: [] },
        { name: 'server2', command: 'cmd2', args: [], autoConnect: false },
      ];
      
      const config = createMCPConfig(servers);
      
      expect(config).toEqual({
        mcpServers: [
          { name: 'server1', command: 'cmd1', args: [], autoConnect: true },
          { name: 'server2', command: 'cmd2', args: [], autoConnect: false },
        ],
      });
    });

    it('should respect custom autoConnect setting', () => {
      const servers: MCPServerConfig[] = [
        { name: 'server1', command: 'cmd1', args: [] },
        { name: 'server2', command: 'cmd2', args: [], autoConnect: true },
      ];
      
      const config = createMCPConfig(servers, false);
      
      expect(config).toEqual({
        mcpServers: [
          { name: 'server1', command: 'cmd1', args: [], autoConnect: false },
          { name: 'server2', command: 'cmd2', args: [], autoConnect: true },
        ],
      });
    });

    it('should handle empty server list', () => {
      const config = createMCPConfig([]);
      
      expect(config).toEqual({
        mcpServers: [],
      });
    });
  });
});