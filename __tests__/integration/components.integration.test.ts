import { describe, test, expect } from 'vitest';
import { ConversationalAgent } from '../../src';
import { OpenConvAIPlugin } from '../../src';
import { HederaMirrorNode, Logger } from '@hashgraphonline/standards-sdk';
import { PrivateKey } from '@hashgraph/sdk';
import dotenv from 'dotenv';
import { HederaAgentKit, ServerSigner } from 'hedera-agent-kit';

dotenv.config();

/**
 * Integration tests for plugin components
 */
describe('Plugin Component Integration Tests', () => {
  const accountId = process.env.HEDERA_ACCOUNT_ID;
  const privateKey = process.env.HEDERA_PRIVATE_KEY;
  const logger = new Logger({ module: 'Component-Integration-Test' });

  describe('ConversationalAgent Initialization', () => {
    test('Can initialize ConversationalAgent with real configuration', async () => {
      const openAIApiKey = process.env.OPENAI_API_KEY;

      if (!accountId || !privateKey || !openAIApiKey) {
        console.log('Skipping test - missing required env vars');
        return;
      }

      const agent = new ConversationalAgent({
        accountId,
        privateKey,
        network: 'testnet',
        openAIApiKey,
        verbose: false,
      });

      await agent.initialize();
      expect(agent.getPlugin()).toBeDefined();
      expect(agent.getStateManager()).toBeDefined();
      expect(agent.getConversationalAgent()).toBeDefined();

      logger.info('ConversationalAgent initialized successfully');
    }, 30000);
  });

  describe('Plugin Functionality', () => {
    test('OpenConvAI plugin initializes with real HederaAgentKit', async () => {
      if (!accountId || !privateKey) {
        console.log('Skipping test - missing required env vars');
        return;
      }

      const mirrorNode = new HederaMirrorNode('testnet', logger);
      const accountInfo = await mirrorNode.requestAccount(accountId);
      const keyType = accountInfo?.key?._type || '';

      let privateKeyInstance: PrivateKey;
      if (keyType?.toLowerCase()?.includes('ecdsa')) {
        privateKeyInstance = PrivateKey.fromStringECDSA(privateKey);
      } else {
        privateKeyInstance = PrivateKey.fromStringED25519(privateKey);
      }

      const serverSigner = new ServerSigner(
        accountId,
        privateKeyInstance,
        'testnet'
      );
      const hederaKit = new HederaAgentKit(serverSigner);

      const plugin = new OpenConvAIPlugin();

      const context = {
        logger,
        config: {
          hederaKit,
        },
      };

      await plugin.initialize(context as any);

      const tools = plugin.getTools();
      expect(tools.length).toBe(11);

      const toolNames = tools.map((t) => t.name);
      expect(toolNames).toContain('register_agent');
      expect(toolNames).toContain('find_registrations');
      expect(toolNames).toContain('list_connections');
      expect(toolNames).toContain('send_message_to_connection');

      const stateManager = plugin.getStateManager();
      expect(stateManager).toBeDefined();
    }, 30000);
  });
});
