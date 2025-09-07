import { describe, test, expect } from '@jest/globals';
import { MCPServers, validateServerConfig, createMCPConfig } from '../../../src/mcp/helpers';
import type { MCPServerConfig } from '../../../src/mcp/types';

/**
 * Comprehensive tests for MCP helpers
 * Tests all server configurations, validation logic, and config creation
 */

describe('MCP Helpers', () => {
  describe('MCPServers', () => {
    describe('filesystem', () => {
      test('should create filesystem server config with required properties', () => {
        const config = MCPServers.filesystem('/path/to/directory');

        expect(config).toEqual({
          name: 'filesystem',
          command: 'npx',
          args: ['-y', '@modelcontextprotocol/server-filesystem', '/path/to/directory'],
          transport: 'stdio',
          autoConnect: true,
          additionalContext: 'This server provides access to files and directories in the current working directory.',
          toolDescriptions: {
            list_directory: 'Use this tool when users ask about files in the "current directory" or "working directory".',
            read_file: 'Use this tool when users ask to see or check files in the current directory.',
          },
        });
      });

      test('should handle different path formats', () => {
        const configs = [
          MCPServers.filesystem('/home/user/docs'),
          MCPServers.filesystem('./local/path'),
          MCPServers.filesystem('../relative/path'),
          MCPServers.filesystem('C:\\Windows\\Path'),
        ];

        configs.forEach((config, index) => {
          expect(config.name).toBe('filesystem');
          expect(config.args).toContain([
            '/home/user/docs',
            './local/path', 
            '../relative/path',
            'C:\\Windows\\Path'
          ][index]);
        });
      });
    });

    describe('github', () => {
      test('should create github server config without token', () => {
        const config = MCPServers.github();

        expect(config).toEqual({
          name: 'github',
          command: 'npx',
          args: ['-y', '@modelcontextprotocol/server-github'],
          transport: 'stdio',
          autoConnect: true,
        });
      });

      test('should create github server config with token', () => {
        const token = 'ghp_test_token_123';
        const config = MCPServers.github(token);

        expect(config).toEqual({
          name: 'github',
          command: 'npx',
          args: ['-y', '@modelcontextprotocol/server-github'],
          env: { GITHUB_TOKEN: token },
          transport: 'stdio',
          autoConnect: true,
        });
      });

      test('should handle empty token string', () => {
        const config = MCPServers.github('');
        
        expect(config).not.toHaveProperty('env');
      });

      test('should handle null token', () => {
        const config = MCPServers.github(undefined);
        
        expect(config).not.toHaveProperty('env');
      });
    });

    describe('slack', () => {
      test('should create slack server config with token', () => {
        const token = 'xoxb-test-slack-token';
        const config = MCPServers.slack(token);

        expect(config).toEqual({
          name: 'slack',
          command: 'npx',
          args: ['-y', '@modelcontextprotocol/server-slack'],
          env: { SLACK_TOKEN: token },
          transport: 'stdio',
          autoConnect: true,
        });
      });

      test('should handle different token formats', () => {
        const tokens = [
          'xoxb-123-456-789',
          'xoxp-user-token',
          'custom-token-format',
        ];

        tokens.forEach(token => {
          const config = MCPServers.slack(token);
          expect(config.env?.SLACK_TOKEN).toBe(token);
        });
      });
    });

    describe('googleDrive', () => {
      test('should create google drive server config', () => {
        const credentials = JSON.stringify({ type: 'service_account', project_id: 'test' });
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

      test('should handle credentials as string', () => {
        const credentials = 'path/to/credentials.json';
        const config = MCPServers.googleDrive(credentials);
        
        expect(config.env?.GOOGLE_CREDENTIALS).toBe(credentials);
      });
    });

    describe('postgres', () => {
      test('should create postgres server config', () => {
        const connectionString = 'postgresql://user:password@localhost:5432/dbname';
        const config = MCPServers.postgres(connectionString);

        expect(config).toEqual({
          name: 'postgres',
          command: 'npx',
          args: ['-y', '@modelcontextprotocol/server-postgres', connectionString],
          transport: 'stdio',
          autoConnect: true,
        });
      });

      test('should handle different connection string formats', () => {
        const connectionStrings = [
          'postgresql://localhost/testdb',
          'postgres://user@host:5432/db',
          'postgresql://user:pass@host:port/db?sslmode=require',
        ];

        connectionStrings.forEach(connStr => {
          const config = MCPServers.postgres(connStr);
          expect(config.args).toContain(connStr);
        });
      });
    });

    describe('sqlite', () => {
      test('should create sqlite server config', () => {
        const dbPath = '/path/to/database.db';
        const config = MCPServers.sqlite(dbPath);

        expect(config).toEqual({
          name: 'sqlite',
          command: 'npx',
          args: ['-y', '@modelcontextprotocol/server-sqlite', dbPath],
          transport: 'stdio',
          autoConnect: true,
        });
      });

      test('should handle different database path formats', () => {
        const dbPaths = [
          './local.db',
          '/absolute/path/to/db.sqlite',
          'C:\\Windows\\database.db',
          ':memory:',
        ];

        dbPaths.forEach(dbPath => {
          const config = MCPServers.sqlite(dbPath);
          expect(config.args).toContain(dbPath);
        });
      });
    });

    describe('custom', () => {
      test('should return the provided config unchanged', () => {
        const customConfig: MCPServerConfig = {
          name: 'my-custom-server',
          command: 'custom-command',
          args: ['--flag', 'value'],
          transport: 'http',
          autoConnect: false,
          env: { CUSTOM_VAR: 'value' },
        };

        const result = MCPServers.custom(customConfig);
        expect(result).toBe(customConfig);
        expect(result).toEqual(customConfig);
      });
    });
  });

  describe('validateServerConfig', () => {
    test('should return empty array for valid config', () => {
      const validConfig: MCPServerConfig = {
        name: 'test-server',
        command: 'test-command',
        args: ['arg1', 'arg2'],
        transport: 'stdio',
      };

      const errors = validateServerConfig(validConfig);
      expect(errors).toEqual([]);
    });

    test('should validate required name field', () => {
      const configWithoutName = {
        command: 'test-command',
        args: ['arg1'],
      } as MCPServerConfig;

      const errors = validateServerConfig(configWithoutName);
      expect(errors).toContain('Server name is required');
    });

    test('should validate empty name field', () => {
      const configWithEmptyName: MCPServerConfig = {
        name: '',
        command: 'test-command',
        args: ['arg1'],
      };

      const errors = validateServerConfig(configWithEmptyName);
      expect(errors).toContain('Server name is required');
    });

    test('should validate required command field', () => {
      const configWithoutCommand = {
        name: 'test-server',
        args: ['arg1'],
      } as MCPServerConfig;

      const errors = validateServerConfig(configWithoutCommand);
      expect(errors).toContain('Server command is required');
    });

    test('should validate empty command field', () => {
      const configWithEmptyCommand: MCPServerConfig = {
        name: 'test-server',
        command: '',
        args: ['arg1'],
      };

      const errors = validateServerConfig(configWithEmptyCommand);
      expect(errors).toContain('Server command is required');
    });

    test('should validate args field is required', () => {
      const configWithoutArgs = {
        name: 'test-server',
        command: 'test-command',
      } as MCPServerConfig;

      const errors = validateServerConfig(configWithoutArgs);
      expect(errors).toContain('Server args must be an array');
    });

    test('should validate args field is an array', () => {
      const configWithInvalidArgs = {
        name: 'test-server',
        command: 'test-command',
        args: 'not-an-array',
      } as unknown as MCPServerConfig;

      const errors = validateServerConfig(configWithInvalidArgs);
      expect(errors).toContain('Server args must be an array');
    });

    test('should accept empty args array', () => {
      const configWithEmptyArgs: MCPServerConfig = {
        name: 'test-server',
        command: 'test-command',
        args: [],
      };

      const errors = validateServerConfig(configWithEmptyArgs);
      expect(errors).not.toContain('Server args must be an array');
    });

    test('should validate transport field values', () => {
      const validTransports = ['stdio', 'http', 'websocket'];
      
      validTransports.forEach(transport => {
        const config: MCPServerConfig = {
          name: 'test-server',
          command: 'test-command',
          args: ['arg1'],
          transport: transport as any,
        };

        const errors = validateServerConfig(config);
        expect(errors).not.toContain('Invalid transport type. Must be stdio, http, or websocket');
      });
    });

    test('should reject invalid transport values', () => {
      const invalidTransports = ['tcp', 'udp', 'invalid'];

      invalidTransports.forEach(transport => {
        const config: MCPServerConfig = {
          name: 'test-server',
          command: 'test-command',
          args: ['arg1'],
          transport: transport as any,
        };

        const errors = validateServerConfig(config);
        expect(errors).toContain('Invalid transport type. Must be stdio, http, or websocket');
      });
    });

    test('should allow empty string transport (treated as undefined)', () => {
      const config: MCPServerConfig = {
        name: 'test-server',
        command: 'test-command',
        args: ['arg1'],
        transport: '' as any,
      };

      const errors = validateServerConfig(config);
      expect(errors).not.toContain('Invalid transport type. Must be stdio, http, or websocket');
    });

    test('should allow undefined transport field', () => {
      const configWithoutTransport: MCPServerConfig = {
        name: 'test-server',
        command: 'test-command',
        args: ['arg1'],
      };

      const errors = validateServerConfig(configWithoutTransport);
      expect(errors).not.toContain('Invalid transport type. Must be stdio, http, or websocket');
    });

    test('should return multiple errors for invalid config', () => {
      const invalidConfig = {
        args: 'invalid',
        transport: 'invalid',
      } as unknown as MCPServerConfig;

      const errors = validateServerConfig(invalidConfig);
      
      expect(errors).toContain('Server name is required');
      expect(errors).toContain('Server command is required');
      expect(errors).toContain('Server args must be an array');
      expect(errors).toContain('Invalid transport type. Must be stdio, http, or websocket');
      expect(errors).toHaveLength(4);
    });
  });

  describe('createMCPConfig', () => {
    test('should create config with default autoConnect', () => {
      const servers: MCPServerConfig[] = [
        { name: 'server1', command: 'cmd1', args: ['arg1'] },
        { name: 'server2', command: 'cmd2', args: ['arg2'] },
      ];

      const config = createMCPConfig(servers);

      expect(config).toEqual({
        mcpServers: [
          { name: 'server1', command: 'cmd1', args: ['arg1'], autoConnect: true },
          { name: 'server2', command: 'cmd2', args: ['arg2'], autoConnect: true },
        ],
      });
    });

    test('should create config with custom autoConnect default', () => {
      const servers: MCPServerConfig[] = [
        { name: 'server1', command: 'cmd1', args: ['arg1'] },
      ];

      const config = createMCPConfig(servers, false);

      expect(config.mcpServers[0].autoConnect).toBe(false);
    });

    test('should preserve existing autoConnect values', () => {
      const servers: MCPServerConfig[] = [
        { name: 'server1', command: 'cmd1', args: ['arg1'], autoConnect: false },
        { name: 'server2', command: 'cmd2', args: ['arg2'], autoConnect: true },
        { name: 'server3', command: 'cmd3', args: ['arg3'] },
      ];

      const config = createMCPConfig(servers, true);

      expect(config.mcpServers[0].autoConnect).toBe(false);
      expect(config.mcpServers[1].autoConnect).toBe(true);
      expect(config.mcpServers[2].autoConnect).toBe(true);
    });

    test('should handle empty servers array', () => {
      const config = createMCPConfig([]);

      expect(config).toEqual({
        mcpServers: [],
      });
    });

    test('should preserve all other server properties', () => {
      const servers: MCPServerConfig[] = [
        {
          name: 'complex-server',
          command: 'complex-cmd',
          args: ['--verbose', '--port', '3000'],
          transport: 'http',
          env: { API_KEY: 'secret' },
          additionalContext: 'This is a complex server',
          toolDescriptions: {
            tool1: 'Description 1',
            tool2: 'Description 2',
          },
        },
      ];

      const config = createMCPConfig(servers);

      expect(config.mcpServers[0]).toEqual({
        ...servers[0],
        autoConnect: true,
      });
    });

    test('should handle servers with undefined autoConnect', () => {
      const servers: MCPServerConfig[] = [
        { 
          name: 'server1', 
          command: 'cmd1', 
          args: ['arg1'],
          autoConnect: undefined 
        },
      ];

      const config = createMCPConfig(servers, false);

      expect(config.mcpServers[0].autoConnect).toBe(false);
    });
  });

  describe('Integration tests', () => {
    test('should create valid configs from MCPServers helpers', () => {
      const servers = [
        MCPServers.filesystem('/tmp'),
        MCPServers.github('token123'),
        MCPServers.slack('slack-token'),
      ];

      servers.forEach(server => {
        const errors = validateServerConfig(server);
        expect(errors).toEqual([]);
      });

      const config = createMCPConfig(servers);
      expect(config.mcpServers).toHaveLength(3);
      expect(config.mcpServers.every(s => s.autoConnect)).toBe(true);
    });

    test('should handle mixed valid and invalid servers in validation', () => {
      const validServer = MCPServers.filesystem('/tmp');
      const invalidServer = { name: '', command: '', args: [] } as MCPServerConfig;

      expect(validateServerConfig(validServer)).toEqual([]);
      expect(validateServerConfig(invalidServer).length).toBeGreaterThan(0);
    });
  });
});