/**
 * @jest-environment node
 */

jest.mock('@hashgraphonline/standards-sdk', () => ({
  HederaMirrorNode: jest.fn().mockImplementation(() => ({
    getAccountBalance: jest.fn().mockResolvedValue(null),
    getTokenInfo: jest.fn().mockResolvedValue(null),
    getTopicInfo: jest.fn().mockImplementation((entity: string) => {
      if (/^0\.0\.\d+$/.test(entity)) {
        return Promise.resolve({ topicId: entity });
      }
      return Promise.resolve(null);
    }),
    getContract: jest.fn().mockResolvedValue(null)
  })),
  Logger: jest.fn().mockImplementation(() => ({
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn()
  }))
}));

import { ResolutionPipeline } from '../../../src/services/resolution/resolution-pipeline';
import { FormatConverterRegistry, TopicIdToHrlConverter } from '../../../src/services/formatters';
import { ResolutionContextBuilder } from '../../../src/services/context/resolution-context';
import {
  TEST_ACCOUNT_IDS,
  TEST_CONTEXT_STRINGS,
  TEST_TOPIC_IDS,
  TEST_HRL_VALUES,
  TEST_TOOL_NAMES,
  TEST_TOOL_CATEGORIES,
  TEST_TOOL_RESOLUTIONS,
  TEST_METADATA_VALUES,
  TEST_FORMAT_TYPES
} from '../../test-constants';

interface EntityAssociation {
  entityId: string;
  entityName: string;
  entityType: string;
  transactionId?: string;
}

/**
 * Mock AgentService for testing the new resolution system
 */
class MockAgentService {
  private resolutionPipeline: ResolutionPipeline;
  private formatConverterRegistry: FormatConverterRegistry;
  
  constructor() {
    this.resolutionPipeline = new ResolutionPipeline();
    this.formatConverterRegistry = new FormatConverterRegistry();
    
    this.setupPipeline();
  }
  
  private setupPipeline(): void {
    this.formatConverterRegistry.register(new TopicIdToHrlConverter());
  }
  
  /**
   * New resolution method that replaces the old keyword-based system
   */
  async resolveEntityReferences(
    userMessage: string, 
    entities: EntityAssociation[],
    sessionId: string = TEST_CONTEXT_STRINGS.TEST_SESSION,
    toolContext?: { entityResolutionPreferences?: { inscription?: string } }
  ): Promise<string> {
    const context = ResolutionContextBuilder.fromMessage(userMessage, sessionId);
    
    if (toolContext) {
      const mockTool = {
        name: TEST_TOOL_NAMES.TEST_TOOL,
        version: TEST_METADATA_VALUES.VERSION_1_0_0,
        category: TEST_TOOL_CATEGORIES.CORE as const,
        description: TEST_METADATA_VALUES.TEST_DESCRIPTION,
        capabilities: {
          supportsFormValidation: false,
          requiresWrapper: false,
          priority: 'medium' as const,
          category: TEST_TOOL_CATEGORIES.CORE as const
        },
        dependencies: [],
        schema: {},
        entityResolutionPreferences: toolContext.entityResolutionPreferences
      };
      context.toolMetadata = mockTool;
    }
    
    let resolvedMessage = userMessage;
    
    for (const entity of entities) {
      if (entity.entityType === 'topic' && toolContext?.entityResolutionPreferences?.inscription === TEST_TOOL_RESOLUTIONS.HRL) {
        try {
          const convertedValue = await this.formatConverterRegistry.convertEntity(
            entity.entityId,
            TEST_TOOL_RESOLUTIONS.HRL as any,
            { networkType: TEST_FORMAT_TYPES.TESTNET }
          );
          resolvedMessage = resolvedMessage.replace(entity.entityId, convertedValue);
        } catch (error) {
          console.warn(`Failed to convert ${entity.entityId} to HRL:`, error);
        }
      }
    }
    
    return resolvedMessage;
  }
  
  /**
   * Legacy method for comparison - this is what we're replacing
   */
  async resolveEntityReferencesLegacy(userMessage: string, entities: EntityAssociation[]): Promise<string> {
    const isMintingContext = userMessage.toLowerCase().includes('mint') && 
      (userMessage.toLowerCase().includes('nft') || 
       userMessage.toLowerCase().includes('hashinal') ||
       userMessage.toLowerCase().includes('forever') ||
       userMessage.toLowerCase().includes('token'));

    if (isMintingContext) {
      return this.convertTopicIdsToHRL(userMessage, entities);
    }
    
    return userMessage;
  }
  
  private convertTopicIdsToHRL(message: string, entities: EntityAssociation[]): string {
    let convertedMessage = message;
    
    const topicEntities = entities.filter(e => e.entityType === 'topic');
    
    for (const entity of topicEntities) {
      const topicIdPattern = new RegExp(`\\b${entity.entityId}\\b`, 'g');
      if (convertedMessage.match(topicIdPattern)) {
        const hrl = `${TEST_FORMAT_TYPES.HCS_PREFIX_1}${entity.entityId}`;
        convertedMessage = convertedMessage.replace(topicIdPattern, hrl);
      }
    }
    
    return convertedMessage;
  }
}

describe('AgentService Resolution Integration', () => {
  let agentService: MockAgentService;
  
  beforeEach(() => {
    agentService = new MockAgentService();
  });

  describe('new context-aware resolution system', () => {
    it('should convert topic ID to HRL when tool requires it', async () => {
      const entities: EntityAssociation[] = [
        {
          entityId: TEST_TOPIC_IDS.TOPIC_6624800,
          entityName: TEST_CONTEXT_STRINGS.FOREVER_1,
          entityType: 'topic'
        }
      ];
      
      const toolContext = {
        entityResolutionPreferences: {
          inscription: TEST_TOOL_RESOLUTIONS.HRL
        }
      };
      
      const result = await agentService.resolveEntityReferences(
        `mint the inscription ${TEST_TOPIC_IDS.TOPIC_6624800}`,
        entities,
        TEST_CONTEXT_STRINGS.TEST_SESSION,
        toolContext
      );
      
      expect(result).toBe(`mint the inscription ${TEST_HRL_VALUES.HCS_1_6624800}`);
    });

    it('should NOT convert topic ID when tool does not require HRL format', async () => {
      const entities: EntityAssociation[] = [
        {
          entityId: TEST_TOPIC_IDS.TOPIC_6624800,
          entityName: TEST_CONTEXT_STRINGS.FOREVER_1,
          entityType: 'topic'
        }
      ];
      
      const toolContext = {
        entityResolutionPreferences: {
          inscription: TEST_TOOL_RESOLUTIONS.TOPIC_ID
        }
      };
      
      const result = await agentService.resolveEntityReferences(
        'get info about topic 0.0.6624800',
        entities,
        TEST_CONTEXT_STRINGS.TEST_SESSION,
        toolContext
      );
      
      expect(result).toBe('get info about topic 0.0.6624800');
    });

    it('should NOT convert when no tool context provided', async () => {
      const entities: EntityAssociation[] = [
        {
          entityId: TEST_TOPIC_IDS.TOPIC_6624800,
          entityName: TEST_CONTEXT_STRINGS.FOREVER_1,
          entityType: 'topic'
        }
      ];
      
      const result = await agentService.resolveEntityReferences(
        'mint Forever #1 with 0.0.6624800',
        entities,
        'test-session'
      );
      
      expect(result).toBe('mint Forever #1 with 0.0.6624800');
    });

    it('should handle multiple topic IDs correctly', async () => {
      const entities: EntityAssociation[] = [
        {
          entityId: TEST_TOPIC_IDS.TOPIC_6624800,
          entityName: TEST_CONTEXT_STRINGS.FOREVER_1,
          entityType: 'topic'
        },
        {
          entityId: TEST_TOPIC_IDS.TOPIC_6624801,
          entityName: TEST_CONTEXT_STRINGS.FOREVER_2,
          entityType: 'topic'
        }
      ];
      
      const toolContext = {
        entityResolutionPreferences: {
          inscription: TEST_TOOL_RESOLUTIONS.HRL
        }
      };
      
      const result = await agentService.resolveEntityReferences(
        'mint 0.0.6624800 and 0.0.6624801',
        entities,
        TEST_CONTEXT_STRINGS.TEST_SESSION,
        toolContext
      );
      
      expect(result).toBe(`mint ${TEST_HRL_VALUES.HCS_1_6624800} and ${TEST_HRL_VALUES.HCS_1_6624801}`);
    });

    it('should ignore non-topic entities', async () => {
      const entities: EntityAssociation[] = [
        {
          entityId: TEST_TOPIC_IDS.TOPIC_123456,
          entityName: TEST_CONTEXT_STRINGS.MY_TOKEN,
          entityType: 'token'
        },
        {
          entityId: TEST_TOPIC_IDS.TOPIC_6624800,
          entityName: TEST_CONTEXT_STRINGS.FOREVER_1,
          entityType: 'topic'
        }
      ];
      
      const toolContext = {
        entityResolutionPreferences: {
          inscription: TEST_TOOL_RESOLUTIONS.HRL
        }
      };
      
      const result = await agentService.resolveEntityReferences(
        'mint 0.0.6624800 onto token 0.0.123456',
        entities,
        TEST_CONTEXT_STRINGS.TEST_SESSION,
        toolContext
      );
      
      expect(result).toBe(`mint ${TEST_HRL_VALUES.HCS_1_6624800} onto token ${TEST_TOPIC_IDS.TOPIC_123456}`);
    });
  });

  describe('comparison with legacy system', () => {
    it('should produce same result as legacy for minting context', async () => {
      const entities: EntityAssociation[] = [
        {
          entityId: TEST_TOPIC_IDS.TOPIC_6624800,
          entityName: TEST_CONTEXT_STRINGS.FOREVER_1,
          entityType: 'topic'
        }
      ];
      
      const message = 'mint Forever #1 with 0.0.6624800';
      
      const legacyResult = await agentService.resolveEntityReferencesLegacy(message, entities);
      
      const toolContext = {
        entityResolutionPreferences: {
          inscription: TEST_TOOL_RESOLUTIONS.HRL
        }
      };
      const newResult = await agentService.resolveEntityReferences(
        message, 
        entities,
        TEST_CONTEXT_STRINGS.TEST_SESSION, 
        toolContext
      );
      
      expect(newResult).toBe(legacyResult);
      expect(newResult).toBe(`mint ${TEST_CONTEXT_STRINGS.FOREVER_1} with ${TEST_HRL_VALUES.HCS_1_6624800}`);
    });

    it('should NOT convert when legacy would not convert', async () => {
      const entities: EntityAssociation[] = [
        {
          entityId: TEST_TOPIC_IDS.TOPIC_6624800,
          entityName: TEST_CONTEXT_STRINGS.FOREVER_1,
          entityType: 'topic'
        }
      ];
      
      const message = 'get info about 0.0.6624800';
      
      const legacyResult = await agentService.resolveEntityReferencesLegacy(message, entities);
      const newResult = await agentService.resolveEntityReferences(
        message,
        entities,
        'test-session'
      );
      
      expect(legacyResult).toBe('get info about 0.0.6624800');
      expect(newResult).toBe('get info about 0.0.6624800');
    });
  });

  describe('edge cases and error handling', () => {
    it('should handle empty entities array', async () => {
      const result = await agentService.resolveEntityReferences(
        'mint some NFT',
        [],
        TEST_CONTEXT_STRINGS.TEST_SESSION,
        { entityResolutionPreferences: { inscription: TEST_TOOL_RESOLUTIONS.HRL } }
      );
      
      expect(result).toBe('mint some NFT');
    });

    it('should handle malformed topic IDs gracefully', async () => {
      const entities: EntityAssociation[] = [
        {
          entityId: 'invalid-id',
          entityName: 'Invalid',
          entityType: 'topic'
        }
      ];
      
      const result = await agentService.resolveEntityReferences(
        'mint invalid-id',
        entities,
        TEST_CONTEXT_STRINGS.TEST_SESSION,
        { entityResolutionPreferences: { inscription: TEST_TOOL_RESOLUTIONS.HRL } }
      );
      
      expect(result).toBe('mint invalid-id');
    });

    it('should handle missing entityResolutionPreferences', async () => {
      const entities: EntityAssociation[] = [
        {
          entityId: TEST_TOPIC_IDS.TOPIC_6624800,
          entityName: TEST_CONTEXT_STRINGS.FOREVER_1,
          entityType: 'topic'
        }
      ];
      
      const result = await agentService.resolveEntityReferences(
        'mint 0.0.6624800',
        entities,
        TEST_CONTEXT_STRINGS.TEST_SESSION,
        {}
      );
      
      expect(result).toBe('mint 0.0.6624800');
    });
  });

  describe('performance considerations', () => {
    it('should handle large entity lists efficiently', async () => {
      const entities: EntityAssociation[] = [];
      for (let i = 0; i < 100; i++) {
        entities.push({
          entityId: `0.0.${i}`,
          entityName: `Entity ${i}`,
          entityType: 'topic'
        });
      }
      
      let message = 'mint ';
      entities.forEach(e => {
        message += `${e.entityId} `;
      });
      
      const startTime = Date.now();
      const result = await agentService.resolveEntityReferences(
        message,
        entities,
        TEST_CONTEXT_STRINGS.TEST_SESSION,
        { entityResolutionPreferences: { inscription: TEST_TOOL_RESOLUTIONS.HRL } }
      );
      const endTime = Date.now();
      
      expect(endTime - startTime).toBeLessThan(1000);
      expect(result).toContain(`${TEST_FORMAT_TYPES.HCS_PREFIX_1}0.0.0`);
      expect(result).toContain(`${TEST_FORMAT_TYPES.HCS_PREFIX_1}0.0.99`);
    });
  });
});