import React, { useEffect, useState } from 'react'
import { cn } from '@/renderer/lib/utils'

interface LogoProps {
  className?: string
  showText?: boolean
  size?: 'sm' | 'md' | 'lg'
}

/**
 * Logo component that handles light/dark mode theme switching
 * Uses separate logo files for light and dark modes for proper branding
 */
const Logo: React.FC<LogoProps> = ({ className, showText = true, size = 'md' }) => {
  const [isDarkMode, setIsDarkMode] = useState(false)

  useEffect(() => {
    const checkTheme = () => {
      const isDark = document.documentElement.classList.contains('dark') || 
                     document.documentElement.getAttribute('data-theme') === 'dark'
      setIsDarkMode(isDark)
    }

    checkTheme()

    const observer = new MutationObserver(checkTheme)
    
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class', 'data-theme']
    })

    return () => observer.disconnect()
  }, [])

  const sizeClasses = {
    sm: 'h-6',
    md: 'h-8',
    lg: 'h-10'
  }

  const textSizeClasses = {
    sm: 'text-sm',
    md: 'text-base',
    lg: 'text-lg'
  }

  const logoSrc = isDarkMode 
    ? '/src/renderer/assets/images/logos/logo-dark.png'
    : '/src/renderer/assets/images/logos/logo-light.png'

  return (
    <div className={cn('flex items-center gap-2', className)}>
      <img
        src={logoSrc}
        alt="Hashgraph Online"
        className={cn(
          sizeClasses[size],
          'transition-all duration-200',
          'object-contain'
        )}
      />
      {showText && (
        <span className={cn(
          'font-semibold transition-colors duration-200',
          'text-gray-900 dark:text-gray-100',
          textSizeClasses[size]
        )}>
          Hashgraph Online
        </span>
      )}
    </div>
  )
}

export default Logo