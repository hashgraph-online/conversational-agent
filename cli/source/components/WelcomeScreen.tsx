import React from 'react';
import {Box, Text} from 'ink';
import SelectInput from 'ink-select-input';
import Gradient from 'ink-gradient';
import {BRAND_COLORS, type Config, type Screen} from '../types';

/**
 * Welcome screen component
 */
export const WelcomeScreen: React.FC<{
	config: Config;
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
			<Text color={BRAND_COLORS.hedera.smoke} dimColor>
				Powered by Hashgraph Online
			</Text>
		</Box>

		<Box marginY={2}>
			<SelectInput
				items={[
					{label: 'Start Chat', value: 'chat'},
					{label: 'Configure', value: 'setup'},
					{label: 'MCP Servers', value: 'mcp-config'},
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