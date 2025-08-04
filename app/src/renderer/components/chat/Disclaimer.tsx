import React from 'react';
import { Alert, AlertDescription } from '../ui/alert';
import { Button } from '../ui/Button';
import { FiInfo, FiExternalLink } from 'react-icons/fi';
import { LegalDisclaimerModal } from './LegalDisclaimerModal';

export const Disclaimer: React.FC = () => {
  return (
    <Alert className="mx-4 mb-4 border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-900/50">
      <FiInfo className="h-4 w-4 text-gray-600 dark:text-gray-400" />
      <AlertDescription className="text-xs text-gray-600 dark:text-gray-400">
        <div className="flex items-start justify-between gap-3">
          <div>
            <strong>Important Disclaimer:</strong> This AI assistant provides information and executes transactions on the Hedera network. 
            Always verify transaction details before approval. Cryptocurrency transactions are irreversible. 
            This tool is for informational purposes and should not be considered financial advice. 
            Use at your own risk. Never share your private keys.
          </div>
          <LegalDisclaimerModal>
            <Button
              variant="ghost"
              size="sm"
              className="h-auto p-1 text-xs text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 shrink-0"
            >
              Full Terms <FiExternalLink className="w-3 h-3 ml-1" />
            </Button>
          </LegalDisclaimerModal>
        </div>
      </AlertDescription>
    </Alert>
  );
};