import React from 'react';
import Typography from '../ui/Typography';
import { cn } from '../../lib/utils';
import {
  FiArrowRight,
  FiDollarSign,
  FiInfo,
  FiHash,
  FiClock,
  FiExternalLink,
} from 'react-icons/fi';

interface TransactionTransfer {
  accountId: string;
  amount: number;
  isDecimal?: boolean;
}

interface TokenTransfer {
  tokenId: string;
  accountId: string;
  amount: number;
}

interface ContractCallInfo {
  contractId: string;
  gas: number;
  amount: number;
  functionParameters?: string;
  functionName?: string;
}

interface ConsensusSubmitMessageData {
  topicId?: string;
  message?: string;
  messageEncoding?: 'utf8' | 'base64';
}

interface TokenCreationData {
  tokenName?: string;
  tokenSymbol?: string;
  initialSupply?: string;
  decimals?: number;
  maxSupply?: string;
  tokenType?: string;
  supplyType?: string;
  memo?: string;
  treasuryAccountId?: string;
}

interface TransactionDetailsProps {
  type: string;
  humanReadableType: string;
  transfers: TransactionTransfer[];
  tokenTransfers: TokenTransfer[];
  memo?: string;
  expirationTime?: string;
  scheduleId?: string;
  contractCall?: ContractCallInfo;
  tokenCreationInfo?: TokenCreationData;
  className?: string;
  hideHeader?: boolean;
  executedTransactionEntityId?: string | null;
  executedTransactionType?: string | null;
  network?: string;
  consensusSubmitMessage?: ConsensusSubmitMessageData;
  variant?: 'default' | 'embedded';
}

/**
 * Format a timestamp string into a readable date
 */
export const formatDate = (timestamp: string): string => {
  if (!timestamp) return '';

  try {
    return new Date(timestamp).toLocaleString();
  } catch {
    return timestamp;
  }
};

/**
 * Component to display transaction summary
 */
const TransactionSummary: React.FC<{
  type: string;
  humanReadableType: string;
  transfers: TransactionTransfer[];
  hideHeader?: boolean;
}> = ({ type, humanReadableType, transfers, hideHeader }) => {
  if (hideHeader) return null;

  if (type === 'cryptoTransfer' && transfers.length > 0) {
    const positiveTransfers = transfers.filter((t) => t.amount > 0);
    const negativeTransfers = transfers.filter((t) => t.amount < 0);

    const sendersText = negativeTransfers
      .map((t) => `${t.accountId} (${Math.abs(t.amount)} ℏ)`)
      .join(', ');

    const receiversText = positiveTransfers
      .map((t) => `${t.accountId} (${t.amount} ℏ)`)
      .join(', ');

    return (
      <div className='flex items-start gap-2 mb-3'>
        <div className='p-1.5 rounded-full bg-brand-blue/20 dark:bg-brand-blue/30 shadow-sm flex-shrink-0'>
          <FiDollarSign className='text-brand-blue h-4 w-4' />
        </div>
        <Typography
          variant='body2'
          className='text-sm font-medium text-gray-700 dark:text-gray-300 leading-relaxed'
        >
          Transfer of HBAR from {sendersText} to {receiversText}
        </Typography>
      </div>
    );
  }

  return (
    <div className='flex items-start gap-2 mb-3'>
      <div className='p-1.5 rounded-full bg-brand-blue/20 dark:bg-brand-blue/30 shadow-sm flex-shrink-0'>
        <FiInfo className='text-brand-blue h-4 w-4' />
      </div>
      <Typography
        variant='body2'
        className='text-sm font-medium text-gray-700 dark:text-gray-300 leading-relaxed'
      >
        {humanReadableType}
      </Typography>
    </div>
  );
};

/**
 * Elegant display component for transaction details
 */
export const TransactionDetails: React.FC<TransactionDetailsProps> = ({
  type,
  humanReadableType,
  transfers,
  tokenTransfers,
  memo,
  expirationTime,
  scheduleId,
  className,
  hideHeader,
  network = 'testnet',
  variant = 'default',
}) => {
  const hasTransfers = transfers.length > 0;
  const hasTokenTransfers = tokenTransfers.length > 0;

  const formattedExpirationTime = expirationTime
    ? formatDate(expirationTime)
    : undefined;

  return (
    <div
      className={cn(
        variant === 'default' &&
          'bg-gradient-to-br from-gray-50 to-gray-100/50 dark:from-gray-800/30 dark:to-gray-900/40 rounded-lg p-4 border border-gray-200 dark:border-gray-700 backdrop-blur-sm shadow-sm',
        variant === 'embedded' && 'p-0',
        className
      )}
    >
      <TransactionSummary
        type={type}
        humanReadableType={humanReadableType}
        transfers={transfers}
        hideHeader={hideHeader}
      />

      <div className='space-y-3'>
        {scheduleId && (
          <div className='flex items-center justify-between gap-2 text-xs font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-800 px-3 py-2 rounded-md border border-gray-200 dark:border-gray-700'>
            <div className='flex items-center gap-2'>
              <FiHash className='h-3.5 w-3.5 text-brand-blue' />
              <span>Schedule ID: {scheduleId}</span>
            </div>
            <a
              href={`https://hashscan.io/${network}/schedule/${scheduleId}`}
              target='_blank'
              rel='noopener noreferrer'
              className='text-brand-blue hover:text-brand-purple'
            >
              <FiExternalLink className='w-3.5 h-3.5' />
            </a>
          </div>
        )}

        {formattedExpirationTime && (
          <div className='flex items-center gap-2 text-xs font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-800 px-3 py-2 rounded-md border border-gray-200 dark:border-gray-700'>
            <FiClock className='h-3.5 w-3.5 text-brand-purple' />
            <span>Expires: {formattedExpirationTime}</span>
          </div>
        )}

        {memo && (
          <div className='text-xs text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-800 px-3 py-2 rounded-md border border-gray-200 dark:border-gray-700'>
            <div className='font-medium mb-1'>Transaction Memo</div>
            <div className='leading-relaxed'>{memo}</div>
          </div>
        )}

        {hasTransfers && (
          <div className='space-y-2'>
            <Typography
              variant='caption'
              className='font-medium text-gray-700 dark:text-gray-300'
            >
              HBAR Transfers ({transfers.length})
            </Typography>
            <div className='bg-white dark:bg-gray-800 rounded-lg overflow-hidden border border-gray-200 dark:border-gray-700 shadow-sm'>
              {transfers.map((transfer, idx) => (
                <div
                  key={`transfer-${idx}`}
                  className={cn(
                    'flex justify-between items-center py-2.5 px-4 transition-colors',
                    idx !== transfers.length - 1 &&
                      'border-b border-gray-200 dark:border-gray-700',
                    idx % 2 === 0 && 'bg-gray-50 dark:bg-gray-800'
                  )}
                >
                  <span className='text-sm font-medium text-gray-700 dark:text-gray-300'>
                    {transfer.accountId}
                  </span>
                  <span
                    className={cn(
                      'text-sm font-semibold px-2 py-0.5 rounded',
                      transfer.amount >= 0
                        ? 'text-brand-green bg-brand-green/10'
                        : 'text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20'
                    )}
                  >
                    {transfer.amount >= 0 ? '+' : ''}
                    {transfer.amount} ℏ
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {hasTokenTransfers && (
          <div className='space-y-2'>
            <Typography
              variant='caption'
              className='font-medium text-gray-700 dark:text-gray-300'
            >
              Token Transfers ({tokenTransfers.length})
            </Typography>
            <div className='bg-white dark:bg-gray-800 rounded-lg overflow-hidden border border-gray-200 dark:border-gray-700 shadow-sm'>
              {tokenTransfers.map((transfer, idx) => (
                <div
                  key={`token-${idx}`}
                  className={cn(
                    'flex justify-between items-center py-2.5 px-4 transition-colors',
                    idx !== tokenTransfers.length - 1 &&
                      'border-b border-gray-200 dark:border-gray-700',
                    idx % 2 === 0 && 'bg-gray-50 dark:bg-gray-800'
                  )}
                >
                  <div className='flex items-center gap-2 text-sm'>
                    <span className='font-medium text-gray-700 dark:text-gray-300'>
                      {transfer.tokenId}
                    </span>
                    <FiArrowRight className='h-3 w-3 text-gray-400' />
                    <span className='text-gray-600 dark:text-gray-400'>
                      {transfer.accountId}
                    </span>
                  </div>
                  <span
                    className={cn(
                      'text-sm font-semibold px-2 py-0.5 rounded',
                      transfer.amount >= 0
                        ? 'text-brand-green bg-brand-green/10'
                        : 'text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20'
                    )}
                  >
                    {transfer.amount >= 0 ? '+' : ''}
                    {transfer.amount}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default TransactionDetails;
