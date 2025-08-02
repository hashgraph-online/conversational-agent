import { z } from 'zod'

export const hederaConfigSchema = z.object({
  accountId: z
    .string()
    .min(1, 'Account ID is required')
    .regex(/^\d+\.\d+\.\d+$/, 'Invalid account ID format (e.g., 0.0.12345)'),
  privateKey: z
    .string()
    .min(1, 'Private key is required')
    .min(64, 'Invalid private key format'),
  network: z.enum(['mainnet', 'testnet'])
})

export const openAIConfigSchema = z.object({
  apiKey: z
    .string()
    .min(1, 'API key is required')
    .startsWith('sk-', "API key must start with 'sk-'"),
  model: z.enum(['gpt-4.1', 'gpt-4.1-mini', 'gpt-4.1-nano', 'gpt-4o', 'gpt-4o-mini', 'gpt-4', 'gpt-3.5-turbo', 'o4-mini'])
})

export const anthropicConfigSchema = z.object({
  apiKey: z
    .string()
    .min(1, 'API key is required')
    .startsWith('sk-ant-', "API key must start with 'sk-ant-'"),
  model: z.enum(['claude-3-5-sonnet-20241022', 'claude-3-5-haiku-20241022', 'claude-3-opus-20240229'])
})

export const advancedConfigSchema = z.object({
  theme: z.enum(['light', 'dark']),
  autoStart: z.boolean(),
  logLevel: z.enum(['debug', 'info', 'warn', 'error'])
})

export const appConfigSchema = z.object({
  hedera: hederaConfigSchema,
  openai: openAIConfigSchema,
  anthropic: anthropicConfigSchema,
  advanced: advancedConfigSchema,
  llmProvider: z.enum(['openai', 'anthropic'])
})

export type HederaConfigForm = z.infer<typeof hederaConfigSchema>
export type OpenAIConfigForm = z.infer<typeof openAIConfigSchema>
export type AnthropicConfigForm = z.infer<typeof anthropicConfigSchema>
export type AdvancedConfigForm = z.infer<typeof advancedConfigSchema>
export type AppConfigForm = z.infer<typeof appConfigSchema>