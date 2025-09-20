import React from 'react';
import {Box, Text, useInput} from 'ink';
import TextInput from 'ink-text-input';
import SelectInput from 'ink-select-input';
import {TerminalWindow} from './TerminalWindow';
import {StatusBadge} from './StatusBadge';
import {BRAND_COLORS, type Config, type Network, type SelectItem} from '../types';

interface Props {
  config: Config;
  currentField: number;
  error: string | null;
  onUpdateConfig: (field: keyof Config, value: string) => void;
  onSetCurrentField: (field: number) => void;
  onInitializeAgent: () => void;
}

type ConfigField = 'accountId' | 'privateKey' | 'network' | 'openAIApiKey';

const hiddenValue = '••••••••';

const fieldDescriptors: Array<{
  key: ConfigField;
  label: string;
  mask?: boolean;
}> = [
  {key: 'accountId', label: 'Account ID:'},
  {key: 'privateKey', label: 'Private Key:', mask: true},
  {key: 'network', label: 'Network:'},
  {key: 'openAIApiKey', label: 'OpenAI Key:', mask: true},
];

const networkOptions: SelectItem<Network>[] = [
  {label: 'Testnet', value: 'testnet'},
  {label: 'Mainnet', value: 'mainnet'},
];

/**
 * Setup screen for configuring credentials
 */
export const SetupScreen: React.FC<Props> = ({
  config,
  currentField,
  error,
  onUpdateConfig,
  onSetCurrentField,
  onInitializeAgent,
}) => {
  useInput((_, key) => {
    if (key.tab && !key.shift) {
      const nextField = (currentField + 1) % fieldDescriptors.length;
      onSetCurrentField(nextField);
    } else if (key.tab && key.shift) {
      const prevField =
        currentField === 0 ? fieldDescriptors.length - 1 : currentField - 1;
      onSetCurrentField(prevField);
    }
  });

  return (
    <TerminalWindow title="Configuration">
      <Box flexDirection="column">
        <Box marginBottom={1}>
          <StatusBadge status="info" />
          <Text>Configure your Hedera account credentials</Text>
        </Box>

        {fieldDescriptors.map(({key, label, mask}, index) => (
          <Box key={key} marginY={1}>
            <Box width={20}>
              <Text
                color={
                  currentField === index
                    ? BRAND_COLORS.blue
                    : BRAND_COLORS.hedera.smoke
                }
              >
                {label}
              </Text>
            </Box>
            {currentField === index ? (
              key === 'network' ? (
                <SelectInput<Network>
                  items={networkOptions}
                  initialIndex={Math.max(
                    0,
                    networkOptions.findIndex(
                      option => option.value === config.network,
                    ),
                  )}
                  onSelect={({value}) => {
                    onUpdateConfig('network', value);
                    if (currentField < fieldDescriptors.length - 1) {
                      onSetCurrentField(currentField + 1);
                    }
                  }}
                />
              ) : (
                <TextInput
                  value={config[key]}
                  onChange={value => onUpdateConfig(key, value)}
                  onSubmit={() => {
                    if (currentField < fieldDescriptors.length - 1) {
                      onSetCurrentField(currentField + 1);
                    } else {
                      onInitializeAgent();
                    }
                  }}
                  mask={mask ? '*' : undefined}
                />
              )
            ) : (
              <Text color={BRAND_COLORS.hedera.smoke}>
                {key === 'network'
                  ? config.network
                  : config[key]
                  ? hiddenValue
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
            Complete all fields and press Enter on the last field to save and start
          </Text>
        </Box>
      </Box>
    </TerminalWindow>
  );
};
