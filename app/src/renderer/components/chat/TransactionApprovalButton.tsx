import React, { useState, useEffect, useCallback } from 'react';
import { Button } from '../ui/Button';
import Typography from '../ui/Typography';
import { FiClock, FiLoader, FiCheckCircle, FiAlertTriangle, FiX, FiCheck, FiInfo } from 'react-icons/fi';
import { cn } from '../../lib/utils';
import { useNotificationStore } from '../../stores/notificationStore';
import { 
  TransactionParser
} from '@hashgraphonline/standards-sdk';
import { useConfigStore } from '../../stores/configStore';
import { TransactionDetails } from './TransactionDetails';
import { AutonomousTransactionParser } from '../../services/transactionParser';
import type { ParsedTransaction } from '../../types/transaction';

interface TransactionApprovalButtonProps {
  scheduleId?: string;
  transactionBytes?: string;
  messageId?: string;
  description?: string;
  network?: string;
  className?: string;
  onApprove?: (messageId: string) => Promise<void>;
  onReject?: (messageId: string) => Promise<void>;
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
        amount: typeof t.amount === 'string' 
          ? parseFloat(t.amount.replace(/[^\d.-]/g, ''))
          : (typeof t.amount === 'number' ? t.amount : 0),
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
  transactionBytes,
  messageId,
  description = '',
  network: propsNetwork,
  className,
  onApprove,
  onReject
}) => {
  const [isApproving, setIsApproving] = useState(false);
  const [isApproved, setIsApproved] = useState(false);
  const [isExecuted, setIsExecuted] = useState(false);
  const [executedTransactionId, setExecutedTransactionId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [executionStatus, setExecutionStatus] = useState<'signing' | 'submitting' | 'confirming' | 'completed' | null>(null);
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
        const result = await window.electron.mirrorNode.getScheduleInfo(scheduleId!, network as 'mainnet' | 'testnet');
        
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

    const parseTransactionBytes = async (): Promise<void> => {
      if (!transactionBytes) {
          return;
      }


      setIsLoadingDetails(true);
      try {
        const parsedTransaction = await AutonomousTransactionParser.parseTransactionBytes(transactionBytes);
        setTransactionDetails(parsedTransaction);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Failed to parse transaction bytes';
        addNotification({
          type: 'error',
          title: 'Failed to parse transaction',
          message: errorMessage
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
    } else if (transactionBytes) {
      parseTransactionBytes();
    }
  }, [scheduleId, transactionBytes, network, isAlreadyExecuted, addNotification]);

  const approveTransaction = useCallback(async () => {
    setIsApproving(true);
    setError(null);

    try {
      if (scheduleId) {
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
      } else if (messageId && onApprove) {
        await onApprove(messageId);
        setIsApproved(true);
        addNotification({
          type: 'success',
          title: 'Transaction Approved',
          message: 'Transaction has been approved successfully',
          duration: 7000
        });
      } else if (transactionBytes && !scheduleId) {
        if (isExecuted || isApproved) {
          addNotification({
            type: 'warning',
            title: 'Transaction Already Executed',
            message: `Transaction was already executed${executedTransactionId ? ` with ID: ${executedTransactionId}` : ''}`,
            duration: 5000
          });
          return;
        }

        setExecutionStatus('signing');
        
        await new Promise(resolve => setTimeout(resolve, 500));
        setExecutionStatus('submitting');
        
        const result = await window.electron.executeTransactionBytes(transactionBytes);
        
        if (result.success) {
          setExecutionStatus('confirming');
          
            await new Promise(resolve => setTimeout(resolve, 1000));
          
          setExecutionStatus('completed');
          setIsApproved(true);
          setIsExecuted(true);
          setExecutedTransactionId(result.transactionId || null);
          
          const transactionId = result.transactionId;
          const explorerUrl = network === 'mainnet' 
            ? `https://hashscan.io/mainnet/transaction/${transactionId}`
            : `https://hashscan.io/testnet/transaction/${transactionId}`;
          
          addNotification({
            type: 'success',
            title: 'Transaction Executed Successfully',
            message: `Transaction ID: ${transactionId}`,
            duration: 10000
          });
        } else {
          setExecutionStatus(null);
          
          let errorTitle = 'Transaction Failed';
          let errorMessage = result.error || 'Failed to execute transaction';
          
          if (result.error?.includes('already executed')) {
            errorTitle = 'Transaction Already Executed';
            setIsExecuted(true);
            setIsApproved(true);
            const match = result.error.match(/ID:\s*([^\s,)]+)/);
            if (match) {
              setExecutedTransactionId(match[1]);
            }
          } else if (result.error?.includes('insufficient balance')) {
            errorTitle = 'Insufficient Balance';
            errorMessage = 'Your account does not have sufficient HBAR balance to execute this transaction.';
          } else if (result.error?.includes('expired')) {
            errorTitle = 'Transaction Expired';
            errorMessage = 'This transaction has expired. Please request a new transaction from the agent.';
          } else if (result.error?.includes('invalid') && result.error?.includes('format')) {
            errorTitle = 'Invalid Transaction';
            errorMessage = 'The transaction bytes are malformed or corrupted.';
          } else if (result.error?.includes('network') || result.error?.includes('timeout')) {
            errorTitle = 'Network Error';
            errorMessage = 'Unable to connect to the Hedera network. Please check your connection and try again.';
          } else if (result.error?.includes('credentials')) {
            errorTitle = 'Configuration Error';
            errorMessage = 'Hedera credentials are not configured properly. Please check your settings.';
          }
          
          setError(errorMessage);
          addNotification({
            type: 'error',
            title: errorTitle,
            message: errorMessage,
            duration: result.error?.includes('already executed') ? 5000 : 8000
          });
        }
      }
    } catch (err: any) {
      setExecutionStatus(null);
      const errorMessage = err.message || 'Failed to approve transaction';
      setError(errorMessage);
      addNotification({
        type: 'error',
        title: 'Transaction Error',
        message: errorMessage
      });
    } finally {
      setIsApproving(false);
      if (executionStatus === 'completed') {
        setExecutionStatus(null);
      }
    }
  }, [scheduleId, messageId, onApprove, addNotification]);

  const rejectTransaction = useCallback(async () => {
    if (messageId && onReject) {
      try {
        await onReject(messageId);
        addNotification({
          type: 'info',
          title: 'Transaction Rejected',
          message: 'Transaction has been rejected',
          duration: 5000
        });
      } catch (err: any) {
        addNotification({
          type: 'error',
          title: 'Rejection Error',
          message: err.message || 'Failed to reject transaction'
        });
      }
    }
  }, [messageId, onReject, addNotification]);

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
          {(isApproved && isExecuted) ? (
            <div className='flex items-center animate-fadeIn py-4'>
              <div className='bg-brand-green/20 dark:bg-brand-green/30 p-2 sm:p-2.5 rounded-full shadow-sm flex items-center justify-center flex-shrink-0'>
                <FiCheckCircle className='text-brand-green h-4 sm:h-5 w-4 sm:w-5' />
              </div>
              <div className='ml-3 sm:ml-4'>
                <Typography variant='body1' className='font-medium text-green-700 dark:text-green-300 text-sm sm:text-base'>
                  Transaction Executed Successfully
                </Typography>
                <Typography variant='caption' className='text-xs sm:text-sm text-green-600/80 dark:text-green-400/80 mt-0.5'>
                  {executedTransactionId ? (
                    <>
                      Transaction ID: {executedTransactionId}
                      <br />
                      <button
                        onClick={() => {
                          const explorerUrl = network === 'mainnet' 
                            ? `https://hashscan.io/mainnet/transaction/${executedTransactionId}`
                            : `https://hashscan.io/testnet/transaction/${executedTransactionId}`;
                          window.electron.openExternal(explorerUrl);
                        }}
                        className='text-green-600 dark:text-green-400 underline hover:text-green-700 dark:hover:text-green-300'
                      >
                        View on HashScan →
                      </button>
                    </>
                  ) : (
                    'The transaction has been successfully executed.'
                  )}
                </Typography>
              </div>
            </div>
          ) : isApproved ? (
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
                scheduleId={scheduleId || ''}
                network={network}
              />

              {!isAlreadyExecuted && !isExecuted && !isApproved && (
                <div className='flex flex-wrap items-center pt-3 sm:pt-4 gap-2'>
                  <Button
                    onClick={approveTransaction}
                    disabled={isApproving || isExecuted || isApproved}
                    className={cn(
                      'transition-all duration-300 bg-gradient-to-r from-brand-blue to-brand-purple hover:from-brand-purple hover:to-brand-blue text-white border-0 shadow-md hover:shadow-lg relative overflow-hidden group',
                      (isApproving || isExecuted || isApproved) && 'opacity-70'
                    )}
                  >
                    <span className='absolute inset-0 w-full h-full bg-[linear-gradient(120deg,transparent,rgba(255,255,255,0.2),transparent)] group-hover:translate-x-full transition-transform duration-700 ease-in-out'></span>
                    {isApproving ? (
                      <div className='flex items-center space-x-2 relative z-10'>
                        <FiLoader className='h-4 w-4 animate-spin' />
                        <span>
                          {executionStatus === 'signing' && 'Signing transaction...'}
                          {executionStatus === 'submitting' && 'Submitting to network...'}
                          {executionStatus === 'confirming' && 'Confirming execution...'}
                          {!executionStatus && 'Approving...'}
                        </span>
                      </div>
                    ) : (
                      <div className='flex items-center space-x-2 relative z-10'>
                        <FiCheck className='h-4 w-4' />
                        <span>Approve</span>
                      </div>
                    )}
                  </Button>
                  {transactionBytes && messageId && onReject && (
                    <Button
                      onClick={rejectTransaction}
                      variant='outline'
                      className='border-red-300 dark:border-red-600 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20'
                    >
                      <div className='flex items-center space-x-2'>
                        <FiX className='h-4 w-4' />
                        <span>Reject</span>
                      </div>
                    </Button>
                  )}
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