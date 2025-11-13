import {
  BasePlugin,
  type GenericPluginContext,
  type HederaAgentKit,
  type HederaTool,
} from "hedera-agent-kit";
import { Bee } from "@ethersphere/bee-js";
import { ListPostageStampsTool } from "./tools/ListPostageStampsTool";
import { UploadDataTool } from "./tools/UploadDataTool";
import { DownloadDataTool } from "./tools/DownloadDataTool";
import { CreatePostageStampTool } from "./tools/CreatePostageStampTool";
import { ExtendPostageStampTool } from "./tools/ExtendPostageStampTool";
import { QueryUploadProgressTool } from "./tools/QueryUploadProgressTool";
import { DownloadFilesTool } from "./tools/DownloadFilesTool";
import { GetPostageStampTool } from "./tools/GetPostageStampTool";
import { ReadFeedTool } from "./tools/ReadFeedTool";
import { UpdateFeedTool } from "./tools/UpdateFeedTool";
import { UploadFileTool } from "./tools/UploadFileTool";
import { UploadFolderTool } from "./tools/UploadFolderTool";
import { SwarmConfig } from "./config";

export class SwarmPlugin extends BasePlugin<GenericPluginContext> {
  id = "swarm";
  name = "Swarm Plugin";
  description =
    "Swarm operations: tools for interacting with the Swarm decentralized storage.";
  version = "1.0.0";
  author = "Solar Punk";
  namespace = "swarm";

  private config: SwarmConfig | null;
  private tools: HederaTool[] = [];

  constructor(
    config?: SwarmConfig
  ) {
    super();
    this.config = config || null;
  }

  override async initialize(context: GenericPluginContext): Promise<void> {
    
    await super.initialize(context);

    const hederaKit = context.config.hederaKit as HederaAgentKit | undefined;

    if (!hederaKit) {
      this.context.logger.warn(
        'SwarmPlugin skipped because HederaAgentKit was not present in plugin context.'
      );
      this.tools = [];
      return;
    }
    
    if (!this.config) {
      this.context.logger.warn(
        'SwarmPlugin skipped because Swarm config was not present.'
      );
      this.tools = [];
      return;
    }
    
    const beeURL = this.config.beeApiUrl;
    
    const bee = new Bee(beeURL);

    const createPostageStampTool = new CreatePostageStampTool({
      hederaKit,
      bee,
      config: this.config,
      logger: this.context.logger,
    });

    const downloadDataTool = new DownloadDataTool({
      hederaKit,
      bee,
      config: this.config,
      logger: this.context.logger,
    });
    
    const downloadFilesTool = new DownloadFilesTool({
      hederaKit,
      bee,
      config: this.config,
      logger: this.context.logger,
    });
    
    const extendPostageStampTool = new ExtendPostageStampTool({
      hederaKit,
      bee,
      config: this.config,
      logger: this.context.logger,
    });

    const getPostageStampsTool = new GetPostageStampTool({
      hederaKit,
      bee,
      config: this.config,
      logger: this.context.logger,
    });
    
    const listPostageStampsTool = new ListPostageStampsTool({
      hederaKit,
      bee,
      config: this.config,
      logger: this.context.logger,
    });
    
    const queryUploadProgressTool = new QueryUploadProgressTool({
      hederaKit,
      bee,
      config: this.config,
      logger: this.context.logger,
    });
    
    const readFeedTool = new ReadFeedTool({
      hederaKit,
      bee,
      config: this.config,
      logger: this.context.logger,
    });
    
    const updateFeedTool = new UpdateFeedTool({
      hederaKit,
      bee,
      config: this.config,
      logger: this.context.logger,
    });
    
    const uploadDataTool = new UploadDataTool({
      hederaKit,
      bee,
      config: this.config,
      logger: this.context.logger,
    });
    
    const uploadFileTool = new UploadFileTool({
      hederaKit,
      bee,
      config: this.config,
      logger: this.context.logger,
    });
    
    const uploadFolderTool = new UploadFolderTool({
      hederaKit,
      bee,
      config: this.config,
      logger: this.context.logger,
    });
    
    this.tools = [
      createPostageStampTool,
      downloadDataTool,
      downloadFilesTool,
      extendPostageStampTool,
      getPostageStampsTool,
      listPostageStampsTool,
      queryUploadProgressTool,
      readFeedTool,
      updateFeedTool,
      uploadDataTool,
      uploadFileTool,
      uploadFolderTool
    ];

    this.context.logger.info(
      "Swarm Plugin initialized."
    );
  }

  override getTools(): HederaTool[] {
    return this.tools;
  }

  override async cleanup(): Promise<void> {
    this.tools = [];
  }
}
