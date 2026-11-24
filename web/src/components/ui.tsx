import type { ReactNode } from 'react'
import { Tx } from '../lib/lang'
import type { StringKey } from '../lib/i18n'
import type { Bilingual } from '../lib/types'

export const btn = {
  primary:
    'press inline-flex h-12 items-center justify-center gap-2 rounded-full bg-linear-to-r from-[#5a48f2] to-[#8a4df0] px-6 text-base font-semibold text-white shadow-[0_10px_24px_-10px_rgb(90_72_242/0.7)] transition-[filter] hover:brightness-110 disabled:opacity-50',
  secondary:
    'press inline-flex h-12 items-center justify-center gap-2 rounded-full bg-ink-800 px-5 text-base font-semibold text-paper transition-colors hover:bg-ink-700 disabled:opacity-50',
  quiet:
    'press inline-flex h-10 items-center justify-center gap-2 rounded-full px-3 text-sm font-semibold text-paper-2 transition-colors hover:bg-ink-800 hover:text-paper disabled:opacity-50',
  ghost:
    'press inline-flex h-12 items-center justify-center gap-2 rounded-full px-4 text-base font-semibold text-paper-2 transition-colors hover:bg-ink-800 hover:text-paper',
  danger:
    'press inline-flex h-12 items-center justify-center gap-2 rounded-full bg-linear-to-r from-[#e2434b] to-[#f0624a] px-6 text-base font-semibold text-white shadow-[0_10px_24px_-10px_rgb(226_67_75/0.7)] transition-[filter] hover:brightness-110 disabled:opacity-50',
  small:
    'press inline-flex h-8 items-center justify-center gap-2 rounded-full bg-ink-800 px-3 text-sm font-semibold text-paper transition-colors hover:bg-ink-700 disabled:opacity-50',
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
