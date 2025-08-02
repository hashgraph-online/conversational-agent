import React, { useEffect } from 'react';
import Typography from '../ui/Typography';
import type { Message } from '../../stores/agentStore';
import { FiUser, FiCpu, FiHash, FiClock } from 'react-icons/fi';
import { cn } from '../../lib/utils';
import { TransactionDisplay } from './TransactionDisplay';
import { TransactionApprovalButton } from './TransactionApprovalButton';
import { useNotificationStore } from '../../stores/notificationStore';
import { useAgentStore } from '../../stores/agentStore';
import { useConfigStore } from '../../stores/configStore';

interface MessageBubbleProps {
  message: Message;
}

/**
 * Parses message content to extract schedule information.
 * Returns formatted message if schedule data is found, otherwise returns original content.
 * 
 * @param content - The message content to parse
 * @param isUser - Whether the message is from the user
 * @returns Formatted message string
 */
function parseScheduleMessage(content: string, isUser: boolean): string {
  if (isUser || !content.trim().startsWith('{') || !content.includes('scheduleId')) {
    return content;
  }
  
  try {
    const parsed = JSON.parse(content);
    if (parsed.success && parsed.scheduleId) {
      return `Transaction scheduled successfully! Schedule ID: ${parsed.scheduleId}`;
    }
  } catch (e) {
  }
  
  return content;
}

/**
 * Removes hidden file content from messages for display purposes
 * @param content - The message content to clean
 * @returns Cleaned message content
 */
function cleanMessageContent(content: string): string {
  // Remove hidden file content sections
  const cleanedContent = content.replace(/\n\n<!-- HIDDEN_FILE_CONTENT -->[\s\S]*?<!-- END_HIDDEN_FILE_CONTENT -->/g, '');
  
  // Also remove individual file sections if any remain
  return cleanedContent.replace(/\n<!-- FILE_START:.*? -->[\s\S]*?<!-- FILE_END:.*? -->/g, '');
}

/**
 * Individual message component with user/assistant styling
 */
const MessageBubble: React.FC<MessageBubbleProps> = ({ message }) => {
  const isUser = message.role === 'user';
  const isSystem = message.role === 'system';
  const addNotification = useNotificationStore(
    (state) => state.addNotification
  );
  const config = useConfigStore((state) => state.config);
  const operationalMode = config?.advanced?.operationalMode || 'autonomous';

  useEffect(() => {
  }, [message.metadata?.scheduleId, operationalMode, config?.advanced]);

  const formatTime = (timestamp: Date) => {
    return new Intl.DateTimeFormat('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).format(timestamp);
  };

  if (isSystem) {
    return (
      <div
        className='flex justify-center py-2'
        role='log'
        aria-label='System message'
      >
        <div className='bg-gray-100 dark:bg-gray-700 px-3 py-1 rounded-full'>
          <Typography variant='caption' color='secondary'>
            {message.content}
          </Typography>
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn(
        'flex w-full',
        isUser ? 'justify-end' : 'justify-start'
      )}
      role='log'
      aria-label={`${isUser ? 'User' : 'Assistant'} message at ${formatTime(
        message.timestamp
      )}`}
    >
      <div
        className={cn(
          'flex max-w-[90%] sm:max-w-[80%] space-x-2',
          isUser ? 'flex-row-reverse space-x-reverse' : 'flex-row'
        )}
      >
        {/* Avatar */}
        <div
          className={cn(
            'flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center',
            isUser
              ? 'bg-gradient-to-r from-brand-blue to-brand-purple'
              : 'bg-gradient-to-r from-brand-teal to-brand-green'
          )}
          aria-hidden='true'
        >
          {isUser ? (
            <FiUser className='w-4 h-4 text-white' />
          ) : (
            <FiCpu className='w-4 h-4 text-white' />
          )}
        </div>

        {/* Message Content */}
        <div
          className={cn(
            'flex flex-col space-y-1',
            isUser ? 'items-end' : 'items-start'
          )}
        >
          <div
            className={cn(
              'px-4 py-3 rounded-2xl shadow-sm',
              isUser
                ? 'bg-gradient-to-r from-brand-blue to-brand-purple text-white rounded-br-md'
                : 'bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-bl-md'
            )}
          >
            <Typography
              variant='body1'
              color={isUser ? 'white' : 'default'}
              className='whitespace-pre-wrap break-words'
            >
              {parseScheduleMessage(cleanMessageContent(message.content), isUser)}
            </Typography>
          </div>

          {/* Metadata */}
          <div
            className={cn(
              'flex items-center space-x-2 px-2',
              isUser ? 'flex-row-reverse space-x-reverse' : 'flex-row'
            )}
          >
            <div className='flex items-center space-x-1'>
              <FiClock className='w-3 h-3 text-gray-400' aria-hidden='true' />
              <Typography variant='caption' color='secondary'>
                <time dateTime={message.timestamp.toISOString()}>
                  {formatTime(message.timestamp)}
                </time>
              </Typography>
            </div>

            {message.metadata?.transactionId && (
              <div className='flex items-center space-x-1'>
                <FiHash
                  className='w-3 h-3 text-brand-teal'
                  aria-hidden='true'
                />
                <Typography
                  variant='caption'
                  color='secondary'
                  className='font-mono'
                >
                  <span
                    title={`Transaction ID: ${message.metadata.transactionId}`}
                  >
                    {message.metadata.transactionId.slice(0, 8)}...
                  </span>
                </Typography>
              </div>
            )}

            {/* Show schedule ID in autonomous mode */}
            {operationalMode === 'autonomous' &&
              message.metadata?.scheduleId && (
                <div className='flex items-center space-x-1'>
                  <FiClock
                    className='w-3 h-3 text-brand-purple'
                    aria-hidden='true'
                  />
                  <Typography
                    variant='caption'
                    color='secondary'
                    className='font-mono'
                  >
                    <span title={`Schedule ID: ${message.metadata.scheduleId}`}>
                      {message.metadata.scheduleId.slice(0, 8)}...
                    </span>
                  </Typography>
                </div>
              )}
          </div>

          {/* Transaction Notes */}
          {message.metadata?.notes && message.metadata.notes.length > 0 && (
            <div
              className={cn(
                'bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3 mt-2',
                isUser ? 'ml-2 sm:ml-8' : 'mr-2 sm:mr-8'
              )}
              role='region'
              aria-label='Transaction details'
            >
              <Typography
                variant='caption'
                color='secondary'
                className='font-medium'
              >
                Transaction Details:
              </Typography>
              <ul className='mt-1' role='list'>
                {message.metadata.notes.map((note: string, index: number) => (
                  <li key={index}>
                    <Typography
                      variant='caption'
                      color='secondary'
                      className='block'
                    >
                      • {note}
                    </Typography>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Transaction Display for Return Bytes Mode - Raw Bytes */}
          {operationalMode === 'returnBytes' &&
            message.metadata?.transactionBytes &&
            !isUser && (
              <TransactionDisplay
                transactionBytes={message.metadata.transactionBytes}
                onApprove={() => {
                  addNotification({
                    type: 'info',
                    title: 'Transaction Bytes',
                    message:
                      'Transaction bytes are ready for signing. Implementation pending.',
                  });
                }}
                onReject={() => {
                  addNotification({
                    type: 'info',
                    title: 'Transaction Rejected',
                    message: 'Transaction rejected by user.',
                  });
                }}
                className='mt-3'
              />
            )}

          {/* Transaction Approval for Return Bytes Mode - Scheduled Transactions */}
          {operationalMode === 'returnBytes' &&
            message.metadata?.scheduleId &&
            !isUser && (
              <>
                <TransactionApprovalButton
                  scheduleId={message.metadata.scheduleId}
                  description={message.metadata.description}
                  className='mt-3'
                />
              </>
            )}
        </div>
      </div>
    </div>
  );
};

export default MessageBubble;
