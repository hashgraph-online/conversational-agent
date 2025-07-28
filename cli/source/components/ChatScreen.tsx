import React from 'react';
import {Box, Text} from 'ink';
import TextInput from 'ink-text-input';
import Spinner from 'ink-spinner';
import {TerminalWindow} from './TerminalWindow';
import {StatusBadge} from './StatusBadge';
import {BRAND_COLORS, type Config, type Message} from '../types';

/**
 * Chat screen component
 */
export const ChatScreen: React.FC<{
	config: Config;
	messages: Message[];
	input: string;
	isLoading: boolean;
	setInput: (value: string) => void;
	sendMessage: (message: string) => void;
	showLogs: boolean;
	logs: string[];
}> = React.memo(
	({
		config,
		messages,
		input,
		isLoading,
		setInput,
		sendMessage,
		showLogs,
		logs,
	}) => {
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
								<Text color={BRAND_COLORS.hedera.smoke} bold>
									📋 Logs
								</Text>
							</Box>
							<Box flexDirection="column" overflow="hidden">
								{logs.slice(-8).map((log, i) => (
									<Text
										key={i}
										color={BRAND_COLORS.comments}
										dimColor
										wrap="truncate"
									>
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
						<Text dimColor>
							Ctrl+C to exit, ESC to return to menu, L to toggle logs
						</Text>
					</Box>
				</Box>
			</TerminalWindow>
		);
	},
);