import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ConversationalAgent } from '../../../src/conversational-agent';
import { MCPServers } from '../../../src/mcp/helpers';
import * as fs from 'fs/promises';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import * as os from 'os';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

describe('MCP Filesystem Integration', () => {
  let agent: ConversationalAgent;
  let testDir: string;
  
  beforeEach(async () => {
    testDir = path.join(os.tmpdir(), 'mcp-test');
    fs.mkdirSync(testDir, { recursive: true });

    agent = new ConversationalAgent({
      accountId: '0.0.12345',
      privateKey: 'mock-private-key',
      openAIApiKey: 'sk-test',
      mcpServers: [
        {
          name: 'filesystem',
          command: 'npx',
          args: ['-y', '@modelcontextprotocol/server-filesystem', testDir],
          transport: 'stdio',
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
    } catch (error) {
    }

    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
  });

  test('Can create agent with MCP filesystem server', async () => {
    if (!process.env.OPENAI_API_KEY) {
      console.log('Skipping test: OPENAI_API_KEY not set');
      return;
    }

    agent = new ConversationalAgent({
      accountId: process.env.HEDERA_ACCOUNT_ID || '0.0.12345',
      privateKey: process.env.HEDERA_PRIVATE_KEY || 'mock-key',
      openAIApiKey: process.env.OPENAI_API_KEY,
      mcpServers: [
        {
          name: 'filesystem',
          command: 'npx',
          args: ['-y', '@modelcontextprotocol/server-filesystem', testDir],
          transport: 'stdio',
          autoConnect: true,
        },
      ],
    });

    await agent.initialize();

    fs.writeFileSync(path.join(testDir, 'test1.txt'), 'Hello World');
    fs.writeFileSync(path.join(testDir, 'test2.txt'), 'Another file');

    const response = await agent.processMessage(
      `List the files in ${testDir}`
    );

    expect(response).toBeDefined();
    expect(response.output).toBeDefined();
    console.log('Response:', response.output);
  }, 30000);

  test('Can read file contents through MCP', async () => {
    if (!process.env.OPENAI_API_KEY) {
      console.log('Skipping test: OPENAI_API_KEY not set');
      return;
    }

    agent = new ConversationalAgent({
      accountId: process.env.HEDERA_ACCOUNT_ID || '0.0.12345',
      privateKey: process.env.HEDERA_PRIVATE_KEY || 'mock-key',
      openAIApiKey: process.env.OPENAI_API_KEY,
      mcpServers: [
        {
          name: 'filesystem',
          command: 'npx',
          args: ['-y', '@modelcontextprotocol/server-filesystem', testDir],
          transport: 'stdio',
          autoConnect: true,
        },
      ],
    });

    await agent.initialize();

    const testContent = 'This is test content for MCP file reading';
    const testFile = path.join(testDir, 'read-test.txt');
    fs.writeFileSync(testFile, testContent);

    const response = await agent.processMessage(
      `Read the contents of the file ${testFile}`
    );

    expect(response).toBeDefined();
    expect(response.output).toBeDefined();
    console.log('Response:', response.output);
  }, 30000);

  test('Can write file through MCP', async () => {
    if (!process.env.OPENAI_API_KEY) {
      console.log('Skipping test: OPENAI_API_KEY not set');
      return;
    }

    agent = new ConversationalAgent({
      accountId: process.env.HEDERA_ACCOUNT_ID || '0.0.12345',
      privateKey: process.env.HEDERA_PRIVATE_KEY || 'mock-key',
      openAIApiKey: process.env.OPENAI_API_KEY,
      mcpServers: [
        {
          name: 'filesystem',
          command: 'npx',
          args: ['-y', '@modelcontextprotocol/server-filesystem', testDir],
          transport: 'stdio',
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

    expect(fs.existsSync(testFile)).toBe(true);
    const actualContent = fs.readFileSync(testFile, 'utf8');
    expect(actualContent).toContain(testContent);
  }, 30000);

  test('Handles non-existent file gracefully', async () => {
    if (!process.env.OPENAI_API_KEY) {
      console.log('Skipping test: OPENAI_API_KEY not set');
      return;
    }

    agent = new ConversationalAgent({
      accountId: process.env.HEDERA_ACCOUNT_ID || '0.0.12345',
      privateKey: process.env.HEDERA_PRIVATE_KEY || 'mock-key',
      openAIApiKey: process.env.OPENAI_API_KEY,
      mcpServers: [
        {
          name: 'filesystem',
          command: 'npx',
          args: ['-y', '@modelcontextprotocol/server-filesystem', testDir],
          transport: 'stdio',
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