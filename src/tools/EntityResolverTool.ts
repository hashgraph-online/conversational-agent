import { StructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import { ChatOpenAI } from '@langchain/openai';
import type { EntityAssociation } from '../memory/SmartMemoryManager';

const ResolveEntitiesSchema = z.object({
  message: z.string().describe('The message containing entity references to resolve'),
  entities: z.array(z.object({
    entityId: z.string(),
    entityName: z.string(),
    entityType: z.string(),
  })).describe('Available entities in memory'),
});

const ExtractEntitiesSchema = z.object({
  response: z.string().describe('Agent response text to extract entities from'),
  userMessage: z.string().describe('Original user message for context'),
});

export class ResolveEntitiesTool extends StructuredTool {
  name = 'resolve_entities';
  description = 'Resolves entity references like "the topic", "it", "that" to actual entity IDs';
  schema = ResolveEntitiesSchema;
  
  private llm: ChatOpenAI;
  
  constructor(apiKey: string, modelName = 'gpt-4o-mini') {
    super();
    this.llm = new ChatOpenAI({
      apiKey,
      modelName,
      temperature: 0,
    });
  }
  
  async _call(input: z.infer<typeof ResolveEntitiesSchema>): Promise<string> {
    const { message, entities } = input;
    
    if (!entities || entities.length === 0) {
      return message;
    }
    
    const byType = this.groupEntitiesByType(entities);
    const context = this.buildEntityContext(byType);
    
    const prompt = `Task: Replace entity references with IDs.

${context}

Message: "${message}"

Rules:
- "the topic" or "that topic" → replace with most recent topic ID
- "the token" or "that token" → replace with most recent token ID
- "it" or "that" after action verb → replace with most recent entity ID

Examples:
- "submit on the topic" → "submit on 0.0.6543472"
- "airdrop the token" → "airdrop 0.0.123456"

Return ONLY the resolved message:`;
    
    try {
      const response = await this.llm.invoke(prompt);
      return (response.content as string).trim();
    } catch (error) {
      console.error('[ResolveEntitiesTool] Failed:', error);
      return message;
    }
  }
  
  private groupEntitiesByType(entities: EntityGroup): GroupedEntities {
    return entities.reduce((acc, entity) => {
      if (!acc[entity.entityType]) {
        acc[entity.entityType] = [];
      }
      acc[entity.entityType].push(entity);
      return acc;
    }, {} as GroupedEntities);
  }
  
  private buildEntityContext(groupedEntities: GroupedEntities): string {
    let context = 'Available entities:\n';
    for (const [type, list] of Object.entries(groupedEntities)) {
      const recent = list[0];
      context += `- Most recent ${type}: "${recent.entityName}" = ${recent.entityId}\n`;
    }
    return context;
  }
}

export class ExtractEntitiesTool extends StructuredTool {
  name = 'extract_entities';
  description = 'Extracts newly created entities from agent responses';
  schema = ExtractEntitiesSchema;
  
  private llm: ChatOpenAI;
  
  constructor(apiKey: string, modelName = 'gpt-4o-mini') {
    super();
    this.llm = new ChatOpenAI({
      apiKey,
      modelName,
      temperature: 0,
    });
  }
  
  async _call(input: z.infer<typeof ExtractEntitiesSchema>): Promise<string> {
    const { response, userMessage } = input;
    
    const prompt = `Extract ONLY newly created entities from this response.

User asked: "${userMessage.substring(0, 200)}"
Response: ${response.substring(0, 3000)}

Look for:
- Success messages with new entity IDs
- Words like "created", "new", "successfully" followed by entity IDs

Return JSON array of created entities:
[{"id": "0.0.XXX", "name": "name", "type": "topic|token|account"}]

If none created, return: []

JSON:`;
    
    try {
      const llmResponse = await this.llm.invoke(prompt);
      const content = llmResponse.content as string;
      const match = content.match(/\[[\s\S]*?\]/);
      if (match) {
        return match[0];
      }
      return '[]';
    } catch (error) {
      console.error('[ExtractEntitiesTool] Failed:', error);
      return '[]';
    }
  }
}

export function createEntityTools(apiKey: string, modelName = 'gpt-4o-mini'): {
  resolveEntities: ResolveEntitiesTool;
  extractEntities: ExtractEntitiesTool;
} {
  return {
    resolveEntities: new ResolveEntitiesTool(apiKey, modelName),
    extractEntities: new ExtractEntitiesTool(apiKey, modelName),
  };
}

interface EntityReference {
  entityId: string;
  entityName: string;
  entityType: string;
}

type EntityGroup = EntityReference[];

type GroupedEntities = Record<string, EntityGroup>;

interface ExtractedEntity {
  id: string;
  name: string;
  type: string;
}