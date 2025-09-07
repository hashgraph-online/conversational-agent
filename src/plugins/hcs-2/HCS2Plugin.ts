import {
  GenericPluginContext,
  HederaTool,
  BasePlugin,
  HederaAgentKit,
} from 'hedera-agent-kit';
import {
  HCS2Builder,
  CreateRegistryTool,
  RegisterEntryTool,
  UpdateEntryTool,
  DeleteEntryTool,
  MigrateRegistryTool,
  QueryRegistryTool,
} from '@hashgraphonline/standards-agent-kit';

/**
 * Plugin providing HCS-2 registry management tools
 */
export class HCS2Plugin extends BasePlugin {
  id = 'hcs-2';
  name = 'HCS-2 Plugin';
  description =
    'HCS-2 registry management tools for decentralized registries on Hedera';
  version = '1.0.0';
  author = 'Hashgraph Online';
  namespace = 'hcs2';

  private tools: any[] = [];

  override async initialize(context: GenericPluginContext): Promise<void> {
    await super.initialize(context);

    const hederaKit = context.config.hederaKit as HederaAgentKit;
    if (!hederaKit) {
      this.context.logger.warn(
        'HederaKit not found in context. HCS-2 tools will not be available.'
      );
      return;
    }

    try {
      this.initializeTools();

      this.context.logger.info(
        'HCS-2 Plugin initialized successfully'
      );
    } catch (error) {
      this.context.logger.error(
        'Failed to initialize HCS-2 plugin:',
        error
      );
    }
  }

  private initializeTools(): void {
    const hederaKit = this.context.config.hederaKit as HederaAgentKit;
    if (!hederaKit) {
      throw new Error('HederaKit not found in context config');
    }

    const hcs2Builder = new HCS2Builder(hederaKit);

    this.tools = [
      new CreateRegistryTool({
        hederaKit: hederaKit,
        hcs2Builder: hcs2Builder,
        logger: this.context.logger,
      }),
      new RegisterEntryTool({
        hederaKit: hederaKit,
        hcs2Builder: hcs2Builder,
        logger: this.context.logger,
      }),
      new UpdateEntryTool({
        hederaKit: hederaKit,
        hcs2Builder: hcs2Builder,
        logger: this.context.logger,
      }),
      new DeleteEntryTool({
        hederaKit: hederaKit,
        hcs2Builder: hcs2Builder,
        logger: this.context.logger,
      }),
      new MigrateRegistryTool({
        hederaKit: hederaKit,
        hcs2Builder: hcs2Builder,
        logger: this.context.logger,
      }),
      new QueryRegistryTool({
        hederaKit: hederaKit,
        hcs2Builder: hcs2Builder,
        logger: this.context.logger,
      }),
    ];
  }

  getTools(): HederaTool[] {
    return this.tools;
  }

  override async cleanup(): Promise<void> {
    this.tools = [];
    if (this.context?.logger) {
      this.context.logger.info('HCS-2 Plugin cleaned up');
    }
  }
}
