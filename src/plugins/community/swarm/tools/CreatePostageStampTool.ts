import {
  BaseHederaQueryTool,
  HederaAgentKit,
  type GenericPluginContext,
} from "hedera-agent-kit";
import { BatchId, Bee, Duration, Size } from "@ethersphere/bee-js";
import { z } from "zod";
import {
  errorHasStatus,
  getErrorMessage,
  makeDate,
  runWithTimeout,
  ToolResponse,
} from "../utils";
import { BAD_REQUEST_STATUS, CALL_TIMEOUT, GATEWAY_STAMP_ERROR_MESSAGE, NOT_FOUND_STATUS, POSTAGE_CREATE_TIMEOUT_MESSAGE } from "../constants";
import { SwarmConfig } from "../config";

const CreatePostageStampSchema = z.object({
  size: z.number(),
  duration: z.string(),
  label: z.string().optional(),
});

export class CreatePostageStampTool extends BaseHederaQueryTool<typeof CreatePostageStampSchema> {
  name = "swarm-create-postage-stamp";
  description = `
    Buy postage stamp based on size in megabytes and duration.
    size: The storage size in MB (Megabytes). These other size units convert like this to MB: 1 byte = 0.000001 MB, 1  KB = 0.001 MB, 1GB= 1000MB.
    duration: Duration for which the data should be stored. Time to live of the postage stamp, e.g. 1d - 1 day, 1w - 1 week, 1month - 1 month.
    label: Sets label for the postage batch (omit if the user didn't ask for one). Do not set a label with with specific capacity values because they can get misleading.
  `;
  namespace = "swarm";
  specificInputSchema = CreatePostageStampSchema;
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
      input: z.infer<typeof CreatePostageStampSchema>
  ): Promise<ToolResponse | string> {
    const { size, duration, label } = input;

    if (!size) {
      this.logger.error(
        'Missing required parameter: size.'
      );
      
      throw new Error('Missing required parameter: size.');
    } else if (!duration) {
      this.logger.error(
        'Missing required parameter: duration.'
      );
      
      throw new Error('Missing required parameter: duration.');
    }

    let durationMs;

    try {
      durationMs = makeDate(duration);
    } catch (makeDateError) {
      this.logger.error(
        'Invalid parameter: duration.'
      );

      throw new Error('Invalid parameter: duration.');
    }

    let buyStorageResponse: BatchId;

    try {
      let options = {};
      if (label !== undefined) {
        options = {
          label
        };
      }
      const buyStoragePromise = this.bee.buyStorage(
        Size.fromMegabytes(size),
        Duration.fromMilliseconds(durationMs),
        options
      );
      const [response, hasTimedOut] = await runWithTimeout(
        buyStoragePromise,
        CALL_TIMEOUT
      );

      if (hasTimedOut) {
        return JSON.stringify({
          content: [
            {
              type: 'text',
              text: POSTAGE_CREATE_TIMEOUT_MESSAGE,
            },
          ],
        });
      }

      buyStorageResponse = response as BatchId;
    } catch (error) {
      let errorMessage = 'Unable to buy storage.';

      if (errorHasStatus(error, NOT_FOUND_STATUS)) {
        errorMessage = GATEWAY_STAMP_ERROR_MESSAGE;
      } else if (errorHasStatus(error, BAD_REQUEST_STATUS)) {
        errorMessage = getErrorMessage(error);
      }

      this.logger.error(
        errorMessage,
        error
      );

      throw new Error(errorMessage);
    }

    return {
      content: [
        {
          type: 'text',
          text: `Postage batch ID: ${buyStorageResponse.toHex()}`,
        },
      ],
    };
  }
}
