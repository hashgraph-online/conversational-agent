import { StructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import { Logger } from '@hashgraphonline/standards-sdk';
import {
  FormValidatingToolWrapper,
  wrapToolWithFormValidation,
} from '../langchain/form-validating-tool-wrapper';
import { FormGenerator } from '../forms/form-generator';
import {
  fieldGuidanceRegistry,
} from '../forms/field-guidance-registry';
import type {
  ToolFieldConfiguration as FG_ToolFieldConfiguration,
  FieldGuidanceProvider as FG_FieldGuidanceProvider,
} from '../forms/field-guidance-registry';
import { isFormValidatable } from '@hashgraphonline/standards-agent-kit';

/**
 * Tool capabilities configuration for registry entries
 */
export interface ToolCapabilities {
  supportsFormValidation: boolean;
  requiresWrapper: boolean;
  priority: 'low' | 'medium' | 'high' | 'critical';
  category: 'core' | 'extension' | 'mcp';
}

/**
 * Entity resolution format preferences for tools
 */
export interface EntityResolutionPreferences {
  inscription?: 'hrl' | 'topicId' | 'metadata' | 'any';
  token?: 'tokenId' | 'address' | 'symbol' | 'any';
  nft?: 'serialNumber' | 'metadata' | 'hrl' | 'any';
  account?: 'accountId' | 'alias' | 'evmAddress' | 'any';
}

/**
 * Tool metadata for comprehensive tool information
 */
export interface ToolMetadata {
  name: string;
  version: string;
  category: ToolCapabilities['category'];
  description: string;
  capabilities: ToolCapabilities;
  dependencies: string[];
  schema: unknown;
  entityResolutionPreferences?: EntityResolutionPreferences;
  fieldGuidance?: FG_ToolFieldConfiguration;
  fieldGuidanceProvider?: FG_FieldGuidanceProvider;
}

/**
 * Registry entry containing tool instance and metadata
 */
export interface ToolRegistryEntry {
  tool: StructuredTool;
  metadata: ToolMetadata;
  wrapper?: FormValidatingToolWrapper<z.ZodObject<z.ZodRawShape>> | undefined;
  originalTool: StructuredTool;
  options?: {
    priority?: ToolCapabilities['priority'];
    capability?: string;
    enabled?: boolean;
    namespace?: string;
  };
}

/**
 * Options for tool registration
 */
export interface ToolRegistrationOptions {
  forceWrapper?: boolean;
  skipWrapper?: boolean;
  wrapperConfig?: {
    requireAllFields?: boolean;
    skipFields?: string[];
  };
  metadata?: Partial<ToolMetadata>;
}

/**
 * Query interface for finding tools
 */
export interface ToolQuery {
  name?: string;
  category?: ToolMetadata['category'];
  capabilities?: Partial<ToolCapabilities>;
}

/**
 * Centralized tool registry for managing tool lifecycle
 */
export class ToolRegistry {
  private tools = new Map<string, ToolRegistryEntry>();
  private formGenerator: FormGenerator;
  private logger: Logger;

  constructor(logger?: Logger) {
    this.formGenerator = new FormGenerator();
    this.logger = logger || new Logger({ module: 'ToolRegistry' });
  }

  /**
   * Register a tool with the registry
   */
  registerTool(
    tool: StructuredTool,
    options: ToolRegistrationOptions = {}
  ): void {
    const capabilities = this.analyzeToolCapabilities(tool);
    const metadata: ToolMetadata = {
      name: tool.name,
      version: '1.0.0',
      category: options.metadata?.category || 'core',
      description: tool.description,
      capabilities,
      dependencies: [],
      schema: tool.schema,
      ...options.metadata,
    };

    try {
      if (!metadata.entityResolutionPreferences) {
        const schemaRecord = tool.schema as unknown as Record<string, unknown>;
        const rawPrefs =
          schemaRecord &&
          typeof schemaRecord === 'object' &&
          (schemaRecord as Record<string, unknown>)[
            '_entityResolutionPreferences'
          ];
        if (rawPrefs && typeof rawPrefs === 'object') {
          metadata.entityResolutionPreferences = rawPrefs as unknown as EntityResolutionPreferences;
        }
      }
    } catch {
    }

    try {
      const schemaRecord = tool.schema as unknown as Record<string, unknown>;
      const schemaDef = (schemaRecord && (schemaRecord as Record<string, unknown>)._def) as
        | { typeName?: string; shape?: unknown }
        | undefined;
      if (schemaDef?.typeName === 'ZodObject') {
        const shape: Record<string, unknown> =
          typeof (schemaDef as { shape?: () => Record<string, unknown> }).shape === 'function'
            ? ((schemaDef as { shape: () => Record<string, unknown> }).shape?.() || {})
            : ((schemaDef as { shape?: Record<string, unknown> }).shape || {});

        const metadataField = shape['metadata'] as
          | { _def?: { typeName?: string; type?: { _def?: { typeName?: string } } } }
          | undefined;
        const isStringArray =
          !!metadataField &&
          metadataField._def?.typeName === 'ZodArray' &&
          metadataField._def?.type?._def?.typeName === 'ZodString';

        if (isStringArray && typeof tool.description === 'string') {
          if (!metadata.entityResolutionPreferences) {
            metadata.entityResolutionPreferences = {
              inscription: 'hrl',
            } as EntityResolutionPreferences;
          }
          const note =
            ' NOTE: When referencing inscriptions or media, provide canonical Hashlink Resource Locators (e.g., hcs://<standard>/<topicId>) rather than external URLs or embedded JSON.';
          if (!tool.description.includes('Hashlink Resource Locators')) {
            (tool as unknown as { description: string }).description = `${tool.description}${note}`;
          }
        }
      }
    } catch {}

    let finalTool: StructuredTool = tool;
    let wrapper:
      | FormValidatingToolWrapper<z.ZodObject<z.ZodRawShape>>
      | undefined;

    if (this.shouldWrapTool(tool, capabilities, options)) {
      wrapper = wrapToolWithFormValidation(
        tool as StructuredTool<z.ZodObject<z.ZodRawShape>>,
        this.formGenerator,
        {
          requireAllFields: false,
          skipFields: ['metaOptions'],
          ...options.wrapperConfig,
        }
      ) as FormValidatingToolWrapper<z.ZodObject<z.ZodRawShape>>;
      finalTool = wrapper as StructuredTool;
    }

    try {
      if (metadata.entityResolutionPreferences) {
        (finalTool as unknown as Record<string, unknown>)[
          'entityResolutionPreferences'
        ] = metadata.entityResolutionPreferences;
      }
    } catch {
    }

    const entry: ToolRegistryEntry = {
      tool: finalTool,
      metadata,
      wrapper,
      originalTool: tool,
      options: {
        priority: capabilities.priority,
        capability: 'basic', // Default capability
        enabled: true, // All tools are enabled by default
        namespace: metadata.category,
      },
    };

    this.tools.set(tool.name, entry);

    try {
      const metaFG = metadata.fieldGuidance as FG_ToolFieldConfiguration | undefined;
      if (metaFG) {
        fieldGuidanceRegistry.registerToolConfiguration(metaFG);
      }
      const provider = metadata.fieldGuidanceProvider as FG_FieldGuidanceProvider | undefined;
      if (provider) {
        const pattern = metaFG?.toolPattern ?? tool.name;
        fieldGuidanceRegistry.registerToolProvider(pattern, provider, {
          id: `${tool.name}:field-guidance-provider`,
          priority: 0,
        });
      }
    } catch {}
  }

  /**
   * Get a tool by name
   */
  getTool(name: string): ToolRegistryEntry | null {
    return this.tools.get(name) || null;
  }

  /**
   * Get tools by capability
   */
  getToolsByCapability(
    capability: keyof ToolCapabilities,
    value?: unknown
  ): ToolRegistryEntry[] {
    const results: ToolRegistryEntry[] = [];

    for (const entry of this.tools.values()) {
      if (value !== undefined) {
        if (entry.metadata.capabilities[capability] === value) {
          results.push(entry);
        }
      } else if (entry.metadata.capabilities[capability]) {
        results.push(entry);
      }
    }

    return results;
  }

  /**
   * Get tools by query
   */
  getToolsByQuery(query: ToolQuery): ToolRegistryEntry[] {
    const results: ToolRegistryEntry[] = [];

    for (const entry of this.tools.values()) {
      let matches = true;

      if (query.name && entry.metadata.name !== query.name) {
        matches = false;
      }

      if (query.category && entry.metadata.category !== query.category) {
        matches = false;
      }

      if (query.capabilities) {
        for (const [key, value] of Object.entries(query.capabilities)) {
          if (
            entry.metadata.capabilities[key as keyof ToolCapabilities] !== value
          ) {
            matches = false;
            break;
          }
        }
      }

      if (matches) {
        results.push(entry);
      }
    }

    return results;
  }

  /**
   * Get all registered tools
   */
  getAllTools(): StructuredTool[] {
    return Array.from(this.tools.values()).map((entry) => entry.tool);
  }

  /**
   * Get all registry entries
   */
  getAllRegistryEntries(): ToolRegistryEntry[] {
    return Array.from(this.tools.values());
  }

  /**
   * Get all tool names
   */
  getToolNames(): string[] {
    return Array.from(this.tools.keys());
  }

  /**
   * Get tools by priority
   */
  getToolsByPriority(priority: ToolCapabilities['priority']): ToolRegistryEntry[] {
    return this.getToolsByCapability('priority', priority);
  }

  /**
   * Get enabled tools (all tools are considered enabled by default)
   */
  getEnabledTools(): ToolRegistryEntry[] {
    return this.getAllRegistryEntries();
  }

  /**
   * Get tools by namespace/category
   */
  getToolsByNamespace(namespace?: string): ToolRegistryEntry[] {
    if (!namespace) {
      return this.getAllRegistryEntries();
    }
    return this.getToolsByQuery({ category: namespace as ToolMetadata['category'] });
  }

  /**
   * Check if registry has capability
   */
  hasCapability(capability: keyof ToolCapabilities): boolean {
    for (const entry of this.tools.values()) {
      if (entry.metadata.capabilities[capability]) {
        return true;
      }
    }
    return false;
  }

  /**
   * Update tool options (metadata)
   */
  updateToolOptions(name: string, options: Partial<ToolMetadata>): boolean {
    const entry = this.tools.get(name);
    if (!entry) {
      return false;
    }

    entry.metadata = { ...entry.metadata, ...options };
    return true;
  }

  /**
   * Check if a tool is registered
   */
  hasTool(name: string): boolean {
    return this.tools.has(name);
  }

  /**
   * Unregister a tool
   */
  unregisterTool(name: string): boolean {
    return this.tools.delete(name);
  }

  /**
   * Clear all tools
   */
  clear(): void {
    this.tools.clear();
  }

  /**
   * Analyze tool capabilities
   */
  private analyzeToolCapabilities(tool: StructuredTool): ToolCapabilities {
    const implementsFormValidatable = isFormValidatable(tool);
    const hasRenderConfig = this.hasRenderConfig(tool);
    const isZodObjectLike = this.isZodObjectLike(tool.schema);

    const supportsFormValidation = implementsFormValidatable || hasRenderConfig;
    const requiresWrapper = supportsFormValidation && isZodObjectLike;

    let priority: ToolCapabilities['priority'] = 'medium';
    let category: ToolCapabilities['category'] = 'core';

    if (supportsFormValidation && requiresWrapper) {
      priority = 'critical';
    } else if (supportsFormValidation) {
      priority = 'high';
    } else if (
      tool.description?.toLowerCase().includes('query') ||
      tool.description?.toLowerCase().includes('search')
    ) {
      priority = 'low';
    }

    const toolAsAny = tool as unknown as Record<string, unknown>;
    if (tool.constructor.name.includes('MCP') || toolAsAny.isMCPTool) {
      category = 'mcp';
    } else if (
      toolAsAny.isExtension ||
      tool.constructor.name.includes('Extension')
    ) {
      category = 'extension';
    }

    return {
      supportsFormValidation,
      requiresWrapper,
      priority,
      category,
    };
  }

  /**
   * Check if tool has render configuration
   */
  private hasRenderConfig(tool: StructuredTool): boolean {
    const schema = tool.schema as Record<string, unknown>;
    return !!(schema && schema._renderConfig);
  }

  /**
   * Determine if tool should be wrapped
   */
  private shouldWrapTool(
    tool: StructuredTool,
    capabilities: ToolCapabilities,
    options: ToolRegistrationOptions
  ): boolean {
    if (options.skipWrapper) {
      return false;
    }

    if (options.forceWrapper) {
      return true;
    }

    return capabilities.requiresWrapper;
  }

  /**
   * Check if schema is ZodObject-like
   */
  private isZodObjectLike(schema: unknown): boolean {
    if (!schema || typeof schema !== 'object') {
      return false;
    }

    const schemaRecord = schema as Record<string, unknown>;
    const schemaDef = schemaRecord._def as Record<string, unknown> | undefined;

    return (
      schema instanceof z.ZodObject ||
      schemaDef?.typeName === 'ZodObject' ||
      ('shape' in schemaRecord && typeof schemaRecord.shape === 'object')
    );
  }

  /**
   * Get statistics about the registry
   */
  getStatistics(): {
    totalTools: number;
    wrappedTools: number;
    unwrappedTools: number;
    categoryCounts: Record<ToolCapabilities['category'], number>;
    priorityCounts: Record<ToolCapabilities['priority'], number>;
  } {
    const stats = {
      totalTools: this.tools.size,
      wrappedTools: 0,
      unwrappedTools: 0,
      categoryCounts: { core: 0, extension: 0, mcp: 0 } as Record<
        ToolCapabilities['category'],
        number
      >,
      priorityCounts: { low: 0, medium: 0, high: 0, critical: 0 } as Record<
        ToolCapabilities['priority'],
        number
      >,
    };

    for (const entry of this.tools.values()) {
      if (entry.wrapper) {
        stats.wrappedTools++;
      } else {
        stats.unwrappedTools++;
      }

      stats.categoryCounts[entry.metadata.category]++;
      stats.priorityCounts[entry.metadata.capabilities.priority]++;
    }

    return stats;
  }
}
