import { describe, expect, it, beforeEach, jest } from '@jest/globals';
import './SwarmTool.mocks';

import { CreatePostageStampTool } from '../../tools/CreatePostageStampTool';
import {
  GATEWAY_STAMP_ERROR_MESSAGE,
  BAD_REQUEST_STATUS,
  NOT_FOUND_STATUS,
  POSTAGE_CREATE_TIMEOUT_MESSAGE,
} from '../../constants';
import type { HederaAgentKit } from 'hedera-agent-kit';
import { beeMock, contextMock, swarmConfigMock } from './SwarmTool.mocks';
import { BatchId, Duration, PostageBatch, Size } from '@ethersphere/bee-js';
import { getErrorMessage, runWithTimeout } from '../../utils';

describe('CreatePostageStampTool', () => {
  let tool: CreatePostageStampTool;
  let hederaKitMock: HederaAgentKit;
  const rawBatch = {
    batchID: { toHex: () => 'batch1' },
    usageText: '0%',
    remainingSize: Size.fromMegabytes(1),
    size: Size.fromMegabytes(1),
    immutableFlag: true,
    duration: Duration.fromWeeks(1),
    usable: true
  } as unknown as PostageBatch;

  beforeEach(() => {
    jest.clearAllMocks();
    hederaKitMock = {} as HederaAgentKit;

    tool = new CreatePostageStampTool({
      hederaKit: hederaKitMock,
      config: swarmConfigMock,
      bee: beeMock,
      logger: contextMock.logger,
    });
  });

  it('should throw if size is missing', async () => {
    await expect(tool['executeQuery']({ size: 0, duration: '1w' } as any))
      .rejects.toThrow('Missing required parameter: size.');
    expect(contextMock.logger.error).toHaveBeenCalledWith(
      'Missing required parameter: size.'
    );
  });

  it('should throw if duration is missing', async () => {
    await expect(tool['executeQuery']({ size: 100, duration: '' } as any))
      .rejects.toThrow('Missing required parameter: duration.');
    expect(contextMock.logger.error).toHaveBeenCalledWith(
      'Missing required parameter: duration.'
    );
  });

  it('should throw if duration is invalid', async () => {
    await expect(tool['executeQuery']({ size: 100, duration: 'xyz' }))
      .rejects.toThrow('Invalid parameter: duration.');
    expect(contextMock.logger.error).toHaveBeenCalledWith(
      'Invalid parameter: duration.'
    );
  });

  it('should handle timeout from runWithTimeout', async () => {
    const mockedRunWithTimeout = runWithTimeout as jest.MockedFunction<typeof runWithTimeout>;
    mockedRunWithTimeout.mockResolvedValue([null, true]);

    beeMock.buyStorage.mockReturnValue(Promise.resolve(rawBatch.batchID));

    const result = await tool['executeQuery']({
      size: 100,
      duration: '1w',
    });

    expect(JSON.parse(result as string)).toEqual({
      content: [
        {
          type: 'text',
          text: POSTAGE_CREATE_TIMEOUT_MESSAGE,
        },
      ],
    });
  });

  it('should return ToolResponse with BatchId on success', async () => {
    const mockHex = 'abcd1234';
    const batchId = { toHex: () => mockHex } as unknown as BatchId;
    const mockedRunWithTimeout = runWithTimeout as jest.MockedFunction<typeof runWithTimeout>;
    mockedRunWithTimeout.mockResolvedValue([batchId, false]);
    beeMock.buyStorage.mockReturnValue(Promise.resolve(batchId));

    const result = await tool['executeQuery']({
      size: 10,
      duration: '1d',
      label: 'test-stamp',
    });

    const content = (result as any).content[0];
    expect(content.type).toBe('text');
    expect(content.text).toBe(`Postage batch ID: ${mockHex}`);
  });

  it('should handle NOT_FOUND_STATUS error', async () => {
    const error = new Error('not found');
    (error as any).status = NOT_FOUND_STATUS;
    beeMock.buyStorage.mockImplementation(() => {
      throw error;
    });

    await expect(tool['executeQuery']({ size: 10, duration: '1w' }))
      .rejects.toThrow(GATEWAY_STAMP_ERROR_MESSAGE);

    expect(contextMock.logger.error).toHaveBeenCalledWith(
      GATEWAY_STAMP_ERROR_MESSAGE,
      error
    );
  });

  it('should handle BAD_REQUEST_STATUS error', async () => {
    const error = new Error('Bad request');
    (error as any).status = BAD_REQUEST_STATUS;
    getErrorMessage as jest.MockedFunction<typeof getErrorMessage>;
    (getErrorMessage as jest.Mock).mockReturnValue('Custom bad request message');
    beeMock.buyStorage.mockImplementation(() => {
      throw error;
    });

    await expect(tool['executeQuery']({ size: 10, duration: '1w' }))
      .rejects.toThrow('Custom bad request message');

    expect(contextMock.logger.error).toHaveBeenCalledWith(
      'Custom bad request message',
      error
    );
  });

  it('should handle generic error', async () => {
    const error = new Error('Generic error');
    beeMock.buyStorage.mockImplementation(() => {
      throw error;
    });

    await expect(tool['executeQuery']({ size: 10, duration: '1w' }))
      .rejects.toThrow('Unable to buy storage.');

    expect(contextMock.logger.error).toHaveBeenCalledWith(
      'Unable to buy storage.',
      error
    );
  });
});
