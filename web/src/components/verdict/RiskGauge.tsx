import { useEffect, useId, useRef } from 'react'
import { animate, motion, useReducedMotion } from 'motion/react'
import { T } from '../../lib/lang'

const R = 84
const C = 100
const SWEEP = 270
const START = 135

function polar(angle: number, r: number) {
  const rad = (angle * Math.PI) / 180
  return { x: C + r * Math.cos(rad), y: C + r * Math.sin(rad) }
}

function arcPath(r: number) {
  const a = polar(START, r)
  const b = polar(START + SWEEP, r)
  return `M ${a.x} ${a.y} A ${r} ${r} 0 1 1 ${b.x} ${b.y}`
}

export function RiskGauge({ score, color, animated, delay = 0.15 }: { score: number; color: string; animated: boolean; delay?: number }) {
  const numberRef = useRef<HTMLSpanElement>(null)
  const glowId = `glow${useId().replace(/[^a-zA-Z0-9]/g, '')}`
  const reduce = useReducedMotion()
  const play = animated && !reduce
  const frac = Math.max(0, Math.min(100, score)) / 100

  useEffect(() => {
    const el = numberRef.current
    if (!el) return
    if (!play) {
      el.textContent = String(score)
      return
    }
    el.textContent = '0'
    const controls = animate(0, score, {
      duration: 1.15,
      delay,
      ease: [0.2, 0.7, 0.2, 1],
      onUpdate: (v) => {
        el.textContent = String(Math.round(v))
      },
    })
    return () => controls.stop()
  }, [score, play, delay])

  const ticks = Array.from({ length: 11 }, (_, i) => {
    const angle = START + (SWEEP * i) / 10
    const inner = polar(angle, R - 15)
    const outer = polar(angle, R - (i % 5 === 0 ? 22 : 19))
    return <line key={i} x1={inner.x} y1={inner.y} x2={outer.x} y2={outer.y} stroke="#33456b" strokeWidth={i % 5 === 0 ? 2 : 1.2} strokeLinecap="round" />
  })

  return (
    <div className="relative aspect-square w-full" role="img" aria-label={`Risk score ${score} out of 100`}>
      <svg viewBox="0 0 200 200" className="h-full w-full overflow-visible">
        <defs>
          <filter id={glowId} x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation="5" result="b" />
            <feMerge>
              <feMergeNode in="b" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
        <path d={arcPath(R)} fill="none" stroke="#1a2742" strokeWidth="13" strokeLinecap="round" />
        {ticks}
        <motion.path
          d={arcPath(R)}
          fill="none"
          stroke={color}
          strokeWidth="13"
          strokeLinecap="round"
          filter={`url(#${glowId})`}
          initial={{ pathLength: play ? 0 : frac }}
          animate={{ pathLength: Math.max(frac, 0.005) }}
          transition={{ duration: play ? 1.15 : 0, delay: play ? delay : 0, ease: [0.2, 0.7, 0.2, 1] }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center pt-1">
        <span ref={numberRef} className="num text-[54px] font-extrabold leading-none tracking-[-0.04em] sm:text-6xl" style={{ color }}>
          {score}
        </span>
        <span className="mt-1.5 text-center text-[11px] font-medium leading-tight text-mist-400">
          <T k="riskScore" stacked />
        </span>
      </div>
    </div>
  )
}
