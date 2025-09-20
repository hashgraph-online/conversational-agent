import {ConfigManager} from './managers/ConfigManager';
import {AgentManager} from './managers/AgentManager';
import {Config, type MCPServerConfig, type Message, type Network} from './types';

export interface HeadlessRunOptions {
	accountId?: string;
	privateKey?: string;
	network?: Network;
	openAIApiKey?: string;
	command?: string;
}

export interface HeadlessRunResult {
	exitCode: number;
	stdout: string;
}

const newline = '\n';

function buildMcpConfig(servers: MCPServerConfig[]) {
	const filesystemServer = servers.find(server => server.name === 'filesystem');
	const customServers = servers.filter(server => server.name !== 'filesystem');
	return {
		enableFilesystem: Boolean(filesystemServer),
		filesystemPath: filesystemServer?.args?.[2] ?? process.cwd(),
		customServers,
	};
}

function formatMessages(messages: Message[]) {
	return messages.map(message => `[${message.role}] ${message.content}`);
}

function formatCommand(command: string) {
	return command ? `[command] ${command}` : '';
}

function formatResponse(response: {
	message?: string;
	output?: string;
	error?: string;
	transactionId?: string;
	scheduleId?: string;
	notes?: string[];
}) {
	const lines: string[] = [];
	if (response.message) {
		lines.push(`[assistant] ${response.message}`);
	} else if (response.output) {
		lines.push(`[assistant] ${response.output}`);
	}
	if (response.error) {
		lines.push(`[error] ${response.error}`);
	}
	if (response.transactionId) {
		lines.push(`[transaction] ${response.transactionId}`);
	}
	if (response.scheduleId) {
		lines.push(`[schedule] ${response.scheduleId}`);
	}
	if (response.notes?.length) {
		response.notes.forEach(note => {
			lines.push(`[note] ${note}`);
		});
	}
	return lines;
}

function ensureTrailingNewline(text: string) {
	if (!text) {
		return text;
	}
	return text.endsWith(newline) ? text : `${text}${newline}`;
}

/**
 * Executes the conversational agent in a non-interactive mode and returns formatted output.
 */
export async function runHeadless(
	options: HeadlessRunOptions,
): Promise<HeadlessRunResult> {
	const agentManager = AgentManager.getInstance();
	const configManager = ConfigManager.getInstance();
	configManager.resetCache();
	const overrides: Partial<Config> = {};
	if (options.accountId) {
		overrides.accountId = options.accountId;
	}
	if (options.privateKey) {
		overrides.privateKey = options.privateKey;
	}
	if (options.network) {
		overrides.network = options.network;
	}
	if (options.openAIApiKey) {
		overrides.openAIApiKey = options.openAIApiKey;
	}
	const baseConfig = configManager.getConfig(overrides);
	const effectivePrivateKey =
		options.privateKey ||
		baseConfig.privateKey ||
		process.env.HEDERA_OPERATOR_KEY ||
		'';
	const effectiveAccountId = options.accountId || baseConfig.accountId;
	const effectiveNetwork: Network = options.network ?? baseConfig.network;
	const effectiveOpenAiKey =
		options.openAIApiKey ||
		baseConfig.openAIApiKey ||
		process.env.OPENAI_API_KEY ||
		'';
	if (!effectiveAccountId || !effectivePrivateKey) {
		const message = ensureTrailingNewline(
			'Missing account ID or private key for headless execution.',
		);
		return {exitCode: 1, stdout: message};
	}
	const mcpServers = configManager.getMCPServers();
	const config = {
		accountId: effectiveAccountId,
		privateKey: effectivePrivateKey,
		network: effectiveNetwork,
		openAIApiKey: effectiveOpenAiKey,
		mcpServers,
	};
	const command = options.command?.trim() ?? '';
	const outputLines: string[] = [];
	let exitCode = 0;
	agentManager.reset();
	try {
		const {welcomeMessages} = await agentManager.initialize(
			config,
			buildMcpConfig(mcpServers),
		);
		outputLines.push(...formatMessages(welcomeMessages));
		if (command) {
			outputLines.push(formatCommand(command));
			try {
				const response = await agentManager.sendMessage(command, []);
				const responseLines = formatResponse(response);
				outputLines.push(...responseLines);
				if (response.error) {
					exitCode = 1;
				}
			} catch (error) {
				const message = error instanceof Error ? error.message : String(error);
				outputLines.push(`[error] ${message}`);
				exitCode = 1;
			}
		}
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		outputLines.push(`[error] ${message}`);
		exitCode = 1;
	} finally {
		agentManager.reset();
	}
	const filteredLines = outputLines.filter(line => Boolean(line));
	const stdout = ensureTrailingNewline(filteredLines.join(newline));
	return {exitCode, stdout};
}
