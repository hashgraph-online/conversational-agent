import React from 'react'
import { cn } from '@/renderer/lib/utils'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/renderer/components/ui/tooltip'
import { Switch } from '@/renderer/components/ui/switch'
import { FiCode, FiZap } from 'react-icons/fi'
import Typography from '@/renderer/components/ui/Typography'

export type OperationalMode = 'autonomous' | 'returnBytes'

interface ModeToggleProps {
  mode: OperationalMode
  onChange: (mode: OperationalMode) => void
  disabled?: boolean
  className?: string
}

/**
 * ModeToggle component displaying Manual mode indicator
 * @param props - Component props including current mode, change handler, and disabled state
 * @returns React component showing Manual mode with tooltip
 */
export const ModeToggle: React.FC<ModeToggleProps> = ({
  mode,
  onChange,
  disabled = false,
  className
}) => {
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className={cn('flex items-center gap-2', className)}>
            <div className="flex items-center gap-2 px-2.5 py-1.5 bg-white/80 dark:bg-gray-800/80 backdrop-blur-md rounded-lg border border-gray-200/40 dark:border-gray-700/40 shadow-sm">
              <FiCode className="w-4 h-4 text-[#5599fe]" />
              <Typography 
                variant="caption" 
                className="font-semibold"
              >
                Manual Mode
              </Typography>
            </div>
            <Typography 
              variant="caption" 
              className="text-xs text-gray-500 dark:text-gray-400"
            >
              <FiZap className="inline w-3 h-3 mr-0.5 opacity-60" />
              Autonomous soon
            </Typography>
          </div>
        </TooltipTrigger>
        <TooltipContent className="bg-[#5599fe] text-white border-[#4488ee]">
          <div className="space-y-1">
            <Typography variant="caption" className="text-white font-medium">
              Manual Mode Active
            </Typography>
            <Typography variant="caption" className="text-blue-100">
              AI returns transaction bytes for manual signing
            </Typography>
            <div className="pt-1 border-t border-blue-400/30">
              <Typography variant="caption" className="text-blue-100">
                Autonomous mode coming soon!
              </Typography>
            </div>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}

export default ModeToggle