import { describe, expect, it, beforeEach, jest } from '@jest/globals';
import './SwarmTool.mocks';
import { ReadFeedTool } from '../../tools/ReadFeedTool';
import { beeMock, contextMock, swarmConfigMock } from './SwarmTool.mocks';
import { getErrorMessage, getResponseWithStructuredContent } from '../../utils';
import { BAD_REQUEST_STATUS } from '../../constants';
import { HederaAgentKit } from 'hedera-agent-kit';

describe('ReadFeedTool', () => {
  let tool: ReadFeedTool;
  let hederaKitMock: HederaAgentKit;

  beforeEach(() => {
    jest.clearAllMocks();
    hederaKitMock = {} as HederaAgentKit;
    tool = new ReadFeedTool({
      hederaKit: hederaKitMock,
      config: { ...swarmConfigMock, beeFeedPK: 'a'.repeat(64) },
      bee: beeMock,
      logger: contextMock.logger,
    });
  });

  it('should throw if memoryTopic is missing', async () => {
    await expect(tool['executeQuery']({ memoryTopic: '' } as any))
      .rejects.toThrow('Missing required parameter: memoryTopic.');
    expect(contextMock.logger.error).toHaveBeenCalledWith(
      'Missing required parameter: memoryTopic.'
    );
  });

  it('should throw if feed private key is missing', async () => {
    tool.config.beeFeedPK = '';
    await expect(tool['executeQuery']({ memoryTopic: 'my-topic' }))
      .rejects.toThrow('Feed private key not configured.');
    expect(contextMock.logger.error).toHaveBeenCalledWith(
      'Feed private key not configured.'
    );
  });

  it('should throw if owner is invalid', async () => {
    await expect(tool['executeQuery']({ memoryTopic: 'topic', owner: '0x123' }))
      .rejects.toThrow('Owner must be a valid Ethereum address.');
    expect(contextMock.logger.error).toHaveBeenCalledWith(
      'Owner must be a valid Ethereum address.'
    );
  });

  it('should hash non-hex topic', async () => {
    const topic = 'nonHexTopic';
    const downloadMock = jest.fn().mockReturnValueOnce({
      payload: { toUtf8: () => 'feed-data' },
    });
    const makeFeedReaderMock = jest.fn().mockReturnValue({
      downloadPayload: downloadMock,
    });
    (beeMock.makeFeedReader as unknown as jest.Mock).mockImplementation(makeFeedReaderMock);

    const result = await tool['executeQuery']({ memoryTopic: topic });
    
    expect(result).toEqual(getResponseWithStructuredContent({ textData: 'feed-data' }));
  });

  it('should remove 0x prefix from hex topic and owner', async () => {
    const topic = '0x' + 'a'.repeat(64);
    const owner = '0x' + 'b'.repeat(40);
    const downloadMock = jest.fn().mockReturnValueOnce({
      payload: { toUtf8: () => 'feed-data' },
    });
    const makeFeedReaderMock = jest.fn().mockReturnValue({
      downloadPayload: downloadMock,
    });
    (beeMock.makeFeedReader as unknown as jest.Mock).mockImplementation(makeFeedReaderMock);

    const result = await tool['executeQuery']({ memoryTopic: topic, owner });
    
    expect(makeFeedReaderMock).toHaveBeenCalled();
    expect(result).toEqual(getResponseWithStructuredContent({ textData: 'feed-data' }));
  });

  it('should use feed private key to derive owner if not provided', async () => {
    const topic = '0x' + 'a'.repeat(64);
    const downloadMock = jest.fn().mockReturnValueOnce({
      payload: { toUtf8: () => 'feed-data' },
    });
    const makeFeedReaderMock = jest.fn().mockReturnValue({
      downloadPayload: downloadMock,
    });
    (beeMock.makeFeedReader as unknown as jest.Mock).mockImplementation(makeFeedReaderMock);

    const result = await tool['executeQuery']({ memoryTopic: topic });
    
    expect(result).toEqual(getResponseWithStructuredContent({ textData: 'feed-data' }));
  });

  it('should handle BAD_REQUEST_STATUS error from feed', async () => {
    const topic = '0x' + 'a'.repeat(64);
    getErrorMessage as jest.MockedFunction<typeof getErrorMessage>;
    (getErrorMessage as jest.Mock).mockReturnValue('Custom bad request message.');
    const error = new Error('Custom bad request message.');
    (error as any).status = BAD_REQUEST_STATUS;

    (beeMock.makeFeedReader as unknown as jest.Mock).mockImplementation(() => {
      throw error;
    });

    await expect(tool['executeQuery']({ memoryTopic: topic }))
      .rejects.toThrow('Custom bad request message.');
      
    expect(contextMock.logger.error).toHaveBeenCalledWith(
      'Custom bad request message.',
      expect.anything()
    );    
  });

  it('should handle generic error from feed', async () => {
    const topic = '0x' + 'a'.repeat(64);
    getErrorMessage as jest.MockedFunction<typeof getErrorMessage>;
    (getErrorMessage as jest.Mock).mockReturnValue('Custom bad request message.');
    const error = new Error('Custom bad request message.');

    (beeMock.makeFeedReader as unknown as jest.Mock).mockImplementation(() => {
      throw error;
    });

    await expect(tool['executeQuery']({ memoryTopic: topic }))
      .rejects.toThrow('Reading feed failed.');
    expect(contextMock.logger.error).toHaveBeenCalledWith(
      'Reading feed failed.',
      expect.anything()
    );    
  });
});
