import { AnimatePresence, motion } from 'motion/react'
import { Check, Minus, X } from 'lucide-react'
import { T } from '../../lib/lang'
import { caseNumber, ms } from '../../lib/format'
import { EASE_OUT, T_LAYOUT, T_STAMP } from '../../lib/motion'
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

function StatusMark({ status }: { status: StageState['status'] }) {
  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.span
        key={status}
        className="grid size-6 place-items-center"
        initial={{ scale: 0.6, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={status === 'done' ? T_STAMP : { duration: 0.15 }}
      >
        {status === 'running' ? (
          <span className="relative flex size-2">
            <span className="absolute inset-0 animate-ping-soft rounded-full bg-gold" />
            <span className="relative size-2 rounded-full bg-gold" />
          </span>
        ) : status === 'done' ? (
          <Check className="size-4 text-safe" strokeWidth={2.5} />
        ) : status === 'skipped' ? (
          <Minus className="size-4 text-paper-3" />
        ) : status === 'error' ? (
          <X className="size-4 text-warn" />
        ) : (
          <span className="size-1 rounded-full bg-line-strong" />
        )}
      </motion.span>
    </AnimatePresence>
  )
}

export function Pipeline({ id, host, stages, order, elapsed }: { id: string; host: string; stages: Record<string, StageState>; order: string[]; elapsed: number }) {
  const finished = order.filter((s) => ['done', 'skipped', 'error'].includes(stages[s]?.status ?? '')).length
  const progress = order.length ? finished / order.length : 0

  return (
    <motion.div layoutId="case-file" transition={T_LAYOUT} className="mx-auto max-w-3xl">
      <div className="inline-flex h-9 items-center gap-2 rounded-t-lg bg-ink-800 px-4 text-sm text-paper-2">
        <span className="size-1.5 rounded-full bg-gold" aria-hidden="true" />
        <T k="caseFile" />
        <span className="evidence text-paper">{caseNumber(id)}</span>
      </div>
      <div className="rounded-b-xl rounded-se-xl bg-ink-800">
        <div className="px-6 pt-6 pb-6 sm:px-8 sm:pt-8">
          <p className="text-sm text-paper-3">
            <T k="investigating" />
          </p>
          <p className="evidence mt-2 break-all text-2xl text-paper sm:text-3xl">{host || '…'}</p>
          <div className="mt-6 flex items-center gap-4">
            <div className="h-1 flex-1 overflow-hidden rounded-full bg-ink-700">
              <motion.div
                className="h-full origin-left rounded-full bg-gold"
                initial={{ scaleX: 0.04 }}
                animate={{ scaleX: Math.max(0.04, progress) }}
                transition={{ duration: 0.4, ease: EASE_OUT }}
              />
            </div>
            <span className="evidence num w-16 text-end text-sm text-paper-2">{(elapsed / 1000).toFixed(1)}s</span>
          </div>
        </div>
        <ol className="border-t border-line">
          {order.map((sid, i) => {
            const st = stages[sid] ?? { status: 'pending' as const }
            const known = (STAGES as string[]).includes(sid)
            const active = st.status === 'running'
            const pending = st.status === 'pending'
            return (
              <li key={sid} className="relative overflow-hidden border-b border-line last:border-b-0">
                {active && (
                  <span className="absolute inset-x-0 bottom-0 h-px overflow-hidden" aria-hidden="true">
                    <span className="block h-px w-1/3 animate-scan-line bg-gold" />
                  </span>
                )}
                <div
                  className={`grid grid-cols-[32px_1fr_auto_24px] items-center gap-x-4 px-6 py-3 transition-opacity duration-300 sm:px-8 ${pending ? 'opacity-40' : 'opacity-100'}`}
                >
                  <span className="evidence num text-xs text-paper-3">{String(i + 1).padStart(2, '0')}</span>
                  <span className="min-w-0">
                    <span className={`block text-base ${active ? 'text-gold' : 'text-paper'}`}>
                      {known ? <T k={`st_${sid}` as StringKey} arClassName="text-paper-3" /> : <T text={st.label ?? { en: sid, ar: sid }} />}
                    </span>
                    {st.detail ? (
                      <span className="evidence block truncate text-xs text-paper-3">{st.detail}</span>
                    ) : (
                      known && (
                        <span className="block truncate text-xs text-paper-3">
                          <T k={`st_${sid}_d` as StringKey} />
                        </span>
                      )
                    )}
                  </span>
                  <span className="evidence num text-xs text-paper-3">
                    {st.status === 'skipped' ? <T k="stageSkipped" /> : st.status === 'error' ? <T k="stageError" /> : st.ms != null ? ms(st.ms) : ''}
                  </span>
                  <StatusMark status={st.status} />
                </div>
              </li>
            )
          })}
        </ol>
      </div>
    </motion.div>
  )
}
