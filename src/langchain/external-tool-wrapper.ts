/**
 * Mock external tool wrapper functionality
 * These are placeholders to satisfy import statements in test scripts
 */

import { z as _z } from 'zod';

export interface ExternalToolWrapper<T> {
  name: string;
  description: string;
  schema: T;
}

export function wrapExternalToolWithRenderConfig<T>(
  tool: { name: string; description: string; schema: T },
  config: {
    ui?: { label?: string; description?: string };
    fieldConfigs?: Record<string, unknown>;
  }
): ExternalToolWrapper<T> {
  return {
    name: tool.name,
    description: config.ui?.description || tool.description,
    schema: tool.schema
  };
}

export const renderConfigs = {
  text: (label: string, placeholder?: string, help?: string) => ({
    type: 'text',
    label,
    placeholder,
    help
  }),

  number: (label: string, min?: number, max?: number, help?: string) => ({
    type: 'number',
    label,
    min,
    max,
    help
  }),

  accountId: (label: string) => ({
    type: 'accountId',
    label,
    placeholder: '0.0.12345'
  }),

  checkbox: (label: string, help?: string) => ({
    type: 'checkbox',
    label,
    help
  }),

  currency: (label: string, currency: string, min?: number, max?: number) => ({
    type: 'currency',
    label,
    currency,
    min,
    max
  }),

  tokenId: (label: string) => ({
    type: 'tokenId',
    label,
    placeholder: '0.0.12345'
  }),

  select: (label: string, options: Array<{ value: string; label: string }>) => ({
    type: 'select',
    label,
    options
  })
};

export const hederaToolConfigs = {
  hbarTransfer: () => ({
    ui: {
      label: 'HBAR Transfer',
      description: 'Transfer HBAR between accounts'
    },
    fieldConfigs: {
      fromAccountId: renderConfigs.accountId('From Account'),
      toAccountId: renderConfigs.accountId('To Account'),
      amount: renderConfigs.currency('Amount', 'HBAR', 0.00000001, 1000),
      memo: renderConfigs.text('Memo', 'Optional memo')
    }
  })
};