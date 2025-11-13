import { describe, expect, it, beforeEach, jest } from '@jest/globals';
import './SwarmTool.mocks';

import { QueryUploadProgressTool } from '../../tools/QueryUploadProgressTool';
import { GATEWAY_TAG_ERROR_MESSAGE } from '../../constants';
import type { HederaAgentKit } from 'hedera-agent-kit';
import { beeMock, contextMock, swarmConfigMock } from './SwarmTool.mocks';
import { getResponseWithStructuredContent } from '../../utils';

describe('QueryUploadProgressTool', () => {
  let tool: QueryUploadProgressTool;
  let hederaKitMock: HederaAgentKit;

  const tagDataMock = {
    address: '0x123',
    synced: 50,
    seen: 25,
    split: 100,
    stored: 10,
    sent: 10,
    uid: 1,
    startedAt: '2025-11-04T12:00:00Z',
  };

  beforeEach(() => {
    jest.clearAllMocks();
    hederaKitMock = {} as HederaAgentKit;

    tool = new QueryUploadProgressTool({
      hederaKit: hederaKitMock,
      config: swarmConfigMock,
      bee: beeMock,
      logger: contextMock.logger,
    });
  });

  it('should throw if tagId is missing', async () => {
    await expect(tool['executeQuery']({} as any))
      .rejects.toThrow('Missing required parameter: tagId.');
    expect(contextMock.logger.error).toHaveBeenCalledWith(
      'Missing required parameter: tagId.'
    );
  });

  it('should throw if tagId is not a numeric string', async () => {
    await expect(tool['executeQuery']({ tagId: 'abc' }))
      .rejects.toThrow('Invalid tagId format. Expected a numeric string.');
    expect(contextMock.logger.error).toHaveBeenCalledWith(
      'Invalid tagId format. Expected a numeric string.'
    );
  });

  it('should return progress for a tag', async () => {
    beeMock.retrieveTag.mockResolvedValue(tagDataMock);

    const result = await tool['executeQuery']({ tagId: '1' });

    const expectedPercentage = Math.round((tagDataMock.synced + tagDataMock.seen) / tagDataMock.split * 100);

    expect(result).toEqual(
      getResponseWithStructuredContent({
        processedPercentage: expectedPercentage,
        message: `Upload progress: ${expectedPercentage}% processed`,
        startedAt: tagDataMock.startedAt,
        tagAddress: tagDataMock.address,
      })
    );
  });

  it('should delete tag if upload is complete', async () => {
    const completeTag = { ...tagDataMock, synced: 50, seen: 50, split: 100 };
    beeMock.retrieveTag.mockResolvedValue(completeTag);
    beeMock.deleteTag.mockResolvedValue(undefined);

    const result = await tool['executeQuery']({ tagId: '1' });

    expect(beeMock.deleteTag).toHaveBeenCalledWith(1);
    expect(result).toEqual(
      getResponseWithStructuredContent({
        processedPercentage: 100,
        message: 'Upload completed successfully.',
        startedAt: completeTag.startedAt,
        tagAddress: completeTag.address,
      })
    );
  });

  it('should continue if tag deletion fails', async () => {
    const completeTag = { ...tagDataMock, synced: 50, seen: 50, split: 100 };
    beeMock.retrieveTag.mockResolvedValue(completeTag);
    beeMock.deleteTag.mockImplementation(() => {
      throw new Error('Deletion failed');
    });

    const result = await tool['executeQuery']({ tagId: '1' });

    expect(beeMock.deleteTag).toHaveBeenCalledWith(1);
    expect(result).toEqual(
      getResponseWithStructuredContent({
        processedPercentage: 100,
        message: 'Upload completed successfully.',
        startedAt: completeTag.startedAt,
        tagAddress: completeTag.address,
      })
    );
  });

  it('should handle not found errors (404)', async () => {
    const error = { status: 404, message: 'Not found' };
    beeMock.retrieveTag.mockImplementation(() => {
      throw error;
    });

    await expect(tool['executeQuery']({ tagId: '999' }))
      .rejects.toThrow(`Tag with ID 999 does not exist or has been deleted. ${GATEWAY_TAG_ERROR_MESSAGE}`);
    
    expect(contextMock.logger.error).toHaveBeenCalledWith(
      `Tag with ID 999 does not exist or has been deleted. ${GATEWAY_TAG_ERROR_MESSAGE}`,
      error
    );
  });

  it('should handle generic errors', async () => {
    const error = new Error('Something went wrong');
    beeMock.retrieveTag.mockImplementation(() => {
      throw error;
    });

    await expect(tool['executeQuery']({ tagId: '1' }))
      .rejects.toThrow('Failed to retrieve upload progress: Something went wrong');

    expect(contextMock.logger.error).toHaveBeenCalledWith(
      'Failed to retrieve upload progress: Something went wrong',
      error
    );
  });
  
  it('should return 0% progress if total is zero', async () => {
    const zeroTotalTag = { ...tagDataMock, synced: 0, seen: 0, split: 0 };
    beeMock.retrieveTag.mockResolvedValue(zeroTotalTag);

    const result = await tool['executeQuery']({ tagId: '1' });

    expect(result).toEqual(
      getResponseWithStructuredContent({
        processedPercentage: 0,
        message: 'Upload progress: 0% processed',
        startedAt: zeroTotalTag.startedAt,
        tagAddress: zeroTotalTag.address,
      })
    );
  });

  it('should return 0% progress if nothing has been processed', async () => {
    const zeroProcessedTag = { ...tagDataMock, synced: 0, seen: 0, split: 100 };
    beeMock.retrieveTag.mockResolvedValue(zeroProcessedTag);

    const result = await tool['executeQuery']({ tagId: '1' });

    expect(result).toEqual(
      getResponseWithStructuredContent({
        processedPercentage: 0,
        message: 'Upload progress: 0% processed',
        startedAt: zeroProcessedTag.startedAt,
        tagAddress: zeroProcessedTag.address,
      })
    );
  });
});
