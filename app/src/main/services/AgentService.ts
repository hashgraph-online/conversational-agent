import { SafeConversationalAgent } from './SafeConversationalAgent';
import { Logger } from '../utils/logger';
import type { NetworkType } from '@hashgraphonline/standards-sdk';
import type { ConversationalAgentOptions } from '@hashgraphonline/conversational-agent';
import { MCPService } from './MCPService';
import type { MCPServerConfig } from './MCPService';

export interface AgentConfig {
  accountId: string;
  privateKey: string;
  network: NetworkType;
  openAIApiKey: string;
  modelName?: string;
  operationalMode?: 'autonomous' | 'returnBytes';
  llmProvider?: 'openai' | 'anthropic';
  mcpServers?: MCPServerConfig[];
}

export interface AgentMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  metadata?: {
    transactionId?: string;
    scheduleId?: string;
    notes?: string[];
    transactionBytes?: string;
    [key: string]: any;
  };
}

export interface ChatHistory {
  type: 'human' | 'ai';
  content: string;
}

/**
 * Service for managing the ConversationalAgent instance in the main process
 */
export class AgentService {
  private static instance: AgentService;
  private agent: SafeConversationalAgent | null = null;
  private logger: Logger;
  private initializing = false;
  private initialized = false;
  private sessionId: string | null = null;
  private lastConfig: AgentConfig | null = null;

  private constructor() {
    this.logger = new Logger({ module: 'AgentService' });
  }

  /**
   * Get singleton instance
   */
  static getInstance(): AgentService {
    if (!AgentService.instance) {
      AgentService.instance = new AgentService();
    }
    return AgentService.instance;
  }

  /**
   * Initialize the conversational agent
   */
  async initialize(config: AgentConfig): Promise<{ success: boolean; sessionId?: string; error?: string }> {
    if (this.agent && this.initialized && this.lastConfig) {
      const configChanged = 
        this.lastConfig.openAIApiKey !== config.openAIApiKey ||
        this.lastConfig.accountId !== config.accountId ||
        this.lastConfig.privateKey !== config.privateKey ||
        this.lastConfig.operationalMode !== config.operationalMode;
      
      if (!configChanged) {
        return {
          success: true,
          sessionId: this.sessionId!
        };
      }
      
      this.logger.info('Config changed, reinitializing agent...', {
        modeChanged: this.lastConfig.operationalMode !== config.operationalMode,
        oldMode: this.lastConfig.operationalMode,
        newMode: config.operationalMode
      });
      this.agent = null;
      this.initialized = false;
    }

    if (this.initializing) {
      throw new Error('Agent is already initializing');
    }

    this.initializing = true;
    this.lastConfig = { ...config };
    
    try {
      let mcpServers = config.mcpServers;
      if (!mcpServers) {
        const mcpService = MCPService.getInstance();
        const loadedServers = await mcpService.loadServers();
        
        mcpServers = loadedServers.map(server => {
          let command: string;
          let args: string[] = [];
          
          switch (server.type) {
            case 'filesystem':
              command = 'npx';
              args = ['-y', '@modelcontextprotocol/server-filesystem', server.config.rootPath || process.cwd()];
              break;
            case 'github':
              command = 'npx';
              args = ['-y', '@modelcontextprotocol/server-github'];
              break;
            case 'postgres':
              command = 'npx';
              args = ['-y', '@modelcontextprotocol/server-postgres'];
              break;
            case 'sqlite':
              command = 'npx';
              args = ['-y', '@modelcontextprotocol/server-sqlite', server.config.path];
              break;
            case 'custom':
              command = server.config.command;
              if (server.config.args) {
                args = Array.isArray(server.config.args) 
                  ? server.config.args 
                  : server.config.args.split(' ');
              } else {
                args = [];
              }
              break;
            default:
              command = server.config.command || 'echo';
              args = ['Unknown server type'];
          }
          
          return {
            id: server.id,
            name: server.name,
            command,
            args,
            enabled: server.enabled,
            autoConnect: true
          };
        });
      }
      
      this.logger.info('AgentService.initialize called with config:', {
        accountId: config.accountId,
        privateKeyLength: config.privateKey?.length,
        privateKeyStatus: '[REDACTED]',
        network: config.network,
        openAIKeyLength: config.openAIApiKey?.length,
        modelName: config.modelName,
        operationalMode: config.operationalMode,
        llmProvider: config.llmProvider,
        mcpServerCount: mcpServers?.length || 0,
        enabledMcpServers: mcpServers?.filter(s => s.enabled).length || 0,
        mcpServers: mcpServers?.map(s => ({ 
          id: s.id, 
          name: s.name, 
          enabled: s.enabled,
          command: s.command,
          args: s.args
        }))
      });
      
      const agentConfig: ConversationalAgentOptions & { mcpServers?: MCPServerConfig[]; llmProvider?: string } = {
        accountId: config.accountId,
        privateKey: config.privateKey,
        network: config.network,
        openAIApiKey: config.openAIApiKey,
        openAIModelName: config.modelName || 'gpt-4o-mini',
        operationalMode: config.operationalMode || 'autonomous',
        verbose: false,
        disableLogging: true,
        mcpServers: mcpServers,
        llmProvider: config.llmProvider
      };

      const conversationalAgent = new SafeConversationalAgent(agentConfig);
      await conversationalAgent.initialize();
      
      this.agent = conversationalAgent;
      this.initialized = true;
      this.sessionId = `session-${Date.now()}`;
      
      this.logger.info('Agent initialized successfully');
      
      return {
        success: true,
        sessionId: this.sessionId
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to initialize agent';
      this.logger.error('Failed to initialize agent:', error);
      
      return {
        success: false,
        error: errorMessage
      };
    } finally {
      this.initializing = false;
    }
  }

  /**
   * Send message to agent
   */
  async sendMessage(
    content: string, 
    chatHistory: ChatHistory[] = []
  ): Promise<{ 
    success: boolean; 
    response?: AgentMessage; 
    error?: string 
  }> {
    if (!this.agent || !this.initialized) {
      return {
        success: false,
        error: 'Agent not initialized'
      };
    }

    try {
      this.logger.info('Sending message to agent:', { content, historyLength: chatHistory.length });
      
      const response = await this.agent.processMessage(content, chatHistory);
      
      this.logger.info('Agent response:', {
        hasMessage: !!response.message,
        hasOutput: !!response.output,
        hasTransactionBytes: !!response.transactionBytes,
        hasScheduleId: !!response.scheduleId,
        hasMetadata: !!response.metadata,
        hasIntermediateSteps: !!response.intermediateSteps,
        hasRawToolOutput: !!response.rawToolOutput,
        messagePreview: response.message?.substring(0, 100),
        outputPreview: response.output?.substring(0, 100),
        directScheduleId: response.scheduleId,
        directSuccess: response.success,
        directOp: response.op,
        fullResponse: response
      });
      
      const scheduleId = response.scheduleId;
      const description = response.description;
      
      if (scheduleId) {
        this.logger.info('Found schedule ID directly on response:', scheduleId);
      } else {
        this.logger.warn('No schedule ID found on response. Check the agent configuration.');
      }
      
      const agentMessage: AgentMessage = {
        id: `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        role: 'assistant',
        content: response.message || response.output || '',
        timestamp: new Date(),
        metadata: {
          transactionId: response.transactionId,
          scheduleId: scheduleId,
          notes: response.notes,
          transactionBytes: response.transactionBytes || response.metadata?.transactionBytes,
          description: description || response.description,
          ...response.metadata
        }
      };
      
      this.logger.info('Returning agent message:', agentMessage);
      
      return {
        success: true,
        response: agentMessage
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to send message';
      this.logger.error('Failed to send message:', error);
      
      return {
        success: false,
        error: errorMessage
      };
    }
  }

  /**
   * Disconnect agent
   */
  async disconnect(): Promise<{ success: boolean; error?: string }> {
    try {
      this.agent = null;
      this.initialized = false;
      this.initializing = false;
      this.sessionId = null;
      
      this.logger.info('Agent disconnected successfully');
      
      return { success: true };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to disconnect';
      this.logger.error('Failed to disconnect agent:', error);
      
      return {
        success: false,
        error: errorMessage
      };
    }
  }

  /**
   * Get agent status
   */
  getStatus(): { 
    isInitialized: boolean; 
    isInitializing: boolean; 
    sessionId: string | null 
  } {
    return {
      isInitialized: this.initialized,
      isInitializing: this.initializing,
      sessionId: this.sessionId
    };
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
   * Get the current agent instance
   */
  getAgent(): SafeConversationalAgent | null {
    return this.agent;
  }
}