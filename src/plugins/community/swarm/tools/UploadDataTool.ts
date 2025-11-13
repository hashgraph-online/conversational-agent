import {
  BaseHederaQueryTool,
  HederaAgentKit,
  type GenericPluginContext,
} from "hedera-agent-kit";
import { Bee } from "@ethersphere/bee-js";
import { z } from "zod";
import {
  errorHasStatus,
  getErrorMessage,
  getResponseWithStructuredContent,
  getUploadPostageBatchId,
  ToolResponse,
} from "../utils";
import { BAD_REQUEST_STATUS } from "../constants";
import { SwarmConfig } from "../config";

const UploadDataSchema = z.object({
  data: z.string(),
  redundancyLevel: z.number().optional(),
  postageBatchId: z.string().optional(),
});

export class UploadDataTool extends BaseHederaQueryTool<typeof UploadDataSchema> {
  name = "swarm-upload-data";
  description = `
    Upload text data to Swarm.
    data: Arbitrary string to upload.
    redundancyLevel: Redundancy level for fault tolerance: 0 - none, 1 - medium, 2 - strong, 3 - insane, 4 - paranoid (higher values provide better fault tolerance but increase storage overhead). Optional, value is 0 if not requested.
    postageBatchId: The postage stamp batch ID which will be used to perform the upload, if it is provided.
  `;
  namespace = "swarm";
  specificInputSchema = UploadDataSchema;
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
      input: z.infer<typeof UploadDataSchema>
  ): Promise<ToolResponse | string> {
    const { data, redundancyLevel, postageBatchId: inputPostageBatchId } = input;

    if (!data) {
      this.logger.error(
        'Missing required parameter: data.'
      );

      throw new Error('Missing required parameter: data.');
    }

    let postageBatchId = "";

    try {
      postageBatchId = await getUploadPostageBatchId(
        inputPostageBatchId,
        this.bee,
        this.config,
      );
    } catch (error) {
      let errorMessage = 'Upload data failed.';
      if (error instanceof Error) {
        errorMessage = error.message;
      }
      this.logger.error(errorMessage);

      throw new Error(errorMessage);
    }

    const binaryData = Buffer.from(data);

    const options = redundancyLevel ? { redundancyLevel } : undefined;

    let result;

    try {
      result = await this.bee.uploadData(postageBatchId, binaryData, options);
    } catch (error) {
      let errorMessage = 'Unable to upload data.';

      if (errorHasStatus(error, BAD_REQUEST_STATUS)) {
        errorMessage = getErrorMessage(error);
      }

      this.logger.error(
        errorMessage,
        error
      );
      
      throw new Error(errorMessage);
    }

    return getResponseWithStructuredContent({
        reference: result.reference.toString(),
        url: this.bee.url + "/bytes/" + result.reference.toString(),
        message: 'Data successfully uploaded to Swarm',
      });
  }
}
