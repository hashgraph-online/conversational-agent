import React, {useState, useRef} from 'react';
import {Box, Text, useApp, useInput} from 'ink';
import TextInput from 'ink-text-input';
import SelectInput from 'ink-select-input';
import Spinner from 'ink-spinner';
import Gradient from 'ink-gradient';
import fs from 'fs';
import path from 'path';
import {
	ConversationalAgent,
	type ConversationalAgentOptions,
} from '@hashgraphonline/conversational-agent';

type Props = {
	accountId?: string;
	privateKey?: string;
	network?: 'testnet' | 'mainnet';
	openAIApiKey?: string;
};

type Screen = 'welcome' | 'setup' | 'chat' | 'loading';

interface Message {
	role: 'user' | 'assistant' | 'system';
	content: string;
	timestamp: Date;
}

const BRAND_COLORS = {
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

/**
 * Terminal window decoration component
 */
const TerminalWindow: React.FC<{title: string; children: React.ReactNode}> = ({
	title,
	children,
}) => {
	return (
		<Box
			flexDirection="column"
			borderStyle="round"
			borderColor={BRAND_COLORS.blue}
		>
			<Box
				paddingX={1}
				borderStyle="single"
				borderBottom
				borderColor={BRAND_COLORS.dark}
			>
				<Box marginRight={1}>
					<Text color="red">●</Text>
					<Text> </Text>
					<Text color="yellow">●</Text>
					<Text> </Text>
					<Text color="green">●</Text>
				</Box>
				<Text color={BRAND_COLORS.hedera.smoke}>{title}</Text>
			</Box>
			<Box paddingX={2} paddingY={1} flexDirection="column">
				{children}
			</Box>
		</Box>
	);
};

/**
 * Status badge component
 */
const StatusBadge: React.FC<{
	status: 'success' | 'info' | 'warning' | 'error';
}> = ({status}) => {
	const colors = {
		success: BRAND_COLORS.green,
		info: BRAND_COLORS.blue,
		warning: '#FFBD2E',
		error: '#FF5F57',
	};

	const labels = {
		success: 'SUCCESS',
		info: 'INFO',
		warning: 'WARNING',
		error: 'ERROR',
	};

	return (
		<Box marginRight={1}>
			<Text color={colors[status]} bold>
				[{labels[status]}]
			</Text>
		</Box>
	);
};

/**
 * Load config from .env file
 */
const loadConfigFromEnv = () => {
	const projectRoot =
		process.env['CONVERSATIONAL_AGENT_ROOT'] || path.resolve('./../../');
	const envPath = path.join(projectRoot, '.env');

	try {
		if (fs.existsSync(envPath)) {
			const envContent = fs.readFileSync(envPath, 'utf-8');
			const envVars: Record<string, string> = {};

			envContent.split('\n').forEach(line => {
				const trimmedLine = line.trim();
				if (trimmedLine && !trimmedLine.startsWith('#')) {
					const [key, ...valueParts] = trimmedLine.split('=');
					if (key && valueParts.length > 0) {
						envVars[key] = valueParts.join('=');
					}
				}
			});

			return {
				accountId: envVars['HEDERA_ACCOUNT_ID'] || '',
				privateKey: envVars['HEDERA_PRIVATE_KEY'] || '',
				network:
					(envVars['HEDERA_NETWORK'] as 'testnet' | 'mainnet') || 'testnet',
				openAIApiKey: envVars['OPENAI_API_KEY'] || '',
			};
		}
	} catch (err) {}
	return {
		accountId: '',
		privateKey: '',
		network: 'testnet' as const,
		openAIApiKey: '',
	};
};

/**
 * Save config to .env file
 */
const saveConfig = (configToSave: any) => {
	const projectRoot =
		process.env['CONVERSATIONAL_AGENT_ROOT'] || path.resolve('./../../');
	const envPath = path.join(projectRoot, '.env');

	try {
		let envContent = '';

		if (fs.existsSync(envPath)) {
			envContent = fs.readFileSync(envPath, 'utf-8');
		}

		const updateEnvVar = (key: string, value: string) => {
			const regex = new RegExp(`^${key}=.*$`, 'gm');
			if (regex.test(envContent)) {
				envContent = envContent.replace(regex, `${key}=${value}`);
			} else {
				envContent += `${envContent ? '\n' : ''}${key}=${value}`;
			}
		};

		updateEnvVar('HEDERA_ACCOUNT_ID', configToSave.accountId);
		updateEnvVar('HEDERA_PRIVATE_KEY', configToSave.privateKey);
		updateEnvVar('HEDERA_NETWORK', configToSave.network);
		updateEnvVar('OPENAI_API_KEY', configToSave.openAIApiKey);

		fs.writeFileSync(envPath, envContent);
	} catch (err) {}
};

/**
 * Main App component
 */
// Store original console methods before component renders
const originalConsoleLog = console.log;
const originalConsoleError = console.error;
const originalConsoleWarn = console.warn;
const globalLogsRef: string[] = [];

// Override console methods immediately
console.log = (...args) => {
	const logMessage = args.map(arg => 
		typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
	).join(' ');
	globalLogsRef.push(logMessage);
	if (globalLogsRef.length > 100) globalLogsRef.shift();
	// Never output to terminal - logs only appear in the panel
};

console.error = (...args) => {
	const logMessage = '[ERROR] ' + args.map(arg => 
		typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
	).join(' ');
	globalLogsRef.push(logMessage);
	if (globalLogsRef.length > 100) globalLogsRef.shift();
	// Never output to terminal
};

console.warn = (...args) => {
	const logMessage = '[WARN] ' + args.map(arg => 
		typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
	).join(' ');
	globalLogsRef.push(logMessage);
	if (globalLogsRef.length > 100) globalLogsRef.shift();
	// Never output to terminal
};

export default function App({
	accountId,
	privateKey,
	network = 'testnet',
	openAIApiKey,
}: Props) {
	const {exit} = useApp();
	const [screen, setScreen] = useState<Screen>('welcome');
	const [agent, setAgent] = useState<ConversationalAgent | null>(null);
	const agentRef = useRef<ConversationalAgent | null>(null);
	const [messages, setMessages] = useState<Message[]>([]);
	const [input, setInput] = useState('');
	const [isLoading, setIsLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [showLogs, setShowLogs] = useState(false);
	const [logs, setLogs] = useState<string[]>([...globalLogsRef]);
	
	// Update logs from global array
	React.useEffect(() => {
		const interval = setInterval(() => {
			setLogs([...globalLogsRef]);
		}, 100);
		return () => clearInterval(interval);
	}, []);
	
	// Cleanup on unmount
	React.useEffect(() => {
		return () => {
			console.log = originalConsoleLog;
			console.error = originalConsoleError;
			console.warn = originalConsoleWarn;
		};
	}, []);

	const [config, setConfig] = useState(() => {
		const envConfig = loadConfigFromEnv();
		return {
			accountId: accountId || envConfig.accountId,
			privateKey: privateKey || envConfig.privateKey,
			network: network || envConfig.network,
			openAIApiKey: openAIApiKey || envConfig.openAIApiKey,
		};
	});

	useInput((input, key) => {
		if (key.ctrl && input === 'c') {
			exit();
		}
		if (key.escape && screen === 'chat') {
			setScreen('welcome');
		}
		if (input === 'l' && screen === 'chat') {
			setShowLogs(!showLogs);
		}

		if (key.tab && screen === 'setup') {
			if (currentField < fields.length - 1) {
				setCurrentField(currentField + 1);
			} else {
				setCurrentField(0);
			}
		}
	});

	/**
	 * Initialize the conversational agent
	 */
	const initializeAgent = async () => {
		if (agentRef.current) {
			setAgent(agentRef.current);
			setScreen('chat');
			return;
		}

		setIsLoading(true);
		setError(null);
		setScreen('loading');

		try {
			saveConfig(config);

			const agentConfig: ConversationalAgentOptions = {
				accountId: config.accountId,
				privateKey: config.privateKey,
				network: config.network as 'testnet' | 'mainnet',
				openAIApiKey: config.openAIApiKey,
				openAIModelName: 'gpt-4o-mini',
				verbose: false,
				disableLogging: true,
			};

			const conversationalAgent = new ConversationalAgent(agentConfig);
			await conversationalAgent.initialize();
			agentRef.current = conversationalAgent;
			setAgent(conversationalAgent);
			setScreen('chat');

			setMessages([
				{
					role: 'system',
					content: `Connected to Hedera ${config.network}`,
					timestamp: new Date(),
				},
				{
					role: 'assistant',
					content:
						"Hello! I'm your Hashgraph Consensus Standards Conversational Agent. I can help you manage HCS-10 agent registrations, HCS-11 profiles, send messages through HCS standards, and interact with the Hedera network. How can I assist you today?",
					timestamp: new Date(),
				},
			]);
		} catch (err) {
			setError(
				err instanceof Error ? err.message : 'Failed to initialize agent',
			);
			setScreen('setup');
		} finally {
			setIsLoading(false);
		}
	};

	/**
	 * Send a message to the agent
	 */
	const sendMessage = async (message: string) => {
		const currentAgent = agentRef.current || agent;
		if (!currentAgent || !message.trim()) return;

		const userMessage: Message = {
			role: 'user',
			content: message,
			timestamp: new Date(),
		};

		setMessages(prev => [...prev, userMessage]);
		setInput('');
		setIsLoading(true);

		try {
			const chatHistory: Array<{type: 'human' | 'ai'; content: string}> =
				messages
					.filter(m => m.role !== 'system')
					.map(m => ({
						type: m.role === 'user' ? 'human' : 'ai',
						content: m.content,
					}));

			const response = await currentAgent.processMessage(message, chatHistory);

			const assistantMessage: Message = {
				role: 'assistant',
				content:
					response.message ||
					response.output ||
					response.error ||
					'No response received',
				timestamp: new Date(),
			};

			const newMessages: Message[] = [assistantMessage];

			if (response.transactionId) {
				newMessages.push({
					role: 'system',
					content: `Transaction ID: ${response.transactionId}`,
					timestamp: new Date(),
				});
			}

			if (response.scheduleId) {
				newMessages.push({
					role: 'system',
					content: `Schedule ID: ${response.scheduleId}`,
					timestamp: new Date(),
				});
			}

			if (response.notes && response.notes.length > 0) {
				response.notes.forEach((note: string) => {
					newMessages.push({
						role: 'system',
						content: note,
						timestamp: new Date(),
					});
				});
			}

			setMessages(prev => [...prev, ...newMessages]);
		} catch (err) {
			setMessages(prev => [
				...prev,
				{
					role: 'system',
					content: `Error: ${
						err instanceof Error ? err.message : 'Unknown error'
					}`,
					timestamp: new Date(),
				},
			]);
		} finally {
			setIsLoading(false);
		}
	};

	/**
	 * Welcome screen component
	 */
	const WelcomeScreen: React.FC<{
		config: typeof config;
		onExit: () => void;
		onInitializeAgent: () => void;
		onSetScreen: (screen: Screen) => void;
	}> = ({config, onExit, onInitializeAgent, onSetScreen}) => (
		<Box flexDirection="column" alignItems="center" paddingY={2}>
			<Box flexDirection="column" alignItems="center" marginBottom={2}>
				<Box>
					<Gradient name="atlas">
						<Text bold>╦ ╦╔═╗╔═╗╦ ╦╔═╗╦═╗╔═╗╔═╗╦ ╦ ╔═╗╔╗╔╦ ╦╔╗╔╔═╗</Text>
					</Gradient>
				</Box>
				<Box>
					<Gradient name="atlas">
						<Text bold>╠═╣╠═╣╚═╗╠═╣║ ╦╠╦╝╠═╣╠═╝╠═╣ ║ ║║║║║ ║║║║║╣ </Text>
					</Gradient>
				</Box>
				<Box>
					<Gradient name="atlas">
						<Text bold>╩ ╩╩ ╩╚═╝╩ ╩╚═╝╩╚═╩ ╩╩ ╩ ╩ ╚═╝╝╚╝╩═╝╩╝╚╝╚═╝</Text>
					</Gradient>
				</Box>
				<Text color={BRAND_COLORS.hedera.smoke}>Conversational Agent CLI</Text>
			</Box>
			<Box marginY={2}>
				<SelectInput
					items={[
						{label: 'Start Chat', value: 'chat'},
						{label: 'Configure', value: 'setup'},
						{label: 'Exit', value: 'exit'},
					]}
					onSelect={item => {
						if (item.value === 'exit') {
							onExit();
						} else if (item.value === 'chat') {
							if (
								config.accountId &&
								config.privateKey &&
								config.openAIApiKey
							) {
								onInitializeAgent();
							} else {
								onSetScreen('setup');
							}
						} else {
							onSetScreen(item.value as Screen);
						}
					}}
				/>
			</Box>
			<Box marginTop={2}>
				<Text dimColor>Press ↑/↓ to navigate, Enter to select</Text>
			</Box>
		</Box>
	);

	const [currentField, setCurrentField] = useState(0);
	const fields = ['accountId', 'privateKey', 'network', 'openAIApiKey'];

	if (screen === 'loading') {
		return (
			<Box flexDirection="column" alignItems="center" paddingY={4}>
				<Box marginBottom={2}>
					<Box>
						<Text color={BRAND_COLORS.blue}>Initializing </Text>
						<Text color={BRAND_COLORS.purple}>Hashgraph </Text>
						<Text color={BRAND_COLORS.green}>Online </Text>
						<Text color={BRAND_COLORS.blue}>Agent...</Text>
					</Box>
				</Box>
				<Spinner type="dots" />
			</Box>
		);
	}

	if (screen === 'setup') {
		return (
			<TerminalWindow title="Configuration">
				<Box flexDirection="column">
					<Box marginBottom={1}>
						<StatusBadge status="info" />
						<Text>Configure your Hedera account credentials</Text>
					</Box>

					{fields.map((field, index) => (
						<Box key={field} marginY={1}>
							<Box width={20}>
								<Text
									color={
										currentField === index
											? BRAND_COLORS.blue
											: BRAND_COLORS.hedera.smoke
									}
								>
									{field === 'accountId' && 'Account ID:'}
									{field === 'privateKey' && 'Private Key:'}
									{field === 'network' && 'Network:'}
									{field === 'openAIApiKey' && 'OpenAI Key:'}
								</Text>
							</Box>
							{currentField === index ? (
								field === 'network' ? (
									<SelectInput
										items={[
											{label: 'Testnet', value: 'testnet'},
											{label: 'Mainnet', value: 'mainnet'},
										]}
										initialIndex={config.network === 'testnet' ? 0 : 1}
										onSelect={item => {
											setConfig({
												...config,
												network: item.value as 'testnet' | 'mainnet',
											});
											if (currentField < fields.length - 1) {
												setCurrentField(currentField + 1);
											}
										}}
									/>
								) : (
									<TextInput
										value={config[field as keyof typeof config]}
										onChange={value => setConfig({...config, [field]: value})}
										onSubmit={() => {
											if (currentField < fields.length - 1) {
												setCurrentField(currentField + 1);
											} else {
												initializeAgent();
											}
										}}
										mask={
											field === 'privateKey' || field === 'openAIApiKey'
												? '*'
												: undefined
										}
									/>
								)
							) : (
								<Text color={BRAND_COLORS.hedera.smoke}>
									{field === 'network'
										? config[field]
										: config[field as keyof typeof config]
										? '••••••••'
										: '(not set)'}
								</Text>
							)}
						</Box>
					))}

					{error && (
						<Box marginTop={2}>
							<StatusBadge status="error" />
							<Text color="red">{error}</Text>
						</Box>
					)}

					<Box marginTop={2}>
						<Text dimColor>Press Tab to navigate fields, Enter to submit</Text>
						<Text dimColor>
							Complete all fields and press Enter on the last field to save and
							start
						</Text>
					</Box>
				</Box>
			</TerminalWindow>
		);
	}

	/**
	 * Isolated chat screen component to prevent re-mounting
	 */
	const ChatScreen: React.FC<{
		config: typeof config;
		messages: Message[];
		input: string;
		isLoading: boolean;
		setInput: (value: string) => void;
		sendMessage: (message: string) => void;
		showLogs: boolean;
		logs: string[];
	}> = React.memo(
		({config, messages, input, isLoading, setInput, sendMessage, showLogs, logs}) => {
			return (
				<TerminalWindow title={`Conversational Agent Chat (${config.network})`}>
					<Box flexDirection="column" minHeight={25}>
						{showLogs && (
							<Box
								borderStyle="single"
								borderColor={BRAND_COLORS.dark}
								marginBottom={1}
								padding={1}
								height={10}
								flexDirection="column"
								overflow="hidden"
							>
								<Box marginBottom={1}>
									<Text color={BRAND_COLORS.hedera.smoke} bold>📋 Logs</Text>
								</Box>
								<Box flexDirection="column" overflow="hidden">
									{logs.slice(-8).map((log, i) => (
										<Text key={i} color={BRAND_COLORS.comments} dimColor wrap="truncate">
											{log}
										</Text>
									))}
								</Box>
							</Box>
						)}
						<Box
							flexDirection="column"
							flexGrow={1}
							marginBottom={1}
							overflow="hidden"
						>
							{messages.slice(-15).map((msg, index) => (
								<Box
									key={`${msg.timestamp.getTime()}-${index}`}
									marginBottom={1}
								>
									{msg.role === 'user' && (
										<Box flexDirection="column">
											<Box>
												<Text color={BRAND_COLORS.green}>$ </Text>
												<Text wrap="wrap">{msg.content}</Text>
											</Box>
										</Box>
									)}
									{msg.role === 'assistant' && (
										<Box flexDirection="column">
											<Box>
												<Text color={BRAND_COLORS.blue}>→ </Text>
												<Text wrap="wrap">{msg.content}</Text>
											</Box>
										</Box>
									)}
									{msg.role === 'system' && (
										<Box flexDirection="column">
											<Box>
												<StatusBadge status="info" />
												<Text color={BRAND_COLORS.hedera.smoke} wrap="wrap">
													{msg.content}
												</Text>
											</Box>
										</Box>
									)}
								</Box>
							))}
						</Box>
						<Box
							borderStyle="single"
							borderTop
							borderColor={BRAND_COLORS.dark}
							paddingTop={1}
							paddingX={1}
						>
							{isLoading ? (
								<Box>
									<Spinner type="dots" />
									<Text color={BRAND_COLORS.hedera.smoke}> Processing...</Text>
								</Box>
							) : (
								<Box flexDirection="row" width="100%">
									<Text color={BRAND_COLORS.green}>$ </Text>
									<Box flexGrow={1}>
										<TextInput
											value={input}
											onChange={setInput}
											onSubmit={sendMessage}
											placeholder="Type your message..."
										/>
									</Box>
								</Box>
							)}
						</Box>
						<Box marginTop={1} paddingX={1}>
							<Text dimColor>Ctrl+C to exit, ESC to return to menu, L to toggle logs</Text>
						</Box>
					</Box>
				</TerminalWindow>
			);
		},
	);

	if (screen === 'chat') {
		return (
			<ChatScreen
				config={config}
				messages={messages}
				input={input}
				isLoading={isLoading}
				setInput={setInput}
				sendMessage={sendMessage}
				showLogs={showLogs}
				logs={logs}
			/>
		);
	}

	return (
		<WelcomeScreen
			config={config}
			onExit={exit}
			onInitializeAgent={initializeAgent}
			onSetScreen={setScreen}
		/>
	);
}
