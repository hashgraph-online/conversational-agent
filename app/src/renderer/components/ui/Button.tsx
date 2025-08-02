import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/renderer/lib/utils"
import { gradients, animations, shadows } from "@/renderer/lib/styles"

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg font-mono font-bold transition-all duration-300 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 shrink-0 [&_svg]:shrink-0 outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-gray-900 transform active:scale-[0.98] touch-manipulation shadow-lg hover:shadow-xl",
  {
    variants: {
      variant: {
        default:
          "bg-hgo-blue text-white hover:bg-hgo-blue/90 focus-visible:ring-hgo-blue/50",
        gradient:
          "bg-gradient-to-r from-hgo-purple via-hgo-blue to-hgo-green text-white hover:opacity-90 focus-visible:ring-hgo-purple/50",
        destructive:
          "bg-red-600 text-white shadow-md hover:bg-red-700 hover:shadow-lg focus-visible:ring-red-500/50",
        outline:
          "border-2 border-gray-300 dark:border-gray-600 bg-transparent hover:bg-gray-50 dark:hover:bg-gray-800 hover:border-gray-400 dark:hover:border-gray-500 text-gray-700 dark:text-gray-300",
        secondary:
          "bg-gray-600 text-white hover:bg-gray-700 focus-visible:ring-gray-600/50",
        ghost:
          "hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-gray-100 text-gray-600 dark:text-gray-400",
        link: "text-hgo-blue underline-offset-4 hover:underline hover:text-hgo-purple",
      },
      size: {
        default: "h-11 px-6 py-2.5 text-base",
        sm: "h-9 px-3 py-1.5 text-xs",
        lg: "h-12 px-8 py-3 text-lg",
        xl: "h-14 px-10 py-4 text-xl",
        icon: "size-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

/**
 * A flexible button component with multiple variants and sizes.
 * Supports both button elements and polymorphic rendering via Slot for composition.
 * 
 * @param className - Additional CSS classes to apply to the button
 * @param variant - Button style variant (default, gradient, destructive, outline, secondary, ghost, link)
 * @param size - Button size (default, sm, lg, xl, icon)
 * @param asChild - When true, renders as Slot component for polymorphic composition
 * @param props - Additional HTML button element props
 * @returns React button component with applied styles and behaviors
 */
function Button({
  className,
  variant,
  size,
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
  }) {
  const Comp = asChild ? Slot : "button"

  return (
    <Comp
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
