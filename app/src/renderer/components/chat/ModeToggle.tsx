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
 * ModeToggle component for switching between Autonomous and Return Bytes modes
 * @param props - Component props including current mode, change handler, and disabled state
 * @returns React component for mode toggling with visual indicators
 */
export const ModeToggle: React.FC<ModeToggleProps> = ({
  mode,
  onChange,
  disabled = false,
  className
}) => {
  const isReturnBytes = mode === 'returnBytes'

  const handleCheckedChange = (checked: boolean) => {
    onChange(checked ? 'returnBytes' : 'autonomous')
  }

  return (
    <TooltipProvider>
      <div className={cn('flex items-center gap-3', className)}>
        <Typography 
          variant="caption" 
          className={cn(
            'font-medium transition-colors',
            !isReturnBytes ? 'text-gray-900 dark:text-white' : 'text-gray-500 dark:text-gray-400'
          )}
        >
          <FiZap className="inline w-3 h-3 mr-1" />
          Autonomous
        </Typography>

        <Tooltip>
          <TooltipTrigger asChild>
            <div className="flex items-center">
              <Switch
                checked={isReturnBytes}
                onCheckedChange={handleCheckedChange}
                disabled={disabled}
                aria-label={`Switch to ${isReturnBytes ? 'Autonomous' : 'Return Bytes'} mode`}
                className={cn(
                  "data-[state=checked]:bg-gradient-to-r data-[state=checked]:from-[#a679f0] data-[state=checked]:to-[#5599fe]",
                  "data-[state=unchecked]:bg-gray-300 dark:data-[state=unchecked]:bg-gray-700"
                )}
              />
            </div>
          </TooltipTrigger>
          <TooltipContent>
            <Typography variant="caption">
              {isReturnBytes
                ? "Return Bytes Mode: AI returns transaction bytes for manual signing"
                : "Autonomous Mode: AI executes transactions directly"
              }
            </Typography>
            <div className="mt-1">
              <Typography variant="caption" className="text-gray-400">
                Shortcut: Ctrl/Cmd+M
              </Typography>
            </div>
          </TooltipContent>
        </Tooltip>

        <Typography 
          variant="caption" 
          className={cn(
            'font-medium transition-colors',
            isReturnBytes ? 'text-gray-900 dark:text-white' : 'text-gray-500 dark:text-gray-400'
          )}
        >
          <FiCode className="inline w-3 h-3 mr-1" />
          Return Bytes
        </Typography>
      </div>
    </TooltipProvider>
  )
}

export default ModeToggle