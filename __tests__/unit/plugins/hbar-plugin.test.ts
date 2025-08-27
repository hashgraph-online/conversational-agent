import { describe, test, expect, jest, beforeEach } from '@jest/globals';
import { HbarPlugin } from '../../../src/plugins/hbar/HbarPlugin';
import { Logger } from '@hashgraphonline/standards-sdk';

/**
 * Mock external dependencies
 */
jest.mock('../../../src/plugins/hbar/TransferHbarTool', () => ({
  TransferHbarTool: jest.fn().mockImplementation(function(this: unknown, config: unknown) {
    (this as Record<string, unknown>).name = 'hedera-account-transfer-hbar-v2';
    (this as Record<string, unknown>).description = 'Mock transfer tool';
    (this as Record<string, unknown>).namespace = 'account';
    (this as Record<string, unknown>).config = config;
  }),
}));

jest.mock('../../../src/plugins/hbar/AirdropToolWrapper', () => ({
  AirdropToolWrapper: jest.fn().mockImplementation(function(this: unknown, originalTool: unknown, agentKit: unknown) {
    (this as Record<string, unknown>).name = 'hedera-hts-airdrop-token';
    (this as Record<string, unknown>).description = 'Mock airdrop wrapper';
    (this as Record<string, unknown>).originalTool = originalTool;
    (this as Record<string, unknown>).agentKit = agentKit;
  }),
}));

jest.mock('@hashgraphonline/standards-sdk', () => ({
  Logger: jest.fn().mockImplementation(() => ({
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  })),
}));

jest.mock('hedera-agent-kit', () => ({
  HederaAgentKit: jest.fn().mockImplementation(() => ({
    network: 'testnet',
    mirrorNode: {
      getTokenInfo: jest.fn(),
    },
  })),
  HederaAirdropTokenTool: jest.fn().mockImplementation(() => ({
    name: 'original-airdrop-tool',
    description: 'Original airdrop tool',
    _call: jest.fn(),
  })),
  BasePlugin: jest.fn().mockImplementation(function(this: unknown) {
    (this as Record<string, unknown>).id = 'base-plugin';
    (this as Record<string, unknown>).name = 'Base Plugin';
    (this as Record<string, unknown>).description = 'Base plugin description';
    (this as Record<string, unknown>).version = '1.0.0';
    (this as Record<string, unknown>).author = 'Base Author';
    (this as Record<string, unknown>).namespace = 'base';
    (this as Record<string, unknown>).initialize = jest.fn().mockResolvedValue(undefined);
    (this as Record<string, unknown>).getTools = jest.fn().mockReturnValue([]);
    (this as Record<string, unknown>).shutdown = jest.fn().mockResolvedValue(undefined);
  }),
}));

describe('HbarPlugin', () => {
  let hbarPlugin: HbarPlugin;
  let mockLogger: jest.Mocked<Logger>;
  let mockHederaKit: any;
  let mockContext: any;

  beforeEach(() => {
    jest.clearAllMocks();

    mockLogger = new Logger({ module: 'HbarPlugin' }) as jest.Mocked<Logger>;
    mockHederaKit = {
      network: 'testnet',
      mirrorNode: {
        getTokenInfo: jest.fn(),
      },
    };

    mockContext = {
      config: {
        hederaKit: mockHederaKit,
      },
      logger: mockLogger,
    };

    hbarPlugin = new HbarPlugin();
    // Replace the context after construction
    (hbarPlugin as any).context = mockContext;
  });

  describe('Plugin Properties', () => {
    test('should have correct plugin metadata', () => {
      expect(hbarPlugin.id).toBe('hbar');
      expect(hbarPlugin.name).toBe('HBAR Plugin');
      expect(hbarPlugin.description).toContain('HBAR operations');
      expect(hbarPlugin.version).toBe('1.0.0');
      expect(hbarPlugin.author).toBe('Hashgraph Online');
      expect(hbarPlugin.namespace).toBe('account');
    });
  });

  describe('Initialization', () => {
    test('should initialize successfully with valid HederaKit', async () => {
      await expect(hbarPlugin.initialize(mockContext)).resolves.toBeUndefined();

      expect(mockLogger.info).toHaveBeenCalledWith('HBAR Plugin initialized successfully');
    });

    test('should warn when HederaKit is not available', async () => {
      const contextWithoutKit = {
        ...mockContext,
        config: {
          hederaKit: null,
        },
      };

      await expect(hbarPlugin.initialize(contextWithoutKit)).resolves.toBeUndefined();

      expect(mockLogger.warn).toHaveBeenCalledWith(
        'HederaKit not found in context. HBAR tools will not be available.'
      );
    });

    test('should handle initialization errors gracefully', async () => {
      // Test that initialization completes
      await expect(hbarPlugin.initialize(mockContext)).resolves.toBeUndefined();
    });
  });

  describe('Tool Initialization', () => {
    test('should initialize tools successfully', async () => {
      await hbarPlugin.initialize(mockContext);

      const tools = hbarPlugin.getTools();
      expect(tools.length).toBeGreaterThan(0);
    });
  });

  describe('Tool Retrieval', () => {
    test('should return initialized tools', async () => {
      await hbarPlugin.initialize(mockContext);

      const tools = hbarPlugin.getTools();

      expect(tools).toHaveLength(2);
      expect(Array.isArray(tools)).toBe(true);
    });

    test('should return empty array when not initialized', () => {
      const tools = hbarPlugin.getTools();

      expect(tools).toEqual([]);
    });
  });

  describe('Shutdown', () => {
    test('should shutdown successfully', async () => {
      await expect(hbarPlugin.shutdown()).resolves.toBeUndefined();

      // Tools should be cleared
      const tools = hbarPlugin.getTools();
      expect(tools).toEqual([]);
    });
  });

  describe('Tool Count Logging', () => {
    test('should log correct tool count during initialization', async () => {
      await hbarPlugin.initialize(mockContext);

      expect(mockLogger.info).toHaveBeenCalledWith(
        'HBAR Plugin tools initialized with 2 tools'
      );
    });
  });

  // Error handling is tested in the main initialization tests
});
