import { describe, expect, it, beforeEach, jest } from '@jest/globals';
import './SwarmTool.mocks';

import { ListPostageStampsTool } from '../../tools/ListPostageStampsTool';
import { GATEWAY_STAMP_ERROR_MESSAGE, NOT_FOUND_STATUS } from '../../constants';
import type { HederaAgentKit } from 'hedera-agent-kit';
import { beeMock, contextMock, swarmConfigMock } from './SwarmTool.mocks';
import { PostageBatch, Duration, Size } from '@ethersphere/bee-js';
import { PostageBatchCurated, PostageBatchSummary, ResponseContent } from '../../model';
import type { ToolResponse } from '../../utils';

describe('ListPostageStampsTool', () => {
  let tool: ListPostageStampsTool;
  let hederaKitMock: HederaAgentKit;
  const rawBatch = {
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

    tool = new ListPostageStampsTool({
      hederaKit: hederaKitMock,
      config: swarmConfigMock,
      bee: beeMock,
      logger: contextMock.logger,
    });
  });

  it('should handle Bee.getPostageBatches not found error', async () => {
    const error = new Error('Not found');
    (error as any).status = NOT_FOUND_STATUS;
    beeMock.getPostageBatches.mockRejectedValue(error);

    await expect(tool['executeQuery']({}))
      .rejects.toThrow(GATEWAY_STAMP_ERROR_MESSAGE);
    expect(contextMock.logger.error).toHaveBeenCalledWith(
      GATEWAY_STAMP_ERROR_MESSAGE,
      error
    );
  });

  it('should handle Bee.getPostageBatches other errors', async () => {
    const error = new Error('Server error');
    beeMock.getPostageBatches.mockRejectedValue(error);

    await expect(tool['executeQuery']({}))
      .rejects.toThrow('Retrieval of postage batches failed.');
    expect(contextMock.logger.error).toHaveBeenCalledWith(
      'Retrieval of postage batches failed.',
      error
    );
  });

  it('should return all usable postage batches by default', async () => {
    const mockBatches = [
      {
        ...rawBatch,
        batchID: { toHex: () => 'batch1' },
      },
      {
        ...rawBatch,
        batchID: { toHex: () => 'batch2' },
        usable: false
      },
      {
        ...rawBatch,
        batchID: { toHex: () => 'batch3' },
      },
    ] as unknown as PostageBatch[];

    beeMock.getPostageBatches.mockResolvedValue(mockBatches);

    const result = await tool['executeQuery']({}) as ToolResponse;
    const structured = result.structuredContent as ResponseContent<
      PostageBatchCurated[],
      PostageBatchSummary[]
    >;

    // Expect only usable batches (2 total)
    expect(structured.raw.length).toBe(2);
    expect(structured.raw.map(b => b.batchID)).toEqual(['batch1', 'batch3']);
  });

  it('should filter by minUsage and maxUsage', async () => {
    const mockBatches = [
      {
        ...rawBatch,
        batchID: { toHex: () => 'a' },
        usable: true,
        usage: 0.1
      },
      {
        ...rawBatch,
        batchID: { toHex: () => 'b' }, 
        usable: true, 
        usage: 0.5
      },
      {
        ...rawBatch,
        batchID: { toHex: () => 'c' }, 
        usable: true, 
        usage: 0.9
      },
    ] as unknown as PostageBatch[];

    beeMock.getPostageBatches.mockResolvedValue(mockBatches);

    const result = await tool['executeQuery']({
      minUsage: 30,
      maxUsage: 80,
    }) as ToolResponse;

    const structured = result.structuredContent as ResponseContent<
      PostageBatchCurated[],
      PostageBatchSummary[]
    >;

    expect(structured.raw.map(b => b.batchID)).toEqual(['b']);
  });
  
  it('should sort by least used when leastUsed = true', async () => {
    const mockBatches = [
      {
        ...rawBatch,
        batchID: { toHex: () => 'a' },
        usable: true,
        usage: 0.9
      },
      {
        ...rawBatch,
        batchID: { toHex: () => 'b' },
        usable: true,
        usage: 0.1
      },
      {
        ...rawBatch,
        batchID: { toHex: () => 'c' },
        usable: true,
        usage: 0.5
      },
    ] as unknown as PostageBatch[];

    beeMock.getPostageBatches.mockResolvedValue(mockBatches);

    const result = await tool['executeQuery']({
      leastUsed: true,
    }) as ToolResponse;

    const structured = result.structuredContent as ResponseContent<
      PostageBatchCurated[],
      PostageBatchSummary[]
    >;

    expect(structured.raw.map(b => b.batchID)).toEqual(['b', 'c', 'a']);
  });

  it('should limit the number of returned batches when limit is set', async () => {
    const mockBatches = [
      {
        ...rawBatch,
        batchID: { toHex: () => 'a' },
        usable: true,
        usage: 0.1
      },
      {
        ...rawBatch,
        batchID: { toHex: () => 'b' },
        usable: true,
        usage: 0.2
      },
      {
        ...rawBatch,
        batchID: { toHex: () => 'c' },
        usable: true,
        usage: 0.3
      },
    ] as unknown as PostageBatch[];

    beeMock.getPostageBatches.mockResolvedValue(mockBatches);

    const result = await tool['executeQuery']({ limit: 2 }) as ToolResponse;
    const structured = result.structuredContent as ResponseContent<
      PostageBatchCurated[],
      PostageBatchSummary[]
    >;

    expect(structured.raw.length).toBe(2);
  });

  it('should return structured response on success', async () => {
    const mockBatches = [
      {
        ...rawBatch,
        batchID: { toHex: () => 'x' },
        usable: true,
        usage: 0.4
      },
    ] as unknown as PostageBatch[];

    beeMock.getPostageBatches.mockResolvedValue(mockBatches);

    const result = await tool['executeQuery']({}) as ToolResponse;
    const structured = result.structuredContent as ResponseContent<
      PostageBatchCurated[],
      PostageBatchSummary[]
    >;

    expect(structured.raw[0].batchID).toBe('x');
    expect(Array.isArray(structured.summary)).toBe(true);
    expect(structured.summary.length).toBe(1);
  });
});
