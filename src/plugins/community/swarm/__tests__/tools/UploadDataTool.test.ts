import { describe, expect, it, beforeEach, jest } from '@jest/globals';
import './SwarmTool.mocks';
import { UploadDataTool } from '../../tools/UploadDataTool';
import { beeMock, contextMock, mockedUtils, swarmConfigMock } from './SwarmTool.mocks';
import { HederaAgentKit } from 'hedera-agent-kit';
import { Reference, UploadResult } from '@ethersphere/bee-js';
import { BAD_REQUEST_STATUS } from '../../constants';

describe('UploadDataTool', () => {
  let tool: UploadDataTool;
  const hederaKitMock = {} as HederaAgentKit;

  beforeEach(() => {
    jest.clearAllMocks();

    tool = new UploadDataTool({
      hederaKit: hederaKitMock,
      config: swarmConfigMock,
      bee: beeMock,
      logger: contextMock.logger,
    });

    // Mock successful postage batch ID fetch
    mockedUtils.getUploadPostageBatchId.mockResolvedValue('postage123');

    // Mock upload result
    const reference = { toString: () => 'data123' } as unknown as Reference;
    const uploadResult = { reference } as unknown as UploadResult;
    beeMock.uploadData.mockResolvedValue(uploadResult);
  });

  it('uploads simple data successfully', async () => {
    const result = await tool['executeQuery']({ data: 'hello swarm' });

    expect(mockedUtils.getUploadPostageBatchId).toHaveBeenCalledWith(
      undefined,
      beeMock,
      swarmConfigMock
    );

    expect(beeMock.uploadData).toHaveBeenCalledWith(
      'postage123',
      expect.any(Buffer),
      undefined
    );

    expect(result['structuredContent']).toEqual(
      expect.objectContaining({
        reference: 'data123',
        url: 'http://127.0.0.1:1633/bytes/data123',
        message: 'Data successfully uploaded to Swarm',
      })
    );
  });

  it('uploads data with redundancy level', async () => {
    const result = await tool['executeQuery']({
      data: 'redundant swarm data',
      redundancyLevel: 3,
    });

    expect(beeMock.uploadData).toHaveBeenCalledWith(
      'postage123',
      expect.any(Buffer),
      { redundancyLevel: 3 }
    );

    expect(result['structuredContent'].message).toBe(
      'Data successfully uploaded to Swarm'
    );
  });

  it('throws error if data is missing', async () => {
    await expect(
      tool['executeQuery']({ data: '' })
    ).rejects.toThrow('Missing required parameter: data.');

    expect(contextMock.logger.error).toHaveBeenCalledWith(
      'Missing required parameter: data.'
    );
  });

  it('throws error if getUploadPostageBatchId fails', async () => {
    const error = new Error('Failed to get postage batch');
    mockedUtils.getUploadPostageBatchId.mockRejectedValue(error);

    await expect(tool['executeQuery']({ data: 'abc' })).rejects.toThrow(
      'Failed to get postage batch'
    );

    expect(contextMock.logger.error).toHaveBeenCalledWith('Failed to get postage batch');
  });

  it('handles uploadData error gracefully', async () => {
    const error = new Error('Upload failed');
    beeMock.uploadData.mockRejectedValueOnce(error);

    await expect(tool['executeQuery']({ data: 'abc' })).rejects.toThrow(
      'Unable to upload data.'
    );

    expect(contextMock.logger.error).toHaveBeenCalledWith(
      'Unable to upload data.',
      error
    );
  });

  it('handles BAD_REQUEST_STATUS errors using getErrorMessage', async () => {
    const error = new Error();
    (error as any).status = BAD_REQUEST_STATUS;
    beeMock.uploadData.mockRejectedValueOnce(error);

    mockedUtils.getErrorMessage.mockReturnValue('Bad request: malformed data');

    await expect(tool['executeQuery']({ data: 'abc' })).rejects.toThrow(
      'Bad request: malformed data'
    );

    expect(mockedUtils.getErrorMessage).toHaveBeenCalledWith(error);
    expect(contextMock.logger.error).toHaveBeenCalledWith(
      'Bad request: malformed data',
      error
    );
  });
});
