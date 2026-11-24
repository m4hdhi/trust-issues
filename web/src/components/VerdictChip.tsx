import { T } from '../lib/lang'
import type { Verdict } from '../lib/types'
import { VERDICT_COLOR, VERDICT_LABEL } from '../lib/verdict'

export function VerdictChip({ verdict, score, size = 'sm' }: { verdict: Verdict; score?: number; size?: 'sm' | 'md' }) {
  const color = VERDICT_COLOR[verdict]
  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border font-semibold ${size === 'md' ? 'px-3 py-1 text-sm' : 'px-2 py-0.5 text-xs'}`}
      style={{ color, borderColor: `${color}55`, background: `${color}14` }}
    >
      <span className="size-1.5 rounded-full" style={{ background: color }} />
      {score != null && <span className="num">{score}</span>}
      <T k={VERDICT_LABEL[verdict]} arClassName="opacity-90" />
    </span>
  )
}

export function ScoreBadge({ verdict, score }: { verdict: Verdict; score: number }) {
  const color = VERDICT_COLOR[verdict]
  return (
    <span
      className="num inline-grid size-10 shrink-0 place-items-center rounded-xl text-sm font-bold"
      style={{ color, background: `${color}1c`, boxShadow: `inset 0 0 0 1px ${color}55` }}
    >
      {score}
    </span>
  )
}
