import { AnimatePresence, motion } from 'motion/react'
import { BadgeCheck, Check, EyeOff, Gauge, Globe, ListChecks, Minus, MonitorSmartphone, Scale, ScanEye, Search, Send, Sparkles, type LucideIcon } from 'lucide-react'
import { T, Tx } from '../../lib/lang'
import { caseNumber } from '../../lib/format'
import { EASE_OUT, T_LAYOUT } from '../../lib/motion'
import { S, fill, type StringKey } from '../../lib/i18n'
import type { Bilingual, StageId, StageStatus } from '../../lib/types'

export const STAGES: StageId[] = ['trust', 'intel', 'url_model', 'domain', 'render', 'cloaking', 'exfil', 'visual', 'ai', 'fusion']

export interface StageState {
  status: StageStatus | 'pending'
  label?: Bilingual
  detail?: string | null
  startedAt?: number
  ms?: number
}

const ICON: Record<string, LucideIcon> = {
  trust: BadgeCheck,
  intel: ListChecks,
  url_model: Sparkles,
  domain: Globe,
  render: MonitorSmartphone,
  cloaking: EyeOff,
  exfil: Send,
  visual: ScanEye,
  ai: Scale,
  fusion: Gauge,
}

const R = 54
const CIRC = 2 * Math.PI * R

/** The check as one moving picture: a ring that fills, the step in progress in plain words, and a tile per step. */
export function Pipeline({ id, host, stages, order, elapsed }: { id: string; host: string; stages: Record<string, StageState>; order: string[]; elapsed: number }) {
  const settled = (s: string) => ['done', 'skipped', 'error'].includes(stages[s]?.status ?? '')
  const finished = order.filter(settled).length
  const total = order.length || STAGES.length
  const progress = Math.min(1, finished / total)
  const current = order.find((s) => stages[s]?.status === 'running') ?? order.find((s) => !settled(s))
  const known = (sid: string) => (STAGES as string[]).includes(sid)
  const CurrentIcon = current ? (ICON[current] ?? Search) : Gauge

  return (
    <motion.div layoutId="case-file" transition={T_LAYOUT} className="mx-auto max-w-2xl rounded-[2rem] bg-ink-850 p-5 sm:p-8">
      <div className="flex items-center justify-between gap-4 text-xs text-paper-3">
        <span>
          <T k="caseFile" /> <span className="evidence text-paper-2">{caseNumber(id)}</span>
        </span>
        <span className="num">{(elapsed / 1000).toFixed(1)}s</span>
      </div>

      <div className="mt-4 flex flex-col items-center text-center">
        <div className="relative size-36">
          <svg viewBox="0 0 120 120" className="size-full -rotate-90" aria-hidden="true">
            <defs>
              <linearGradient id="scan-ring" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0" stopColor="#5a48f2" />
                <stop offset="1" stopColor="#c64fd8" />
              </linearGradient>
            </defs>
            <circle cx="60" cy="60" r={R} fill="none" stroke="var(--color-ink-700)" strokeWidth="7" />
            <motion.circle
              cx="60"
              cy="60"
              r={R}
              fill="none"
              stroke="url(#scan-ring)"
              strokeWidth="7"
              strokeLinecap="round"
              strokeDasharray={CIRC}
              initial={{ strokeDashoffset: CIRC * 0.96 }}
              animate={{ strokeDashoffset: CIRC * (1 - Math.max(0.04, progress)) }}
              transition={{ duration: 0.5, ease: EASE_OUT }}
            />
          </svg>
          <span className="scan-orbit absolute inset-2 rounded-full" aria-hidden="true" />
          <span className="absolute inset-0 grid place-items-center">
            <AnimatePresence mode="wait" initial={false}>
              <motion.span key={current ?? 'end'} initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.6, opacity: 0 }} transition={{ duration: 0.2 }}>
                <CurrentIcon className="size-11 text-gold" strokeWidth={1.75} aria-hidden="true" />
              </motion.span>
            </AnimatePresence>
          </span>
        </div>

        <p className="mt-5 text-sm text-paper-3">
          <T k="scanChecking" />
        </p>
        <p className="evidence mt-1 max-w-full text-lg break-all text-paper sm:text-xl">{host || '…'}</p>

        <div className="mt-5 min-h-[5.5rem]" aria-live="polite">
          <AnimatePresence mode="wait" initial={false}>
            <motion.div key={current ?? 'end'} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.22 }}>
              <p className="text-xs text-gold">
                <T text={fill(S.scanStep, { n: Math.min(total, finished + 1), total })} />
              </p>
              <p className="display mt-1 text-2xl text-paper">
                {!current ? <T k="scanWrapping" /> : known(current) ? <T k={`st_${current}` as StringKey} /> : <T text={stages[current]?.label ?? { en: current, ar: current }} />}
              </p>
              {current && known(current) && (
                <p className="mx-auto mt-1 max-w-[38ch] text-base text-paper-2">
                  <T k={`st_${current}_d` as StringKey} />
                </p>
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>

      <ol className="mt-5 grid grid-cols-5 gap-2">
        {order.map((sid) => {
          const st = stages[sid]?.status ?? 'pending'
          const Icon = ICON[sid] ?? Search
          const tone =
            st === 'running' ? 'bg-gold text-white shadow-[0_8px_18px_-8px_rgb(90_72_242/0.8)]' : st === 'done' ? 'bg-safe/12 text-safe' : st === 'error' || st === 'skipped' ? 'bg-ink-800 text-paper-3' : 'bg-ink-800 text-paper-3 opacity-55'
          return (
            <li key={sid} className={`relative flex flex-col items-center gap-1.5 rounded-xl px-1 py-2.5 text-center transition-colors duration-300 ${tone}`}>
              <span className="relative">
                <Icon className={`size-5 ${st === 'running' ? 'animate-pulse' : ''}`} aria-hidden="true" />
                {st === 'done' && <Check className="absolute -end-2 -top-1.5 size-3.5 rounded-full bg-safe p-0.5 text-white" strokeWidth={3.5} aria-hidden="true" />}
                {(st === 'skipped' || st === 'error') && <Minus className="absolute -end-2 -top-1.5 size-3.5 rounded-full bg-paper-3 p-0.5 text-white" strokeWidth={3.5} aria-hidden="true" />}
              </span>
              <span className="hidden text-[0.6875rem] leading-tight sm:block">
                {known(sid) ? <T k={`st_${sid}` as StringKey} /> : <T text={stages[sid]?.label ?? { en: sid, ar: sid }} />}
              </span>
            </li>
          )
        })}
      </ol>

      <Tx k="scanWait" className="mt-5 text-center text-sm text-paper-3" />
    </motion.div>
  )
}
