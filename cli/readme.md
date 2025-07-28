# Hedera Conversational Agent CLI

A beautiful command-line interface for the Hedera Conversational Agent, built with [Ink](https://github.com/vadimdemedes/ink) and styled following Hashgraph Online design patterns.

## Features

- 🎨 **Beautiful Terminal UI** - Styled with HCS improvement proposals design patterns
- 💬 **Interactive Chat** - Chat with your Hedera agent in a clean terminal interface
- 🔐 **Secure Configuration** - Masked input for sensitive credentials
- 🌈 **Gradient Text & Colors** - Brand-consistent color scheme
- 🚀 **Fast & Responsive** - Built with React for smooth interactions
- 📊 **Transaction Details** - See transaction IDs and network responses
- 🎯 **HCS-10 Support** - Full support for agent connections and messaging
- 🔧 **MCP Integration** - Configure Model Context Protocol servers for extended capabilities
- 📁 **File Operations** - Built-in filesystem MCP server for file management
- ⚙️ **Custom MCP Servers** - Add your own MCP servers for specialized tools

## Installation

For local development, the CLI uses the actual ConversationalAgent from the parent package:

```bash
# 1. Build the parent package first
cd /path/to/conversational-agent
pnpm install
pnpm build

# 2. The CLI will be built automatically via postinstall hook
# Or build manually:
cd cli
pnpm install
pnpm build
```

## Usage

### Interactive Mode (Recommended)

```bash
# From the parent conversational-agent directory
pnpm cli

# This automatically builds if needed and runs the CLI
```

### With Command Line Arguments

```bash
conversational-agent \
  --account-id=0.0.12345 \
  --private-key=your-private-key \
  --network=testnet \
  --openai-api-key=sk-...
```

### Using Environment Variables

The CLI automatically loads configuration from `.env` in the conversational-agent root:

```bash
# .env file in conversational-agent directory
HEDERA_ACCOUNT_ID=0.0.12345
HEDERA_PRIVATE_KEY=your-private-key
HEDERA_NETWORK=testnet
OPENAI_API_KEY=sk-...
MCP_SERVERS=[{"name":"filesystem","command":"npx","args":["-y","@modelcontextprotocol/server-filesystem","/tmp"]}]
```

Then simply run: `pnpm cli`

## Interface Overview

### Welcome Screen
- Beautiful ASCII art logo with gradient colors
- Simple menu navigation with arrow keys
- Options: Start Chat, Configure, MCP Servers, Exit

### Configuration Screen
- Terminal-style window with macOS-like controls
- Secure input masking for sensitive data
- Tab navigation between fields
- Real-time validation

### MCP Servers Screen
- Configure Model Context Protocol servers
- Enable/disable filesystem server with custom path
- Add custom MCP servers with command and arguments
- Live preview of available tools
- Save configuration to environment

### Chat Interface
- Clean terminal aesthetic with prompt symbols
- Color-coded messages (user, assistant, system)
- Loading indicators with spinners
- Transaction ID display
- MCP server status and available tools
- Escape key to return to menu

## Design Features

The CLI follows Hashgraph Online's design system:

- **Brand Colors**: Primary blue (#5599fe), Green (#48df7b), Purple (#b56cff)
- **Hedera Colors**: Purple (#8259ef), Blue (#2d84eb), Green (#3ec878)
- **Terminal Window**: Rounded borders with window control dots
- **Status Badges**: Color-coded status indicators
- **Typography**: Monospace throughout with clear hierarchy

## Keyboard Shortcuts

- `↑/↓` - Navigate menus
- `Enter` - Select/Submit
- `Tab` - Next field (in configuration)
- `Escape` - Return to main menu (from chat)
- `Ctrl+C` - Exit application

## Development

```bash
# Watch mode for development
pnpm dev

# Run tests
pnpm test

# Build for production
pnpm build
```

## Examples

### Basic Chat Interaction

```
$ Find all AI agents on the network
→ I'll search for AI agents registered on the Hedera network...

[INFO] Found 5 agents with AI capabilities
→ Here are the AI agents I found:
1. Agent: 0.0.12345 - "GPT Assistant"
2. Agent: 0.0.23456 - "Code Helper"
...

$ Connect to agent 0.0.12345
→ Initiating connection to agent 0.0.12345...
[INFO] Transaction ID: 0.0.98765@1234567890.123
→ Successfully connected! You can now send messages to this agent.
```

### MCP File Operations

With filesystem MCP server enabled:

```
$ Create a new file called notes.txt with my meeting notes
→ I'll create a notes.txt file for you with meeting notes...

[INFO] MCP servers enabled: filesystem
→ I've created notes.txt in your configured directory with the meeting notes.

$ List all files in the current directory
→ Here are the files in /tmp:
- notes.txt (created just now)
- data.json
- config.yaml
```

### Custom MCP Server

```
$ Add GitHub repository operations
→ I can help you interact with GitHub repositories...

[INFO] MCP servers enabled: filesystem, github
→ I now have access to GitHub operations. I can help you create issues, 
  manage repositories, and work with pull requests.
```

## License

Apache-2.0
