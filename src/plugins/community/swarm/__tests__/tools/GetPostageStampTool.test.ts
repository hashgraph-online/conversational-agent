import { describe, expect, it, beforeEach, jest } from '@jest/globals';
import './SwarmTool.mocks';
import { GetPostageStampTool } from '../../tools/GetPostageStampTool';
import { GATEWAY_STAMP_ERROR_MESSAGE, NOT_FOUND_STATUS } from '../../constants';
import type { HederaAgentKit } from 'hedera-agent-kit';
import { beeMock, contextMock, swarmConfigMock } from './SwarmTool.mocks';
import { Duration, PostageBatch, Size } from '@ethersphere/bee-js';
import { PostageBatchCurated, PostageBatchSummary, ResponseContent } from '../../model';
import { ToolResponse } from '../../utils';

describe('GetPostageStampTool', () => {
  let tool: GetPostageStampTool;
  let hederaKitMock: HederaAgentKit;

  beforeEach(() => {
    jest.clearAllMocks();

    hederaKitMock = {} as HederaAgentKit;

    tool = new GetPostageStampTool({
      hederaKit: hederaKitMock,
      config: swarmConfigMock,
      bee: beeMock,
      logger: contextMock.logger,
    });
  });

  it('should throw an error if postageBatchId is missing', async () => {
    await expect(tool['executeQuery']({ postageBatchId: '' }))
      .rejects.toThrow('Missing required parameter: postageBatchId.');
    expect(contextMock.logger.error).toHaveBeenCalledWith(
      'Missing required parameter: postageBatchId.'
    );
  });

  it('should handle Bee getPostageBatch not found error', async () => {
    const error = new Error('Not found');
    (error as any).status = NOT_FOUND_STATUS;
    beeMock.getPostageBatch.mockRejectedValue(error);

    await expect(tool['executeQuery']({ postageBatchId: '123' }))
      .rejects.toThrow(GATEWAY_STAMP_ERROR_MESSAGE);
    expect(contextMock.logger.error).toHaveBeenCalledWith(
      GATEWAY_STAMP_ERROR_MESSAGE,
      error
    );
  });

  it('should handle Bee getPostageBatch other errors', async () => {
    const error = new Error('Server error');
    beeMock.getPostageBatch.mockRejectedValue(error);

    await expect(tool['executeQuery']({ postageBatchId: '123' }))
      .rejects.toThrow('Retrieval of postage batch failed.');
    expect(contextMock.logger.error).toHaveBeenCalledWith(
      'Retrieval of postage batch failed.',
      error
    );
  });
  
  it('should return structured response on success', async () => {
    const batchId = 'abc123';
    const rawBatch = {
      batchID: { toHex: () => batchId },
      usageText: '0%',
      remainingSize: Size.fromMegabytes(1),
      size: Size.fromMegabytes(1),
      immutableFlag: true,
      duration: Duration.fromWeeks(1)
    } as unknown as PostageBatch;

    beeMock.getPostageBatch.mockResolvedValue(rawBatch);

    const result = await tool['executeQuery']({ postageBatchId: batchId }) as ToolResponse;

    // Extract structured content from response
    const structured = result.structuredContent as ResponseContent<PostageBatchCurated, PostageBatchSummary>;

    expect(structured.raw.batchID).toBe(batchId);
    expect(structured.summary.stampID).toEqual(batchId);
    expect(structured.summary.capacity).toEqual('1.000 MB remaining out of 1.000 MB');
  });
});