import type { BaseMessage } from '@langchain/core/messages';
import type { StructuredTool } from '@langchain/core/tools';
import type { TransactionReceipt } from '@hashgraph/sdk';
import {
  HederaAgentKit,
  ServerSigner,
  TokenUsageCallbackHandler,
  TokenUsage,
  BasePlugin,
} from 'hedera-agent-kit';
import type { CostCalculation } from 'hedera-agent-kit';
import type { AIProvider, VercelAIProvider, BAMLProvider } from './providers';
import { Logger } from '@hashgraphonline/standards-sdk';
import type { MCPServerConfig, MCPConnectionStatus } from './mcp/types';

export interface ToolFilterConfig {
  namespaceWhitelist?: string[];
  toolBlacklist?: string[];
  toolPredicate?: (tool: StructuredTool) => boolean;
}

export type ExecutionMode = 'direct' | 'bytes';
export type OperationalMode = 'autonomous' | 'returnBytes';

export interface HederaAgentConfiguration {
  signer: ServerSigner;
  execution?: {
    mode?: ExecutionMode;
    operationalMode?: OperationalMode;
    userAccountId?: string;
    scheduleUserTransactions?: boolean;
    scheduleUserTransactionsInBytesMode?: boolean;
  };
  ai?: {
    provider?: AIProvider;
    llm?: unknown;
    apiKey?: string;
    modelName?: string;
    temperature?: number;
  };
  filtering?: ToolFilterConfig;
  messaging?: {
    systemPreamble?: string;
    systemPostamble?: string;
    conciseMode?: boolean;
  };
  extensions?: {
    plugins?: BasePlugin[];
    mirrorConfig?: Record<string, unknown>;
    modelCapability?: string;
  };
  mcp?: {
    servers?: MCPServerConfig[];
    autoConnect?: boolean;
  };
  debug?: {
    verbose?: boolean;
    silent?: boolean;
  };
}

export interface ConversationContext {
  messages: BaseMessage[];
  metadata?: Record<string, unknown>;
}

export interface ChatResponse {
  output: string;
  message?: string;
  transactionBytes?: string;
  receipt?: TransactionReceipt | object;
  scheduleId?: string;
  transactionId?: string;
  notes?: string[];
  error?: string;
  intermediateSteps?: unknown;
  rawToolOutput?: unknown;
  tokenUsage?: TokenUsage;
  cost?: CostCalculation;
  metadata?: Record<string, unknown>;
  tool_calls?: Array<{
    id: string;
    name: string;
    args: Record<string, unknown>;
    output?: string;
  }>;
  [key: string]: unknown;
}

export interface UsageStats extends TokenUsage {
  cost: CostCalculation;
}

export abstract class BaseAgent {
  protected logger: Logger;
  protected agentKit: HederaAgentKit | undefined;
  protected tools: StructuredTool[] = [];
  protected initialized = false;
  protected tokenTracker: TokenUsageCallbackHandler | undefined;

  constructor(protected config: HederaAgentConfiguration) {
    this.logger = new Logger({
      module: 'BaseAgent',
      silent: config.debug?.silent || false,
    });
  }

  abstract boot(): Promise<void>;
  abstract chat(
    message: string,
    context?: ConversationContext
  ): Promise<ChatResponse>;
  abstract shutdown(): Promise<void>;
  abstract switchMode(mode: OperationalMode): void;
  abstract getUsageStats(): UsageStats;
  abstract getUsageLog(): UsageStats[];
  abstract clearUsageStats(): void;
  abstract connectMCPServers(): Promise<void>;
  abstract getMCPConnectionStatus(): Map<string, MCPConnectionStatus>;

  public getCore(): HederaAgentKit | undefined {
    return this.agentKit;
  }

  protected filterTools(tools: StructuredTool[]): StructuredTool[] {
    let filtered = [...tools];
    const filter = this.config.filtering;

    if (!filter) return filtered;

    if (filter.namespaceWhitelist?.length) {
      filtered = filtered.filter((tool) => {
        const namespace = (tool as StructuredTool & { namespace?: string })
          .namespace;
        return !namespace || filter.namespaceWhitelist!.includes(namespace);
      });
    }

    if (filter.toolBlacklist?.length) {
      filtered = filtered.filter(
        (tool) => !filter.toolBlacklist!.includes(tool.name)
      );
    }

    if (filter.toolPredicate) {
      filtered = filtered.filter(filter.toolPredicate);
    }

    this.logger.debug(`Filtered tools: ${tools.length} → ${filtered.length}`);
    return filtered;
  }

  protected buildSystemPrompt(): string {
    const parts: string[] = [];
    const operatorId = this.config.signer.getAccountId().toString();
    const userAccId = this.config.execution?.userAccountId;

    if (this.config.messaging?.systemPreamble) {
      parts.push(this.config.messaging.systemPreamble);
    }

    parts.push(
      `You are a helpful Hedera assistant. Your primary operator account is ${operatorId}. ` +
        `You have tools to interact with the Hedera Hashgraph. ` +
        `When using any tool, provide all necessary parameters as defined by that tool's schema and description.`
    );

    if (userAccId) {
      parts.push(
        `The user you are assisting has a personal Hedera account ID: ${userAccId}. ` +
          `IMPORTANT: When the user says things like "I want to send HBAR" or "transfer my tokens", you MUST use ${userAccId} as the sender/from account. ` +
          `For example, if user says "I want to send 2 HBAR to 0.0.800", you must set up a transfer where ${userAccId} sends the HBAR, not your operator account.`
      );
    }

    const operationalMode =
      this.config.execution?.operationalMode || 'returnBytes';
    if (operationalMode === 'autonomous') {
      parts.push(
        `\nOPERATIONAL MODE: 'autonomous'. Your goal is to execute transactions directly using your tools. ` +
          `Your account ${operatorId} will be the payer for these transactions. ` +
          `Even if the user's account (${
            userAccId || 'a specified account'
          }) is the actor in the transaction body (e.g., sender of HBAR), ` +
          `you (the agent with operator ${operatorId}) are still executing and paying. For HBAR transfers, ensure the amounts in the 'transfers' array sum to zero (as per tool schema), balancing with your operator account if necessary.`
      );
    } else {
      if (
        this.config.execution?.scheduleUserTransactionsInBytesMode &&
        userAccId
      ) {
        parts.push(
          `\nOPERATIONAL MODE: 'returnBytes' with scheduled transactions for user actions. ` +
            `When a user asks for a transaction to be prepared (e.g., creating a token, topic, transferring assets for them to sign, etc), ` +
            `you MUST default to creating a Scheduled Transaction using the appropriate tool with the metaOption 'schedule: true'. ` +
            `The user (with account ID ${userAccId}) will be the one to ultimately pay for and (if needed) sign the inner transaction. ` +
            `Your operator account (${operatorId}) will pay for creating the schedule entity itself. ` +
            `You MUST return the ScheduleId and details of the scheduled operation in a structured JSON format with these fields: success, op, schedule_id, description, payer_account_id_scheduled_tx, and scheduled_transaction_details.`
        );
      } else {
        parts.push(
          `\nOPERATIONAL MODE: 'returnBytes'. Your goal is to provide transaction bytes directly. ` +
            `When a user asks for a transaction to be prepared (e.g., for them to sign, or for scheduling without the default scheduling flow), ` +
            `you MUST call the appropriate tool. If you want raw bytes for the user to sign for their own account ${
              userAccId || 'if specified'
            }, ensure the tool constructs the transaction body accordingly and use metaOption 'returnBytes: true' if available, or ensure the builder is configured for the user.`
        );
      }
    }

    if (this.config.messaging?.conciseMode !== false) {
      parts.push(
        '\nAlways be concise. If the tool provides a JSON string as its primary output (especially in returnBytes mode), make your accompanying text brief. If the tool does not provide JSON output or an error occurs, your narrative becomes primary; if notes were generated by the tool in such cases, append them to your textual response.'
      );
    }

    if (this.config.messaging?.systemPostamble) {
      parts.push(this.config.messaging.systemPostamble);
    }

    return parts.join('\n');
  }

  isReady(): boolean {
    return this.initialized;
  }
}

export type { AIProvider, VercelAIProvider, BAMLProvider };
