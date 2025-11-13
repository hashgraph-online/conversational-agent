import { describe, expect, it, beforeEach, jest } from '@jest/globals';
import './SwarmTool.mocks';
import { UploadFileTool } from '../../tools/UploadFileTool';
import { beeMock, contextMock, mockedUtils, swarmConfigMock } from './SwarmTool.mocks';
import { HederaAgentKit } from 'hedera-agent-kit';
import { Reference, UploadResult } from '@ethersphere/bee-js';
import { GATEWAY_TAG_ERROR_MESSAGE } from '../../constants';

describe('UploadFileTool', () => {
  let tool: UploadFileTool;
  const hederaKitMock = {} as HederaAgentKit;

  beforeEach(() => {
    jest.clearAllMocks();

    tool = new UploadFileTool({
      hederaKit: hederaKitMock,
      config: swarmConfigMock,
      bee: beeMock,
      logger: contextMock.logger,
    });

    // Default mocks
    mockedUtils.getUploadPostageBatchId.mockResolvedValue('postage123');

    const reference = { toString: () => 'postage123' } as unknown as Reference;
    const uploadResult = { reference } as unknown as UploadResult;
    beeMock.uploadFile.mockResolvedValue(uploadResult);

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
  });

  it('uploads base64 data successfully', async () => {
    const data = Buffer.from('hello world').toString('base64');

    const result = await tool['executeQuery']({
      data,
      isPath: false,
    });

    expect(mockedUtils.getUploadPostageBatchId).toHaveBeenCalledWith(
      undefined,
      beeMock,
      swarmConfigMock
    );

    expect(beeMock.uploadFile).toHaveBeenCalledWith(
      'postage123',
      expect.any(Buffer),
      undefined,
      expect.objectContaining({ deferred: false })
    );

    expect(result['structuredContent']).toEqual(
      expect.objectContaining({
        reference: "postage123",
        url: "http://127.0.0.1:1633/bzz/postage123",
        message: "File successfully uploaded to Swarm",
      })
    );
  });

  it('uploads file from path successfully', async () => {
    const readFileMock = jest.fn<any>().mockResolvedValue(Buffer.from('file content'));
    jest.spyOn(require('util'), 'promisify').mockReturnValue(readFileMock);
    
    const result = await tool['executeQuery']({
      data: '/mock/path/file.txt',
      isPath: true,
    });

    expect(readFileMock).toHaveBeenCalledWith('/mock/path/file.txt');
    expect(beeMock.uploadFile).toHaveBeenCalledWith(
      'postage123',
      expect.any(Buffer),
      'file.txt',
      expect.objectContaining({ deferred: false })
    );

    expect(result['structuredContent']).toEqual(
      expect.objectContaining({
        reference: 'postage123',
        url: 'http://127.0.0.1:1633/bzz/postage123',
        message: 'File successfully uploaded to Swarm',
      })
    );
  });

  it('throws error if data is missing', async () => {
    await expect(
      tool['executeQuery']({ data: '', isPath: false })
    ).rejects.toThrow('Missing required parameter: data.');
    expect(contextMock.logger.error).toHaveBeenCalledWith(
      'Missing required parameter: data.'
    );
  });

  it('throws error if reading file fails', async () => {
    
    const readFileMock = jest.fn<any>().mockRejectedValue(new Error('File read failed'));
    jest.spyOn(require('util'), 'promisify').mockReturnValue(readFileMock);
    jest.spyOn(require('util'), 'promisify').mockReturnValue(readFileMock);

    await expect(
      tool['executeQuery']({ data: '/bad/path.txt', isPath: true })
    ).rejects.toThrow('Unable to read file at path: /bad/path.txt.');

    expect(contextMock.logger.error).toHaveBeenCalledWith(
      'Unable to read file at path: /bad/path.txt.',
      expect.any(Error)
    );
  });

  it('throws error if getUploadPostageBatchId fails', async () => {
    const error = new Error('Failed to get postage batch');
    mockedUtils.getUploadPostageBatchId.mockRejectedValue(error);

    await expect(
      tool['executeQuery']({ data: 'abc', isPath: false })
    ).rejects.toThrow('Failed to get postage batch');

    expect(contextMock.logger.error).toHaveBeenCalledWith('Failed to get postage batch');
  });

  it('uploads large file in deferred mode and creates tag', async () => {
    // Pretend threshold is small so any data triggers deferred mode
    swarmConfigMock.deferredUploadSizeThresholdMB = 0.000001;

    const bigData = Buffer.alloc(1024 * 1024, 'a').toString('base64'); // 1MB
    const result = await tool['executeQuery']({
      data: bigData,
      isPath: false,
    });

    expect(beeMock.createTag).toHaveBeenCalled();
    expect(beeMock.uploadFile).toHaveBeenCalledWith(
      'postage123',
      expect.any(Buffer),
      undefined,
      expect.objectContaining({
        deferred: true,
        tag: 123,
      })
    );

    expect(result['structuredContent']).toEqual(
      expect.objectContaining({
        tagId: '123',
        message:
          'File upload started in deferred mode. Use query_upload_progress to track progress.',
      })
    );
  });

  it('handles createTag 404 and throws GATEWAY_TAG_ERROR_MESSAGE', async () => {
    beeMock.createTag.mockRejectedValue({ status: 404 });

    swarmConfigMock.deferredUploadSizeThresholdMB = 0.000001;
    const bigData = Buffer.alloc(1024 * 1024, 'a').toString('base64');

    await expect(
      tool['executeQuery']({ data: bigData, isPath: false })
    ).rejects.toThrow(GATEWAY_TAG_ERROR_MESSAGE);

    expect(contextMock.logger.error).toHaveBeenCalledWith(
      GATEWAY_TAG_ERROR_MESSAGE,
      expect.any(Object)
    );
  });

  it('handles uploadFile error gracefully', async () => {
    const error = new Error('Upload failed');
    beeMock.uploadFile.mockRejectedValueOnce(error);

    await expect(
      tool['executeQuery']({ data: 'abc', isPath: false })
    ).rejects.toThrow('Unable to upload file.');

    expect(contextMock.logger.error).toHaveBeenCalledWith(
      'Unable to upload file.',
      error
    );
  });
});
