import React, {useState, useMemo, useCallback} from 'react';
import {useApp} from 'ink';
import {ScreenRouter} from './components/ScreenRouter';
import {ConfigManager} from './managers/ConfigManager';
import {AgentManager} from './managers/AgentManager';
import {useStableState} from './hooks/useStableState';
import {useInitializeAgent} from './hooks/useInitializeAgent';
import {type Config, type Message} from './types';

interface Props {
  accountId?: string;
  privateKey?: string;
  network?: 'testnet' | 'mainnet';
  openAIApiKey?: string;
}

export const CLIApp: React.FC<Props> = (props) => {
  const {exit} = useApp();
  
  const configManager = useMemo(() => ConfigManager.getInstance(), []);
  const agentManager = useMemo(() => AgentManager.getInstance(), []);
  
  const initialConfig = useMemo(() => configManager.getConfig(props), [configManager, props.accountId, props.privateKey, props.network, props.openAIApiKey]);
  const initialMcpServers = useMemo(() => configManager.getMCPServers(), [configManager]);
  
  const {state, actions} = useStableState(initialMcpServers);
  
  const [currentConfig, setCurrentConfig] = useState<Config>(initialConfig);
  
  const initializeAgent = useInitializeAgent({
    configManager,
    agentManager,
    actions,
  });
  
  const handleInitializeAgent = useCallback(() => {
    initializeAgent(currentConfig, state.mcpConfig);
  }, [initializeAgent, currentConfig, state.mcpConfig]);

  const sendMessage = useCallback(async (message: string) => {
    if (!message.trim()) return;

    const userMessage: Message = {
      role: 'user',
      content: message,
      timestamp: new Date(),
    };

    actions.addMessages([userMessage]);
    actions.setInput('');
    actions.setLoading(true);

    try {
      const chatHistory: Array<{type: 'human' | 'ai'; content: string}> = state.messages
        .filter((m: Message) => m.role !== 'system')
        .map((m: Message) => ({
          type: m.role === 'user' ? 'human' : 'ai',
          content: m.content,
        }));

      const response = await agentManager.sendMessage(message, chatHistory);

      const assistantMessage: Message = {
        role: 'assistant',
        content: response.message || response.output || response.error || 'No response received',
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

      actions.addMessages(newMessages);
    } catch (err) {
      actions.addMessages([{
        role: 'system',
        content: `Error: ${err instanceof Error ? err.message : 'Unknown error'}`,
        timestamp: new Date(),
      }]);
    } finally {
      actions.setLoading(false);
    }
  }, [agentManager, state.messages, actions]);

  const updateConfig = (field: keyof Config, value: string) => {
    const updated = {...currentConfig, [field]: value};
    setCurrentConfig(updated);
  };

  const saveMCPConfig = () => {
    const servers = [];
    if (state.mcpConfig.enableFilesystem) {
      const filesystemServer = {
        name: 'filesystem',
        command: 'npx',
        args: ['-y', '@modelcontextprotocol/server-filesystem', state.mcpConfig.filesystemPath],
        transport: 'stdio' as const,
        autoConnect: true,
      };
      servers.push(filesystemServer);
    }
    servers.push(...state.mcpConfig.customServers);
    configManager.saveMCPConfig(servers);
  };

  const stableHandlers = useMemo(() => ({
    initializeAgent: handleInitializeAgent,
    sendMessage,
    updateConfig,
    saveMCPConfig,
    getMCPConfigPath: () => configManager.getMCPConfigPathForDisplay(),
  }), [handleInitializeAgent, sendMessage]);

  return (
    <ScreenRouter
      state={state}
      currentConfig={currentConfig}
      actions={actions}
      stableHandlers={stableHandlers}
      exit={exit}
    />
  );
};