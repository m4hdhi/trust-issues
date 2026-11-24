import { useEffect, useRef, useState } from 'react'
import { animate, motion, useReducedMotion } from 'motion/react'
import { T } from '../../lib/lang'
import { EASE_OUT, T_NEEDLE } from '../../lib/motion'

const TICKS = 41
const R_OUT = 92
const R_IN = 80

function point(deg: number, r: number) {
  const rad = (deg * Math.PI) / 180
  return { x: 100 + r * Math.cos(rad), y: 100 + r * Math.sin(rad) }
}

export function Dial({ score, color, animated }: { score: number; color: string; animated: boolean }) {
  const reduce = useReducedMotion()
  const play = animated && !reduce
  const value = Math.max(0, Math.min(100, score))
  const [lit, setLit] = useState(play ? 0 : value)
  const numberRef = useRef<HTMLSpanElement>(null)

  useEffect(() => {
    if (!play) {
      setLit(value)
      if (numberRef.current) numberRef.current.textContent = String(score)
      return
    }
    const controls = animate(0, value, {
      duration: 1.1,
      delay: 0.15,
      ease: EASE_OUT,
      onUpdate: (v) => {
        setLit(v)
        if (numberRef.current) numberRef.current.textContent = String(Math.round(v))
      },
    })
    return () => controls.stop()
  }, [play, value, score])

  const needleDeg = -90 + (value / 100) * 180

  return (
    <div className="relative mx-auto w-full max-w-[320px]" role="img" aria-label={`Risk score ${score} out of 100`}>
      <svg viewBox="0 0 200 112" className="w-full overflow-visible">
        {Array.from({ length: TICKS }, (_, i) => {
          const pct = (i / (TICKS - 1)) * 100
          const deg = 180 + (i / (TICKS - 1)) * 180
          const major = i % 10 === 0
          const a = point(deg, R_OUT)
          const b = point(deg, major ? R_IN - 6 : R_IN)
          const on = pct <= lit + 0.001 && lit > 0
          return (
            <line
              key={i}
              x1={a.x}
              y1={a.y}
              x2={b.x}
              y2={b.y}
              stroke={on ? color : 'var(--color-ink-700)'}
              strokeWidth={major ? 2.2 : 1.6}
              strokeLinecap="round"
            />
          )
        })}
        {[0, 50, 100].map((v) => {
          const edge = v !== 50
          const p = edge ? point(180 + (v / 100) * 180, (R_OUT + R_IN) / 2) : point(270, R_IN - 18)
          return (
            <text key={v} x={p.x} y={edge ? p.y + 14 : p.y + 3} textAnchor="middle" className="fill-paper-3" style={{ font: '500 8px var(--font-mono)' }}>
              {v}
            </text>
          )
        })}
        <motion.g
          style={{ originX: 0.5, originY: 1 }}
          initial={{ rotate: play ? -90 : needleDeg }}
          animate={{ rotate: needleDeg }}
          transition={play ? { ...T_NEEDLE, delay: 0.15 } : { duration: 0 }}
        >
          <line x1="100" y1="100" x2="100" y2="22" stroke="var(--color-paper)" strokeWidth="2" strokeLinecap="round" />
        </motion.g>
        <circle cx="100" cy="100" r="6" fill="var(--color-ink-950)" stroke="var(--color-paper)" strokeWidth="2" />
      </svg>
      <div className="mt-2 text-center">
        <span ref={numberRef} className="display num block text-6xl leading-none" style={{ color }}>
          {play ? 0 : score}
        </span>
        <span className="mt-2 block text-sm text-paper-3">
          <T k="riskScore" /> <span className="evidence">/ 100</span>
        </span>
      </div>
    </div>
  )
}
