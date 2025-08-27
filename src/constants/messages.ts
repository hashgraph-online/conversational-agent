/**
 * Common error messages and user feedback strings
 */
export const ERROR_MESSAGES = {
  TOO_MANY_REQUESTS: 'Too many requests. Please wait a moment and try again.',
  RATE_LIMITED: "I'm receiving too many requests right now. Please wait a moment and try again.",
  SYSTEM_ERROR: 'System error occurred',
  INVALID_INPUT: 'Invalid input provided',
  NETWORK_ERROR: 'Network error occurred',
} as const;

/**
 * Common success and status messages
 */
export const STATUS_MESSAGES = {
  OPERATION_SUCCESSFUL: 'Operation completed successfully',
  PROCESSING: 'Processing your request...',
  READY: 'Ready to process requests',
  INITIALIZING: 'Initializing...',
} as const;