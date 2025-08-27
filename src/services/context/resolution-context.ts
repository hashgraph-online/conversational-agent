import type { ToolMetadata } from '../../core/tool-registry';
import { EntityFormat } from '../formatters/types';

export enum EntityType {
  TOPIC = EntityFormat.TOPIC_ID,
  TOKEN = EntityFormat.TOKEN_ID,
  NFT = EntityFormat.TOKEN_ID,
  ACCOUNT = EntityFormat.ACCOUNT_ID,
  INSCRIPTION = EntityFormat.HRL,
}

export interface EntityHint {
  type: EntityType;
  value: string;
  confidence: number;
  source: 'user' | 'llm' | 'cached';
}

export interface ConversionRecord {
  originalValue: string;
  convertedValue: string;
  sourceFormat: string;
  targetFormat: string;
  converterUsed: string;
  timestamp: Date;
  context: Record<string, unknown>;
}

export interface ResolutionContext {
  toolMetadata?: ToolMetadata;
  userMessage: string;
  entityHints: EntityHint[];
  networkType: string;
  conversionHistory: ConversionRecord[];
  sessionId: string;
}

/**
 * Builder for creating and modifying resolution contexts
 */
export class ResolutionContextBuilder {
  /**
   * Create initial context from user message and session ID
   */
  static fromMessage(message: string, sessionId: string): ResolutionContext {
    return {
      userMessage: message,
      sessionId,
      entityHints: [],
      networkType: 'testnet',
      conversionHistory: [],
    };
  }

  /**
   * Add tool metadata to existing context
   */
  static withToolContext(
    context: ResolutionContext,
    toolMetadata: ToolMetadata
  ): ResolutionContext {
    return {
      ...context,
      toolMetadata,
    };
  }

  /**
   * Add entity hints to existing context
   */
  static withEntityHints(
    context: ResolutionContext,
    hints: EntityHint[]
  ): ResolutionContext {
    return {
      ...context,
      entityHints: [...hints],
    };
  }
}
