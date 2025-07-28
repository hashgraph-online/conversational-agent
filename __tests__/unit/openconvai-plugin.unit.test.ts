import { describe, test, expect, beforeEach, vi } from 'vitest';
import { OpenConvAIPlugin } from '../../src';
import { Logger } from '@hashgraphonline/standards-sdk';

vi.mock('@hashgraphonline/standards-agent-kit', async () => {
  const actual = await vi.importActual('@hashgraphonline/standards-agent-kit');
  return {
    ...actual,
    HCS10Builder: vi.fn().mockImplementation(() => ({
      getStandardClient: vi.fn(),
      getOperatorId: vi.fn().mockReturnValue('0.0.12345'),
      getNetwork: vi.fn().mockReturnValue('testnet')
    }))
  };
});

/**
 * Unit tests for OpenConvAIPlugin
 */
describe('OpenConvAIPlugin Unit Tests', () => {
    let mockHederaKit: any;
  let mockContext: any;

  beforeEach(() => {
    mockHederaKit = {
      client: {
        network: { toString: () => 'testnet' }
      },
      signer: {
        getAccountId: () => ({ toString: () => '0.0.12345' }),
        getOperatorPrivateKey: () => ({ 
          toStringRaw: () => '302e020100300506032b657004220420a689b974df063cc7e19fd4ddeaf6dd412b5efec4e4a3cee7f181d29d40b3fc1e' 
        })
      },
      operationalMode: 'directExecution'
    };

    mockContext = {
      kit: mockHederaKit,
      logger: new Logger({ module: 'test' }),
      modelCapability: 'MEDIUM',
      config: {
        hederaKit: mockHederaKit
      }
    };
  });

  describe('Plugin Initialization', () => {
    test('Plugin creates without parameters', () => {
      const plugin = new OpenConvAIPlugin();
      
      expect(plugin).toBeDefined();
      expect(plugin.name).toBe('HCS-10 Plugin');
      expect(plugin.description).toContain('HCS-10');
      expect(plugin.id).toBe('hcs-10');
      expect(plugin.namespace).toBe('hcs10');
    });

    test('Plugin initializes tools when hederaKit is provided', async () => {
      const plugin = new OpenConvAIPlugin();
      
      mockContext.logger.warn = vi.fn();
      mockContext.logger.info = vi.fn();
      mockContext.logger.error = vi.fn();
      
      await plugin.initialize(mockContext);
      
      const tools = plugin.getTools();
      
      expect(tools).toBeDefined();
      expect(tools.length).toBe(11);
      expect(mockContext.logger.info).toHaveBeenCalledWith(
        'HCS-10 Plugin initialized successfully'
      );
    });

    test('Plugin warns when hederaKit is missing', async () => {
      const plugin = new OpenConvAIPlugin();
      
      mockContext.config.hederaKit = undefined;
      mockContext.logger.warn = vi.fn();
      mockContext.logger.info = vi.fn();
      
      await plugin.initialize(mockContext);
      
      const tools = plugin.getTools();
      
      expect(tools.length).toBe(0);
      expect(mockContext.logger.warn).toHaveBeenCalledWith(
        'HederaKit not found in context. HCS-10 tools will not be available.'
      );
    });

    test('Plugin tools have correct structure', async () => {
      const plugin = new OpenConvAIPlugin();
      
      mockContext.logger.warn = vi.fn();
      mockContext.logger.info = vi.fn();
      mockContext.logger.error = vi.fn();
      await plugin.initialize(mockContext);
      
      const tools = plugin.getTools();
      
      tools.forEach(tool => {
        expect(tool).toHaveProperty('name');
        expect(tool).toHaveProperty('description');
        expect(tool).toHaveProperty('namespace');
        expect(tool).toHaveProperty('schema');
        expect(tool).toHaveProperty('_call');
        expect(tool.namespace).toBe('hcs10');
      });
    });

    test('Plugin creates HCS10Builder and StateManager', async () => {
      const plugin = new OpenConvAIPlugin();
      
      mockContext.logger.warn = vi.fn();
      mockContext.logger.info = vi.fn();
      mockContext.logger.error = vi.fn();
      await plugin.initialize(mockContext);
      
      // Verify tools were created (which means builder was created)
      const tools = plugin.getTools();
      const registerTool = tools.find(t => t.name === 'register_agent');
      
      expect(registerTool).toBeDefined();
      expect(plugin.getStateManager()).toBeDefined();
    });
  });

  describe('Tool Names and Descriptions', () => {
    test('All tools have unique names', async () => {
      const plugin = new OpenConvAIPlugin();
      mockContext.logger.warn = vi.fn();
      mockContext.logger.info = vi.fn();
      mockContext.logger.error = vi.fn();
      await plugin.initialize(mockContext);
      
      const tools = plugin.getTools();
      const names = tools.map(t => t.name);
      const uniqueNames = new Set(names);
      
      expect(uniqueNames.size).toBe(names.length);
    });

    test('All tools have descriptive text', async () => {
      const plugin = new OpenConvAIPlugin();
      mockContext.logger.warn = vi.fn();
      mockContext.logger.info = vi.fn();
      mockContext.logger.error = vi.fn();
      await plugin.initialize(mockContext);
      
      const tools = plugin.getTools();
      
      tools.forEach(tool => {
        expect(tool.description).toBeTruthy();
        expect(tool.description.length).toBeGreaterThan(20);
        expect(tool.description).not.toContain('TODO');
        expect(tool.description).not.toContain('undefined');
      });
    });
  });

  describe('Tool Categories', () => {
    test('Tools are properly categorized', async () => {
      const plugin = new OpenConvAIPlugin();
      mockContext.logger.warn = vi.fn();
      mockContext.logger.info = vi.fn();
      mockContext.logger.error = vi.fn();
      await plugin.initialize(mockContext);
      
      const tools = plugin.getTools();
      
      const expectedTools = [
        'register_agent',
        'find_registrations',
        'retrieve_profile',
        'initiate_connection',
        'list_connections',
        'send_message_to_connection',
        'check_messages',
        'monitor_connections',
        'manage_connection_requests',
        'accept_connection_request',
        'list_unapproved_connection_requests'
      ];
      
      // Verify we have all expected tools
      expectedTools.forEach(toolName => {
        const tool = tools.find(t => t.name === toolName);
        expect(tool).toBeDefined();
      });
      
      expect(tools.length).toBe(11);
    });
  });

  describe('StateManager Integration', () => {
    test('Plugin uses context stateManager if provided', async () => {
      const customStateManager = { custom: 'state' };
      mockContext.stateManager = customStateManager;
      
      const plugin = new OpenConvAIPlugin();
      
      mockContext.logger.warn = vi.fn();
      mockContext.logger.info = vi.fn();
      mockContext.logger.error = vi.fn();
      await plugin.initialize(mockContext);
      
      const stateManager = plugin.getStateManager();
      expect(stateManager).toBe(customStateManager);
    });

    test('Plugin creates own StateManager if not provided', async () => {
      const plugin = new OpenConvAIPlugin();
      
      mockContext.logger.warn = vi.fn();
      mockContext.logger.info = vi.fn();
      mockContext.logger.error = vi.fn();
      await plugin.initialize(mockContext);
      
      const stateManager = plugin.getStateManager();
      expect(stateManager).toBeDefined();
      expect(stateManager).not.toBe(mockContext.stateManager);
    });
  });

  describe('Error Handling', () => {
    test('Plugin handles initialization errors gracefully', async () => {
      const plugin = new OpenConvAIPlugin();
      
      // Mock the initializeTools method to throw an error
      const originalInitTools = (plugin as any).initializeTools;
      (plugin as any).initializeTools = vi.fn().mockImplementation(() => {
        throw new Error('Test error during tool initialization');
      });
      
      mockContext.logger.warn = vi.fn();
      mockContext.logger.info = vi.fn();
      mockContext.logger.error = vi.fn();
      
      await plugin.initialize(mockContext);
      
      expect(mockContext.logger.error).toHaveBeenCalledWith(
        'Failed to initialize HCS-10 plugin:',
        expect.any(Error)
      );
      
      // Restore original method
      (plugin as any).initializeTools = originalInitTools;
    });
  });

  describe('Plugin Cleanup', () => {
    test('Cleanup removes tools and state', async () => {
      const plugin = new OpenConvAIPlugin();
      
      mockContext.logger.warn = vi.fn();
      mockContext.logger.info = vi.fn();
      mockContext.logger.error = vi.fn();
      
      await plugin.initialize(mockContext);
      
      // Verify tools exist before cleanup
      expect(plugin.getTools().length).toBe(11);
      expect(plugin.getStateManager()).toBeDefined();
      
      // Cleanup
      await plugin.cleanup();
      
      // Verify cleanup
      expect(plugin.getTools().length).toBe(0);
      expect(mockContext.logger.info).toHaveBeenCalledWith(
        'HCS-10 Plugin cleaned up'
      );
    });
  });
});