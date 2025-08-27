import { ChatOpenAI } from '@langchain/openai';
import { Logger } from '@hashgraphonline/standards-sdk';
import type { EntityAssociation } from '../memory/smart-memory-manager';
import { ENTITY_PATTERNS } from '../constants';
import { EntityFormat } from '..';

export interface EntityResolverConfig {
  apiKey: string;
  modelName?: string;
}

interface EntityIdValue {
  toString(): string;
}

interface TransactionReceipt {
  tokenId?: EntityIdValue | string;
  topicId?: EntityIdValue | string;
  accountId?: EntityIdValue | string;
  contractId?: EntityIdValue | string;
  fileId?: EntityIdValue | string;
  scheduleId?: EntityIdValue | string;
}

interface TransactionResponse {
  success?: boolean;
  receipt?: TransactionReceipt;
  result?: {
    receipt?: TransactionReceipt;
    transactionId?: string;
  };
  data?: {
    receipt?: TransactionReceipt;
  };
  transactionId?: string;
}

interface ExtractedEntity {
  id: string;
  name: string;
  type: EntityFormat;
  transactionId?: string;
}

/**
 * LLM-based entity resolver that replaces brittle regex patterns
 */
export class EntityResolver {
  private llm: ChatOpenAI;
  private logger: Logger;

  constructor(config: EntityResolverConfig) {
    this.llm = new ChatOpenAI({
      apiKey: config.apiKey,
      modelName: config.modelName || 'gpt-4o-mini',
      temperature: 0,
    });
    this.logger = new Logger({ module: 'EntityResolver' });
  }

  /**
   * Resolve entity references using LLM instead of regex
   */
  async resolveReferences(
    message: string,
    entities: EntityAssociation[]
  ): Promise<string> {
    if (!entities || entities.length === 0) {
      return message;
    }

    const byType = entities.reduce((acc, e) => {
      if (!acc[e.entityType]) acc[e.entityType] = [];
      acc[e.entityType].push(e);
      return acc;
    }, {} as Record<string, EntityAssociation[]>);

    try {
      const stats = Object.fromEntries(
        Object.entries(byType).map(([type, list]) => [
          type,
          {
            count: list.length,
            mostRecent: list[0]?.entityId,
          },
        ])
      );
      this.logger.info('resolveReferences: input summary', {
        messagePreview: message.substring(0, 200),
        entityStats: stats,
      });
    } catch {}

    let context = 'Available entities in memory:\n';
    for (const [type, list] of Object.entries(byType)) {
      const recent = list[0];
      context += `Most recent ${type}: "${recent.entityName}" = ${recent.entityId}\n`;
      if (list.length > 1) {
        context += `  (${list.length - 1} other ${type}s in memory)\n`;
      }
    }

    const prompt = `Task: Replace entity references with their IDs from memory. STRICT TYPE RULES:

- For phrases referring to "${ENTITY_PATTERNS.TOKEN_REFERENCE}" or actions that clearly require a token (create/mint/airdrop/associate/etc.), resolve to the most recent TOKEN entity ID (never a topic or account).
- For phrases referring to "${ENTITY_PATTERNS.TOPIC_REFERENCE}" or actions that clearly require a topic (inscribe/publish/consensus/etc.), resolve to the most recent TOPIC entity ID (never a token or account).
- Do not infer or invent entity IDs. Only use those present in the provided context.

${context}

User message: "${message}"

Instructions:
- If the user says "${ENTITY_PATTERNS.TOPIC_REFERENCE}" or "that topic" → replace with the most recent topic ID
- If the user says "${ENTITY_PATTERNS.TOKEN_REFERENCE}" or "that token" → replace with the most recent token ID (never a topic)
- If the user says "it" or "that" after an action verb → replace with the most recent entity ID
- Examples:
  * "submit on ${ENTITY_PATTERNS.TOPIC_REFERENCE}" → "submit on 0.0.6543472"
  * "airdrop ${ENTITY_PATTERNS.TOKEN_REFERENCE}" → "airdrop 0.0.123456"
  * "send a message to it" → "send a message to 0.0.6543472"

Return ONLY the message with replacements made. Do not add any explanations.
Resolved message:`;

    try {
      const response = await this.llm.invoke(prompt);
      const resolved = (response.content as string).trim();

      const changed = resolved !== message;
      try {
        this.logger.info('resolveReferences: resolution result', {
          changed,
          hasEntityId: /\b0\.0\.\d+\b/.test(resolved),
          resolvedPreview: resolved.substring(0, 200),
        });
      } catch {}

      if (changed && resolved.includes('0.0.')) {
        return resolved;
      }

      return message;
    } catch {
      return message;
    }
  }

  /**
   * Extract entities from agent response using receipt data (preferred) or LLM fallback
   */
  async extractEntities(
    response: unknown,
    userMessage: string
  ): Promise<ExtractedEntity[]> {
    const receiptEntities = this.extractFromReceipt(response, userMessage);
    if (receiptEntities.length > 0) {
      return receiptEntities;
    }

    return this.extractWithLLM(response, userMessage);
  }

  /**
   * Extract entities from transaction receipt data (primary method)
   */
  private extractFromReceipt(
    response: unknown,
    userMessage: string
  ): ExtractedEntity[] {
    const entities: ExtractedEntity[] = [];

    let parsedResponse: TransactionResponse;
    try {
      parsedResponse =
        typeof response === 'string'
          ? JSON.parse(response)
          : (response as TransactionResponse);
    } catch {
      parsedResponse = response as TransactionResponse;
    }

    if (!parsedResponse || parsedResponse.success === false) {
      return entities;
    }

    const receipt =
      parsedResponse.receipt ||
      parsedResponse.result?.receipt ||
      parsedResponse.data?.receipt;

    if (!receipt) {
      return entities;
    }

    const entityName = this.extractNameFromMessage(userMessage);

    const transactionId =
      parsedResponse.transactionId ||
      parsedResponse.result?.transactionId ||
      undefined;

    const extractEntityId = (entityId: EntityIdValue | string): string => {
      if (typeof entityId === 'string') {
        return entityId;
      }
      if (
        entityId &&
        typeof entityId === 'object' &&
        typeof entityId.toString === 'function'
      ) {
        if (entityId.toString !== Object.prototype.toString) {
          return entityId.toString();
        }
      }
      return String(entityId);
    };

    if (receipt.tokenId) {
      const entity: ExtractedEntity = {
        id: extractEntityId(receipt.tokenId),
        name: entityName,
        type: EntityFormat.TOKEN_ID,
      };
      if (transactionId) {
        entity.transactionId = transactionId;
      }
      entities.push(entity);
    }

    if (receipt.topicId) {
      const entity: ExtractedEntity = {
        id: extractEntityId(receipt.topicId),
        name: entityName,
        type: EntityFormat.TOPIC_ID,
      };
      if (transactionId) {
        entity.transactionId = transactionId;
      }
      entities.push(entity);
    }

    if (receipt.accountId) {
      const entity: ExtractedEntity = {
        id: extractEntityId(receipt.accountId),
        name: entityName,
        type: EntityFormat.ACCOUNT_ID,
      };
      if (transactionId) {
        entity.transactionId = transactionId;
      }
      entities.push(entity);
    }

    if (receipt.contractId) {
      const entity: ExtractedEntity = {
        id: extractEntityId(receipt.contractId),
        name: entityName,
        type: EntityFormat.CONTRACT_ID,
      };
      if (transactionId) {
        entity.transactionId = transactionId;
      }
      entities.push(entity);
    }

    if (receipt.fileId) {
      const entity: ExtractedEntity = {
        id: extractEntityId(receipt.fileId),
        name: entityName,
        type: EntityFormat.FILE_ID,
      };
      if (transactionId) {
        entity.transactionId = transactionId;
      }
      entities.push(entity);
    }

    if (receipt.scheduleId) {
      const entity: ExtractedEntity = {
        id: extractEntityId(receipt.scheduleId),
        name: entityName,
        type: EntityFormat.SCHEDULE_ID,
      };
      if (transactionId) {
        entity.transactionId = transactionId;
      }
      entities.push(entity);
    }

    return entities;
  }

  /**
   * Extract entity name from user message
   */
  private extractNameFromMessage(message: string): string {
    const quotedMatch = message.match(/"([^"]+)"/);
    if (quotedMatch) return quotedMatch[1];

    const calledMatch = message.match(/called\s+([A-Za-z0-9#\s_-]+?)(?:\s|$)/i);
    if (calledMatch) return calledMatch[1].trim();

    const forMatch = message.match(/for\s+([A-Za-z0-9#\s_-]+)/i);
    if (forMatch) return forMatch[1].trim();

    const namedMatch = message.match(
      /(?:token|topic|account|contract)\s+([A-Za-z0-9#_-]+)/i
    );
    if (namedMatch) return namedMatch[1].trim();

    if (message.includes('new account')) return 'new account';

    return 'unnamed_entity';
  }

  /**
   * Extract entities using LLM (fallback method)
   */
  private async extractWithLLM(
    response: unknown,
    userMessage: string
  ): Promise<ExtractedEntity[]> {
    const text =
      typeof response === 'string' ? response : JSON.stringify(response);

    const prompt = `Analyze this agent response and extract ONLY newly created entities.

User asked: "${userMessage.substring(0, 200)}"

Agent response: ${text.substring(0, 3000)}

CRITICAL: Only extract Hedera entity IDs in the format 0.0.XXXXX (shard.realm.number).
DO NOT extract:
- Token symbols (e.g., "FOREV", "USDC", "HBAR")
- Token names (e.g., "Forever", "My Token")
- Transaction IDs (format: 0.0.XXX@timestamp)
- Account aliases or mnemonics

Look for:
1. Success messages with entity IDs (e.g., "Successfully created topic 0.0.6543472")
2. Transaction confirmations that created new entities
3. Entity IDs that appear after words like "created", "new", "successfully"

DO NOT include:
- Token symbols or names (these are NOT entity IDs)
- Account IDs that already existed (like sender/receiver accounts)
- Entity IDs that were parameters to the operation
- Failed operations
- Anything that doesn't match the 0.0.XXXXX format

Return a JSON array of newly created entities:
[{"id": "0.0.XXX", "name": "descriptive_name", "type": "topic|token|account"}]

If no entities were created, return: []

JSON:`;

    try {
      const response = await this.llm.invoke(prompt);
      const content = response.content as string;
      const match = content.match(/\[[\s\S]*?\]/);
      if (match) {
        const entities = JSON.parse(match[0]);
        return entities;
      }
    } catch {}
    return [];
  }

  /**
   * Validate that an entity matches the expected type
   */
  validateEntityType(
    entityId: string,
    expectedType: string,
    entities: EntityAssociation[]
  ): boolean {
    const stored = entities.find((e) => e.entityId === entityId);
    return !!stored && stored.entityType === expectedType;
  }

  /**
   * Resolve entity references with type validation
   */
  async resolveWithTypeValidation(
    query: string,
    entities: EntityAssociation[],
    expectedType?: string
  ): Promise<EntityAssociation[]> {
    await this.resolveReferences(query, entities);

    if (!expectedType) {
      return entities;
    }

    return entities.filter((entity) => entity.entityType === expectedType);
  }

  /**
   * Get entities filtered by type
   */
  getEntitiesByType(
    entities: EntityAssociation[],
    entityType: string
  ): EntityAssociation[] {
    return entities.filter((entity) => entity.entityType === entityType);
  }

  /**
   * Find the most recent entity of a specific type
   */
  getMostRecentEntityByType(
    entities: EntityAssociation[],
    entityType: string
  ): EntityAssociation | null {
    const filtered = entities.filter(
      (entity) => entity.entityType === entityType
    );
    if (filtered.length === 0) return null;

    return filtered.reduce((most, current) =>
      current.createdAt > most.createdAt ? current : most
    );
  }
}
