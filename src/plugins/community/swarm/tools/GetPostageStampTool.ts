import {
  type GenericPluginContext,
  BaseHederaQueryTool,
  type HederaAgentKit,
} from "hedera-agent-kit";
import { Bee } from "@ethersphere/bee-js";
import { z } from "zod";
import {
  PostageBatchCurated,
  PostageBatchSummary,
  ResponseContent,
} from "../model";
import {
  errorHasStatus,
  getBatchSummary,
  getResponseWithStructuredContent,
  ToolResponse,
} from "../utils";
import { GATEWAY_STAMP_ERROR_MESSAGE, NOT_FOUND_STATUS } from "../constants";
import { SwarmConfig } from "../config";

const GetPostageStampSchema = z.object({
  postageBatchId: z.string(),
});

export class GetPostageStampTool extends BaseHederaQueryTool<typeof GetPostageStampSchema> {
  name = "swarm-get-postage-stamp";
  description = `Get a specific postage stamp based on postageBatchId.
    postageBatchId: The id of the stamp which is requested.
  `;
  namespace = "swarm";
  specificInputSchema = GetPostageStampSchema;
  bee: Bee;
  config: SwarmConfig;
      
  constructor(params: {
    hederaKit: HederaAgentKit;
    config: SwarmConfig;
    logger?: GenericPluginContext['logger'];
    bee: Bee;
  }) {
    const { bee, config, ...rest } = params;
    super(rest);
    this.bee = bee;
    this.config = config;
  }

  protected async executeQuery(
      input: z.infer<typeof GetPostageStampSchema>
  ): Promise<ToolResponse | string> {
    const { postageBatchId } = input;
    if (!postageBatchId) {
      this.logger.error(
        'Missing required parameter: postageBatchId.'
      );

      throw new Error("Missing required parameter: postageBatchId.");
    }

    let rawPostageBatch;

    try {
      rawPostageBatch = await this.bee.getPostageBatch(postageBatchId);
    } catch (error) {
      let errorMessage = 'Retrieval of postage batch failed.';
    
      if (errorHasStatus(error, NOT_FOUND_STATUS)) {
        errorMessage = GATEWAY_STAMP_ERROR_MESSAGE;
      }

      this.logger.error(
        errorMessage,
        error
      );

      throw new Error(errorMessage);
    }

    const batch: PostageBatchCurated = {
      ...rawPostageBatch,
      batchID: rawPostageBatch.batchID.toHex(),
    };
    const batchSummary: PostageBatchSummary = getBatchSummary(rawPostageBatch);

    const content: ResponseContent<PostageBatchCurated, PostageBatchSummary> = {
      raw: batch,
      summary: batchSummary,
    };

    return getResponseWithStructuredContent(content);
  }
}
