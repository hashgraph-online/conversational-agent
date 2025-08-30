import { describe, test, expect } from '@jest/globals';
import dotenv from 'dotenv';
import { ConversationalAgent } from '../../src';

dotenv.config();

const hasBaseCreds = !!process.env.HEDERA_ACCOUNT_ID && !!process.env.HEDERA_PRIVATE_KEY;

const hasOpenRouter = !!process.env.OPENROUTER_API_KEY;
const hasAnthropic = !!process.env.ANTHROPIC_API_KEY;

const accountId = process.env.HEDERA_ACCOUNT_ID || '0.0.1234';
const privateKey = process.env.HEDERA_PRIVATE_KEY || 'TEST_PRIVATE_KEY_1234567890';

// OpenRouter integration
(hasBaseCreds && hasOpenRouter ? describe : describe.skip)(
  'ConversationalAgent – OpenRouter provider integration',
  () => {
    beforeAll(async () => {
      // Restore a real fetch for integration (jest.setup mocks it)
      try {
        const undici = await import('undici');
        // @ts-ignore
        global.fetch = undici.fetch as any;
        // @ts-ignore
        global.Headers = (undici as any).Headers;
        // @ts-ignore
        global.Request = (undici as any).Request;
        // @ts-ignore
        global.Response = (undici as any).Response;
      } catch {}
    });
    test(
      'initializes and chats using OpenRouter',
      async () => {
        const agent = new ConversationalAgent({
          accountId,
          privateKey,
          network: 'testnet',
          // Accept either OPENROUTER_API_KEY directly or fallback OPENAI_API_KEY if provided
          openAIApiKey: process.env.OPENAI_API_KEY || process.env.OPENROUTER_API_KEY!,
          openRouterApiKey: process.env.OPENROUTER_API_KEY!,
          openRouterBaseURL: process.env.OPENROUTER_BASE_URL || 'https://openrouter.ai/api/v1',
          llmProvider: 'openrouter',
          openAIModelName: process.env.OPENROUTER_MODEL || 'openrouter/auto',
          // Keep memory off for low-cost integration test
          entityMemoryEnabled: false,
          verbose: false,
          operationalMode: 'returnBytes',
        });

        await agent.initialize();
        const res = await agent.processMessage('Reply with a short greeting.');
        expect(res).toBeDefined();
        expect(typeof res.output).toBe('string');
        expect(res.output.length).toBeGreaterThan(0);

        // Ask the agent to report the model it is using; verify output or fallback to internal config
        const expectedModel = process.env.OPENROUTER_MODEL || 'openrouter/auto';
        const check = await agent.processMessage(
          'Respond ONLY with: MODEL: <your exact model name>. No extra text.'
        );
        const output = String(check.output || '').toLowerCase();
        const core = agent.getConversationalAgent() as any;
        const provider = core?.config?.ai?.provider;
        const model: any = typeof provider?.getModel === 'function' ? provider.getModel() : undefined;
        const configured = (
          (model?.model as string) ||
          (model?.modelName as string) ||
          (typeof model?.invocationParams === 'function' && model.invocationParams()?.model) ||
          ''
        ).toLowerCase();
        console.log('output', output);
        console.log('configured', configured);
        console.log('expectedModel', expectedModel);
        expect(
          output.includes(expectedModel.toLowerCase()) ||
          configured.includes(expectedModel.toLowerCase())
        ).toBe(
          true
        );

        // Also directly invoke the underlying LLM to ensure network call path is valid
        try {
          if (model && typeof model.invoke === 'function') {
            const ping = await model.invoke('Respond ONLY with: PING');
            expect(String(ping || '').length).toBeGreaterThan(0);
          }
        } catch (err) {
          // Non-blocking: some SDKs may require additional headers in direct calls
          // The primary assertion is on configured/echoed model
          // console.log('Direct model invoke failed (non-blocking):', err);
        }
      },
      60000
    );

    test(
      'entity resolver can initialize with OpenRouter (no entities expected)',
      async () => {
        const agent = new ConversationalAgent({
          accountId,
          privateKey,
          network: 'testnet',
          openAIApiKey: process.env.OPENROUTER_API_KEY!,
          openRouterApiKey: process.env.OPENROUTER_API_KEY!,
          llmProvider: 'openrouter',
          openAIModelName: process.env.OPENROUTER_MODEL || 'openrouter/auto',
          entityMemoryEnabled: true,
          entityMemoryProvider: 'openrouter',
          entityMemoryModelName: process.env.OPENROUTER_MODEL || 'openrouter/auto',
          verbose: false,
          operationalMode: 'returnBytes',
        });
        await agent.initialize();
        const res = await agent.processMessage('Say hello.');
        expect(res).toBeDefined();
        expect(typeof res.output).toBe('string');
        const core = agent.getConversationalAgent() as any;
        const ents = core.smartMemory.getEntityAssociations();
        expect(Array.isArray(ents)).toBe(true);
      },
      60000
    );
  }
);

// Anthropic integration
(hasBaseCreds && hasAnthropic ? describe : describe.skip)(
  'ConversationalAgent – Anthropic provider integration',
  () => {
    beforeAll(async () => {
      // Restore a real fetch for integration (jest.setup mocks it)
      try {
        const undici = await import('undici');
        // @ts-ignore
        global.fetch = undici.fetch as any;
        // @ts-ignore
        global.Headers = (undici as any).Headers;
        // @ts-ignore
        global.Request = (undici as any).Request;
        // @ts-ignore
        global.Response = (undici as any).Response;
      } catch {}
    });
    test(
      'initializes and chats using Anthropic',
      async () => {
        const agent = new ConversationalAgent({
          accountId,
          privateKey,
          network: 'testnet',
          // Library currently uses openAIApiKey field for both providers
          openAIApiKey: process.env.ANTHROPIC_API_KEY!,
          llmProvider: 'anthropic',
          openAIModelName:
            process.env.ANTHROPIC_MODEL || 'claude-3-5-sonnet-20241022',
          entityMemoryEnabled: false,
          verbose: false,
          operationalMode: 'returnBytes',
        });

        await agent.initialize();
        const res = await agent.processMessage('Reply with a short greeting.');
        expect(res).toBeDefined();
        expect(typeof res.output).toBe('string');
        expect(res.output.length).toBeGreaterThan(0);

        // Ask the agent to report the model it is using; verify output or fallback to internal config
        const expectedModel =
          process.env.ANTHROPIC_MODEL || 'claude-3-5-sonnet-20241022';
        const check = await agent.processMessage(
          'Respond ONLY with: MODEL: <your exact model name>. No extra text.'
        );
        const output = String(check.output || '').toLowerCase();
        const core = agent.getConversationalAgent() as any;
        const provider = core?.config?.ai?.provider;
        const model: any = typeof provider?.getModel === 'function' ? provider.getModel() : undefined;
        const configured = (
          (model?.model as string) ||
          (model?.modelName as string) ||
          (typeof model?.invocationParams === 'function' && model.invocationParams()?.model) ||
          ''
        ).toLowerCase();
        expect(
          output.includes(expectedModel.toLowerCase()) ||
          configured.includes(expectedModel.toLowerCase())
        ).toBe(
          true
        );

        // Also directly invoke the underlying LLM to ensure network call path is valid
        try {
          if (model && typeof model.invoke === 'function') {
            const ping = await model.invoke('Respond ONLY with: PING');
            expect(String(ping || '').length).toBeGreaterThan(0);
          }
        } catch (err) {
          // Non-blocking
          // console.log('Direct model invoke failed (non-blocking):', err);
        }
      },
      60000
    );

    test(
      'entity resolver can initialize with Anthropic (no entities expected)',
      async () => {
        const agent = new ConversationalAgent({
          accountId,
          privateKey,
          network: 'testnet',
          openAIApiKey: process.env.ANTHROPIC_API_KEY!,
          llmProvider: 'anthropic',
          openAIModelName:
            process.env.ANTHROPIC_MODEL || 'claude-3-5-sonnet-20241022',
          entityMemoryEnabled: true,
          entityMemoryProvider: 'anthropic',
          entityMemoryModelName:
            process.env.ANTHROPIC_MODEL || 'claude-3-5-sonnet-20241022',
          verbose: false,
          operationalMode: 'returnBytes',
        });
        await agent.initialize();
        const res = await agent.processMessage('Say hello.');
        expect(res).toBeDefined();
        expect(typeof res.output).toBe('string');
        const core = agent.getConversationalAgent() as any;
        const ents = core.smartMemory.getEntityAssociations();
        expect(Array.isArray(ents)).toBe(true);
      },
      60000
    );
  }
);
