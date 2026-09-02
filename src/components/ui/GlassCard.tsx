import { forwardRef } from 'react'
import { cn } from '../../lib/utils'

export interface GlassCardProps extends React.HTMLAttributes<HTMLDivElement> {
  /** enables the shared lift + border hover treatment */
  hover?: boolean
}

/** The single reusable glass surface — subtle translucency, fine border, soft blur. */
export const GlassCard = forwardRef<HTMLDivElement, GlassCardProps>(
  ({ className, hover, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        'glass rounded-2xl',
        hover &&
          'transition-all duration-300 hover:-translate-y-1 hover:border-indigo-300/25 hover:bg-white/[0.055] hover:shadow-card',
        className,
      )}
      {...props}
    />
  ),
)
GlassCard.displayName = 'GlassCard'
