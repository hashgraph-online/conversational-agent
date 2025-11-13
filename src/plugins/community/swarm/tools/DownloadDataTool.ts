import { Bee } from "@ethersphere/bee-js";
import { z } from "zod";
import { errorHasStatus, getErrorMessage, getResponseWithStructuredContent, ToolResponse } from "../utils";
import { BaseHederaQueryTool, GenericPluginContext, HederaAgentKit } from "hedera-agent-kit";
import { SwarmConfig } from "../config";
import { BAD_REQUEST_STATUS } from "../constants";

const DownloadDataSchema = z.object({
  reference: z.string(),
});

export class DownloadDataTool extends BaseHederaQueryTool<typeof DownloadDataSchema> {
  name = "swarm-download-data";
  description = `
    Downloads immutable data from a Swarm content address hash.
    reference: Swarm reference hash.
  `;
  namespace = "swarm";
  specificInputSchema = DownloadDataSchema;
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
      input: z.infer<typeof DownloadDataSchema>
  ): Promise<ToolResponse | string> {
    const { reference } = input;

    if (!reference) {
      this.logger.error(
        'Missing required parameter: reference.'
      );

      throw new Error("Missing required parameter: reference.");
    }

    const isRefNotSwarmHash =
      reference.length !== 64 && reference.length !== 66;

    if (isRefNotSwarmHash) {
      this.logger.error(
        'Invalid Swarm content address hash value for reference.'
      );

      throw new Error("Invalid Swarm content address hash value for reference.");
    }

    let data;
    try {
      data = await this.bee.downloadData(reference);
    } catch (error) {
      let errorMessage = 'Downloading data failed.';

      if (errorHasStatus(error, BAD_REQUEST_STATUS)) {
        errorMessage = getErrorMessage(error);
      }

      this.logger.error(errorMessage, error);
      throw new Error(errorMessage);
    }

    const textData = data.toUtf8();

    return getResponseWithStructuredContent({
      textData,
    });
  }
}
