import { describe, expect, it, beforeEach, jest } from '@jest/globals';
import './SwarmTool.mocks';

import { ExtendPostageStampTool } from '../../tools/ExtendPostageStampTool';
import {
  GATEWAY_STAMP_ERROR_MESSAGE,
  BAD_REQUEST_STATUS,
  NOT_FOUND_STATUS,
} from '../../constants';
import type { HederaAgentKit } from 'hedera-agent-kit';
import { beeMock, contextMock, swarmConfigMock } from './SwarmTool.mocks';
import { BatchId, Duration, Size } from '@ethersphere/bee-js';
import { getErrorMessage } from '../../utils';

describe('ExtendPostageStampTool', () => {
  let tool: ExtendPostageStampTool;
  let hederaKitMock: HederaAgentKit;

  beforeEach(() => {
    jest.clearAllMocks();
    hederaKitMock = {} as HederaAgentKit;

    tool = new ExtendPostageStampTool({
      hederaKit: hederaKitMock,
      config: swarmConfigMock,
      bee: beeMock,
      logger: contextMock.logger,
    });
  });

  it('should throw if postageBatchId is missing', async () => {
    await expect(tool['executeQuery']({ duration: '1w' } as any))
      .rejects.toThrow('Missing required parameter: postageBatchId.');
    expect(contextMock.logger.error).toHaveBeenCalledWith(
      'Missing required parameter: postageBatchId.'
    );
  });

  it('should throw if both duration and size are missing', async () => {
    await expect(tool['executeQuery']({ postageBatchId: 'abc' } as any))
      .rejects.toThrow('You need at least one parameter from duration and size.');
    expect(contextMock.logger.error).toHaveBeenCalledWith(
      'You need at least one parameter from duration and size.'
    );
  });

  it('should throw if duration is invalid', async () => {
    await expect(tool['executeQuery']({ postageBatchId: 'abc', duration: 'xyz' }))
      .rejects.toThrow('Invalid parameter: duration.');
    expect(contextMock.logger.error).toHaveBeenCalledWith(
      'Invalid parameter: duration.'
    );
  });

  it('should return ToolResponse with BatchId on success', async () => {
    const mockHex = 'abcd1234';
    const batchId = { toHex: () => mockHex } as unknown as BatchId;

    beeMock.extendStorage.mockResolvedValue(batchId);

    const result = await tool['executeQuery']({
      postageBatchId: 'batch1',
      size: 10,
      duration: '1d',
    });
    
    expect((result as any).structuredContent.postageBatchId).toBe(mockHex);
  });

  it('should handle NOT_FOUND_STATUS error', async () => {
    const error = new Error('not found');
    (error as any).status = NOT_FOUND_STATUS;

    beeMock.extendStorage.mockImplementation(() => {
      throw error;
    });

    await expect(tool['executeQuery']({ postageBatchId: 'batch1', size: 10 }))
      .rejects.toThrow(GATEWAY_STAMP_ERROR_MESSAGE);

    expect(contextMock.logger.error).toHaveBeenCalledWith(
      GATEWAY_STAMP_ERROR_MESSAGE,
      error
    );
  });

  it('should handle BAD_REQUEST_STATUS error', async () => {
    const error = new Error('Bad request');
    (error as any).status = BAD_REQUEST_STATUS;

    (getErrorMessage as jest.MockedFunction<typeof getErrorMessage>)
      .mockReturnValue('Custom bad request message');

    beeMock.extendStorage.mockImplementation(() => {
      throw error;
    });

    await expect(tool['executeQuery']({ postageBatchId: 'batch1', size: 10 }))
      .rejects.toThrow('Custom bad request message');

    expect(contextMock.logger.error).toHaveBeenCalledWith(
      'Custom bad request message',
      error
    );
  });

  it('should handle generic error', async () => {
    const error = new Error('Generic error');
    beeMock.extendStorage.mockImplementation(() => {
      throw error;
    });

    await expect(tool['executeQuery']({ postageBatchId: 'batch1', size: 10 }))
      .rejects.toThrow('Extend failed.');

    expect(contextMock.logger.error).toHaveBeenCalledWith(
      'Extend failed.',
      error
    );
  });

  it('should use default Size.fromBytes(1) if size is not provided', async () => {
    const batchId = { toHex: () => 'batch123' } as unknown as BatchId;

    const sizeSpy = jest.spyOn(Size, 'fromBytes');
    beeMock.extendStorage.mockResolvedValue(batchId);

    await tool['executeQuery']({ postageBatchId: 'batch1', duration: '1w' });

    expect(sizeSpy).toHaveBeenCalledWith(1);
  });
});
