import {
  GenericPluginContext,
  HederaTool,
  BasePlugin,
  HederaAgentKit,
} from 'hedera-agent-kit';
import { TransferHbarTool } from './TransferHbarTool';

export class HbarTransferPlugin extends BasePlugin {
  id = 'hbar-transfer';
  name = 'HBAR Transfer Plugin';
  description =
    'HBAR transfer tool with proper decimal handling for multi-signature transactions';
  version = '1.0.0';
  author = 'Hashgraph Online';
  namespace = 'account';

  private tools: HederaTool[] = [];

  override async initialize(context: GenericPluginContext): Promise<void> {
    await super.initialize(context);

    const hederaKit = context.config.hederaKit as HederaAgentKit;
    if (!hederaKit) {
      this.context.logger.warn(
        'HederaKit not found in context. HBAR transfer tools will not be available.'
      );
      return;
    }

    try {
      this.initializeTools();

      this.context.logger.info(
        'HBAR Transfer Plugin initialized successfully'
      );
    } catch (error) {
      this.context.logger.error(
        'Failed to initialize HBAR Transfer plugin:',
        error
      );
    }
  }

  private initializeTools(): void {
    const hederaKit = this.context.config.hederaKit as HederaAgentKit;
    if (!hederaKit) {
      throw new Error('HederaKit not found in context config');
    }

    this.tools = [
      new TransferHbarTool({
        hederaKit: hederaKit,
        logger: this.context.logger,
      }),
    ];
  }

  override getTools(): HederaTool[] {
    return this.tools;
  }

  async shutdown(): Promise<void> {
    this.tools = [];
  }
}