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
    <Reveal as="section" className="exhibit grid-12 mt-4 gap-y-6 rounded-[2rem] bg-ink-850 p-5 sm:p-8 lg:p-10">
      <header className="col-span-4 sm:col-span-8 lg:col-span-4 lg:pe-8">
        <span className={`display num grid size-9 place-items-center rounded-full text-sm text-white ${tone === 'danger' ? 'bg-scam' : 'bg-gold'}`}>{index}</span>
        <Tx k={title} text={titleText} as="h2" className="display mt-4 text-2xl text-paper sm:text-3xl" arClassName="text-xl text-paper-2" split="stack" />
        {(sub || subText) && <Tx k={sub} text={subText} className="mt-4 max-w-[48ch] text-base text-paper-2" split="stack" />}
      </header>
      <div className="col-span-4 min-w-0 sm:col-span-8 lg:col-span-8">{children}</div>
    </Reveal>
  )
}
