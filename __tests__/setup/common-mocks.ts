/**
 * Common mock setup for all test files
 * This provides consistent mocking across the test suite
 */

export const commonMocks = {
  '@hashgraph/sdk': () => ({
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
    PrivateKey: {
      fromStringED25519: jest.fn(),
      fromStringECDSA: jest.fn(),
    },
    TransferTransaction: jest.fn().mockImplementation(() => ({
      addHbarTransfer: jest.fn().mockReturnThis(),
      setTransactionMemo: jest.fn().mockReturnThis(),
      freezeWith: jest.fn().mockReturnThis(),
      sign: jest.fn().mockReturnThis(),
      execute: jest.fn().mockResolvedValue({}),
    })),
  }),

  '@hashgraphonline/standards-sdk': () => ({
    Logger: jest.fn().mockImplementation(() => ({
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
    })),
    HederaMirrorNode: jest.fn().mockImplementation(() => ({
      requestAccount: jest.fn().mockResolvedValue({
        key: { _type: 'ED25519' }
      }),
      configureRetry: jest.fn(),
      getAccountInfo: jest.fn(),
      getTokenInfo: jest.fn(),
      getTopicInfo: jest.fn(),
      getContractInfo: jest.fn(),
      getAccountBalance: jest.fn(),
    })),
    HCS10Client: jest.fn(),
    ContentStoreService: {
      setInstance: jest.fn(),
      getInstance: jest.fn(),
    },
    ContentResolverRegistry: {
      register: jest.fn(),
      resolve: jest.fn(),
    },
    extractReferenceId: jest.fn(),
    shouldUseReference: jest.fn(),
  }),

  '@hashgraphonline/standards-agent-kit': () => ({
    OpenConvaiState: jest.fn().mockImplementation(() => ({
      initialize: jest.fn(),
      getState: jest.fn(),
      setState: jest.fn(),
    })),
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
  }),

  '@langchain/agents': () => ({
    AgentExecutor: jest.fn().mockImplementation(() => ({
      call: jest.fn(),
      run: jest.fn(),
      tools: [],
    })),
  }),

  // Mock timers to prevent open handles in tests
  timers: () => {
    jest.useFakeTimers();
    global.setInterval = jest.fn(() => ({ unref: jest.fn() }));
    global.clearInterval = jest.fn();
    global.setTimeout = jest.fn(() => ({ unref: jest.fn() }));
    global.clearTimeout = jest.fn();
  },

  'hedera-agent-kit': () => ({
    ServerSigner: jest.fn().mockImplementation(() => ({
      getAccountId: () => ({ toString: () => '0.0.12345' }),
      getNetwork: () => 'testnet',
      getOperatorPrivateKey: jest.fn(),
    })),
    HederaAgentKit: jest.fn().mockImplementation(function(this: any) {
      this.initialize = jest.fn().mockResolvedValue(undefined);
      this.getAggregatedLangChainTools = jest.fn().mockReturnValue([]);
      this.operationalMode = 'returnBytes';
    }),
    getAllHederaCorePlugins: jest.fn(() => []),
    BasePlugin: class MockBasePlugin {
      id = '';
      name = '';
      description = '';
      version = '';
      author = '';
      namespace = '';
      async initialize() {}
      async cleanup() {}
    },
    BaseServiceBuilder: class MockBaseServiceBuilder {
      constructor(_hederaKit: unknown) {}
    },
    BaseHederaTransactionTool: class MockBaseHederaTransactionTool {
      name = '';
      description = '';
      constructor() {}
      async execute() {}
      async validate() {}
    }
  }),
};

/**
 * Apply common mocks to jest
 */
export function setupCommonMocks() {
  jest.mock('@hashgraph/sdk', commonMocks['@hashgraph/sdk']);
  jest.mock('@hashgraphonline/standards-sdk', commonMocks['@hashgraphonline/standards-sdk']);
  jest.mock('@hashgraphonline/standards-agent-kit', commonMocks['@hashgraphonline/standards-agent-kit']);
  jest.mock('hedera-agent-kit', commonMocks['hedera-agent-kit']);

  // Setup timer mocks to prevent open handles
  commonMocks.timers();
}