import {
  GenericPluginContext,
  HederaTool,
  BasePlugin,
  HederaAgentKit,
} from 'hedera-agent-kit';
import {
  IStateManager,
  OpenConvaiState,
  HCS10Builder,
  RegisterAgentTool,
  FindRegistrationsTool,
  InitiateConnectionTool,
  ListConnectionsTool,
  SendMessageToConnectionTool,
  CheckMessagesTool,
  ConnectionMonitorTool,
  ManageConnectionRequestsTool,
  AcceptConnectionRequestTool,
  RetrieveProfileTool,
  ListUnapprovedConnectionRequestsTool,
} from '@hashgraphonline/standards-agent-kit';
import { HCS10Client } from '@hashgraphonline/standards-sdk';

interface HCS10ClientManager {
  initializeConnectionsManager(client: HCS10Client): void;
}

/**
 * Extracts private key string from operator key
 */
function extractPrivateKey(opKey: unknown): string {
  const key = opKey as {
    toString?: () => string;
    toStringRaw?: () => string;
  };
  
  if (typeof key?.toStringRaw === 'function') {
    return key.toStringRaw();
  }
  
  if (typeof key?.toString === 'function') {
    return key.toString();
  }
  
  return String(key);
}

function hasInitializeConnectionsManager(
  stateManager: IStateManager
): stateManager is IStateManager & HCS10ClientManager {
  return (
    typeof stateManager === 'object' &&
    stateManager !== null &&
    'initializeConnectionsManager' in stateManager &&
    typeof stateManager.initializeConnectionsManager === 'function'
  );
}

export class HCS10Plugin extends BasePlugin {
  id = 'hcs-10';
  name = 'HCS-10 Plugin';
  description =
    'HCS-10 agent tools for decentralized agent registration, connections, and messaging on Hedera';
  version = '1.0.0';
  author = 'Hashgraph Online';
  namespace = 'hcs10';

  private stateManager?: IStateManager;
  private tools: any[] = [];
  appConfig?: Record<string, unknown>;

  override async initialize(context: GenericPluginContext): Promise<void> {
    await super.initialize(context);

    const hederaKit = context.config.hederaKit as HederaAgentKit;
    if (!hederaKit) {
      this.context.logger.warn(
        'HederaKit not found in context. HCS-10 tools will not be available.'
      );
      return;
    }

    try {
      this.stateManager =
        (context.stateManager as IStateManager) ||
        (context.config.stateManager as IStateManager) ||
        (this.appConfig?.stateManager as IStateManager) ||
        new OpenConvaiState();

      const accountId = hederaKit.signer.getAccountId().toString();
      const isBytesMode = String(hederaKit.operationalMode || 'returnBytes') === 'returnBytes';
      let inboundTopicId = '';
      let outboundTopicId = '';

      if (!isBytesMode) {
        try {
          const opKey = hederaKit.signer.getOperatorPrivateKey();
          const privateKey = extractPrivateKey(opKey);

          const hcs10Client = new HCS10Client({
            network: hederaKit.network as 'mainnet' | 'testnet',
            operatorId: accountId,
            operatorPrivateKey: privateKey,
            logLevel: 'error',
          });

          const profileResponse = await hcs10Client.retrieveProfile(accountId);
          if (profileResponse.success && profileResponse.topicInfo) {
            inboundTopicId = profileResponse.topicInfo.inboundTopic;
            outboundTopicId = profileResponse.topicInfo.outboundTopic;
          }
        } catch (profileError) {
          this.context.logger.warn('Skipping profile topic discovery', profileError);
        }
      }

      const agentRecord: Record<string, unknown> = {
        name: `Agent ${accountId}`,
        accountId: accountId,
        inboundTopicId,
        outboundTopicId,
      };
      if (!isBytesMode) {
        try {
          const opKey = hederaKit.signer.getOperatorPrivateKey();
          agentRecord.privateKey = extractPrivateKey(opKey);
        } catch {}
      }
      this.stateManager.setCurrentAgent(agentRecord as any);

      this.context.logger.info(
        `Set current agent: ${accountId} with topics ${inboundTopicId}/${outboundTopicId}`
      );

      if (!isBytesMode && this.stateManager && !this.stateManager.getConnectionsManager()) {
        try {
          const opKey = hederaKit.signer.getOperatorPrivateKey();
          const privateKey = extractPrivateKey(opKey);
          const hcs10Client = new HCS10Client({
            network: hederaKit.network as 'mainnet' | 'testnet',
            operatorId: accountId,
            operatorPrivateKey: privateKey,
            logLevel: 'error',
          });

          if (hasInitializeConnectionsManager(this.stateManager)) {
            this.stateManager.initializeConnectionsManager(hcs10Client);
          } else {
            this.context.logger.warn('StateManager does not support connection manager initialization');
          }
          this.context.logger.info(
            'ConnectionsManager initialized in HCS10Plugin'
          );
        } catch (cmError) {
          this.context.logger.warn('Could not initialize ConnectionsManager:', cmError);
        }
      }

      this.initializeTools();
      this.context.logger.info('HCS-10 Plugin initialized successfully');
    } catch (error) {
      this.context.logger.error('Failed to initialize HCS-10 plugin:', error);
    }
  }

  private initializeTools(): void {
    if (!this.stateManager) {
      throw new Error('StateManager must be initialized before creating tools');
    }

    const hederaKit = this.context.config.hederaKit as HederaAgentKit;
    if (!hederaKit) {
      throw new Error('HederaKit not found in context config');
    }

    const hcs10Builder = new HCS10Builder(hederaKit, this.stateManager);

    this.tools = [
      new RegisterAgentTool({
        hederaKit: hederaKit,
        hcs10Builder: hcs10Builder,
        logger: this.context.logger,
      }),
      new FindRegistrationsTool({
        hederaKit: hederaKit,
        hcs10Builder: hcs10Builder,
        logger: this.context.logger,
      }),
      new RetrieveProfileTool({
        hederaKit: hederaKit,
        hcs10Builder: hcs10Builder,
        logger: this.context.logger,
      }),
      new InitiateConnectionTool({
        hederaKit: hederaKit,
        hcs10Builder: hcs10Builder,
        logger: this.context.logger,
      }),
      new ListConnectionsTool({
        hederaKit: hederaKit,
        hcs10Builder: hcs10Builder,
        logger: this.context.logger,
      }),
      new SendMessageToConnectionTool({
        hederaKit: hederaKit,
        hcs10Builder: hcs10Builder,
        logger: this.context.logger,
      }),
      new CheckMessagesTool({
        hederaKit: hederaKit,
        hcs10Builder: hcs10Builder,
        logger: this.context.logger,
      }),
      new ConnectionMonitorTool({
        hederaKit: hederaKit,
        hcs10Builder: hcs10Builder,
        logger: this.context.logger,
      }),
      new ManageConnectionRequestsTool({
        hederaKit: hederaKit,
        hcs10Builder: hcs10Builder,
        logger: this.context.logger,
      }),
      new AcceptConnectionRequestTool({
        hederaKit: hederaKit,
        hcs10Builder: hcs10Builder,
        logger: this.context.logger,
      }),
      new ListUnapprovedConnectionRequestsTool({
        hederaKit: hederaKit,
        hcs10Builder: hcs10Builder,
        logger: this.context.logger,
      }),
    ];
  }

  getTools(): HederaTool[] {
    return this.tools;
  }

  getStateManager(): IStateManager | undefined {
    return this.stateManager;
  }

  override async cleanup(): Promise<void> {
    this.tools = [];
    delete this.stateManager;
    if (this.context?.logger) {
      this.context.logger.info('HCS-10 Plugin cleaned up');
    }
  }
}
