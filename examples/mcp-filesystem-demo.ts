import * as dotenv from 'dotenv';
import * as path from 'path';
import * as fs from 'fs/promises';
import { ConversationalAgent, MCPServers } from '../src/index';
import { Logger } from '@hashgraphonline/standards-sdk';

dotenv.config();

/**
 * MCP Filesystem Demo
 * Demonstrates using MCP servers to extend agent capabilities with file operations
 */
async function mcpFilesystemDemo(): Promise<void> {
  const logger = new Logger({ module: 'MCPDemo' });

  const accountId = process.env.HEDERA_ACCOUNT_ID;
  const privateKey = process.env.HEDERA_PRIVATE_KEY;
  const openAIApiKey = process.env.OPENAI_API_KEY;

  if (!accountId || !privateKey || !openAIApiKey) {
    throw new Error(
      'Missing required environment variables: HEDERA_ACCOUNT_ID, HEDERA_PRIVATE_KEY, OPENAI_API_KEY'
    );
  }

  const demoDir = path.join(process.cwd(), 'demo-files');

  try {
    await fs.mkdir(demoDir, { recursive: true });
    logger.info(`Created demo directory: ${demoDir}`);

    await new Promise((resolve) => setTimeout(resolve, 100));

    logger.info('Creating ConversationalAgent with MCP filesystem server...');

    const agent = ConversationalAgent.withMCP(
      {
        accountId,
        privateKey,
        openAIApiKey,
        network: 'testnet',
        verbose: false,
        operationalMode: 'autonomous',
      },
      [MCPServers.filesystem(demoDir)]
    );

    await agent.initialize();
    logger.info('Agent initialized with filesystem MCP server');

    const scenarios = [
      {
        name: 'Create a project README',
        message: `Create a README.md file in ${demoDir} with a description of a TypeScript project called "MCP Demo" that showcases Model Context Protocol integration.`,
      },
      {
        name: 'List directory contents',
        message: `List all files in the ${demoDir} directory and show their details.`,
      },
      {
        name: 'Create package.json',
        message: `Create a package.json file for the "MCP Demo" project with basic TypeScript configuration and MCP dependencies.`,
      },
      {
        name: 'Read file contents',
        message: `Read the contents of the README.md file and summarize what the project is about.`,
      },
      {
        name: 'Create source code file',
        message: `Create a TypeScript file called main.ts that demonstrates basic MCP client usage with proper JSDoc comments.`,
      },
    ];

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

        if (scenario.name === 'Create a project README') {
          const readmePath = path.join(demoDir, 'README.md');
          try {
            const content = await fs.readFile(readmePath, 'utf-8');
            logger.info(
              `✅ README.md actually created with ${content.length} characters`
            );
          } catch (fileError) {
            logger.error(`❌ README.md was NOT actually created: ${fileError}`);
          }
        }
      } catch (error) {
        logger.error(`Failed scenario "${scenario.name}":`, error);
      }

      await new Promise((resolve) => setTimeout(resolve, 1000));
    }

    logger.info('\n' + '='.repeat(60));
    logger.info('Demo completed successfully!');
    logger.info('='.repeat(60));

    const files = await fs.readdir(demoDir);
    logger.info(`Files created: ${files.join(', ')}`);

    for (const file of files) {
      const filePath = path.join(demoDir, file);
      const stats = await fs.stat(filePath);
      logger.info(`✅ ${file}: ${stats.size} bytes`);

      if (file.endsWith('.md') || file.endsWith('.ts')) {
        const content = await fs.readFile(filePath, 'utf-8');
        logger.info(
          `📄 ${file} content preview: ${content.substring(0, 100)}...`
        );
      }
    }
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

mcpFilesystemDemo()
  .then(() => {
    console.log('\nMCP Filesystem Demo completed successfully!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Demo failed:', error);
    process.exit(1);
  });
