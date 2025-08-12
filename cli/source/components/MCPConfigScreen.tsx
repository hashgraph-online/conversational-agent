import React from 'react';
import {Box, Text, useInput} from 'ink';
import TextInput from 'ink-text-input';
import SelectInput from 'ink-select-input';
import {TerminalWindow} from './TerminalWindow';
import {StatusBadge} from './StatusBadge';
import {BRAND_COLORS, type Screen} from '../types';
import {type MCPServerConfig} from '@hashgraphonline/conversational-agent';

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
    const customFields = [
      'newServerName',
      'newServerCommand',
      'newServerArgs',
      'newServerEnv',
    ];
    const fieldLabels = [
      'Server Name:',
      'Command:',
      'Arguments (comma-separated):',
      'Environment Variables (KEY=value, comma-separated):',
    ];
    const placeholders = [
      'my-server',
      'npx',
      '-y, @modelcontextprotocol/server-github',
      'MCP_LOG_LEVEL=info, GIT_SIGN_COMMITS=false',
    ];

    return (
      <TerminalWindow title="Add Custom MCP Server">
        <Box flexDirection="column">
          {customFields.map((field, index) => (
            <Box key={field} marginY={1}>
              <Text
                color={
                  mcpConfig.currentField === index
                    ? BRAND_COLORS.blue
                    : BRAND_COLORS.hedera.smoke
                }
              >
                {fieldLabels[index]}
              </Text>
              {mcpConfig.currentField === index ? (
                <TextInput
                  value={mcpConfig[field as keyof MCPConfig] as string}
                  onChange={value => onSetMcpConfig({[field]: value})}
                  onSubmit={() => {
                    if (index < customFields.length - 1) {
                      onSetMcpConfig({currentField: index + 1});
                    } else if (
                      mcpConfig.newServerName &&
                      mcpConfig.newServerCommand
                    ) {
                      const env: Record<string, string> = {};
                      if (mcpConfig.newServerEnv) {
                        mcpConfig.newServerEnv.split(',').forEach(envVar => {
                          const [key, value] = envVar.trim().split('=');
                          if (key && value) {
                            env[key] = value;
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
                  placeholder={placeholders[index]}
                />
              ) : (
                <Text color={BRAND_COLORS.hedera.smoke}>
                  {String(mcpConfig[field as keyof MCPConfig] || `(${placeholders[index]})`)}
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

  const menuItems = [
    {
      label: `Filesystem Server: ${
        mcpConfig.enableFilesystem ? 'Enabled' : 'Disabled'
      }`,
      value: 'filesystem',
    },
  ];

  if (mcpConfig.enableFilesystem) {
    menuItems.push({
      label: `Filesystem Path: ${mcpConfig.filesystemPath}`,
      value: 'filesystem-path',
    });
  }

  mcpConfig.customServers.forEach((server, index) => {
    menuItems.push({
      label: `${server.name} (${server.command})`,
      value: `custom-${index}`,
    });
  });

  menuItems.push(
    {label: 'Add Custom Server', value: 'add-custom'},
    {label: 'Done (changes auto-saved)', value: 'save'},
    {label: 'Back to Menu', value: 'back'},
  );

  return (
    <TerminalWindow title="MCP Server Configuration">
      <Box flexDirection="column">
        <Box marginBottom={2}>
          <StatusBadge status="info" />
          <Text>Configure Model Context Protocol servers</Text>
        </Box>

        <SelectInput
          items={menuItems}
          onSelect={item => {
            if (item.value === 'filesystem') {
              const enableFilesystem = !mcpConfig.enableFilesystem;
              onSetMcpConfig({enableFilesystem});
              onSaveMCPConfig();
            } else if (item.value === 'filesystem-path') {
              onSetEditingFilesystemPath(true);
            } else if (item.value === 'add-custom') {
              onSetMcpConfig({addingCustom: true});
            } else if (item.value === 'save') {
              onSaveMCPConfig();
              onSetScreen('welcome');
            } else if (item.value === 'back') {
              onSetScreen('welcome');
            } else if (item.value.startsWith('custom-')) {
              const index = parseInt(item.value.replace('custom-', ''));
              const newCustomServers = mcpConfig.customServers.filter(
                (_, i) => i !== index,
              );
              onSetMcpConfig({customServers: newCustomServers});
              onSaveMCPConfig();
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