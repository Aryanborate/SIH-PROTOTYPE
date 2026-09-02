import Reveal from './Reveal'
import { cn } from '../../lib/utils'

interface SectionHeadingProps {
  index?: string
  eyebrow: string
  title: string
  description?: string
  align?: 'left' | 'center'
  className?: string
}

export default function SectionHeading({
  index,
  eyebrow,
  title,
  description,
  align = 'left',
  className,
}: SectionHeadingProps) {
  return (
    <Reveal className={cn('max-w-2xl', align === 'center' && 'mx-auto text-center', className)}>
      <p className="eyebrow flex items-center gap-3">
        {index && <span className="text-indigo-400/80">{index}</span>}
        <span className="h-px w-8 bg-indigo-400/40" aria-hidden="true" />
        <span>{eyebrow}</span>
      </p>
      <h2 className="mt-4 font-display text-3xl font-semibold tracking-tight text-slate-100 sm:text-4xl">
        {title}
      </h2>
      {description && (
        <p className="mt-4 text-[15px] leading-relaxed text-slate-400">{description}</p>
      )}
    </Reveal>
  )
}
