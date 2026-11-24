import { useEffect, useRef, type ReactNode } from 'react'
import { animate, motion, useInView, useReducedMotion } from 'motion/react'
import { EASE_OUT, fadeUp, staggerParent } from '../lib/motion'

interface RevealProps {
  children: ReactNode
  className?: string
  delay?: number
  as?: 'div' | 'section' | 'li' | 'header'
}

export function Reveal({ children, className, delay = 0, as = 'div' }: RevealProps) {
  const Tag = motion[as]
  return (
    <Tag
      className={className}
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, margin: '0px 0px -64px 0px' }}
      variants={fadeUp}
      transition={{ delay }}
    >
      {children}
    </Tag>
  )
}

export function Stagger({ children, className, gap = 0.05, delay = 0, as = 'div' }: RevealProps & { gap?: number }) {
  const Tag = motion[as === 'li' ? 'ul' : as]
  return (
    <Tag
      className={className}
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, margin: '0px 0px -48px 0px' }}
      variants={staggerParent(gap, delay)}
    >
      {children}
    </Tag>
  )
}

export function StaggerItem({ children, className, as = 'div' }: { children: ReactNode; className?: string; as?: 'div' | 'li' }) {
  const Tag = motion[as]
  return (
    <Tag className={className} variants={fadeUp}>
      {children}
    </Tag>
  )
}

const formatInt = (n: number) => Math.round(n).toLocaleString('en-US')

export function Counter({ value, className, format = formatInt, duration = 0.9 }: {
  value: number
  className?: string
  format?: (n: number) => string
  duration?: number
}) {
  const ref = useRef<HTMLSpanElement>(null)
  const from = useRef(0)
  const reduce = useReducedMotion()

  useEffect(() => {
    const el = ref.current
    if (!el) return
    if (reduce) {
      el.textContent = format(value)
      from.current = value
      return
    }
    const controls = animate(from.current, value, {
      duration,
      ease: EASE_OUT,
      onUpdate: (v) => {
        el.textContent = format(v)
      },
    })
    from.current = value
    return () => controls.stop()
  }, [value, reduce, duration, format])

  return (
    <span ref={ref} className={`num ${className ?? ''}`}>
      {format(0)}
    </span>
  )
}

export function Marker({ children, tone = 'gold', className = '', delay = 0 }: {
  children: ReactNode
  tone?: 'gold' | 'scam' | 'warn' | 'safe'
  className?: string
  delay?: number
}) {
  const ref = useRef<HTMLSpanElement>(null)
  const inView = useInView(ref, { once: true, margin: '0px 0px -40px 0px' })
  return (
    <span
      ref={ref}
      className={`mark ${className}`}
      data-tone={tone === 'gold' ? undefined : tone}
      data-draw={inView ? 'on' : 'off'}
      style={{ transitionDelay: `${delay}ms` }}
    >
      {children}
    </span>
  )
}
