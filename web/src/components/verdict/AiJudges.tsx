import { T, useLang } from '../../lib/lang'
import { ms } from '../../lib/format'
import { VerdictChip } from '../VerdictChip'
import type { AIOpinion } from '../../lib/types'
import { VERDICT_COLOR } from '../../lib/verdict'

function Reasons({ list, ar }: { list: string[]; ar?: boolean }) {
  if (!list.length) return null
  return (
    <ul className={`space-y-2 text-base text-paper-2 ${ar ? 'text-right' : ''}`} lang={ar ? 'ar' : undefined} dir={ar ? 'rtl' : undefined}>
      {list.map((r, i) => (
        <li key={i} className="flex gap-3">
          <span className="mt-3 h-px w-3 shrink-0 bg-line-strong" aria-hidden="true" />
          <span>{r}</span>
        </li>
      ))}
    </ul>
  )
}

export function AiJudges({ opinions }: { opinions: AIOpinion[] }) {
  const { mode } = useLang()
  return (
    <div className="grid gap-x-8 border-t border-line sm:grid-cols-2">
      {opinions.map((op) => {
        const conf = Math.round(op.confidence * 100)
        const en = op.reasons.en ?? []
        const ar = op.reasons.ar ?? []
        return (
          <article key={`${op.provider}-${op.model}`} className="border-b border-line py-6">
            <header className="flex items-baseline justify-between gap-4">
              <div className="min-w-0">
                <p className="text-lg font-medium text-paper">{op.provider}</p>
                <p className="evidence truncate text-xs text-paper-3">
                  {op.model}
                  {op.latency_ms ? `  ${ms(op.latency_ms)}` : ''}
                </p>
              </div>
              <VerdictChip verdict={op.verdict} />
            </header>
            <div className="mt-4 flex items-center gap-3">
              <span className="h-1 flex-1 overflow-hidden rounded-full bg-ink-800">
                <span className="block h-full rounded-full" style={{ width: `${conf}%`, background: VERDICT_COLOR[op.verdict] }} />
              </span>
              <span className="evidence num text-sm text-paper-2">
                {conf}% <T k="confidence" />
              </span>
            </div>
            <div className="mt-4 space-y-4">
              {mode !== 'ar' && <Reasons list={en} />}
              {mode !== 'en' && <Reasons list={ar.length ? ar : mode === 'ar' ? en : []} ar={ar.length > 0} />}
            </div>
          </article>
        )
      })}
    </div>
  )
}
