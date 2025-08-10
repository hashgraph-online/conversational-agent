import React from 'react';
import { motion } from 'framer-motion';
import { FiCheckCircle, FiXCircle, FiInfo, FiAlertTriangle, FiX } from 'react-icons/fi';
import { useNotificationStore, type Notification } from '../../stores/notificationStore';
import Typography from '../ui/Typography';
import { cn } from '../../lib/utils';

interface NotificationItemProps {
  notification: Notification;
}

/**
 * Individual notification item component
 */
export const NotificationItem: React.FC<NotificationItemProps> = ({ notification }) => {
  const removeNotification = useNotificationStore((state) => state.removeNotification);

  const getIcon = () => {
    switch (notification.type) {
      case 'success':
        return <FiCheckCircle className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />;
      case 'error':
        return <FiXCircle className="w-6 h-6 text-red-600 dark:text-red-400" />;
      case 'warning':
        return <FiAlertTriangle className="w-6 h-6 text-amber-600 dark:text-amber-400" />;
      case 'info':
      default:
        return <FiInfo className="w-6 h-6 text-blue-600 dark:text-blue-400" />;
    }
  };

  const getBorderColor = () => {
    switch (notification.type) {
      case 'success':
        return 'border-emerald-500';
      case 'error':
        return 'border-red-500 dark:border-red-400';
      case 'warning':
        return 'border-amber-500';
      case 'info':
      default:
        return 'border-blue-500';
    }
  };

  const getBackgroundGradient = () => {
    switch (notification.type) {
      case 'success':
        return 'bg-gradient-to-br from-emerald-50 to-green-50 dark:from-emerald-900/30 dark:to-green-800/30';
      case 'error':
        return 'bg-gradient-to-br from-red-50 to-rose-50 dark:from-red-900/30 dark:to-rose-800/30';
      case 'warning':
        return 'bg-gradient-to-br from-amber-50 to-yellow-50 dark:from-amber-900/30 dark:to-yellow-800/30';
      case 'info':
      default:
        return 'bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/30 dark:to-indigo-800/30';
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: -20, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, x: 100, scale: 0.95 }}
      transition={{ duration: 0.2 }}
      className={cn(
        "pointer-events-auto mb-3 rounded-xl shadow-xl border-l-4 p-5 min-w-[340px] max-w-lg backdrop-blur-sm",
        getBorderColor(),
        getBackgroundGradient()
      )}
      role="alert"
    >
      <div className="flex items-start">
        <div className="flex-shrink-0">
          <div className={cn(
            "p-2 rounded-lg shadow-sm",
            notification.type === 'success' && "bg-emerald-100 dark:bg-emerald-800/50",
            notification.type === 'error' && "bg-red-100 dark:bg-red-800/50",
            notification.type === 'warning' && "bg-amber-100 dark:bg-amber-800/50",
            notification.type === 'info' && "bg-blue-100 dark:bg-blue-800/50"
          )}>
            {getIcon()}
          </div>
        </div>
        <div className="ml-3 flex-1">
          <Typography variant="body2" className="font-semibold">
            {notification.title}
          </Typography>
          {notification.message && (
            <div className="mt-2">
              <Typography variant="caption" color="secondary" className="leading-relaxed whitespace-pre-line">
                {notification.message}
              </Typography>
            </div>
          )}
        </div>
        <button
          onClick={() => removeNotification(notification.id)}
          className="ml-4 flex-shrink-0 p-1.5 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-white/50 dark:hover:bg-gray-700/30 transition-all duration-200"
          aria-label="Dismiss notification"
        >
          <FiX className="w-4 h-4" />
        </button>
      </div>
    </motion.div>
  );
};