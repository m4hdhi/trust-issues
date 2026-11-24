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

export function LiveRadar({ feed }: { feed: LiveFeed | null }) {
  const reduce = useReducedMotion()
  const recent = feed?.recent ?? []
  const blips = recent.slice(0, 10)

  return (
    <section aria-labelledby="radar-title" className="rounded-xl bg-ink-850">
      <header className="flex items-center justify-between gap-4 px-6 pt-6">
        <h2 id="radar-title" className="display text-lg text-paper">
          <T k="liveRadarTitle" arClassName="text-paper-2" />
        </h2>
        <span className="inline-flex items-center gap-2 text-xs font-medium text-safe">
          <span className="relative flex size-2">
            <span className="absolute inset-0 animate-ping-soft rounded-full bg-safe" />
            <span className="relative size-2 rounded-full bg-safe" />
          </span>
          <T k="liveLabel" />
        </span>
      </header>
      <Tx k="liveRadarSub" className="px-6 pt-2 text-sm text-paper-3" split="stack" />

      <div className="relative mx-auto mt-4 aspect-square w-full max-w-[280px] px-6">
        <svg viewBox="0 0 200 200" className="h-full w-full" role="img" aria-label="Radar of recently caught scam sites">
          <defs>
            <linearGradient id="sweep-fade" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0" stopColor="#c9a35b" stopOpacity="0" />
              <stop offset="1" stopColor="#c9a35b" stopOpacity="0.28" />
            </linearGradient>
          </defs>
          {[30, 55, 80, 96].map((r) => (
            <circle key={r} cx="100" cy="100" r={r} fill="none" stroke="#2a2e35" strokeWidth="1" />
          ))}
          <line x1="4" y1="100" x2="196" y2="100" stroke="#2a2e35" strokeWidth="1" />
          <line x1="100" y1="4" x2="100" y2="196" stroke="#2a2e35" strokeWidth="1" />
          {!reduce && (
            <g className="origin-center animate-sweep" style={{ transformBox: 'view-box', transformOrigin: '100px 100px' }}>
              <path d="M100 100 L196 100 A96 96 0 0 0 167.9 32.1 Z" fill="url(#sweep-fade)" />
              <line x1="100" y1="100" x2="196" y2="100" stroke="#c9a35b" strokeOpacity="0.7" strokeWidth="1" />
            </g>
          )}
          <circle cx="100" cy="100" r="2.5" fill="#c9a35b" />
          <AnimatePresence>
            {blips.map((b) => {
              const p = blipPosition(b)
              const color = VERDICT_COLOR[verdictFromScore(b.score)]
              return (
                <motion.g
                  key={`${b.domain}-${b.ts}`}
                  initial={{ opacity: 0, scale: 0.6 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.35, ease: EASE_OUT }}
                  style={{ transformBox: 'fill-box', transformOrigin: 'center' }}
                >
                  <circle cx={p.x} cy={p.y} r="7" fill={color} opacity="0.18" />
                  <circle cx={p.x} cy={p.y} r="3" fill={color} />
                </motion.g>
              )
            })}
          </AnimatePresence>
        </svg>
      </div>

      <div className="mt-4 border-t border-line px-6 py-4">
        <p className="text-xs text-paper-3">
          <T k="liveLatest" />
        </p>
        <ul className="mt-2">
          <AnimatePresence initial={false}>
            {recent.slice(0, 4).map((item) => {
              const name = brandName(item.brand)
              return (
                <motion.li
                  key={`${item.domain}-${item.ts}`}
                  layout
                  initial={{ opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  transition={T_LAYOUT}
                >
                  <Link to={itemHref(item)} className="group flex items-center gap-3 py-2">
                    <BrandMark brand={item.brand} className="size-8" />
                    <span className="min-w-0 flex-1">
                      <span className="evidence block truncate text-sm text-paper group-hover:text-gold">{item.domain}</span>
                      {name && (
                        <span className="block truncate text-xs text-paper-3">
                          <T text={name} />
                        </span>
                      )}
                    </span>
                    <span className="evidence num shrink-0 text-sm" style={{ color: VERDICT_COLOR[verdictFromScore(item.score)] }}>
                      {item.score}
                    </span>
                    <span className="evidence num w-8 shrink-0 text-end text-xs text-paper-3">{shortAgo(item.ts)}</span>
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

const CELL = [
  '',
  'border-s border-line ps-4 sm:ps-8',
  'border-t border-line lg:border-s lg:border-t-0 lg:ps-8',
  'border-s border-t border-line ps-4 sm:ps-8 lg:border-t-0',
]

export function LiveStrip({ feed, brandsCount }: { feed: LiveFeed | null; brandsCount: number }) {
  const stats = [
    { k: 'liveCerts' as const, value: feed?.certs_checked, tone: 'text-paper' },
    { k: 'liveScamsToday' as const, value: feed?.scams_today, tone: 'text-scam' },
    { k: 'liveBlocked' as const, value: feed?.blocked_queries, tone: 'text-paper' },
    { k: 'liveBrands' as const, value: feed?.brands_protected || brandsCount || undefined, tone: 'text-gold' },
  ]
  return (
    <dl className="grid grid-cols-2 border-y border-line lg:grid-cols-4">
      {stats.map((s, i) => (
        <div key={s.k} className={`flex flex-col-reverse gap-1 py-6 pe-4 ${CELL[i]}`}>
          <dt className="text-sm text-paper-3">
            <T k={s.k} />
          </dt>
          <dd className={`evidence num text-xl sm:text-2xl ${s.tone}`}>{s.value != null ? <Counter value={s.value} /> : <span className="text-paper-3">·</span>}</dd>
        </div>
      ))}
    </dl>
  )
}
