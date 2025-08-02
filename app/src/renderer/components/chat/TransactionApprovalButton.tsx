import React, { useState, useEffect, useCallback } from 'react';
import { Button } from '../ui/Button';
import Typography from '../ui/Typography';
import { FiClock, FiLoader, FiCheckCircle } from 'react-icons/fi';
import { cn } from '../../lib/utils';
import { useNotificationStore } from '../../stores/notificationStore';
import { 
  TransactionParser
} from '@hashgraphonline/standards-sdk';
import { useConfigStore } from '../../stores/configStore';
import { TransactionDetails } from './TransactionDetails';
import type { ParsedTransaction } from '../../types/transaction';

interface TransactionApprovalButtonProps {
  scheduleId: string;
  description?: string;
  network?: string;
  className?: string;
}

const TransactionContent = ({
  isLoadingDetails,
  transactionDetails,
  expirationTime,
  description,
  scheduleId,
  network,
}: {
  isLoadingDetails: boolean;
  transactionDetails: ParsedTransaction | null;
  expirationTime: string | null;
  description: string;
  scheduleId: string;
  network: string;
}): React.ReactNode => {
  if (transactionDetails) {
    const showHeader =
      !description?.includes(transactionDetails.humanReadableType) &&
      !description?.includes('Transfer');

    const hbarTransfersForDisplay = (transactionDetails.transfers || []).map(
      (t) => ({
        ...t,
        amount: parseFloat(t.amount),
      })
    );

    return (
      <TransactionDetails
        type={transactionDetails.type}
        humanReadableType={transactionDetails.humanReadableType}
        transfers={hbarTransfersForDisplay}
        tokenTransfers={transactionDetails.tokenTransfers || []}
        memo={transactionDetails.memo}
        expirationTime={expirationTime || undefined}
        scheduleId={scheduleId}
        contractCall={transactionDetails.contractCall}
        tokenCreationInfo={transactionDetails.tokenCreation}
        hideHeader={!showHeader}
        network={network}
        consensusSubmitMessage={transactionDetails.consensusSubmitMessage}
        variant='embedded'
      />
    );
  }

  return null;
};

export const TransactionApprovalButton: React.FC<TransactionApprovalButtonProps> = ({
  scheduleId,
  description = '',
  network: propsNetwork,
  className
}) => {
  const [isApproving, setIsApproving] = useState(false);
  const [isApproved, setIsApproved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [transactionDetails, setTransactionDetails] = useState<ParsedTransaction | null>(null);
  const [isLoadingDetails, setIsLoadingDetails] = useState(false);
  const [expirationTime, setExpirationTime] = useState<string | null>(null);
  const [isAlreadyExecuted, setIsAlreadyExecuted] = useState(false);
  const [executedTimestamp, setExecutedTimestamp] = useState<string | null>(null);
  
  const addNotification = useNotificationStore((state) => state.addNotification);
  const config = useConfigStore((state) => state.config);
  const network = propsNetwork || config?.hedera?.network || 'testnet';

  useEffect(() => {
    let intervalId: NodeJS.Timeout | undefined;

    const getScheduleInfo = async (): Promise<void> => {
      if (isAlreadyExecuted) {
        if (intervalId) clearInterval(intervalId);
        return;
      }

      setIsLoadingDetails(true);
      try {
        const result = await window.electron.mirrorNode.getScheduleInfo(scheduleId, network as 'mainnet' | 'testnet');
        
        if (!result.success) {
          throw new Error(result.error || 'Failed to fetch schedule info');
        }
        
        const scheduleInfo = result.data;

        if (scheduleInfo && scheduleInfo.transaction_body) {
          const parsedTx = TransactionParser.parseScheduleResponse({
            transaction_body: scheduleInfo.transaction_body,
            memo: scheduleInfo.memo,
          });

          const parsedTransaction: ParsedTransaction = {
            type: parsedTx.type,
            humanReadableType: parsedTx.humanReadableType,
            details: parsedTx,
            transfers: parsedTx.transfers,
            tokenTransfers: parsedTx.tokenTransfers,
            memo: parsedTx.memo,
            contractCall: parsedTx.contractCall,
            tokenCreation: parsedTx.tokenCreation,
            consensusSubmitMessage: parsedTx.consensusSubmitMessage
          };

          setTransactionDetails(parsedTransaction);

          if (scheduleInfo.expiration_time) {
            setExpirationTime(scheduleInfo.expiration_time);
          }

          if (scheduleInfo.executed_timestamp) {
            setIsAlreadyExecuted(true);
            setExecutedTimestamp(scheduleInfo.executed_timestamp);
          }
        }
      } catch (errCaught: unknown) {
        addNotification({
          type: 'error',
          title: 'Failed to load transaction details',
          message: 'Could not fetch schedule information from mirror node'
        });
      } finally {
        setIsLoadingDetails(false);
      }
    };

    if (scheduleId) {
      getScheduleInfo();
      if (!isAlreadyExecuted) {
        intervalId = setInterval(getScheduleInfo, 5000);
      }

      return () => {
        if (intervalId) {
          clearInterval(intervalId);
        }
      };
    }
  }, [scheduleId, network, isAlreadyExecuted, addNotification]);

  const approveTransaction = useCallback(async () => {
    setIsApproving(true);
    setError(null);

    try {
      const result = await window.electron.executeScheduledTransaction(scheduleId);
      
      if (result.success) {
        setIsApproved(true);
        addNotification({
          type: 'success',
          title: 'Transaction Approved',
          message: `Transaction ID: ${result.transactionId}`,
          duration: 7000
        });
      } else {
        setError(result.error || 'Failed to approve transaction');
        addNotification({
          type: 'error',
          title: 'Transaction Failed',
          message: result.error || 'Failed to execute transaction'
        });
      }
    } catch (err: any) {
      setError(err.message || 'Failed to approve transaction');
      addNotification({
        type: 'error',
        title: 'Transaction Error',
        message: err.message || 'Unknown error occurred'
      });
    } finally {
      setIsApproving(false);
    }
  }, [scheduleId, addNotification]);

  const formatDate = (timestamp: string): string => {
    if (!timestamp) return '';
    try {
      const date = new Date(Number(timestamp) * 1000);
      if (isNaN(date.getTime())) {
        const fallbackDate = new Date(timestamp);
        if (isNaN(fallbackDate.getTime())) {
          return timestamp;
        }
        return fallbackDate.toLocaleString();
      }
      return date.toLocaleString();
    } catch {
      return timestamp;
    }
  };

  return (
    <div className={cn('mt-4 flex flex-col items-start w-full', className)}>
      <div className='bg-gradient-to-br from-gray-50 to-gray-100/50 dark:from-gray-800/30 dark:to-gray-900/40 border border-gray-200 dark:border-gray-700 rounded-xl p-3 sm:p-4 w-full backdrop-blur-sm shadow-sm'>
        <div className='flex flex-col space-y-4 md:space-y-5'>
          {isApproved ? (
            <div className='flex items-center animate-fadeIn py-4'>
              <div className='bg-brand-green/20 dark:bg-brand-green/30 p-2 sm:p-2.5 rounded-full shadow-sm flex items-center justify-center flex-shrink-0'>
                <FiCheckCircle className='text-brand-green h-4 sm:h-5 w-4 sm:w-5' />
              </div>
              <div className='ml-3 sm:ml-4'>
                <Typography variant='body1' className='font-medium text-green-700 dark:text-green-300 text-sm sm:text-base'>
                  Transaction Approved
                </Typography>
                <Typography variant='caption' className='text-xs sm:text-sm text-green-600/80 dark:text-green-400/80 mt-0.5'>
                  The transaction has been successfully signed.
                </Typography>
              </div>
            </div>
          ) : (
            <>
              <div className='flex items-start'>
                <div className='bg-brand-blue/20 dark:bg-brand-blue/30 p-2 sm:p-2.5 rounded-full shadow-sm flex items-center justify-center flex-shrink-0'>
                  {isAlreadyExecuted ? (
                    <FiCheckCircle className='text-gray-500 dark:text-gray-400 h-4 sm:h-5 w-4 sm:w-5' />
                  ) : (
                    <FiClock className='text-brand-blue h-4 sm:h-5 w-4 sm:w-5' />
                  )}
                </div>

                <div className='ml-3 sm:ml-4 overflow-hidden'>
                  <Typography variant='body1' className='font-medium text-purple-800 dark:text-purple-200 truncate text-sm sm:text-base'>
                    {isAlreadyExecuted
                      ? 'Transaction Already Executed'
                      : 'Transaction Requires Approval'}
                  </Typography>
                  <Typography variant='caption' className='text-xs sm:text-sm text-purple-700/80 dark:text-purple-300/80 mt-1 sm:mt-1.5 break-words'>
                    {isAlreadyExecuted
                      ? `This scheduled transaction has already been executed${
                          executedTimestamp
                            ? ` on ${formatDate(executedTimestamp)}`
                            : ''
                        }`
                      : description}
                  </Typography>
                </div>
              </div>

              <TransactionContent
                isLoadingDetails={isLoadingDetails}
                transactionDetails={transactionDetails}
                expirationTime={expirationTime}
                description={description}
                scheduleId={scheduleId}
                network={network}
              />

              {!isAlreadyExecuted && (
                <div className='flex flex-wrap items-center pt-3 sm:pt-4 gap-2'>
                  <Button
                    onClick={approveTransaction}
                    disabled={isApproving}
                    className={cn(
                      'transition-all duration-300 bg-gradient-to-r from-brand-blue to-brand-purple hover:from-brand-purple hover:to-brand-blue text-white border-0 shadow-md hover:shadow-lg relative overflow-hidden group',
                      isApproving && 'opacity-70'
                    )}
                  >
                    <span className='absolute inset-0 w-full h-full bg-[linear-gradient(120deg,transparent,rgba(255,255,255,0.2),transparent)] group-hover:translate-x-full transition-transform duration-700 ease-in-out'></span>
                    {isApproving ? (
                      <div className='flex items-center space-x-2 relative z-10'>
                        <FiLoader className='h-4 w-4 animate-spin' />
                        <span>Approving...</span>
                      </div>
                    ) : (
                      <div className='flex items-center space-x-2 relative z-10'>
                        <FiCheckCircle className='h-4 w-4' />
                        <span>Approve Transaction</span>
                      </div>
                    )}
                  </Button>
                  {error && (
                    <Typography
                      variant='caption'
                      className='text-red-500 dark:text-red-400 text-sm'
                    >
                      {error}
                    </Typography>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default TransactionApprovalButton;