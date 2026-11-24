import type { Transition, Variants } from 'motion/react'

export const EASE_OUT = [0.23, 1, 0.32, 1] as const
export const EASE_IN_OUT = [0.77, 0, 0.175, 1] as const
export const EASE_DRAWER = [0.32, 0.72, 0, 1] as const

export const DUR = {
  press: 0.16,
  fast: 0.2,
  base: 0.28,
  slow: 0.35,
} as const

export const T_ENTER: Transition = { duration: DUR.base, ease: EASE_OUT }
export const T_LAYOUT: Transition = { type: 'spring', duration: 0.45, bounce: 0.12 }
export const T_STAMP: Transition = { type: 'spring', duration: 0.5, bounce: 0.32 }
export const T_NEEDLE: Transition = { type: 'spring', stiffness: 110, damping: 13, mass: 0.9 }

export const fadeUp: Variants = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: T_ENTER },
}

export const staggerParent = (gap = 0.05, delay = 0): Variants => ({
  hidden: {},
  show: { transition: { staggerChildren: gap, delayChildren: delay } },
})
