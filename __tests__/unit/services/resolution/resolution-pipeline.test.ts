/**
 * @jest-environment node
 */

import { ResolutionPipeline, ResolutionStage, ResolvedMessage, DetectedEntity } from '../../../../src/services/resolution/resolution-pipeline';
import { ResolutionContext, EntityType } from '../../../../src/services/context/resolution-context';
import {
  TEST_CONTEXT_STRINGS,
  TEST_TOOL_NAMES,
  TEST_METADATA_VALUES,
  TEST_TOOL_CATEGORIES,
  TEST_TOOL_RESOLUTIONS,
  TEST_TOPIC_IDS,
  TEST_HRL_VALUES,
  TEST_FORMAT_TYPES
} from '../../../test-constants';

interface MockStageInput {
  message: string;
  entities?: DetectedEntity[];
}

interface MockStageOutput {
  processedMessage: string;
  entities?: DetectedEntity[];
  metadata?: Record<string, unknown>;
}

class MockResolutionStage implements ResolutionStage<MockStageInput, MockStageOutput> {
  name = 'mock-stage';
  
  async process(input: MockStageInput, context: ResolutionContext): Promise<MockStageOutput> {
    return {
      processedMessage: `${input.message}-processed-by-${this.name}`,
      entities: input.entities || [],
      metadata: { stageName: this.name }
    };
  }
}

class EntityDetectionStage implements ResolutionStage<string, DetectedEntity[]> {
  name = 'entity-detection';
  
  async process(message: string, context: ResolutionContext): Promise<DetectedEntity[]> {
    const entities: DetectedEntity[] = [];
    
    if (message.includes('0.0.')) {
      const matches = message.match(/0\.0\.\d+/g);
      if (matches) {
        matches.forEach(match => {
          entities.push({
            type: EntityType.TOPIC,
            value: match,
            originalText: match,
            confidence: 0.9,
            position: message.indexOf(match)
          });
        });
      }
    }
    
    return entities;
  }
}

class FormatConversionStage implements ResolutionStage<DetectedEntity[], ResolvedMessage> {
  name = 'format-conversion';
  
  async process(entities: DetectedEntity[], context: ResolutionContext): Promise<ResolvedMessage> {
    let message = context.userMessage;
    const conversions: Array<{ original: string; converted: string }> = [];
    
    for (const entity of entities) {
      if (entity.type === EntityType.TOPIC && context.toolMetadata?.entityResolutionPreferences?.inscription === TEST_TOOL_RESOLUTIONS.HRL) {
        const converted = `hcs://1/${entity.value}`;
        message = message.replace(entity.value, converted);
        conversions.push({ original: entity.value, converted });
      }
    }
    
    return {
      message,
      entities,
      conversions,
      context
    };
  }
}

describe('ResolutionPipeline', () => {
  let pipeline: ResolutionPipeline;
  
  beforeEach(() => {
    pipeline = new ResolutionPipeline();
  });

  describe('stage management', () => {
    it('should register a single stage', () => {
      const stage = new MockResolutionStage();
      
      expect(() => {
        pipeline.addStage(stage);
      }).not.toThrow();
    });

    it('should register multiple stages in order', () => {
      const stage1 = new MockResolutionStage();
      stage1.name = 'stage-1';
      const stage2 = new MockResolutionStage();
      stage2.name = 'stage-2';
      
      pipeline.addStage(stage1);
      pipeline.addStage(stage2);
      
      expect(pipeline.getStages()).toHaveLength(2);
      expect(pipeline.getStages()[0].name).toBe('stage-1');
      expect(pipeline.getStages()[1].name).toBe('stage-2');
    });

    it('should clear all stages', () => {
      pipeline.addStage(new MockResolutionStage());
      pipeline.addStage(new MockResolutionStage());
      
      expect(pipeline.getStages()).toHaveLength(2);
      
      pipeline.clear();
      expect(pipeline.getStages()).toHaveLength(0);
    });
  });

  describe('pipeline execution', () => {
    it('should execute empty pipeline', async () => {
      const context: ResolutionContext = {
        userMessage: TEST_CONTEXT_STRINGS.TEST_MESSAGE,
        sessionId: TEST_CONTEXT_STRINGS.TEST_SESSION,
        entityHints: [],
        networkType: TEST_FORMAT_TYPES.TESTNET,
        conversionHistory: []
      };
      
      const result = await pipeline.process(TEST_CONTEXT_STRINGS.TEST_MESSAGE, context);
      
      expect(result.message).toBe(TEST_CONTEXT_STRINGS.TEST_MESSAGE);
      expect(result.entities).toHaveLength(0);
      expect(result.conversions).toHaveLength(0);
    });

    it('should execute single stage pipeline', async () => {
      const entityStage = new EntityDetectionStage();
      pipeline.addStage(entityStage);
      
      const context: ResolutionContext = {
        userMessage: `mint topic ${TEST_TOPIC_IDS.TOPIC_6624800}`,
        sessionId: TEST_CONTEXT_STRINGS.TEST_SESSION,
        entityHints: [],
        networkType: TEST_FORMAT_TYPES.TESTNET,
        conversionHistory: []
      };
      
      const result = await pipeline.process(`mint topic ${TEST_TOPIC_IDS.TOPIC_6624800}`, context);
      
      expect(result.entities).toHaveLength(1);
      expect(result.entities[0].value).toBe(TEST_TOPIC_IDS.TOPIC_6624800);
      expect(result.entities[0].type).toBe(EntityType.TOPIC);
    });

    it('should execute multi-stage pipeline with context propagation', async () => {
      const entityStage = new EntityDetectionStage();
      const conversionStage = new FormatConversionStage();
      
      pipeline.addStage(entityStage);
      pipeline.addStage(conversionStage);
      
      const context: ResolutionContext = {
        userMessage: `mint topic ${TEST_TOPIC_IDS.TOPIC_6624800}`,
        sessionId: TEST_CONTEXT_STRINGS.TEST_SESSION,
        entityHints: [],
        networkType: TEST_FORMAT_TYPES.TESTNET,
        conversionHistory: [],
        toolMetadata: {
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
            inscription: TEST_TOOL_RESOLUTIONS.HRL
          }
        }
      };
      
      const result = await pipeline.process(`mint topic ${TEST_TOPIC_IDS.TOPIC_6624800}`, context);
      
      expect(result.message).toBe('mint topic hcs://1/0.0.6624800');
      expect(result.entities).toHaveLength(1);
      expect(result.conversions).toHaveLength(1);
      expect(result.conversions[0]).toEqual({
        original: TEST_TOPIC_IDS.TOPIC_6624800,
        converted: TEST_HRL_VALUES.HCS_1_6624800
      });
    });
  });

  describe('error handling', () => {
    it('should handle stage execution errors gracefully', async () => {
      const failingStage: ResolutionStage<string, string> = {
        name: TEST_TOOL_NAMES.FAILING_STAGE,
        async process() {
          throw new Error('Stage processing failed');
        }
      };
      
      pipeline.addStage(failingStage);
      
      const context: ResolutionContext = {
        userMessage: TEST_CONTEXT_STRINGS.TEST_MESSAGE,
        sessionId: TEST_CONTEXT_STRINGS.TEST_SESSION,
        entityHints: [],
        networkType: TEST_FORMAT_TYPES.TESTNET,
        conversionHistory: []
      };
      
      await expect(pipeline.process('test', context)).rejects.toThrow('Stage processing failed');
    });

    it('should provide meaningful error context', async () => {
      const failingStage: ResolutionStage<string, string> = {
        name: 'specific-failing-stage',
        async process() {
          throw new Error('Specific error message');
        }
      };
      
      pipeline.addStage(failingStage);
      
      const context: ResolutionContext = {
        userMessage: TEST_CONTEXT_STRINGS.TEST_MESSAGE,
        sessionId: TEST_CONTEXT_STRINGS.TEST_SESSION,
        entityHints: [],
        networkType: TEST_FORMAT_TYPES.TESTNET,
        conversionHistory: []
      };
      
      try {
        await pipeline.process('test', context);
        fail('Expected error to be thrown');
      } catch (error) {
        expect((error as Error).message).toContain('Specific error message');
      }
    });
  });

  describe('stage interface compliance', () => {
    it('should require stages to have a name', () => {
      const stage: ResolutionStage<string, string> = {
        name: 'test-stage',
        async process(input: string) {
          return input;
        }
      };
      
      expect(stage.name).toBe('test-stage');
    });

    it('should require stages to implement process method', async () => {
      const stage: ResolutionStage<string, string> = {
        name: 'process-test',
        async process(input: string, context: ResolutionContext) {
          expect(input).toBeDefined();
          expect(context).toBeDefined();
          return input.toUpperCase();
        }
      };
      
      pipeline.addStage(stage);
      
      const context: ResolutionContext = {
        userMessage: 'test',
        sessionId: 'session',
        entityHints: [],
        networkType: TEST_FORMAT_TYPES.TESTNET,
        conversionHistory: []
      };
      
      const result = await pipeline.process('test', context);
      expect(result.message).toBe('TEST');
    });
  });

  describe('performance and scalability', () => {
    it('should handle pipelines with many stages efficiently', async () => {
      for (let i = 0; i < 10; i++) {
        const stage: ResolutionStage<string, string> = {
          name: `stage-${i}`,
          async process(input: string) {
            return `${input}-${i}`;
          }
        };
        pipeline.addStage(stage);
      }
      
      const context: ResolutionContext = {
        userMessage: 'start',
        sessionId: 'perf-test',
        entityHints: [],
        networkType: TEST_FORMAT_TYPES.TESTNET,
        conversionHistory: []
      };
      
      const startTime = Date.now();
      const result = await pipeline.process('start', context);
      const endTime = Date.now();
      
      expect(result.message).toBe('start-0-1-2-3-4-5-6-7-8-9');
      expect(endTime - startTime).toBeLessThan(100);
    });
  });

  describe('stage result handling', () => {
    it('should handle non-string result from stage that is not entity-detection or format-conversion', async () => {
      const objectStage: ResolutionStage<string, { data: string }> = {
        name: 'custom-object-stage',
        async process(input: string) {
          return { data: `processed-${input}` };
        }
      };

      const finalStage: ResolutionStage<{ data: string }, string> = {
        name: 'final-stage',
        async process(input: { data: string }) {
          return `final-${input.data}`;
        }
      };

      pipeline.addStage(objectStage);
      pipeline.addStage(finalStage);
      
      const context: ResolutionContext = {
        userMessage: 'test',
        sessionId: 'object-test',
        entityHints: [],
        networkType: TEST_FORMAT_TYPES.TESTNET,
        conversionHistory: []
      };
      
      const result = await pipeline.process('test', context);
      
      expect(result.message).toBe('final-processed-test');
      expect(result.entities).toEqual([]);
      expect(result.conversions).toEqual([]);
    });
  });
});