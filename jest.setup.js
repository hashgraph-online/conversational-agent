// This file sets up Jest mocks for the conversational-agent tests
const { TextEncoder, TextDecoder } = require('util');

// Add TextEncoder and TextDecoder to the global context
global.TextEncoder = TextEncoder;
global.TextDecoder = TextDecoder;

// Mock global Number to fix hedera-agent-kit issues
const OriginalNumber = global.Number;
global.Number = function Number(value) {
  return OriginalNumber(value);
};

// Copy all static methods and properties
Object.keys(OriginalNumber).forEach((key) => {
  global.Number[key] = OriginalNumber[key];
});

// Ensure critical methods exist
global.Number.isFinite =
  global.Number.isFinite ||
  function (value) {
    return (
      typeof value === 'number' &&
      !isNaN(value) &&
      value !== Infinity &&
      value !== -Infinity
    );
  };
global.Number.isSafeInteger =
  global.Number.isSafeInteger ||
  function (value) {
    return (
      Number.isInteger(value) && Math.abs(value) <= Number.MAX_SAFE_INTEGER
    );
  };
global.Number.isInteger =
  global.Number.isInteger ||
  function (value) {
    return (
      typeof value === 'number' && !isNaN(value) && Math.floor(value) === value
    );
  };
global.Number.isNaN =
  global.Number.isNaN ||
  function (value) {
    return value !== value;
  };
global.Number.parseFloat = global.Number.parseFloat || parseFloat;
global.Number.parseInt = global.Number.parseInt || parseInt;
global.Number.MAX_VALUE = global.Number.MAX_VALUE || OriginalNumber.MAX_VALUE;
global.Number.MIN_VALUE = global.Number.MIN_VALUE || OriginalNumber.MIN_VALUE;
global.Number.NaN = global.Number.NaN || OriginalNumber.NaN;
global.Number.NEGATIVE_INFINITY =
  global.Number.NEGATIVE_INFINITY || OriginalNumber.NEGATIVE_INFINITY;
global.Number.POSITIVE_INFINITY =
  global.Number.POSITIVE_INFINITY || OriginalNumber.POSITIVE_INFINITY;
global.Number.MAX_SAFE_INTEGER =
  global.Number.MAX_SAFE_INTEGER || OriginalNumber.MAX_SAFE_INTEGER;
global.Number.MIN_SAFE_INTEGER =
  global.Number.MIN_SAFE_INTEGER || OriginalNumber.MIN_SAFE_INTEGER;

// Add Web Streams API support
const {
  ReadableStream,
  WritableStream,
  TransformStream,
} = require('stream/web');
global.ReadableStream = ReadableStream;
global.WritableStream = WritableStream;
global.TransformStream = TransformStream;

// Mock for storage
class MockStorage {
  constructor() {
    this.store = {};
  }

  getItem(key) {
    return this.store[key] || null;
  }

  setItem(key, value) {
    this.store[key] = value.toString();
  }

  removeItem(key) {
    delete this.store[key];
  }

  clear() {
    this.store = {};
  }

  key(index) {
    return Object.keys(this.store)[index] || null;
  }

  get length() {
    return Object.keys(this.store).length;
  }
}

// Setup globals
global.localStorage = new MockStorage();
global.sessionStorage = new MockStorage();

// Mock fetch
global.fetch = jest.fn();

// Mock timers to prevent open handles in tests
jest.useFakeTimers();
global.setInterval = jest.fn(() => ({ unref: jest.fn() }));
global.clearInterval = jest.fn();
global.setTimeout = jest.fn(() => ({ unref: jest.fn() }));
global.clearTimeout = jest.fn();

// Set up mock for crypto
global.crypto = {
  getRandomValues: function (buffer) {
    for (let i = 0; i < buffer.length; i++) {
      buffer[i] = Math.floor(Math.random() * 256);
    }
    return buffer;
  },
  subtle: {
    digest: jest
      .fn()
      .mockImplementation(() => Promise.resolve(new ArrayBuffer(32))),
    encrypt: jest
      .fn()
      .mockImplementation(() => Promise.resolve(new ArrayBuffer(32))),
    decrypt: jest
      .fn()
      .mockImplementation(() => Promise.resolve(new ArrayBuffer(32))),
    sign: jest
      .fn()
      .mockImplementation(() => Promise.resolve(new ArrayBuffer(32))),
    verify: jest.fn().mockImplementation(() => Promise.resolve(true)),
    generateKey: jest.fn().mockImplementation(() =>
      Promise.resolve({
        privateKey: 'mock-private-key',
        publicKey: 'mock-public-key',
      })
    ),
    importKey: jest
      .fn()
      .mockImplementation(() => Promise.resolve('mock-imported-key')),
    exportKey: jest
      .fn()
      .mockImplementation(() => Promise.resolve(new ArrayBuffer(32))),
    deriveKey: jest
      .fn()
      .mockImplementation(() => Promise.resolve('mock-derived-key')),
    deriveBits: jest
      .fn()
      .mockImplementation(() => Promise.resolve(new ArrayBuffer(32))),
    wrapKey: jest
      .fn()
      .mockImplementation(() => Promise.resolve(new ArrayBuffer(32))),
    unwrapKey: jest
      .fn()
      .mockImplementation(() => Promise.resolve('mock-unwrapped-key')),
  },
};

// Mock @hashgraph/sdk to avoid test interference
jest.mock('@hashgraph/sdk', () => ({
  Client: {
    forTestnet: jest.fn().mockReturnValue({
      setOperator: jest.fn(),
      close: jest.fn(),
    }),
    forMainnet: jest.fn().mockReturnValue({
      setOperator: jest.fn(),
      close: jest.fn(),
    }),
  },
  PrivateKey: {
    fromString: jest.fn().mockReturnValue({
      publicKey: {
        toString: jest.fn().mockReturnValue('mock-public-key'),
      },
      toString: jest.fn().mockReturnValue('mock-private-key'),
    }),
    generate: jest.fn().mockReturnValue({
      publicKey: {
        toString: jest.fn().mockReturnValue('mock-public-key'),
      },
      toString: jest.fn().mockReturnValue('mock-private-key'),
    }),
  },
  AccountId: {
    fromString: jest.fn().mockReturnValue({
      toString: jest.fn().mockReturnValue('0.0.123'),
    }),
  },
  TopicId: {
    fromString: jest.fn().mockReturnValue({
      toString: jest.fn().mockReturnValue('0.0.456'),
    }),
  },
  Hbar: {
    fromTinybars: jest.fn(),
    from: jest.fn(),
  },
  Status: {
    Success: 'SUCCESS',
  },
}));

// Note: @langchain/agents is not available in this project, so we skip mocking it

// Mock @hashgraphonline/standards-sdk
jest.mock('@hashgraphonline/standards-sdk', () => ({
  Logger: jest.fn().mockImplementation((options) => ({
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  })),
  HCS10Client: jest.fn().mockImplementation(() => ({
    initialize: jest.fn(),
    register: jest.fn(),
    sendMessage: jest.fn(),
    getMessages: jest.fn(),
    retrieveProfile: jest.fn().mockResolvedValue({
      success: true,
      topicInfo: {
        inboundTopic: '0.0.123',
        outboundTopic: '0.0.456',
      },
    }),
  })),
  NetworkType: { MAINNET: 'mainnet', TESTNET: 'testnet' },
  HederaMirrorNode: jest.fn(),
}));

// Mock @hashgraphonline/standards-agent-kit
jest.mock('@hashgraphonline/standards-agent-kit', () => ({
  IStateManager: jest.fn(),
  OpenConvaiState: jest.fn().mockImplementation(() => ({
    setCurrentAgent: jest.fn(),
    getCurrentAgent: jest.fn(),
    getConnectionsManager: jest.fn(),
    initializeConnectionsManager: jest.fn(),
  })),
  HCS10Builder: jest.fn().mockImplementation(() => ({
    build: jest.fn(),
  })),
  RegisterAgentTool: jest.fn().mockImplementation((config) => ({
    name: 'register-agent',
    description: 'Register agent tool',
    schema: {},
    execute: jest.fn(),
  })),
  FindRegistrationsTool: jest.fn().mockImplementation((config) => ({
    name: 'find-registrations',
    description: 'Find registrations tool',
    schema: {},
    execute: jest.fn(),
  })),
  InitiateConnectionTool: jest.fn().mockImplementation((config) => ({
    name: 'initiate-connection',
    description: 'Initiate connection tool',
    schema: {},
    execute: jest.fn(),
  })),
  ListConnectionsTool: jest.fn().mockImplementation((config) => ({
    name: 'list-connections',
    description: 'List connections tool',
    schema: {},
    execute: jest.fn(),
  })),
  SendMessageToConnectionTool: jest.fn().mockImplementation((config) => ({
    name: 'send-message-to-connection',
    description: 'Send message to connection tool',
    schema: {},
    execute: jest.fn(),
  })),
  CheckMessagesTool: jest.fn().mockImplementation((config) => ({
    name: 'check-messages',
    description: 'Check messages tool',
    schema: {},
    execute: jest.fn(),
  })),
  ConnectionMonitorTool: jest.fn().mockImplementation((config) => ({
    name: 'connection-monitor',
    description: 'Connection monitor tool',
    schema: {},
    execute: jest.fn(),
  })),
  ManageConnectionRequestsTool: jest.fn().mockImplementation((config) => ({
    name: 'manage-connection-requests',
    description: 'Manage connection requests tool',
    schema: {},
    execute: jest.fn(),
  })),
  AcceptConnectionRequestTool: jest.fn().mockImplementation((config) => ({
    name: 'accept-connection-request',
    description: 'Accept connection request tool',
    schema: {},
    execute: jest.fn(),
  })),
  RetrieveProfileTool: jest.fn().mockImplementation((config) => ({
    name: 'retrieve-profile',
    description: 'Retrieve profile tool',
    schema: {},
    execute: jest.fn(),
  })),
  ListUnapprovedConnectionRequestsTool: jest
    .fn()
    .mockImplementation((config) => ({
      name: 'list-unapproved-connection-requests',
      description: 'List unapproved connection requests tool',
      schema: {},
      execute: jest.fn(),
    })),
  isFormValidatable: jest.fn().mockReturnValue(false),
}));

// Mock hedera-agent-kit
jest.mock('hedera-agent-kit', () => {
  class MockBasePlugin {
    context = {
      logger: {
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
        debug: jest.fn(),
      },
      config: {},
    };

    async initialize(context) {
      this.context = { ...this.context, ...context };
    }

    async cleanup() {}
  }

  class MockBaseServiceBuilder {
    constructor(hederaKit) {
      this.hederaKit = hederaKit;
    }
  }

  class MockBaseHederaTransactionTool {
    name = '';
    description = '';
    constructor() {}
    async execute() {}
    async validate() {}
  }

  return {
    GenericPluginContext: jest.fn(),
    HederaTool: jest.fn(),
    BasePlugin: MockBasePlugin,
    BaseServiceBuilder: MockBaseServiceBuilder,
    BaseHederaTransactionTool: MockBaseHederaTransactionTool,
    HederaAgentKit: jest.fn().mockImplementation(() => ({
      initialize: jest.fn().mockResolvedValue(undefined),
      getAggregatedLangChainTools: jest.fn().mockReturnValue([]),
      operationalMode: 'returnBytes',
    })),
    HederaAirdropTokenTool: jest.fn().mockImplementation(() => ({
      name: 'original-airdrop-tool',
      description: 'Original airdrop tool',
      _call: jest.fn(),
    })),
    ServerSigner: jest
      .fn()
      .mockImplementation((accountId, privateKey, network) => ({
        getAccountId: jest.fn(() => ({ toString: () => accountId })),
        getNetwork: jest.fn(() => network),
        sign: jest.fn(),
        freeze: jest.fn().mockReturnThis(),
        submit: jest.fn().mockResolvedValue({}),
      })),
    getAllHederaCorePlugins: jest.fn(() => []),
  };
});
