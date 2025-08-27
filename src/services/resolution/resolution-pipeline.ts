import { ResolutionContext, EntityType } from '../context/resolution-context';

export interface DetectedEntity {
  type: EntityType;
  value: string;
  originalText: string;
  confidence: number;
  position: number;
}

export interface ResolvedMessage {
  message: string;
  entities: DetectedEntity[];
  conversions: Array<{ original: string; converted: string }>;
  context: ResolutionContext;
}

export interface ResolutionStage<TInput = unknown, TOutput = unknown> {
  name: string;
  process(input: TInput, context: ResolutionContext): Promise<TOutput>;
}

/**
 * Multi-stage resolution pipeline that processes messages through configurable stages
 */
export class ResolutionPipeline {
  private stages: ResolutionStage<unknown, unknown>[] = [];

  /**
   * Add a stage to the pipeline
   */
  addStage<TInput, TOutput>(stage: ResolutionStage<TInput, TOutput>): void {
    this.stages.push(stage as ResolutionStage<unknown, unknown>);
  }

  /**
   * Get all registered stages
   */
  getStages(): ResolutionStage<unknown, unknown>[] {
    return [...this.stages];
  }

  /**
   * Clear all stages from the pipeline
   */
  clear(): void {
    this.stages = [];
  }

  /**
   * Process a message through all pipeline stages
   */
  async process(
    message: string,
    context: ResolutionContext
  ): Promise<ResolvedMessage> {
    if (this.stages.length === 0) {
      return {
        message,
        entities: [],
        conversions: [],
        context,
      };
    }

    let currentInput: unknown = message;
    let entities: DetectedEntity[] = [];
    const conversions: Array<{ original: string; converted: string }> = [];

    for (const stage of this.stages) {
      try {
        const result = await stage.process(currentInput, context);

        if (stage.name === 'entity-detection') {
          entities = result as DetectedEntity[];
          currentInput = entities;
        } else if (stage.name === 'format-conversion') {
          const resolvedMessage = result as ResolvedMessage;
          return {
            message: resolvedMessage.message,
            entities: resolvedMessage.entities,
            conversions: resolvedMessage.conversions,
            context,
          };
        } else {
          if (typeof result === 'string') {
            currentInput = result;
          } else {
            currentInput = result;
          }
        }
      } catch (error) {
        throw new Error(
          `Stage ${stage.name} failed: ${(error as Error).message}`
        );
      }
    }

    return {
      message: typeof currentInput === 'string' ? currentInput : message,
      entities,
      conversions,
      context,
    };
  }
}
