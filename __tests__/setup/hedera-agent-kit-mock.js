/**
 * Mock for hedera-agent-kit that avoids Number.isFinite issues
 */

class MockServerSigner {
  constructor(accountId, privateKey, network) {
    this.accountId = accountId;
    this.privateKey = privateKey;
    this.network = network;
  }
  
  getAccountId() {
    return { toString: () => this.accountId || '0.0.12345' };
  }
  
  getNetwork() {
    return this.network || 'testnet';
  }
  
  getOperatorPrivateKey() {
    return this.privateKey || 'mock-private-key';
  }
}

const mockHederaAgentKit = jest.fn().mockImplementation(function() {
  this.initialize = jest.fn().mockResolvedValue(undefined);
  this.getAggregatedLangChainTools = jest.fn().mockReturnValue([]);
  this.operationalMode = 'returnBytes';
});

class MockBasePlugin {
  constructor() {
    this.id = '';
    this.name = '';
    this.description = '';
    this.version = '';
    this.author = '';
    this.namespace = '';
  }
  
  async initialize() {}
  async cleanup() {}
}

class MockBaseServiceBuilder {
  constructor(hederaKit) {
    this.hederaKit = hederaKit;
  }
}

class MockBaseHederaTransactionTool {
  constructor() {
    this.name = '';
    this.description = '';
  }
}

module.exports = {
  ServerSigner: MockServerSigner,
  HederaAgentKit: mockHederaAgentKit,
  getAllHederaCorePlugins: jest.fn(() => []),
  BasePlugin: MockBasePlugin,
  BaseServiceBuilder: MockBaseServiceBuilder,
  BaseHederaTransactionTool: MockBaseHederaTransactionTool,
};