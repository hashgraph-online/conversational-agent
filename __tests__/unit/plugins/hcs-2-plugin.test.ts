import { describe, test, expect, beforeEach, jest } from '@jest/globals';

/**
 * Comprehensive tests for HCS2Plugin
 * Tests all public methods and initialization scenarios
 */

// Mock all the HCS2 tools and builder at module level
const mockHCS2Builder = jest.fn().mockImplementation(() => ({}));
const mockCreateRegistryTool = jest.fn().mockImplementation(() => ({
  name: 'create-registry',
  description: 'Create a new HCS-2 registry',
}));
const mockRegisterEntryTool = jest.fn().mockImplementation(() => ({
  name: 'register-entry',
  description: 'Register an entry in HCS-2 registry',
}));
const mockUpdateEntryTool = jest.fn().mockImplementation(() => ({
  name: 'update-entry',
  description: 'Update an entry in HCS-2 registry',
}));
const mockDeleteEntryTool = jest.fn().mockImplementation(() => ({
  name: 'delete-entry',
  description: 'Delete an entry from HCS-2 registry',
}));
const mockMigrateRegistryTool = jest.fn().mockImplementation(() => ({
  name: 'migrate-registry',
  description: 'Migrate HCS-2 registry',
}));
const mockQueryRegistryTool = jest.fn().mockImplementation(() => ({
  name: 'query-registry',
  description: 'Query HCS-2 registry',
}));

jest.mock('@hashgraphonline/standards-agent-kit', () => ({
  HCS2Builder: mockHCS2Builder,
  CreateRegistryTool: mockCreateRegistryTool,
  RegisterEntryTool: mockRegisterEntryTool,
  UpdateEntryTool: mockUpdateEntryTool,
  DeleteEntryTool: mockDeleteEntryTool,
  MigrateRegistryTool: mockMigrateRegistryTool,
  QueryRegistryTool: mockQueryRegistryTool,
}));

import { HCS2Plugin } from '../../../src/plugins/hcs-2/HCS2Plugin';
import type { GenericPluginContext } from 'hedera-agent-kit';
import type { Logger } from '@hashgraphonline/standards-sdk';

describe('HCS2Plugin', () => {
  let plugin: HCS2Plugin;
  let mockContext: GenericPluginContext;
  let mockLogger: Logger;
  let mockHederaKit: any;

  beforeEach(() => {
    // Clear all mock calls
    jest.clearAllMocks();
    
    mockLogger = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
    } as unknown as Logger;

    mockHederaKit = {
      initialize: jest.fn(),
      getAggregatedLangChainTools: jest.fn().mockReturnValue([]),
      operationalMode: 'returnBytes',
    };

    mockContext = {
      config: {
        hederaKit: mockHederaKit,
      },
      logger: mockLogger,
    } as unknown as GenericPluginContext;

    plugin = new HCS2Plugin();
  });

  describe('Plugin Properties', () => {
    test('should have correct plugin metadata', () => {
      expect(plugin.id).toBe('hcs-2');
      expect(plugin.name).toBe('HCS-2 Plugin');
      expect(plugin.description).toBe('HCS-2 registry management tools for decentralized registries on Hedera');
      expect(plugin.version).toBe('1.0.0');
      expect(plugin.author).toBe('Hashgraph Online');
      expect(plugin.namespace).toBe('hcs2');
    });
  });

  describe('Initialization', () => {
    test('should initialize successfully with valid context', async () => {
      await plugin.initialize(mockContext);

      expect(mockLogger.info).toHaveBeenCalledWith('HCS-2 Plugin initialized successfully');
      expect(plugin.getTools()).toHaveLength(6);
    });

    test('should warn when HederaKit is not found in context', async () => {
      const contextWithoutKit = {
        ...mockContext,
        config: {},
      } as GenericPluginContext;

      await plugin.initialize(contextWithoutKit);

      expect(mockLogger.warn).toHaveBeenCalledWith(
        'HederaKit not found in context. HCS-2 tools will not be available.'
      );
      expect(plugin.getTools()).toHaveLength(0);
    });

    test('should handle initialization errors gracefully', async () => {
      const errorContext = {
        ...mockContext,
        config: {
          hederaKit: null, // This will cause an error in initializeTools
        },
      } as GenericPluginContext;

      await plugin.initialize(errorContext);

      expect(mockLogger.error).toHaveBeenCalledWith(
        'Failed to initialize HCS-2 plugin:',
        expect.any(Error)
      );
    });

    test('should handle missing logger in error scenario', async () => {
      const contextWithoutLogger = {
        config: {
          hederaKit: null,
        },
        logger: undefined,
      } as unknown as GenericPluginContext;

      // Should throw because of the null hederaKit causing an error in initializeTools
      await expect(plugin.initialize(contextWithoutLogger)).rejects.toThrow();
    });
  });

  describe('Tools Management', () => {
    test('should return empty tools array before initialization', () => {
      expect(plugin.getTools()).toHaveLength(0);
    });

    test('should return all HCS-2 tools after successful initialization', async () => {
      await plugin.initialize(mockContext);
      const tools = plugin.getTools();

      expect(tools).toHaveLength(6);
      expect(tools).toEqual(expect.arrayContaining([
        expect.objectContaining({ name: 'create-registry' }),
        expect.objectContaining({ name: 'register-entry' }),
        expect.objectContaining({ name: 'update-entry' }),
        expect.objectContaining({ name: 'delete-entry' }),
        expect.objectContaining({ name: 'migrate-registry' }),
        expect.objectContaining({ name: 'query-registry' }),
      ]));
    });

    test('should create tools with correct configuration', async () => {
      await plugin.initialize(mockContext);

      expect(mockHCS2Builder).toHaveBeenCalledWith(mockHederaKit);
      expect(mockCreateRegistryTool).toHaveBeenCalledWith({
        hederaKit: mockHederaKit,
        hcs2Builder: expect.any(Object),
        logger: mockLogger,
      });
    });
  });

  describe('Cleanup', () => {
    test('should cleanup tools and log success', async () => {
      await plugin.initialize(mockContext);
      expect(plugin.getTools()).toHaveLength(6);

      await plugin.cleanup();

      expect(plugin.getTools()).toHaveLength(0);
      expect(mockLogger.info).toHaveBeenCalledWith('HCS-2 Plugin cleaned up');
    });

    test('should handle cleanup without context/logger', async () => {
      // Manually clear the context to test the edge case
      (plugin as any).context = null;

      await expect(plugin.cleanup()).resolves.not.toThrow();
    });

    test('should handle cleanup with missing logger', async () => {
      await plugin.initialize(mockContext);
      
      // Set context without logger
      (plugin as any).context = { logger: null };

      await expect(plugin.cleanup()).resolves.not.toThrow();
      expect(plugin.getTools()).toHaveLength(0);
    });
  });

  describe('Error Handling', () => {
    test('should handle HCS2Builder instantiation failure', async () => {
      mockHCS2Builder.mockImplementationOnce(() => {
        throw new Error('HCS2Builder instantiation failed');
      });

      await plugin.initialize(mockContext);

      expect(mockLogger.error).toHaveBeenCalledWith(
        'Failed to initialize HCS-2 plugin:',
        expect.any(Error)
      );
    });

    test('should handle tool instantiation failure', async () => {
      mockCreateRegistryTool.mockImplementationOnce(() => {
        throw new Error('Tool instantiation failed');
      });

      await plugin.initialize(mockContext);

      expect(mockLogger.error).toHaveBeenCalledWith(
        'Failed to initialize HCS-2 plugin:',
        expect.any(Error)
      );
    });
  });

  describe('Integration with BasePlugin', () => {
    test('should call parent initialize method', async () => {
      const superInitializeSpy = jest.spyOn(Object.getPrototypeOf(Object.getPrototypeOf(plugin)), 'initialize');
      
      await plugin.initialize(mockContext);

      expect(superInitializeSpy).toHaveBeenCalledWith(mockContext);
    });

    test('should call parent cleanup method', async () => {
      const superCleanupSpy = jest.spyOn(Object.getPrototypeOf(Object.getPrototypeOf(plugin)), 'cleanup');
      
      await plugin.cleanup();

      expect(superCleanupSpy).toHaveBeenCalled();
    });
  });

  describe('Context Management', () => {
    test('should store context after initialization', async () => {
      await plugin.initialize(mockContext);

      expect((plugin as any).context).toBe(mockContext);
    });

    test('should handle context with undefined config', async () => {
      const contextWithUndefinedConfig = {
        ...mockContext,
        config: undefined,
      } as unknown as GenericPluginContext;

      // Should throw because accessing context.config.hederaKit when config is undefined
      await expect(plugin.initialize(contextWithUndefinedConfig)).rejects.toThrow();
    });
  });

  describe('Tool Configuration Verification', () => {
    test('should configure all tools with required parameters', async () => {
      await plugin.initialize(mockContext);

      const expectedConfig = {
        hederaKit: mockHederaKit,
        hcs2Builder: expect.any(Object),
        logger: mockLogger,
      };

      expect(mockCreateRegistryTool).toHaveBeenCalledWith(expectedConfig);
      expect(mockRegisterEntryTool).toHaveBeenCalledWith(expectedConfig);
      expect(mockUpdateEntryTool).toHaveBeenCalledWith(expectedConfig);
      expect(mockDeleteEntryTool).toHaveBeenCalledWith(expectedConfig);
      expect(mockMigrateRegistryTool).toHaveBeenCalledWith(expectedConfig);
      expect(mockQueryRegistryTool).toHaveBeenCalledWith(expectedConfig);
    });
  });
});