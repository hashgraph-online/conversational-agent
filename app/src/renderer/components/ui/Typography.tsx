import React from 'react'
import { cn } from '@/lib/utils'
import { gradients } from '@/renderer/lib/styles'

type TypographyVariant =
  | 'h1'
  | 'h2'
  | 'h3'
  | 'h4'
  | 'h5'
  | 'h6'
  | 'subtitle1'
  | 'subtitle2'
  | 'body1'
  | 'body2'
  | 'caption'
  | 'overline'

type TypographyProps = {
  variant: TypographyVariant
  children: React.ReactNode
  className?: string
  as?: React.ElementType
  gradient?: boolean
  color?: 'default' | 'muted' | 'purple' | 'blue' | 'green' | 'secondary' | 'white'
}

const Typography: React.FC<TypographyProps> = ({
  variant,
  children,
  className = '',
  as,
  gradient = false,
  color = 'default',
}) => {
  const Component = as || getComponent(variant)

  const variantClasses: Record<TypographyVariant, string> = {
    h1: 'text-4xl md:text-5xl lg:text-6xl font-display font-bold tracking-tight',
    h2: 'text-3xl md:text-4xl lg:text-5xl font-display font-bold tracking-tight',
    h3: 'text-2xl md:text-3xl lg:text-4xl font-display font-semibold',
    h4: 'text-xl md:text-2xl lg:text-3xl font-display font-semibold',
    h5: 'text-lg md:text-xl lg:text-2xl font-display font-medium',
    h6: 'text-base md:text-lg lg:text-xl font-display font-medium',
    subtitle1: 'text-lg font-medium',
    subtitle2: 'text-base font-medium',
    body1: 'text-base font-normal',
    body2: 'text-sm font-normal',
    caption: 'text-xs font-normal',
    overline: 'text-xs font-medium uppercase tracking-wide',
  }

  const colorClasses = gradient
    ? gradients.text
    : {
        default: 'text-gray-900 dark:text-white',
        muted: 'text-gray-600 dark:text-gray-400',
        purple: 'text-[#a679f0]',
        blue: 'text-[#5599fe]',
        green: 'text-[#48df7b]',
        secondary: 'text-gray-600 dark:text-gray-400',
        white: 'text-white',
      }[color]

  return (
    <Component
      className={cn(
        variantClasses[variant],
        gradient ? colorClasses : colorClasses,
        className
      )}
    >
      {children}
    </Component>
  )
}

/**
 * Maps typography variants to their corresponding HTML element types.
 * Ensures semantic HTML usage based on the content type.
 * 
 * @param variant - The typography variant to map to an HTML element
 * @returns The appropriate React element type for the given variant
 */
function getComponent(variant: TypographyVariant): React.ElementType {
  switch (variant) {
    case 'h1':
      return 'h1'
    case 'h2':
      return 'h2'
    case 'h3':
      return 'h3'
    case 'h4':
      return 'h4'
    case 'h5':
      return 'h5'
    case 'h6':
      return 'h6'
    case 'subtitle1':
    case 'subtitle2':
      return 'p'
    case 'body1':
    case 'body2':
      return 'p'
    case 'caption':
      return 'span'
    case 'overline':
      return 'span'
    default:
      return 'span'
  }
}

export default Typography