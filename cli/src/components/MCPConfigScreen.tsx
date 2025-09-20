import React from 'react';
import {Box, Text, useInput} from 'ink';
import TextInput from 'ink-text-input';
import SelectInput from 'ink-select-input';
import {TerminalWindow} from './TerminalWindow';
import {StatusBadge} from './StatusBadge';
import {
  BRAND_COLORS,
  type Screen,
  type MCPServerConfig,
  type SelectItem,
} from '../types';

interface MCPConfig {
  enableFilesystem: boolean;
  filesystemPath: string;
  customServers: MCPServerConfig[];
  addingCustom: boolean;
  newServerName: string;
  newServerCommand: string;
  newServerArgs: string;
  newServerEnv: string;
  currentField: number;
}

type CustomFieldKey = 'newServerName' | 'newServerCommand' | 'newServerArgs' | 'newServerEnv';

type MenuValue =
  | {type: 'filesystem'}
  | {type: 'filesystem-path'}
  | {type: 'add-custom'}
  | {type: 'save'}
  | {type: 'back'}
  | {type: 'custom'; index: number};

const customFieldDescriptors: Array<{
  key: CustomFieldKey;
  label: string;
  placeholder: string;
}> = [
  {
    key: 'newServerName',
    label: 'Server Name:',
    placeholder: 'my-server',
  },
  {
    key: 'newServerCommand',
    label: 'Command:',
    placeholder: 'npx',
  },
  {
    key: 'newServerArgs',
    label: 'Arguments (comma-separated):',
    placeholder: '-y, @modelcontextprotocol/server-github',
  },
  {
    key: 'newServerEnv',
    label: 'Environment Variables (KEY=value, comma-separated):',
    placeholder: 'MCP_LOG_LEVEL=info, GIT_SIGN_COMMITS=false',
  },
];

interface Props {
  mcpConfig: MCPConfig;
  editingFilesystemPath: boolean;
  onSetMcpConfig: (config: Partial<MCPConfig>) => void;
  onSetEditingFilesystemPath: (editing: boolean) => void;
  onSetScreen: (screen: Screen) => void;
  onSaveMCPConfig: () => void;
  getMCPConfigPath: () => string;
}

/**
 * MCP Configuration screen
 */
export const MCPConfigScreen: React.FC<Props> = ({
  mcpConfig,
  editingFilesystemPath,
  onSetMcpConfig,
  onSetEditingFilesystemPath,
  onSetScreen,
  onSaveMCPConfig,
  getMCPConfigPath,
}) => {
  useInput((_, key) => {
    if (key.escape) {
      if (mcpConfig.addingCustom) {
        onSetMcpConfig({
          addingCustom: false,
          newServerName: '',
          newServerCommand: '',
          newServerArgs: '',
          newServerEnv: '',
          currentField: 0,
        });
      } else if (editingFilesystemPath) {
        onSetEditingFilesystemPath(false);
      }
    }
  });

  if (editingFilesystemPath) {
    return (
      <TerminalWindow title="Edit Filesystem Path">
        <Box flexDirection="column">
          <Box marginBottom={2}>
            <Text>Enter the directory path for the filesystem server:</Text>
          </Box>
          <TextInput
            value={mcpConfig.filesystemPath}
            onChange={value => onSetMcpConfig({filesystemPath: value})}
            onSubmit={() => {
              onSetEditingFilesystemPath(false);
              onSaveMCPConfig();
            }}
            placeholder={process.cwd()}
          />
          <Box marginTop={2}>
            <Text dimColor>Press Enter to save, Escape to cancel</Text>
          </Box>
        </Box>
      </TerminalWindow>
    );
  }

  if (mcpConfig.addingCustom) {
    const customFieldUpdaters: Record<CustomFieldKey, (value: string) => void> = {
      newServerName: value => onSetMcpConfig({newServerName: value}),
      newServerCommand: value => onSetMcpConfig({newServerCommand: value}),
      newServerArgs: value => onSetMcpConfig({newServerArgs: value}),
      newServerEnv: value => onSetMcpConfig({newServerEnv: value}),
    };

    return (
      <TerminalWindow title="Add Custom MCP Server">
        <Box flexDirection="column">
          {customFieldDescriptors.map(({key, label, placeholder}, index) => (
            <Box key={key} marginY={1}>
              <Text
                color={
                  mcpConfig.currentField === index
                    ? BRAND_COLORS.blue
                    : BRAND_COLORS.hedera.smoke
                }
              >
                {label}
              </Text>
              {mcpConfig.currentField === index ? (
                <TextInput
                  value={mcpConfig[key]}
                  onChange={value => customFieldUpdaters[key](value)}
                  onSubmit={() => {
                    if (index < customFieldDescriptors.length - 1) {
                      onSetMcpConfig({currentField: index + 1});
                      return;
                    }

                    if (mcpConfig.newServerName && mcpConfig.newServerCommand) {
                      const env: Record<string, string> = {};

                      if (mcpConfig.newServerEnv) {
                        mcpConfig.newServerEnv.split(',').forEach(envVar => {
                          const [envKey, envValue] = envVar.trim().split('=');
                          if (envKey && envValue) {
                            env[envKey] = envValue;
                          }
                        });
                      }

                      const newServer: MCPServerConfig = {
                        name: mcpConfig.newServerName,
                        command: mcpConfig.newServerCommand,
                        args: mcpConfig.newServerArgs
                          .split(',')
                          .map(arg => arg.trim())
                          .filter(Boolean),
                        transport: 'stdio',
                        autoConnect: true,
                        ...(Object.keys(env).length > 0 && {env}),
                      };

                      const newCustomServers = [...mcpConfig.customServers, newServer];
                      onSetMcpConfig({
                        customServers: newCustomServers,
                        addingCustom: false,
                        newServerName: '',
                        newServerCommand: '',
                        newServerArgs: '',
                        newServerEnv: '',
                        currentField: 0,
                      });

                      onSaveMCPConfig();
                    }
                  }}
                  placeholder={placeholder}
                />
              ) : (
                <Text color={BRAND_COLORS.hedera.smoke}>
                  {mcpConfig[key] ? mcpConfig[key] : `(${placeholder})`}
                </Text>
              )}
            </Box>
          ))}

          <Box marginTop={2}>
            <Text dimColor>Press Tab or Enter to move between fields</Text>
            <Text dimColor>
              Press Enter on the last field to add the server
            </Text>
            <Text dimColor>Press Escape to cancel</Text>
          </Box>
        </Box>
      </TerminalWindow>
    );
  }

  const menuItems: SelectItem<MenuValue>[] = [
    {
      label: `Filesystem Server: ${
        mcpConfig.enableFilesystem ? 'Enabled' : 'Disabled'
      }`,
      value: {type: 'filesystem'},
    },
  ];

  if (mcpConfig.enableFilesystem) {
    menuItems.push({
      label: `Filesystem Path: ${mcpConfig.filesystemPath}`,
      value: {type: 'filesystem-path'},
    });
  }

  mcpConfig.customServers.forEach((server, index) => {
    menuItems.push({
      label: `${server.name} (${server.command})`,
      value: {type: 'custom', index},
    });
  });

  menuItems.push(
    {label: 'Add Custom Server', value: {type: 'add-custom'}},
    {label: 'Done (changes auto-saved)', value: {type: 'save'}},
    {label: 'Back to Menu', value: {type: 'back'}},
  );

  return (
    <TerminalWindow title="MCP Server Configuration">
      <Box flexDirection="column">
        <Box marginBottom={2}>
          <StatusBadge status="info" />
          <Text>Configure Model Context Protocol servers</Text>
        </Box>

        <SelectInput<MenuValue>
          items={menuItems}
          onSelect={({value}) => {
            switch (value.type) {
              case 'filesystem': {
                const enableFilesystem = !mcpConfig.enableFilesystem;
                onSetMcpConfig({enableFilesystem});
                onSaveMCPConfig();
                return;
              }
              case 'filesystem-path': {
                onSetEditingFilesystemPath(true);
                return;
              }
              case 'add-custom': {
                onSetMcpConfig({addingCustom: true, currentField: 0});
                return;
              }
              case 'save': {
                onSaveMCPConfig();
                onSetScreen('welcome');
                return;
              }
              case 'back': {
                onSetScreen('welcome');
                return;
              }
              case 'custom': {
                const newCustomServers = mcpConfig.customServers.filter(
                  (_, index) => index !== value.index,
                );
                onSetMcpConfig({customServers: newCustomServers});
                onSaveMCPConfig();
                return;
              }
            }
          }}
        />

        <Box marginY={2}>
          <Text dimColor>
            Press Enter to toggle/edit servers, or select actions
          </Text>
          {mcpConfig.enableFilesystem && (
            <Text dimColor>Filesystem path: {mcpConfig.filesystemPath}</Text>
          )}
          <Text dimColor>Config saved to: {getMCPConfigPath()}</Text>
        </Box>
      </Box>
    </TerminalWindow>
  );
};
