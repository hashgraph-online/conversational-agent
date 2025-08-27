/**
 * @jest-environment node
 */

import { ResolutionContext, ResolutionContextBuilder, EntityHint, ConversionRecord, EntityType } from '../../../../src/services/context/resolution-context';
import type { ToolMetadata } from '../../../../src/core/ToolRegistry';
import {
  TEST_CONTEXT_STRINGS,
  TEST_TOOL_NAMES,
  TEST_METADATA_VALUES,
  TEST_TOOL_CATEGORIES,
  TEST_TOOL_RESOLUTIONS,
  TEST_TOPIC_IDS,
  TEST_HRL_VALUES,
  TEST_FORMAT_TYPES,
  TEST_ACCOUNT_IDS
} from '../../../test-constants';

describe('ResolutionContext', () => {
  describe('interface definition', () => {
    it('should create a basic resolution context', () => {
      const context: ResolutionContext = {
        userMessage: TEST_CONTEXT_STRINGS.MINT_FOREVER_1,
        entityHints: [],
        networkType: TEST_FORMAT_TYPES.TESTNET,
        conversionHistory: [],
        sessionId: TEST_CONTEXT_STRINGS.TEST_SESSION
      };
      
      expect(context.userMessage).toBe(TEST_CONTEXT_STRINGS.MINT_FOREVER_1);
      expect(context.sessionId).toBe(TEST_CONTEXT_STRINGS.TEST_SESSION);
      expect(context.networkType).toBe(TEST_FORMAT_TYPES.TESTNET);
      expect(context.entityHints).toHaveLength(0);
      expect(context.conversionHistory).toHaveLength(0);
    });

    it('should accept optional tool metadata', () => {
      const toolMetadata: ToolMetadata = {
        name: TEST_TOOL_NAMES.MINT_NFT_TOOL,
        version: TEST_METADATA_VALUES.VERSION_1_0_0,
        category: TEST_TOOL_CATEGORIES.CORE,
        description: TEST_METADATA_VALUES.NFT_MINTING_TOOL,
        capabilities: {
          supportsFormValidation: false,
          requiresWrapper: false,
          priority: 'medium',
          category: TEST_TOOL_CATEGORIES.CORE
        },
        dependencies: [],
        schema: {},
        entityResolutionPreferences: {
          inscription: TEST_TOOL_RESOLUTIONS.HRL,
          token: TEST_TOOL_RESOLUTIONS.TOKEN_ID
        }
      };

      const context: ResolutionContext = {
        toolMetadata,
        userMessage: TEST_CONTEXT_STRINGS.MINT_FOREVER_1,
        entityHints: [],
        networkType: TEST_FORMAT_TYPES.TESTNET,
        conversionHistory: [],
        sessionId: TEST_CONTEXT_STRINGS.TEST_SESSION
      };

      expect(context.toolMetadata).toBe(toolMetadata);
      expect(context.toolMetadata?.entityResolutionPreferences?.inscription).toBe(TEST_TOOL_RESOLUTIONS.HRL);
    });
  });

  describe('EntityHint interface', () => {
    it('should create valid entity hints', () => {
      const hint: EntityHint = {
        type: EntityType.TOPIC,
        value: TEST_TOPIC_IDS.TOPIC_6624800,
        confidence: 0.95,
        source: 'llm'
      };

      expect(hint.type).toBe(EntityType.TOPIC);
      expect(hint.value).toBe(TEST_TOPIC_IDS.TOPIC_6624800);
      expect(hint.confidence).toBe(0.95);
      expect(hint.source).toBe('llm');
    });

    it('should accept different entity hint sources', () => {
      const sources: Array<EntityHint['source']> = ['user', 'llm', 'cached'];
      
      sources.forEach(source => {
        const hint: EntityHint = {
          type: EntityType.TOKEN,
          value: 'test-value',
          confidence: 0.8,
          source
        };
        expect(hint.source).toBe(source);
      });
    });
  });

  describe('ConversionRecord interface', () => {
    it('should track conversion operations', () => {
      const record: ConversionRecord = {
        originalValue: TEST_TOPIC_IDS.TOPIC_6624800,
        convertedValue: TEST_HRL_VALUES.HCS_1_6624800,
        sourceFormat: TEST_TOOL_RESOLUTIONS.TOPIC_ID,
        targetFormat: TEST_TOOL_RESOLUTIONS.HRL,
        converterUsed: 'TopicIdToHrlConverter',
        timestamp: new Date(),
        context: { networkType: TEST_FORMAT_TYPES.TESTNET }
      };

      expect(record.originalValue).toBe(TEST_TOPIC_IDS.TOPIC_6624800);
      expect(record.convertedValue).toBe(TEST_HRL_VALUES.HCS_1_6624800);
      expect(record.sourceFormat).toBe(TEST_TOOL_RESOLUTIONS.TOPIC_ID);
      expect(record.targetFormat).toBe(TEST_TOOL_RESOLUTIONS.HRL);
      expect(record.converterUsed).toBe('TopicIdToHrlConverter');
      expect(record.context).toEqual({ networkType: TEST_FORMAT_TYPES.TESTNET });
    });
  });
});

describe('ResolutionContextBuilder', () => {
  describe('fromMessage', () => {
    it('should create context from user message and session ID', () => {
      const context = ResolutionContextBuilder.fromMessage(
        'mint Forever #1 onto the token',
        'session-123'
      );

      expect(context.userMessage).toBe('mint Forever #1 onto the token');
      expect(context.sessionId).toBe('session-123');
      expect(context.entityHints).toHaveLength(0);
      expect(context.conversionHistory).toHaveLength(0);
      expect(context.networkType).toBe(TEST_FORMAT_TYPES.TESTNET);
    });

    it('should set default network type to testnet', () => {
      const context = ResolutionContextBuilder.fromMessage('test message', 'session-1');
      expect(context.networkType).toBe(TEST_FORMAT_TYPES.TESTNET);
    });
  });

  describe('withToolContext', () => {
    it('should add tool metadata to existing context', () => {
      const baseContext = ResolutionContextBuilder.fromMessage('test', 'session-1');
      
      const toolMetadata: ToolMetadata = {
        name: 'test-tool',
        version: TEST_METADATA_VALUES.VERSION_1_0_0,
        category: TEST_TOOL_CATEGORIES.CORE,
        description: 'Test tool',
        capabilities: {
          supportsFormValidation: false,
          requiresWrapper: false,
          priority: 'medium',
          category: TEST_TOOL_CATEGORIES.CORE
        },
        dependencies: [],
        schema: {},
        entityResolutionPreferences: {
          inscription: TEST_TOOL_RESOLUTIONS.HRL
        }
      };

      const contextWithTool = ResolutionContextBuilder.withToolContext(baseContext, toolMetadata);

      expect(contextWithTool.toolMetadata).toBe(toolMetadata);
      expect(contextWithTool.userMessage).toBe(baseContext.userMessage);
      expect(contextWithTool.sessionId).toBe(baseContext.sessionId);
    });

    it('should preserve original context properties', () => {
      const baseContext = ResolutionContextBuilder.fromMessage('original message', 'original-session');
      baseContext.networkType = 'mainnet';
      
      const toolMetadata: ToolMetadata = {
        name: 'tool',
        version: TEST_METADATA_VALUES.VERSION_1_0_0,
        category: TEST_TOOL_CATEGORIES.CORE,
        description: 'Tool',
        capabilities: {
          supportsFormValidation: false,
          requiresWrapper: false,
          priority: 'medium',
          category: TEST_TOOL_CATEGORIES.CORE
        },
        dependencies: [],
        schema: {}
      };

      const result = ResolutionContextBuilder.withToolContext(baseContext, toolMetadata);

      expect(result.userMessage).toBe('original message');
      expect(result.sessionId).toBe('original-session');
      expect(result.networkType).toBe('mainnet');
    });
  });

  describe('withEntityHints', () => {
    it('should add entity hints to existing context', () => {
      const baseContext = ResolutionContextBuilder.fromMessage('test', 'session-1');
      
      const hints: EntityHint[] = [
        {
          type: EntityType.TOPIC,
          value: TEST_TOPIC_IDS.TOPIC_123,
          confidence: 0.9,
          source: 'llm'
        },
        {
          type: EntityType.TOKEN,
          value: TEST_ACCOUNT_IDS.USER_ACCOUNT_456,
          confidence: 0.8,
          source: 'cached'
        }
      ];

      const contextWithHints = ResolutionContextBuilder.withEntityHints(baseContext, hints);

      expect(contextWithHints.entityHints).toHaveLength(2);
      expect(contextWithHints.entityHints[0]).toEqual(hints[0]);
      expect(contextWithHints.entityHints[1]).toEqual(hints[1]);
    });

    it('should preserve existing context properties', () => {
      const baseContext = ResolutionContextBuilder.fromMessage('message', 'session');
      const hints: EntityHint[] = [];

      const result = ResolutionContextBuilder.withEntityHints(baseContext, hints);

      expect(result.userMessage).toBe('message');
      expect(result.sessionId).toBe('session');
    });
  });

  describe('context chaining', () => {
    it('should support method chaining', () => {
      const toolMetadata: ToolMetadata = {
        name: 'chain-tool',
        version: TEST_METADATA_VALUES.VERSION_1_0_0,
        category: TEST_TOOL_CATEGORIES.CORE,
        description: 'Chaining test tool',
        capabilities: {
          supportsFormValidation: false,
          requiresWrapper: false,
          priority: 'medium',
          category: TEST_TOOL_CATEGORIES.CORE
        },
        dependencies: [],
        schema: {}
      };

      const hints: EntityHint[] = [
        {
          type: EntityType.TOPIC,
          value: '0.0.789',
          confidence: 0.85,
          source: 'user'
        }
      ];

      const baseContext = ResolutionContextBuilder.fromMessage('complex message', 'complex-session');
      const withTool = ResolutionContextBuilder.withToolContext(baseContext, toolMetadata);
      const context = ResolutionContextBuilder.withEntityHints(withTool, hints);

      expect(context.userMessage).toBe('complex message');
      expect(context.sessionId).toBe('complex-session');
      expect(context.toolMetadata?.name).toBe('chain-tool');
      expect(context.entityHints).toHaveLength(1);
      expect(context.entityHints[0].value).toBe('0.0.789');
    });
  });

  describe('immutability', () => {
    it('should not mutate the original context when adding tool metadata', () => {
      const original = ResolutionContextBuilder.fromMessage('original', 'session');
      const originalHints = [...original.entityHints];
      
      const toolMetadata: ToolMetadata = {
        name: 'test-tool',
        version: TEST_METADATA_VALUES.VERSION_1_0_0,
        category: TEST_TOOL_CATEGORIES.CORE,
        description: 'Test',
        capabilities: {
          supportsFormValidation: false,
          requiresWrapper: false,
          priority: 'medium',
          category: TEST_TOOL_CATEGORIES.CORE
        },
        dependencies: [],
        schema: {}
      };

      const modified = ResolutionContextBuilder.withToolContext(original, toolMetadata);

      expect(original.toolMetadata).toBeUndefined();
      expect(original.entityHints).toEqual(originalHints);
      expect(modified.toolMetadata).toBe(toolMetadata);
    });

    it('should not mutate the original context when adding entity hints', () => {
      const original = ResolutionContextBuilder.fromMessage('original', 'session');
      const originalHintsLength = original.entityHints.length;
      
      const hints: EntityHint[] = [
        {
          type: EntityType.TOPIC,
          value: 'test',
          confidence: 0.5,
          source: 'llm'
        }
      ];

      const modified = ResolutionContextBuilder.withEntityHints(original, hints);

      expect(original.entityHints).toHaveLength(originalHintsLength);
      expect(modified.entityHints).toHaveLength(hints.length);
    });
  });
});