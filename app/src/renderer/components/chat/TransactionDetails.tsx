import React, { useMemo } from 'react';
import { format } from 'date-fns';
import Typography from '../ui/Typography';
import { cn } from '../../lib/utils';
import { useTokenInfoBatch, formatTokenAmount } from '../../hooks/useTokenInfo';
import {
  FiArrowRight,
  FiDollarSign,
  FiInfo,
  FiHash,
  FiClock,
  FiExternalLink,
  FiUser,
  FiFile,
  FiMessageCircle,
  FiCode,
  FiSettings,
  FiShield,
  FiTrash2,
  FiEdit,
  FiPlus,
  FiMinus,
  FiLock,
  FiUnlock,
  FiKey,
  FiPlay,
  FiPause,
  FiRefreshCw,
  FiGift,
  FiCalendar,
  FiDatabase,
  FiTarget,
} from 'react-icons/fi';

/**
 * TODO: refactor + break up this monstrosity into smaller components
 */

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
  adminKey?: string;
  kycKey?: string;
  freezeKey?: string;
  wipeKey?: string;
  supplyKey?: string;
  feeScheduleKey?: string;
  pauseKey?: string;
  metadataKey?: string;
  autoRenewAccount?: string;
  autoRenewPeriod?: string;
  expiry?: string;
  customFees?: Array<{
    feeCollectorAccountId: string;
    feeType: string;
    amount?: string;
    denominatingTokenId?: string;
  }>;
}

interface TokenMintData {
  tokenId: string;
  amount: number;
  metadata?: string[];
}

interface TokenBurnData {
  tokenId: string;
  amount: number;
  serialNumbers?: number[];
}

interface TokenUpdateData {
  tokenId?: string;
  name?: string;
  symbol?: string;
  treasuryAccountId?: string;
  adminKey?: string;
  kycKey?: string;
  freezeKey?: string;
  wipeKey?: string;
  supplyKey?: string;
  feeScheduleKey?: string;
  pauseKey?: string;
  autoRenewAccountId?: string;
  autoRenewPeriod?: string;
  memo?: string;
  expiry?: string;
}

interface TokenDeleteData {
  tokenId?: string;
}

interface TokenAssociateData {
  accountId?: string;
  tokenIds?: string[];
}

interface TokenDissociateData {
  accountId?: string;
  tokenIds?: string[];
}

interface TokenFreezeData {
  tokenId?: string;
  accountId?: string;
}

interface TokenUnfreezeData {
  tokenId?: string;
  accountId?: string;
}

interface TokenGrantKycData {
  tokenId?: string;
  accountId?: string;
}

interface TokenRevokeKycData {
  tokenId?: string;
  accountId?: string;
}

interface TokenPauseData {
  tokenId?: string;
}

interface TokenUnpauseData {
  tokenId?: string;
}

interface TokenWipeAccountData {
  tokenId?: string;
  accountId?: string;
  serialNumbers?: string[];
  amount?: string;
}

interface TokenFeeScheduleUpdateData {
  tokenId?: string;
  customFees?: Array<{
    feeCollectorAccountId: string;
    feeType: string;
    amount?: string;
    denominatingTokenId?: string;
  }>;
}

interface AirdropData {
  tokenTransfers?: Array<{
    tokenId: string;
    transfers: Array<{
      accountId: string;
      amount: string;
    }>;
  }>;
}

interface CryptoCreateAccountData {
  initialBalance?: string;
  key?: string;
  receiverSigRequired?: boolean;
  autoRenewPeriod?: string;
  memo?: string;
  maxAutomaticTokenAssociations?: number;
  stakedAccountId?: string;
  stakedNodeId?: string;
  declineReward?: boolean;
  alias?: string;
}

interface CryptoUpdateAccountData {
  accountIdToUpdate?: string;
  key?: string;
  expirationTime?: string;
  receiverSigRequired?: boolean;
  autoRenewPeriod?: string;
  memo?: string;
  maxAutomaticTokenAssociations?: number;
  stakedAccountId?: string;
  stakedNodeId?: string;
  declineReward?: boolean;
}

interface CryptoDeleteData {
  deleteAccountId?: string;
  transferAccountId?: string;
}

interface CryptoApproveAllowanceData {
  hbarAllowances?: Array<{
    ownerAccountId?: string;
    spenderAccountId?: string;
    amount?: string;
  }>;
  tokenAllowances?: Array<{
    tokenId?: string;
    ownerAccountId?: string;
    spenderAccountId?: string;
    amount?: string;
  }>;
  nftAllowances?: Array<{
    tokenId?: string;
    ownerAccountId?: string;
    spenderAccountId?: string;
    serialNumbers?: string[];
    approvedForAll?: boolean;
    delegatingSpender?: string;
  }>;
}

interface CryptoDeleteAllowanceData {
  nftAllowancesToRemove?: Array<{
    ownerAccountId?: string;
    tokenId?: string;
    serialNumbers?: string[];
  }>;
}

interface ContractCallInfo {
  contractId: string;
  gas: number;
  amount: number;
  functionParameters?: string;
  functionName?: string;
}

interface ContractCreateData {
  initialBalance?: string;
  gas?: string;
  adminKey?: string;
  constructorParameters?: string;
  memo?: string;
  autoRenewPeriod?: string;
  stakedAccountId?: string;
  stakedNodeId?: string;
  declineReward?: boolean;
  maxAutomaticTokenAssociations?: number;
  initcodeSource?: 'fileID' | 'bytes';
  initcode?: string;
}

interface ContractUpdateData {
  contractIdToUpdate?: string;
  adminKey?: string;
  expirationTime?: string;
  autoRenewPeriod?: string;
  memo?: string;
  stakedAccountId?: string;
  stakedNodeId?: string;
  declineReward?: boolean;
  maxAutomaticTokenAssociations?: number;
  autoRenewAccountId?: string;
}

interface ContractDeleteData {
  contractIdToDelete?: string;
  transferAccountId?: string;
  transferContractId?: string;
}

interface FileCreateData {
  expirationTime?: string;
  keys?: string;
  contents?: string;
  memo?: string;
  maxSize?: string;
}

interface FileAppendData {
  fileId?: string;
  contents?: string;
}

interface FileUpdateData {
  fileId?: string;
  expirationTime?: string;
  keys?: string;
  contents?: string;
  memo?: string;
}

interface FileDeleteData {
  fileId?: string;
}

interface ConsensusCreateTopicData {
  memo?: string;
  adminKey?: string;
  submitKey?: string;
  autoRenewPeriod?: string;
  autoRenewAccountId?: string;
}

interface ConsensusSubmitMessageData {
  topicId?: string;
  message?: string;
  messageEncoding?: 'utf8' | 'base64';
  chunkInfoInitialTransactionID?: string;
  chunkInfoNumber?: number;
  chunkInfoTotal?: number;
}

interface ConsensusUpdateTopicData {
  topicId?: string;
  memo?: string;
  adminKey?: string;
  submitKey?: string;
  autoRenewPeriod?: string;
  autoRenewAccountId?: string;
  clearAdminKey?: boolean;
  clearSubmitKey?: boolean;
}

interface ConsensusDeleteTopicData {
  topicId?: string;
}

interface ScheduleCreateData {
  scheduledTransactionBody?: string;
  memo?: string;
  adminKey?: string;
  payerAccountId?: string;
  expirationTime?: string;
  waitForExpiry?: boolean;
}

interface ScheduleSignData {
  scheduleId?: string;
}

interface ScheduleDeleteData {
  scheduleId?: string;
}

interface UtilPrngData {
  range?: number;
  prngBytes?: string;
}

interface FreezeData {
  startTime?: string;
  fileId?: string;
  fileHash?: string;
}

interface SystemDeleteData {
  fileId?: string;
  contractId?: string;
  expirationTime?: string;
}

interface SystemUndeleteData {
  fileId?: string;
  contractId?: string;
}

interface TransactionDetailsProps {
  type: string;
  humanReadableType: string;
  transfers: TransactionTransfer[];
  tokenTransfers: TokenTransfer[];
  memo?: string;
  expirationTime?: string;
  scheduleId?: string;
  className?: string;
  hideHeader?: boolean;
  executedTransactionEntityId?: string | null;
  executedTransactionType?: string | null;
  network?: string;
  variant?: 'default' | 'embedded';

  tokenCreationInfo?: TokenCreationData;
  tokenCreation?: TokenCreationData;
  tokenMint?: TokenMintData;
  tokenBurn?: TokenBurnData;
  tokenUpdate?: TokenUpdateData;
  tokenDelete?: TokenDeleteData;
  tokenAssociate?: TokenAssociateData;
  tokenDissociate?: TokenDissociateData;
  tokenFreeze?: TokenFreezeData;
  tokenUnfreeze?: TokenUnfreezeData;
  tokenGrantKyc?: TokenGrantKycData;
  tokenRevokeKyc?: TokenRevokeKycData;
  tokenPause?: TokenPauseData;
  tokenUnpause?: TokenUnpauseData;
  tokenWipeAccount?: TokenWipeAccountData;
  tokenFeeScheduleUpdate?: TokenFeeScheduleUpdateData;
  airdrop?: AirdropData;
  tokenAirdrop?: AirdropData;

  cryptoCreateAccount?: CryptoCreateAccountData;
  cryptoUpdateAccount?: CryptoUpdateAccountData;
  cryptoDelete?: CryptoDeleteData;
  cryptoApproveAllowance?: CryptoApproveAllowanceData;
  cryptoDeleteAllowance?: CryptoDeleteAllowanceData;

  contractCall?: ContractCallInfo;
  contractCreate?: ContractCreateData;
  contractUpdate?: ContractUpdateData;
  contractDelete?: ContractDeleteData;

  fileCreate?: FileCreateData;
  fileAppend?: FileAppendData;
  fileUpdate?: FileUpdateData;
  fileDelete?: FileDeleteData;

  consensusCreateTopic?: ConsensusCreateTopicData;
  consensusSubmitMessage?: ConsensusSubmitMessageData;
  consensusUpdateTopic?: ConsensusUpdateTopicData;
  consensusDeleteTopic?: ConsensusDeleteTopicData;

  scheduleCreate?: ScheduleCreateData;
  scheduleSign?: ScheduleSignData;
  scheduleDelete?: ScheduleDeleteData;

  utilPrng?: UtilPrngData;
  freeze?: FreezeData;
  systemDelete?: SystemDeleteData;
  systemUndelete?: SystemUndeleteData;
}

/**
 * Format a timestamp string into a readable date
 */

/**
 * Get transaction type icon and color based on transaction type
 */
const getTransactionIcon = (
  type: string
): { icon: React.ComponentType<{ className?: string }>; color: string } => {
  const typeToIconMap: Record<
    string,
    { icon: React.ComponentType<{ className?: string }>; color: string }
  > = {
    CRYPTOTRANSFER: { icon: FiDollarSign, color: 'brand-blue' },
    ACCOUNTCREATE: { icon: FiUser, color: 'brand-green' },
    ACCOUNTUPDATE: { icon: FiEdit, color: 'brand-purple' },
    ACCOUNTDELETE: { icon: FiTrash2, color: 'red-500' },
    APPROVEALLOWANCE: { icon: FiKey, color: 'brand-green' },
    DELETEALLOWANCE: { icon: FiTrash2, color: 'red-500' },

    TOKENCREATE: { icon: FiPlus, color: 'brand-green' },
    TOKENCREATION: { icon: FiPlus, color: 'brand-green' },
    TOKENMINT: { icon: FiPlus, color: 'brand-green' },
    TOKENBURN: { icon: FiMinus, color: 'red-500' },
    TOKENUPDATE: { icon: FiEdit, color: 'brand-purple' },
    TOKENDELETE: { icon: FiTrash2, color: 'red-500' },
    TOKENASSOCIATE: { icon: FiRefreshCw, color: 'brand-green' },
    TOKENDISSOCIATE: { icon: FiRefreshCw, color: 'red-500' },
    TOKENFREEZE: { icon: FiLock, color: 'blue-500' },
    TOKENUNFREEZE: { icon: FiUnlock, color: 'brand-green' },
    TOKENGRANTKYC: { icon: FiShield, color: 'brand-green' },
    TOKENREVOKEKYC: { icon: FiShield, color: 'red-500' },
    TOKENPAUSE: { icon: FiPause, color: 'orange-500' },
    TOKENUNPAUSE: { icon: FiPlay, color: 'brand-green' },
    TOKENWIPE: { icon: FiTrash2, color: 'red-600' },
    TOKENFEESCHEDULEUPDATE: { icon: FiSettings, color: 'brand-purple' },
    TOKENAIRDROP: { icon: FiGift, color: 'brand-green' },

    CONTRACTCALL: { icon: FiCode, color: 'brand-blue' },
    CONTRACTCREATE: { icon: FiPlus, color: 'brand-green' },
    CONTRACTUPDATE: { icon: FiEdit, color: 'brand-purple' },
    CONTRACTDELETE: { icon: FiTrash2, color: 'red-500' },

    FILECREATE: { icon: FiFile, color: 'brand-green' },
    FILEUPDATE: { icon: FiEdit, color: 'brand-purple' },
    FILEDELETE: { icon: FiTrash2, color: 'red-500' },
    FILEAPPEND: { icon: FiPlus, color: 'brand-blue' },

    TOPICCREATE: { icon: FiMessageCircle, color: 'brand-green' },
    TOPICUPDATE: { icon: FiEdit, color: 'brand-purple' },
    TOPICDELETE: { icon: FiTrash2, color: 'red-500' },
    CONSENSUSSUBMITMESSAGE: { icon: FiMessageCircle, color: 'brand-blue' },

    SCHEDULECREATE: { icon: FiCalendar, color: 'brand-green' },
    SCHEDULESIGN: { icon: FiKey, color: 'brand-blue' },
    SCHEDULEDELETE: { icon: FiTrash2, color: 'red-500' },

    PRNG: { icon: FiTarget, color: 'brand-purple' },
    FREEZE: { icon: FiLock, color: 'blue-500' },
    SYSTEMDELETE: { icon: FiDatabase, color: 'red-500' },
    SYSTEMUNDELETE: { icon: FiDatabase, color: 'brand-green' },
  };

  return typeToIconMap[type] || { icon: FiInfo, color: 'brand-blue' };
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

  const { icon: IconComponent, color } = getTransactionIcon(type);

  if (type === 'CRYPTOTRANSFER' && transfers.length > 0) {
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
        <div
          className={`p-1.5 rounded-full bg-${color}/20 dark:bg-${color}/30 shadow-sm flex-shrink-0`}
        >
          <IconComponent className={`text-${color} h-4 w-4`} />
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
      <div
        className={`p-1.5 rounded-full bg-${color}/20 dark:bg-${color}/30 shadow-sm flex-shrink-0`}
      >
        <IconComponent className={`text-${color} h-4 w-4`} />
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
 * Generic section component for displaying transaction data
 */
const TransactionSection: React.FC<{
  title: string;
  children: React.ReactNode;
}> = ({ title, children }) => (
  <div className='space-y-2'>
    <Typography
      variant='caption'
      className='font-medium text-gray-700 dark:text-gray-300'
    >
      {title}
    </Typography>
    <div className='bg-white dark:bg-gray-800 rounded-lg overflow-hidden border border-gray-200 dark:border-gray-700 shadow-sm'>
      {children}
    </div>
  </div>
);

/**
 * Field row component for key-value pairs
 */
const FieldRow: React.FC<{
  label: string;
  value: string | number | undefined;
  isLast?: boolean;
  isMono?: boolean;
}> = ({ label, value, isLast = false, isMono = false }) => {
  if (value === undefined || value === null || value === '') return null;

  return (
    <div
      className={cn(
        'flex justify-between items-center py-2.5 px-4',
        !isLast && 'border-b border-gray-200 dark:border-gray-700'
      )}
    >
      <span className='text-sm font-medium text-gray-700 dark:text-gray-300'>
        {label}
      </span>
      <span
        className={cn(
          'text-sm text-gray-600 dark:text-gray-400',
          isMono && 'font-mono'
        )}
      >
        {typeof value === 'number' ? value.toLocaleString() : value}
      </span>
    </div>
  );
};

/**
 * Comprehensive transaction details display component supporting all Hedera transaction types
 */
export const TransactionDetails: React.FC<TransactionDetailsProps> = (
  props
) => {
  const {
    type,
    humanReadableType,
    transfers,
    tokenTransfers,
    memo,
    expirationTime,
    scheduleId,
    className,
    hideHeader,
    executedTransactionEntityId,
    executedTransactionType,
    network = 'testnet',
    variant = 'default',
    tokenCreationInfo,
    tokenCreation,
    tokenMint,
    tokenBurn,
    tokenUpdate,
    tokenDelete,
    tokenAssociate,
    tokenDissociate,
    tokenFreeze,
    tokenUnfreeze,
    tokenGrantKyc,
    tokenRevokeKyc,
    tokenPause,
    tokenUnpause,
    tokenWipeAccount,
    tokenFeeScheduleUpdate,
    airdrop,
    tokenAirdrop,
    cryptoCreateAccount,
    cryptoUpdateAccount,
    cryptoDelete,
    cryptoApproveAllowance,
    cryptoDeleteAllowance,
    contractCall,
    contractCreate,
    contractUpdate,
    contractDelete,
    fileCreate,
    fileAppend,
    fileUpdate,
    fileDelete,
    consensusCreateTopic,
    consensusSubmitMessage,
    consensusUpdateTopic,
    consensusDeleteTopic,
    scheduleCreate,
    scheduleSign,
    scheduleDelete,
    utilPrng,
    freeze,
    systemDelete,
    systemUndelete,
  } = props;

  const hasTransfers = transfers.length > 0;
  const hasTokenTransfers = tokenTransfers.length > 0;
  const tokenCreationData = tokenCreationInfo || tokenCreation;
  const hasTokenCreation = !!tokenCreationData;

  // Collect all unique token IDs from transfers and airdrops
  const tokenIds = useMemo(() => {
    const ids = new Set<string>();

    // From token transfers
    tokenTransfers.forEach((transfer) => ids.add(transfer.tokenId));

    // From airdrop data
    if (airdrop?.tokenTransfers) {
      airdrop.tokenTransfers.forEach((t) => ids.add(t.tokenId));
    }
    if (tokenAirdrop?.tokenTransfers) {
      tokenAirdrop.tokenTransfers.forEach((t) => ids.add(t.tokenId));
    }

    return Array.from(ids);
  }, [tokenTransfers, airdrop, tokenAirdrop]);

  // Fetch token info for all tokens
  const tokenInfoMap = useTokenInfoBatch(tokenIds);

  let airdropData = airdrop || tokenAirdrop;
  if (!airdropData && type === 'TOKENAIRDROP' && hasTokenTransfers) {
    const tokenMap = new Map<
      string,
      Array<{ accountId: string; amount: string }>
    >();
    tokenTransfers.forEach((transfer) => {
      if (!tokenMap.has(transfer.tokenId)) {
        tokenMap.set(transfer.tokenId, []);
      }
      tokenMap.get(transfer.tokenId)!.push({
        accountId: transfer.accountId,
        amount: transfer.amount.toString(),
      });
    });

    airdropData = {
      tokenTransfers: Array.from(tokenMap.entries()).map(
        ([tokenId, transfers]) => ({
          tokenId,
          transfers,
        })
      ),
    };
  }

  const hasAirdrop = !!airdropData?.tokenTransfers?.length;

  const formattedExpirationTime = expirationTime
    ? (() => {
        try {
          return format(new Date(expirationTime), 'PPpp');
        } catch {
          return expirationTime;
        }
      })()
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
          <TransactionSection title={`HBAR Transfers (${transfers.length})`}>
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
          </TransactionSection>
        )}

        {hasTokenTransfers && (
          <TransactionSection
            title={`Token Transfers (${tokenTransfers.length})`}
          >
            {tokenTransfers.map((transfer, idx) => {
              const tokenInfo = tokenInfoMap.get(transfer.tokenId);
              const formattedAmount =
                tokenInfo && !tokenInfo.loading
                  ? formatTokenAmount(transfer.amount, tokenInfo.decimals)
                  : transfer.amount.toString();
              const symbol = tokenInfo?.symbol || '';

              return (
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
                      {symbol && (
                        <span className='text-gray-500 ml-1'>({symbol})</span>
                      )}
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
                    {formattedAmount} {symbol}
                  </span>
                </div>
              );
            })}
          </TransactionSection>
        )}

        {hasTokenCreation && tokenCreationData && (
          <TransactionSection title='Token Creation Details'>
            <div className='p-4 space-y-1'>
              {executedTransactionEntityId &&
                (type === 'TOKENCREATE' ||
                  type === 'TOKENCREATION' ||
                  executedTransactionType === 'TOKENCREATE' ||
                  executedTransactionType === 'TOKENCREATION') && (
                  <div className='mb-3 p-3 bg-brand-green/10 dark:bg-brand-green/20 border border-brand-green/30 rounded-lg'>
                    <div className='flex items-center gap-2'>
                      <FiHash className='h-4 w-4 text-brand-green' />
                      <span className='text-sm font-medium text-gray-700 dark:text-gray-300'>
                        Created Token ID:
                      </span>
                      <span className='text-sm font-mono font-bold text-brand-green'>
                        {executedTransactionEntityId}
                      </span>
                      <a
                        href={`https://hashscan.io/${network}/token/${executedTransactionEntityId}`}
                        target='_blank'
                        rel='noopener noreferrer'
                        className='ml-auto text-brand-blue hover:text-brand-purple'
                      >
                        <FiExternalLink className='w-3.5 h-3.5' />
                      </a>
                    </div>
                  </div>
                )}
              <FieldRow
                label='Token Name'
                value={tokenCreationData.tokenName}
              />
              <FieldRow
                label='Symbol'
                value={tokenCreationData.tokenSymbol}
                isMono
              />
              <FieldRow
                label='Initial Supply'
                value={
                  tokenCreationData.initialSupply
                    ? Number(tokenCreationData.initialSupply).toLocaleString()
                    : undefined
                }
              />
              <FieldRow label='Decimals' value={tokenCreationData.decimals} />
              <FieldRow
                label='Max Supply'
                value={
                  tokenCreationData.maxSupply
                    ? Number(tokenCreationData.maxSupply).toLocaleString()
                    : undefined
                }
              />
              <FieldRow
                label='Supply Type'
                value={tokenCreationData.supplyType}
              />
              <FieldRow
                label='Token Type'
                value={tokenCreationData.tokenType}
              />
              <FieldRow
                label='Treasury Account'
                value={tokenCreationData.treasuryAccountId}
                isMono
              />
              <FieldRow
                label='Admin Key'
                value={tokenCreationData.adminKey ? 'Set' : undefined}
              />
              <FieldRow
                label='KYC Key'
                value={tokenCreationData.kycKey ? 'Set' : undefined}
              />
              <FieldRow
                label='Freeze Key'
                value={tokenCreationData.freezeKey ? 'Set' : undefined}
              />
              <FieldRow
                label='Wipe Key'
                value={tokenCreationData.wipeKey ? 'Set' : undefined}
              />
              <FieldRow
                label='Supply Key'
                value={tokenCreationData.supplyKey ? 'Set' : undefined}
              />
              <FieldRow
                label='Fee Schedule Key'
                value={tokenCreationData.feeScheduleKey ? 'Set' : undefined}
              />
              <FieldRow
                label='Pause Key'
                value={tokenCreationData.pauseKey ? 'Set' : undefined}
              />
              <FieldRow
                label='Auto Renew Account'
                value={tokenCreationData.autoRenewAccount}
                isMono
              />
              <FieldRow
                label='Auto Renew Period'
                value={tokenCreationData.autoRenewPeriod}
              />
              {tokenCreationData.memo && (
                <div className='pt-2 border-t border-gray-200 dark:border-gray-700'>
                  <div className='text-sm font-medium text-gray-700 dark:text-gray-300 mb-1'>
                    Token Memo
                  </div>
                  <div className='text-sm text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-700 p-2 rounded'>
                    {tokenCreationData.memo}
                  </div>
                </div>
              )}
              {tokenCreationData.customFees &&
                tokenCreationData.customFees.length > 0 && (
                  <div className='pt-2 border-t border-gray-200 dark:border-gray-700'>
                    <div className='text-sm font-medium text-gray-700 dark:text-gray-300 mb-1'>
                      Custom Fees ({tokenCreationData.customFees.length})
                    </div>
                    <div className='space-y-1'>
                      {tokenCreationData.customFees.map((fee, idx) => (
                        <div
                          key={idx}
                          className='text-sm text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-700 p-2 rounded'
                        >
                          {fee.feeType}: {fee.amount}{' '}
                          {fee.denominatingTokenId
                            ? `(Token: ${fee.denominatingTokenId})`
                            : '(HBAR)'}{' '}
                          → {fee.feeCollectorAccountId}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
            </div>
          </TransactionSection>
        )}

        {tokenMint && (
          <TransactionSection title='Token Mint Details'>
            <div className='p-4 space-y-1'>
              <FieldRow label='Token ID' value={tokenMint.tokenId} isMono />
              <FieldRow label='Amount' value={tokenMint.amount} />
              {tokenMint.metadata && tokenMint.metadata.length > 0 && (
                <div className='pt-2 border-t border-gray-200 dark:border-gray-700'>
                  <div className='text-sm font-medium text-gray-700 dark:text-gray-300 mb-1'>
                    Metadata ({tokenMint.metadata.length} items)
                  </div>
                  <div className='space-y-1'>
                    {tokenMint.metadata.map((meta, idx) => (
                      <div
                        key={idx}
                        className='text-sm text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-700 p-2 rounded font-mono text-xs'
                      >
                        {meta}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </TransactionSection>
        )}

        {tokenBurn && (
          <TransactionSection title='Token Burn Details'>
            <div className='p-4 space-y-1'>
              <FieldRow label='Token ID' value={tokenBurn.tokenId} isMono />
              <FieldRow label='Amount' value={tokenBurn.amount} />
              {tokenBurn.serialNumbers &&
                tokenBurn.serialNumbers.length > 0 && (
                  <FieldRow
                    label='Serial Numbers'
                    value={tokenBurn.serialNumbers.join(', ')}
                  />
                )}
            </div>
          </TransactionSection>
        )}

        {tokenUpdate && (
          <TransactionSection title='Token Update Details'>
            <div className='p-4 space-y-1'>
              <FieldRow label='Token ID' value={tokenUpdate.tokenId} isMono />
              <FieldRow label='Name' value={tokenUpdate.name} />
              <FieldRow label='Symbol' value={tokenUpdate.symbol} isMono />
              <FieldRow
                label='Treasury Account'
                value={tokenUpdate.treasuryAccountId}
                isMono
              />
              <FieldRow
                label='Admin Key'
                value={tokenUpdate.adminKey ? 'Updated' : undefined}
              />
              <FieldRow
                label='KYC Key'
                value={tokenUpdate.kycKey ? 'Updated' : undefined}
              />
              <FieldRow
                label='Freeze Key'
                value={tokenUpdate.freezeKey ? 'Updated' : undefined}
              />
              <FieldRow
                label='Wipe Key'
                value={tokenUpdate.wipeKey ? 'Updated' : undefined}
              />
              <FieldRow
                label='Supply Key'
                value={tokenUpdate.supplyKey ? 'Updated' : undefined}
              />
              <FieldRow
                label='Fee Schedule Key'
                value={tokenUpdate.feeScheduleKey ? 'Updated' : undefined}
              />
              <FieldRow
                label='Pause Key'
                value={tokenUpdate.pauseKey ? 'Updated' : undefined}
              />
              <FieldRow
                label='Auto Renew Account'
                value={tokenUpdate.autoRenewAccountId}
                isMono
              />
              <FieldRow
                label='Auto Renew Period'
                value={tokenUpdate.autoRenewPeriod}
              />
              <FieldRow label='Memo' value={tokenUpdate.memo} />
              <FieldRow label='Expiry' value={tokenUpdate.expiry} />
            </div>
          </TransactionSection>
        )}

        {tokenDelete && (
          <TransactionSection title='Token Delete Details'>
            <div className='p-4'>
              <FieldRow
                label='Token ID'
                value={tokenDelete.tokenId}
                isMono
                isLast
              />
            </div>
          </TransactionSection>
        )}

        {tokenAssociate && (
          <TransactionSection title='Token Association Details'>
            <div className='p-4 space-y-1'>
              <FieldRow
                label='Account ID'
                value={tokenAssociate.accountId}
                isMono
              />
              {tokenAssociate.tokenIds && (
                <div>
                  <div className='text-sm font-medium text-gray-700 dark:text-gray-300 mb-1'>
                    Token IDs ({tokenAssociate.tokenIds.length})
                  </div>
                  <div className='text-sm text-gray-600 dark:text-gray-400 font-mono'>
                    {tokenAssociate.tokenIds.join(', ')}
                  </div>
                </div>
              )}
            </div>
          </TransactionSection>
        )}

        {tokenDissociate && (
          <TransactionSection title='Token Dissociation Details'>
            <div className='p-4 space-y-1'>
              <FieldRow
                label='Account ID'
                value={tokenDissociate.accountId}
                isMono
              />
              {tokenDissociate.tokenIds && (
                <div>
                  <div className='text-sm font-medium text-gray-700 dark:text-gray-300 mb-1'>
                    Token IDs ({tokenDissociate.tokenIds.length})
                  </div>
                  <div className='text-sm text-gray-600 dark:text-gray-400 font-mono'>
                    {tokenDissociate.tokenIds.join(', ')}
                  </div>
                </div>
              )}
            </div>
          </TransactionSection>
        )}

        {tokenFreeze && (
          <TransactionSection title='Token Freeze Details'>
            <div className='p-4 space-y-1'>
              <FieldRow label='Token ID' value={tokenFreeze.tokenId} isMono />
              <FieldRow
                label='Account ID'
                value={tokenFreeze.accountId}
                isMono
                isLast
              />
            </div>
          </TransactionSection>
        )}

        {tokenUnfreeze && (
          <TransactionSection title='Token Unfreeze Details'>
            <div className='p-4 space-y-1'>
              <FieldRow label='Token ID' value={tokenUnfreeze.tokenId} isMono />
              <FieldRow
                label='Account ID'
                value={tokenUnfreeze.accountId}
                isMono
                isLast
              />
            </div>
          </TransactionSection>
        )}

        {tokenGrantKyc && (
          <TransactionSection title='Token Grant KYC Details'>
            <div className='p-4 space-y-1'>
              <FieldRow label='Token ID' value={tokenGrantKyc.tokenId} isMono />
              <FieldRow
                label='Account ID'
                value={tokenGrantKyc.accountId}
                isMono
                isLast
              />
            </div>
          </TransactionSection>
        )}

        {tokenRevokeKyc && (
          <TransactionSection title='Token Revoke KYC Details'>
            <div className='p-4 space-y-1'>
              <FieldRow
                label='Token ID'
                value={tokenRevokeKyc.tokenId}
                isMono
              />
              <FieldRow
                label='Account ID'
                value={tokenRevokeKyc.accountId}
                isMono
                isLast
              />
            </div>
          </TransactionSection>
        )}

        {tokenPause && (
          <TransactionSection title='Token Pause Details'>
            <div className='p-4'>
              <FieldRow
                label='Token ID'
                value={tokenPause.tokenId}
                isMono
                isLast
              />
            </div>
          </TransactionSection>
        )}

        {tokenUnpause && (
          <TransactionSection title='Token Unpause Details'>
            <div className='p-4'>
              <FieldRow
                label='Token ID'
                value={tokenUnpause.tokenId}
                isMono
                isLast
              />
            </div>
          </TransactionSection>
        )}

        {tokenWipeAccount && (
          <TransactionSection title='Token Wipe Details'>
            <div className='p-4 space-y-1'>
              <FieldRow
                label='Token ID'
                value={tokenWipeAccount.tokenId}
                isMono
              />
              <FieldRow
                label='Account ID'
                value={tokenWipeAccount.accountId}
                isMono
              />
              <FieldRow label='Amount' value={tokenWipeAccount.amount} />
              {tokenWipeAccount.serialNumbers &&
                tokenWipeAccount.serialNumbers.length > 0 && (
                  <FieldRow
                    label='Serial Numbers'
                    value={tokenWipeAccount.serialNumbers.join(', ')}
                  />
                )}
            </div>
          </TransactionSection>
        )}

        {tokenFeeScheduleUpdate && (
          <TransactionSection title='Token Fee Schedule Update Details'>
            <div className='p-4 space-y-1'>
              <FieldRow
                label='Token ID'
                value={tokenFeeScheduleUpdate.tokenId}
                isMono
              />
              {tokenFeeScheduleUpdate.customFees &&
                tokenFeeScheduleUpdate.customFees.length > 0 && (
                  <div className='pt-2 border-t border-gray-200 dark:border-gray-700'>
                    <div className='text-sm font-medium text-gray-700 dark:text-gray-300 mb-1'>
                      Custom Fees ({tokenFeeScheduleUpdate.customFees.length})
                    </div>
                    <div className='space-y-1'>
                      {tokenFeeScheduleUpdate.customFees.map((fee, idx) => (
                        <div
                          key={idx}
                          className='text-sm text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-700 p-2 rounded'
                        >
                          {fee.feeType}: {fee.amount}{' '}
                          {fee.denominatingTokenId
                            ? `(Token: ${fee.denominatingTokenId})`
                            : '(HBAR)'}{' '}
                          → {fee.feeCollectorAccountId}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
            </div>
          </TransactionSection>
        )}

        {hasAirdrop && airdropData && (
          <TransactionSection title='Token Airdrop Details'>
            {airdropData.tokenTransfers?.map((tokenTransfer, idx) => {
              const tokenInfo = tokenInfoMap.get(tokenTransfer.tokenId);
              const symbol = tokenInfo?.symbol || '';
              const tokenName = tokenInfo?.name || '';

              return (
                <div
                  key={`airdrop-${idx}`}
                  className='border-b border-gray-200 dark:border-gray-700 last:border-b-0'
                >
                  <div className='p-3 bg-gray-50 dark:bg-gray-900/50'>
                    <div className='flex items-center gap-2'>
                      <FiHash className='h-3.5 w-3.5 text-brand-blue' />
                      <span className='text-sm font-medium text-gray-700 dark:text-gray-300'>
                        Token: {tokenTransfer.tokenId}
                        {(tokenName || symbol) && (
                          <span className='text-gray-500 ml-1'>
                            ({tokenName}
                            {tokenName && symbol ? ' - ' : ''}
                            {symbol})
                          </span>
                        )}
                      </span>
                    </div>
                  </div>
                  <div className='divide-y divide-gray-200 dark:divide-gray-700'>
                    {tokenTransfer.transfers.map((transfer, transferIdx) => {
                      const formattedAmount =
                        tokenInfo && !tokenInfo.loading
                          ? formatTokenAmount(
                              transfer.amount,
                              tokenInfo.decimals
                            )
                          : transfer.amount;

                      return (
                        <div
                          key={`transfer-${transferIdx}`}
                          className='flex justify-between items-center py-2.5 px-4'
                        >
                          <span className='text-sm font-medium text-gray-700 dark:text-gray-300'>
                            {transfer.accountId}
                          </span>
                          <span className='text-sm font-semibold text-brand-green bg-brand-green/10 px-2 py-0.5 rounded'>
                            +{formattedAmount} {symbol || 'tokens'}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </TransactionSection>
        )}

        {cryptoCreateAccount && (
          <TransactionSection title='Account Creation Details'>
            <div className='p-4 space-y-1'>
              <FieldRow
                label='Initial Balance'
                value={cryptoCreateAccount.initialBalance}
              />
              <FieldRow
                label='Key'
                value={cryptoCreateAccount.key ? 'Set' : undefined}
              />
              <FieldRow
                label='Receiver Sig Required'
                value={cryptoCreateAccount.receiverSigRequired ? 'Yes' : 'No'}
              />
              <FieldRow
                label='Auto Renew Period'
                value={cryptoCreateAccount.autoRenewPeriod}
              />
              <FieldRow label='Memo' value={cryptoCreateAccount.memo} />
              <FieldRow
                label='Max Token Associations'
                value={cryptoCreateAccount.maxAutomaticTokenAssociations}
              />
              <FieldRow
                label='Staked Account ID'
                value={cryptoCreateAccount.stakedAccountId}
                isMono
              />
              <FieldRow
                label='Staked Node ID'
                value={cryptoCreateAccount.stakedNodeId}
              />
              <FieldRow
                label='Decline Reward'
                value={cryptoCreateAccount.declineReward ? 'Yes' : 'No'}
              />
              <FieldRow
                label='Alias'
                value={cryptoCreateAccount.alias}
                isMono
              />
            </div>
          </TransactionSection>
        )}

        {cryptoUpdateAccount && (
          <TransactionSection title='Account Update Details'>
            <div className='p-4 space-y-1'>
              <FieldRow
                label='Account ID'
                value={cryptoUpdateAccount.accountIdToUpdate}
                isMono
              />
              <FieldRow
                label='Key'
                value={cryptoUpdateAccount.key ? 'Updated' : undefined}
              />
              <FieldRow
                label='Expiration Time'
                value={cryptoUpdateAccount.expirationTime}
              />
              <FieldRow
                label='Receiver Sig Required'
                value={cryptoUpdateAccount.receiverSigRequired ? 'Yes' : 'No'}
              />
              <FieldRow
                label='Auto Renew Period'
                value={cryptoUpdateAccount.autoRenewPeriod}
              />
              <FieldRow label='Memo' value={cryptoUpdateAccount.memo} />
              <FieldRow
                label='Max Token Associations'
                value={cryptoUpdateAccount.maxAutomaticTokenAssociations}
              />
              <FieldRow
                label='Staked Account ID'
                value={cryptoUpdateAccount.stakedAccountId}
                isMono
              />
              <FieldRow
                label='Staked Node ID'
                value={cryptoUpdateAccount.stakedNodeId}
              />
              <FieldRow
                label='Decline Reward'
                value={cryptoUpdateAccount.declineReward ? 'Yes' : 'No'}
              />
            </div>
          </TransactionSection>
        )}

        {cryptoDelete && (
          <TransactionSection title='Account Deletion Details'>
            <div className='p-4 space-y-1'>
              <FieldRow
                label='Delete Account ID'
                value={cryptoDelete.deleteAccountId}
                isMono
              />
              <FieldRow
                label='Transfer Account ID'
                value={cryptoDelete.transferAccountId}
                isMono
                isLast
              />
            </div>
          </TransactionSection>
        )}

        {cryptoApproveAllowance && (
          <TransactionSection title='Approve Allowance Details'>
            <div className='p-4 space-y-3'>
              {cryptoApproveAllowance.hbarAllowances &&
                cryptoApproveAllowance.hbarAllowances.length > 0 && (
                  <div>
                    <div className='text-sm font-medium text-gray-700 dark:text-gray-300 mb-2'>
                      HBAR Allowances (
                      {cryptoApproveAllowance.hbarAllowances.length})
                    </div>
                    <div className='space-y-1'>
                      {cryptoApproveAllowance.hbarAllowances.map(
                        (allowance, idx) => (
                          <div
                            key={idx}
                            className='text-sm text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-700 p-2 rounded'
                          >
                            Owner: {allowance.ownerAccountId} → Spender:{' '}
                            {allowance.spenderAccountId} | Amount:{' '}
                            {allowance.amount} ℏ
                          </div>
                        )
                      )}
                    </div>
                  </div>
                )}
              {cryptoApproveAllowance.tokenAllowances &&
                cryptoApproveAllowance.tokenAllowances.length > 0 && (
                  <div>
                    <div className='text-sm font-medium text-gray-700 dark:text-gray-300 mb-2'>
                      Token Allowances (
                      {cryptoApproveAllowance.tokenAllowances.length})
                    </div>
                    <div className='space-y-1'>
                      {cryptoApproveAllowance.tokenAllowances.map(
                        (allowance, idx) => (
                          <div
                            key={idx}
                            className='text-sm text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-700 p-2 rounded'
                          >
                            Token: {allowance.tokenId} | Owner:{' '}
                            {allowance.ownerAccountId} → Spender:{' '}
                            {allowance.spenderAccountId} | Amount:{' '}
                            {allowance.amount}
                          </div>
                        )
                      )}
                    </div>
                  </div>
                )}
              {cryptoApproveAllowance.nftAllowances &&
                cryptoApproveAllowance.nftAllowances.length > 0 && (
                  <div>
                    <div className='text-sm font-medium text-gray-700 dark:text-gray-300 mb-2'>
                      NFT Allowances (
                      {cryptoApproveAllowance.nftAllowances.length})
                    </div>
                    <div className='space-y-1'>
                      {cryptoApproveAllowance.nftAllowances.map(
                        (allowance, idx) => (
                          <div
                            key={idx}
                            className='text-sm text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-700 p-2 rounded'
                          >
                            Token: {allowance.tokenId} | Owner:{' '}
                            {allowance.ownerAccountId} → Spender:{' '}
                            {allowance.spenderAccountId}
                            {allowance.approvedForAll && (
                              <span className='ml-2 text-xs bg-blue-100 text-blue-800 px-1 rounded'>
                                ALL
                              </span>
                            )}
                            {allowance.serialNumbers &&
                              allowance.serialNumbers.length > 0 && (
                                <span className='ml-2 text-xs'>
                                  Serials: {allowance.serialNumbers.join(', ')}
                                </span>
                              )}
                          </div>
                        )
                      )}
                    </div>
                  </div>
                )}
            </div>
          </TransactionSection>
        )}

        {cryptoDeleteAllowance && (
          <TransactionSection title='Delete Allowance Details'>
            <div className='p-4'>
              {cryptoDeleteAllowance.nftAllowancesToRemove &&
                cryptoDeleteAllowance.nftAllowancesToRemove.length > 0 && (
                  <div>
                    <div className='text-sm font-medium text-gray-700 dark:text-gray-300 mb-2'>
                      NFT Allowances to Remove (
                      {cryptoDeleteAllowance.nftAllowancesToRemove.length})
                    </div>
                    <div className='space-y-1'>
                      {cryptoDeleteAllowance.nftAllowancesToRemove.map(
                        (allowance, idx) => (
                          <div
                            key={idx}
                            className='text-sm text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-700 p-2 rounded'
                          >
                            Token: {allowance.tokenId} | Owner:{' '}
                            {allowance.ownerAccountId}
                            {allowance.serialNumbers &&
                              allowance.serialNumbers.length > 0 && (
                                <span className='ml-2 text-xs'>
                                  Serials: {allowance.serialNumbers.join(', ')}
                                </span>
                              )}
                          </div>
                        )
                      )}
                    </div>
                  </div>
                )}
            </div>
          </TransactionSection>
        )}

        {contractCall && (
          <TransactionSection title='Contract Call Details'>
            <div className='p-4 space-y-1'>
              <FieldRow
                label='Contract ID'
                value={contractCall.contractId}
                isMono
              />
              <FieldRow label='Gas' value={contractCall.gas} />
              <FieldRow label='Amount' value={contractCall.amount} />
              <FieldRow
                label='Function Name'
                value={contractCall.functionName}
              />
              {contractCall.functionParameters && (
                <div className='pt-2 border-t border-gray-200 dark:border-gray-700'>
                  <div className='text-sm font-medium text-gray-700 dark:text-gray-300 mb-1'>
                    Function Parameters
                  </div>
                  <div className='text-sm text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-700 p-2 rounded font-mono text-xs break-all'>
                    {contractCall.functionParameters}
                  </div>
                </div>
              )}
            </div>
          </TransactionSection>
        )}

        {contractCreate && (
          <TransactionSection title='Contract Creation Details'>
            <div className='p-4 space-y-1'>
              <FieldRow
                label='Initial Balance'
                value={contractCreate.initialBalance}
              />
              <FieldRow label='Gas' value={contractCreate.gas} />
              <FieldRow
                label='Admin Key'
                value={contractCreate.adminKey ? 'Set' : undefined}
              />
              <FieldRow label='Memo' value={contractCreate.memo} />
              <FieldRow
                label='Auto Renew Period'
                value={contractCreate.autoRenewPeriod}
              />
              <FieldRow
                label='Staked Account ID'
                value={contractCreate.stakedAccountId}
                isMono
              />
              <FieldRow
                label='Staked Node ID'
                value={contractCreate.stakedNodeId}
              />
              <FieldRow
                label='Decline Reward'
                value={contractCreate.declineReward ? 'Yes' : 'No'}
              />
              <FieldRow
                label='Max Token Associations'
                value={contractCreate.maxAutomaticTokenAssociations}
              />
              <FieldRow
                label='Initcode Source'
                value={contractCreate.initcodeSource}
              />
              {contractCreate.constructorParameters && (
                <div className='pt-2 border-t border-gray-200 dark:border-gray-700'>
                  <div className='text-sm font-medium text-gray-700 dark:text-gray-300 mb-1'>
                    Constructor Parameters
                  </div>
                  <div className='text-sm text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-700 p-2 rounded font-mono text-xs break-all'>
                    {contractCreate.constructorParameters}
                  </div>
                </div>
              )}
              {contractCreate.initcode && (
                <div className='pt-2 border-t border-gray-200 dark:border-gray-700'>
                  <div className='text-sm font-medium text-gray-700 dark:text-gray-300 mb-1'>
                    Initcode
                  </div>
                  <div className='text-sm text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-700 p-2 rounded font-mono text-xs break-all'>
                    {contractCreate.initcode.length > 100
                      ? `${contractCreate.initcode.substring(0, 100)}...`
                      : contractCreate.initcode}
                  </div>
                </div>
              )}
            </div>
          </TransactionSection>
        )}

        {contractUpdate && (
          <TransactionSection title='Contract Update Details'>
            <div className='p-4 space-y-1'>
              <FieldRow
                label='Contract ID'
                value={contractUpdate.contractIdToUpdate}
                isMono
              />
              <FieldRow
                label='Admin Key'
                value={contractUpdate.adminKey ? 'Updated' : undefined}
              />
              <FieldRow
                label='Expiration Time'
                value={contractUpdate.expirationTime}
              />
              <FieldRow
                label='Auto Renew Period'
                value={contractUpdate.autoRenewPeriod}
              />
              <FieldRow label='Memo' value={contractUpdate.memo} />
              <FieldRow
                label='Staked Account ID'
                value={contractUpdate.stakedAccountId}
                isMono
              />
              <FieldRow
                label='Staked Node ID'
                value={contractUpdate.stakedNodeId}
              />
              <FieldRow
                label='Decline Reward'
                value={contractUpdate.declineReward ? 'Yes' : 'No'}
              />
              <FieldRow
                label='Max Token Associations'
                value={contractUpdate.maxAutomaticTokenAssociations}
              />
              <FieldRow
                label='Auto Renew Account'
                value={contractUpdate.autoRenewAccountId}
                isMono
              />
            </div>
          </TransactionSection>
        )}

        {contractDelete && (
          <TransactionSection title='Contract Deletion Details'>
            <div className='p-4 space-y-1'>
              <FieldRow
                label='Contract ID'
                value={contractDelete.contractIdToDelete}
                isMono
              />
              <FieldRow
                label='Transfer Account ID'
                value={contractDelete.transferAccountId}
                isMono
              />
              <FieldRow
                label='Transfer Contract ID'
                value={contractDelete.transferContractId}
                isMono
              />
            </div>
          </TransactionSection>
        )}

        {fileCreate && (
          <TransactionSection title='File Creation Details'>
            <div className='p-4 space-y-1'>
              <FieldRow
                label='Expiration Time'
                value={fileCreate.expirationTime}
              />
              <FieldRow
                label='Keys'
                value={fileCreate.keys ? 'Set' : undefined}
              />
              <FieldRow label='Memo' value={fileCreate.memo} />
              <FieldRow label='Max Size' value={fileCreate.maxSize} />
              {fileCreate.contents && (
                <div className='pt-2 border-t border-gray-200 dark:border-gray-700'>
                  <div className='text-sm font-medium text-gray-700 dark:text-gray-300 mb-1'>
                    File Contents
                  </div>
                  <div className='text-sm text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-700 p-2 rounded font-mono text-xs'>
                    {fileCreate.contents.length > 200
                      ? `${fileCreate.contents.substring(0, 200)}...`
                      : fileCreate.contents}
                  </div>
                </div>
              )}
            </div>
          </TransactionSection>
        )}

        {fileAppend && (
          <TransactionSection title='File Append Details'>
            <div className='p-4 space-y-1'>
              <FieldRow label='File ID' value={fileAppend.fileId} isMono />
              {fileAppend.contents && (
                <div className='pt-2 border-t border-gray-200 dark:border-gray-700'>
                  <div className='text-sm font-medium text-gray-700 dark:text-gray-300 mb-1'>
                    Appended Contents
                  </div>
                  <div className='text-sm text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-700 p-2 rounded font-mono text-xs'>
                    {fileAppend.contents.length > 200
                      ? `${fileAppend.contents.substring(0, 200)}...`
                      : fileAppend.contents}
                  </div>
                </div>
              )}
            </div>
          </TransactionSection>
        )}

        {fileUpdate && (
          <TransactionSection title='File Update Details'>
            <div className='p-4 space-y-1'>
              <FieldRow label='File ID' value={fileUpdate.fileId} isMono />
              <FieldRow
                label='Expiration Time'
                value={fileUpdate.expirationTime}
              />
              <FieldRow
                label='Keys'
                value={fileUpdate.keys ? 'Updated' : undefined}
              />
              <FieldRow label='Memo' value={fileUpdate.memo} />
              {fileUpdate.contents && (
                <div className='pt-2 border-t border-gray-200 dark:border-gray-700'>
                  <div className='text-sm font-medium text-gray-700 dark:text-gray-300 mb-1'>
                    Updated Contents
                  </div>
                  <div className='text-sm text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-700 p-2 rounded font-mono text-xs'>
                    {fileUpdate.contents.length > 200
                      ? `${fileUpdate.contents.substring(0, 200)}...`
                      : fileUpdate.contents}
                  </div>
                </div>
              )}
            </div>
          </TransactionSection>
        )}

        {fileDelete && (
          <TransactionSection title='File Deletion Details'>
            <div className='p-4'>
              <FieldRow
                label='File ID'
                value={fileDelete.fileId}
                isMono
                isLast
              />
            </div>
          </TransactionSection>
        )}

        {consensusCreateTopic && (
          <TransactionSection title='Topic Creation Details'>
            <div className='p-4 space-y-1'>
              <FieldRow label='Memo' value={consensusCreateTopic.memo} />
              <FieldRow
                label='Admin Key'
                value={consensusCreateTopic.adminKey ? 'Set' : undefined}
              />
              <FieldRow
                label='Submit Key'
                value={consensusCreateTopic.submitKey ? 'Set' : undefined}
              />
              <FieldRow
                label='Auto Renew Period'
                value={consensusCreateTopic.autoRenewPeriod}
              />
              <FieldRow
                label='Auto Renew Account'
                value={consensusCreateTopic.autoRenewAccountId}
                isMono
              />
            </div>
          </TransactionSection>
        )}

        {consensusSubmitMessage && (
          <TransactionSection title='Submit Message Details'>
            <div className='p-4 space-y-1'>
              <FieldRow
                label='Topic ID'
                value={consensusSubmitMessage.topicId}
                isMono
              />
              <FieldRow
                label='Message Encoding'
                value={consensusSubmitMessage.messageEncoding}
              />
              {consensusSubmitMessage.chunkInfoNumber &&
                consensusSubmitMessage.chunkInfoTotal && (
                  <FieldRow
                    label='Chunk Info'
                    value={`${consensusSubmitMessage.chunkInfoNumber}/${consensusSubmitMessage.chunkInfoTotal}`}
                  />
                )}
              {consensusSubmitMessage.message && (
                <div className='pt-2 border-t border-gray-200 dark:border-gray-700'>
                  <div className='text-sm font-medium text-gray-700 dark:text-gray-300 mb-1'>
                    Message Content
                  </div>
                  <div className='text-sm text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-700 p-2 rounded'>
                    {consensusSubmitMessage.messageEncoding === 'utf8' ? (
                      <span>
                        {consensusSubmitMessage.message.length > 200
                          ? `${consensusSubmitMessage.message.substring(
                              0,
                              200
                            )}...`
                          : consensusSubmitMessage.message}
                      </span>
                    ) : (
                      <span className='font-mono text-xs break-all'>
                        {consensusSubmitMessage.message.length > 100
                          ? `${consensusSubmitMessage.message.substring(
                              0,
                              100
                            )}...`
                          : consensusSubmitMessage.message}
                      </span>
                    )}
                  </div>
                </div>
              )}
            </div>
          </TransactionSection>
        )}

        {consensusUpdateTopic && (
          <TransactionSection title='Topic Update Details'>
            <div className='p-4 space-y-1'>
              <FieldRow
                label='Topic ID'
                value={consensusUpdateTopic.topicId}
                isMono
              />
              <FieldRow label='Memo' value={consensusUpdateTopic.memo} />
              <FieldRow
                label='Admin Key'
                value={consensusUpdateTopic.adminKey ? 'Updated' : undefined}
              />
              <FieldRow
                label='Submit Key'
                value={consensusUpdateTopic.submitKey ? 'Updated' : undefined}
              />
              <FieldRow
                label='Auto Renew Period'
                value={consensusUpdateTopic.autoRenewPeriod}
              />
              <FieldRow
                label='Auto Renew Account'
                value={consensusUpdateTopic.autoRenewAccountId}
                isMono
              />
              <FieldRow
                label='Clear Admin Key'
                value={consensusUpdateTopic.clearAdminKey ? 'Yes' : undefined}
              />
              <FieldRow
                label='Clear Submit Key'
                value={consensusUpdateTopic.clearSubmitKey ? 'Yes' : undefined}
              />
            </div>
          </TransactionSection>
        )}

        {consensusDeleteTopic && (
          <TransactionSection title='Topic Deletion Details'>
            <div className='p-4'>
              <FieldRow
                label='Topic ID'
                value={consensusDeleteTopic.topicId}
                isMono
                isLast
              />
            </div>
          </TransactionSection>
        )}

        {scheduleCreate && (
          <TransactionSection title='Schedule Creation Details'>
            <div className='p-4 space-y-1'>
              <FieldRow label='Memo' value={scheduleCreate.memo} />
              <FieldRow
                label='Admin Key'
                value={scheduleCreate.adminKey ? 'Set' : undefined}
              />
              <FieldRow
                label='Payer Account'
                value={scheduleCreate.payerAccountId}
                isMono
              />
              <FieldRow
                label='Expiration Time'
                value={scheduleCreate.expirationTime}
              />
              <FieldRow
                label='Wait For Expiry'
                value={scheduleCreate.waitForExpiry ? 'Yes' : 'No'}
              />
              {scheduleCreate.scheduledTransactionBody && (
                <div className='pt-2 border-t border-gray-200 dark:border-gray-700'>
                  <div className='text-sm font-medium text-gray-700 dark:text-gray-300 mb-1'>
                    Scheduled Transaction Body
                  </div>
                  <div className='text-sm text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-700 p-2 rounded font-mono text-xs break-all'>
                    {scheduleCreate.scheduledTransactionBody.length > 100
                      ? `${scheduleCreate.scheduledTransactionBody.substring(
                          0,
                          100
                        )}...`
                      : scheduleCreate.scheduledTransactionBody}
                  </div>
                </div>
              )}
            </div>
          </TransactionSection>
        )}

        {scheduleSign && (
          <TransactionSection title='Schedule Sign Details'>
            <div className='p-4'>
              <FieldRow
                label='Schedule ID'
                value={scheduleSign.scheduleId}
                isMono
                isLast
              />
            </div>
          </TransactionSection>
        )}

        {scheduleDelete && (
          <TransactionSection title='Schedule Deletion Details'>
            <div className='p-4'>
              <FieldRow
                label='Schedule ID'
                value={scheduleDelete.scheduleId}
                isMono
                isLast
              />
            </div>
          </TransactionSection>
        )}

        {utilPrng && (
          <TransactionSection title='Random Number Generation Details'>
            <div className='p-4 space-y-1'>
              <FieldRow label='Range' value={utilPrng.range} />
              {utilPrng.prngBytes && (
                <div className='pt-2 border-t border-gray-200 dark:border-gray-700'>
                  <div className='text-sm font-medium text-gray-700 dark:text-gray-300 mb-1'>
                    PRNG Bytes
                  </div>
                  <div className='text-sm text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-700 p-2 rounded font-mono text-xs break-all'>
                    {utilPrng.prngBytes}
                  </div>
                </div>
              )}
            </div>
          </TransactionSection>
        )}

        {freeze && (
          <TransactionSection title='Network Freeze Details'>
            <div className='p-4 space-y-1'>
              <FieldRow label='Start Time' value={freeze.startTime} />
              <FieldRow label='File ID' value={freeze.fileId} isMono />
              <FieldRow label='File Hash' value={freeze.fileHash} isMono />
            </div>
          </TransactionSection>
        )}

        {systemDelete && (
          <TransactionSection title='System Delete Details'>
            <div className='p-4 space-y-1'>
              <FieldRow label='File ID' value={systemDelete.fileId} isMono />
              <FieldRow
                label='Contract ID'
                value={systemDelete.contractId}
                isMono
              />
              <FieldRow
                label='Expiration Time'
                value={systemDelete.expirationTime}
              />
            </div>
          </TransactionSection>
        )}

        {systemUndelete && (
          <TransactionSection title='System Undelete Details'>
            <div className='p-4 space-y-1'>
              <FieldRow label='File ID' value={systemUndelete.fileId} isMono />
              <FieldRow
                label='Contract ID'
                value={systemUndelete.contractId}
                isMono
              />
            </div>
          </TransactionSection>
        )}
      </div>
    </div>
  );
};

export default TransactionDetails;
