import { Bee } from "@ethersphere/bee-js";
import type { Logger } from '@hashgraphonline/standards-sdk';
import { GenericPluginContext, HederaAgentKit } from "hedera-agent-kit";
import * as utils from '../../utils';

const loggerMock = {
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
} as unknown as Logger;

jest.mock('hedera-agent-kit', () => ({
  BaseHederaQueryTool: class {
    logger = loggerMock;
    constructor(_params: any) {}
  },
}));

let beeMock: jest.Mocked<Bee> = new Bee("http://127.0.0.1:1633") as jest.Mocked<Bee>;
beeMock.getPostageBatch = jest.fn();
beeMock.getPostageBatches = jest.fn();
beeMock.buyStorage = jest.fn();
beeMock.extendStorage = jest.fn();
beeMock.createTag = jest.fn();
beeMock.retrieveTag = jest.fn();
beeMock.deleteTag = jest.fn();
beeMock.makeFeedReader = jest.fn();
beeMock.makeFeedWriter = jest.fn();
beeMock.uploadFilesFromDirectory = jest.fn();
beeMock.uploadFile = jest.fn();
beeMock.downloadData = jest.fn();
beeMock.uploadData = jest.fn();

const swarmConfigMock = {
  beeApiUrl: 'http://127.0.0.1:1633',
  beeFeedPK: "",
  autoAssignStamp: true,
  deferredUploadSizeThresholdMB: 5 
};

const contextMock = {
  config: {
    hederaKit: {} as HederaAgentKit,
  },
  logger: loggerMock,
} as unknown as GenericPluginContext;

jest.mock('../../utils', () => {
  const originalModule = jest.requireActual('../../utils');

  return {
    ...originalModule,
    runWithTimeout: jest.fn(),
    getErrorMessage: jest.fn(),
    getUploadPostageBatchId: jest.fn(),
  };
});

const mockedUtils = utils as jest.Mocked<typeof utils>;

export {
  beeMock,
  contextMock,
  swarmConfigMock,
  mockedUtils,
};
