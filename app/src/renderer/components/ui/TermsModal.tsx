import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent } from './dialog';
import { Button } from './Button';
import {
  FiFileText,
  FiCheck,
  FiX,
  FiShield,
  FiChevronDown,
} from 'react-icons/fi';
import Typography from './Typography';
import { useLegalStore } from '../../stores/legalStore';
import { processMarkdown } from '../../utils/markdownProcessor';
import { motion, AnimatePresence } from 'framer-motion';
import { TERMS_OF_SERVICE } from '../../constants/legal';

interface TermsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAccept: () => void;
  onDecline: () => void;
}

/**
 * Terms of Service modal component for displaying and accepting terms
 */
export const TermsModal: React.FC<TermsModalProps> = ({
  open,
  onOpenChange,
  onAccept,
  onDecline,
}) => {
  const [hasScrolledToBottom, setHasScrolledToBottom] = useState(false);
  const { legalAcceptance } = useLegalStore();
  
  // Terms content is now embedded at build time
  const termsContent = TERMS_OF_SERVICE;
  const isLoading = false;

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const element = e.currentTarget;
    const hasScrolledToEnd =
      element.scrollHeight - element.scrollTop <= element.clientHeight + 10;
    setHasScrolledToBottom(hasScrolledToEnd);
  };

  const handleAccept = () => {
    onAccept();
    onOpenChange(false);
  };

  const handleDecline = () => {
    onDecline();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='max-w-4xl max-h-[90vh] overflow-hidden flex flex-col p-0 border-0'>
        {/* Beautiful gradient header */}
        <div className='relative bg-gradient-to-br from-[#a679f0] via-[#5599fe] to-[#48df7b] p-8'>
          <div className='absolute inset-0 bg-black/10' />
          <div className='relative z-10'>
            <div className='flex items-center justify-center mb-4'>
              <motion.div
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ duration: 0.3 }}
                className='w-16 h-16 bg-white/20 backdrop-blur-md rounded-2xl flex items-center justify-center'
              >
                <FiShield className='w-8 h-8 text-white' />
              </motion.div>
            </div>
            <Typography
              variant='h3'
              className='text-center text-white font-bold mb-2'
            >
              Terms of Service
            </Typography>
            <Typography
              variant='body2'
              className='text-center text-white/90 max-w-md mx-auto'
            >
              Please review and accept the terms to continue
            </Typography>
          </div>
        </div>

        <div className='flex-1 overflow-hidden flex flex-col p-6'>
          {isLoading ? (
            <div className='flex-1 flex items-center justify-center'>
              <div className='text-center'>
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{
                    duration: 1.5,
                    repeat: Infinity,
                    ease: 'linear',
                  }}
                  className='w-12 h-12 border-3 border-[#5599fe] border-t-transparent rounded-full mx-auto mb-3'
                />
                <Typography variant='body2' color='secondary'>
                  Loading Terms of Service...
                </Typography>
              </div>
            </div>
          ) : (
            <>
              <div
                className='flex-1 overflow-y-auto px-6 py-4 bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 shadow-inner'
                onScroll={handleScroll}
              >
                <div
                  className='prose prose-sm dark:prose-invert max-w-none
                    prose-headings:text-gray-900 dark:prose-headings:text-white
                    prose-p:text-gray-700 dark:prose-p:text-gray-300
                    prose-strong:text-gray-900 dark:prose-strong:text-white
                    prose-a:text-[#5599fe] prose-a:no-underline hover:prose-a:underline'
                  dangerouslySetInnerHTML={{
                    __html: processMarkdown(termsContent),
                  }}
                />
              </div>

              <AnimatePresence>
                {!hasScrolledToBottom && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className='flex items-center justify-center gap-2 py-3'
                  >
                    <motion.div
                      animate={{ y: [0, 5, 0] }}
                      transition={{ duration: 1.5, repeat: Infinity }}
                    >
                      <FiChevronDown className='w-5 h-5 text-gray-400' />
                    </motion.div>
                    <Typography
                      variant='caption'
                      className='text-gray-500 dark:text-gray-400'
                    >
                      Scroll to read the complete terms
                    </Typography>
                  </motion.div>
                )}
              </AnimatePresence>
            </>
          )}
        </div>

        <div className='p-6 bg-gray-50 dark:bg-gray-900/50 border-t border-gray-200 dark:border-gray-800'>
          <div className='flex justify-between items-center gap-4'>
            <div className='flex items-center gap-2'>
              {legalAcceptance.termsAccepted && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className='flex items-center gap-2 px-3 py-1.5 bg-green-100 dark:bg-green-900/30 rounded-lg'
                >
                  <FiCheck className='w-4 h-4 text-green-600 dark:text-green-400' />
                  <Typography
                    variant='caption'
                    className='text-green-700 dark:text-green-300 font-medium'
                  >
                    Previously accepted
                  </Typography>
                </motion.div>
              )}
            </div>

            <div className='flex gap-3'>
              <Button
                variant='secondary'
                onClick={handleDecline}
                className='flex items-center gap-2 hover:bg-red-50 dark:hover:bg-red-900/20'
              >
                <FiX className='w-4 h-4' />
                Decline
              </Button>
              <Button
                onClick={handleAccept}
                disabled={!hasScrolledToBottom && !isLoading}
                variant='gradient'
                className='flex items-center gap-2 min-w-[140px]'
              >
                <FiCheck className='w-4 h-4' />
                Accept Terms
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
