import { T, Tx, useLang } from '../../lib/lang'
import type { MessageAnalysis } from '../../lib/types'
import { VERDICT_COLOR, verdictFromScore } from '../../lib/verdict'

export function MessageAnalysisCard({ message }: { message: MessageAnalysis }) {
  const { mode } = useLang()
  const verdict = message.is_scam_text ? verdictFromScore(Math.max(message.score, 75)) : verdictFromScore(message.score)
  const color = VERDICT_COLOR[verdict]
  const en = message.reasons.en ?? []
  const ar = message.reasons.ar ?? []
  return (
    <section className="grid-12 gap-y-6 border-t border-line py-8">
      <header className="col-span-4 sm:col-span-8 lg:col-span-4">
        <p className="text-sm text-paper-3">
          <T k="messageAnalysis" />
        </p>
        <p className="mt-2 flex items-baseline gap-3">
          <span className="display num text-4xl" style={{ color }}>
            {message.score}
          </span>
          <Tx k={message.is_scam_text ? 'messageScam' : 'messageOk'} as="span" className="text-lg" split="stack" />
        </p>
      </header>
      <div className="col-span-4 grid gap-6 sm:col-span-8 md:grid-cols-2 lg:col-span-8">
        {mode !== 'ar' && en.length > 0 && (
          <ul className="space-y-2 text-base text-paper-2">
            {en.map((r, i) => (
              <li key={i} className="flex gap-3">
                <span className="mt-3 h-px w-3 shrink-0 bg-line-strong" aria-hidden="true" />
                {r}
              </li>
            ))}
          </ul>
        )}
        {mode !== 'en' && (ar.length > 0 || mode === 'ar') && (
          <ul className="space-y-2 text-right text-base text-paper-2" lang="ar" dir="rtl">
            {(ar.length ? ar : en).map((r, i) => (
              <li key={i} className="flex gap-3">
                <span className="mt-3 h-px w-3 shrink-0 bg-line-strong" aria-hidden="true" />
                {r}
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  )
}
