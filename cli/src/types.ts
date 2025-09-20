export type Screen = 'welcome' | 'setup' | 'mcp-config' | 'chat' | 'loading';

export interface Message {
	role: 'user' | 'assistant' | 'system';
	content: string;
	timestamp: Date;
}

export type Network = 'testnet' | 'mainnet';

export interface Config {
	accountId: string;
	privateKey: string;
	network: Network;
	openAIApiKey: string;
}

export type MCPTransport = 'stdio' | 'http' | 'websocket';

export interface MCPServerConfig {
	name: string;
	command: string;
	args: string[];
	transport?: MCPTransport;
	autoConnect?: boolean;
	env?: Record<string, string>;
	additionalContext?: string;
	toolDescriptions?: Record<string, string>;
}

export const MCPServers = {
	filesystem: (path: string): MCPServerConfig => ({
		name: 'filesystem',
		command: 'npx',
		args: ['-y', '@modelcontextprotocol/server-filesystem', path],
		transport: 'stdio',
		autoConnect: true,
		additionalContext:
			'This server provides access to files and directories in the current working directory.',
		toolDescriptions: {
			list_directory: 'Use this tool when users ask about files in the current directory or working directory.',
			read_file: 'Use this tool when users ask to see or check files in the current directory.',
		},
	}),
};

export type SelectItem<TValue> = {
	key?: string;
	label: string;
	value: TValue;
};

export const BRAND_COLORS = {
	blue: '#5599fe',
	green: '#48df7b',
	purple: '#b56cff',
	dark: '#3f4174',
	white: '#ffffff',

	hedera: {
		purple: '#8259ef',
		blue: '#2d84eb',
		green: '#3ec878',
		charcoal: '#464646',
		smoke: '#8c8c8c',
	},

	keywords: '#3f4174',
	functions: '#5599fe',
	strings: '#48df7b',
	variables: '#b56cff',
	comments: '#6b7280',
};
