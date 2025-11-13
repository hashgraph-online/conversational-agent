import {
  BaseHederaQueryTool,
  HederaAgentKit,
  type GenericPluginContext,
} from "hedera-agent-kit";
import { Bee } from "@ethersphere/bee-js";
import { z } from "zod";
import crypto from "crypto";
import {
  errorHasStatus,
  getErrorMessage,
  getResponseWithStructuredContent,
  getUploadPostageBatchId,
  hexToBytes,
  ToolResponse,
} from "../utils";
import { BAD_REQUEST_STATUS } from "../constants";
import { Wallet } from "@ethereumjs/wallet";
import { SwarmConfig } from "../config";

const UpdateFeedSchema = z.object({
  data: z.string(),
  memoryTopic: z.string(),
  postageBatchId: z.string().optional(),
});

export class UpdateFeedTool extends BaseHederaQueryTool<typeof UpdateFeedSchema> {
  name = "swarm-update-feed";
  description = `Update the feed of a given topic with new data.
    data: Arbitrary string to upload.
    memoryTopic: If provided, uploads the data to a feed with this topic. It is the label of the memory that can be used later to retrieve the data instead of its content hash. If not a hex string, it will be hashed to create a feed topic.
    postageBatchId: The postage stamp batch ID which will be used to perform the upload, if it is provided.`;
  namespace = "swarm";
  specificInputSchema = UpdateFeedSchema;
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
      input: z.infer<typeof UpdateFeedSchema>
  ): Promise<ToolResponse | string> {
    const { data, memoryTopic, postageBatchId: inputPostageBatchId  } = input;
     if (!data) {
      this.logger.error(
        'Missing required parameter: data.'
      );

      throw new Error('Missing required parameter: data.');
    } else if (!memoryTopic) {
      this.logger.error(
        'Missing required parameter: topic.'
      );

      throw new Error('Missing required parameter: topic.');
    }
    
    let postageBatchId = "";

    try {
      postageBatchId = await getUploadPostageBatchId(
        inputPostageBatchId,
        this.bee,
        this.config,
      );
    } catch (error) {
      let errorMessage = 'Update feed failed.';
      if (error instanceof Error) {
        errorMessage = error.message;
      }
      this.logger.error(errorMessage);

      throw new Error(errorMessage);
    }

    const binaryData = Buffer.from(data);

    // Feed upload if memoryTopic is specified
    if (!this.config.beeFeedPK) {
      this.logger.error('Feed private key not configured.');

      throw new Error('Feed private key not configured.');
    }

    // Process topic - if not a hex string, hash it
    let topic = memoryTopic;
    if (topic.startsWith("0x")) {
      topic = topic.slice(2);
    }
    const isHexString = /^[0-9a-fA-F]{64}$/.test(memoryTopic);

    if (!isHexString) {
      // Hash the topic string using SHA-256
      const hash = crypto
        .createHash("sha256")
        .update(memoryTopic)
        .digest("hex");
      topic = hash;
    }

    // Convert topic string to bytes
    const topicBytes = hexToBytes(topic);

    const feedPrivateKey = hexToBytes(this.config.beeFeedPK);
    const signer = new Wallet(feedPrivateKey);
    const owner = signer.getAddressString().slice(2);

    let result;

    try {
      const feedWriter = this.bee.makeFeedWriter(topicBytes, feedPrivateKey);

      result = await feedWriter.uploadPayload(postageBatchId!, binaryData);
    } catch (error) {
      let errorMessage = 'Unable to update feed.';

      if (errorHasStatus(error, BAD_REQUEST_STATUS)) {
        errorMessage = getErrorMessage(error);
      }

      this.logger.error(
        errorMessage,
        error
      );
      
      throw new Error(errorMessage);
    }

    const reference = result.reference.toString();

    return getResponseWithStructuredContent({
      reference,
      topicString: memoryTopic,
      topic: topic,
      feedUrl: `${this.bee.url}/feeds/${owner}/${topic}`,
      message: 'Data successfully uploaded to Swarm and linked to feed.',
    });
  }
}
