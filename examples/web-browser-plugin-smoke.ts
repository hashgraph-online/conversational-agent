import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';

import { ConversationalAgent } from '../src';
import type { StructuredTool } from '@langchain/core/tools';

function loadEnvCascade() {
  const __file = fileURLToPath(import.meta.url);
  const __dir = path.dirname(__file);
  const candidates = [
    path.resolve(process.cwd(), '.env'),
    path.resolve(__dir, '../.env'),
    path.resolve(__dir, '../../.env'),
    path.resolve(__dir, '../../desktop/.env'),
  ];

  for (const candidate of candidates) {
    try {
      if (fs.existsSync(candidate)) {
        dotenv.config({ path: candidate });
        console.log('[web-browser-smoke] loaded env from', candidate);
        return;
      }
    } catch {}
  }
}

async function main() {
  loadEnvCascade();

  const accountId = process.env.HEDERA_ACCOUNT_ID?.trim();
  const privateKey = process.env.HEDERA_PRIVATE_KEY?.trim();
  const openAIApiKey =
    process.env.OPENAI_API_KEY?.trim() || process.env.OPENAI_KEY?.trim();

  if (!accountId || !privateKey || !openAIApiKey) {
    throw new Error(
      'HEDERA_ACCOUNT_ID, HEDERA_PRIVATE_KEY, and OPENAI_API_KEY (or OPENAI_KEY) must be set before running this smoke test.'
    );
  }

  const agent = new ConversationalAgent({
    accountId,
    privateKey,
    network: 'testnet',
    openAIApiKey,
    openAIModelName: process.env.OPENAI_MODEL || 'gpt-4o-mini',
    operationalMode: 'returnBytes',
    verbose: true,
  });

  let isInitialized = false;

  try {
    console.log('[web-browser-smoke] Initializing agent...');
    await agent.initialize();
    isInitialized = true;
    console.log('[web-browser-smoke] Agent initialized.');

    const targetUrl =
      process.env.WEB_BROWSER_SMOKE_URL || 'https://hedera.com/learning';

    const tools = agent.webBrowserPlugin.getTools();
    const isStructuredTool = (tool: unknown): tool is StructuredTool =>
      !!tool && typeof (tool as StructuredTool).name === 'string' && typeof (tool as StructuredTool).call === 'function';

    const snapshotTool = tools.find(
      (tool): tool is StructuredTool => isStructuredTool(tool) && tool.name === 'web_page_snapshot'
    );

    if (!snapshotTool) {
      throw new Error('web_page_snapshot tool not found in WebBrowserPlugin.');
    }

    console.log('[web-browser-smoke] Invoking web_page_snapshot tool directly...');
    const toolInput = { url: targetUrl, maxCharacters: 400 } as const;

    let toolResult: unknown;
    if (typeof (snapshotTool as { invoke?: unknown }).invoke === 'function') {
      toolResult = await (snapshotTool as StructuredTool & {
        invoke: (input: typeof toolInput) => Promise<unknown>;
      }).invoke(toolInput);
    } else {
      toolResult = await snapshotTool.call(JSON.stringify(toolInput));
    }

    console.log('\n=== Web Browser Plugin Smoke Test ===');
    console.log('URL:', targetUrl);
    console.log('\nTool Output:\n', toolResult);
    console.log('\n[web-browser-smoke] Complete.');
  } finally {
    if (isInitialized) {
      console.log('[web-browser-smoke] Shutting down agent...');
      await agent
        .getAgent()
        .shutdown()
        .then(() => {
          console.log('[web-browser-smoke] Agent shutdown complete.');
        })
        .catch((shutdownError) => {
          console.warn('[web-browser-smoke] Agent shutdown failed:', shutdownError);
        });
    }
  }
}

main()
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    console.error('[web-browser-smoke] Failed:', error);
    process.exit(1);
  });
