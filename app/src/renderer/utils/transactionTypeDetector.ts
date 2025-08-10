/**
 * Detect transaction type by checking for specific properties
 * This works even when code is minified and constructor names are mangled
 */
export function detectTransactionType(transaction: any): string {
  if (
    transaction._tokenName !== undefined &&
    transaction._tokenSymbol !== undefined &&
    transaction._decimals !== undefined &&
    transaction._initialSupply !== undefined &&
    transaction._treasuryAccountId !== undefined
  ) {
    return 'TOKENCREATE';
  }

  if (transaction._tokenAirdrops !== undefined) {
    return 'TOKENAIRDROP';
  }

  if (
    transaction._hbarTransfers !== undefined ||
    transaction._tokenTransfers !== undefined ||
    transaction._nftTransfers !== undefined
  ) {
    return 'CRYPTOTRANSFER';
  }

  if (transaction._topicId !== undefined && transaction._message !== undefined) {
    return 'CONSENSUSSUBMITMESSAGE';
  }

  if (transaction._contractId !== undefined && transaction._functionParameters !== undefined) {
    return 'CONTRACTCALL';
  }

  if (transaction._receiverSignatureRequired !== undefined) {
    return 'ACCOUNTCREATE';
  }

  if (transaction._tokenId !== undefined && transaction._amount !== undefined && !transaction._accountId) {
    return 'TOKENMINT';
  }

  if (transaction._tokenId !== undefined && transaction._amount !== undefined && transaction._accountId === undefined) {
    return 'TOKENBURN';
  }

  if (transaction._accountId !== undefined && transaction._tokenIds !== undefined) {
    return 'TOKENASSOCIATE';
  }

  if (transaction._contents !== undefined && transaction._keys !== undefined) {
    return 'FILECREATE';
  }

  if (transaction._topicMemo !== undefined && transaction._adminKey !== undefined) {
    return 'TOPICCREATE';
  }

  return 'UNKNOWN';
}

export function getHumanReadableType(type: string): string {
  const typeMap: Record<string, string> = {
    TOKENCREATE: 'Token Creation',
    TOKENAIRDROP: 'Token Airdrop',
    CRYPTOTRANSFER: 'Crypto Transfer',
    CONSENSUSSUBMITMESSAGE: 'Submit Message',
    CONTRACTCALL: 'Contract Call',
    ACCOUNTCREATE: 'Account Creation',
    TOKENMINT: 'Token Mint',
    TOKENBURN: 'Token Burn',
    TOKENASSOCIATE: 'Token Association',
    FILECREATE: 'File Creation',
    TOPICCREATE: 'Topic Creation',
    UNKNOWN: 'Unknown Transaction'
  };

  return typeMap[type] || 'Unknown Transaction';
}