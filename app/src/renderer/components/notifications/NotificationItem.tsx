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
        return <FiCheckCircle className="w-5 h-5 text-green-500" />;
      case 'error':
        return <FiXCircle className="w-5 h-5 text-red-500" />;
      case 'warning':
        return <FiAlertTriangle className="w-5 h-5 text-yellow-500" />;
      case 'info':
      default:
        return <FiInfo className="w-5 h-5 text-blue-500" />;
    }
  };

  const getBorderColor = () => {
    switch (notification.type) {
      case 'success':
        return 'border-green-500';
      case 'error':
        return 'border-red-500';
      case 'warning':
        return 'border-yellow-500';
      case 'info':
      default:
        return 'border-blue-500';
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: -20, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, x: 100, scale: 0.95 }}
      transition={{ duration: 0.2 }}
      className={cn(
        "pointer-events-auto mb-3 bg-white dark:bg-gray-800 rounded-lg shadow-lg border-l-4 p-4 min-w-[320px] max-w-md",
        getBorderColor()
      )}
      role="alert"
    >
      <div className="flex items-start">
        <div className="flex-shrink-0">
          {getIcon()}
        </div>
        <div className="ml-3 flex-1">
          <Typography variant="body2" className="font-semibold">
            {notification.title}
          </Typography>
          {notification.message && (
            <div className="mt-1">
              <Typography variant="caption" color="secondary">
                {notification.message}
              </Typography>
            </div>
          )}
        </div>
        <button
          onClick={() => removeNotification(notification.id)}
          className="ml-4 flex-shrink-0 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
          aria-label="Dismiss notification"
        >
          <FiX className="w-4 h-4" />
        </button>
      </div>
    </motion.div>
  );
};