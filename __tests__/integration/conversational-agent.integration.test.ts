import { describe, test, expect, beforeAll, afterAll } from 'vitest';
import { ConversationalAgent } from '../../src';
import { Logger } from '@hashgraphonline/standards-sdk';
import dotenv from 'dotenv';

dotenv.config();

/**
 * Integration tests for ConversationalAgent with actual network transactions
 */
describe.skipIf(!process.env.HEDERA_ACCOUNT_ID || !process.env.HEDERA_PRIVATE_KEY || !process.env.OPENAI_API_KEY)('ConversationalAgent Integration Tests', () => {
  let agent: ConversationalAgent;
  let logger: Logger;
  
  const accountId = process.env.HEDERA_ACCOUNT_ID!;
  const privateKey = process.env.HEDERA_PRIVATE_KEY!;
  const openAIApiKey = process.env.OPENAI_API_KEY!;

  beforeAll(async () => {
    if (!accountId || !privateKey || !openAIApiKey) {
      throw new Error('HEDERA_ACCOUNT_ID, HEDERA_PRIVATE_KEY, and OPENAI_API_KEY must be set in .env');
    }

    logger = new Logger({ module: 'ConversationalAgent-Integration' });

    agent = new ConversationalAgent({
      accountId,
      privateKey,
      network: 'testnet',
      openAIApiKey,
      openAIModelName: 'gpt-4o',
      verbose: true,
      operationalMode: 'autonomous'
    });

    await agent.initialize();
    logger.info('ConversationalAgent initialized successfully');
  }, 60000);

  afterAll(() => {
    logger.info('\n=== ConversationalAgent Integration Tests Completed ===');
  });

  describe('Agent Registration', () => {
    test('Register a new agent on testnet', async () => {
      const timestamp = Date.now();
      const agentName = `TestAgent${timestamp}`;
      
      const response = await agent.processMessage(
        `Use the register_agent tool to register a new agent named ${agentName} with TEXT_GENERATION capability and tags: test, automated`
      );

      expect(response).toBeDefined();
      expect(response.output).toBeTruthy();
      logger.info('Registration response:', response.output);
      
      if (response.transactionId) {
        expect(response.transactionId).toBeTruthy();
        logger.info('Transaction ID:', response.transactionId);
      }
    }, 120000);
  });

  describe('Agent Discovery', () => {
    test('Find registered agents on the network', async () => {
      const response = await agent.processMessage(
        'Use find_registrations to search for agents with TEXT_GENERATION capability'
      );

      expect(response).toBeDefined();
      expect(response.output).toBeTruthy();
      logger.info('Search results:', response.output);
    }, 60000);

    test('Search agents by tag', async () => {
      const response = await agent.processMessage(
        'Use find_registrations to find agents with the tag "ai"'
      );

      expect(response).toBeDefined();
      expect(response.output).toBeTruthy();
      logger.info('Tag search results:', response.output);
    }, 60000);
  });

  describe('Profile Operations', () => {
    test('Retrieve profile for current account', async () => {
      const response = await agent.processMessage(
        `Use retrieve_profile to get the profile for account ${accountId}`
      );

      expect(response).toBeDefined();
      expect(response.output).toBeTruthy();
      logger.info('Profile data:', response.output);
    }, 60000);

    test('Retrieve profile for known agent', async () => {
      const knownAgent = process.env.TODD_ACCOUNT_ID || '0.0.5844406';
      const response = await agent.processMessage(
        `Use retrieve_profile to get the profile for account ${knownAgent}`
      );

      expect(response).toBeDefined();
      expect(response.output).toBeTruthy();
      logger.info('Known agent profile:', response.output);
    }, 60000);
  });

  describe('Connection Management', () => {
    test('List active connections', async () => {
      const response = await agent.processMessage(
        'Use list_connections to show all my active connections'
      );

      expect(response).toBeDefined();
      expect(response.output).toBeTruthy();
      logger.info('Active connections:', response.output);
    }, 60000);

    test.skip('Monitor for connection requests', async () => {
      const response = await agent.processMessage(
        'Use monitor_connections to check for incoming connection requests'
      );

      expect(response).toBeDefined();
      expect(response.output).toBeTruthy();
      logger.info('Connection monitor result:', response.output);
    }, 60000);

    test('List unapproved connection requests', async () => {
      const response = await agent.processMessage(
        'Use list_unapproved_connection_requests to see pending requests'
      );

      expect(response).toBeDefined();
      expect(response.output).toBeTruthy();
      logger.info('Unapproved requests:', response.output);
    }, 60000);
  });

  describe('Message Operations', () => {
    test('Check for messages on connections', async () => {
      const response = await agent.processMessage(
        'Use check_messages to see if there are any new messages'
      );

      expect(response).toBeDefined();
      expect(response.output).toBeTruthy();
      logger.info('Message check result:', response.output);
    }, 60000);
  });

  describe('Error Handling', () => {
    test('Handle invalid account ID gracefully', async () => {
      const response = await agent.processMessage(
        'Use retrieve_profile to get profile for account 0.0.invalid'
      );

      expect(response).toBeDefined();
      expect(response.output).toBeTruthy();
      logger.info('Error response:', response.output);
    }, 60000);

    test('Handle non-existent account gracefully', async () => {
      const response = await agent.processMessage(
        'Use retrieve_profile to get profile for account 0.0.99999999'
      );

      expect(response).toBeDefined();
      expect(response.output).toBeTruthy();
      logger.info('Non-existent account response:', response.output);
    }, 60000);
  });

  describe('Complex Workflows', () => {
    test('Multi-step agent interaction workflow', async () => {
      const findResponse = await agent.processMessage(
        'First, use find_registrations to find any agents with AI capabilities'
      );
      expect(findResponse).toBeDefined();
      logger.info('Step 1 - Find agents:', findResponse.output);

      const connectionsResponse = await agent.processMessage(
        'Now use list_connections to see my current connections'
      );
      expect(connectionsResponse).toBeDefined();
      logger.info('Step 2 - Connections:', connectionsResponse.output);

      const messagesResponse = await agent.processMessage(
        'Finally, use check_messages to see if I have any messages'
      );
      expect(messagesResponse).toBeDefined();
      logger.info('Step 3 - Messages:', messagesResponse.output);
    }, 180000);
  });
});