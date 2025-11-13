import { Bee } from "@ethersphere/bee-js";
import { Wallet } from "@ethereumjs/wallet";
import { z } from "zod";
import crypto from "crypto";
import { errorHasStatus, getErrorMessage, getResponseWithStructuredContent, hexToBytes, ToolResponse } from "../utils";
import { BaseHederaQueryTool, GenericPluginContext, HederaAgentKit } from "hedera-agent-kit";
import { SwarmConfig } from "../config";
import { BAD_REQUEST_STATUS } from "../constants";

const ReadFeedSchema = z.object({
  memoryTopic: z.string(),
  owner: z.string().optional()
});

export class ReadFeedTool extends BaseHederaQueryTool<typeof ReadFeedSchema> {
  name = "swarm-read-feed";
  description = `Retrieve the latest data from the feed of a given topic.
    memoryTopic: Feed topic.
    owner: When accessing external memory or feed, ethereum address of the owner must be set.
  `;
  namespace = "swarm";
  specificInputSchema = ReadFeedSchema;
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
      input: z.infer<typeof ReadFeedSchema>
  ): Promise<ToolResponse | string> {
   const { memoryTopic, owner } = input;

    if (!memoryTopic) {
      this.logger.error(
        'Missing required parameter: memoryTopic.'
      );

      throw new Error('Missing required parameter: memoryTopic.');
    }

    this.logger.info(`[API] Downloading text from Swarm feed with topic: ${memoryTopic}.`);

    if (!this.config.beeFeedPK) {
      this.logger.error('Feed private key not configured.');

      throw new Error('Feed private key not configured.');
    }

    // Process topic - if not a hex string, hash it
    let topic = memoryTopic;
    if (topic.startsWith("0x")) {
      topic = topic.slice(2);
    }
    const isHexString = /^[0-9a-fA-F]{64}$/.test(topic);

    if (!isHexString) {
      // Hash the topic string using SHA-256
      const hash = crypto.createHash("sha256").update(memoryTopic).digest("hex");
      topic = hash;
    }

    // Convert topic string to bytes
    const topicBytes = hexToBytes(topic);

    let feedOwner = owner;
    if (!feedOwner) {
      const feedPrivateKey = hexToBytes(this.config.beeFeedPK);
      const signer = new Wallet(feedPrivateKey);
      feedOwner = signer.getAddressString().slice(2);
    } else {
      if (feedOwner.startsWith("0x")) {
        feedOwner = feedOwner.slice(2);
      }
      if (feedOwner.length !== 40) {
        this.logger.error('Owner must be a valid Ethereum address.');

        throw new Error('Owner must be a valid Ethereum address.');
      }
    }

    let textData;
    
    try {
      const feedReader = this.bee.makeFeedReader(topicBytes, feedOwner);
      const latestUpdate = await feedReader.downloadPayload();
      textData = latestUpdate.payload.toUtf8();
    } catch (error) {
      let errorMessage = 'Reading feed failed.';
      if (errorHasStatus(error, BAD_REQUEST_STATUS)) {
        errorMessage = getErrorMessage(error);
      }
      this.logger.error(errorMessage, error);
      throw new Error(errorMessage);
    }
    
    return getResponseWithStructuredContent({
      textData,
    });
  }
}
