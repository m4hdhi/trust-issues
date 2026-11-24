import { useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import {
  BadgeCheck,
  BrainCircuit,
  ChevronDown,
  Database,
  Globe,
  Link2,
  ListChecks,
  MonitorSmartphone,
  ScanEye,
  Send,
  Users,
  type LucideIcon,
} from 'lucide-react'
import { Section } from './Section'
import { T, Tx } from '../../lib/lang'
import type { Signal, SignalCategory, Verdict } from '../../lib/types'
import { SEVERITY_COLOR, SEVERITY_LABEL } from '../../lib/verdict'

const CATEGORY_ICON: Record<SignalCategory, LucideIcon> = {
  trust: BadgeCheck,
  intel: Database,
  url: Link2,
  domain: Globe,
  render: MonitorSmartphone,
  exfil: Send,
  visual: ScanEye,
  ai: BrainCircuit,
  community: Users,
}

function formatValue(v: unknown): string {
  if (v == null) return '—'
  if (typeof v === 'number') return Number.isInteger(v) ? String(v) : v.toFixed(3).replace(/0+$/, '')
  if (typeof v === 'string') return v
  if (Array.isArray(v)) return v.map(formatValue).join(', ')
  return JSON.stringify(v)
}

function SignalRow({ signal, max, index }: { signal: Signal; max: number; index: number }) {
  const [open, setOpen] = useState(false)
  const trust = signal.weight < 0
  const color = trust ? '#10b981' : SEVERITY_COLOR[signal.severity]
  const Icon = CATEGORY_ICON[signal.category] ?? ListChecks
  const evidence = Object.entries(signal.evidence ?? {})
  const expandable = !!signal.detail || evidence.length > 0
  const pct = max > 0 ? Math.max(6, (Math.abs(signal.weight) / max) * 100) : 0

  return (
    <li className="rounded-2xl border border-ink-700 bg-ink-850">
      <button
        type="button"
        onClick={() => expandable && setOpen((o) => !o)}
        aria-expanded={expandable ? open : undefined}
        className={`flex w-full items-start gap-3 px-4 py-3.5 text-start ${expandable ? 'cursor-pointer' : 'cursor-default'}`}
      >
        <span className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-lg" style={{ background: `${color}1c`, color }}>
          <Icon className="size-4" aria-hidden="true" />
        </span>
        <span className="min-w-0 flex-1">
          <Tx text={signal.title} className="text-[15px] font-semibold leading-snug text-paper" split="stack" />
          <span className="mt-2 flex items-center gap-3">
            <span
              className="inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold"
              style={{ color, background: `${color}18` }}
            >
              <T k={trust ? 'sev_info' : SEVERITY_LABEL[signal.severity]} />
            </span>
            <span className="h-1 flex-1 overflow-hidden rounded-full bg-ink-700" aria-hidden="true">
              <motion.span
                className="block h-full rounded-full"
                style={{ background: color }}
                initial={{ width: 0 }}
                whileInView={{ width: `${pct}%` }}
                viewport={{ once: true }}
                transition={{ duration: 0.6, delay: 0.05 * index, ease: 'easeOut' }}
              />
            </span>
          </span>
        </span>
        {expandable && (
          <ChevronDown className={`mt-1.5 size-4 shrink-0 text-mist-500 transition-transform ${open ? 'rotate-180' : ''}`} aria-hidden="true" />
        )}
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22 }}
            className="overflow-hidden"
          >
            <div className="space-y-3 px-4 pb-4 ps-[60px]">
              {signal.detail && <Tx text={signal.detail} className="text-sm leading-relaxed text-mist-300" split="stack" />}
              {evidence.length > 0 && (
                <div>
                  <p className="mb-1.5 text-xs font-semibold text-mist-500">
                    <T k="showEvidence" />
                  </p>
                  <dl className="grid gap-x-4 gap-y-1 rounded-xl bg-ink-900 p-3 font-mono text-xs sm:grid-cols-[auto_1fr]" dir="ltr">
                    {evidence.map(([k, v]) => (
                      <div key={k} className="contents">
                        <dt className="text-mist-500">{k}</dt>
                        <dd className="break-all text-mist-200">{formatValue(v)}</dd>
                      </div>
                    ))}
                  </dl>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </li>
  )
}

export function Signals({ signals, verdict }: { signals: Signal[]; verdict: Verdict }) {
  const safe = verdict === 'safe'
  const risk = signals.filter((s) => s.weight > 0).sort((a, b) => b.weight - a.weight)
  const trust = signals.filter((s) => s.weight <= 0).sort((a, b) => a.weight - b.weight)
  const ordered = safe ? [...trust, ...risk] : [...risk, ...trust]
  const max = Math.max(...signals.map((s) => Math.abs(s.weight)), 0)
  if (!ordered.length) return null
  const title = safe ? 'whyTrust' : verdict === 'scam' ? 'whyFlagged' : 'whyCaution'
  return (
    <Section icon={ListChecks} title={title}>
      <ul className="space-y-2.5">
        {ordered.map((s, i) => (
          <SignalRow key={s.id} signal={s} max={max} index={i} />
        ))}
      </ul>
    </Section>
  )
}
