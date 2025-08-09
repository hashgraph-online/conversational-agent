import { SafeConversationalAgent } from './SafeConversationalAgent';
import { Logger } from '../utils/logger';
import type { NetworkType } from '@hashgraphonline/standards-sdk';
import type { ConversationalAgentOptions } from '@hashgraphonline/conversational-agent';
import { MCPService } from './MCPService';
import type { MCPServerConfig } from './MCPService';
import { AgentLoader } from './AgentLoader';
import type { ProgressiveLoadConfig } from '../../shared/types/mcp-performance';

export interface AgentConfig {
  accountId: string;
  privateKey: string;
  network: NetworkType;
  openAIApiKey: string;
  modelName?: string;
  operationalMode?: 'autonomous' | 'returnBytes';
  llmProvider?: 'openai' | 'anthropic';
  mcpServers?: MCPServerConfig[];
  useProgressiveLoading?: boolean;
  progressiveLoadConfig?: Partial<ProgressiveLoadConfig>;
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
  private agentLoader!: AgentLoader;

  private constructor() {
    this.logger = new Logger({ module: 'AgentService' });
  }

  /**
   * Get singleton instance
   */
  static getInstance(): AgentService {
    if (!AgentService.instance) {
      AgentService.instance = new AgentService();
      AgentService.instance.initializeProgressiveLoader();
    }
    return AgentService.instance;
  }

  /**
   * Initialize the agent loader and inject this service
   */
  private initializeProgressiveLoader(): void {
    this.agentLoader = AgentLoader.getInstance();
    this.agentLoader.setAgentService(this);
    this.logger.debug('Agent loader initialized with AgentService injection');
  }


  /**
   * Initialize the conversational agent
   */
  async initialize(config: AgentConfig): Promise<{ 
    success: boolean; 
    sessionId?: string; 
    error?: string;
    coreReadyTimeMs?: number;
    backgroundTasksRemaining?: number;
    loadingPhase?: string;
  }> {
    if (this.agent && this.initialized && this.lastConfig) {
      const configChanged = 
        this.lastConfig.openAIApiKey !== config.openAIApiKey ||
        this.lastConfig.accountId !== config.accountId ||
        this.lastConfig.privateKey !== config.privateKey ||
        this.lastConfig.operationalMode !== config.operationalMode;
      
      if (!configChanged) {
        return {
          success: true,
          sessionId: this.sessionId!,
          coreReadyTimeMs: 0,
          backgroundTasksRemaining: 0,
          loadingPhase: 'completed'
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
      if (config.useProgressiveLoading !== false) {
        this.logger.info('Using progressive agent loading for enhanced performance');
        
        if (!this.agentLoader) {
          this.initializeProgressiveLoader();
        }
        const progressiveResult = await this.agentLoader.loadAgent(
          config,
          config.progressiveLoadConfig
        );

        if (progressiveResult.success) {
          this.initialized = true;
          this.sessionId = progressiveResult.sessionId!;
          
          if (!this.agent) {
            this.logger.warn('Agent not set after progressive initialization, this may indicate an issue');
          }
          
          return {
            success: true,
            sessionId: this.sessionId,
            coreReadyTimeMs: progressiveResult.coreReadyTimeMs,
            backgroundTasksRemaining: progressiveResult.backgroundTasksRemaining,
            loadingPhase: 'core-ready'
          };
        } else {
          this.logger.warn('Progressive loading failed, falling back to traditional loading:', progressiveResult.error);
        }
      }
      
      this.logger.info('Using traditional agent loading');
      return await this.initializeTraditional(config);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to initialize agent';
      this.logger.error('Failed to initialize agent:', error);
      
      return {
        success: false,
        error: errorMessage,
        coreReadyTimeMs: 0,
        backgroundTasksRemaining: 0,
        loadingPhase: 'failed'
      };
    } finally {
      this.initializing = false;
    }
  }

  /**
   * Internal initialization method for progressive loader
   * This bypasses the initializing check to allow recursive calls
   */
  async initializeInternal(config: AgentConfig): Promise<{ 
    success: boolean; 
    sessionId?: string; 
    error?: string;
  }> {
    return await this.initializeTraditional(config);
  }

  /**
   * Traditional agent initialization (fallback method)
   */
  private async initializeTraditional(config: AgentConfig): Promise<{ 
    success: boolean; 
    sessionId?: string; 
    error?: string;
    coreReadyTimeMs?: number;
    backgroundTasksRemaining?: number;
    loadingPhase?: string;
  }> {
    const startTime = Date.now();
    
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
              command = server.config.command || 'npx';
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
            name: server.name,
            command,
            args,
            autoConnect: true
          } as any;
        }) as any;
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
        enabledMcpServers: mcpServers?.filter((s: any) => s.enabled).length || 0,
        mcpServers: mcpServers?.map((s: any) => ({ 
          name: s.name, 
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
        mcpServers: mcpServers as any,
        llmProvider: config.llmProvider
      };

      const conversationalAgent = new SafeConversationalAgent(agentConfig);
      await conversationalAgent.initialize();
      
      this.agent = conversationalAgent;
      this.initialized = true;
      this.sessionId = `session-${Date.now()}`;
      
      this.logger.info('Agent initialized successfully (traditional method)');
      const initTime = Date.now() - startTime;
      
      return {
        success: true,
        sessionId: this.sessionId,
        coreReadyTimeMs: initTime,
        backgroundTasksRemaining: 0,
        loadingPhase: 'completed'
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to initialize agent';
      this.logger.error('Traditional agent initialization failed:', error);
      
      return {
        success: false,
        error: errorMessage,
        coreReadyTimeMs: Date.now() - startTime,
        backgroundTasksRemaining: 0,
        loadingPhase: 'failed'
      };
    }
  }

  /**
   * Extract transaction bytes from message content
   */
  private extractTransactionBytesFromMessage(messageContent: string): string | null {
    this.logger.info('Attempting to extract transaction bytes from message:', {
      contentLength: messageContent.length,
      contentPreview: messageContent.substring(0, 300) + '...',
      hasCodeBlocks: messageContent.includes('```')
    });
    
    // Look for base64 transaction bytes in code blocks
    const codeBlockRegex = /```[a-z]*\n([A-Za-z0-9+/]{50,}={0,2})\n```/g;
    const matches = [...messageContent.matchAll(codeBlockRegex)];
    
    this.logger.info('Code block regex matches found:', matches.length);
    
    for (const match of matches) {
      const potentialBytes = match[1];
      this.logger.info('Testing potential bytes from code block:', {
        length: potentialBytes?.length,
        preview: potentialBytes?.substring(0, 50) + '...'
      });
      
      // Basic validation - should be base64 and reasonably long for a transaction
      if (potentialBytes && potentialBytes.length > 50) {
        try {
          // Test if it's valid base64
          Buffer.from(potentialBytes, 'base64');
          this.logger.info('Valid base64 transaction bytes found in code block');
          return potentialBytes;
        } catch (error) {
          this.logger.warn('Invalid base64 in code block:', error);
          continue;
        }
      }
    }
    
    // Also look for inline base64 without code blocks
    const inlineRegex = /([A-Za-z0-9+/]{100,}={0,2})/g;
    const inlineMatches = [...messageContent.matchAll(inlineRegex)];
    
    this.logger.info('Inline regex matches found:', inlineMatches.length);
    
    for (const match of inlineMatches) {
      const potentialBytes = match[1];
      this.logger.info('Testing potential bytes inline:', {
        length: potentialBytes?.length,
        preview: potentialBytes?.substring(0, 50) + '...'
      });
      
      if (potentialBytes && potentialBytes.length > 100) {
        try {
          Buffer.from(potentialBytes, 'base64');
          this.logger.info('Valid base64 transaction bytes found inline');
          return potentialBytes;
        } catch (error) {
          this.logger.warn('Invalid base64 inline:', error);
          continue;
        }
      }
    }
    
    this.logger.warn('No valid transaction bytes found in message content');
    return null;
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
      
      // Extract transaction bytes from message content if not provided directly
      let transactionBytes = response.transactionBytes || response.metadata?.transactionBytes;
      if (!transactionBytes) {
        const messageContent = response.message || response.output || '';
        const extractedBytes = this.extractTransactionBytesFromMessage(messageContent);
        if (extractedBytes) {
          transactionBytes = extractedBytes;
          this.logger.info('Extracted transaction bytes from message content:', {
            bytesLength: extractedBytes.length
          });
        }
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
          transactionBytes: transactionBytes,
          description: description || response.description,
          ...response.metadata
        }
      };
      
      this.logger.info('Returning agent message:', {
        ...agentMessage,
        content: agentMessage.content?.substring(0, 100) + '...',
        metadata: {
          ...agentMessage.metadata,
          hasTransactionBytes: !!agentMessage.metadata?.transactionBytes,
          transactionBytesLength: agentMessage.metadata?.transactionBytes?.length || 0
        }
      });
      
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

  /**
   * Check if core functionality is ready (for progressive loading)
   */
  isCoreFunctionalityReady(): boolean {
    if (!this.agentLoader) {
      return false;
    }
    return this.agentLoader.isCoreFunctionalityReady();
  }

  /**
   * Get current loading state (for progressive loading)
   */
  getLoadingState(): any {
    if (!this.agentLoader) {
      return {
        phase: 'pending',
        progress: 0,
        coreReady: false,
        mcpConnectionsReady: false,
        backgroundTasksComplete: false
      };
    }
    return this.agentLoader.getLoadingState();
  }

  /**
   * Wait for all background tasks to complete
   */
  async waitForBackgroundTasks(timeoutMs: number = 30000): Promise<boolean> {
    if (!this.agentLoader) {
      return Promise.resolve(true);
    }
    return this.agentLoader.waitForBackgroundTasks(timeoutMs);
  }

  /**
   * Get performance metrics from all optimization systems
   */
  getPerformanceMetrics(): {
    agentMetrics: any;
    mcpMetrics?: any;
    progressiveLoading?: any;
  } {
    const mcpService = MCPService.getInstance();
    
    return {
      agentMetrics: {
        initialized: this.initialized,
        initializing: this.initializing,
        sessionId: this.sessionId,
        hasAgent: !!this.agent
      },
      mcpMetrics: mcpService.getPerformanceMetrics(),
      progressiveLoading: this.agentLoader ? this.agentLoader.getPerformanceMetrics() : null
    };
  }

  /**
   * Force progressive loading for next initialization
   */
  enableProgressiveLoading(config?: Partial<ProgressiveLoadConfig>): void {
    if (!this.agentLoader) {
      this.initializeProgressiveLoader();
    }
    if (config) {
      this.agentLoader.updateConfig(config);
    }
    this.logger.info('Progressive loading enabled for next initialization', config || {});
  }

  /**
   * Cleanup performance optimization resources
   */
  async cleanupOptimizations(): Promise<void> {
    this.logger.info('Cleaning up agent service optimization resources');
    if (this.agentLoader) {
      await this.agentLoader.cleanup();
    }
    
    const mcpService = MCPService.getInstance();
    await mcpService.cleanupOptimizations();
  }

  /**
   * Store entity association in memory for later resolution
   */
  storeEntityAssociation(
    entityId: string,
    entityName: string,
    entityType: string,
    transactionId?: string
  ): void {
    try {
      if (!this.agent) {
        this.logger.warn('Cannot store entity association: Agent not initialized');
        return;
      }

      const safeAgent = this.agent as any;
      if (safeAgent.memoryManager && typeof safeAgent.memoryManager.storeEntityAssociation === 'function') {
        safeAgent.memoryManager.storeEntityAssociation(entityId, entityName, entityType, transactionId);
        this.logger.info('Stored entity association:', {
          entityName,
          entityType,
          entityId,
          transactionId
        });
      } else {
        this.logger.warn('Memory manager not available for entity storage');
      }
    } catch (error) {
      this.logger.error('Failed to store entity association:', error);
    }
  }

  /**
   * Reinitialize agent with performance optimizations
   */
  async reinitializeWithOptimizations(
    config: AgentConfig,
    progressiveConfig?: Partial<ProgressiveLoadConfig>
  ): Promise<{ 
    success: boolean; 
    sessionId?: string; 
    error?: string;
    coreReadyTimeMs?: number;
    backgroundTasksRemaining?: number;
    performanceGain?: string;
  }> {
    const startTime = Date.now();
    
    if (this.agent) {
      await this.disconnect();
    }

    const optimizedConfig = {
      ...config,
      useProgressiveLoading: true,
      progressiveLoadConfig: {
        coreAgentTimeoutMs: 3000,
        mcpConnectionBatchSize: 3,
        mcpConnectionDelayMs: 1000,
        backgroundConnectionsEnabled: true,
        ...progressiveConfig
      }
    };

    const result = await this.initialize(optimizedConfig);
    
    if (result.success && result.coreReadyTimeMs) {
      const performanceGain = result.coreReadyTimeMs < 5000 
        ? `${Math.round(((5000 - result.coreReadyTimeMs) / 5000) * 100)}% faster` 
        : 'Standard performance';
        
      return {
        ...result,
        performanceGain
      };
    }

    return result;
  }

  /**
   * Get MCP connection status for all servers
   * @returns {Promise<Map<string, any> | null>} Connection status map or null if agent not initialized
   */
  async getMCPConnectionStatus(): Promise<Map<string, any> | null> {
    if (!this.agent || !this.initialized) {
      this.logger.warn('Cannot get MCP status: agent not initialized');
      return null;
    }

    try {
      // Check if the agent has MCP status methods
      if (typeof (this.agent as any).getMCPConnectionStatus === 'function') {
        return (this.agent as any).getMCPConnectionStatus();
      }

      this.logger.debug('Agent does not support MCP connection status');
      return new Map();
    } catch (error) {
      this.logger.error('Failed to get MCP connection status:', error);
      return null;
    }
  }

  /**
   * Check if a specific MCP server is connected
   * @param {string} serverName - Name of the server to check
   * @returns {Promise<boolean>} True if connected, false otherwise
   */
  async isMCPServerConnected(serverName: string): Promise<boolean> {
    if (!this.agent || !this.initialized) {
      return false;
    }

    try {
      // Check if the agent has MCP status methods
      if (typeof (this.agent as any).isMCPServerConnected === 'function') {
        return (this.agent as any).isMCPServerConnected(serverName);
      }

      return false;
    } catch (error) {
      this.logger.error(`Failed to check MCP server connection status for ${serverName}:`, error);
      return false;
    }
  }

  /**
   * Get summary of MCP connection status
   * @returns {Promise<{total: number, connected: number, pending: number, failed: number}>}
   */
  async getMCPConnectionSummary(): Promise<{total: number, connected: number, pending: number, failed: number}> {
    const status = await this.getMCPConnectionStatus();
    
    if (!status) {
      return { total: 0, connected: 0, pending: 0, failed: 0 };
    }

    let connected = 0;
    let pending = 0; 
    let failed = 0;

    status.forEach((serverStatus: any) => {
      if (serverStatus.connected === true) {
        connected++;
      } else if (serverStatus.error) {
        failed++;
      } else {
        pending++;
      }
    });

    return {
      total: status.size,
      connected,
      pending,
      failed
    };
  }
}