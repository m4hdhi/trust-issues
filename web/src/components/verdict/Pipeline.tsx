import { motion } from 'motion/react'
import { Check, Minus, X } from 'lucide-react'
import { Spinner } from '../States'
import { T, useLang } from '../../lib/lang'
import { ms } from '../../lib/format'
import type { StringKey } from '../../lib/i18n'
import type { Bilingual, StageId, StageStatus } from '../../lib/types'

export const STAGES: StageId[] = ['trust', 'intel', 'url_model', 'domain', 'render', 'cloaking', 'exfil', 'visual', 'ai', 'fusion']

export interface StageState {
  status: StageStatus | 'pending'
  label?: Bilingual
  detail?: string | null
  startedAt?: number
  ms?: number
}

function StatusIcon({ status }: { status: StageState['status'] }) {
  if (status === 'running') return <Spinner className="size-4 text-brand-bright" />
  if (status === 'done') return <Check className="size-4 text-safe" strokeWidth={3} />
  if (status === 'skipped') return <Minus className="size-4 text-mist-500" />
  if (status === 'error') return <X className="size-4 text-warn" />
  return <span className="size-1.5 rounded-full bg-ink-500" />
}

export function Pipeline({ host, stages, order, elapsed }: { host: string; stages: Record<string, StageState>; order: string[]; elapsed: number }) {
  const { mode } = useLang()
  const finished = order.filter((s) => ['done', 'skipped', 'error'].includes(stages[s]?.status ?? '')).length
  const progress = order.length ? finished / order.length : 0

  return (
    <section className="relative mx-auto max-w-2xl overflow-hidden rounded-[32px] border border-ink-700 bg-ink-850">
      <div className="guilloche pointer-events-none absolute inset-0 opacity-60 [mask-image:linear-gradient(to_bottom,black,transparent_45%)]" aria-hidden="true" />
      <div className="relative px-5 pt-6 pb-5 sm:px-8 sm:pt-8">
        <p className="text-sm font-medium text-mist-400">
          <T k="investigating" />
        </p>
        <p className="mt-1 break-all font-mono text-xl font-semibold text-paper sm:text-2xl" dir="ltr">
          {host || '…'}
        </p>
        <div className="mt-5 flex items-center gap-3">
          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-ink-700">
            <motion.div
              className="h-full rounded-full bg-gradient-to-r from-brand-deep to-brand-bright"
              initial={{ width: '4%' }}
              animate={{ width: `${Math.max(4, progress * 100)}%` }}
              transition={{ duration: 0.4, ease: 'easeOut' }}
            />
          </div>
          <span className="num w-14 text-end font-mono text-xs text-mist-400">{(elapsed / 1000).toFixed(1)}s</span>
        </div>
      </div>
      <ol className="relative border-t border-ink-700 px-2 py-2 sm:px-4">
        {order.map((id) => {
          const st = stages[id] ?? { status: 'pending' as const }
          const known = (STAGES as string[]).includes(id)
          const label: Bilingual | undefined = known ? undefined : st.label
          const active = st.status === 'running'
          return (
            <li
              key={id}
              className={`flex items-center gap-3 rounded-2xl px-3 py-2.5 transition-colors duration-300 ${active ? 'bg-brand/[0.08]' : ''}`}
            >
              <span
                className={`grid size-8 shrink-0 place-items-center rounded-full border transition-colors ${
                  active ? 'border-brand/60 bg-brand/10' : st.status === 'pending' ? 'border-ink-600' : 'border-ink-600 bg-ink-800'
                }`}
              >
                <StatusIcon status={st.status} />
              </span>
              <div className={`min-w-0 flex-1 ${st.status === 'pending' ? 'opacity-45' : ''}`}>
                <p className="text-[15px] font-semibold leading-tight text-paper">
                  {known ? <T k={`st_${id}` as StringKey} arClassName="font-medium text-mist-300" /> : <T text={label ?? { en: id, ar: id }} />}
                </p>
                {st.detail ? (
                  <p className="mt-0.5 truncate font-mono text-xs text-brand-bright/80" dir="ltr">
                    {st.detail}
                  </p>
                ) : (
                  known &&
                  mode !== 'both' && (
                    <p className="mt-0.5 truncate text-xs text-mist-500">
                      <T k={`st_${id}_d` as StringKey} />
                    </p>
                  )
                )}
              </div>
              <span className="num shrink-0 font-mono text-xs text-mist-500">
                {st.status === 'skipped' ? (
                  <T k="stageSkipped" />
                ) : st.status === 'error' ? (
                  <T k="stageError" />
                ) : st.ms != null ? (
                  ms(st.ms)
                ) : (
                  ''
                )}
              </span>
            </li>
          )
        })}
      </ol>
    </section>
  )
}
