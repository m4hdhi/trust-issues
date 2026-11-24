import { MessageSquareWarning } from 'lucide-react'
import { Section } from './Section'
import { ScoreBadge } from '../VerdictChip'
import { Tx, useLang } from '../../lib/lang'
import type { MessageAnalysis } from '../../lib/types'
import { verdictFromScore } from '../../lib/verdict'

export function MessageAnalysisCard({ message }: { message: MessageAnalysis }) {
  const { mode } = useLang()
  const verdict = message.is_scam_text ? verdictFromScore(Math.max(message.score, 75)) : verdictFromScore(message.score)
  const en = message.reasons.en ?? []
  const ar = message.reasons.ar ?? []
  return (
    <Section icon={MessageSquareWarning} title="messageAnalysis" aside={<ScoreBadge verdict={verdict} score={message.score} />}>
      <Tx
        k={message.is_scam_text ? 'messageScam' : 'messageOk'}
        className={`text-base font-semibold ${message.is_scam_text ? 'text-scam' : 'text-safe'}`}
        split="stack"
      />
      <div className="mt-3 grid gap-3 md:grid-cols-2">
        {mode !== 'ar' && en.length > 0 && (
          <ul className="space-y-1.5 text-sm text-mist-200">
            {en.map((r, i) => (
              <li key={i} className="flex gap-2">
                <span className="mt-[7px] size-1 shrink-0 rounded-full bg-mist-500" aria-hidden="true" />
                {r}
              </li>
            ))}
          </ul>
        )}
        {mode !== 'en' && ar.length > 0 && (
          <ul className="space-y-1.5 text-right text-sm text-mist-200" lang="ar" dir="rtl">
            {ar.map((r, i) => (
              <li key={i} className="flex gap-2">
                <span className="mt-[9px] size-1 shrink-0 rounded-full bg-mist-500" aria-hidden="true" />
                {r}
              </li>
            ))}
          </ul>
        )}
      </div>
    </Section>
  )
}
