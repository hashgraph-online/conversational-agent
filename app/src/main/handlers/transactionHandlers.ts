import { ipcMain } from 'electron';
import { AgentService } from '../services/AgentService';
import { Logger } from '../utils/logger';
import type { ChatHistory } from '../services/AgentService';

const logger = new Logger({ module: 'TransactionHandlers' });

/**
 * Register transaction-related IPC handlers
 */
export function registerTransactionHandlers() {
  const agentService = AgentService.getInstance();

  /**
   * Execute a scheduled transaction
   */
  ipcMain.handle('execute-scheduled-transaction', async (_, scheduleId: string): Promise<{
    success: boolean;
    transactionId?: string;
    error?: string;
  }> => {
    try {
      logger.info('Executing scheduled transaction:', scheduleId);
      
      const result = await agentService.sendMessage(
        `Execute the scheduled transaction with ID ${scheduleId}`,
        []
      );
      
      if (result.success && result.response) {
        return {
          success: true,
          transactionId: result.response.metadata?.transactionId
        };
      } else {
        return {
          success: false,
          error: result.error || 'Failed to execute scheduled transaction'
        };
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Failed to execute scheduled transaction:', error);
      return {
        success: false,
        error: errorMessage
      };
    }
  });

  /**
   * Delete/reject a scheduled transaction
   */
  ipcMain.handle('delete-scheduled-transaction', async (_, scheduleId: string): Promise<{
    success: boolean;
    error?: string;
  }> => {
    try {
      logger.info('Deleting scheduled transaction:', scheduleId);
      
      const result = await agentService.sendMessage(
        `Delete the scheduled transaction with ID ${scheduleId}`,
        []
      );
      
      if (result.success) {
        return { success: true };
      } else {
        return {
          success: false,
          error: result.error || 'Failed to delete scheduled transaction'
        };
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Failed to delete scheduled transaction:', error);
      return {
        success: false,
        error: errorMessage
      };
    }
  });

  /**
   * Get scheduled transaction info
   */
  ipcMain.handle('get-scheduled-transaction', async (_, scheduleId: string): Promise<{
    success: boolean;
    info?: any;
    error?: string;
  }> => {
    try {
      logger.info('Getting scheduled transaction info:', scheduleId);
      
      const result = await agentService.sendMessage(
        `Get information about the scheduled transaction with ID ${scheduleId}`,
        []
      );
      
      if (result.success && result.response) {
        return {
          success: true,
          info: result.response.metadata
        };
      } else {
        return {
          success: false,
          error: result.error || 'Failed to get scheduled transaction info'
        };
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Failed to get scheduled transaction info:', error);
      return {
        success: false,
        error: errorMessage
      };
    }
  });
}