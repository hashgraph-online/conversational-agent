import React, { useEffect, useState } from 'react';
import { cn } from '../../lib/utils';
import logoDark from '../../assets/images/logos/logo-dark.png';
import logoLight from '../../assets/images/logos/logo-light.png';

interface LogoProps {
  className?: string;
  showText?: boolean;
  size?: 'sm' | 'md' | 'lg';
  variant?: 'default' | 'white';
}

/**
 * Logo component that handles light/dark mode theme switching
 * Uses separate logo files for light and dark modes for proper branding
 */
const Logo: React.FC<LogoProps> = ({
  className,
  showText = true,
  size = 'md',
  variant = 'default',
}) => {
  const [isDarkMode, setIsDarkMode] = useState(false);

  useEffect(() => {
    const checkTheme = () => {
      const isDark =
        document.documentElement.classList.contains('dark') ||
        document.documentElement.getAttribute('data-theme') === 'dark';
      setIsDarkMode(isDark);
    };

    checkTheme();

    const observer = new MutationObserver(checkTheme);

    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class', 'data-theme'],
    });

    return () => observer.disconnect();
  }, []);

  const sizeClasses = {
    sm: 'h-6',
    md: 'h-8',
    lg: 'h-16',
  };

  const textSizeClasses = {
    sm: 'text-sm',
    md: 'text-base',
    lg: 'text-lg',
  };

  const logoSrc =
    variant === 'white'
      ? logoDark
      : isDarkMode
      ? logoDark
      : logoLight;

  const filterStyle =
    variant === 'white'
      ? { filter: 'brightness(0) invert(1)' }
      : {
          filter:
            'brightness(0) saturate(100%) invert(42%) sepia(93%) saturate(1352%) hue-rotate(196deg) brightness(102%) contrast(96%)',
        };

  return (
    <div
      className={cn(
        'flex items-center justify-center',
        showText && 'gap-2',
        className
      )}
    >
      <img
        src={logoSrc}
        alt='Hashgraph Online'
        className={cn(
          sizeClasses[size],
          'transition-all duration-200',
          'object-contain',
          'w-auto',
          'mx-auto'
        )}
        style={filterStyle}
      />
      {showText && (
        <span
          className={cn(
            'font-semibold transition-colors duration-200',
            'text-gray-900 dark:text-gray-100',
            textSizeClasses[size]
          )}
        >
          Hashgraph Online
        </span>
      )}
    </div>
  );
};

export default Logo;
