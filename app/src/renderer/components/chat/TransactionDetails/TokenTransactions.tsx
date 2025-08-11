import React from 'react';
import { FiHash, FiExternalLink } from 'react-icons/fi';
import { TransactionSection, FieldRow } from './CommonFields';
import {
  TokenCreationData,
  TokenMintData,
  TokenBurnData,
  TokenUpdateData,
  TokenDeleteData,
  TokenAssociateData,
  TokenDissociateData,
  TokenFreezeData,
  TokenUnfreezeData,
  TokenGrantKycData,
  TokenRevokeKycData,
  TokenPauseData,
  TokenUnpauseData,
  TokenWipeAccountData,
  TokenFeeScheduleUpdateData,
} from './types';

interface TokenCreationSectionProps {
  tokenCreationData: TokenCreationData;
  executedTransactionEntityId?: string | null;
  type: string;
  executedTransactionType?: string | null;
  network?: string;
}

export const TokenCreationSection: React.FC<TokenCreationSectionProps> = ({
  tokenCreationData,
  executedTransactionEntityId,
  type,
  executedTransactionType,
  network = 'testnet',
}) => (
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
      <FieldRow label='Token Name' value={tokenCreationData.tokenName} />
      <FieldRow label='Symbol' value={tokenCreationData.tokenSymbol} isMono />
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
      <FieldRow label='Supply Type' value={tokenCreationData.supplyType} />
      <FieldRow label='Token Type' value={tokenCreationData.tokenType} />
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
);

export const TokenMintSection: React.FC<{ tokenMint: TokenMintData }> = ({
  tokenMint,
}) => (
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
);

export const TokenBurnSection: React.FC<{ tokenBurn: TokenBurnData }> = ({
  tokenBurn,
}) => (
  <TransactionSection title='Token Burn Details'>
    <div className='p-4 space-y-1'>
      <FieldRow label='Token ID' value={tokenBurn.tokenId} isMono />
      <FieldRow label='Amount' value={tokenBurn.amount} />
      {tokenBurn.serialNumbers && tokenBurn.serialNumbers.length > 0 && (
        <FieldRow
          label='Serial Numbers'
          value={tokenBurn.serialNumbers.join(', ')}
        />
      )}
    </div>
  </TransactionSection>
);

export const TokenUpdateSection: React.FC<{
  tokenUpdate: TokenUpdateData;
}> = ({ tokenUpdate }) => (
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
      <FieldRow label='Auto Renew Period' value={tokenUpdate.autoRenewPeriod} />
      <FieldRow label='Memo' value={tokenUpdate.memo} />
      <FieldRow label='Expiry' value={tokenUpdate.expiry} />
    </div>
  </TransactionSection>
);

export const TokenDeleteSection: React.FC<{
  tokenDelete: TokenDeleteData;
}> = ({ tokenDelete }) => (
  <TransactionSection title='Token Delete Details'>
    <div className='p-4'>
      <FieldRow label='Token ID' value={tokenDelete.tokenId} isMono isLast />
    </div>
  </TransactionSection>
);

export const TokenAssociateSection: React.FC<{
  tokenAssociate: TokenAssociateData;
}> = ({ tokenAssociate }) => (
  <TransactionSection title='Token Association Details'>
    <div className='p-4 space-y-1'>
      <FieldRow label='Account ID' value={tokenAssociate.accountId} isMono />
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
);

export const TokenDissociateSection: React.FC<{
  tokenDissociate: TokenDissociateData;
}> = ({ tokenDissociate }) => (
  <TransactionSection title='Token Dissociation Details'>
    <div className='p-4 space-y-1'>
      <FieldRow label='Account ID' value={tokenDissociate.accountId} isMono />
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
);

export const TokenFreezeSection: React.FC<{
  tokenFreeze: TokenFreezeData;
}> = ({ tokenFreeze }) => (
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
);

export const TokenUnfreezeSection: React.FC<{
  tokenUnfreeze: TokenUnfreezeData;
}> = ({ tokenUnfreeze }) => (
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
);

export const TokenGrantKycSection: React.FC<{
  tokenGrantKyc: TokenGrantKycData;
}> = ({ tokenGrantKyc }) => (
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
);

export const TokenRevokeKycSection: React.FC<{
  tokenRevokeKyc: TokenRevokeKycData;
}> = ({ tokenRevokeKyc }) => (
  <TransactionSection title='Token Revoke KYC Details'>
    <div className='p-4 space-y-1'>
      <FieldRow label='Token ID' value={tokenRevokeKyc.tokenId} isMono />
      <FieldRow
        label='Account ID'
        value={tokenRevokeKyc.accountId}
        isMono
        isLast
      />
    </div>
  </TransactionSection>
);

export const TokenPauseSection: React.FC<{ tokenPause: TokenPauseData }> = ({
  tokenPause,
}) => (
  <TransactionSection title='Token Pause Details'>
    <div className='p-4'>
      <FieldRow label='Token ID' value={tokenPause.tokenId} isMono isLast />
    </div>
  </TransactionSection>
);

export const TokenUnpauseSection: React.FC<{
  tokenUnpause: TokenUnpauseData;
}> = ({ tokenUnpause }) => (
  <TransactionSection title='Token Unpause Details'>
    <div className='p-4'>
      <FieldRow label='Token ID' value={tokenUnpause.tokenId} isMono isLast />
    </div>
  </TransactionSection>
);

export const TokenWipeSection: React.FC<{
  tokenWipeAccount: TokenWipeAccountData;
}> = ({ tokenWipeAccount }) => (
  <TransactionSection title='Token Wipe Details'>
    <div className='p-4 space-y-1'>
      <FieldRow label='Token ID' value={tokenWipeAccount.tokenId} isMono />
      <FieldRow label='Account ID' value={tokenWipeAccount.accountId} isMono />
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
);

export const TokenFeeScheduleUpdateSection: React.FC<{
  tokenFeeScheduleUpdate: TokenFeeScheduleUpdateData;
}> = ({ tokenFeeScheduleUpdate }) => (
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
);
