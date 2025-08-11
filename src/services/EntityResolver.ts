import { ChatOpenAI } from '@langchain/openai';
import type { EntityAssociation } from '../memory/SmartMemoryManager';

export interface EntityResolverConfig {
  apiKey: string;
  modelName?: string;
}

/**
 * LLM-based entity resolver that replaces brittle regex patterns
 */
export class EntityResolver {
  private llm: ChatOpenAI;

  constructor(config: EntityResolverConfig) {
    this.llm = new ChatOpenAI({
      apiKey: config.apiKey,
      modelName: config.modelName || 'gpt-4o-mini',
      temperature: 0,
    });
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

    // Group by type for context
    const byType = entities.reduce((acc, e) => {
      if (!acc[e.entityType]) acc[e.entityType] = [];
      acc[e.entityType].push(e);
      return acc;
    }, {} as Record<string, EntityAssociation[]>);

    let context = 'Available entities in memory:\n';
    for (const [type, list] of Object.entries(byType)) {
      const recent = list[0];
      context += `Most recent ${type}: "${recent.entityName}" = ${recent.entityId}\n`;
      if (list.length > 1) {
        context += `  (${list.length - 1} other ${type}s in memory)\n`;
      }
    }

    const prompt = `Task: Replace entity references with their IDs from memory.

${context}

User message: "${message}"

Instructions:
- If the user says "the topic" or "that topic" → replace with the most recent topic ID
- If the user says "the token" or "that token" → replace with the most recent token ID  
- If the user says "it" or "that" after an action verb → replace with the most recent entity ID
- Examples:
  * "submit on the topic" → "submit on 0.0.6543472"
  * "airdrop the token" → "airdrop 0.0.123456"
  * "send a message to it" → "send a message to 0.0.6543472"

Return ONLY the message with replacements made. Do not add any explanations.
Resolved message:`;

    try {
      const response = await this.llm.invoke(prompt);
      const resolved = (response.content as string).trim();

      if (resolved !== message && resolved.includes('0.0.')) {
        console.log(`[EntityResolver] Resolved: "${message}" → "${resolved}"`);
        return resolved;
      }

      return message;
    } catch (error) {
      console.error('[EntityResolver] Failed:', error);
      return message;
    }
  }

  /**
   * Extract entities from agent response using LLM
   */
  async extractEntities(
    response: unknown,
    userMessage: string
  ): Promise<
    Array<{ id: string; name: string; type: string; transactionId?: string }>
  > {
    const text =
      typeof response === 'string' ? response : JSON.stringify(response);

    const prompt = `Analyze this agent response and extract ONLY newly created entities.

User asked: "${userMessage.substring(0, 200)}"

Agent response: ${text.substring(0, 3000)}

Look for:
1. Success messages with entity IDs (e.g., "Successfully created topic 0.0.6543472")
2. Transaction confirmations that created new entities
3. Entity IDs that appear after words like "created", "new", "successfully"

DO NOT include:
- Account IDs that already existed (like sender/receiver accounts)
- Entity IDs that were parameters to the operation
- Failed operations

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
        if (entities.length > 0) {
          console.log('[EntityResolver] Extracted entities:', entities);
        }
        return entities;
      }
    } catch (error) {
      console.error('[EntityResolver] Extract failed:', error);
    }
    return [];
  }
}
