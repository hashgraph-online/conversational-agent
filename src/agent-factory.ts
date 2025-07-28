import { BaseAgent, type HederaAgentConfiguration } from './base-agent';
import { LangChainAgent } from './langchain-agent';

export function createAgent(
  config: HederaAgentConfiguration & {
    framework?: 'langchain' | 'vercel' | 'baml';
  }
): BaseAgent {
  const framework = config.framework || 'langchain';

  switch (framework) {
    case 'langchain':
      return new LangChainAgent(config);
    case 'vercel':
      throw new Error('Vercel AI SDK support coming soon');
    case 'baml':
      throw new Error('BAML support coming soon');
    default:
      throw new Error(`Unknown framework: ${framework}`);
  }
}