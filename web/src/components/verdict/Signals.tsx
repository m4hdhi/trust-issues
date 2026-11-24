import { useRef, useState } from 'react'
import { AnimatePresence, motion, useInView } from 'motion/react'
import { ChevronDown } from 'lucide-react'
import { T, Tx } from '../../lib/lang'
import { EASE_OUT } from '../../lib/motion'
import type { Signal } from '../../lib/types'
import { SEVERITY_COLOR, SEVERITY_LABEL } from '../../lib/verdict'

function formatValue(v: unknown): string {
  if (v == null) return 'n/a'
  if (typeof v === 'number') return Number.isInteger(v) ? String(v) : v.toFixed(3).replace(/0+$/, '')
  if (typeof v === 'string') return v
  if (Array.isArray(v)) return v.map(formatValue).join(', ')
  return JSON.stringify(v)
}

function SignalRow({ signal, max, index, shown }: { signal: Signal; max: number; index: number; shown: boolean }) {
  const [open, setOpen] = useState(false)
  const trust = signal.weight < 0
  const color = trust ? '#4bb37f' : SEVERITY_COLOR[signal.severity]
  const evidence = Object.entries(signal.evidence ?? {})
  const expandable = !!signal.detail || evidence.length > 0
  const pct = max > 0 ? Math.max(4, (Math.abs(signal.weight) / max) * 100) : 0

  return (
    <li className="border-b border-line">
      <button
        type="button"
        onClick={() => expandable && setOpen((o) => !o)}
        aria-expanded={expandable ? open : undefined}
        className={`grid w-full grid-cols-[1fr_auto] items-start gap-x-4 gap-y-2 py-4 text-start ${expandable ? 'cursor-pointer' : 'cursor-default'}`}
      >
        <Tx text={signal.title} as="span" className="block text-base text-paper" split="stack" />
        <span className="flex items-center gap-2 pt-1">
          <span className="text-sm" style={{ color }}>
            <T k={trust ? 'sev_info' : SEVERITY_LABEL[signal.severity]} />
          </span>
          {expandable && <ChevronDown className={`size-4 text-paper-3 transition-transform duration-200 ${open ? 'rotate-180' : ''}`} aria-hidden="true" />}
        </span>
        <span className="col-span-2 block h-1 overflow-hidden rounded-full bg-ink-800" aria-hidden="true">
          <span
            className="block h-full origin-left rounded-full transition-transform duration-700 ease-[var(--ease-out)] rtl:origin-right"
            style={{ background: color, width: `${pct}%`, transform: `scaleX(${shown ? 1 : 0})`, transitionDelay: `${index * 50}ms` }}
          />
        </span>
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: EASE_OUT }}
            className="overflow-hidden"
          >
            <div className="space-y-4 pb-6">
              {signal.detail && <Tx text={signal.detail} className="max-w-[62ch] text-base text-paper-2" split="stack" />}
              {evidence.length > 0 && (
                <dl className="grid gap-x-6 gap-y-1 rounded-lg bg-ink-850 p-4 sm:grid-cols-[auto_1fr]" dir="ltr">
                  {evidence.map(([k, v]) => (
                    <div key={k} className="contents">
                      <dt className="evidence text-xs text-paper-3">{k}</dt>
                      <dd className="evidence break-all text-sm text-paper-2">{formatValue(v)}</dd>
                    </div>
                  ))}
                </dl>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </li>
  )
}

export function Signals({ signals, safe }: { signals: Signal[]; safe: boolean }) {
  const risk = signals.filter((s) => s.weight > 0).sort((a, b) => b.weight - a.weight)
  const trust = signals.filter((s) => s.weight <= 0).sort((a, b) => a.weight - b.weight)
  const ordered = safe ? [...trust, ...risk] : [...risk, ...trust]
  const max = Math.max(...signals.map((s) => Math.abs(s.weight)), 0)
  const list = useRef<HTMLUListElement>(null)
  const shown = useInView(list, { once: true, margin: '0px 0px -40px 0px' })
  return (
    <ul ref={list} className="border-t border-line">
      {ordered.map((s, i) => (
        <SignalRow key={s.id} signal={s} max={max} index={i} shown={shown} />
      ))}
    </ul>
  )
}
