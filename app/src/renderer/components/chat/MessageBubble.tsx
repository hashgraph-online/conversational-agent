import React, { useEffect, useMemo } from 'react';
import Typography from '../ui/Typography';
import type { Message } from '../../stores/agentStore';
import { FiUser, FiCpu, FiHash, FiClock } from 'react-icons/fi';
import { cn } from '../../lib/utils';
import { TransactionDisplay } from './TransactionDisplay';
import { TransactionApprovalButton } from './TransactionApprovalButton';
import { useNotificationStore } from '../../stores/notificationStore';
import { useAgentStore } from '../../stores/agentStore';
import { useConfigStore } from '../../stores/configStore';
import { CodeBlock } from '../ui/CodeBlock';

interface UserProfile {
  display_name?: string;
  alias?: string;
  bio?: string;
  profileImage?: string;
  type?: number;
  aiAgent?: {
    type: number;
    capabilities?: number[];
    model?: string;
    creator?: string;
  };
}

interface MessageBubbleProps {
  message: Message;
  userProfile?: UserProfile | null;
}

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

function cleanMessageContent(content: string): string {
  const cleanedContent = content.replace(/\n\n<!-- HIDDEN_FILE_CONTENT -->[\s\S]*?<!-- END_HIDDEN_FILE_CONTENT -->/g, '');
  
  return cleanedContent.replace(/\n<!-- FILE_START:.*? -->[\s\S]*?<!-- FILE_END:.*? -->/g, '');
}

const MessageBubble: React.FC<MessageBubbleProps> = ({ message, userProfile }) => {
  const isUser = message.role === 'user';
  const isSystem = message.role === 'system';
  const addNotification = useNotificationStore(
    (state) => state.addNotification
  );
  const config = useConfigStore((state) => state.config);
  const operationalMode = config?.advanced?.operationalMode || 'autonomous';
  
  const { approveTransaction, rejectTransaction } = useAgentStore();


  const contentParts = useMemo(() => {
    let cleanedContent = cleanMessageContent(message.content);
    
    if (!isUser && message.metadata?.transactionBytes && operationalMode === 'returnBytes') {
      cleanedContent = cleanedContent
        .replace(/```[a-z]*\n[A-Za-z0-9+/=]+\n```/g, '')
        .replace(/\n\nPlease sign and submit this transaction to complete the transfer\./g, '')
        .replace(/\n\nPlease sign the transaction with your account\./g, '')
        .trim();
    }
    
    const parsedContent = parseScheduleMessage(cleanedContent, isUser);
    
    const codePattern = /```([a-z]*)\n([\s\S]*?)```/g;
    let lastIndex = 0;
    const results = [];
    let match;

    while ((match = codePattern.exec(parsedContent)) !== null) {
      if (match.index > lastIndex) {
        results.push({
          type: 'text',
          content: parsedContent.slice(lastIndex, match.index),
        });
      }

      results.push({
        type: 'code',
        language: match[1] || 'typescript',
        content: match[2].trim(),
      });

      lastIndex = match.index + match[0].length;
    }

    if (lastIndex < parsedContent.length) {
      results.push({
        type: 'text',
        content: parsedContent.slice(lastIndex),
      });
    }

    return results;
  }, [message.content, isUser]);

  const processMarkdown = (text: string) => {
    let processed = text;

    processed = processed.replace(/`([^`]+)`/g, (_, code) => {
      return `<code class="inline-code-style">${code}</code>`;
    });

    processed = processed.replace(/\*\*([^*]+)\*\*/g, '<strong class="font-semibold">$1</strong>');
    processed = processed.replace(/__([^_]+)__/g, '<strong class="font-semibold">$1</strong>');

    processed = processed.replace(/\*([^*]+)\*/g, '<em>$1</em>');
    processed = processed.replace(/_([^_]+)_/g, '<em>$1</em>');

    processed = processed.replace(
      /\[([^\]]+)\]\(([^)]+)\)/g,
      '<a href="$2" target="_blank" rel="noopener noreferrer" class="underline text-white hover:text-blue-100 font-semibold">$1</a>'
    );

    processed = processed.replace(/^### (.*$)/gm, '<h3 class="text-lg font-bold mt-4 mb-2">$1</h3>');
    processed = processed.replace(/^## (.*$)/gm, '<h2 class="text-xl font-bold mt-4 mb-2">$1</h2>');
    processed = processed.replace(/^# (.*$)/gm, '<h1 class="text-2xl font-bold mt-4 mb-2">$1</h1>');

    processed = processed.replace(/^\s*[-*] (.+)$/gm, '<li class="ml-4">• $1</li>');
    processed = processed.replace(/(<li.*<\/li>)/s, '<ul class="my-2">$1</ul>');
    
    processed = processed.replace(/\n/g, '<br />');

    return processed;
  };

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
        <div className="flex-shrink-0">
          {isUser && userProfile?.profileImage ? (
            <img 
              src={userProfile.profileImage.startsWith('hcs://') 
                ? `${userProfile.profileImage.replace('hcs://1/', 'https://kiloscribe.com/api/inscription-cdn/')}?network=${config?.hedera?.network || 'testnet'}`
                : userProfile.profileImage.startsWith('ipfs://') 
                ? userProfile.profileImage.replace('ipfs://', 'https://gateway.pinata.cloud/ipfs/')
                : userProfile.profileImage
              }
              alt={userProfile.display_name || userProfile.alias || 'User'}
              className="w-8 h-8 rounded-full object-cover border-2 border-blue-500/20"
              onError={(e) => {
                const target = e.target as HTMLImageElement;
                target.parentElement?.querySelector('.avatar-fallback')?.classList.remove('hidden');
                target.style.display = 'none';
              }}
            />
          ) : null}
          <div
            className={cn(
              'avatar-fallback flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center',
              isUser
                ? 'bg-gray-300 dark:bg-gray-600'
                : 'bg-blue-500',
              isUser && userProfile?.profileImage ? 'hidden' : ''
            )}
            aria-hidden='true'
          >
            {isUser ? (
              userProfile?.display_name || userProfile?.alias ? (
                <span className="text-gray-700 dark:text-white text-sm font-semibold">
                  {(userProfile.display_name || userProfile.alias || 'U')[0].toUpperCase()}
                </span>
              ) : (
                <FiUser className='w-4 h-4 text-gray-700 dark:text-white' />
              )
            ) : (
              <FiCpu className='w-4 h-4 text-white' />
            )}
          </div>
        </div>

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
                ? 'bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white rounded-tr-md'
                : 'bg-blue-500 text-white rounded-tl-md'
            )}
          >
            <div className={contentParts.length > 1 ? 'space-y-2' : ''}>
              {contentParts.map((part, index) => {
                if (part.type === 'code') {
                  return (
                    <CodeBlock
                      key={`code-${index}`}
                      code={part.content}
                      language={part.language}
                      showLineNumbers
                      className='my-2'
                    />
                  );
                }

                if (isUser) {
                  return (
                    <span
                      key={`text-${index}`}
                      className='whitespace-pre-wrap break-words text-gray-900 dark:text-white'
                    >
                      {part.content}
                    </span>
                  );
                }

                return (
                  <div
                    key={`text-${index}`}
                    className='prose prose-sm dark:prose-invert max-w-none prose-p:my-1 prose-headings:my-2 prose-ul:my-1 prose-li:my-0 [&_.inline-code-style]:bg-gray-200 [&_.inline-code-style]:dark:bg-gray-700 [&_.inline-code-style]:px-1.5 [&_.inline-code-style]:py-0.5 [&_.inline-code-style]:rounded [&_.inline-code-style]:font-mono [&_.inline-code-style]:text-xs'
                    dangerouslySetInnerHTML={{ __html: processMarkdown(part.content) }}
                  />
                );
              })}
            </div>
          </div>

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
                  className='w-3 h-3 text-teal-500'
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

            {operationalMode === 'autonomous' &&
              message.metadata?.scheduleId && (
                <div className='flex items-center space-x-1'>
                  <FiClock
                    className='w-3 h-3 text-purple-500'
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


          {operationalMode === 'returnBytes' &&
            (message.metadata?.scheduleId || message.metadata?.transactionBytes) &&
            !isUser && (
              <>
                <TransactionApprovalButton
                  scheduleId={message.metadata.scheduleId}
                  transactionBytes={message.metadata.transactionBytes}
                  description={message.metadata.description || ''}
                  className='mt-3'
                />
              </>
            )}

          {(() => {
            // Show transaction details for autonomous mode when we have transaction bytes
            // This includes both successful transactions (pendingApproval) and failed ones (for debugging)
            return operationalMode === 'autonomous' &&
              message.metadata?.transactionBytes &&
              !isUser && (
                <TransactionApprovalButton
                  messageId={message.id}
                  transactionBytes={message.metadata.transactionBytes}
                  description={message.metadata.description || (message.metadata?.pendingApproval ? 'Transaction requires approval' : 'Transaction Details')}
                  onApprove={message.metadata?.pendingApproval ? approveTransaction : undefined}
                  onReject={message.metadata?.pendingApproval ? rejectTransaction : undefined}
                  className='mt-3'
                />
              );
          })()}
        </div>
      </div>
    </div>
  );
};

export default MessageBubble;
