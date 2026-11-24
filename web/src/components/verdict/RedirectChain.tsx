import { ArrowRight, Route } from 'lucide-react'
import { Section } from './Section'
import { T } from '../../lib/lang'
import { hostOf } from '../../lib/format'
import type { StringKey } from '../../lib/i18n'
import type { RedirectHop } from '../../lib/types'

function hopKind(hop: RedirectHop, last: boolean): StringKey {
  if (last || hop.kind === 'final') return 'hop_final'
  if (hop.kind === 'shortener') return 'hop_shortener'
  return 'hop_redirect'
}

export function RedirectChain({ hops, danger }: { hops: RedirectHop[]; danger: boolean }) {
  return (
    <Section icon={Route} title="redirectTitle">
      <ol className="scrollbar-thin -mx-1 flex snap-x items-stretch gap-1 overflow-x-auto px-1 pb-1" dir="ltr">
        {hops.map((hop, i) => {
          const last = i === hops.length - 1
          const kind = hopKind(hop, last)
          return (
            <li key={`${hop.url}-${i}`} className="flex shrink-0 snap-start items-center gap-1">
              <div
                className={`w-[188px] rounded-2xl border px-3.5 py-3 ${
                  last && danger ? 'border-scam/50 bg-scam/[0.08]' : 'border-ink-600 bg-ink-850'
                }`}
              >
                <div className="flex items-center justify-between gap-2 text-[11px] font-semibold text-mist-400">
                  <span dir="auto">
                    <T k={kind} />
                  </span>
                  {hop.status != null && <span className="num rounded bg-ink-700 px-1.5 py-0.5 font-mono text-mist-200">{hop.status}</span>}
                </div>
                <p className={`mt-1.5 truncate font-mono text-sm ${last && danger ? 'text-scam' : 'text-paper'}`} title={hop.url}>
                  {hostOf(hop.url)}
                </p>
                <p className="truncate font-mono text-[11px] text-mist-500" title={hop.url}>
                  {hop.url.replace(/^https?:\/\/[^/]+/, '') || '/'}
                </p>
              </div>
              {!last && <ArrowRight className="size-4 shrink-0 text-mist-500" aria-hidden="true" />}
            </li>
          )
        })}
      </ol>
    </Section>
  )
}
