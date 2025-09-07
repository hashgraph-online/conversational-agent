import { HbarPlugin } from '../../src/plugins/hbar/HbarPlugin';
import { TransferHbarTool } from '../../src/plugins/hbar/TransferHbarTool';
import { AirdropToolWrapper } from '../../src/plugins/hbar/AirdropToolWrapper';
import {
  GenericPluginContext,
  HederaAgentKit,
  HederaAirdropTokenTool,
  Logger,
} from 'hedera-agent-kit';

jest.mock('../../src/plugins/hbar/TransferHbarTool');
jest.mock('../../src/plugins/hbar/AirdropToolWrapper');
jest.mock('hedera-agent-kit', () => ({
  BasePlugin: class BasePlugin {
    context: any;
    async initialize(context: any) {
      this.context = context;
    }
    getTools() {
      return [];
    }
  },
  BaseServiceBuilder: class BaseServiceBuilder {
    constructor(hederaKit: any) {}
  },
  BaseHederaTransactionTool: class BaseHederaTransactionTool {
    constructor() {}
  },
  HederaAirdropTokenTool: jest.fn(),
}));

const mockTransferHbarTool = TransferHbarTool as jest.MockedClass<typeof TransferHbarTool>;
const mockAirdropToolWrapper = AirdropToolWrapper as jest.MockedClass<typeof AirdropToolWrapper>;
const mockHederaAirdropTokenTool = HederaAirdropTokenTool as jest.MockedClass<typeof HederaAirdropTokenTool>;

describe('HbarPlugin', () => {
  let plugin: HbarPlugin;
  let mockContext: jest.Mocked<GenericPluginContext>;
  let mockHederaKit: jest.Mocked<HederaAgentKit>;
  let mockLogger: jest.Mocked<Logger>;

  beforeEach(() => {
    jest.clearAllMocks();

    mockLogger = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
    } as any;

    mockHederaKit = {
    } as any;

    mockContext = {
      config: {
        hederaKit: mockHederaKit,
      },
      logger: mockLogger,
    } as any;

    plugin = new HbarPlugin();
  });

  describe('plugin properties', () => {
    it('should have correct plugin metadata', () => {
      expect(plugin.id).toBe('hbar');
      expect(plugin.name).toBe('HBAR Plugin');
      expect(plugin.description).toContain('HBAR operations');
      expect(plugin.version).toBe('1.0.0');
      expect(plugin.author).toBe('Hashgraph Online');
      expect(plugin.namespace).toBe('account');
    });
  });

  describe('initialize', () => {
    it('should initialize successfully with HederaKit', async () => {
      await plugin.initialize(mockContext);

      expect(mockTransferHbarTool).toHaveBeenCalledWith({
        hederaKit: mockHederaKit,
        logger: mockLogger,
      });
      expect(mockHederaAirdropTokenTool).toHaveBeenCalledWith({
        hederaKit: mockHederaKit,
        logger: mockLogger,
      });
      expect(mockAirdropToolWrapper).toHaveBeenCalled();
      expect(mockLogger.info).toHaveBeenCalledWith('HBAR Plugin initialized successfully');
    });

    it('should warn when HederaKit is not available', async () => {
      const contextWithoutKit = {
        ...mockContext,
        config: {},
      };

      await plugin.initialize(contextWithoutKit);

      expect(mockLogger.warn).toHaveBeenCalledWith(
        'HederaKit not found in context. HBAR tools will not be available.'
      );
      expect(mockTransferHbarTool).not.toHaveBeenCalled();
    });

    it('should handle initialization errors gracefully', async () => {
      mockTransferHbarTool.mockImplementation(() => {
        throw new Error('Failed to create transfer tool');
      });

      await plugin.initialize(mockContext);

      expect(mockLogger.error).toHaveBeenCalledWith(
        'Failed to initialize HBAR plugin:',
        expect.any(Error)
      );
    });

    it('should handle airdrop tool creation errors', async () => {
      mockHederaAirdropTokenTool.mockImplementation(() => {
        throw new Error('Failed to create airdrop tool');
      });

      await plugin.initialize(mockContext);

      expect(mockLogger.error).toHaveBeenCalledWith(
        'Error creating airdrop tool wrapper:',
        expect.any(Error)
      );
      expect(mockLogger.info).toHaveBeenCalledWith(
        'HBAR Plugin tools initialized with 1 tools'
      );
    });
  });

  describe('getTools', () => {
    beforeEach(async () => {
      await plugin.initialize(mockContext);
    });

    it('should return initialized tools', () => {
      const tools = plugin.getTools();
      expect(tools).toBeDefined();
      expect(Array.isArray(tools)).toBe(true);
    });

    it('should return empty array before initialization', () => {
      const uninitializedPlugin = new HbarPlugin();
      const tools = uninitializedPlugin.getTools();
      expect(tools).toEqual([]);
    });
  });

  describe('shutdown', () => {
    beforeEach(async () => {
      await plugin.initialize(mockContext);
    });

    it('should clear tools array', async () => {
      expect(plugin.getTools().length).toBeGreaterThan(0);
      
      await plugin.shutdown();
      
      expect(plugin.getTools()).toEqual([]);
    });
  });

  describe('private methods', () => {
    it('should handle HederaKit not found error in initializeTools', async () => {
      const contextWithoutKit = {
        ...mockContext,
        config: {},
      };

      await plugin.initialize(contextWithoutKit);

      expect(mockLogger.warn).toHaveBeenCalledWith(
        'HederaKit not found in context. HBAR tools will not be available.'
      );
    });

    it('should log tool count after initialization', async () => {
      await plugin.initialize(mockContext);

      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringMatching(/HBAR Plugin tools initialized with \d+ tools/)
      );
    });

    it('should create wrapper for airdrop tool', async () => {
      const mockAirdropTool = {};
      mockHederaAirdropTokenTool.mockReturnValue(mockAirdropTool as any);

      await plugin.initialize(mockContext);

      expect(mockLogger.info).toHaveBeenCalledWith(
        'Creating wrapper for passed original airdrop tool'
      );
      expect(mockAirdropToolWrapper).toHaveBeenCalledWith(
        mockAirdropTool,
        mockHederaKit
      );
      expect(mockLogger.info).toHaveBeenCalledWith(
        'Added wrapped airdrop tool to HBAR Plugin'
      );
    });
  });

  describe('error handling', () => {
    it('should handle missing HederaKit gracefully', async () => {
      const contextWithNullKit = {
        ...mockContext,
        config: { hederaKit: null },
      };

      await plugin.initialize(contextWithNullKit);

      expect(mockLogger.warn).toHaveBeenCalledWith(
        'HederaKit not found in context. HBAR tools will not be available.'
      );
    });

    it('should handle undefined context config', async () => {
      const contextWithoutConfig = {
        ...mockContext,
        config: undefined as any,
      };

      await plugin.initialize(contextWithoutConfig);

      expect(mockLogger.warn).toHaveBeenCalledWith(
        'HederaKit not found in context. HBAR tools will not be available.'
      );
    });

    it('should continue with transfer tool even if airdrop wrapper fails', async () => {
      mockAirdropToolWrapper.mockImplementation(() => {
        throw new Error('Wrapper creation failed');
      });

      await plugin.initialize(mockContext);

      expect(mockTransferHbarTool).toHaveBeenCalled();
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Error creating airdrop tool wrapper:',
        expect.any(Error)
      );
      expect(mockLogger.info).toHaveBeenCalledWith(
        'HBAR Plugin tools initialized with 1 tools'
      );
    });
  });
});