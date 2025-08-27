import type { FormFieldType, FieldOption } from './types';

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

  /**
   * Register field guidance for a specific tool
   */
  registerToolConfiguration(config: ToolFieldConfiguration): void {
    this.configurations.push(config);
  }

  /**
   * Get field guidance for a specific tool and field
   */
  getFieldGuidance(toolName: string, fieldName: string): FieldGuidance | null {
    for (const config of this.configurations) {
      const matches =
        typeof config.toolPattern === 'string'
          ? toolName.toLowerCase().includes(config.toolPattern.toLowerCase())
          : config.toolPattern.test(toolName);

      if (matches && config.fields[fieldName]) {
        return config.fields[fieldName];
      }
    }
    return null;
  }

  /**
   * Get global guidance for a tool
   */
  getGlobalGuidance(
    toolName: string
  ): ToolFieldConfiguration['globalGuidance'] | null {
    for (const config of this.configurations) {
      const matches =
        typeof config.toolPattern === 'string'
          ? toolName.toLowerCase().includes(config.toolPattern.toLowerCase())
          : config.toolPattern.test(toolName);

      if (matches && config.globalGuidance) {
        return config.globalGuidance;
      }
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
  }
}

export const fieldGuidanceRegistry = new FieldGuidanceRegistry();

fieldGuidanceRegistry.registerToolConfiguration({
  toolPattern: /inscribe.*hashinal/i,
  globalGuidance: {
    warnings: [
      'Avoid auto-generating technical metadata like file types or upload sources',
      'Focus on collectible traits that add value to the NFT',
    ],
    qualityStandards: [
      'Use meaningful names that describe the artwork or content',
      'Include collectible attributes like rarity, style, or theme',
      'Provide descriptions that tell a story or explain the concept',
    ],
  },
  fields: {
    name: {
      suggestions: [
        'Sunset Landscape #42',
        'Digital Abstract Art',
        'Cosmic Dream Series',
        'Portrait Study #5',
      ],
      validationRules: {
        rejectPatterns: [
          {
            pattern: /^untitled$/i,
            reason: 'Generic names like "Untitled" are not valuable for NFTs',
          },
          {
            pattern: /^image|file|upload/i,
            reason: 'Avoid technical file references in NFT names',
          },
        ],
        qualityChecks: {
          minNonTechnicalWords: 2,
          forbidTechnicalTerms: [
            'MIME',
            'upload',
            'file type',
            'buffer',
            'source',
          ],
        },
      },
      contextualHelpText:
        'Create a distinctive name that collectors will find appealing and memorable',
    },

    description: {
      suggestions: [
        'A vibrant sunset captured in digital brushstrokes...',
        'Part of the Cosmic Dreams collection, exploring...',
        'This piece represents the intersection of technology and nature...',
      ],
      validationRules: {
        rejectPatterns: [
          {
            pattern: /uploaded by|file size|mime type|created from/i,
            reason: 'Avoid technical descriptions in NFT metadata',
          },
        ],
        qualityChecks: {
          minNonTechnicalWords: 8,
          forbidTechnicalTerms: [
            'uploaded',
            'file size',
            'mime type',
            'user upload',
            'image format',
            'pixel dimensions',
            'file extension',
          ],
          requireSpecificTerms: [
            'art',
            'collection',
            'piece',
            'concept',
            'inspired',
            'represents',
          ],
        },
      },
      fieldTypeOverride: 'textarea',
      contextualHelpText:
        'Describe the story, inspiration, or artistic vision behind this NFT',
    },

    creator: {
      suggestions: [
        '0.0.123456 (Hedera Account ID)',
        'ArtistName',
        'StudioBrand',
        'CollectiveDAO',
      ],
      contextualHelpText:
        "Provide the creator's account ID, artist name, or brand identity",
    },

    attributes: {
      predefinedOptions: [
        {
          value: 'Rarity',
          label: 'Rarity',
          description: 'Common, Rare, Epic, Legendary',
        },
        {
          value: 'Color',
          label: 'Color',
          description: 'Primary colors or palette',
        },
        {
          value: 'Style',
          label: 'Style',
          description: 'Abstract, Realistic, Minimalist, etc.',
        },
        {
          value: 'Theme',
          label: 'Theme',
          description: 'Nature, Technology, Fantasy, etc.',
        },
        {
          value: 'Series',
          label: 'Series',
          description: 'Collection or series number',
        },
        {
          value: 'Element',
          label: 'Element',
          description: 'Fire, Water, Earth, Air, etc.',
        },
        {
          value: 'Power Level',
          label: 'Power Level',
          description: 'Numeric strength value',
        },
        {
          value: 'Edition',
          label: 'Edition',
          description: 'Special, Limited, First, etc.',
        },
      ],
      warnings: [
        {
          pattern: /mime.?type|file.?type|upload.?source/i,
          message: 'Technical metadata is not valuable for NFT collectors',
        },
      ],
      validationRules: {
        rejectPatterns: [
          {
            pattern: /^(mime.?type|file.?type|source|origin|upload)$/i,
            reason: 'Technical attributes are not collectible traits',
          },
        ],
        qualityChecks: {
          forbidTechnicalTerms: [
            'MIME Type',
            'File Type',
            'Source',
            'Origin',
            'Upload Source',
            'File Extension',
            'Format',
          ],
        },
      },
      contextualHelpText:
        'Add traits that make this NFT unique and valuable to collectors',
    },

    type: {
      predefinedOptions: [
        { value: 'Digital Art', label: 'Digital Art' },
        { value: 'Photography', label: 'Photography' },
        { value: 'Collectible Card', label: 'Collectible Card' },
        { value: 'Avatar', label: 'Avatar' },
        { value: 'Music', label: 'Music' },
        { value: 'Video', label: 'Video' },
        { value: '3D Model', label: '3D Model' },
        { value: 'Generative Art', label: 'Generative Art' },
        { value: 'Pixel Art', label: 'Pixel Art' },
      ],
      contextualHelpText:
        'Choose the category that best represents your NFT content',
    },
  },
});
