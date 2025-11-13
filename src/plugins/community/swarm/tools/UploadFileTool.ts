import {
  BaseHederaQueryTool,
  HederaAgentKit,
  type GenericPluginContext,
} from "hedera-agent-kit";
import { Bee, FileUploadOptions } from "@ethersphere/bee-js";
import { z } from "zod";
import { promisify } from "util";
import fs from "fs";
import {
  errorHasStatus,
  getErrorMessage,
  getResponseWithStructuredContent,
  getUploadPostageBatchId,
  ToolResponse,
} from "../utils";
import { BAD_REQUEST_STATUS, DEFAULT_DEFERRED_UPLOAD_SIZE_THRESHOLD_MB, GATEWAY_TAG_ERROR_MESSAGE, NOT_FOUND_STATUS } from "../constants";
import { SwarmConfig } from "../config";

const UploadFileSchema = z.object({
  data: z.string(),
  isPath: z.boolean(),
  redundancyLevel: z.number().optional(),
  postageBatchId: z.string().optional(),
});

export class UploadFileTool extends BaseHederaQueryTool<typeof UploadFileSchema> {
  name = "swarm-upload-file";
  description = `Upload a file to Swarm.
    data: base64 encoded file content or file path.
    isPath: Wether the data parameter is a path.
    redundancyLevel: Redundancy level for fault tolerance (higher values provide better fault tolerance but increase storage overhead). 0 - none, 1 - medium, 2 - strong, 3 - insane, 4 - paranoid.
    postageBatchId: The postage stamp batch ID which will be used to perform the upload, if it is provided.`;
  namespace = "swarm";
  specificInputSchema = UploadFileSchema;
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
      input: z.infer<typeof UploadFileSchema>
  ): Promise<ToolResponse | string> {
    const { data, isPath, redundancyLevel: inputRedundancyLevel, postageBatchId: inputPostageBatchId  } = input;

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
      let errorMessage = 'Upload file failed.';
      if (error instanceof Error) {
        errorMessage = error.message;
      }
      this.logger.error(errorMessage);

      throw new Error(errorMessage);
    }

    let binaryData: Buffer;
    let name: string | undefined;

    if (isPath) {
      // Read file from path
      try {
        binaryData = await promisify(fs.readFile)(data);
      } catch (fileError) {
        this.logger.error(
          `Unable to read file at path: ${data}.`,
          fileError
        );

        throw new Error(`Unable to read file at path: ${data}.`);
      }

      name = data.split("/").pop();
    } else {
      binaryData = Buffer.from(data, "base64");
    }

    const redundancyLevel = inputRedundancyLevel;
    const options: FileUploadOptions = {};
    const deferredUploadSizeThreshold = Number(this.config.deferredUploadSizeThresholdMB) ||
      DEFAULT_DEFERRED_UPLOAD_SIZE_THRESHOLD_MB;
    const deferred =
      binaryData.length > deferredUploadSizeThreshold * 1024 * 1024;
    options.deferred = deferred;
    if (redundancyLevel) {
      options.redundancyLevel = redundancyLevel;
    }

    let message = "File successfully uploaded to Swarm";
    let tagId: string | undefined = undefined;
    // Create tag for deferred uploads or when explicitly requested
    if (deferred) {
      try {
        const tag = await this.bee.createTag();
        options.tag = tag.uid;
        tagId = tag.uid.toString();
        message =
          "File upload started in deferred mode. Use query_upload_progress to track progress.";
      } catch (error) {
        if (errorHasStatus(error, NOT_FOUND_STATUS)) {
          this.logger.error(
            GATEWAY_TAG_ERROR_MESSAGE,
            error
          );

          throw new Error(GATEWAY_TAG_ERROR_MESSAGE);
        }
      }
    }

    let result;

    try {
      // Start the deferred upload
      result = await this.bee.uploadFile(postageBatchId, binaryData, name, options);
    } catch (error) {
      let errorMessage = 'Unable to upload file.';

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
      url: this.bee.url + "/bzz/" + result.reference.toString(),
      message,
      tagId,
    });
  }
}
