import { describe, test, expect, beforeEach, jest } from '@jest/globals';

/**
 * Comprehensive tests for InscribePlugin
 * Tests all public methods and initialization scenarios
 */

// Mock all the Inscribe tools and builder at module level
const mockInscriberBuilder = jest.fn().mockImplementation(() => ({}));
const mockInscribeFromUrlTool = jest.fn().mockImplementation(() => ({
  name: 'inscribe-from-url',
  description: 'Inscribe from URL tool',
}));
const mockInscribeFromFileTool = jest.fn().mockImplementation(() => ({
  name: 'inscribe-from-file',
  description: 'Inscribe from file tool',
}));
const mockInscribeFromBufferTool = jest.fn().mockImplementation(() => ({
  name: 'inscribe-from-buffer',
  description: 'Inscribe from buffer tool',
}));
const mockInscribeHashinalTool = jest.fn().mockImplementation(() => ({
  name: 'inscribe-hashinal',
  description: 'Inscribe hashinal tool',
}));
const mockRetrieveInscriptionTool = jest.fn().mockImplementation(() => ({
  name: 'retrieve-inscription',
  description: 'Retrieve inscription tool',
}));

jest.mock('@hashgraphonline/standards-agent-kit', () => ({
  InscriberBuilder: mockInscriberBuilder,
  InscribeFromUrlTool: mockInscribeFromUrlTool,
  InscribeFromFileTool: mockInscribeFromFileTool,
  InscribeFromBufferTool: mockInscribeFromBufferTool,
  InscribeHashinalTool: mockInscribeHashinalTool,
  RetrieveInscriptionTool: mockRetrieveInscriptionTool,
}));

jest.mock('@hashgraphonline/standards-sdk', () => ({
  Logger: jest.fn().mockImplementation(() => ({
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  })),
}));

import { InscribePlugin } from '../../../../src/plugins/inscribe/InscribePlugin';
import type { GenericPluginContext } from 'hedera-agent-kit';
import type { Logger } from '@hashgraphonline/standards-sdk';

describe('InscribePlugin', () => {
  let plugin: InscribePlugin;
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

    plugin = new InscribePlugin();
  });

  describe('Plugin Properties', () => {
    test('should have correct plugin metadata', () => {
      expect(plugin.id).toBe('inscribe');
      expect(plugin.name).toBe('Inscribe Plugin');
      expect(plugin.description).toContain('Content inscription tools');
      expect(plugin.version).toBe('1.0.0');
      expect(plugin.author).toBe('Hashgraph Online');
      expect(plugin.namespace).toBe('inscribe');
    });
  });

  describe('Initialization', () => {
    test('should initialize successfully with valid context', async () => {
      await plugin.initialize(mockContext);

      expect(mockLogger.info).toHaveBeenCalledWith('Inscribe Plugin initialized successfully');
      expect(plugin.getTools()).toHaveLength(5);
    });

    test('should warn when HederaKit is not found in context', async () => {
      mockContext.config.hederaKit = undefined;

      await plugin.initialize(mockContext);

      expect(mockLogger.warn).toHaveBeenCalledWith(
        'HederaKit not found in context. Inscription tools will not be available.'
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
        'Failed to initialize Inscribe plugin:',
        expect.any(Error)
      );
    });
  });

  describe('Tools Management', () => {
    beforeEach(async () => {
      await plugin.initialize(mockContext);
    });

    test('should return all 5 inscription tools when properly initialized', () => {
      const tools = plugin.getTools();

      expect(tools).toHaveLength(5);

      expect(mockInscriberBuilder).toHaveBeenCalledWith(mockHederaKit);
      expect(mockInscribeFromUrlTool).toHaveBeenCalled();
      expect(mockInscribeFromFileTool).toHaveBeenCalled();
      expect(mockInscribeFromBufferTool).toHaveBeenCalled();
      expect(mockInscribeHashinalTool).toHaveBeenCalled();
      expect(mockRetrieveInscriptionTool).toHaveBeenCalled();
    });

    test('should return empty tools array when not initialized', () => {
      const uninitializedPlugin = new InscribePlugin();

      const tools = uninitializedPlugin.getTools();

      expect(tools).toHaveLength(0);
    });

    test('should create tools with correct configuration', async () => {
      const tools = plugin.getTools();

      expect(tools).toHaveLength(5);
      expect(tools).toEqual(expect.arrayContaining([
        expect.objectContaining({ name: 'inscribe-from-url' }),
        expect.objectContaining({ name: 'inscribe-from-file' }),
        expect.objectContaining({ name: 'inscribe-from-buffer' }),
        expect.objectContaining({ name: 'inscribe-hashinal' }),
        expect.objectContaining({ name: 'retrieve-inscription' }),
      ]));
    });
  });

  describe('Cleanup', () => {
    test('should cleanup tools and log success', async () => {
      await plugin.initialize(mockContext);
      expect(plugin.getTools()).toHaveLength(5);

      await plugin.cleanup();

      expect(plugin.getTools()).toHaveLength(0);
      expect(mockLogger.info).toHaveBeenCalledWith('Inscribe Plugin cleaned up');
    });

    test('should handle cleanup without context/logger', async () => {
      plugin['context'] = undefined;

      await expect(plugin.cleanup()).resolves.not.toThrow();
    });
  });

  describe('Tool Count Validation', () => {
    test('should create exactly 5 tools', async () => {
      await plugin.initialize(mockContext);

      const tools = plugin.getTools();

      expect(tools).toHaveLength(5);

      // Verify each tool has the expected properties
      tools.forEach((tool: any) => {
        expect(tool).toHaveProperty('name');
        expect(tool).toHaveProperty('description');
        expect(typeof tool.name).toBe('string');
        expect(typeof tool.description).toBe('string');
      });
    });
  });
});



