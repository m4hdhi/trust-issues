import { useState } from 'react'
import { BadgeCheck, Columns2, Skull } from 'lucide-react'
import { Section } from './Section'
import { Lightbox } from './Lightbox'
import { T, Tx } from '../../lib/lang'
import type { StringKey } from '../../lib/i18n'

interface Shot {
  src: string
  label: StringKey
  host: string
  tone: 'official' | 'fake'
}

export function RealVsFake({
  officialSrc,
  officialHost,
  fakeSrc,
  fakeHost,
  aspect,
}: {
  officialSrc: string
  officialHost: string
  fakeSrc: string
  fakeHost: string
  aspect: number
}) {
  const [open, setOpen] = useState<Shot | null>(null)
  const shots: Shot[] = [
    { src: officialSrc, label: 'official', host: officialHost, tone: 'official' },
    { src: fakeSrc, label: 'fake', host: fakeHost, tone: 'fake' },
  ]
  const ratio = Math.min(Math.max(aspect, 0.45), 1.6)
  return (
    <Section icon={Columns2} title="realVsFake">
      <div className="grid grid-cols-2 gap-3 sm:gap-5">
        {shots.map((s) => {
          const official = s.tone === 'official'
          return (
            <figure key={s.tone} className="min-w-0">
              <button
                type="button"
                onClick={() => setOpen(s)}
                className={`group relative block w-full overflow-hidden rounded-2xl border-2 bg-white ${official ? 'border-seal/70' : 'border-scam/80'}`}
                style={{ aspectRatio: `${ratio}` }}
              >
                <img src={s.src} alt="" loading="lazy" className="absolute inset-0 h-full w-full object-cover object-top transition-transform duration-500 group-hover:scale-[1.03]" />
                <span
                  className={`absolute start-2 top-2 inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-bold text-white shadow-lg ${official ? 'bg-[#8a6d2f]' : 'bg-scam'}`}
                >
                  {official ? <BadgeCheck className="size-3.5" aria-hidden="true" /> : <Skull className="size-3.5" aria-hidden="true" />}
                  <T k={s.label} arClassName="opacity-90" />
                </span>
              </button>
              <figcaption className={`mt-2 truncate text-center font-mono text-xs ${official ? 'text-seal' : 'text-scam'}`} dir="ltr">
                {s.host}
              </figcaption>
            </figure>
          )
        })}
      </div>
      <Tx k="tapToEnlarge" className="mt-3 text-center text-xs text-mist-500" split="stack" />
      <Lightbox src={open?.src ?? null} title={open ? <T k={open.label} /> : null} onClose={() => setOpen(null)} />
    </Section>
  )
}
