import {
  BaseHederaQueryTool,
  HederaAgentKit,
  type GenericPluginContext,
} from "hedera-agent-kit";
import { Bee, CollectionUploadOptions } from "@ethersphere/bee-js";
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
import { BAD_REQUEST_STATUS } from "../constants";
import { SwarmConfig } from "../config";

const UploadFolderSchema = z.object({
  folderPath: z.string(),
  redundancyLevel: z.number().optional(),
  postageBatchId: z.string().optional(),
});

export class UploadFolderTool extends BaseHederaQueryTool<typeof UploadFolderSchema> {
  name = "swarm-upload-folder";
  description = `Upload a folder to Swarm.
      folderPath: Path to the folder to upload. 
      redundancyLevel: Redundancy level for fault tolerance (higher values provide better fault tolerance but increase storage overhead). 0 - none, 1 - medium, 2 - strong, 3 - insane, 4 - paranoid. 
      postageBatchId: The postage stamp batch ID which will be used to perform the upload, if it is provided.`;
  namespace = "swarm";
  specificInputSchema = UploadFolderSchema;
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
      input: z.infer<typeof UploadFolderSchema>
  ): Promise<ToolResponse | string> {
    const { folderPath, redundancyLevel: inputRedundancyLevel, postageBatchId: inputPostageBatchId } = input;

    if (!folderPath) {
      this.logger.error(
        'Missing required parameter: folderPath.'
      );

      throw new Error('Missing required parameter: folderPath.');
    }

    // Check if folder exists
    const stats = await promisify(fs.stat)(folderPath);
    if (!stats.isDirectory()) {
      this.logger.error(
        `Path is not a directory: ${folderPath}.`
      );

      throw new Error(`Path is not a directory: ${folderPath}.`);
    }

    let postageBatchId = "";

    try {
      postageBatchId = await getUploadPostageBatchId(
        inputPostageBatchId,
        this.bee,
        this.config,
      );
    } catch (error) {
      let errorMessage = 'Upload folder failed.';
      if (error instanceof Error) {
        errorMessage = error.message;
      }
      this.logger.error(errorMessage);

      throw new Error(errorMessage);
    }
    
    const redundancyLevel = inputRedundancyLevel;
    const options: CollectionUploadOptions = {};

    if (redundancyLevel) {
      options.redundancyLevel = redundancyLevel;
    }

    const deferred = true;
    options.deferred = deferred;
    let message = 'Folder successfully uploaded to Swarm';

    let tagId: string | undefined = undefined;

    if (deferred) {
      try {
        const tag = await this.bee.createTag();
        tagId = tag.uid.toString();
        options.tag = tag.uid;
        message =
          'Folder upload started in deferred mode. Use swarm-query-upload-progress to track progress.';
      } catch (error) {
        this.logger.error(
          'Failed to create tag',
          error
        );
        options.deferred = false;
      }
    }

    let result;

    try {
      // Start the deferred upload
      result = await this.bee.uploadFilesFromDirectory(
        postageBatchId,
        folderPath,
        options
      );
    } catch (error) {
      let errorMessage = 'Unable to upload folder.';

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
