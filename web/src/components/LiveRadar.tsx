import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { BrandMark, brandName } from './BrandMark'
import { Counter } from './motion'
import { T, Tx } from '../lib/lang'
import { shortAgo } from '../lib/format'
import { EASE_OUT, T_LAYOUT } from '../lib/motion'
import type { LiveFeed, LiveItem } from '../lib/types'
import { VERDICT_COLOR, verdictFromScore } from '../lib/verdict'

function hash(s: string): number {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

function blipPosition(item: LiveItem) {
  const angle = (hash(item.domain) % 360) * (Math.PI / 180)
  const r = 26 + (hash(`${item.domain}:r`) % 64)
  return { x: 100 + Math.cos(angle) * r, y: 100 + Math.sin(angle) * r }
}

function itemHref(item: LiveItem) {
  return item.scan_id ? `/scan/${encodeURIComponent(item.scan_id)}` : '/trending'
}

const TICKS = Array.from({ length: 72 }, (_, i) => i * 5)
const VISIBLE = 4

export function LiveRadar({ feed }: { feed: LiveFeed | null }) {
  const reduce = useReducedMotion()
  const recent = feed?.recent ?? []
  const blips = recent.slice(0, 12)
  // The list walks through the real detections, newest first, so there is always something arriving.
  const [turn, setTurn] = useState(0)
  useEffect(() => {
    if (reduce || recent.length <= VISIBLE) return
    const timer = window.setInterval(() => setTurn((n) => n + 1), 2600)
    return () => window.clearInterval(timer)
  }, [reduce, recent.length])
  const start = recent.length > VISIBLE ? turn % recent.length : 0
  const shown = recent.length > VISIBLE ? Array.from({ length: VISIBLE }, (_, i) => recent[(start + VISIBLE - 1 - i) % recent.length]) : recent
  const focus = shown[0]

  return (
    <section aria-labelledby="radar-title" className="rounded-2xl bg-ink-850">
      <header className="flex items-center justify-between gap-4 px-6 pt-6">
        <h2 id="radar-title" className="display text-lg text-paper">
          <T k="liveRadarTitle" />
        </h2>
        <span className="inline-flex items-center gap-2 rounded-full bg-safe/12 px-3 py-1 text-xs font-bold text-safe">
          <span className="relative flex size-2">
            <span className="absolute inset-0 animate-ping-soft rounded-full bg-safe" />
            <span className="relative size-2 rounded-full bg-safe" />
          </span>
          <T k="liveLabel" />
        </span>
      </header>
      <Tx k="liveRadarSub" className="px-6 pt-2 text-sm text-paper-3" />

      <div className="zone-dark relative mx-auto mt-5 aspect-square w-full max-w-[300px] px-6">
        <svg viewBox="0 0 200 200" className="h-full w-full drop-shadow-[0_18px_30px_rgb(54_40_160/0.45)]" role="img" aria-label="Radar of recently caught scam sites">
          <defs>
            <radialGradient id="scope" cx="50%" cy="50%" r="50%">
              <stop offset="0" stopColor="#2a2470" />
              <stop offset="0.7" stopColor="#15113f" />
              <stop offset="1" stopColor="#0b0a26" />
            </radialGradient>
            <clipPath id="scope-clip">
              <circle cx="100" cy="100" r="92" />
            </clipPath>
          </defs>
          <circle cx="100" cy="100" r="99" fill="#0b0a26" />
          <circle cx="100" cy="100" r="92" fill="url(#scope)" />
          {TICKS.map((d) => (
            <line key={d} x1="100" y1="3" x2="100" y2={d % 30 === 0 ? 8 : 5.5} stroke="#b3a6ff" strokeOpacity={d % 30 === 0 ? 0.9 : 0.4} strokeWidth="0.8" transform={`rotate(${d} 100 100)`} />
          ))}
          {[23, 46, 69, 92].map((r) => (
            <circle key={r} cx="100" cy="100" r={r} fill="none" stroke="#b3a6ff" strokeOpacity="0.22" strokeWidth="0.7" />
          ))}
          <line x1="8" y1="100" x2="192" y2="100" stroke="#b3a6ff" strokeOpacity="0.18" strokeWidth="0.7" />
          <line x1="100" y1="8" x2="100" y2="192" stroke="#b3a6ff" strokeOpacity="0.18" strokeWidth="0.7" />
          {!reduce && (
            <g clipPath="url(#scope-clip)">
              <foreignObject x="8" y="8" width="184" height="184">
                <div className="radar-sweep size-full rounded-full" />
              </foreignObject>
            </g>
          )}
          <circle cx="100" cy="100" r="3" fill="#b3a6ff" />
          <AnimatePresence>
            {blips.map((b, i) => {
              const p = blipPosition(b)
              const color = VERDICT_COLOR[verdictFromScore(b.score)]
              const hot = focus && b.domain === focus.domain
              return (
                <motion.g
                  key={`${b.domain}-${b.ts}`}
                  initial={{ opacity: 0, scale: 0.4 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.35, ease: EASE_OUT }}
                  style={{ transformBox: 'fill-box', transformOrigin: 'center' }}
                >
                  {!reduce && <circle className="radar-ring" cx={p.x} cy={p.y} r="3" fill="none" stroke={color} strokeWidth="1.2" style={{ animationDelay: `${(i * 0.37) % 2.4}s` }} />}
                  <circle cx={p.x} cy={p.y} r={hot ? 9 : 6} fill={color} opacity={hot ? 0.38 : 0.22} style={{ transition: 'r 300ms, opacity 300ms' }} />
                  <circle cx={p.x} cy={p.y} r={hot ? 3.6 : 2.6} fill={color} style={{ transition: 'r 300ms' }} />
                  {hot && <circle cx={p.x} cy={p.y} r="12" fill="none" stroke="#fff" strokeOpacity="0.7" strokeWidth="0.8" strokeDasharray="3 3" />}
                </motion.g>
              )
            })}
          </AnimatePresence>
        </svg>
      </div>

      <div className="mt-5 border-t border-line px-6 py-4">
        <p className="text-xs font-bold text-paper-3">
          <T k="liveLatest" />
        </p>
        <ul className="mt-2 h-[13.5rem] overflow-hidden">
          <AnimatePresence initial={false} mode="popLayout">
            {shown.map((item, i) => {
              const name = brandName(item.brand)
              return (
                <motion.li
                  key={`${item.domain}-${item.ts}`}
                  layout
                  initial={{ opacity: 0, y: -18, scale: 0.96 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 12 }}
                  transition={T_LAYOUT}
                >
                  <Link to={itemHref(item)} className={`group flex items-center gap-3 rounded-xl px-2 py-2 transition-colors ${i === 0 ? 'bg-scam/8' : ''}`}>
                    <BrandMark brand={item.brand} className="size-9" />
                    <span className="min-w-0 flex-1">
                      <span className="evidence block truncate text-sm font-bold text-paper group-hover:text-gold">{item.domain}</span>
                      {name && (
                        <span className="block truncate text-xs text-paper-3">
                          <T text={name} />
                        </span>
                      )}
                    </span>
                    <span className="display num shrink-0 text-base" style={{ color: VERDICT_COLOR[verdictFromScore(item.score)] }}>
                      {item.score}
                    </span>
                    <span className="num w-8 shrink-0 text-end text-xs text-paper-3">{shortAgo(item.ts)}</span>
                  </Link>
                </motion.li>
              )
            })}
          </AnimatePresence>
          {feed && recent.length === 0 && (
            <li className="py-2 text-sm text-paper-3">
              <T k="liveQuiet" />
            </li>
          )}
        </ul>
      </div>
    </section>
  )
}

export function LiveStrip({ feed, brandsCount }: { feed: LiveFeed | null; brandsCount: number }) {
  const stats = [
    { k: 'liveCerts' as const, value: feed?.certs_checked, tone: 'text-paper' },
    { k: 'liveScamsToday' as const, value: feed?.scams_today, tone: 'text-scam' },
    { k: 'liveBlocked' as const, value: feed?.blocked_queries, tone: 'text-paper' },
    { k: 'liveBrands' as const, value: feed?.brands_protected || brandsCount || undefined, tone: 'text-gold' },
  ]
  return (
    <dl className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {stats.map((s) => (
        <div key={s.k} className="flex min-w-0 flex-col-reverse gap-1 rounded-2xl bg-ink-850 p-4 sm:p-6">
          <dt className="text-sm font-bold text-paper-3">
            <T k={s.k} />
          </dt>
          <dd className={`display num text-[1.6rem] leading-tight sm:text-4xl ${s.tone}`}>
            {s.value != null ? <Counter value={s.value} duration={1.6} /> : <span className="text-paper-3">·</span>}
          </dd>
        </div>
      ))}
    </dl>
  )
}
