import {
  GenericPluginContext,
  HederaTool,
  BasePlugin,
  HederaAgentKit,
} from 'hedera-agent-kit';
import { TransferHbarTool } from './TransferHbarTool';
import { AirdropToolWrapper } from '../../utils/AirdropToolWrapper';

export class HbarPlugin extends BasePlugin {
  id = 'hbar';
  name = 'HBAR Plugin';
  description =
    'HBAR operations: transfer tool with robust decimal handling and compatibility with airdrop improvements';
  version = '1.0.0';
  author = 'Hashgraph Online';
  namespace = 'account';

  private tools: HederaTool[] = [];

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

    const originalAirdropTool = hederaKit
      .getAggregatedLangChainTools()
      .find((tool) => tool.name === 'hedera-hts-airdrop-token');
    if (!originalAirdropTool) {
      throw new Error('Airdrop tool not found in HederaKit');
    }

    const airdropWrapped = new AirdropToolWrapper(
      originalAirdropTool,
      hederaKit
    ) as unknown as HederaTool;

    this.tools = [transfer, airdropWrapped];
  }

  override getTools(): HederaTool[] {
    return this.tools;
  }

  async shutdown(): Promise<void> {
    this.tools = [];
  }
}
