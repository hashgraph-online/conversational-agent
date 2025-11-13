// Must be imported before SwarmPlugin
import { jest } from '@jest/globals';

// Mock hedera-agent-kit
jest.mock('hedera-agent-kit', () => {
  class MockBasePlugin {
    context = {
      logger: {
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
        debug: jest.fn(),
      },
      config: {},
    };

    async initialize(context) {
      this.context = { ...this.context, ...context };
    }

    async cleanup() {}
  }

  return {
    GenericPluginContext: jest.fn(),
    HederaTool: jest.fn(),
    BasePlugin: MockBasePlugin,
  };
});

jest.mock('../tools/ListPostageStampsTool', () => ({
  ListPostageStampsTool: class {
    executeQuery = jest.fn();
  },
}));

jest.mock('../tools/UploadDataTool', () => ({
  UploadDataTool: class {
    executeQuery = jest.fn();
  },
}));

jest.mock('../tools/DownloadDataTool', () => ({
  DownloadDataTool: class {
    executeQuery = jest.fn();
  },
}));

jest.mock('../tools/CreatePostageStampTool', () => ({
  CreatePostageStampTool: class {
    executeQuery = jest.fn();
  },
}));

jest.mock('../tools/ExtendPostageStampTool', () => ({
  ExtendPostageStampTool: class {
    executeQuery = jest.fn();
  },
}));

jest.mock('../tools/QueryUploadProgressTool', () => ({
  QueryUploadProgressTool: class {
    executeQuery = jest.fn();
  },
}));

jest.mock('../tools/DownloadFilesTool', () => ({
  DownloadFilesTool: class {
    executeQuery = jest.fn();
  },
}));

jest.mock('../tools/GetPostageStampTool', () => ({
  GetPostageStampTool: class {
    executeQuery = jest.fn();
  },
}));

jest.mock('../tools/ReadFeedTool', () => ({
  ReadFeedTool: class {
    executeQuery = jest.fn();
  },
}));

jest.mock('../tools/UpdateFeedTool', () => ({
  UpdateFeedTool: class {
    executeQuery = jest.fn();
  },
}));

jest.mock('../tools/UploadFileTool', () => ({
  UploadFileTool: class {
    executeQuery = jest.fn();
  },
}));

jest.mock('../tools/UploadFolderTool', () => ({
  UploadFolderTool: class {
    executeQuery = jest.fn();
  },
}));

jest.mock('@ethersphere/bee-js', () => ({
  Bee: class {},
}));
