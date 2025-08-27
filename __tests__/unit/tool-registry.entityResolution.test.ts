/**
 * @jest-environment node
 */

import { z } from 'zod';
import { DynamicStructuredTool } from '@langchain/core/tools';
import { ToolRegistry, type ToolMetadata as _ToolMetadata, type EntityResolutionPreferences } from '../../src/core/tool-registry';
import {
  TEST_TOOL_NAMES,
  TEST_METADATA_VALUES,
  TEST_TOOL_RESOLUTIONS
} from '../test-constants';

describe('ToolRegistry Entity Resolution Integration', () => {
  let registry: ToolRegistry;

  beforeEach(() => {
    registry = new ToolRegistry();
  });

  describe('EntityResolutionPreferences Interface', () => {
    it('should accept valid entity resolution preferences in tool metadata', () => {
      const preferences: EntityResolutionPreferences = {
        inscription: TEST_TOOL_RESOLUTIONS.HRL,
        token: TEST_TOOL_RESOLUTIONS.TOKEN_ID,
        nft: TEST_TOOL_RESOLUTIONS.SERIAL_NUMBER,
        account: TEST_TOOL_RESOLUTIONS.ACCOUNT_ID
      };

      const tool = new DynamicStructuredTool({
        name: TEST_TOOL_NAMES.TEST_TOOL,
        description: TEST_METADATA_VALUES.TEST_TOOL_DESC,
        schema: z.object({
          input: z.string()
        }),
        func: async () => 'test'
      });

      expect(() => {
        registry.registerTool(tool, {
          metadata: {
            entityResolutionPreferences: preferences
          }
        });
      }).not.toThrow();

      const entry = registry.getTool(TEST_TOOL_NAMES.TEST_TOOL);
      expect(entry?.metadata.entityResolutionPreferences).toEqual(preferences);
    });

    it('should handle partial entity resolution preferences', () => {
      const preferences: EntityResolutionPreferences = {
        inscription: TEST_TOOL_RESOLUTIONS.HRL
      };

      const tool = new DynamicStructuredTool({
        name: TEST_TOOL_NAMES.PARTIAL_TOOL,
        description: TEST_METADATA_VALUES.PARTIAL_TOOL_DESC,
        schema: z.object({
          input: z.string()
        }),
        func: async () => 'test'
      });

      registry.registerTool(tool, {
        metadata: {
          entityResolutionPreferences: preferences
        }
      });

      const entry = registry.getTool(TEST_TOOL_NAMES.PARTIAL_TOOL);
      expect(entry?.metadata.entityResolutionPreferences?.inscription).toBe(TEST_TOOL_RESOLUTIONS.HRL);
      expect(entry?.metadata.entityResolutionPreferences?.token).toBeUndefined();
    });

    it('should handle tools without entity resolution preferences', () => {
      const tool = new DynamicStructuredTool({
        name: TEST_TOOL_NAMES.NO_PREFERENCES_TOOL,
        description: TEST_METADATA_VALUES.NO_PREF_TOOL_DESC,
        schema: z.object({
          input: z.string()
        }),
        func: async () => 'test'
      });

      registry.registerTool(tool);

      const entry = registry.getTool(TEST_TOOL_NAMES.NO_PREFERENCES_TOOL);
      expect(entry?.metadata.entityResolutionPreferences).toBeUndefined();
    });
  });

  describe('Tool Query with Entity Preferences', () => {
    beforeEach(() => {
      const hrlTool = new DynamicStructuredTool({
        name: TEST_TOOL_NAMES.HRL_TOOL,
        description: TEST_METADATA_VALUES.HRL_TOOL_DESC,
        schema: z.object({ input: z.string() }),
        func: async () => 'test'
      });

      const topicIdTool = new DynamicStructuredTool({
        name: TEST_TOOL_NAMES.TOPICID_TOOL, 
        description: TEST_METADATA_VALUES.TOPICID_TOOL_DESC,
        schema: z.object({ input: z.string() }),
        func: async () => 'test'
      });

      const noPreferenceTool = new DynamicStructuredTool({
        name: TEST_TOOL_NAMES.NO_PREFERENCE_TOOL,
        description: TEST_METADATA_VALUES.NO_PREF_TOOL_DESC,
        schema: z.object({ input: z.string() }),
        func: async () => 'test'
      });

      registry.registerTool(hrlTool, {
        metadata: {
          entityResolutionPreferences: {
            inscription: TEST_TOOL_RESOLUTIONS.HRL
          }
        }
      });

      registry.registerTool(topicIdTool, {
        metadata: {
          entityResolutionPreferences: {
            inscription: TEST_TOOL_RESOLUTIONS.TOPIC_ID
          }
        }
      });

      registry.registerTool(noPreferenceTool);
    });

    it('should find tools by entity resolution preference', () => {
      const entries = registry.getAllRegistryEntries();
      
      const hrlTools = entries.filter(entry => 
        entry.metadata.entityResolutionPreferences?.inscription === TEST_TOOL_RESOLUTIONS.HRL
      );
      
      const topicIdTools = entries.filter(entry =>
        entry.metadata.entityResolutionPreferences?.inscription === TEST_TOOL_RESOLUTIONS.TOPIC_ID
      );

      const noPreferenceTools = entries.filter(entry =>
        !entry.metadata.entityResolutionPreferences
      );

      expect(hrlTools).toHaveLength(1);
      expect(hrlTools[0].metadata.name).toBe(TEST_TOOL_NAMES.HRL_TOOL);
      
      expect(topicIdTools).toHaveLength(1);
      expect(topicIdTools[0].metadata.name).toBe(TEST_TOOL_NAMES.TOPICID_TOOL);
      
      expect(noPreferenceTools).toHaveLength(1);
      expect(noPreferenceTools[0].metadata.name).toBe(TEST_TOOL_NAMES.NO_PREFERENCE_TOOL);
    });
  });

  describe('Entity Format Validation', () => {
    it('should accept all valid inscription formats', () => {
      const validFormats: Array<EntityResolutionPreferences['inscription']> = [
        TEST_TOOL_RESOLUTIONS.HRL, TEST_TOOL_RESOLUTIONS.TOPIC_ID, 'metadata', TEST_TOOL_RESOLUTIONS.ANY
      ];

      validFormats.forEach(format => {
        const tool = new DynamicStructuredTool({
          name: `inscription-${format}-tool`,
          description: `Tool for ${format} format`,
          schema: z.object({ input: z.string() }),
          func: async () => 'test'
        });

        expect(() => {
          registry.registerTool(tool, {
            metadata: {
              entityResolutionPreferences: {
                inscription: format
              }
            }
          });
        }).not.toThrow();
      });
    });

    it('should accept all valid token formats', () => {
      const validFormats: Array<EntityResolutionPreferences['token']> = [
        TEST_TOOL_RESOLUTIONS.TOKEN_ID, TEST_TOOL_RESOLUTIONS.ADDRESS, TEST_TOOL_RESOLUTIONS.SYMBOL, TEST_TOOL_RESOLUTIONS.ANY
      ];

      validFormats.forEach(format => {
        const tool = new DynamicStructuredTool({
          name: `token-${format}-tool`,
          description: `Tool for ${format} format`,
          schema: z.object({ input: z.string() }),
          func: async () => 'test'
        });

        expect(() => {
          registry.registerTool(tool, {
            metadata: {
              entityResolutionPreferences: {
                token: format
              }
            }
          });
        }).not.toThrow();
      });
    });
  });
});