import { describe, test, expect, beforeEach, jest } from '@jest/globals';
import { TEST_ACCOUNT_IDS, TEST_NETWORKS, TEST_MOCK_CONSTANTS } from '../../../test-constants';

// Mock Hedera SDK to prevent the 'Finite' error
jest.mock('@hashgraph/sdk', () => ({
  Hbar: {
    fromString: jest.fn(),
    fromTinybars: jest.fn(),
    MaxTransactionFee: { _asTinybars: BigInt(1000000) },
  },
  HbarUnit: {
    Tinybar: 'Tinybar',
    Microbar: 'Microbar',
    Millibar: 'Millibar', 
    Hbar: 'Hbar',
    Kilobar: 'Kilobar',
    Megabar: 'Megabar',
    Gigabar: 'Gigabar',
  },
  AccountId: {
    fromString: jest.fn(),
  },
  PublicKey: {
    fromString: jest.fn(),
  },
}));

jest.mock('@hashgraphonline/standards-sdk', () => ({
  Logger: jest.fn().mockImplementation(() => ({
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  })),
  HCS10Client: jest.fn(),
}));

jest.mock('@hashgraphonline/standards-agent-kit', () => ({
  OpenConvaiState: jest.fn(),
  HCS10Builder: jest.fn(),
  RegisterAgentTool: jest.fn(),
  FindRegistrationsTool: jest.fn(),
  InitiateConnectionTool: jest.fn(),
  ListConnectionsTool: jest.fn(),
  SendMessageToConnectionTool: jest.fn(),
  CheckMessagesTool: jest.fn(),
  ConnectionMonitorTool: jest.fn(),
  ManageConnectionRequestsTool: jest.fn(),
  AcceptConnectionRequestTool: jest.fn(),
  RetrieveProfileTool: jest.fn(),
  ListUnapprovedConnectionRequestsTool: jest.fn(),
}));

jest.mock('hedera-agent-kit', () => ({
  BasePlugin: class MockBasePlugin {
    id = '';
    name = '';
    description = '';
    version = '';
    author = '';
    namespace = '';
    context?: MockGenericPluginContext;
    async initialize(context: MockGenericPluginContext) {
      this.context = context;
    }
    async cleanup() {}
  },
}));

import { HCS10Plugin } from '../../../../src/plugins/hcs-10/HCS10Plugin';

interface MockLogger {
  info: jest.Mock;
  warn: jest.Mock;
  error: jest.Mock;
  debug: jest.Mock;
}

interface MockSigner {
  getAccountId: jest.Mock;
  getOperatorPrivateKey: jest.Mock;
}

interface MockHederaKit {
  signer: MockSigner;
  network: string;
}

interface MockStateManager {
  setCurrentAgent: jest.Mock;
  getCurrentAgent: jest.Mock;
  getConnectionsManager: jest.Mock;
  initializeConnectionsManager?: jest.Mock;
}

interface MockGenericPluginContext {
  config: {
    hederaKit?: MockHederaKit;
    stateManager?: MockStateManager;
  };
  logger: MockLogger;
  stateManager?: MockStateManager;
}

interface MockHCS10Client {
  retrieveProfile: jest.Mock;
}

describe('HCS10Plugin', () => {
  let plugin: HCS10Plugin;
  let mockHederaKit: MockHederaKit;
  let mockStateManager: MockStateManager;
  let mockContext: MockGenericPluginContext;
  let mockLogger: MockLogger;
  let mockHCS10Client: MockHCS10Client;

  beforeEach(() => {
    jest.clearAllMocks();

    mockLogger = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
    };

    const mockSigner = {
      getAccountId: jest.fn().mockReturnValue({
        toString: () => TEST_ACCOUNT_IDS.USER_ACCOUNT
      }),
      getOperatorPrivateKey: jest.fn().mockReturnValue({
        toString: () => TEST_MOCK_CONSTANTS.MOCK_PRIVATE_KEY_STRING,
        toStringRaw: () => TEST_MOCK_CONSTANTS.MOCK_PRIVATE_KEY_RAW
      })
    };

    mockHederaKit = {
      signer: mockSigner,
      network: TEST_NETWORKS.TESTNET,
    };

    mockStateManager = {
      setCurrentAgent: jest.fn(),
      getCurrentAgent: jest.fn(),
      getConnectionsManager: jest.fn().mockReturnValue(null),
      initializeConnectionsManager: jest.fn(),
    };

    mockHCS10Client = {
      retrieveProfile: jest.fn().mockResolvedValue({
        success: true,
        topicInfo: {
          inboundTopic: '0.0.1001',
          outboundTopic: '0.0.1002'
        }
      })
    };

    const { HCS10Client } = require('@hashgraphonline/standards-sdk');
    const { OpenConvaiState } = require('@hashgraphonline/standards-agent-kit');

    HCS10Client.mockImplementation(() => mockHCS10Client);
    OpenConvaiState.mockImplementation(() => mockStateManager);

    mockContext = {
      config: {
        hederaKit: mockHederaKit,
        stateManager: undefined
      },
      logger: mockLogger,
      stateManager: undefined
    };

    plugin = new HCS10Plugin();
  });

  describe('initialization', () => {
    test('should initialize successfully with valid HederaKit', async () => {
      await plugin.initialize(mockContext);

      expect(mockLogger.info).toHaveBeenCalledWith('HCS-10 Plugin initialized successfully');
      expect(mockStateManager.setCurrentAgent).toHaveBeenCalledWith(
        expect.objectContaining({
          name: `Agent ${TEST_ACCOUNT_IDS.USER_ACCOUNT}`,
          accountId: TEST_ACCOUNT_IDS.USER_ACCOUNT,
          inboundTopicId: '0.0.1001',
          outboundTopicId: '0.0.1002',
          privateKey: TEST_MOCK_CONSTANTS.MOCK_PRIVATE_KEY_RAW
        })
      );
    });

    test('should handle missing HederaKit gracefully', async () => {
      mockContext.config.hederaKit = undefined;

      await plugin.initialize(mockContext);

      expect(mockLogger.warn).toHaveBeenCalledWith(
        'HederaKit not found in context. HCS-10 tools will not be available.'
      );
      expect(plugin.getTools()).toHaveLength(0);
    });

    test('should use provided StateManager from context', async () => {
      mockContext.stateManager = mockStateManager;

      await plugin.initialize(mockContext);

      expect(mockStateManager.setCurrentAgent).toHaveBeenCalled();
      expect(plugin.getStateManager()).toBe(mockStateManager);
    });

    test('should use provided StateManager from config', async () => {
      mockContext.config.stateManager = mockStateManager;

      await plugin.initialize(mockContext);

      expect(mockStateManager.setCurrentAgent).toHaveBeenCalled();
      expect(plugin.getStateManager()).toBe(mockStateManager);
    });

    test('should create default OpenConvaiState when no StateManager provided', async () => {
      const { OpenConvaiState } = require('@hashgraphonline/standards-agent-kit');
      await plugin.initialize(mockContext);

      expect(OpenConvaiState).toHaveBeenCalled();
      expect(plugin.getStateManager()).toBeDefined();
    });

    test('should handle profile retrieval failure gracefully', async () => {
      mockHCS10Client.retrieveProfile.mockRejectedValue(new Error('Profile retrieval failed'));

      await plugin.initialize(mockContext);

      expect(mockLogger.warn).toHaveBeenCalledWith(
        'Could not retrieve profile topics:',
        expect.any(Error)
      );
      expect(mockStateManager.setCurrentAgent).toHaveBeenCalledWith(
        expect.objectContaining({
          inboundTopicId: '',
          outboundTopicId: ''
        })
      );
    });

    test('should initialize ConnectionsManager when StateManager supports it', async () => {
      await plugin.initialize(mockContext);

      expect(mockStateManager.initializeConnectionsManager).toHaveBeenCalledWith(mockHCS10Client);
      expect(mockLogger.info).toHaveBeenCalledWith(
        'ConnectionsManager initialized in HCS10Plugin'
      );
    });

    test('should handle ConnectionsManager initialization failure', async () => {
      const mockStateManagerWithoutCM = {
        ...mockStateManager,
        initializeConnectionsManager: undefined
      };
      const { OpenConvaiState } = require('@hashgraphonline/standards-agent-kit');
      OpenConvaiState.mockImplementation(() => mockStateManagerWithoutCM);

      await plugin.initialize(mockContext);

      expect(mockLogger.warn).toHaveBeenCalledWith(
        'StateManager does not support connection manager initialization'
      );
    });

    test('should handle general initialization errors', async () => {
      mockHederaKit.signer.getAccountId.mockImplementation(() => {
        throw new Error('Signer error');
      });

      await plugin.initialize(mockContext);

      expect(mockLogger.error).toHaveBeenCalledWith(
        'Failed to initialize HCS-10 plugin:',
        expect.any(Error)
      );
    });
  });

  describe('tool management', () => {
    beforeEach(async () => {
      await plugin.initialize(mockContext);
    });

    test('should return all 11 HCS-10 tools when properly initialized', () => {
      const tools = plugin.getTools();

      expect(tools).toHaveLength(11);
      
      const {
        RegisterAgentTool,
        FindRegistrationsTool,
        RetrieveProfileTool,
        InitiateConnectionTool,
        ListConnectionsTool,
        SendMessageToConnectionTool,
        CheckMessagesTool,
        ConnectionMonitorTool,
        ManageConnectionRequestsTool,
        AcceptConnectionRequestTool,
        ListUnapprovedConnectionRequestsTool
      } = require('@hashgraphonline/standards-agent-kit');

      expect(RegisterAgentTool).toHaveBeenCalled();
      expect(FindRegistrationsTool).toHaveBeenCalled();
      expect(RetrieveProfileTool).toHaveBeenCalled();
      expect(InitiateConnectionTool).toHaveBeenCalled();
      expect(ListConnectionsTool).toHaveBeenCalled();
      expect(SendMessageToConnectionTool).toHaveBeenCalled();
      expect(CheckMessagesTool).toHaveBeenCalled();
      expect(ConnectionMonitorTool).toHaveBeenCalled();
      expect(ManageConnectionRequestsTool).toHaveBeenCalled();
      expect(AcceptConnectionRequestTool).toHaveBeenCalled();
      expect(ListUnapprovedConnectionRequestsTool).toHaveBeenCalled();
    });

    test('should return empty tools array when not initialized', () => {
      const uninitializedPlugin = new HCS10Plugin();

      const tools = uninitializedPlugin.getTools();

      expect(tools).toHaveLength(0);
    });

    test('should throw error when initializing tools without StateManager', async () => {
      const pluginWithoutStateManager = new HCS10Plugin();
      pluginWithoutStateManager['stateManager'] = undefined;

      expect(() => pluginWithoutStateManager['initializeTools']()).toThrow(
        'StateManager must be initialized before creating tools'
      );
    });

    test('should throw error when initializing tools without HederaKit', async () => {
      const pluginWithoutHederaKit = new HCS10Plugin();
      const contextWithoutHederaKit = {
        ...mockContext,
        config: { ...mockContext.config, hederaKit: undefined }
      };
      
      pluginWithoutHederaKit['stateManager'] = mockStateManager;
      pluginWithoutHederaKit['context'] = contextWithoutHederaKit;

      expect(() => pluginWithoutHederaKit['initializeTools']()).toThrow(
        'HederaKit not found in context config'
      );
    });
  });

  describe('private key extraction', () => {
    test('should extract private key using toStringRaw method', async () => {
      await plugin.initialize(mockContext);

      expect(mockStateManager.setCurrentAgent).toHaveBeenCalledWith(
        expect.objectContaining({
          privateKey: TEST_MOCK_CONSTANTS.MOCK_PRIVATE_KEY_RAW
        })
      );
    });

    test('should fallback to toString method when toStringRaw unavailable', async () => {
      const mockSignerWithToString = {
        getAccountId: jest.fn().mockReturnValue({
          toString: () => TEST_ACCOUNT_IDS.USER_ACCOUNT
        }),
        getOperatorPrivateKey: jest.fn().mockReturnValue({
          toString: () => 'mock-private-key-toString'
        })
      };
      mockHederaKit.signer = mockSignerWithToString;

      await plugin.initialize(mockContext);

      expect(mockStateManager.setCurrentAgent).toHaveBeenCalledWith(
        expect.objectContaining({
          privateKey: 'mock-private-key-toString'
        })
      );
    });

    test('should convert to string when neither toStringRaw nor toString available', async () => {
      const mockSignerWithRawValue = {
        getAccountId: jest.fn().mockReturnValue({
          toString: () => TEST_ACCOUNT_IDS.USER_ACCOUNT
        }),
        getOperatorPrivateKey: jest.fn().mockReturnValue('raw-key-value')
      };
      mockHederaKit.signer = mockSignerWithRawValue;

      await plugin.initialize(mockContext);

      expect(mockStateManager.setCurrentAgent).toHaveBeenCalledWith(
        expect.objectContaining({
          privateKey: 'raw-key-value'
        })
      );
    });
  });

  describe('plugin metadata', () => {
    test('should have correct plugin metadata', () => {
      expect(plugin.id).toBe('hcs-10');
      expect(plugin.name).toBe('HCS-10 Plugin');
      expect(plugin.description).toContain('HCS-10 agent tools for decentralized agent registration');
      expect(plugin.version).toBe('1.0.0');
      expect(plugin.author).toBe('Hashgraph Online');
      expect(plugin.namespace).toBe('hcs10');
    });
  });

  describe('cleanup', () => {
    test('should cleanup resources properly', async () => {
      await plugin.initialize(mockContext);
      expect(plugin.getTools()).toHaveLength(11);
      expect(plugin.getStateManager()).toBeDefined();

      await plugin.cleanup();

      expect(plugin.getTools()).toHaveLength(0);
      expect(plugin.getStateManager()).toBeUndefined();
      expect(mockLogger.info).toHaveBeenCalledWith('HCS-10 Plugin cleaned up');
    });

    test('should handle cleanup without context gracefully', async () => {
      plugin['context'] = undefined;

      await expect(plugin.cleanup()).resolves.not.toThrow();
    });
  });

  describe('state manager access', () => {
    test('should provide access to StateManager', async () => {
      await plugin.initialize(mockContext);
      const stateManager = plugin.getStateManager();

      expect(stateManager).toBeDefined();
      expect(stateManager).toBe(mockStateManager);
    });

    test('should return undefined StateManager when not initialized', () => {
      const uninitializedPlugin = new HCS10Plugin();

      const stateManager = uninitializedPlugin.getStateManager();

      expect(stateManager).toBeUndefined();
    });
  });

  describe('profile topic configuration', () => {
    test('should set profile topics when successfully retrieved', async () => {
      mockHCS10Client.retrieveProfile.mockResolvedValue({
        success: true,
        topicInfo: {
          inboundTopic: '0.0.2001',
          outboundTopic: '0.0.2002'
        }
      });

      await plugin.initialize(mockContext);

      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining('Set current agent: 0.0.123 with topics 0.0.2001/0.0.2002')
      );
    });

    test('should handle profile retrieval with no topic info', async () => {
      mockHCS10Client.retrieveProfile.mockResolvedValue({
        success: true,
        topicInfo: null
      });

      await plugin.initialize(mockContext);

      expect(mockStateManager.setCurrentAgent).toHaveBeenCalledWith(
        expect.objectContaining({
          inboundTopicId: '',
          outboundTopicId: ''
        })
      );
    });

    test('should handle profile retrieval failure', async () => {
      mockHCS10Client.retrieveProfile.mockResolvedValue({
        success: false,
        topicInfo: null
      });

      await plugin.initialize(mockContext);

      expect(mockStateManager.setCurrentAgent).toHaveBeenCalledWith(
        expect.objectContaining({
          inboundTopicId: '',
          outboundTopicId: ''
        })
      );
    });
  });
});