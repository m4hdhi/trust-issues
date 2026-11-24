import type { ReactNode } from 'react'
import { Reveal } from '../motion'
import { Tx } from '../../lib/lang'
import type { StringKey } from '../../lib/i18n'
import type { Bilingual } from '../../lib/types'

interface ExhibitProps {
  index: number
  title?: StringKey
  titleText?: Bilingual
  sub?: StringKey
  subText?: Bilingual
  tone?: 'default' | 'danger'
  children: ReactNode
}

export function Exhibit({ index, title, titleText, sub, subText, tone = 'default', children }: ExhibitProps) {
  return (
    <Reveal as="section" className="grid-12 gap-y-8 border-t border-line py-8 lg:py-10">
      <header className="col-span-4 sm:col-span-8 lg:col-span-4 lg:pe-8">
        <span className={`evidence text-sm ${tone === 'danger' ? 'text-scam' : 'text-gold'}`}>{String(index).padStart(2, '0')}</span>
        <Tx k={title} text={titleText} as="h2" className="display mt-2 text-2xl text-paper" arClassName="text-xl text-paper-2" split="stack" />
        {(sub || subText) && <Tx k={sub} text={subText} className="mt-4 max-w-[48ch] text-base text-paper-2" split="stack" />}
      </header>
      <div className="col-span-4 min-w-0 sm:col-span-8 lg:col-span-8">{children}</div>
    </Reveal>
  )
}
