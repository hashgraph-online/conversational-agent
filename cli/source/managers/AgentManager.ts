import {ConversationalAgent, type ConversationalAgentOptions, MCPServers, type MCPServerConfig} from '@hashgraphonline/conversational-agent';
import {type Config, type Message} from '../types';

export class AgentManager {
  private static instance: AgentManager;
  private agent: ConversationalAgent | null = null;
  private initializing = false;
  private initialized = false;

  private constructor() {}

  static getInstance(): AgentManager {
    if (!AgentManager.instance) {
      AgentManager.instance = new AgentManager();
    }
    return AgentManager.instance;
  }

  /**
   * Initialize the conversational agent
   */
  async initialize(config: Config & {mcpServers: MCPServerConfig[]}, mcpConfig: {
    enableFilesystem: boolean;
    filesystemPath: string;
    customServers: MCPServerConfig[];
  }): Promise<{agent: ConversationalAgent; welcomeMessages: Message[]}> {
    if (this.agent && this.initialized) {
      return {
        agent: this.agent,
        welcomeMessages: this.getWelcomeMessages(config, [])
      };
    }

    if (this.initializing) {
      throw new Error('Agent is already initializing');
    }

    this.initializing = true;
    
    try {
      const mcpServers: MCPServerConfig[] = [];

      if (mcpConfig.enableFilesystem && mcpConfig.filesystemPath) {
        mcpServers.push(MCPServers.filesystem(mcpConfig.filesystemPath));
      }

      mcpServers.push(...mcpConfig.customServers);

      const agentConfig: ConversationalAgentOptions = {
        accountId: config.accountId,
        privateKey: config.privateKey,
        network: config.network as 'testnet' | 'mainnet',
        openAIApiKey: config.openAIApiKey,
        openAIModelName: 'gpt-4o-mini',
        verbose: false,
        disableLogging: true,
        ...(mcpServers.length > 0 && {mcpServers}),
      };

      const conversationalAgent = new ConversationalAgent(agentConfig);
      await conversationalAgent.initialize();
      
      this.agent = conversationalAgent;
      this.initialized = true;
      
      const welcomeMessages = this.getWelcomeMessages(config, mcpServers);
      
      return {agent: conversationalAgent, welcomeMessages};
    } finally {
      this.initializing = false;
    }
  }

  /**
   * Get welcome messages
   */
  private getWelcomeMessages(config: Config, mcpServers: MCPServerConfig[]): Message[] {
    const welcomeMessages: Message[] = [
      {
        role: 'system',
        content: `Connected to Hedera ${config.network}`,
        timestamp: new Date(),
      },
    ];

    if (mcpServers.length > 0) {
      welcomeMessages.push({
        role: 'system',
        content: `MCP servers enabled: ${mcpServers.map(s => s.name).join(', ')}`,
        timestamp: new Date(),
      });
    }

    welcomeMessages.push({
      role: 'assistant',
      content:
        mcpServers.length > 0
          ? "Hello! I'm your Conversational Agent powered by Hashgraph Online, with extended MCP capabilities. I can help you with:\n\n• HCS-10 agent registrations and HCS-11 profiles\n• Sending messages through HCS standards\n• Creating accounts, transferring HBAR, and managing tokens\n• Deploying smart contracts and interacting with them\n• Managing NFTs, token swaps, and staking operations\n• Scheduling transactions and consensus submissions\n• File operations and external tool integration\n\nHow can I assist you today?"
          : "Hello! I'm your Conversational Agent powered by Hashgraph Online. I can help you with:\n\n• HCS-10 agent registrations and HCS-11 profiles\n• Sending messages through HCS standards\n• Creating accounts, transferring HBAR, and managing tokens\n• Deploying smart contracts and interacting with them\n• Managing NFTs, token swaps, and staking operations\n• Scheduling transactions and consensus submissions\n\nHow can I assist you today?",
      timestamp: new Date(),
    });

    return welcomeMessages;
  }

  /**
   * Send message to agent
   */
  async sendMessage(message: string, chatHistory: Array<{type: 'human' | 'ai'; content: string}>): Promise<{
    message?: string;
    output?: string;
    error?: string;
    transactionId?: string;
    scheduleId?: string;
    notes?: string[];
  }> {
    if (!this.agent) {
      throw new Error('Agent not initialized');
    }

    return this.agent.processMessage(message, chatHistory);
  }

  /**
   * Get current agent
   */
  getAgent(): ConversationalAgent | null {
    return this.agent;
  }

  /**
   * Check if agent is initialized
   */
  isInitialized(): boolean {
    return this.initialized;
  }

  /**
   * Check if agent is initializing
   */
  isInitializing(): boolean {
    return this.initializing;
  }

  /**
   * Reset agent (for testing)
   */
  reset(): void {
    this.agent = null;
    this.initialized = false;
    this.initializing = false;
  }
}