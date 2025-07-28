# MCP (Model Context Protocol) Integration Guide

## Overview

The Conversational Agent supports MCP (Model Context Protocol) servers, allowing you to extend agent capabilities with external tools and data sources. MCP is a standardized protocol for connecting AI models to various services and APIs.

## Quick Start

### Basic Setup

```typescript
import { ConversationalAgent, MCPServers } from '@hashgraphonline/conversational-agent';

// Create an agent with MCP servers
const agent = ConversationalAgent.withMCP(
  {
    accountId: '0.0.123456',
    privateKey: 'your-private-key',
    openAIApiKey: 'your-openai-key',
  },
  [
    MCPServers.filesystem('/tmp'),
    MCPServers.github('your-github-token'),
  ]
);

await agent.initialize();
```

### Manual Configuration

```typescript
const agent = new ConversationalAgent({
  accountId: '0.0.123456',
  privateKey: 'your-private-key',
  openAIApiKey: 'your-openai-key',
  mcpServers: [
    {
      name: 'filesystem',
      command: 'npx',
      args: ['-y', '@modelcontextprotocol/server-filesystem', '/tmp'],
      transport: 'stdio',
      autoConnect: true,
    }
  ],
});
```

## Available MCP Servers

### Built-in Configurations

The package provides pre-configured MCP servers through the `MCPServers` helper:

```typescript
// Filesystem operations
MCPServers.filesystem('/path/to/directory')

// GitHub repository operations
MCPServers.github('github-token')

// Slack messaging
MCPServers.slack('slack-token')

// Google Drive documents
MCPServers.googleDrive('credentials-json')

// PostgreSQL database
MCPServers.postgres('postgresql://user:pass@host/db')

// SQLite database
MCPServers.sqlite('/path/to/database.db')

// Custom server
MCPServers.custom({
  name: 'my-server',
  command: 'my-mcp-server',
  args: ['--port', '3000'],
  transport: 'http',
})
```

## Configuration Options

### MCPServerConfig

```typescript
interface MCPServerConfig {
  name: string;              // Unique server identifier
  command: string;           // Command to start the server
  args: string[];           // Command arguments
  env?: Record<string, string>; // Environment variables
  transport?: 'stdio' | 'http' | 'websocket'; // Transport type (default: 'stdio')
  autoConnect?: boolean;     // Auto-connect on agent initialization (default: true)
}
```

### ConversationalAgentOptions

```typescript
interface ConversationalAgentOptions {
  // ... existing options ...
  mcpServers?: MCPServerConfig[];
}
```

## Examples

### File Management Agent

```typescript
const fileAgent = ConversationalAgent.withMCP(
  baseOptions,
  [MCPServers.filesystem('/home/user/documents')]
);

await fileAgent.initialize();

// Now the agent can read, write, and manage files
const response = await fileAgent.processMessage(
  'Create a new file called notes.txt with my meeting notes'
);
```

### GitHub Integration

```typescript
const githubAgent = ConversationalAgent.withMCP(
  baseOptions,
  [MCPServers.github(process.env.GITHUB_TOKEN)]
);

await githubAgent.initialize();

// Agent can now interact with GitHub
const response = await githubAgent.processMessage(
  'Create an issue in my repository about the bug we discussed'
);
```

### Multiple Servers

```typescript
const multiAgent = new ConversationalAgent({
  ...baseOptions,
  mcpServers: [
    MCPServers.filesystem('/tmp'),
    MCPServers.postgres('postgresql://localhost/mydb'),
    MCPServers.slack(process.env.SLACK_TOKEN),
  ],
});

// Agent has access to files, database, and Slack
```

## Advanced Usage

### Selective Connection

```typescript
const agent = new ConversationalAgent({
  ...baseOptions,
  mcpServers: [
    {
      ...MCPServers.filesystem('/tmp'),
      autoConnect: false, // Don't connect automatically
    },
    MCPServers.github(token), // This will auto-connect
  ],
});
```

### Custom MCP Server

```typescript
const customServer: MCPServerConfig = {
  name: 'my-custom-server',
  command: '/usr/local/bin/my-mcp-server',
  args: ['--config', '/etc/my-server.conf'],
  env: {
    API_KEY: process.env.MY_API_KEY,
    DEBUG: 'true',
  },
  transport: 'http',
};

const agent = ConversationalAgent.withMCP(baseOptions, [customServer]);
```

### Tool Filtering with MCP

MCP tools work with the existing tool filtering system:

```typescript
const agent = new ConversationalAgent({
  ...baseOptions,
  mcpServers: [MCPServers.filesystem('/tmp')],
  toolFilter: (tool) => {
    // Filter out destructive file operations
    return !tool.name.includes('delete') && !tool.name.includes('remove');
  },
});
```

## Creating Custom MCP Servers

To create your own MCP server, implement the MCP protocol specification. See the [MCP documentation](https://github.com/anthropics/model-context-protocol) for details.
