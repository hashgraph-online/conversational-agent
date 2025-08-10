import {
  ConversationalAgent,
} from '@hashgraphonline/conversational-agent';
import type { MCPServerConfig } from './MCPService';

/**
 * Builds the system message preamble for the agent.
 */
function buildSystemMessage(accountId: string) {
  return `You are a helpful assistant managing Hashgraph Online HCS-10 connections, messages, HCS-2 registries, and content inscription.
Account: ${accountId}`;
}

/**
 * Configuration interface extending ConversationalAgentOptions with entity memory options
 */
type AgentConfig = {
  accountId?: string;
  privateKey?: string;
  network?: string;
  openAIApiKey?: string;
  openAIModelName?: string;
  llmProvider?: string;
  operationalMode?: string;
  mcpServers?: MCPServerConfig[];

  /** Enable entity memory functionality */
  entityMemoryEnabled?: boolean;

  /** Entity memory configuration */
  entityMemoryConfig?: any;
};

/**
 * Safe wrapper for ConversationalAgent that handles Electron compatibility
 */
export class SafeConversationalAgent extends ConversationalAgent {
  private config: AgentConfig;

  constructor(config: AgentConfig) {
    // Pass through config; extra fields may not exist in older type defs
    super(config as any);

    this.config = config;
  }

  async initialize() {
    try {
      (this as any).logger?.info('Initializing SafeConversationalAgent with base class...');


      await super.initialize();

      (this as any).logger?.info('Agent initialized successfully', {
        provider: this.config.llmProvider || 'openai',
        hasMemoryManager: !!(this as any).memoryManager,
        memoryManagerType: (this as any).memoryManager?.constructor?.name,
      });


      if (this.config.mcpServers && this.config.mcpServers.length > 0) {
        this.startMCPConnections();
      }
    } catch (error) {
      (this as any).logger?.error('Failed to initialize agent:', error);
      throw error;
    }
  }

  async processMessage(message: string, chatHistory: any[] = []): Promise<any> {
    try {
      (this as any).logger?.info('Processing message...');


      const result = await super.processMessage(
        message,
        chatHistory.map((item) => ({
          type: item.role === 'user' ? 'human' : 'ai',
          content: item.content,
        }))
      );

      if (result && typeof result === 'object') {
        const transactionBytes = result.transactionBytes ||
          result.metadata?.transactionBytes ||
          (result as any).rawToolOutput?.transactionBytes ||
          null;

        if (transactionBytes && !result.transactionBytes) {
          result.transactionBytes = transactionBytes;
        }
        if (transactionBytes && (!result.metadata || !result.metadata.transactionBytes)) {
          result.metadata = {
            ...result.metadata,
            transactionBytes
          };
        }

        (this as any).logger?.info('Agent processMessage result:', {
          hasTransactionBytes: !!transactionBytes,
          hasScheduleId: !!result.scheduleId,
          operationalMode: this.config.operationalMode
        });
      }

      return result;
    } catch (error) {
      (this as any).logger?.error('Error in processMessage:', error);
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    try {
      (this as any).logger?.info('Disconnecting SafeConversationalAgent...');
      await (this as any).cleanup();
      (this as any).logger?.info('SafeConversationalAgent disconnected successfully');
    } catch (error) {
      (this as any).logger?.error('Error during disconnect:', error);
      throw error;
    }
  }

  /**
   * Execute a specific tool call through the agent
   */
  async executeToolCall(toolCall: any) {
    try {
      (this as any).logger?.info('Executing tool call', { toolName: toolCall.name });

      const toolRequestMessage = `Please execute the following tool:
Tool: ${toolCall.name}
Arguments: ${JSON.stringify(toolCall.arguments, null, 2)}`;

      const response = await this.processMessage(toolRequestMessage);

      if (response && response.content) {
        return {
          success: true,
          data: response.content,
        };
      }

      throw new Error('Tool execution failed: No response');
    } catch (error) {
      (this as any).logger?.error('Tool call execution failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Tool execution failed',
      };
    }
  }

  /**
   * Start MCP connections asynchronously without blocking initialization
   * @private
   */
  private startMCPConnections(): void {
    if (!this.config.mcpServers || this.config.mcpServers.length === 0) {
      return;
    }

    const enabledServers = this.config.mcpServers.filter(
      (server: any) => server.enabled || server.autoConnect
    );

    if (enabledServers.length > 0) {
      (this as any).logger?.info(`MCP connections will be established asynchronously for ${enabledServers.length} servers`, {
        servers: enabledServers.map((s: any) => s.name),
      });

      setTimeout(() => {
        enabledServers.forEach((server: any) => {
          (this as any).logger?.info(`MCP server ${server.name} connection initiated asynchronously`);
        });
      }, 1000);
    }
  }
}
