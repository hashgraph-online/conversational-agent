import { describe, test, expect, beforeEach, jest } from '@jest/globals';

/**
 * Comprehensive tests for HCS2Plugin
 * Tests all public methods and initialization scenarios
 */

const mockHCS2Builder = jest.fn().mockImplementation(() => ({}));
const mockCreateRegistryTool = jest.fn().mockImplementation(() => ({
  name: 'create-registry',
  description: 'Create registry tool',
}));
const mockRegisterEntryTool = jest.fn().mockImplementation(() => ({
  name: 'register-entry',
  description: 'Register entry tool',
}));
const mockUpdateEntryTool = jest.fn().mockImplementation(() => ({
  name: 'update-entry',
  description: 'Update entry tool',
}));
const mockDeleteEntryTool = jest.fn().mockImplementation(() => ({
  name: 'delete-entry',
  description: 'Delete entry tool',
}));
const mockMigrateRegistryTool = jest.fn().mockImplementation(() => ({
  name: 'migrate-registry',
  description: 'Migrate registry tool',
}));
const mockQueryRegistryTool = jest.fn().mockImplementation(() => ({
  name: 'query-registry',
  description: 'Query registry tool',
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

jest.mock('@hashgraphonline/standards-sdk', () => ({
  Logger: jest.fn().mockImplementation(() => ({
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  })),
}));

import { HCS2Plugin } from '../../../../src/plugins/hcs-2/HCS2Plugin';
import type { GenericPluginContext } from 'hedera-agent-kit';
import type { Logger } from '@hashgraphonline/standards-sdk';

describe('HCS2Plugin', () => {
  let plugin: HCS2Plugin;
  let mockContext: GenericPluginContext;
  let mockLogger: Logger;
  let mockHederaKit: any;

  beforeEach(() => {
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
      expect(plugin.description).toContain('HCS-2 registry management tools');
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
      mockContext.config.hederaKit = undefined;

      await plugin.initialize(mockContext);

      expect(mockLogger.warn).toHaveBeenCalledWith(
        'HederaKit not found in context. HCS-2 tools will not be available.'
      );
      expect(plugin.getTools()).toHaveLength(0);
    });

    test('should handle initialization errors gracefully', async () => {
      const errorContext = {
        ...mockContext,
        config: { ...mockContext.config, hederaKit: null }
      };

      await plugin.initialize(errorContext);

      expect(mockLogger.error).toHaveBeenCalledWith(
        'Failed to initialize HCS-2 plugin:',
        expect.any(Error)
      );
    });
  });

  describe('Tools Management', () => {
    beforeEach(async () => {
      await plugin.initialize(mockContext);
    });

    test('should return all 6 HCS-2 tools when properly initialized', () => {
      const tools = plugin.getTools();

      expect(tools).toHaveLength(6);

      expect(mockHCS2Builder).toHaveBeenCalledWith(mockHederaKit);
      expect(mockCreateRegistryTool).toHaveBeenCalled();
      expect(mockRegisterEntryTool).toHaveBeenCalled();
      expect(mockUpdateEntryTool).toHaveBeenCalled();
      expect(mockDeleteEntryTool).toHaveBeenCalled();
      expect(mockMigrateRegistryTool).toHaveBeenCalled();
      expect(mockQueryRegistryTool).toHaveBeenCalled();
    });

    test('should return empty tools array when not initialized', () => {
      const uninitializedPlugin = new HCS2Plugin();

      const tools = uninitializedPlugin.getTools();

      expect(tools).toHaveLength(0);
    });

    test('should create tools with correct configuration', async () => {
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
      plugin['context'] = undefined;

      await expect(plugin.cleanup()).resolves.not.toThrow();
    });
  });
});
