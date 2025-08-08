import { AgentExecutor } from 'langchain/agents';
import { Logger } from '@hashgraphonline/standards-sdk';

/**
 * Custom AgentExecutor that intercepts large tool outputs and converts them to content references
 * before they are sent to the LLM to avoid token limit issues.
 * 
 * Note: The content reference conversion is already handled in the MCP adapter,
 * so this class currently just extends AgentExecutor without modifications.
 * We keep it as a placeholder for future enhancements.
 */
export class ContentAwareAgentExecutor extends AgentExecutor {
  private logger: Logger;

  constructor(config: any) {
    super(config);
    this.logger = new Logger({ module: 'ContentAwareAgentExecutor' });
  }
}