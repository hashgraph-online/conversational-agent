import type { FormFieldType, FieldOption } from './types';
import { Logger } from '@hashgraphonline/standards-sdk';

/**
 * Field guidance configuration for providing contextual help and suggestions
 */
export interface FieldGuidance {
  /**
   * Suggestions to show as placeholder or examples
   */
  suggestions?: string[];

  /**
   * Predefined options for select fields
   */
  predefinedOptions?: FieldOption[];

  /**
   * Warning messages for specific patterns to avoid
   */
  warnings?: {
    pattern: RegExp;
    message: string;
  }[];

  /**
   * Validation rules specific to the field context
   */
  validationRules?: {
    /**
     * Patterns that should be rejected
     */
    rejectPatterns?: {
      pattern: RegExp;
      reason: string;
    }[];

    /**
     * Minimum quality requirements
     */
    qualityChecks?: {
      minNonTechnicalWords?: number;
      requireSpecificTerms?: string[];
      forbidTechnicalTerms?: string[];
    };
  };

  /**
   * Field type override for specific contexts
   */
  fieldTypeOverride?: FormFieldType;

  /**
   * Help text specific to the tool context
   */
  contextualHelpText?: string;
}

/**
 * Tool-specific field configurations
 */
export interface ToolFieldConfiguration {
  /**
   * Tool name or pattern to match
   */
  toolPattern: string | RegExp;

  /**
   * Field-specific guidance
   */
  fields: Record<string, FieldGuidance>;

  /**
   * Global guidance for all fields in this tool
   */
  globalGuidance?: {
    /**
     * General warnings to show
     */
    warnings?: string[];

    /**
     * Quality standards for this tool
     */
    qualityStandards?: string[];
  };
}

/**
 * Registry for field guidance configurations
 */
class FieldGuidanceRegistry {
  private configurations: ToolFieldConfiguration[] = [];
  private providers: Array<{
    id: string;
    priority: number;
    pattern: string | RegExp;
    provider: FieldGuidanceProvider;
    order: number;
  }> = [];
  private registerOrderCounter = 0;
  private logger: Logger;

  constructor() {
    this.logger = new Logger({ module: 'FieldGuidanceRegistry' });
  }

  /**
   * Register field guidance for a specific tool
   */
  registerToolConfiguration(config: ToolFieldConfiguration): void {
    this.configurations.push(config);
  }

  /**
   * Register a provider for dynamic field/global guidance
   */
  registerToolProvider(
    toolPattern: string | RegExp,
    provider: FieldGuidanceProvider,
    options?: { id?: string; priority?: number }
  ): string {
    const id = options?.id ?? `provider-${this.providers.length + 1}`;
    const priority = options?.priority ?? 0;
    if (this.providers.some((p) => p.id === id)) {
      this.logger.error('Duplicate provider id', { id });
      throw new Error('DUPLICATE_PROVIDER_ID');
    }
    this.providers.push({
      id,
      priority,
      pattern: toolPattern,
      provider,
      order: this.registerOrderCounter++,
    });
    return id;
  }

  /** Unregister a provider by id */
  unregisterProvider(id: string): void {
    this.providers = this.providers.filter((p) => p.id !== id);
  }

  /** List registered providers */
  listProviders(): Array<{
    id: string;
    priority: number;
    pattern: string | RegExp;
  }> {
    return this.providers.map(({ id, priority, pattern }) => ({
      id,
      priority,
      pattern,
    }));
  }

  /**
   * Get field guidance for a specific tool and field
   */
  getFieldGuidance(toolName: string, fieldName: string): FieldGuidance | null {
    if (process.env.CA_FORM_GUIDANCE_ENABLED === 'false') {
      return null;
    }
    for (const config of this.configurations) {
      const matches =
        typeof config.toolPattern === 'string'
          ? toolName.toLowerCase().includes(config.toolPattern.toLowerCase())
          : config.toolPattern.test(toolName);

      if (matches && config.fields[fieldName]) {
        const staticGuidance = config.fields[fieldName];
        const providers = this.pickMatchingProviders(toolName);
        if (providers.length === 0) return staticGuidance;
        let merged: FieldGuidance = { ...staticGuidance };
        for (const p of [...providers].reverse()) {
          const fromProvider = this.safeGetFieldGuidance(
            p,
            fieldName,
            toolName
          );
          if (fromProvider) {
            merged = this.mergeGuidance(merged, fromProvider);
          }
        }
        return merged;
      }
    }
    const providers = this.pickMatchingProviders(toolName);
    if (providers.length > 0) {
      let merged: FieldGuidance = {};
      for (const p of [...providers].reverse()) {
        const g = this.safeGetFieldGuidance(p, fieldName, toolName);
        if (g) merged = this.mergeGuidance(merged, g);
      }
      return Object.keys(merged).length > 0 ? merged : null;
    }
    return null;
  }

  /**
   * Get global guidance for a tool
   */
  getGlobalGuidance(
    toolName: string
  ): ToolFieldConfiguration['globalGuidance'] | null {
    if (process.env.CA_FORM_GUIDANCE_ENABLED === 'false') {
      return null;
    }
    for (const config of this.configurations) {
      const matches =
        typeof config.toolPattern === 'string'
          ? toolName.toLowerCase().includes(config.toolPattern.toLowerCase())
          : config.toolPattern.test(toolName);

      if (matches && config.globalGuidance) {
        const base = config.globalGuidance;
        const providers = this.pickMatchingProviders(toolName);
        if (providers.length === 0) return base;
        let mergedWarnings: string[] | undefined = base.warnings;
        let mergedQuality: string[] | undefined = base.qualityStandards;
        for (const p of [...providers].reverse()) {
          const fromProvider = this.safeGetGlobalGuidance(p, toolName);
          if (fromProvider) {
            mergedWarnings = fromProvider.warnings ?? mergedWarnings;
            mergedQuality = fromProvider.qualityStandards ?? mergedQuality;
          }
        }
        const result: NonNullable<ToolFieldConfiguration['globalGuidance']> =
          {};
        if (mergedWarnings !== undefined) result.warnings = mergedWarnings;
        if (mergedQuality !== undefined)
          result.qualityStandards = mergedQuality;
        return result;
      }
    }
    const providers = this.pickMatchingProviders(toolName);
    if (providers.length > 0) {
      let mergedWarnings: string[] | undefined;
      let mergedQuality: string[] | undefined;
      for (const p of [...providers].reverse()) {
        const g = this.safeGetGlobalGuidance(p, toolName);
        if (g) {
          mergedWarnings = g.warnings ?? mergedWarnings;
          mergedQuality = g.qualityStandards ?? mergedQuality;
        }
      }
      const result: NonNullable<ToolFieldConfiguration['globalGuidance']> = {};
      if (mergedWarnings !== undefined) result.warnings = mergedWarnings;
      if (mergedQuality !== undefined) result.qualityStandards = mergedQuality;
      return Object.keys(result).length > 0 ? result : null;
    }
    return null;
  }

  /**
   * Validate field value against guidance rules
   */
  validateFieldValue(
    toolName: string,
    fieldName: string,
    value: unknown
  ): {
    isValid: boolean;
    warnings: string[];
    errors: string[];
  } {
    const guidance = this.getFieldGuidance(toolName, fieldName);
    const warnings: string[] = [];
    const errors: string[] = [];

    if (!guidance || typeof value !== 'string') {
      return { isValid: true, warnings, errors };
    }

    if (guidance.warnings) {
      for (const warning of guidance.warnings) {
        if (warning.pattern.test(value)) {
          warnings.push(warning.message);
        }
      }
    }

    if (guidance.validationRules) {
      const { rejectPatterns, qualityChecks } = guidance.validationRules;

      if (rejectPatterns) {
        for (const reject of rejectPatterns) {
          if (reject.pattern.test(value)) {
            errors.push(`Rejected: ${reject.reason}`);
          }
        }
      }

      if (qualityChecks) {
        if (qualityChecks.forbidTechnicalTerms) {
          const lowerValue = value.toLowerCase();
          for (const term of qualityChecks.forbidTechnicalTerms) {
            if (lowerValue.includes(term.toLowerCase())) {
              errors.push(
                `Avoid technical terms like "${term}" in NFT metadata`
              );
            }
          }
        }

        if (qualityChecks.requireSpecificTerms) {
          const lowerValue = value.toLowerCase();
          const hasRequired = qualityChecks.requireSpecificTerms.some((term) =>
            lowerValue.includes(term.toLowerCase())
          );
          if (!hasRequired) {
            warnings.push(
              `Consider including terms like: ${qualityChecks.requireSpecificTerms.join(
                ', '
              )}`
            );
          }
        }

        if (qualityChecks.minNonTechnicalWords) {
          const words = value.split(/\s+/).filter((word) => word.length > 2);
          if (words.length < qualityChecks.minNonTechnicalWords) {
            warnings.push(
              `Consider providing more descriptive content (at least ${qualityChecks.minNonTechnicalWords} meaningful words)`
            );
          }
        }
      }
    }

    return {
      isValid: errors.length === 0,
      warnings,
      errors,
    };
  }

  /**
   * Clear all configurations (useful for testing)
   */
  clear(): void {
    this.configurations = [];
    this.providers = [];
    this.registerOrderCounter = 0;
  }

  /** Choose matching provider by priority then last-in wins */
  private pickMatchingProviders(toolName: string): Array<{
    id: string;
    provider: FieldGuidanceProvider;
    priority: number;
    order: number;
  }> {
    const matches = this.providers.filter((p) =>
      typeof p.pattern === 'string'
        ? toolName.toLowerCase().includes((p.pattern as string).toLowerCase())
        : (p.pattern as RegExp).test(toolName)
    );
    const sorted = matches.sort((a, b) => {
      if (b.priority !== a.priority) return b.priority - a.priority;
      return b.order - a.order; // last-in wins when equal priority
    });
    return sorted.map((m) => ({
      id: m.id,
      provider: m.provider,
      priority: m.priority,
      order: m.order,
    }));
  }

  private safeGetFieldGuidance(
    winner: { id: string; provider: FieldGuidanceProvider },
    fieldName: string,
    toolName: string
  ): FieldGuidance | null {
    try {
      return winner.provider.getFieldGuidance(fieldName, { toolName }) ?? null;
    } catch (err) {
      this.logger.warn('Provider getFieldGuidance failed', {
        id: winner.id,
        err,
      });
      return null;
    }
  }

  private safeGetGlobalGuidance(
    winner: { id: string; provider: FieldGuidanceProvider },
    toolName: string
  ): ToolFieldConfiguration['globalGuidance'] | null {
    try {
      return winner.provider.getGlobalGuidance?.(toolName) ?? null;
    } catch (err) {
      this.logger.warn('Provider getGlobalGuidance failed', {
        id: winner.id,
        err,
      });
      return null;
    }
  }

  private mergeGuidance(
    base: FieldGuidance,
    over: FieldGuidance
  ): FieldGuidance {
    const out: FieldGuidance = {};
    const suggestions = over.suggestions ?? base.suggestions;
    if (suggestions !== undefined) out.suggestions = suggestions;
    const predefinedOptions = over.predefinedOptions ?? base.predefinedOptions;
    if (predefinedOptions !== undefined)
      out.predefinedOptions = predefinedOptions;
    const warnings = over.warnings ?? base.warnings;
    if (warnings !== undefined) out.warnings = warnings;
    const validationRules = over.validationRules ?? base.validationRules;
    if (validationRules !== undefined) out.validationRules = validationRules;
    const fieldTypeOverride = over.fieldTypeOverride ?? base.fieldTypeOverride;
    if (fieldTypeOverride !== undefined)
      out.fieldTypeOverride = fieldTypeOverride;
    const contextualHelpText =
      over.contextualHelpText ?? base.contextualHelpText;
    if (contextualHelpText !== undefined)
      out.contextualHelpText = contextualHelpText;
    return out;
  }
}

export const fieldGuidanceRegistry = new FieldGuidanceRegistry();

/**
 * Provider interface (optional, for dynamic guidance)
 */
export interface FieldGuidanceProvider {
  getFieldGuidance(
    fieldName: string,
    ctx: { toolName: string }
  ): FieldGuidance | null;
  getGlobalGuidance?(
    toolName: string
  ): ToolFieldConfiguration['globalGuidance'] | null;
}
