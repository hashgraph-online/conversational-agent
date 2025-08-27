/**
 * Common entity reference patterns used across the application
 */
export const ENTITY_PATTERNS = {
  TOPIC_REFERENCE: 'the topic',
  TOKEN_REFERENCE: 'the token',
  ACCOUNT_REFERENCE: 'the account',
  TRANSACTION_REFERENCE: 'the transaction',
  CONTRACT_REFERENCE: 'the contract',
} as const;

/**
 * Entity type identifiers
 */
import { EntityFormat } from '../services/formatters/types';

export const ENTITY_TYPES = {
  TOPIC: EntityFormat.TOPIC_ID,
  TOKEN: EntityFormat.TOKEN_ID,
  ACCOUNT: EntityFormat.ACCOUNT_ID,
  TRANSACTION: 'transaction',
  CONTRACT: EntityFormat.CONTRACT_ID,
} as const;
