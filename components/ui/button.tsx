import type { ButtonHTMLAttributes } from 'react'

import { cn } from '@/lib/utils'

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger'
  fullWidth?: boolean
}

const variants = {
  primary:
    'bg-[#ff6e9d] text-white shadow-[0_14px_30px_-18px_rgba(255,110,157,0.9)] hover:bg-[#f85f93]',
  secondary:
    'bg-white text-[#4d3640] ring-1 ring-[#f2c9d8] hover:bg-[#fff6fa] shadow-[0_12px_28px_-20px_rgba(103,55,72,0.45)]',
  ghost: 'bg-transparent text-[#7f6870] hover:bg-[#fff4f8]',
  danger:
    'bg-[#c74663] text-white shadow-[0_14px_30px_-18px_rgba(199,70,99,0.85)] hover:bg-[#b43754]',
}

export function Button({
  className,
  children,
  fullWidth = false,
  type = 'button',
  variant = 'primary',
  ...props
}: ButtonProps) {
  return (
    <button
      className={cn(
        'inline-flex min-h-11 items-center justify-center rounded-full px-4 py-3 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-60',
        variants[variant],
        fullWidth && 'w-full',
        className,
      )}
      type={type}
      {...props}
    >
      {children}
    </button>
  )
}
