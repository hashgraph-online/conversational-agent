import * as dotenv from 'dotenv';
import readline from 'readline';
import { ConversationalAgent } from '../src/ConversationalAgent';
import { HCS10Client } from '@hashgraphonline/standards-sdk';
import type { NetworkType } from '@hashgraphonline/standards-sdk';

dotenv.config();

interface AgentIdentity {
  name: string;
  accountId: string;
  privateKey: string;
  inboundTopicId: string;
  outboundTopicId: string;
  profileTopicId?: string;
}

let agent: ConversationalAgent;

async function loadAgentFromEnv(prefix: string): Promise<AgentIdentity | null> {
  const accountId = process.env[`${prefix}_ACCOUNT_ID`];
  const privateKey = process.env[`${prefix}_PRIVATE_KEY`];
  const inboundTopicId = process.env[`${prefix}_INBOUND_TOPIC_ID`];
  const outboundTopicId = process.env[`${prefix}_OUTBOUND_TOPIC_ID`];
  const profileTopicId = process.env[`${prefix}_PROFILE_TOPIC_ID`];

  if (!accountId || !privateKey || !inboundTopicId || !outboundTopicId) {
    console.log(`Incomplete agent details for prefix ${prefix}, skipping.`);
    return null;
  }

  return {
    name: `${prefix} Agent`,
    accountId,
    privateKey,
    inboundTopicId,
    outboundTopicId,
    profileTopicId,
  };
}

async function promptUserToSelectAgent(
  agents: AgentIdentity[]
): Promise<AgentIdentity | null> {
  if (agents.length === 0) {
    console.log('No agents available. Please register a new agent first.');
    return null;
  }

  if (agents.length === 1) {
    console.log(`Auto-selecting the only available agent: ${agents[0].name}`);
    return agents[0];
  }

  console.log('\nAvailable agents:');
  agents.forEach((agent, index) => {
    console.log(`${index + 1}. ${agent.name} (${agent.accountId})`);
  });

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  const choice = await new Promise<string>((resolve) => {
    rl.question(
      'Select agent number (or press Enter to use first agent): ',
      resolve
    );
  });
  rl.close();

  if (!choice.trim()) {
    console.log(`Defaulting to first agent: ${agents[0].name}`);
    return agents[0];
  }

  const index = parseInt(choice) - 1;
  if (isNaN(index) || index < 0 || index >= agents.length) {
    console.log(`Invalid choice. Defaulting to first agent: ${agents[0].name}`);
    return agents[0];
  }

  return agents[index];
}

async function initialize() {
  console.log('Initializing ConversationalAgent Demo...');
  try {
    const operatorId = process.env.HEDERA_OPERATOR_ID!;
    const operatorKey = process.env.HEDERA_OPERATOR_KEY!;
    const network = process.env.HEDERA_NETWORK || 'testnet';
    const openaiApiKey = process.env.OPENAI_API_KEY!;

    if (!operatorId || !operatorKey) {
      throw new Error(
        'HEDERA_OPERATOR_ID and HEDERA_OPERATOR_KEY must be set in .env for initial client setup.'
      );
    }
    if (!openaiApiKey) {
      throw new Error('OPENAI_API_KEY must be set in .env');
    }

    const hederaNetwork = network.toLowerCase();
    if (hederaNetwork !== 'mainnet' && hederaNetwork !== 'testnet') {
      throw new Error(
        `Invalid HEDERA_NETWORK: ${network}. Must be 'mainnet' or 'testnet'.`
      );
    }

    const networkType: NetworkType =
      hederaNetwork === 'mainnet' ? 'mainnet' : 'testnet';

    const knownPrefixes = (process.env.KNOWN_AGENT_PREFIXES || 'TODD')
      .split(',')
      .map((prefix) => prefix.trim())
      .filter((prefix) => prefix.length > 0);

    console.log(
      `Found ${
        knownPrefixes.length
      } known agent prefix(es): ${knownPrefixes.join(', ')}`
    );

    const loadedAgents: AgentIdentity[] = [];
    for (const prefix of knownPrefixes) {
      const agentData = await loadAgentFromEnv(prefix);
      if (agentData) {
        loadedAgents.push(agentData);
        console.log(`Loaded agent: ${agentData.name} (${agentData.accountId})`);
      }
    }

    let selectedAccountId = operatorId;
    let selectedPrivateKey = operatorKey;

    if (loadedAgents.length > 0) {
      const selectedAgent = await promptUserToSelectAgent(loadedAgents);

      if (selectedAgent) {
        console.log(
          `Using agent: ${selectedAgent.name} (${selectedAgent.accountId})`
        );

        selectedAccountId = selectedAgent.accountId;
        selectedPrivateKey = selectedAgent.privateKey;
      }
    }

    console.log('\nInitializing ConversationalAgent with OpenConvAI plugin...');
    agent = new ConversationalAgent({
      accountId: selectedAccountId,
      privateKey: selectedPrivateKey,
      network: networkType,
      openAIApiKey: openaiApiKey,
      openAIModelName: 'gpt-4o',
    });

    await agent.initialize();

    const stateManager = agent.getStateManager();

    if (loadedAgents.length > 0) {
      const selectedAgent = loadedAgents.find(
        (a) => a.accountId === selectedAccountId
      );
      if (selectedAgent) {
        stateManager.setCurrentAgent({
          name: selectedAgent.name,
          accountId: selectedAgent.accountId,
          inboundTopicId: selectedAgent.inboundTopicId,
          outboundTopicId: selectedAgent.outboundTopicId,
          profileTopicId: selectedAgent.profileTopicId,
        });
      }
    }

    const hcs10Client = new HCS10Client({
      network: networkType,
      operatorId: selectedAccountId,
      operatorPrivateKey: selectedPrivateKey,
      logLevel: 'error',
    });
    stateManager.initializeConnectionsManager(hcs10Client);

    console.log('ConversationalAgent demo initialized.');

    await new Promise((resolve) => setTimeout(resolve, 1000));

    await startConnectionMonitoring();
  } catch (error) {
    console.error('Initialization failed:', error);
    process.exit(1);
  }
}

async function startConnectionMonitoring(): Promise<void> {
  console.log('\n----------------------------------------');
  console.log(
    'Note: To monitor connections, ask the agent to "monitor connections"'
  );
  console.log('----------------------------------------\n');
}

async function chatLoop() {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  console.log("\nAgent ready. Type your message or 'exit' to quit.");

  while (true) {
    const userInput = await new Promise<string>((resolve) => {
      rl.question('You: ', resolve);
    });

    if (userInput.toLowerCase() === 'exit') {
      console.log('Exiting chat...');
      rl.close();
      break;
    }

    try {
      console.log('Agent thinking...');
      const result = await agent.processMessage(userInput);
      console.log(`Agent: ${result.message || result.output}`);

      if (result.transactionBytes) {
        console.log('\nTransaction bytes:', result.transactionBytes);
      }
      if (result.scheduleId) {
        console.log('Schedule ID:', result.scheduleId);
      }
      if (result.transactionId) {
        console.log('Transaction ID:', result.transactionId);
      }
    } catch (error) {
      console.error('Error during agent execution:', error);
      console.log(
        'Agent: Sorry, I encountered an error processing your request. Please try again.'
      );
    }
  }
}

async function main() {
  try {
    await initialize();

    await chatLoop();
  } catch (err) {
    console.error('Unhandled error in main execution flow:', err);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('Unhandled error in main loop:', err);
  process.exit(1);
});
