import { describe, expect, it, beforeEach, jest } from '@jest/globals';
import './SwarmTool.mocks';
import { UploadFolderTool } from "../../tools/UploadFolderTool";
import fs from "fs";
import { beeMock, contextMock, mockedUtils, swarmConfigMock } from './SwarmTool.mocks';
import { HederaAgentKit } from "hedera-agent-kit";
import { Reference, UploadResult } from '@ethersphere/bee-js';

describe("UploadFolderTool", () => {
  let tool: UploadFolderTool;

  const hederaKitMock = {} as HederaAgentKit;

  beforeEach(() => {
    jest.clearAllMocks();
    
    tool = new UploadFolderTool({
      hederaKit: hederaKitMock,
      config: swarmConfigMock,
      bee: beeMock,
      logger: contextMock.logger,
    });

    mockedUtils.getUploadPostageBatchId.mockResolvedValue('postage123');
    const reference = {
      toString: () => "postage123",
    } as unknown as Reference;
    
    const uploadResult = {
      reference
    } as unknown as UploadResult;
    
    beeMock.uploadFilesFromDirectory.mockResolvedValue(uploadResult);
    
    const tagDataMock = {
      address: '0x123',
      synced: 50,
      seen: 25,
      split: 100,
      stored: 10,
      sent: 10,
      uid: 123,
      startedAt: '2025-11-04T12:00:00Z',
    };
    
    beeMock.createTag.mockResolvedValue(tagDataMock);
    
    const mockStats: fs.Stats = {
      isDirectory: () => true,
    } as unknown as fs.Stats;
    const mockStatFn = jest.fn<any>().mockResolvedValue(mockStats);
    jest.spyOn(require("util"), "promisify").mockReturnValue(mockStatFn);
  });

  it("uploads folder successfully in deferred mode", async () => {
    const folderPath = "/mock/folder";

    const result = await tool['executeQuery']({ folderPath });

    expect(mockedUtils.getUploadPostageBatchId).toHaveBeenCalledWith(undefined, beeMock, swarmConfigMock);
    expect(beeMock.createTag).toHaveBeenCalled();
    expect(beeMock.uploadFilesFromDirectory).toHaveBeenCalledWith(
      "postage123",
      folderPath,
      expect.objectContaining({
        deferred: true,
        tag: 123,
      })
    );

    expect(result["structuredContent"]).toEqual(expect.objectContaining({
      reference: "postage123",
      url: "http://127.0.0.1:1633/bzz/postage123",
      message: "Folder upload started in deferred mode. Use swarm-query-upload-progress to track progress.",
      tagId: "123",
    }));
  });

  it("throws error if folderPath is missing", async () => {
    await expect(tool['executeQuery']({ folderPath: "" }))
      .rejects.toThrow("Missing required parameter: folderPath.");
    expect(contextMock.logger.error).toHaveBeenCalledWith("Missing required parameter: folderPath.");
  });

  it("throws error if path is not a directory", async () => {
    const mockStats: fs.Stats = {
      isDirectory: () => false,
    } as unknown as fs.Stats;
    const mockStatFn = jest.fn<any>().mockResolvedValue(mockStats);
    jest.spyOn(require("util"), "promisify").mockReturnValue(mockStatFn);

    const folderPath = "/not/a/dir";

    await expect(tool['executeQuery']({ folderPath }))
      .rejects.toThrow(`Path is not a directory: ${folderPath}.`);
    expect(contextMock.logger.error).toHaveBeenCalledWith(`Path is not a directory: ${folderPath}.`);
  });

  it("throws error if getUploadPostageBatchId fails", async () => {
    const error = new Error('Failed to get postage batch');
    mockedUtils.getUploadPostageBatchId.mockRejectedValue(
      error
    );

    await expect(tool['executeQuery']({ folderPath: "/mock/folder" }))
      .rejects.toThrow("Failed to get postage batch");
    expect(contextMock.logger.error).toHaveBeenCalledWith("Failed to get postage batch");
  });

  it("handles uploadFilesFromDirectory error", async () => {
    const error = new Error("Upload failed");
    beeMock.uploadFilesFromDirectory.mockRejectedValueOnce(error);

    await expect(tool['executeQuery']({ folderPath: "/mock/folder" }))
      .rejects.toThrow("Unable to upload folder.");
    expect(contextMock.logger.error).toHaveBeenCalledWith("Unable to upload folder.", error);
  });
});
