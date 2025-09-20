import { type Message } from '../../../cli/src/types';

const mockConfigManager = {
  resetCache: jest.fn(),
  getConfig: jest.fn(),
  getMCPServers: jest.fn(),
};

const mockAgentManager = {
  reset: jest.fn(),
  initialize: jest.fn(),
  sendMessage: jest.fn(),
};

jest.mock('../../../cli/source/managers/ConfigManager.ts', () => ({
  ConfigManager: {
    getInstance: () => mockConfigManager,
  },
}));

jest.mock('../../../cli/source/managers/AgentManager.ts', () => ({
  AgentManager: {
    getInstance: () => mockAgentManager,
  },
}));

import { runHeadless } from '../../../cli/src/headless-runner';

const baseWelcome: Message[] = [
  {
    role: 'system',
    content: 'Connected to Hedera testnet',
    timestamp: new Date(),
  },
];

beforeEach(() => {
  jest.clearAllMocks();
  mockConfigManager.getConfig.mockReturnValue({
    accountId: '0.0.123',
    privateKey: 'operator-key',
    network: 'testnet',
    openAIApiKey: 'openai-key',
    mcpServers: [],
  });
  mockConfigManager.getMCPServers.mockReturnValue([]);
  mockAgentManager.initialize.mockResolvedValue({
    agent: {},
    welcomeMessages: baseWelcome,
  });
  mockAgentManager.sendMessage.mockResolvedValue({
    message: 'Transfer scheduled',
    transactionId: '0.0.123@456',
    notes: ['Note A'],
  });
});

describe('runHeadless', () => {
  test('executes command and returns formatted output', async () => {
    const result = await runHeadless({ command: 'send 1 hbar to 0.0.800' });

    expect(mockAgentManager.initialize).toHaveBeenCalledWith(
      expect.objectContaining({
        accountId: '0.0.123',
        privateKey: 'operator-key',
        mcpServers: [],
      }),
      expect.objectContaining({ enableFilesystem: false })
    );
    expect(mockAgentManager.sendMessage).toHaveBeenCalledWith(
      'send 1 hbar to 0.0.800',
      []
    );
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('[command] send 1 hbar to 0.0.800');
    expect(result.stdout).toContain('[assistant] Transfer scheduled');
    expect(result.stdout).toContain('[transaction] 0.0.123@456');
    expect(result.stdout).toContain('[note] Note A');
  });

  test('returns welcome messages when no command provided', async () => {
    const result = await runHeadless({ command: '' });

    expect(mockAgentManager.sendMessage).not.toHaveBeenCalled();
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('[system] Connected to Hedera testnet');
  });

  test('propagates initialization errors', async () => {
    mockAgentManager.initialize.mockRejectedValue(new Error('init failed'));

    const result = await runHeadless({ command: 'status' });

    expect(result.exitCode).toBe(1);
    expect(result.stdout).toContain('[error] init failed');
  });
});
