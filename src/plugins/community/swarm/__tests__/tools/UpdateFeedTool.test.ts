import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import './SwarmTool.mocks';
import crypto from 'crypto';
import { UpdateFeedTool } from '../../tools/UpdateFeedTool';
import { beeMock, contextMock, mockedUtils, swarmConfigMock } from './SwarmTool.mocks';
import { getErrorMessage } from '../../utils';
import { BAD_REQUEST_STATUS } from '../../constants';

describe('UpdateFeedTool', () => {
  let tool: UpdateFeedTool;

  beforeEach(() => {
    jest.clearAllMocks();
    tool = new UpdateFeedTool({
      hederaKit: {} as any,
      config: { ...swarmConfigMock, beeFeedPK: 'a'.repeat(64) },
      bee: beeMock,
      logger: contextMock.logger,
    });
  });

  it('should throw if data is missing', async () => {
    await expect(tool['executeQuery']({ memoryTopic: 'topic', data: '' } as any))
      .rejects.toThrow('Missing required parameter: data.');
    expect(contextMock.logger.error).toHaveBeenCalledWith(
      'Missing required parameter: data.'
    );
  });

  it('should throw if topic is missing', async () => {
    await expect(tool['executeQuery']({ data: 'some data', memoryTopic: '' } as any))
      .rejects.toThrow('Missing required parameter: topic.');
    expect(contextMock.logger.error).toHaveBeenCalledWith(
      'Missing required parameter: topic.'
    );
  });

  it('should throw if getUploadPostageBatchId fails', async () => {
    const error = new Error('Failed to get postage batch');
    mockedUtils.getUploadPostageBatchId.mockRejectedValue(
      error
    );

    await expect(tool['executeQuery']({ data: 'hello', memoryTopic: 'topic' }))
      .rejects.toThrow('Failed to get postage batch');

    expect(contextMock.logger.error).toHaveBeenCalledWith('Failed to get postage batch');
  });

  it('should throw if feed private key is not configured', async () => {
    tool.config.beeFeedPK = '';
    mockedUtils.getUploadPostageBatchId.mockResolvedValue('batch-id');

    await expect(tool['executeQuery']({ data: 'hi', memoryTopic: 'topic' }))
      .rejects.toThrow('Feed private key not configured.');
    expect(contextMock.logger.error).toHaveBeenCalledWith(
      'Feed private key not configured.'
    );
  });

  it('should hash non-hex topic and call bee.makeFeedWriter', async () => {
    const topic = 'nonHexTopic';
    const hash = crypto.createHash('sha256').update(topic).digest('hex');

    mockedUtils.getUploadPostageBatchId.mockResolvedValue('batch-id');

    const uploadPayloadMock = jest.fn().mockReturnValueOnce({
      reference: { toString: () => 'ref123' },
    });
    const makeFeedWriterMock = jest.fn().mockReturnValue({
      uploadPayload: uploadPayloadMock,
    });
    
    (beeMock.makeFeedWriter as unknown as jest.Mock).mockImplementation(makeFeedWriterMock);
    const result = await tool['executeQuery']({ data: 'hi', memoryTopic: topic });

    expect(makeFeedWriterMock).toHaveBeenCalled();
    expect(result["structuredContent"]).toStrictEqual({
      reference: 'ref123',
      topicString: 'nonHexTopic',
      topic: '186143fbcbf933508c828567e5ebffa2cbfa34d7066b15d42ad1eb8c62a7d5db',
      feedUrl: 'http://127.0.0.1:1633/feeds/8fd379246834eac74b8419ffda202cf8051f7a03/186143fbcbf933508c828567e5ebffa2cbfa34d7066b15d42ad1eb8c62a7d5db',
      message: 'Data successfully uploaded to Swarm and linked to feed.'
    });
  });

  it('should remove 0x prefix from hex topic and succeed', async () => {
    const topic = '0x' + 'a'.repeat(64);
    mockedUtils.getUploadPostageBatchId.mockResolvedValue('batch-id');
    const uploadPayloadMock = jest.fn().mockReturnValueOnce({
      reference: { toString: () => 'ref123' },
    });
    const makeFeedWriterMock = jest.fn().mockReturnValue({
      uploadPayload: uploadPayloadMock,
    });
    (beeMock.makeFeedWriter as unknown as jest.Mock).mockImplementation(makeFeedWriterMock);

    const result = await tool['executeQuery']({ data: 'hello', memoryTopic: topic });

    expect(makeFeedWriterMock).toHaveBeenCalled();
    expect(result["structuredContent"]).toStrictEqual({
      reference: 'ref123',
        topicString: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
        topic: '8d8b3cc160bb728e13db1c032741ad9566b3affd16fc0c805d3caf863694643e',
        feedUrl: 'http://127.0.0.1:1633/feeds/8fd379246834eac74b8419ffda202cf8051f7a03/8d8b3cc160bb728e13db1c032741ad9566b3affd16fc0c805d3caf863694643e',
        message: 'Data successfully uploaded to Swarm and linked to feed.'
    });
  });

  it('should handle BAD_REQUEST_STATUS error', async () => {
    mockedUtils.getUploadPostageBatchId.mockResolvedValue('batch-id');
    getErrorMessage as jest.MockedFunction<typeof getErrorMessage>;
    (getErrorMessage as jest.Mock).mockReturnValue('Custom bad request message.');
    const error = new Error('Custom bad request message.');
    (error as any).status = BAD_REQUEST_STATUS;

    (beeMock.makeFeedWriter as unknown as jest.Mock).mockImplementation(() => {
      throw error;
    });
    
    await expect(tool['executeQuery']({ data: 'test', memoryTopic: '0x' + 'a'.repeat(64) }))
      .rejects.toThrow('Custom bad request message.');

    expect(contextMock.logger.error).toHaveBeenCalledWith(
      'Custom bad request message.',
      expect.anything()
    );    
  });

  it('should handle generic feed upload error', async () => {
    mockedUtils.getUploadPostageBatchId.mockResolvedValue('batch-id');

    const error = new Error('Unable to update feed.');

    (beeMock.makeFeedWriter as unknown as jest.Mock).mockImplementation(() => {
      throw error;
    });

    await expect(
      tool['executeQuery']({ data: 'abc', memoryTopic: 'topic' })
    ).rejects.toThrow('Unable to update feed.');

    expect(contextMock.logger.error).toHaveBeenCalledWith(
      'Unable to update feed.',
      expect.any(Error)
    );
  });
});
