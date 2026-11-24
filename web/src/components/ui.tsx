import type { ReactNode } from 'react'
import { Tx } from '../lib/lang'
import type { StringKey } from '../lib/i18n'
import type { Bilingual } from '../lib/types'

export const btn = {
  primary:
    'press inline-flex h-12 items-center justify-center gap-2 rounded-lg bg-gold px-6 text-base font-medium text-ink-950 transition-colors hover:bg-[#d4ae66] disabled:opacity-50',
  secondary:
    'press inline-flex h-12 items-center justify-center gap-2 rounded-lg bg-ink-800 px-4 text-base font-medium text-paper transition-colors hover:bg-ink-700 disabled:opacity-50',
  quiet:
    'press inline-flex h-10 items-center justify-center gap-2 rounded-lg px-3 text-sm font-medium text-paper-2 transition-colors hover:bg-ink-800 hover:text-paper disabled:opacity-50',
  ghost:
    'press inline-flex h-12 items-center justify-center gap-2 rounded-lg px-4 text-base font-medium text-paper-2 transition-colors hover:bg-ink-800 hover:text-paper',
  danger:
    'press inline-flex h-12 items-center justify-center gap-2 rounded-lg bg-scam px-6 text-base font-medium text-ink-950 transition-colors hover:bg-[#ec6a63] disabled:opacity-50',
  small:
    'press inline-flex h-8 items-center justify-center gap-2 rounded-md bg-ink-800 px-3 text-sm font-medium text-paper transition-colors hover:bg-ink-700 disabled:opacity-50',
}

export function SectionHead({
  index,
  title,
  titleText,
  sub,
  aside,
  className = '',
}: {
  index?: number
  title?: StringKey
  titleText?: Bilingual
  sub?: StringKey
  aside?: ReactNode
  className?: string
}) {
  return (
    <header className={`flex flex-wrap items-end justify-between gap-x-8 gap-y-4 ${className}`}>
      <div className="flex min-w-0 items-baseline gap-4">
        {index != null && <span className="evidence shrink-0 text-sm text-gold">{String(index).padStart(2, '0')}</span>}
        <div className="min-w-0">
          <Tx k={title} text={titleText} as="h2" className="display text-2xl text-paper sm:text-3xl" arClassName="text-xl text-paper-2 sm:text-2xl" split="stack" />
          {sub && <Tx k={sub} className="mt-2 max-w-[60ch] text-base text-paper-2" split="stack" />}
        </div>
      </div>
      {aside}
    </header>
  )
}
