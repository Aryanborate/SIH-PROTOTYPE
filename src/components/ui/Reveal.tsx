import { motion, useReducedMotion } from 'framer-motion'
import { cn } from '../../lib/utils'

interface RevealProps {
  children: React.ReactNode
  className?: string
  delay?: number
  y?: number
  once?: boolean
}

/** Scroll-reveal wrapper — small translation + fade, respecting reduced motion. */
export default function Reveal({ children, className, delay = 0, y = 24, once = true }: RevealProps) {
  const reduced = useReducedMotion()
  return (
    <motion.div
      className={cn(className)}
      initial={reduced ? { opacity: 0 } : { opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once, margin: '-70px' }}
      transition={{ duration: 0.7, delay, ease: [0.21, 0.47, 0.32, 0.98] }}
    >
      {children}
    </motion.div>
  )
}
