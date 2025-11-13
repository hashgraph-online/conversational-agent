import { describe, expect, it, beforeEach, jest } from '@jest/globals';
import './SwarmTool.mocks';
import { DownloadFilesTool } from '../../tools/DownloadFilesTool';
import { beeMock, contextMock, swarmConfigMock } from './SwarmTool.mocks';
import { HederaAgentKit } from 'hedera-agent-kit';
import fs from 'fs';
import path from 'path';
import { Bytes, MantarayNode } from '@ethersphere/bee-js';

describe('DownloadFilesTool', () => {
  let tool: DownloadFilesTool;
  const hederaKitMock = {} as HederaAgentKit;

  beforeEach(() => {
    jest.clearAllMocks();

    tool = new DownloadFilesTool({
      hederaKit: hederaKitMock,
      config: swarmConfigMock,
      bee: beeMock,
      logger: contextMock.logger,
    });

    jest.spyOn(console, 'log').mockImplementation(() => {});
  });

  it('throws error if reference is missing', async () => {
    await expect(tool['executeQuery']({ reference: '', filePath: undefined }))
      .rejects.toThrow('Missing required parameter: reference.');

    expect(contextMock.logger.error).toHaveBeenCalledWith(
      'Missing required parameter: reference.'
    );
  });

  it('returns message for non-manifest reference', async () => {
    // MantarayNode.unmarshal throws → treated as non-manifest
    (MantarayNode.unmarshal as unknown as jest.Mock) = jest.fn<any>().mockRejectedValue(new Error('Not manifest'));

    const result = await tool['executeQuery']({ reference: 'abc123' });

    expect(result).toBe(
      'Try swarm-download-data tool instead since the given reference is not a manifest.'
    );
  });

  it('returns manifest file list when filePath not provided', async () => {
    const mockNode = {
      loadRecursively: jest.fn<any>().mockResolvedValue(undefined),
      collect: jest.fn().mockReturnValue([
        {
          fullPathString: '/test.txt',
          targetAddress: Uint8Array.from([1, 2, 3]),
          metadata: { contentType: 'text/plain' },
        },
      ]),
    };

    (MantarayNode.unmarshal as unknown as jest.Mock) = jest.fn<any>().mockResolvedValue(mockNode);

    const result = await tool['executeQuery']({
      reference: 'manifest123',
    });

    const text = JSON.parse(result["content"][0].text);
    expect(text.type).toBe('manifest');
    expect(text.files.length).toBe(1);
    expect(text.files[0].path).toBe('/test.txt');
    expect(text.message).toContain('Provide a filePath to download all files');
  });

  it('downloads single file manifest successfully', async () => {
    const mockNode = {
      loadRecursively: jest.fn<any>().mockResolvedValue(undefined),
      collect: jest.fn().mockReturnValue([
        {
          fullPathString: 'single.txt',
          targetAddress: Uint8Array.from([1, 2, 3]),
        },
      ]),
    };

    (MantarayNode.unmarshal as unknown as jest.Mock) = jest.fn<any>().mockResolvedValue(mockNode);

    const mkdirMock = jest.fn<any>().mockResolvedValue(undefined);
    const writeFileMock = jest.fn<any>().mockResolvedValue(undefined);
    jest.spyOn(require('util'), 'promisify').mockImplementation((fn) => {
      if (fn === fs.mkdir) return mkdirMock;
      if (fn === fs.writeFile) return writeFileMock;
      return fn as any;
    });

    jest.spyOn(fs, 'existsSync').mockReturnValue(true);

    const downloadDataMock = jest.fn().mockReturnValueOnce({
      toUint8Array: () => new Uint8Array([1, 2, 3]),
    });
    (beeMock.downloadData as unknown as jest.Mock).mockImplementation(downloadDataMock);

    const result = await tool['executeQuery']({
      reference: 'manifest123',
      filePath: '/mock/folder',
    });

    expect(mkdirMock).not.toHaveBeenCalled(); // folder already exists
    expect(downloadDataMock).toHaveBeenCalledWith(Uint8Array.from([1, 2, 3]));
    expect(writeFileMock).toHaveBeenCalledWith(
      path.join('/mock/folder', 'single.txt'),
      new Uint8Array([1, 2, 3])
    );

    const text = JSON.parse(result["content"][0].text);
    expect(text.savedTo).toBe('/mock/folder');
    expect(text.message).toContain('successfully downloaded');
  });

  it('downloads multiple files manifest successfully', async () => {
    const mockNodes = [
      {
        fullPathString: 'dir/file1.txt',
        targetAddress: Uint8Array.from([1]),
      },
      {
        fullPathString: 'dir/file2.txt',
        targetAddress: Uint8Array.from([2]),
      },
    ];
    const mockNode = {
      loadRecursively: jest.fn<any>().mockResolvedValue(undefined),
      collect: jest.fn().mockReturnValue(mockNodes),
    };
    (MantarayNode.unmarshal as unknown as jest.Mock) = jest.fn<any>().mockResolvedValue(mockNode);

    const mkdirMock = jest.fn<any>().mockResolvedValue(undefined);
    const writeFileMock = jest.fn<any>().mockResolvedValue(undefined);
    jest.spyOn(require('util'), 'promisify').mockImplementation((fn) => {
      if (fn === fs.mkdir) return mkdirMock;
      if (fn === fs.writeFile) return writeFileMock;
      return fn as any;
    });

    jest
      .spyOn(fs, 'existsSync')
      .mockImplementation((p) => p.toString().includes('dir'));

    const downloadDataMock = jest.fn().mockReturnValue({
      toUint8Array: () => new Uint8Array([5]),
    });
    (beeMock.downloadData as unknown as jest.Mock).mockImplementation(downloadDataMock);

    const result = await tool['executeQuery']({
      reference: 'manifestMulti',
      filePath: '/mock/folder',
    });

    expect(mkdirMock).toHaveBeenCalled(); // at least for subfolder
    expect(writeFileMock).toHaveBeenCalledTimes(2);

    const text = JSON.parse(result["content"][0].text);
    expect(text.manifestNodeCount).toBe(2);
    expect(text.message).toContain('successfully downloaded');
  });
});
