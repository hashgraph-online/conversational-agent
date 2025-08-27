/**
 * Inscription quote response from standards-agent-kit
 */
export interface InscriptionQuote {
  totalCostHbar: string;
  validUntil: string;
  breakdown: {
    transfers: Array<{
      type: string;
      amount: string;
      description: string;
    }>;
  };
}

/**
 * Parameters for inscription tool calls with quote support
 */
export interface InscriptionToolParams {
  [key: string]: unknown;
  quoteOnly?: boolean;
}

/**
 * Result from inscription tool execution
 */
export interface InscriptionResult {
  success: boolean;
  transactionId?: string;
  message: string;
  quote?: InscriptionQuote;
}

/**
 * User confirmation status for inscription
 */
export interface InscriptionConfirmation {
  confirmed: boolean;
  reason?: string;
}