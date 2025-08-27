import {useRef, useCallback} from 'react';
import {ConfigManager} from '../managers/ConfigManager';
import {AgentManager} from '../managers/AgentManager';
import {type Config, type Screen, type Message} from '../types';
import {type MCPServerConfig} from '@hashgraphonline/conversational-agent';

interface InitializeAgentProps {
	configManager: ConfigManager;
	agentManager: AgentManager;
	actions: {
		setScreen: (screen: Screen) => void;
		setMessages: (messages: Message[]) => void;
		setError: (error: string | null) => void;
	};
}

export const useInitializeAgent = ({
	configManager,
	agentManager,
	actions,
}: InitializeAgentProps) => {
	const initializingRef = useRef(false);

	const initializeAgent = useCallback(
		async (
			currentConfig: Config,
			mcpConfig: {
				enableFilesystem: boolean;
				filesystemPath: string;
				customServers: MCPServerConfig[];
			},
		) => {
			if (
				agentManager.isInitialized() ||
				agentManager.isInitializing() ||
				initializingRef.current
			) {
				return;
			}

			initializingRef.current = true;

			actions.setScreen('loading');

			try {
				await configManager.saveConfig(currentConfig);

				const {welcomeMessages} = await agentManager.initialize(
					{...currentConfig, mcpServers: configManager.getMCPServers()},
					mcpConfig,
				);

				actions.setMessages(welcomeMessages);

				await new Promise(resolve => setTimeout(resolve, 100));

				actions.setScreen('chat');
			} catch (err) {
				actions.setError(
					err instanceof Error ? err.message : 'Failed to initialize agent',
				);
				actions.setScreen('setup');
			} finally {
				initializingRef.current = false;
			}
		},
		[configManager, agentManager, actions],
	);

	return initializeAgent;
};
