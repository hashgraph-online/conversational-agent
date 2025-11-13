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

const ListPostageStampsSchema = z.object({
  leastUsed: z.boolean().optional(),
  limit: z.number().optional(),
  minUsage: z.number().optional(),
  maxUsage: z.number().optional(),
});

export class ListPostageStampsTool extends BaseHederaQueryTool<typeof ListPostageStampsSchema> {
  name = "swarm-list-postage-stamps";
  description =`
    List the available postage stamps.
    leastUsed: A boolean value that tells if stamps are sorted so least used comes first.
    limit: Limit is the maximum number of returned stamps.
    minUsage: Only list stamps with at least this usage percentage.
    maxUsage: Only list stamps with at most this usage percentage.  
  `;
  namespace = "swarm";
  specificInputSchema = ListPostageStampsSchema;
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
      input: z.infer<typeof ListPostageStampsSchema>
  ): Promise<ToolResponse | string> {
    const { leastUsed, limit, minUsage, maxUsage } = input;

    let rawPostageBatches;

    try {
      rawPostageBatches = await this.bee.getPostageBatches();
    } catch (error) {
      let errorMessage = 'Retrieval of postage batches failed.';

      if (errorHasStatus(error, NOT_FOUND_STATUS)) {
        errorMessage = GATEWAY_STAMP_ERROR_MESSAGE;
      }
    
      this.logger.error(
        errorMessage,
        error
      );
    
      throw new Error(errorMessage);
    }

    const batches: PostageBatchCurated[] = rawPostageBatches.map((batch) => ({
      ...batch,
      batchID: batch.batchID.toHex(),
    }));
    let filteredPostageBatches = batches.filter((batch) => {
      if (!batch.usable) {
        return false;
      }

      const usagePercentage = batch.usage * 100;

      if (minUsage !== undefined && usagePercentage < minUsage) {
        return false;
      }

      if (maxUsage !== undefined && usagePercentage > maxUsage) {
        return false;
      }

      return true;
    });

    if (Boolean(leastUsed) && filteredPostageBatches.length) {
      filteredPostageBatches = filteredPostageBatches.sort(
        (batch1, batch2) => batch1.usage - batch2.usage
      );
    }

    if (limit !== undefined && limit < filteredPostageBatches.length) {
      filteredPostageBatches = filteredPostageBatches.slice(0, limit);
    }

    const computedPostageBatches: PostageBatchSummary[] =
      filteredPostageBatches.map((batch) => getBatchSummary(batch));

    const content: ResponseContent<
      PostageBatchCurated[],
      PostageBatchSummary[]
    > = {
      raw: filteredPostageBatches,
      summary: computedPostageBatches,
    };

    return getResponseWithStructuredContent(content);
  }
}
