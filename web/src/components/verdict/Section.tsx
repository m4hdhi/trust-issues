import type { ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'
import { T, Tx } from '../../lib/lang'
import type { StringKey } from '../../lib/i18n'
import type { Bilingual } from '../../lib/types'

interface SectionProps {
  icon: LucideIcon
  title?: StringKey
  titleText?: Bilingual
  sub?: StringKey
  children: ReactNode
  tone?: 'default' | 'danger' | 'plain'
  className?: string
  aside?: ReactNode
}

export function Section({ icon: Icon, title, titleText, sub, children, tone = 'default', className = '', aside }: SectionProps) {
  const frame =
    tone === 'danger'
      ? 'border-scam/40 bg-[linear-gradient(180deg,rgba(239,68,68,0.10),rgba(17,26,46,0.9)_45%)]'
      : tone === 'plain'
        ? 'border-transparent bg-transparent px-0 sm:px-0'
        : 'border-ink-700 bg-ink-800/70'
  return (
    <section className={`rounded-3xl border p-5 sm:p-6 ${frame} ${className}`}>
      <header className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <span
            className={`grid size-9 shrink-0 place-items-center rounded-xl ${tone === 'danger' ? 'bg-scam/15 text-scam' : 'bg-ink-700 text-mist-200'}`}
          >
            <Icon className="size-[18px]" aria-hidden="true" />
          </span>
          <div className="min-w-0 pt-1">
            <h2 className="text-[17px] font-bold leading-snug text-paper">
              <T k={title} text={titleText} arClassName="font-semibold text-mist-300" />
            </h2>
            {sub && <Tx k={sub} className="mt-1 text-sm leading-relaxed text-mist-400" split="stack" />}
          </div>
        </div>
        {aside}
      </header>
      {children}
    </section>
  )
}
