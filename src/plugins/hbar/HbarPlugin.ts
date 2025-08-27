import {
  GenericPluginContext,
  HederaTool,
  BasePlugin,
  HederaAgentKit,
  HederaAirdropTokenTool,
} from 'hedera-agent-kit';
import { TransferHbarTool } from './TransferHbarTool';
import { AirdropToolWrapper } from './AirdropToolWrapper';
import { StructuredTool } from '@langchain/core/tools';

export class HbarPlugin extends BasePlugin {
  id = 'hbar';
  name = 'HBAR Plugin';
  description =
    'HBAR operations: transfer tool with robust decimal handling and compatibility with airdrop improvements';
  version = '1.0.0';
  author = 'Hashgraph Online';
  namespace = 'account';

  private tools: (HederaTool | AirdropToolWrapper)[] = [];
  private originalAirdropTool: StructuredTool | null = null;

  override async initialize(context: GenericPluginContext): Promise<void> {
    await super.initialize(context);

    const hederaKit = context.config.hederaKit as HederaAgentKit;
    if (!hederaKit) {
      this.context.logger.warn(
        'HederaKit not found in context. HBAR tools will not be available.'
      );
      return;
    }

    try {
      this.initializeTools();

      this.context.logger.info('HBAR Plugin initialized successfully');
    } catch (error) {
      this.context.logger.error('Failed to initialize HBAR plugin:', error);
    }
  }

  private initializeTools(): void {
    const hederaKit = this.context.config.hederaKit as HederaAgentKit;
    if (!hederaKit) {
      throw new Error('HederaKit not found in context config');
    }

    const transfer = new TransferHbarTool({
      hederaKit: hederaKit,
      logger: this.context.logger,
    });

    this.tools = [transfer];

    try {
      this.context.logger.info(
        'Creating wrapper for passed original airdrop tool'
      );

      const airdropTool = new HederaAirdropTokenTool({
        hederaKit: hederaKit,
        logger: this.context.logger,
      });
      const wrappedAirdropTool = new AirdropToolWrapper(airdropTool, hederaKit);
      this.tools.push(wrappedAirdropTool);
      this.context.logger.info('Added wrapped airdrop tool to HBAR Plugin');
    } catch (error) {
      this.context.logger.error('Error creating airdrop tool wrapper:', error);
    }

    this.context.logger.info(
      `HBAR Plugin tools initialized with ${this.tools.length} tools`
    );
  }

  override getTools(): HederaTool[] {
    return this.tools as unknown as HederaTool[];
  }

  async shutdown(): Promise<void> {
    this.tools = [];
  }
}
