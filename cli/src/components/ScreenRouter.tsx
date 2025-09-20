import React from 'react';
import {WelcomeScreen} from './WelcomeScreen';
import {ChatScreen} from './ChatScreen';
import {LoadingScreen} from './LoadingScreen';
import {SetupScreen} from './SetupScreen';
import {MCPConfigScreen} from './MCPConfigScreen';
import {type Config} from '../types';
import {type AppState} from '../hooks/useStableState';

interface Props {
  state: AppState;
  currentConfig: Config;
  actions: any;
  stableHandlers: any;
  exit: () => void;
}

export const ScreenRouter: React.FC<Props> = ({
  state,
  currentConfig,
  actions,
  stableHandlers,
  exit,
}) => {
  switch (state.screen) {
    case 'welcome':
      return (
        <WelcomeScreen
          config={currentConfig}
          onExit={exit}
          onInitializeAgent={stableHandlers.initializeAgent}
          onSetScreen={actions.setScreen}
        />
      );

    case 'loading':
      return <LoadingScreen />;

    case 'setup':
      return (
        <SetupScreen
          config={currentConfig}
          currentField={state.currentField}
          error={state.error}
          onUpdateConfig={stableHandlers.updateConfig}
          onSetCurrentField={actions.setCurrentField}
          onInitializeAgent={stableHandlers.initializeAgent}
        />
      );

    case 'mcp-config':
      return (
        <MCPConfigScreen
          mcpConfig={state.mcpConfig}
          editingFilesystemPath={state.editingFilesystemPath}
          onSetMcpConfig={actions.setMcpConfig}
          onSetEditingFilesystemPath={actions.setEditingFilesystemPath}
          onSetScreen={actions.setScreen}
          onSaveMCPConfig={stableHandlers.saveMCPConfig}
          getMCPConfigPath={stableHandlers.getMCPConfigPath}
        />
      );

    case 'chat':
      return (
        <ChatScreen
          config={currentConfig}
          messages={state.messages}
          input={state.input}
          isLoading={state.isLoading}
          setInput={actions.setInput}
          sendMessage={stableHandlers.sendMessage}
          showLogs={false}
          logs={state.logs}
        />
      );

    default:
      return null;
  }
};
