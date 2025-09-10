import {
  GenericPluginContext,
  HederaTool,
  BasePlugin,
  HederaAgentKit,
} from 'hedera-agent-kit';
import {
  InscriberBuilder,
  InscribeFromUrlTool,
  InscribeFromFileTool,
  InscribeFromBufferTool,
  InscribeHashinalTool,
  RetrieveInscriptionTool,
} from '@hashgraphonline/standards-agent-kit';
import { fieldGuidanceRegistry, type FieldGuidance } from '../../forms/field-guidance-registry';

/**
 * Plugin providing content inscription tools for Hedera
 */
export class InscribePlugin extends BasePlugin {
  id = 'inscribe';
  name = 'Inscribe Plugin';
  description =
    'Content inscription tools for storing data on Hedera Consensus Service';
  version = '1.0.0';
  author = 'Hashgraph Online';
  namespace = 'inscribe';

  private tools: any[] = [];
  private providerId: string | null = null;

  override async initialize(context: GenericPluginContext): Promise<void> {
    await super.initialize(context);

    const hederaKit = context.config.hederaKit as HederaAgentKit;
    if (!hederaKit) {
      this.context.logger.warn(
        'HederaKit not found in context. Inscription tools will not be available.'
      );
      return;
    }

    try {
      this.initializeTools();

      try {
        const provider = {
          getFieldGuidance: (fieldName: string): FieldGuidance | null => {
            if (fieldName === 'name') {
              return {
                suggestions: [
                  'Sunset Landscape #42',
                  'Digital Abstract Art',
                ],
                contextualHelpText:
                  'Create a distinctive name that collectors will find appealing',
              };
            }
            if (fieldName === 'description') {
              return {
                fieldTypeOverride: 'textarea',
                suggestions: ['A beautiful piece representing...'],
              };
            }
            return null;
          },
          getGlobalGuidance: () => ({
            qualityStandards: [
              'Use meaningful names that describe the artwork or content',
            ],
          }),
        };
        this.providerId = fieldGuidanceRegistry.registerToolProvider(
          /hashinal/i,
          provider,
          { id: 'inscribe:hashinal:provider', priority: 1 }
        );
      } catch (e) {
        this.context.logger.warn('Could not register Inscribe field guidance provider');
      }

      this.context.logger.info(
        'Inscribe Plugin initialized successfully'
      );
    } catch (error) {
      this.context.logger.error(
        'Failed to initialize Inscribe plugin:',
        error
      );
    }
  }

  private initializeTools(): void {
    const hederaKit = this.context.config.hederaKit as HederaAgentKit;
    if (!hederaKit) {
      throw new Error('HederaKit not found in context config');
    }

    const inscriberBuilder = new InscriberBuilder(hederaKit);

    this.tools = [
      new InscribeFromUrlTool({
        hederaKit: hederaKit,
        inscriberBuilder: inscriberBuilder,
        logger: this.context.logger,
      }),
      new InscribeFromFileTool({
        hederaKit: hederaKit,
        inscriberBuilder: inscriberBuilder,
        logger: this.context.logger,
      }),
      new InscribeFromBufferTool({
        hederaKit: hederaKit,
        inscriberBuilder: inscriberBuilder,
        logger: this.context.logger,
      }),
      new InscribeHashinalTool({
        hederaKit: hederaKit,
        inscriberBuilder: inscriberBuilder,
        logger: this.context.logger,
      }),
      new RetrieveInscriptionTool({
        hederaKit: hederaKit,
        inscriberBuilder: inscriberBuilder,
        logger: this.context.logger,
      }),
    ];
  }

  getTools(): HederaTool[] {
    return this.tools;
  }

  override async cleanup(): Promise<void> {
    this.tools = [];
    if (this.providerId) {
      try {
        fieldGuidanceRegistry.unregisterProvider(this.providerId);
      } catch {}
      this.providerId = null;
    }
    if (this.context?.logger) {
      this.context.logger.info('Inscribe Plugin cleaned up');
    }
  }
}
