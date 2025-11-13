import { describe, expect, it, beforeEach, jest } from '@jest/globals';
import './SwarmTool.mocks';
import { DownloadDataTool } from '../../tools/DownloadDataTool';
import { beeMock, contextMock, mockedUtils, swarmConfigMock } from './SwarmTool.mocks';
import { HederaAgentKit } from 'hedera-agent-kit';
import { BAD_REQUEST_STATUS } from '../../constants';

describe('DownloadDataTool', () => {
  let tool: DownloadDataTool;
  const hederaKitMock = {} as HederaAgentKit;

  beforeEach(() => {
    jest.clearAllMocks();

    tool = new DownloadDataTool({
      hederaKit: hederaKitMock,
      config: swarmConfigMock,
      bee: beeMock,
      logger: contextMock.logger,
    });
    
    const downloadDataMock = jest.fn().mockReturnValue({
      toUtf8: jest.fn(() => 'hello swarm data'),
    });
    (beeMock.downloadData as unknown as jest.Mock).mockImplementation(downloadDataMock);
  });

  it('downloads data successfully', async () => {
    const reference = 'a'.repeat(64); // valid swarm reference

    const result = await tool['executeQuery']({ reference });

    expect(result).toEqual(
      expect.objectContaining({
        structuredContent: { textData: 'hello swarm data' },
      })
    );
  });

  it('throws error if reference is missing', async () => {
    await expect(tool['executeQuery']({ reference: '' })).rejects.toThrow(
      'Missing required parameter: reference.'
    );

    expect(contextMock.logger.error).toHaveBeenCalledWith(
      'Missing required parameter: reference.'
    );
  });

  it('throws error if reference is invalid length', async () => {
    const reference = 'abc123'; // invalid
    await expect(tool['executeQuery']({ reference })).rejects.toThrow(
      'Invalid Swarm content address hash value for reference.'
    );

    expect(contextMock.logger.error).toHaveBeenCalledWith(
      'Invalid Swarm content address hash value for reference.'
    );
  });

  it('handles generic download error', async () => {
    const reference = 'b'.repeat(64);
    const error = new Error('Download failed');
    beeMock.downloadData.mockRejectedValueOnce(error);

    await expect(tool['executeQuery']({ reference })).rejects.toThrow(
      'Downloading data failed.'
    );

    expect(contextMock.logger.error).toHaveBeenCalledWith(
      'Downloading data failed.',
      error
    );
  });

  it('handles BAD_REQUEST_STATUS error with getErrorMessage', async () => {
    const reference = 'c'.repeat(64);
    const error = { status: BAD_REQUEST_STATUS };

    beeMock.downloadData.mockRejectedValueOnce(error);
    mockedUtils.getErrorMessage.mockReturnValue('Bad request: invalid data');

    await expect(tool['executeQuery']({ reference })).rejects.toThrow(
      'Bad request: invalid data'
    );

    expect(mockedUtils.getErrorMessage).toHaveBeenCalledWith(error);
    expect(contextMock.logger.error).toHaveBeenCalledWith(
      'Bad request: invalid data',
      error
    );
  });
});
