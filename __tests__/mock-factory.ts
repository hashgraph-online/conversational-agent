/**
 * Mock factory for creating properly typed test mocks
 */

import type { ServerSigner } from 'hedera-agent-kit';
import type { AccountId, Client, PrivateKey, TransactionReceipt, PublicKey } from '@hashgraph/sdk';
import { TEST_MCP_DATA, TEST_NETWORKS, TEST_OPERATIONAL_MODES } from './test-constants';

/**
 * Creates a properly typed mock ServerSigner with all required properties
 */
export function createMockServerSigner(overrides?: Partial<ServerSigner>): ServerSigner {
  const mockAccountId = {
    toString: jest.fn().mockReturnValue(TEST_MCP_DATA.DEFAULT_ACCOUNT_ID),
  } as unknown as AccountId;

  const mockPrivateKey = {
    toString: jest.fn().mockReturnValue(TEST_MCP_DATA.MOCK_PRIVATE_KEY),
  } as unknown as PrivateKey;

  const mockClient = {
    setOperator: jest.fn(),
  } as unknown as Client;

  const mockPublicKey = {
    toString: jest.fn().mockReturnValue('mock-public-key'),
  } as unknown as PublicKey;

  const mockTransactionReceipt = {
    status: { toString: () => 'SUCCESS' },
    transactionId: { toString: () => 'mock-transaction-id' },
  } as unknown as TransactionReceipt;

  const mockMirrorNode = {
    getAccountInfo: jest.fn(),
  };

  const mockServerSigner = {
    mirrorNode: mockMirrorNode,
    
    getAccountId: jest.fn().mockReturnValue(mockAccountId),
    getPublicKey: jest.fn().mockResolvedValue(mockPublicKey),
    signAndExecuteTransaction: jest.fn().mockResolvedValue(mockTransactionReceipt),
    getNetwork: jest.fn().mockReturnValue(TEST_NETWORKS.TESTNET as 'testnet'),
    getOperatorPrivateKey: jest.fn().mockReturnValue(mockPrivateKey),
    getClient: jest.fn().mockReturnValue(mockClient),

    getKeyType: jest.fn().mockResolvedValue('ed25519'),
    getKeyTypeSync: jest.fn().mockReturnValue('ed25519'),

    ...overrides,
  } as unknown as ServerSigner;

  return mockServerSigner;
}

/**
 * Creates a minimal mock ServerSigner for simple tests
 */
export function createMinimalMockServerSigner(): Pick<ServerSigner, 'getAccountId' | 'getNetwork'> {
  return {
    getAccountId: () => ({ toString: () => TEST_MCP_DATA.DEFAULT_ACCOUNT_ID } as AccountId),
    getNetwork: () => TEST_NETWORKS.TESTNET as 'testnet',
  };
}

/**
 * Mock interfaces for common test objects
 */
export interface MockAgentInterface {
  boot: jest.Mock;
  chat: jest.Mock;
  generateFormFields: jest.Mock;
  callTool: jest.Mock;
}

export interface MockHederaKitInterface {
  initialize: jest.Mock;
  getAggregatedLangChainTools: jest.Mock;
  operationalMode: string;
}

export interface MockLoggerInterface {
  info: jest.Mock;
  warn: jest.Mock;
  error: jest.Mock;
  debug: jest.Mock;
}

export interface MockPrivateKeyInterface {
  toString: jest.Mock;
}

/**
 * Creates a properly typed mock Agent with all required methods
 */
export function createMockAgent(overrides?: Partial<MockAgentInterface>): MockAgentInterface {
  return {
    boot: jest.fn().mockResolvedValue(undefined),
    chat: jest.fn().mockResolvedValue({ output: 'Test response' }),
    generateFormFields: jest.fn().mockReturnValue([]),
    callTool: jest.fn().mockResolvedValue('Tool result'),
    ...overrides,
  };
}

/**
 * Creates a properly typed mock HederaKit for testing
 */
export function createMockHederaKit(overrides?: Partial<MockHederaKitInterface>): MockHederaKitInterface {
  return {
    initialize: jest.fn().mockResolvedValue(undefined),
    getAggregatedLangChainTools: jest.fn().mockReturnValue([]),
    operationalMode: TEST_OPERATIONAL_MODES.RETURN_BYTES,
    ...overrides,
  };
}

/**
 * Creates a properly typed mock Logger for testing
 */
export function createMockLogger(overrides?: Partial<MockLoggerInterface>): MockLoggerInterface {
  return {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
    ...overrides,
  };
}

/**
 * Creates a properly typed mock PrivateKey for testing
 */
export function createMockPrivateKey(overrides?: Partial<MockPrivateKeyInterface>): MockPrivateKeyInterface {
  return {
    toString: jest.fn().mockReturnValue(TEST_MCP_DATA.MOCK_PRIVATE_KEY),
    ...overrides,
  };
}

/**
 * Mock StructuredTool interface that matches LangChain StructuredTool requirements
 */
export interface MockStructuredToolInterface {
  name: string;
  description: string;
  schema: Record<string, unknown>;
  namespace?: string;
  call: jest.Mock;
  invoke: jest.Mock;
  // Additional properties required by StructuredTool
  returnDirect?: boolean;
  verboseParsingErrors?: boolean;
  lc_namespace?: string[];
  _call?: jest.Mock;
  // Add other required properties with defaults
  [key: string]: unknown;
}

/**
 * Creates a properly typed mock StructuredTool for testing
 */
export function createMockTool(name: string, namespace?: string, overrides?: Partial<MockStructuredToolInterface>): MockStructuredToolInterface {
  return {
    name,
    namespace: namespace ?? '',
    description: `Mock tool: ${name}`,
    schema: { type: 'object', properties: {} },
    call: jest.fn().mockResolvedValue('mock-result'),
    invoke: jest.fn().mockResolvedValue('mock-result'),
    returnDirect: false,
    verboseParsingErrors: false,
    lc_namespace: ['langchain', 'tools'],
    _call: jest.fn().mockResolvedValue('mock-result'),
    ...overrides,
  };
}

/**
 * Mock AgentExecutor interface with all required properties
 */
export interface MockAgentExecutorInterface {
  invoke: jest.Mock;
  formGenerator?: jest.Mock;
  formEngine?: jest.Mock;
  formLogger?: jest.Mock;
  pendingForms?: jest.Mock;
  parameterPreprocessingCallback?: jest.Mock;
}

/**
 * Creates a properly typed mock FormAwareAgentExecutor for testing
 */
export function createMockAgentExecutor(overrides?: Partial<MockAgentExecutorInterface>): MockAgentExecutorInterface {
  return {
    invoke: jest.fn().mockResolvedValue({ output: 'Test response' }),
    formGenerator: jest.fn(),
    formEngine: jest.fn(),
    formLogger: jest.fn(),
    pendingForms: jest.fn(),
    parameterPreprocessingCallback: jest.fn(),
    ...overrides,
  };
}

/**
 * Mock BasePlugin interface for testing
 */
export interface MockBasePluginInterface {
  id: string;
  name: string;
  description: string;
  version: string;
  author: string;
  namespace: string;
  initialize: jest.Mock;
  cleanup: jest.Mock;
  getTools: jest.Mock;
}

/**
 * Creates a properly typed mock BasePlugin for testing
 */
export function createMockPlugin(id: string, overrides?: Partial<MockBasePluginInterface>): MockBasePluginInterface {
  return {
    id,
    name: `Mock Plugin ${id}`,
    description: `Mock plugin for testing: ${id}`,
    version: '1.0.0',
    author: 'Test Author',
    namespace: id,
    initialize: jest.fn().mockResolvedValue(undefined),
    cleanup: jest.fn().mockResolvedValue(undefined),
    getTools: jest.fn().mockReturnValue([]),
    ...overrides,
  };
}