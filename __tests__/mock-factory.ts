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
  returnDirect?: boolean;
  verboseParsingErrors?: boolean;
  lc_namespace?: string[];
  _call?: jest.Mock;
  lc_serializable?: boolean;
  lc_kwargs?: Record<string, unknown>;
  lc_runnable?: boolean;
  lc_attributes?: Record<string, unknown>;
  InputType?: any;
  OutputType?: any;
  lc_graph_name?: string;
  lc_multiple?: boolean;
  lc_used?: boolean;
  description_lines?: string[];
  args?: Record<string, unknown>;
  lc_aliases?: string[];
  lc_secrets?: Record<string, string>;
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
    lc_serializable: true,
    lc_kwargs: {},
    lc_runnable: true,
    lc_attributes: {},
    lc_graph_name: 'test-tool',
    lc_multiple: false,
    lc_used: false,
    description_lines: ['Mock tool for testing'],
    args: {},
    lc_aliases: [],
    lc_secrets: {},
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
  isZodObject?: boolean;
  hasHashLinkBlock?: jest.Mock;
  setParameterPreprocessingCallback?: jest.Mock;
  _takeNextStep?: jest.Mock;
  isFieldRequired?: jest.Mock;
  _call?: jest.Mock;
  handleValidationError?: jest.Mock;
  getPendingForms?: jest.Mock;
  restorePendingForms?: jest.Mock;
  processFormSubmission?: jest.Mock;
  extractToolInfoFromError?: jest.Mock;
  findToolFromContext?: jest.Mock;
  detectToolFromErrorContext?: jest.Mock;
  schemaMatchesErrorPaths?: jest.Mock;
  extractToolKeywords?: jest.Mock;
  formatFormResponse?: jest.Mock;
  hasPendingForms?: jest.Mock;
  getPendingFormsInfo?: jest.Mock;
  processHashLinkResponse?: jest.Mock;
  getFormEngineStatistics?: jest.Mock;
  lc_namespace?: string[];
  agent?: any;
  tools?: any[];
  returnIntermediateSteps?: boolean;
  earlyStoppingMethod?: jest.Mock;
  returnOnlyOutputs?: boolean;
  handleParsingErrors?: jest.Mock;
  inputKeys?: string[];
  outputKeys?: string[];
  shouldContinueGetter?: jest.Mock;
  shouldContinue?: jest.Mock;
  _return?: jest.Mock;
  _getToolReturn?: jest.Mock;
  _returnStoppedResponse?: jest.Mock;
  _streamIterator?: jest.Mock;
  _chainType?: string;
  serialize?: jest.Mock;
  _selectMemoryInputs?: jest.Mock;
  _validateOutputs?: jest.Mock;
  prepOutputs?: jest.Mock;
  run?: jest.Mock;
  _formatValues?: jest.Mock;
  call?: jest.Mock;
  apply?: jest.Mock;
  verbose?: boolean;
  lc_attributes?: Record<string, unknown>;
  lc_runnable?: boolean;
  getName?: jest.Mock;
  bind?: jest.Mock;
  map?: jest.Mock;
  withRetry?: jest.Mock;
  withConfig?: jest.Mock;
  withFallbacks?: jest.Mock;
  _getOptionsList?: jest.Mock;
  batch?: jest.Mock;
  stream?: jest.Mock;
  _separateRunnableConfigFromCallOptions?: jest.Mock;
  _callWithConfig?: jest.Mock;
  _batchWithConfig?: jest.Mock;
  _concatOutputChunks?: jest.Mock;
  _transformStreamWithConfig?: jest.Mock;
  getGraph?: jest.Mock;
  pipe?: jest.Mock;
  pick?: jest.Mock;
  assign?: jest.Mock;
  transform?: jest.Mock;
  streamLog?: jest.Mock;
  _streamLog?: jest.Mock;
  streamEvents?: jest.Mock;
  _streamEventsV2?: jest.Mock;
  _streamEventsV1?: jest.Mock;
  withListeners?: jest.Mock;
  asTool?: jest.Mock;
  lc_serializable?: boolean;
  lc_kwargs?: Record<string, unknown>;
  lc_id?: string[];
  lc_secrets?: Record<string, string>;
  lc_aliases?: string[];
  lc_serializable_keys?: string[];
  toJSON?: jest.Mock;
  toJSONNotImplemented?: jest.Mock;
  [key: string]: any; // Allow additional properties for compatibility
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
    isZodObject: false,
    hasHashLinkBlock: jest.fn().mockReturnValue(false),
    setParameterPreprocessingCallback: jest.fn(),
    _takeNextStep: jest.fn(),
    isFieldRequired: jest.fn().mockReturnValue(false),
    _call: jest.fn(),
    handleValidationError: jest.fn(),
    getPendingForms: jest.fn().mockReturnValue([]),
    restorePendingForms: jest.fn(),
    processFormSubmission: jest.fn(),
    extractToolInfoFromError: jest.fn(),
    findToolFromContext: jest.fn(),
    detectToolFromErrorContext: jest.fn(),
    schemaMatchesErrorPaths: jest.fn(),
    extractToolKeywords: jest.fn(),
    formatFormResponse: jest.fn(),
    hasPendingForms: jest.fn().mockReturnValue(false),
    getPendingFormsInfo: jest.fn().mockReturnValue([]),
    processHashLinkResponse: jest.fn(),
    getFormEngineStatistics: jest.fn().mockReturnValue({}),
    lc_namespace: ['langchain', 'agents'],
    agent: {},
    tools: [],
    returnIntermediateSteps: false,
    earlyStoppingMethod: jest.fn(),
    returnOnlyOutputs: false,
    handleParsingErrors: jest.fn(),
    inputKeys: [],
    outputKeys: [],
    shouldContinueGetter: jest.fn(),
    shouldContinue: jest.fn().mockReturnValue(false),
    _return: jest.fn(),
    _getToolReturn: jest.fn(),
    _returnStoppedResponse: jest.fn(),
    _streamIterator: jest.fn(),
    _chainType: 'agent',
    serialize: jest.fn(),
    _selectMemoryInputs: jest.fn(),
    _validateOutputs: jest.fn(),
    prepOutputs: jest.fn(),
    run: jest.fn(),
    _formatValues: jest.fn(),
    call: jest.fn(),
    apply: jest.fn(),
    verbose: false,
    lc_attributes: {},
    lc_runnable: true,
    getName: jest.fn().mockReturnValue('MockAgentExecutor'),
    bind: jest.fn(),
    map: jest.fn(),
    withRetry: jest.fn(),
    withConfig: jest.fn(),
    withFallbacks: jest.fn(),
    _getOptionsList: jest.fn(),
    batch: jest.fn(),
    stream: jest.fn(),
    _separateRunnableConfigFromCallOptions: jest.fn(),
    _callWithConfig: jest.fn(),
    _batchWithConfig: jest.fn(),
    _concatOutputChunks: jest.fn(),
    _transformStreamWithConfig: jest.fn(),
    getGraph: jest.fn(),
    pipe: jest.fn(),
    pick: jest.fn(),
    assign: jest.fn(),
    transform: jest.fn(),
    streamLog: jest.fn(),
    _streamLog: jest.fn(),
    streamEvents: jest.fn(),
    _streamEventsV2: jest.fn(),
    _streamEventsV1: jest.fn(),
    withListeners: jest.fn(),
    asTool: jest.fn(),
    lc_serializable: true,
    lc_kwargs: {},
    lc_id: ['mock-agent-executor'],
    lc_secrets: {},
    lc_aliases: [],
    lc_serializable_keys: [],
    toJSON: jest.fn(),
    toJSONNotImplemented: jest.fn(),
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