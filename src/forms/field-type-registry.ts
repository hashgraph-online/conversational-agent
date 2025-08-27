/**
 * Registry for field type detection patterns
 * @module FieldTypeRegistry
 */

import type { FormFieldType } from './types';

/**
 * Pattern-based field type detection rule
 */
export interface FieldTypePattern {
  pattern: RegExp | string[];
  type: FormFieldType;
  priority?: number;
}

/**
 * Registry for managing field type detection patterns
 */
export class FieldTypeRegistry {
  private static instance: FieldTypeRegistry;
  private patterns: Map<string, FieldTypePattern> = new Map();

  private constructor() {
    this.initializeDefaultPatterns();
  }

  /**
   * Get singleton instance
   */
  static getInstance(): FieldTypeRegistry {
    if (!FieldTypeRegistry.instance) {
      FieldTypeRegistry.instance = new FieldTypeRegistry();
    }
    return FieldTypeRegistry.instance;
  }

  /**
   * Initialize default field type patterns
   */
  private initializeDefaultPatterns(): void {
    this.register('numeric-supply-exact', {
      pattern: ['maxSupply', 'minSupply', 'totalSupply'],
      type: 'number',
      priority: 15,
    });

    this.register('numeric-supply', {
      pattern: /supply$/i,
      type: 'number',
      priority: 10,
    });

    this.register('numeric-amounts', {
      pattern: /(?:amount|quantity|count|total|sum|value)$/i,
      type: 'number',
      priority: 8,
    });

    this.register('numeric-time', {
      pattern: /(?:period|duration|time|timeout|delay|interval)$/i,
      type: 'number',
      priority: 8,
    });

    this.register('numeric-limits', {
      pattern: /(?:limit|max|min|threshold|size|length)$/i,
      type: 'number',
      priority: 7,
    });

    this.register('currency', {
      pattern: /(?:price|cost|fee|payment|balance|amount)$/i,
      type: 'currency',
      priority: 9,
    });

    this.register('percentage', {
      pattern: /(?:percent|percentage|rate|ratio)$/i,
      type: 'percentage',
      priority: 9,
    });

    this.register('boolean-freeze', {
      pattern: ['freezeDefault', 'freeze'],
      type: 'checkbox',
      priority: 10,
    });

    this.register('boolean-flags', {
      pattern:
        /(?:is|has|can|should|enable|disable|active|default|allow)(?:[A-Z]|$)/,
      type: 'checkbox',
      priority: 8,
    });

    this.register('textarea', {
      pattern: /(?:memo|description|notes|comment|message|content|body|text)$/i,
      type: 'textarea',
      priority: 8,
    });

    this.register('array-fees', {
      pattern: ['customFees', 'fees'],
      type: 'array',
      priority: 10,
    });

    this.register('array-general', {
      pattern: /(?:list|items|array|collection)$/i,
      type: 'array',
      priority: 7,
    });

    this.register('object-options', {
      pattern: ['metaOptions', 'options'],
      type: 'object',
      priority: 10,
    });

    this.register('object-config', {
      pattern: /(?:config|settings|configuration|metadata|data|info)$/i,
      type: 'object',
      priority: 7,
    });

    this.register('select-type', {
      pattern: /(?:type|kind|category|status|state|mode)$/i,
      type: 'select',
      priority: 7,
    });
  }

  /**
   * Register a field type pattern
   */
  register(key: string, pattern: FieldTypePattern): void {
    this.patterns.set(key, pattern);
  }

  /**
   * Unregister a field type pattern
   */
  unregister(key: string): boolean {
    return this.patterns.delete(key);
  }

  /**
   * Detect field type based on field name
   */
  detectType(fieldName: string): FormFieldType | null {
    const matches: Array<{ type: FormFieldType; priority: number }> = [];

    for (const pattern of this.patterns.values()) {
      let isMatch = false;

      if (Array.isArray(pattern.pattern)) {
        isMatch = pattern.pattern.some(
          (p) => fieldName === p || fieldName.toLowerCase() === p.toLowerCase()
        );
      } else if (pattern.pattern instanceof RegExp) {
        isMatch = pattern.pattern.test(fieldName);
      }

      if (isMatch) {
        matches.push({
          type: pattern.type,
          priority: pattern.priority ?? 5,
        });
      }
    }

    if (matches.length > 0) {
      matches.sort((a, b) => b.priority - a.priority);
      return matches[0].type;
    }

    return null;
  }

  /**
   * Get all registered patterns
   */
  getPatterns(): Map<string, FieldTypePattern> {
    return new Map(this.patterns);
  }

  /**
   * Clear all patterns
   */
  clear(): void {
    this.patterns.clear();
  }

  /**
   * Reset to default patterns
   */
  reset(): void {
    this.clear();
    this.initializeDefaultPatterns();
  }
}

export const fieldTypeRegistry = FieldTypeRegistry.getInstance();
