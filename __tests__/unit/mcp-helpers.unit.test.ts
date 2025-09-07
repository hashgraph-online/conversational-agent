import { MCPServers, validateServerConfig, createMCPConfig } from '../../src/mcp/helpers';
import type { MCPServerConfig } from '../../src/mcp/types';

describe('MCP Helpers', () => {
  describe('MCPServers', () => {
    it('should create filesystem server config', () => {
      const config = MCPServers.filesystem('/path/to/dir');

      expect(config).toEqual({
        name: 'filesystem',
        command: 'npx',
        args: ['-y', '@modelcontextprotocol/server-filesystem', '/path/to/dir'],
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
      const config = MCPServers.slack('slack-token-456');

      expect(config).toEqual({
        name: 'slack',
        command: 'npx',
        args: ['-y', '@modelcontextprotocol/server-slack'],
        env: { SLACK_TOKEN: 'slack-token-456' },
        transport: 'stdio',
        autoConnect: true,
      });
    });

    it('should create google drive server config', () => {
      const credentials = JSON.stringify({ client_id: 'test' });
      const config = MCPServers.googleDrive(credentials);

      expect(config).toEqual({
        name: 'google-drive',
        command: 'npx',
        args: ['-y', '@modelcontextprotocol/server-google-drive'],
        env: { GOOGLE_CREDENTIALS: credentials },
        transport: 'stdio',
        autoConnect: true,
      });
    });

    it('should create postgres server config', () => {
      const connectionString = 'postgresql://user:pass@localhost:5432/db';
      const config = MCPServers.postgres(connectionString);

      expect(config).toEqual({
        name: 'postgres',
        command: 'npx',
        args: ['-y', '@modelcontextprotocol/server-postgres', connectionString],
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

    it('should create custom server config', () => {
      const customConfig: MCPServerConfig = {
        name: 'my-custom-server',
        command: 'my-command',
        args: ['--custom-arg'],
        transport: 'http',
        env: { CUSTOM_VAR: 'value' },
      };

      const config = MCPServers.custom(customConfig);
      expect(config).toBe(customConfig);
    });
  });

  describe('validateServerConfig', () => {
    const validConfig: MCPServerConfig = {
      name: 'test-server',
      command: 'test-command',
      args: ['--arg1', '--arg2'],
      transport: 'stdio',
    };

    it('should validate correct config with no errors', () => {
      const errors = validateServerConfig(validConfig);
      expect(errors).toHaveLength(0);
    });

    it('should require server name', () => {
      const config = { ...validConfig };
      delete config.name;

      const errors = validateServerConfig(config as any);
      expect(errors).toContain('Server name is required');
    });

    it('should require empty server name', () => {
      const config = { ...validConfig, name: '' };

      const errors = validateServerConfig(config);
      expect(errors).toContain('Server name is required');
    });

    it('should require server command', () => {
      const config = { ...validConfig };
      delete config.command;

      const errors = validateServerConfig(config as any);
      expect(errors).toContain('Server command is required');
    });

    it('should require empty server command', () => {
      const config = { ...validConfig, command: '' };

      const errors = validateServerConfig(config);
      expect(errors).toContain('Server command is required');
    });

    it('should require args to be an array', () => {
      const config = { ...validConfig, args: 'not-an-array' as any };

      const errors = validateServerConfig(config);
      expect(errors).toContain('Server args must be an array');
    });

    it('should require args to exist', () => {
      const config = { ...validConfig };
      delete config.args;

      const errors = validateServerConfig(config as any);
      expect(errors).toContain('Server args must be an array');
    });

    it('should validate transport types', () => {
      const invalidTransports = ['tcp', 'udp', 'invalid'];

      invalidTransports.forEach(transport => {
        const config = { ...validConfig, transport: transport as any };
        const errors = validateServerConfig(config);
        expect(errors).toContain('Invalid transport type. Must be stdio, http, or websocket');
      });
    });

    it('should handle empty transport string as valid', () => {
      const config = { ...validConfig, transport: '' as any };
      const errors = validateServerConfig(config);
      expect(errors).not.toContain('Invalid transport type. Must be stdio, http, or websocket');
    });

    it('should accept valid transport types', () => {
      const validTransports = ['stdio', 'http', 'websocket'];

      validTransports.forEach(transport => {
        const config = { ...validConfig, transport: transport as any };
        const errors = validateServerConfig(config);
        expect(errors).not.toContain('Invalid transport type. Must be stdio, http, or websocket');
      });
    });

    it('should accept config without transport (optional)', () => {
      const config = { ...validConfig };
      delete config.transport;

      const errors = validateServerConfig(config);
      expect(errors).not.toContain('Invalid transport type. Must be stdio, http, or websocket');
    });

    it('should accumulate multiple validation errors', () => {
      const config = {
        name: '',
        command: '',
        args: 'not-array' as any,
        transport: 'invalid' as any,
      };

      const errors = validateServerConfig(config);
      expect(errors).toHaveLength(4);
      expect(errors).toContain('Server name is required');
      expect(errors).toContain('Server command is required');
      expect(errors).toContain('Server args must be an array');
      expect(errors).toContain('Invalid transport type. Must be stdio, http, or websocket');
    });
  });

  describe('createMCPConfig', () => {
    const server1: MCPServerConfig = {
      name: 'server1',
      command: 'cmd1',
      args: ['arg1'],
    };

    const server2: MCPServerConfig = {
      name: 'server2',
      command: 'cmd2',
      args: ['arg2'],
      autoConnect: false,
    };

    it('should create config with autoConnect true by default', () => {
      const config = createMCPConfig([server1, server2]);

      expect(config).toEqual({
        mcpServers: [
          { ...server1, autoConnect: true },
          { ...server2, autoConnect: false },
        ],
      });
    });

    it('should create config with custom autoConnect default', () => {
      const config = createMCPConfig([server1, server2], false);

      expect(config).toEqual({
        mcpServers: [
          { ...server1, autoConnect: false },
          { ...server2, autoConnect: false },
        ],
      });
    });

    it('should preserve existing autoConnect values', () => {
      const serverWithAutoConnect: MCPServerConfig = {
        name: 'server3',
        command: 'cmd3',
        args: ['arg3'],
        autoConnect: true,
      };

      const config = createMCPConfig([serverWithAutoConnect], false);

      expect(config.mcpServers[0].autoConnect).toBe(true);
    });

    it('should handle empty server list', () => {
      const config = createMCPConfig([]);

      expect(config).toEqual({
        mcpServers: [],
      });
    });

    it('should handle server without autoConnect property', () => {
      const serverWithoutAutoConnect = {
        name: 'server',
        command: 'cmd',
        args: ['arg'],
      };

      const config = createMCPConfig([serverWithoutAutoConnect], true);

      expect(config.mcpServers[0].autoConnect).toBe(true);
    });

    it('should create complete MCP config for real-world scenario', () => {
      const servers = [
        MCPServers.filesystem('./'),
        MCPServers.github('token'),
        MCPServers.postgres('postgresql://localhost/test'),
      ];

      const config = createMCPConfig(servers, false);

      expect(config.mcpServers).toHaveLength(3);
      expect(config.mcpServers[0].name).toBe('filesystem');
      expect(config.mcpServers[1].name).toBe('github');
      expect(config.mcpServers[2].name).toBe('postgres');

      expect(config.mcpServers[0].autoConnect).toBe(true);
      expect(config.mcpServers[1].autoConnect).toBe(true);
      expect(config.mcpServers[2].autoConnect).toBe(true);
    });
  });
});