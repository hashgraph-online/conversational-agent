import React, { useState, useEffect } from 'react';
import {
  FiServer,
  FiDatabase,
  FiGithub,
  FiHardDrive,
  FiSettings,
  FiTrash2,
  FiEdit,
  FiPlay,
  FiRefreshCw,
  FiWifi,
  FiWifiOff,
  FiActivity,
} from 'react-icons/fi';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { StatusIndicator } from '../ui/StatusIndicator';
import Typography from '../ui/Typography';
import { cn } from '../../lib/utils';
import { MCPServerCardProps, MCPServerType } from '../../types/mcp';
import { useMCPStore } from '../../stores/mcpStore';
import { createMCPError } from '../../utils/mcpErrors';

const serverTypeIcons: Record<MCPServerType, React.ReactNode> = {
  filesystem: <FiHardDrive className='w-5 h-5' />,
  github: <FiGithub className='w-5 h-5' />,
  postgres: <FiDatabase className='w-5 h-5' />,
  sqlite: <FiDatabase className='w-5 h-5' />,
  custom: <FiServer className='w-5 h-5' />,
};

const statusColors = {
  connected: 'online',
  disconnected: 'offline',
  connecting: 'connecting',
  handshaking: 'connecting',
  ready: 'online',
  error: 'error',
} as const;

const statusIcons = {
  connected: <FiWifi className='w-4 h-4' />,
  disconnected: <FiWifiOff className='w-4 h-4' />,
  connecting: <FiActivity className='w-4 h-4 animate-pulse' />,
  handshaking: <FiActivity className='w-4 h-4 animate-spin' />,
  ready: <FiWifi className='w-4 h-4' />,
  error: <FiWifiOff className='w-4 h-4' />,
} as const;

/**
 * Individual MCP server card component with controls
 * @param props - Server card props including server config and handlers
 * @returns Server card with status, controls, and configuration display
 */
export const MCPServerCard: React.FC<MCPServerCardProps> = ({
  server,
  onToggle,
  onEdit,
  onDelete,
  onTest,
}) => {
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleToggle = async () => {
    try {
      await onToggle(server.id, !server.enabled);
    } catch (error) {
    }
  };

  const handleTest = async () => {
    setIsRefreshing(true);
    try {
      await onTest(server.id);
    } catch (error) {
    } finally {
      setIsRefreshing(false);
    }
  };

  const formatDate = (date: Date | undefined) => {
    if (!date) return 'Never';
    return new Date(date).toLocaleString();
  };

  const getConfigSummary = () => {
    switch (server.type) {
      case 'filesystem':
        return server.config.rootPath || 'No path configured';
      case 'github':
        return server.config.owner && server.config.repo
          ? `${server.config.owner}/${server.config.repo}`
          : 'No repository configured';
      case 'postgres':
        return server.config.host && server.config.database
          ? `${server.config.host}/${server.config.database}`
          : 'No database configured';
      case 'sqlite':
        return server.config.path || 'No database path configured';
      case 'custom':
        return server.config.command || 'No command configured';
      default:
        return 'Configuration not set';
    }
  };

  return (
    <Card className='p-6'>
      <div className='flex items-start justify-between mb-4'>
        <div className='flex items-center gap-3'>
          <div className='p-2 bg-hedera-smoke-100 dark:bg-hedera-smoke-700 rounded-lg'>
            {serverTypeIcons[server.type]}
          </div>
          <div>
            <Typography disableMargin variant='h6' className='mb-1'>
              {server.name}
            </Typography>
            <div className='flex items-center gap-3 text-sm text-gray-600 dark:text-gray-400'>
              <div className='flex items-center gap-1.5'>
                <span className='flex items-center'>{statusIcons[server.status]}</span>
                <StatusIndicator
                  status={statusColors[server.status]}
                  size='sm'
                />
                <span className='leading-none'>
                  {server.status === 'handshaking'
                    ? 'Handshaking'
                    : server.status === 'ready'
                    ? 'Ready'
                    : server.status.charAt(0).toUpperCase() +
                      server.status.slice(1)}
                </span>
              </div>
              <span className='leading-none'>•</span>
              <span className='leading-none'>{server.type}</span>
            </div>
          </div>
        </div>

        <div className='flex items-center gap-2'>
          <Button
            variant='ghost'
            size='sm'
            onClick={handleTest}
            disabled={
              isRefreshing ||
              server.status === 'connecting' ||
              server.status === 'handshaking'
            }
            className='text-gray-600 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200'
            title={
              server.status === 'connecting' || server.status === 'handshaking'
                ? 'Connection in progress'
                : 'Test connection'
            }
          >
            <FiPlay className={cn('w-4 h-4', isRefreshing && 'animate-spin')} />
          </Button>
          <Button
            variant='ghost'
            size='sm'
            onClick={() => onEdit(server.id)}
            className='text-gray-600 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200'
          >
            <FiEdit className='w-4 h-4' />
          </Button>
          <Button
            variant='ghost'
            size='sm'
            onClick={() => onDelete(server.id)}
            className='text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300'
          >
            <FiTrash2 className='w-4 h-4' />
          </Button>
        </div>
      </div>

      <div className='space-y-3'>
        <div>
          <Typography
            disableMargin
            variant='body1'
            color='muted'
            className='mb-1'
          >
            Configuration
          </Typography>
          <Typography
            disableMargin
            variant='body1'
            className='font-mono text-sm bg-hedera-smoke-50 dark:bg-hedera-smoke-800 px-2 py-1 rounded'
          >
            {getConfigSummary()}
          </Typography>
        </div>

        {server.tools && server.tools.length > 0 && (
          <div>
            <Typography
              disableMargin
              variant='body1'
              color='muted'
              className='mb-2'
            >
              Available Tools ({server.tools.length})
            </Typography>
            <div className='flex flex-wrap gap-1'>
              {server.tools.slice(0, 5).map((tool, index) => (
                <span
                  key={index}
                  className='px-2 py-1 bg-primary-50 text-primary-700 dark:bg-primary-900 dark:text-primary-300 text-xs rounded-full'
                >
                  {tool.name}
                </span>
              ))}
              {server.tools.length > 5 && (
                <span className='px-2 py-1 bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400 text-xs rounded-full'>
                  +{server.tools.length - 5} more
                </span>
              )}
            </div>
          </div>
        )}

        {server.errorMessage && (
          <div className='mb-3 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg'>
            <Typography
              disableMargin
              variant='caption'
              className='text-red-600 dark:text-red-400'
            >
              {server.errorMessage}
            </Typography>
          </div>
        )}

        {server.status === 'connecting' && (
          <div className='p-3 bg-blue-50 border border-blue-200 dark:bg-blue-900/20 dark:border-blue-800 rounded-lg'>
            <div className='flex items-center gap-2'>
              <FiActivity className='w-4 h-4 animate-pulse text-blue-600 dark:text-blue-400' />
              <Typography
                disableMargin
                variant='body1'
                color='muted'
                className='mb-0'
              >
                Establishing connection...
              </Typography>
            </div>
          </div>
        )}

        {server.status === 'handshaking' && (
          <div className='p-3 bg-blue-50 border border-blue-200 dark:bg-blue-900/20 dark:border-blue-800 rounded-lg'>
            <div className='flex items-center gap-2'>
              <FiActivity className='w-4 h-4 animate-spin text-blue-600 dark:text-blue-400' />
              <Typography
                disableMargin
                variant='body1'
                color='muted'
                className='mb-0'
              >
                Performing handshake...
              </Typography>
            </div>
          </div>
        )}

        <div className='flex items-center justify-between pt-3 border-t border-hedera-smoke-200 dark:border-hedera-smoke-700'>
          <div className='flex items-center gap-4 text-sm text-gray-500 dark:text-gray-400'>
            <span>Last connected: {formatDate(server.lastConnected)}</span>
            {server.connectionHealth && (
              <span>
                Attempts: {server.connectionHealth.connectionAttempts}
              </span>
            )}
          </div>

          <div className='flex items-center gap-2'>
            <label className='relative inline-flex items-center cursor-pointer'>
              <input
                type='checkbox'
                checked={server.enabled}
                onChange={handleToggle}
                className='sr-only peer'
              />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary-300 dark:peer-focus:ring-primary-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-primary-600"></div>
              <span className='ml-3 text-sm font-medium text-gray-900 dark:text-gray-300'>
                {server.enabled ? 'Enabled' : 'Disabled'}
              </span>
            </label>
          </div>
        </div>
      </div>
    </Card>
  );
};
