import { T } from '../lib/lang'
import type { Verdict } from '../lib/types'
import { VERDICT_COLOR, VERDICT_LABEL } from '../lib/verdict'

export function VerdictChip({ verdict, score }: { verdict: Verdict; score?: number }) {
  const color = VERDICT_COLOR[verdict]
  return (
    <span className="inline-flex shrink-0 items-baseline gap-2 text-sm font-medium" style={{ color }}>
      {score != null && <span className="evidence num font-medium">{score}</span>}
      <T k={VERDICT_LABEL[verdict]} arClassName="opacity-80" />
    </span>
  )
}
