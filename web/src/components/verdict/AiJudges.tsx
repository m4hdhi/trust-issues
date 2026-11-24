import { BrainCircuit } from 'lucide-react'
import { Section } from './Section'
import { VerdictChip } from '../VerdictChip'
import { T, useLang } from '../../lib/lang'
import { ms } from '../../lib/format'
import type { AIOpinion } from '../../lib/types'
import { VERDICT_COLOR } from '../../lib/verdict'

function Reasons({ list, ar }: { list: string[]; ar?: boolean }) {
  if (!list.length) return null
  return (
    <ul className={`space-y-1.5 text-sm leading-snug text-mist-200 ${ar ? 'text-right' : ''}`} lang={ar ? 'ar' : undefined} dir={ar ? 'rtl' : undefined}>
      {list.map((r, i) => (
        <li key={i} className="flex gap-2">
          <span className="mt-[7px] size-1 shrink-0 rounded-full bg-mist-500" aria-hidden="true" />
          <span>{r}</span>
        </li>
      ))}
    </ul>
  )
}

function Judge({ op }: { op: AIOpinion }) {
  const { mode } = useLang()
  const color = VERDICT_COLOR[op.verdict]
  const conf = Math.round(op.confidence * 100)
  const en = op.reasons.en ?? []
  const ar = op.reasons.ar ?? []
  return (
    <article className="flex flex-col rounded-2xl border border-ink-700 bg-ink-850 p-4">
      <header className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-bold text-paper">{op.provider}</p>
          <p className="truncate font-mono text-[11px] text-mist-500" dir="ltr">
            {op.model}
            {op.latency_ms ? `  ${ms(op.latency_ms)}` : ''}
          </p>
        </div>
        <VerdictChip verdict={op.verdict} />
      </header>
      <div className="mt-3">
        <div className="flex items-center justify-between text-xs text-mist-400">
          <T k="confidence" />
          <span className="num font-semibold text-paper">{conf}%</span>
        </div>
        <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-ink-700">
          <div className="h-full rounded-full" style={{ width: `${conf}%`, background: color }} />
        </div>
      </div>
      <div className="mt-3.5 space-y-2.5">
        {mode !== 'ar' && <Reasons list={en} />}
        {mode !== 'en' && <Reasons list={ar.length ? ar : mode === 'ar' ? en : []} ar={ar.length > 0} />}
      </div>
    </article>
  )
}

export function AiJudges({ opinions }: { opinions: AIOpinion[] }) {
  return (
    <Section icon={BrainCircuit} title="aiTitle">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
        {opinions.map((op) => (
          <Judge key={`${op.provider}-${op.model}`} op={op} />
        ))}
      </div>
    </Section>
  )
}
