import * as dotenv from 'dotenv';
import * as path from 'path';
import * as fs from 'fs/promises';
import { ConversationalAgent, MCPServers } from '../src/index';
import { Logger } from '@hashgraphonline/standards-sdk';
import type { MCPServerConfig } from '../src/mcp/types';

dotenv.config();

/**
 * MCP Multi-Server Demo
 * Demonstrates using multiple MCP servers simultaneously
 */
async function mcpMultiServerDemo(): Promise<void> {
  const logger = new Logger({ module: 'MCPMultiDemo' });
  
  const accountId = process.env.HEDERA_ACCOUNT_ID;
  const privateKey = process.env.HEDERA_PRIVATE_KEY;
  const openAIApiKey = process.env.OPENAI_API_KEY;

  if (!accountId || !privateKey || !openAIApiKey) {
    throw new Error('Missing required environment variables: HEDERA_ACCOUNT_ID, HEDERA_PRIVATE_KEY, OPENAI_API_KEY');
  }

  const demoDir = path.join(process.cwd(), 'multi-mcp-demo');
  
  try {
    await fs.mkdir(demoDir, { recursive: true });
    logger.info(`Created demo directory: ${demoDir}`);

    await new Promise(resolve => setTimeout(resolve, 100));

    logger.info('Creating ConversationalAgent with multiple MCP servers...');
    
    const mcpServers: MCPServerConfig[] = [
      MCPServers.filesystem(demoDir),
    ];

    if (process.env.GITHUB_TOKEN) {
      mcpServers.push(MCPServers.github(process.env.GITHUB_TOKEN));
      logger.info('Added GitHub MCP server');
    } else {
      logger.info('Skipping GitHub MCP server - GITHUB_TOKEN not set');
    }

    const agent = new ConversationalAgent({
      accountId,
      privateKey,
      openAIApiKey,
      network: 'testnet',
      verbose: true,
      operationalMode: 'autonomous',
      mcpServers,
      toolFilter: (tool) => {
        return !tool.name.includes('delete') && !tool.name.includes('remove');
      },
    });

    await agent.initialize();
    logger.info(`Agent initialized with ${mcpServers.length} MCP servers`);

    const scenarios = [
      {
        name: 'List available tools',
        message: 'What file and directory operations can you perform? List all the tools you have access to.',
      },
      {
        name: 'Create project structure',
        message: `Create a basic project structure in ${demoDir} with:
- A README.md explaining the project
- A package.json for a TypeScript project
- A src/ directory with an index.ts file
- A .gitignore file with Node.js patterns`,
      },
      {
        name: 'Analyze project',
        message: `Analyze the project structure we just created. Read all the files and provide a summary of what we have.`,
      },
    ];

    if (process.env.GITHUB_TOKEN) {
      scenarios.push({
        name: 'GitHub repository search',
        message: 'Search for popular TypeScript MCP (Model Context Protocol) repositories on GitHub and tell me about them.',
      });
    }

    for (const scenario of scenarios) {
      logger.info(`\n${'='.repeat(60)}`);
      logger.info(`Scenario: ${scenario.name}`);
      logger.info(`${'='.repeat(60)}`);
      
      console.log(`\nUser: ${scenario.message}`);
      
      try {
        const response = await agent.processMessage(scenario.message);
        console.log(`\nAgent: ${response.output}`);
        
        if (response.error) {
          logger.error(`Error in scenario "${scenario.name}":`, response.error);
        }
      } catch (error) {
        logger.error(`Failed scenario "${scenario.name}":`, error);
      }

      await new Promise(resolve => setTimeout(resolve, 2000));
    }

    logger.info('\n' + '='.repeat(60));
    logger.info('Multi-server demo completed successfully!');
    logger.info('='.repeat(60));

  } catch (error) {
    logger.error('Demo failed:', error);
    throw error;
  } finally {
    try {
      await fs.rm(demoDir, { recursive: true, force: true });
      logger.info('Cleaned up demo directory');
    } catch (cleanupError) {
      logger.error('Failed to clean up demo directory:', cleanupError);
    }
  }
}

mcpMultiServerDemo()
  .then(() => {
    console.log('\nMCP Multi-Server Demo completed successfully!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Demo failed:', error);
    process.exit(1);
  });