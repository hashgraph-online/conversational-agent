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
  getResponseWithStructuredContent,
  makeDate,
  ToolResponse,
} from "../utils";
import { BAD_REQUEST_STATUS, GATEWAY_STAMP_ERROR_MESSAGE, NOT_FOUND_STATUS } from "../constants";
import { SwarmConfig } from "../config";

const ExtendPostageStampSchema = z.object({
  postageBatchId: z.string(),
  duration: z.string().optional(),
  size: z.number().optional(),
});

export class ExtendPostageStampTool extends BaseHederaQueryTool<typeof ExtendPostageStampSchema> {
  name = "swarm-extend-postage-stamp";
  description = `Increase the duration (relative to current duration) or size (in megabytes) of a postage stamp.
    postageBatchId: The id of the batch for which extend is performed.
    size: The storage size in MB (Megabytes). These other size units convert like this to MB: 1 byte = 0.000001 MB, 1  KB = 0.001 MB, 1GB= 1000MB.
    duration: Duration for which the data should be stored. Time to live of the postage stamp, e.g. 1d - 1 day, 1w - 1 week, 1month - 1 month.
  `;
  namespace = "swarm";
  specificInputSchema = ExtendPostageStampSchema;
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
    input: z.infer<typeof ExtendPostageStampSchema>
  ): Promise<ToolResponse | string> {
    const { postageBatchId, duration, size } = input;

    if (!postageBatchId) {
      this.logger.error(
        'Missing required parameter: postageBatchId.'
      );

      throw new Error('Missing required parameter: postageBatchId.');
    } else if (!duration && !size) {
      this.logger.error(
        'You need at least one parameter from duration and size.'
      );

      throw new Error('You need at least one parameter from duration and size.');
    }

    // If size is missing, Size.fromBytes(1) will get smallest depth and not increase size.
    const extendSize = !!size ? Size.fromMegabytes(size) : Size.fromBytes(1); 
    let extendDuration = Duration.ZERO;

    try {
      if (duration) {
        extendDuration = Duration.fromMilliseconds(makeDate(duration));
      }
    } catch (makeDateError) {
      this.logger.error(
        'Invalid parameter: duration.'
      );

      throw new Error('Invalid parameter: duration.');
    }

    let extendStorageResponse;

    try {
      extendStorageResponse = await this.bee.extendStorage(
        postageBatchId,
        extendSize,
        extendDuration
      );
    } catch (error) {
      let errorMessage = 'Extend failed.';

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

    return getResponseWithStructuredContent({
      postageBatchId: extendStorageResponse.toHex(),
    });
  }
}
