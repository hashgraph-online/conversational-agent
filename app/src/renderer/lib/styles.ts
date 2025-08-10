/**
 * Common style utilities and constants for the application.
 * Centralizes frequently used style patterns to maintain consistency.
 */

/**
 * Common gradient patterns used throughout the application.
 * Uses Tailwind classes defined in the config for brand colors.
 */
export const gradients = {
  /** Primary app gradient: secondary → primary → accent */
  primary: 'bg-gradient-to-r from-[hsl(var(--brand-secondary))] via-[hsl(var(--brand-primary))] to-[hsl(var(--brand-accent))]',

  /** Reversed gradient: accent → primary → secondary */
  primaryReverse: 'bg-gradient-to-r from-[hsl(var(--brand-accent))] via-[hsl(var(--brand-primary))] to-[hsl(var(--brand-secondary))]',

  /** Text gradient using tokens */
  text: 'bg-gradient-to-r from-[hsl(var(--brand-secondary))] via-[hsl(var(--brand-primary))] to-[hsl(var(--brand-accent))] bg-clip-text text-transparent',

  /** Gradient for user messages */
  user: 'bg-gradient-to-r from-[hsl(var(--brand-primary))] to-[hsl(var(--brand-secondary))]',

  /** Accent gradient for assistant messages */
  assistant: 'bg-gradient-to-r from-[hsl(var(--brand-accent))] to-[hsl(var(--brand-accent))]',
} as const;

/**
 * Common animation classes for consistent motion design.
 */
export const animations = {
  /** Smooth transition for hover and state changes */
  transition: 'transition-all duration-300',

  /** Scale effect for interactive elements */
  pressable: 'transform active:scale-[0.98] touch-manipulation',

  /** Focus ring styles for accessibility */
  focusRing: 'outline-none focus-visible:ring-2 focus-visible:ring-offset-2',
} as const;

/**
 * Common shadow styles for depth and elevation.
 */
export const shadows = {
  /** Default interactive element shadow */
  interactive: 'shadow-lg hover:shadow-xl',

  /** Card and container shadows */
  card: 'shadow-md hover:shadow-lg',

  /** Subtle shadow for nested elements */
  subtle: 'shadow-sm',
} as const;