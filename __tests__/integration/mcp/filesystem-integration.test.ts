import { describe, test, expect, beforeEach, afterEach } from '@jest/globals';
import { ConversationalAgent } from '../../../src/conversational-agent';
import { mkdirSync, existsSync, rmSync, writeFileSync, readFileSync } from 'node:fs';
import * as fsPromises from 'node:fs/promises';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import * as os from 'os';
import { TEST_MCP_DATA } from '../../test-constants';

const __filename = fileURLToPath(import.meta.url);
const testDirname = dirname(__filename);

describe('MCP Filesystem Integration', () => {
  let agent: ConversationalAgent;
  let testDir: string;
  
  beforeEach(async () => {
    testDir = path.join(os.tmpdir(), 'mcp-test');
    mkdirSync(testDir, { recursive: true });

    agent = new ConversationalAgent({
      accountId: TEST_MCP_DATA.DEFAULT_ACCOUNT_ID,
      privateKey: TEST_MCP_DATA.MOCK_PRIVATE_KEY,
      openAIApiKey: 'sk-test',
      mcpServers: [
        {
          name: TEST_MCP_DATA.FILESYSTEM_SERVER,
          command: TEST_MCP_DATA.NPX_COMMAND,
          args: [TEST_MCP_DATA.MINUS_Y_FLAG, TEST_MCP_DATA.SERVER_FILESYSTEM_PACKAGE, testDir],
          transport: TEST_MCP_DATA.STDIO_TRANSPORT,
          autoConnect: true,
        },
      ],
    });
  });

  afterEach(async () => {
    try {
      if (agent) {
        await agent.getAgent().shutdown();
      }
    } catch (_error) {
    }

    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true });
    }
  });

  test('Can create agent with MCP filesystem server', async () => {
    if (!process.env.OPENAI_API_KEY) {
      console.log(TEST_MCP_DATA.OPENAI_SKIP_MESSAGE);
      return;
    }

    agent = new ConversationalAgent({
      accountId: process.env.HEDERA_ACCOUNT_ID || TEST_MCP_DATA.DEFAULT_ACCOUNT_ID,
      privateKey: process.env.HEDERA_PRIVATE_KEY || TEST_MCP_DATA.MOCK_KEY,
      openAIApiKey: process.env.OPENAI_API_KEY,
      mcpServers: [
        {
          name: TEST_MCP_DATA.FILESYSTEM_SERVER,
          command: TEST_MCP_DATA.NPX_COMMAND,
          args: [TEST_MCP_DATA.MINUS_Y_FLAG, TEST_MCP_DATA.SERVER_FILESYSTEM_PACKAGE, testDir],
          transport: TEST_MCP_DATA.STDIO_TRANSPORT,
          autoConnect: true,
        },
      ],
    });

    await agent.initialize();

    await fsPromises.writeFile(path.join(testDir, 'test1.txt'), 'Hello World');
    await fsPromises.writeFile(path.join(testDir, 'test2.txt'), 'Another file');

    const response = await agent.processMessage(
      `List the files in ${testDir}`
    );

    expect(response).toBeDefined();
    expect(response.output).toBeDefined();
    console.log('Response:', response.output);
  }, 30000);

  test('Can read file contents through MCP', async () => {
    if (!process.env.OPENAI_API_KEY) {
      console.log(TEST_MCP_DATA.OPENAI_SKIP_MESSAGE);
      return;
    }

    agent = new ConversationalAgent({
      accountId: process.env.HEDERA_ACCOUNT_ID || TEST_MCP_DATA.DEFAULT_ACCOUNT_ID,
      privateKey: process.env.HEDERA_PRIVATE_KEY || TEST_MCP_DATA.MOCK_KEY,
      openAIApiKey: process.env.OPENAI_API_KEY,
      mcpServers: [
        {
          name: TEST_MCP_DATA.FILESYSTEM_SERVER,
          command: TEST_MCP_DATA.NPX_COMMAND,
          args: [TEST_MCP_DATA.MINUS_Y_FLAG, TEST_MCP_DATA.SERVER_FILESYSTEM_PACKAGE, testDir],
          transport: TEST_MCP_DATA.STDIO_TRANSPORT,
          autoConnect: true,
        },
      ],
    });

    await agent.initialize();

    const testContent = 'This is test content for MCP file reading';
    const testFile = path.join(testDir, 'read-test.txt');
    writeFileSync(testFile, testContent);

    const response = await agent.processMessage(
      `Read the contents of the file ${testFile}`
    );

    expect(response).toBeDefined();
    expect(response.output).toBeDefined();
    console.log('Response:', response.output);
  }, 30000);

  test('Can write file through MCP', async () => {
    if (!process.env.OPENAI_API_KEY) {
      console.log(TEST_MCP_DATA.OPENAI_SKIP_MESSAGE);
      return;
    }

    agent = new ConversationalAgent({
      accountId: process.env.HEDERA_ACCOUNT_ID || TEST_MCP_DATA.DEFAULT_ACCOUNT_ID,
      privateKey: process.env.HEDERA_PRIVATE_KEY || TEST_MCP_DATA.MOCK_KEY,
      openAIApiKey: process.env.OPENAI_API_KEY,
      mcpServers: [
        {
          name: TEST_MCP_DATA.FILESYSTEM_SERVER,
          command: TEST_MCP_DATA.NPX_COMMAND,
          args: [TEST_MCP_DATA.MINUS_Y_FLAG, TEST_MCP_DATA.SERVER_FILESYSTEM_PACKAGE, testDir],
          transport: TEST_MCP_DATA.STDIO_TRANSPORT,
          autoConnect: true,
        },
      ],
    });

    await agent.initialize();

    const testFile = path.join(testDir, 'write-test.txt');
    const testContent = 'Content written through MCP!';

    const response = await agent.processMessage(
      `Write the text "${testContent}" to the file ${testFile}`
    );

    expect(response).toBeDefined();
    expect(response.output).toBeDefined();

    expect(existsSync(testFile)).toBe(true);
    const actualContent = readFileSync(testFile, 'utf8');
    expect(actualContent).toContain(testContent);
  }, 30000);

  test('Handles non-existent file gracefully', async () => {
    if (!process.env.OPENAI_API_KEY) {
      console.log(TEST_MCP_DATA.OPENAI_SKIP_MESSAGE);
      return;
    }

    agent = new ConversationalAgent({
      accountId: process.env.HEDERA_ACCOUNT_ID || TEST_MCP_DATA.DEFAULT_ACCOUNT_ID,
      privateKey: process.env.HEDERA_PRIVATE_KEY || TEST_MCP_DATA.MOCK_KEY,
      openAIApiKey: process.env.OPENAI_API_KEY,
      mcpServers: [
        {
          name: TEST_MCP_DATA.FILESYSTEM_SERVER,
          command: TEST_MCP_DATA.NPX_COMMAND,
          args: [TEST_MCP_DATA.MINUS_Y_FLAG, TEST_MCP_DATA.SERVER_FILESYSTEM_PACKAGE, testDir],
          transport: TEST_MCP_DATA.STDIO_TRANSPORT,
          autoConnect: true,
        },
      ],
    });

    await agent.initialize();

    const nonExistentFile = path.join(testDir, 'does-not-exist.txt');

    const response = await agent.processMessage(
      `Read the contents of ${nonExistentFile}`
    );

    expect(response).toBeDefined();
    expect(response.output).toBeDefined();
    console.log('Response for non-existent file:', response.output);
  });
});