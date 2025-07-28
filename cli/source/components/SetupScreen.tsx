import React from 'react';
import {Box, Text, useInput} from 'ink';
import TextInput from 'ink-text-input';
import SelectInput from 'ink-select-input';
import {TerminalWindow} from './TerminalWindow';
import {StatusBadge} from './StatusBadge';
import {BRAND_COLORS, type Config} from '../types';

interface Props {
  config: Config;
  currentField: number;
  error: string | null;
  onUpdateConfig: (field: keyof Config, value: string) => void;
  onSetCurrentField: (field: number) => void;
  onInitializeAgent: () => void;
}

const fields = ['accountId', 'privateKey', 'network', 'openAIApiKey'];

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
      const nextField = (currentField + 1) % fields.length;
      onSetCurrentField(nextField);
    } else if (key.tab && key.shift) {
      const prevField = currentField === 0 ? fields.length - 1 : currentField - 1;
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
                    onUpdateConfig('network', item.value as 'testnet' | 'mainnet');
                    if (currentField < fields.length - 1) {
                      onSetCurrentField(currentField + 1);
                    }
                  }}
                />
              ) : (
                <TextInput
                  value={config[field as keyof Config]}
                  onChange={value => onUpdateConfig(field as keyof Config, value)}
                  onSubmit={() => {
                    if (currentField < fields.length - 1) {
                      onSetCurrentField(currentField + 1);
                    } else {
                      onInitializeAgent();
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
                  : config[field as keyof Config]
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
            Complete all fields and press Enter on the last field to save and start
          </Text>
        </Box>
      </Box>
    </TerminalWindow>
  );
};