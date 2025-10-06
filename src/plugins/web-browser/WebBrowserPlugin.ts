import {
  BasePlugin,
  type GenericPluginContext,
  BaseHederaQueryTool,
  type HederaAgentKit,
  type HederaTool,
} from 'hedera-agent-kit';
import { z } from 'zod';

const PageSnapshotSchema = z.object({
  url: z.string().url(),
  maxCharacters: z
    .number()
    .int()
    .min(256, 'Minimum length is 256 characters')
    .max(8000, 'Maximum length is 8000 characters')
    .optional()
    .default(3000),
});

class WebPageSnapshotTool extends BaseHederaQueryTool<typeof PageSnapshotSchema> {
  name = 'web_page_snapshot';
  description = 'Fetches the visible text content of a web page for analysis.';
  namespace = 'browser';
  specificInputSchema = PageSnapshotSchema;

  constructor(params: {
    hederaKit: HederaAgentKit;
    logger?: GenericPluginContext['logger'];
    fetchImpl?: typeof fetch;
  }) {
    const { fetchImpl, ...rest } = params;
    super(rest);
    this.fetchImpl = fetchImpl ?? fetch;
  }

  private readonly fetchImpl: typeof fetch;

  protected async executeQuery(
    input: z.infer<typeof PageSnapshotSchema>
  ): Promise<string> {
    const maxChars = input.maxCharacters ?? 3000;

    try {
      const response = await this.fetchImpl(input.url, {
        redirect: 'follow',
      });

      if (!response.ok) {
        return `Failed to load ${input.url}: HTTP ${response.status}`;
      }

      const html = await response.text();
      const text = this.normalizeHtml(html);

      if (!text) {
        return 'The fetched page did not contain readable text.';
      }

      return text.length > maxChars ? `${text.slice(0, maxChars)}…` : text;
    } catch (error) {
      this.logger.error('WebPageSnapshotTool failed', error);
      return `Failed to fetch content for ${input.url}: ${
        error instanceof Error ? error.message : String(error)
      }`;
    }
  }

  private normalizeHtml(html: string): string {
    const withoutScripts = html
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<!--([\s\S]*?)-->/g, ' ');

    const stripped = withoutScripts.replace(/<[^>]+>/g, ' ');
    const decoded = stripped
      .replace(/&nbsp;/gi, ' ')
      .replace(/&amp;/gi, '&')
      .replace(/&lt;/gi, '<')
      .replace(/&gt;/gi, '>')
      .replace(/&quot;/gi, '"')
      .replace(/&#39;/gi, "'");

    return decoded.replace(/\s+/g, ' ').trim();
  }
}

export class WebBrowserPlugin extends BasePlugin<GenericPluginContext> {
  id = 'web-browser';
  name = 'Web Browser Plugin';
  description =
    'Provides tools for fetching live web page content to enrich assistant understanding.';
  version = '0.1.0';
  author = 'Hashgraph Online';
  namespace = 'browser';

  private tools: HederaTool[] = [];

  override async initialize(context: GenericPluginContext): Promise<void> {
    await super.initialize(context);

    const hederaKit = context.config.hederaKit as HederaAgentKit | undefined;

    if (!hederaKit) {
      this.context.logger.warn(
        'WebBrowserPlugin skipped because HederaAgentKit was not present in plugin context.'
      );
      this.tools = [];
      return;
    }

    const tool = new WebPageSnapshotTool({
      hederaKit,
      logger: this.context.logger,
    });

    this.tools = [tool];
    this.context.logger.info('Web Browser Plugin initialized with snapshot tool');
  }

  override getTools(): HederaTool[] {
    return this.tools;
  }

  override async cleanup(): Promise<void> {
    this.tools = [];
  }
}
