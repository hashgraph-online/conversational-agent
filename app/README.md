# Conversational Agent Desktop App

A modern desktop application for the Hashgraph Online Conversational Agent, built with Electron, React, and TypeScript.

## Quick Start

### Prerequisites

- Node.js 20+ 
- pnpm 8+

### Installation

```bash
# Clone the repository
git clone https://github.com/hashgraph-online/conversational-agent
cd conversational-agent/app

# Install dependencies
pnpm install
```

### Development

```bash
# Start development server
pnpm dev

# Run tests
pnpm test

# Type checking
pnpm typecheck

# View component stories
pnpm storybook
```

### Building

```bash
# Build for current platform
pnpm build

# Build for specific platforms
pnpm dist:mac     # macOS
pnpm dist:win     # Windows
pnpm dist:linux   # Linux
```

## Configuration

The app requires configuration of:

1. **Hedera Network Credentials**
   - Account ID (format: 0.0.xxxxx)
   - Private Key (ED25519 or ECDSA)
   - Network selection (Testnet/Mainnet)

2. **OpenAI API**
   - API Key (starts with 'sk-')
   - Model selection (gpt-4o, gpt-4, gpt-3.5-turbo)

3. **MCP Servers** (Optional)
   - Filesystem access
   - GitHub integration
   - Database connections
   - Custom servers



### Manual Building

```bash
# Install dependencies
pnpm install

# Build the app
pnpm build

# Package for distribution
pnpm dist
```

Built packages will be in the `dist/` directory:
- **macOS**: `.dmg` installer
- **Windows**: `.exe` installer  
- **Linux**: `.AppImage` and `.deb` packages

## Platform Support

### macOS
- Requires macOS 10.15+ (Catalina)
- Native keychain integration
- Automatic dark mode detection
- Code signing for Gatekeeper

### Windows
- Requires Windows 10+
- Windows Credential Manager integration
- NSIS installer with uninstaller
- Code signing for SmartScreen

### Linux
- AppImage for universal compatibility
- Debian package for Ubuntu/Debian
- XDG desktop integration
- Secret Service API for credentials

## Testing

```bash
# Run all tests
pnpm test

# Run tests with coverage
pnpm test:coverage

# Run tests in watch mode
pnpm test:watch
```

## Built With

- [Electron](https://electronjs.org) - Cross-platform desktop apps
- [React](https://reactjs.org) - UI library
- [Vite](https://vitejs.dev) - Build tool
- [Tailwind CSS](https://tailwindcss.com) - Styling
- [Zustand](https://github.com/pmndrs/zustand) - State management
- [@hashgraphonline/conversational-agent](https://www.npmjs.com/package/@hashgraphonline/conversational-agent) - AI agent library