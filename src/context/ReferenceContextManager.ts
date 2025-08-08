import type { ContentReference, ReferenceId, ContentReferenceError } from '../types/content-reference';
import type { ContentStorage } from '../memory/ContentStorage';
import { Logger } from '@hashgraphonline/standards-sdk';

export interface ReferenceContext {
  reference: ContentReference;
  displayedAt: Date;
  lastAccessedAt: Date;
  contextId: string;
  conversationTurn: number;
}

export interface ReferenceDisplayOptions {
  maxPreviewLength?: number;
  showMetadata?: boolean;
  showSize?: boolean;
  includeActions?: boolean;
  format?: 'inline' | 'card' | 'compact';
}

export interface DisplayResult {
  displayText: string;
  hasValidReference: boolean;
  contextId?: string;
  suggestedActions?: string[];
}

/**
 * Manages content references within agent conversation context
 * Tracks reference usage, provides display formatting, and handles reference validation
 */
export class ReferenceContextManager {
  private activeReferences: Map<ReferenceId, ReferenceContext> = new Map();
  private contentStorage: ContentStorage;
  private logger: Logger;
  private conversationTurn = 0;

  constructor(contentStorage: ContentStorage, logger: Logger) {
    this.contentStorage = contentStorage;
    this.logger = logger;
  }

  /**
   * Add a reference to the current conversation context
   */
  addReference(reference: ContentReference): string {
    this.conversationTurn++;
    const contextId = `ctx_${Date.now()}_${reference.referenceId.substring(0, 8)}`;
    
    const context: ReferenceContext = {
      reference,
      displayedAt: new Date(),
      lastAccessedAt: new Date(),
      contextId,
      conversationTurn: this.conversationTurn
    };

    this.activeReferences.set(reference.referenceId, context);
    
    this.logger.debug(`Added reference to conversation context: ${reference.referenceId} (${contextId})`);
    
    return contextId;
  }

  /**
   * Generate display text for a content reference
   */
  async displayReference(
    reference: ContentReference,
    options: ReferenceDisplayOptions = {}
  ): Promise<DisplayResult> {
    const {
      maxPreviewLength = 150,
      showMetadata = true,
      showSize = true,
      includeActions = true,
      format = 'card'
    } = options;

    try {
      const isValid = await this.contentStorage.hasReference(reference.referenceId);
      if (!isValid) {
        return {
          displayText: this.formatInvalidReference(reference, includeActions),
          hasValidReference: false,
          suggestedActions: ['Request fresh content', 'Use alternative content source']
        };
      }

      const contextId = this.addReference(reference);
      
      let displayText = '';
      
      switch (format) {
        case 'inline':
          displayText = this.formatInlineReference(reference, maxPreviewLength);
          break;
        case 'compact':
          displayText = this.formatCompactReference(reference, showSize);
          break;
        case 'card':
        default:
          displayText = this.formatCardReference(reference, {
            maxPreviewLength,
            showMetadata,
            showSize,
            includeActions,
            contextId
          });
          break;
      }

      return {
        displayText,
        hasValidReference: true,
        contextId
      };
    } catch (error) {
      this.logger.error('Error displaying reference:', error);
      return {
        displayText: this.formatErrorReference(reference, error),
        hasValidReference: false,
        suggestedActions: ['Check reference validity', 'Try again', 'Contact administrator']
      };
    }
  }

  /**
   * Get the most recent reference for "inscribe it" commands
   */
  getMostRecentReference(): ContentReference | null {
    if (this.activeReferences.size === 0) {
      return null;
    }

    let mostRecent: ReferenceContext | null = null;
    for (const context of this.activeReferences.values()) {
      if (!mostRecent || context.displayedAt > mostRecent.displayedAt) {
        mostRecent = context;
      }
    }

    if (mostRecent) {
      mostRecent.lastAccessedAt = new Date();
      return mostRecent.reference;
    }

    return null;
  }

  /**
   * Get reference by context ID
   */
  getReferenceByContextId(contextId: string): ContentReference | null {
    for (const context of this.activeReferences.values()) {
      if (context.contextId === contextId) {
        context.lastAccessedAt = new Date();
        return context.reference;
      }
    }
    return null;
  }

  /**
   * Validate all active references and remove invalid ones
   */
  async validateReferences(): Promise<{ valid: number; invalid: number; removed: ReferenceId[] }> {
    const removed: ReferenceId[] = [];
    let valid = 0;
    let invalid = 0;

    for (const [referenceId, context] of this.activeReferences.entries()) {
      try {
        const isValid = await this.contentStorage.hasReference(referenceId);
        if (isValid) {
          valid++;
        } else {
          invalid++;
          removed.push(referenceId);
          this.activeReferences.delete(referenceId);
          this.logger.debug(`Removed invalid reference from context: ${referenceId}`);
        }
      } catch (error) {
        invalid++;
        removed.push(referenceId);
        this.activeReferences.delete(referenceId);
        this.logger.warn(`Error validating reference ${referenceId}:`, error);
      }
    }

    return { valid, invalid, removed };
  }

  /**
   * Clear old references based on age and usage
   */
  cleanupOldReferences(maxAgeMs: number = 30 * 60 * 1000): number {
    const cutoffTime = new Date(Date.now() - maxAgeMs);
    const toRemove: ReferenceId[] = [];

    for (const [referenceId, context] of this.activeReferences.entries()) {
      if (context.lastAccessedAt < cutoffTime) {
        toRemove.push(referenceId);
      }
    }

    toRemove.forEach(referenceId => {
      this.activeReferences.delete(referenceId);
    });

    if (toRemove.length > 0) {
      this.logger.debug(`Cleaned up ${toRemove.length} old references from context`);
    }

    return toRemove.length;
  }

  /**
   * Get current context statistics
   */
  getContextStats() {
    return {
      activeReferences: this.activeReferences.size,
      conversationTurn: this.conversationTurn,
      oldestReference: this.getOldestReferenceAge(),
      mostRecentReference: this.getMostRecentReferenceAge()
    };
  }

  /**
   * Clear all references from context
   */
  clear(): void {
    this.activeReferences.clear();
    this.conversationTurn = 0;
    this.logger.debug('Cleared all references from context');
  }

  private formatCardReference(
    reference: ContentReference,
    options: {
      maxPreviewLength: number;
      showMetadata: boolean;
      showSize: boolean;
      includeActions: boolean;
      contextId: string;
    }
  ): string {
    const { maxPreviewLength, showMetadata, showSize, includeActions, contextId } = options;
    
    let display = `📄 **Large Content Reference**\n`;
    display += `**Preview:** ${this.truncateText(reference.preview, maxPreviewLength)}\n`;
    
    if (showSize) {
      const sizeKB = Math.round(reference.metadata.sizeBytes / 1024);
      display += `**Size:** ${sizeKB}KB`;
      if (reference.metadata.contentType !== 'binary') {
        display += ` (${reference.metadata.contentType})`;
      }
      display += '\n';
    }
    
    if (showMetadata) {
      if (reference.metadata.fileName) {
        display += `**File:** ${reference.metadata.fileName}\n`;
      }
      if (reference.metadata.source) {
        display += `**Source:** ${reference.metadata.source}\n`;
      }
    }
    
    if (includeActions) {
      display += `\n💡 You can say "inscribe it" to inscribe this content to the Hedera network.`;
    }
    
    display += `\n\n*Reference ID: ${reference.referenceId.substring(0, 12)}...*`;
    display += `\n*Context: ${contextId}*`;
    
    return display;
  }

  private formatInlineReference(reference: ContentReference, maxPreviewLength: number): string {
    const sizeKB = Math.round(reference.metadata.sizeBytes / 1024);
    return `📄 [${sizeKB}KB ${reference.metadata.contentType}] ${this.truncateText(reference.preview, maxPreviewLength)}`;
  }

  private formatCompactReference(reference: ContentReference, showSize: boolean): string {
    const sizeKB = Math.round(reference.metadata.sizeBytes / 1024);
    const sizeText = showSize ? ` (${sizeKB}KB)` : '';
    return `📄 Referenced content${sizeText}: ${reference.metadata.fileName || 'large content'}`;
  }

  private formatInvalidReference(reference: ContentReference, includeActions: boolean): string {
    let display = `❌ **Content Reference Expired**\n`;
    display += `The referenced content is no longer available.\n`;
    display += `**Original:** ${this.truncateText(reference.preview, 100)}\n`;
    
    if (includeActions) {
      display += `\n💡 Please request fresh content from the original source.`;
    }
    
    return display;
  }

  private formatErrorReference(reference: ContentReference, error: unknown): string {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
    let display = `⚠️ **Reference Error**\n`;
    display += `Error accessing referenced content: ${errorMsg}\n`;
    display += `**Reference:** ${this.truncateText(reference.preview, 100)}\n`;
    return display;
  }

  private truncateText(text: string, maxLength: number): string {
    if (text.length <= maxLength) {
      return text;
    }
    return text.substring(0, maxLength - 3) + '...';
  }

  private getOldestReferenceAge(): number | null {
    if (this.activeReferences.size === 0) return null;
    
    let oldest: Date | null = null;
    for (const context of this.activeReferences.values()) {
      if (!oldest || context.displayedAt < oldest) {
        oldest = context.displayedAt;
      }
    }
    
    return oldest ? Date.now() - oldest.getTime() : null;
  }

  private getMostRecentReferenceAge(): number | null {
    if (this.activeReferences.size === 0) return null;
    
    let newest: Date | null = null;
    for (const context of this.activeReferences.values()) {
      if (!newest || context.displayedAt > newest) {
        newest = context.displayedAt;
      }
    }
    
    return newest ? Date.now() - newest.getTime() : null;
  }
}