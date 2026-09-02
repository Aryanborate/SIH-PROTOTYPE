import { forwardRef } from 'react'
import { cn } from '../../lib/utils'

export type ButtonVariant = 'primary' | 'ghost' | 'text'

const base =
  'inline-flex items-center justify-center gap-2 rounded-full transition-all duration-200 select-none'

const variants: Record<ButtonVariant, string> = {
  primary:
    'bg-gradient-to-b from-indigo-500 to-indigo-600 px-5 py-2.5 text-sm font-semibold text-white shadow-[0_10px_36px_-10px_rgba(79,70,229,0.65)] hover:-translate-y-0.5 hover:from-indigo-400 hover:to-indigo-500 hover:shadow-glow active:translate-y-0',
  ghost:
    'border border-white/[0.12] bg-white/[0.04] px-5 py-2.5 text-sm font-medium text-slate-200 backdrop-blur-md hover:-translate-y-0.5 hover:border-indigo-300/40 hover:bg-white/[0.07] active:translate-y-0',
  text: 'px-1 py-0.5 text-sm font-medium text-indigo-300 underline-offset-4 hover:text-indigo-200 hover:underline',
}

export const ButtonLink = forwardRef<
  HTMLAnchorElement,
  React.AnchorHTMLAttributes<HTMLAnchorElement> & { variant?: ButtonVariant }
>(({ variant = 'primary', className, ...props }, ref) => (
  <a ref={ref} className={cn(base, variants[variant], className)} {...props} />
))
ButtonLink.displayName = 'ButtonLink'

export const Button = forwardRef<
  HTMLButtonElement,
  React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant }
>(({ variant = 'primary', className, ...props }, ref) => (
  <button ref={ref} className={cn(base, variants[variant], className)} {...props} />
))
Button.displayName = 'Button'
