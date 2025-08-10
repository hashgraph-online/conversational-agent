import type { ContentType, ContentSource } from '../types/content-reference';
import type { ContentStorage } from '../memory/ContentStorage';
import { Logger } from '@hashgraphonline/standards-sdk';

export interface MCPResponseContent {
  content: unknown;
  type: 'text' | 'image' | 'resource' | 'text[]' | 'image[]';
  sizeBytes: number;
  mimeType?: string;
}

export interface ProcessedResponse {
  content: unknown;
  wasProcessed: boolean;
  referenceCreated?: boolean;
  referenceId?: string;
  originalSize?: number;
  errors?: string[];
}

export interface ContentAnalysis {
  shouldProcess: boolean;
  contents: MCPResponseContent[];
  totalSize: number;
  largestContentSize: number;
}

export class MCPContentProcessor {
  private contentStorage: ContentStorage;
  private logger: Logger;

  constructor(contentStorage: ContentStorage, logger: Logger) {
    this.contentStorage = contentStorage;
    this.logger = logger;
  }

  analyzeResponse(response: unknown): ContentAnalysis {
    const contents: MCPResponseContent[] = [];
    let totalSize = 0;

    this.extractContentFromResponse(response, contents);

    totalSize = contents.reduce((sum, content) => sum + content.sizeBytes, 0);
    const largestContentSize = contents.reduce((max, content) => 
      Math.max(max, content.sizeBytes), 0);

    const shouldProcess = contents.some(content => 
      this.contentStorage.shouldUseReference(
        typeof content.content === 'string' 
          ? content.content 
          : JSON.stringify(content.content)
      )
    );

    return {
      shouldProcess,
      contents,
      totalSize,
      largestContentSize
    };
  }

  async processResponse(
    response: unknown,
    serverName: string,
    toolName: string
  ): Promise<ProcessedResponse> {
    try {
      const analysis = this.analyzeResponse(response);
      
      if (!analysis.shouldProcess) {
        return {
          content: response,
          wasProcessed: false
        };
      }

      const processedResponse = await this.createReferencedResponse(
        response,
        analysis,
        serverName,
        toolName
      );

      return processedResponse;
    } catch (error) {
      this.logger.error('Error processing MCP response:', error);
      return {
        content: response,
        wasProcessed: false,
        errors: [error instanceof Error ? error.message : 'Unknown processing error']
      };
    }
  }

  private extractContentFromResponse(obj: unknown, contents: MCPResponseContent[]): void {
    if (obj === null || obj === undefined) {
      return;
    }

    if (Array.isArray(obj)) {
      obj.forEach(item => this.extractContentFromResponse(item, contents));
      return;
    }

    if (typeof obj === 'object') {
      const record = obj as Record<string, unknown>;
      
      if (record.type === 'text' && typeof record.text === 'string') {
        contents.push({
          content: record.text,
          type: 'text',
          sizeBytes: Buffer.byteLength(record.text, 'utf8'),
          mimeType: this.detectMimeType(record.text as string)
        });
        return;
      }

      if (record.type === 'image' && typeof record.data === 'string') {
        contents.push({
          content: record.data,
          type: 'image',
          sizeBytes: Math.ceil(record.data.length * 0.75),
          mimeType: record.mimeType as string || 'image/jpeg'
        });
        return;
      }

      if (record.type === 'resource' && record.resource) {
        const resourceStr = JSON.stringify(record.resource);
        contents.push({
          content: resourceStr,
          type: 'resource',
          sizeBytes: Buffer.byteLength(resourceStr, 'utf8'),
          mimeType: 'application/json'
        });
        return;
      }

      Object.values(record).forEach(value => 
        this.extractContentFromResponse(value, contents));
      return;
    }

    if (typeof obj === 'string') {
      if (obj.length > 1000) {
        contents.push({
          content: obj,
          type: 'text',
          sizeBytes: Buffer.byteLength(obj, 'utf8'),
          mimeType: this.detectMimeType(obj)
        });
      }
    }
  }

  private async createReferencedResponse(
    originalResponse: unknown,
    analysis: ContentAnalysis,
    serverName: string,
    toolName: string
  ): Promise<ProcessedResponse> {
    const processedResponse = this.deepClone(originalResponse);
    const errors: string[] = [];
    let referenceCreated = false;
    let totalReferenceSize = 0;

    for (const contentInfo of analysis.contents) {
      if (this.contentStorage.shouldUseReference(
        typeof contentInfo.content === 'string' 
          ? contentInfo.content 
          : JSON.stringify(contentInfo.content)
      )) {
        try {
          const contentBuffer = Buffer.from(
            typeof contentInfo.content === 'string' 
              ? contentInfo.content 
              : JSON.stringify(contentInfo.content),
            'utf8'
          );

          const contentType = this.mapMimeTypeToContentType(contentInfo.mimeType);
          
          const metadata: Parameters<typeof this.contentStorage.storeContentIfLarge>[1] = {
            contentType,
            source: 'mcp_tool' as ContentSource,
            mcpToolName: `${serverName}::${toolName}`,
            tags: ['mcp_response', serverName, toolName]
          };
          
          if (contentInfo.mimeType !== undefined) {
            metadata.mimeType = contentInfo.mimeType;
          }
          
          const reference = await this.contentStorage.storeContentIfLarge(
            contentBuffer,
            metadata
          );

          if (reference) {
            this.replaceContentInResponse(
              processedResponse,
              contentInfo.content,
              this.createLightweightReference(reference)
            );
            referenceCreated = true;
            totalReferenceSize += contentBuffer.length;
          }
        } catch (error) {
          errors.push(`Failed to create reference: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
      }
    }

    const result: ProcessedResponse = {
      content: processedResponse,
      wasProcessed: true,
      referenceCreated,
      originalSize: totalReferenceSize
    };
    
    if (errors.length > 0) {
      result.errors = errors;
    }
    
    return result;
  }

  private createLightweightReference(reference: any): Record<string, unknown> {
    return {
      type: 'content_reference',
      referenceId: reference.referenceId,
      preview: reference.preview,
      size: reference.metadata.sizeBytes,
      contentType: reference.metadata.contentType,
      format: 'ref://{id}',
      _isReference: true
    };
  }

  private replaceContentInResponse(obj: unknown, oldContent: unknown, newContent: any): void {
    if (obj === null || obj === undefined) {
      return;
    }

    if (Array.isArray(obj)) {
      for (let i = 0; i < obj.length; i++) {
        if (obj[i] === oldContent) {
          obj[i] = newContent;
        } else {
          this.replaceContentInResponse(obj[i], oldContent, newContent);
        }
      }
      return;
    }

    if (typeof obj === 'object') {
      const record = obj as Record<string, unknown>;
      if (record.type === 'text' && record.text === oldContent) {
        for (const key of Object.keys(record)) {
          delete record[key];
        }
        for (const key of Object.keys(newContent)) {
          record[key] = newContent[key];
        }
        return;
      }
      for (const key in record) {
        if (record[key] === oldContent) {
          record[key] = newContent;
        } else {
          this.replaceContentInResponse(record[key], oldContent, newContent);
        }
      }
    }
  }

  private detectMimeType(content: string): string {
    if (content.trim().startsWith('{') || content.trim().startsWith('[')) {
      return 'application/json';
    }
    if (content.includes('<html>') || content.includes('<!DOCTYPE')) {
      return 'text/html';
    }
    if (content.includes('# ') || content.includes('## ')) {
      return 'text/markdown';
    }
    return 'text/plain';
  }

  private mapMimeTypeToContentType(mimeType?: string): ContentType {
    if (!mimeType) return 'text';
    
    if (mimeType.startsWith('text/plain')) return 'text';
    if (mimeType === 'application/json') return 'json';
    if (mimeType === 'text/html') return 'html';
    if (mimeType === 'text/markdown') return 'markdown';
    if (mimeType.startsWith('text/')) return 'text';
    
    return 'binary';
  }

  private deepClone<T>(obj: T): T {
    if (obj === null || typeof obj !== 'object') {
      return obj;
    }
    
    if (obj instanceof Date) {
      return new Date(obj.getTime()) as T;
    }
    
    if (Array.isArray(obj)) {
      return obj.map(item => this.deepClone(item)) as T;
    }
    
    const cloned = {} as T;
    for (const key in obj) {
      if (obj.hasOwnProperty(key)) {
        cloned[key] = this.deepClone(obj[key]);
      }
    }
    
    return cloned;
  }
}