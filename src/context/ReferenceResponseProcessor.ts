import type { ContentReference, ReferenceId, ContentMetadata } from '../types/content-reference';
import type { ReferenceContextManager, ReferenceDisplayOptions } from './ReferenceContextManager';
import { Logger } from '@hashgraphonline/standards-sdk';

export interface ResponseProcessingOptions {
  autoDisplayReferences?: boolean;
  displayOptions?: ReferenceDisplayOptions;
  includeReferenceInstructions?: boolean;
  contextualizeReferences?: boolean;
}

export interface ProcessedResponse {
  content: string;
  hasReferences: boolean;
  referenceCount: number;
  contextIds: string[];
  suggestedActions: string[];
}

export interface ReferenceDetectionResult {
  hasReferences: boolean;
  references: Array<{
    reference: ContentReference;
    position: number;
    originalText: string;
  }>;
  plainReferences: Array<{
    referenceId: ReferenceId;
    position: number;
    originalText: string;
  }>;
}

/**
 * Processes agent responses to detect and display content references
 * Handles both structured references and plain reference IDs
 */
export class ReferenceResponseProcessor {
  private contextManager: ReferenceContextManager;
  private logger: Logger;

  constructor(contextManager: ReferenceContextManager, logger: Logger) {
    this.contextManager = contextManager;
    this.logger = logger;
  }

  /**
   * Process an agent response to handle content references
   */
  async processResponse(
    responseContent: string,
    options: ResponseProcessingOptions = {}
  ): Promise<ProcessedResponse> {
    const {
      autoDisplayReferences = true,
      displayOptions = {},
      includeReferenceInstructions = true,
      contextualizeReferences = true
    } = options;

    try {
      const detection = this.detectReferences(responseContent);
      
      if (!detection.hasReferences) {
        return {
          content: responseContent,
          hasReferences: false,
          referenceCount: 0,
          contextIds: [],
          suggestedActions: []
        };
      }

      let processedContent = responseContent;
      const contextIds: string[] = [];
      const suggestedActions: string[] = [];

      if (autoDisplayReferences) {
        for (const { reference, position, originalText } of detection.references) {
          const displayResult = await this.contextManager.displayReference(reference, displayOptions);
          
          processedContent = processedContent.replace(originalText, displayResult.displayText);
          
          if (displayResult.contextId) {
            contextIds.push(displayResult.contextId);
          }
          
          if (displayResult.suggestedActions) {
            suggestedActions.push(...displayResult.suggestedActions);
          }
        }

        for (const { referenceId, originalText } of detection.plainReferences) {
          try {
            const resolution = await this.contextManager['contentStorage'].resolveReference(referenceId);
            if (resolution.success && resolution.metadata) {
              const referenceMetadata: Pick<ContentMetadata, 'contentType' | 'sizeBytes' | 'source' | 'fileName' | 'mimeType'> = {
                contentType: resolution.metadata.contentType,
                sizeBytes: resolution.metadata.sizeBytes,
                source: resolution.metadata.source
              };
              
              if (resolution.metadata.fileName !== undefined) {
                referenceMetadata.fileName = resolution.metadata.fileName;
              }
              if (resolution.metadata.mimeType !== undefined) {
                referenceMetadata.mimeType = resolution.metadata.mimeType;
              }
              
              const reference: ContentReference = {
                referenceId,
                state: 'active',
                preview: this.createPreviewFromContent(resolution.content!, resolution.metadata.contentType),
                metadata: referenceMetadata,
                createdAt: resolution.metadata.createdAt,
                format: 'ref://{id}' as const
              };

              const displayResult = await this.contextManager.displayReference(reference, displayOptions);
              processedContent = processedContent.replace(originalText, displayResult.displayText);
              
              if (displayResult.contextId) {
                contextIds.push(displayResult.contextId);
              }
            } else {
              processedContent = processedContent.replace(
                originalText,
                `❌ Reference unavailable: ${referenceId.substring(0, 12)}...`
              );
              suggestedActions.push('Request fresh content');
            }
          } catch (error) {
            this.logger.warn(`Failed to resolve plain reference ${referenceId}:`, error);
            processedContent = processedContent.replace(
              originalText,
              `⚠️ Reference error: ${referenceId.substring(0, 12)}...`
            );
          }
        }
      }

      if (includeReferenceInstructions && (detection.references.length > 0 || detection.plainReferences.length > 0)) {
        if (contextualizeReferences && contextIds.length === 1) {
          processedContent += `\n\n💡 To inscribe this content, say "inscribe it" or "inscribe the content".`;
        } else if (contextualizeReferences && contextIds.length > 1) {
          processedContent += `\n\n💡 To inscribe any of this content, say "inscribe it" (uses most recent) or specify the reference.`;
        } else {
          processedContent += `\n\n💡 Referenced content can be inscribed using the "inscribe it" command.`;
        }
      }

      return {
        content: processedContent,
        hasReferences: true,
        referenceCount: detection.references.length + detection.plainReferences.length,
        contextIds,
        suggestedActions: [...new Set(suggestedActions)]
      };
    } catch (error) {
      this.logger.error('Error processing response references:', error);
      return {
        content: responseContent,
        hasReferences: false,
        referenceCount: 0,
        contextIds: [],
        suggestedActions: ['Check reference system', 'Try again']
      };
    }
  }

  /**
   * Detect references in response content
   */
  private detectReferences(content: string): ReferenceDetectionResult {
    const references: Array<{
      reference: ContentReference;
      position: number;
      originalText: string;
    }> = [];
    
    const plainReferences: Array<{
      referenceId: ReferenceId;
      position: number;
      originalText: string;
    }> = [];

    const contentReferenceRegex = /"type":\s*"content_reference"[^}]*"referenceId":\s*"([^"]+)"[^}]*}/g;
    let match;
    
    while ((match = contentReferenceRegex.exec(content)) !== null) {
      try {
        const refObject = JSON.parse(match[0]);
        if (refObject.type === 'content_reference' && refObject.referenceId) {
          const reference: ContentReference = {
            referenceId: refObject.referenceId,
            state: refObject.state || 'active',
            preview: refObject.preview || '',
            metadata: refObject.metadata || {},
            createdAt: new Date(refObject.createdAt || Date.now()),
            format: 'ref://{id}' as const
          };
          
          references.push({
            reference,
            position: match.index,
            originalText: match[0]
          });
        }
      } catch (error) {
        this.logger.warn('Failed to parse content reference:', error);
      }
    }

    const plainRefRegex = /ref:\/\/([A-Za-z0-9_-]{43})|(?:^|\s)([A-Za-z0-9_-]{43})(?=\s|$)/g;
    let plainMatch;
    
    while ((plainMatch = plainRefRegex.exec(content)) !== null) {
      const referenceId = plainMatch[1] || plainMatch[2];
      if (referenceId && this.isValidReferenceId(referenceId)) {
        plainReferences.push({
          referenceId,
          position: plainMatch.index,
          originalText: plainMatch[0]
        });
      }
    }

    return {
      hasReferences: references.length > 0 || plainReferences.length > 0,
      references,
      plainReferences
    };
  }

  /**
   * Create a preview from content buffer
   */
  private createPreviewFromContent(content: Buffer, contentType: string): string {
    const maxLength = 200;
    let preview = content.toString('utf8', 0, Math.min(content.length, maxLength * 2));
    
    if (contentType === 'html') {
      preview = preview.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
    } else if (contentType === 'json') {
      try {
        const parsed = JSON.parse(preview);
        preview = JSON.stringify(parsed, null, 0);
      } catch {
        // Keep original if not valid JSON
      }
    }
    
    preview = preview.trim();
    if (preview.length > maxLength) {
      preview = preview.substring(0, maxLength) + '...';
    }
    
    return preview || '[Binary content]';
  }

  /**
   * Validate reference ID format
   */
  private isValidReferenceId(id: string): boolean {
    if (!id || typeof id !== 'string') {
      return false;
    }
    
    if (id.length !== 43) {
      return false;
    }
    
    return /^[A-Za-z0-9_-]+$/.test(id);
  }

  /**
   * Get reference context statistics
   */
  getContextStats() {
    return this.contextManager.getContextStats();
  }

  /**
   * Validate all references in context
   */
  async validateAllReferences() {
    return await this.contextManager.validateReferences();
  }

  /**
   * Clean up old references
   */
  cleanupOldReferences(maxAgeMs?: number) {
    return this.contextManager.cleanupOldReferences(maxAgeMs);
  }
}