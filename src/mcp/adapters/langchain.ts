import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import type { MCPToolInfo, MCPServerConfig } from '../types';
import type { MCPClientManager } from '../MCPClientManager';
import { ContentStoreService, shouldUseReference } from '@hashgraphonline/standards-sdk';
import type { ContentSource } from '../../types/content-reference';

/**
 * Convert an MCP tool to a LangChain DynamicStructuredTool
 */
export function convertMCPToolToLangChain(
  tool: MCPToolInfo,
  mcpManager: MCPClientManager,
  serverConfig?: MCPServerConfig
): DynamicStructuredTool {
  const zodSchema = jsonSchemaToZod(tool.inputSchema);

  const sanitizedName = `${tool.serverName}_${tool.name}`.replace(
    /[^a-zA-Z0-9_]/g,
    '_'
  );

  let description = tool.description || `MCP tool ${tool.name} from ${tool.serverName}`;
  
  if (serverConfig?.toolDescriptions?.[tool.name]) {
    description = `${description}\n\n${serverConfig.toolDescriptions[tool.name]}`;
  }
  
  if (serverConfig?.additionalContext) {
    description = `${description}\n\nContext: ${serverConfig.additionalContext}`;
  }

  return new DynamicStructuredTool({
    name: sanitizedName,
    description,
    schema: zodSchema,
    func: async (input) => {
      try {
        const result = await mcpManager.executeTool(
          tool.serverName,
          tool.name,
          input
        );

        let responseText = '';
        
        if (typeof result === 'string') {
          responseText = result;
        } else if (
          result &&
          typeof result === 'object' &&
          'content' in result
        ) {
          const content = (result as { content: unknown }).content;
          if (Array.isArray(content)) {
            const textParts = content
              .filter(
                (item): item is { type: string; text: string } =>
                  typeof item === 'object' &&
                  item !== null &&
                  'type' in item &&
                  item.type === 'text' &&
                  'text' in item
              )
              .map((item) => item.text);
            responseText = textParts.join('\n');
          } else {
            responseText = JSON.stringify(content);
          }
        } else {
          responseText = JSON.stringify(result);
        }

        const responseBuffer = Buffer.from(responseText, 'utf8');
        
        const MCP_REFERENCE_THRESHOLD = 10 * 1024;
        const shouldStoreMCPContent = responseBuffer.length > MCP_REFERENCE_THRESHOLD;
        
        if (shouldStoreMCPContent || shouldUseReference(responseBuffer)) {
          const contentStore = ContentStoreService.getInstance();
          if (contentStore) {
            try {
              const referenceId = await contentStore.storeContent(responseBuffer, {
                contentType: 'text' as ContentSource,
                source: 'mcp',
                mcpToolName: `${tool.serverName}_${tool.name}`,
                originalSize: responseBuffer.length
              });
              return `content-ref:${referenceId}`;
            } catch (storeError) {
            }
          }
        }

        return responseText;
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : 'Unknown error';
        return `Error executing MCP tool ${tool.name}: ${errorMessage}`;
      }
    },
  });
}

/**
 * Convert JSON Schema to Zod schema
 * This is a simplified converter that handles common cases
 */
function jsonSchemaToZod(schema: unknown): z.ZodTypeAny {
  if (!schema || typeof schema !== 'object') {
    return z.object({});
  }

  const schemaObj = schema as Record<string, unknown>;

  if (schemaObj.type && schemaObj.type !== 'object') {
    return convertType(schemaObj);
  }

  if (!schemaObj.properties || typeof schemaObj.properties !== 'object') {
    return z.object({});
  }

  const shape: Record<string, z.ZodTypeAny> = {};

  for (const [key, value] of Object.entries(schemaObj.properties)) {
    let zodType = convertType(value);

    const isRequired =
      Array.isArray(schemaObj.required) && schemaObj.required.includes(key);
    if (!isRequired) {
      zodType = zodType.optional();
    }

    shape[key] = zodType;
  }

  return z.object(shape);
}

/**
 * Convert a single JSON Schema type to Zod
 */
function convertType(schema: unknown): z.ZodTypeAny {
  if (!schema || typeof schema !== 'object' || !('type' in schema)) {
    return z.unknown();
  }

  const schemaObj = schema as {
    type: string;
    enum?: unknown[];
    items?: unknown;
  };
  let zodType: z.ZodTypeAny;

  switch (schemaObj.type) {
    case 'string':
      zodType = z.string();
      if (schemaObj.enum && Array.isArray(schemaObj.enum)) {
        zodType = z.enum(schemaObj.enum as [string, ...string[]]);
      }
      break;

    case 'number':
      zodType = z.number();
      if ('minimum' in schemaObj && typeof schemaObj.minimum === 'number') {
        zodType = (zodType as z.ZodNumber).min(schemaObj.minimum);
      }
      if ('maximum' in schemaObj && typeof schemaObj.maximum === 'number') {
        zodType = (zodType as z.ZodNumber).max(schemaObj.maximum);
      }
      break;

    case 'integer':
      zodType = z.number().int();
      if ('minimum' in schemaObj && typeof schemaObj.minimum === 'number') {
        zodType = (zodType as z.ZodNumber).min(schemaObj.minimum);
      }
      if ('maximum' in schemaObj && typeof schemaObj.maximum === 'number') {
        zodType = (zodType as z.ZodNumber).max(schemaObj.maximum);
      }
      break;

    case 'boolean':
      zodType = z.boolean();
      break;

    case 'array':
      if (schemaObj.items) {
        zodType = z.array(convertType(schemaObj.items));
      } else {
        zodType = z.array(z.unknown());
      }
      break;

    case 'object':
      if ('properties' in schemaObj) {
        zodType = jsonSchemaToZod(schemaObj);
      } else {
        zodType = z.object({}).passthrough();
      }
      break;

    default:
      zodType = z.unknown();
  }

  if ('description' in schemaObj && typeof schemaObj.description === 'string') {
    zodType = zodType.describe(schemaObj.description);
  }

  return zodType;
}
