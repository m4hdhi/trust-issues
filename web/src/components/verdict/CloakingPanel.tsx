import { useState } from 'react'
import { ImageOff } from 'lucide-react'
import { Lightbox } from './Lightbox'
import { T, Tx } from '../../lib/lang'
import type { StringKey } from '../../lib/i18n'
import type { Cloaking } from '../../lib/types'

const PERSONA_KEYS: Record<string, StringKey> = {
  uae_mobile: 'persona_uae_mobile',
  mobile: 'persona_uae_mobile',
  desktop: 'persona_desktop',
  googlebot: 'persona_googlebot',
  bot: 'persona_googlebot',
}

export function CloakingPanel({ cloaking }: { cloaking: Cloaking }) {
  const [open, setOpen] = useState<{ src: string; name: string } | null>(null)
  const openKey = open ? PERSONA_KEYS[open.name] : undefined
  return (
    <div>
      {cloaking.reason && <Tx text={cloaking.reason} className="mb-8 max-w-[62ch] text-lg text-paper" split="stack" />}
      <div className="grid grid-cols-3 gap-4">
        {cloaking.personas.map((p, i) => {
          const key = PERSONA_KEYS[p.name]
          const victim = i === 0
          return (
            <figure key={p.name} className="min-w-0">
              <button
                type="button"
                disabled={!p.screenshot_url}
                onClick={() => p.screenshot_url && setOpen({ src: p.screenshot_url, name: p.name })}
                className={`press relative block aspect-[3/4] w-full overflow-hidden rounded-lg border bg-sheet ${victim ? 'border-scam' : 'border-line'}`}
              >
                {p.screenshot_url ? (
                  <img src={p.screenshot_url} alt="" loading="lazy" className="absolute inset-0 h-full w-full object-cover object-top" />
                ) : (
                  <span className="absolute inset-0 grid place-items-center bg-ink-800 text-paper-3">
                    <ImageOff className="size-5" aria-hidden="true" />
                  </span>
                )}
              </button>
              <figcaption className="mt-2 text-sm text-paper">
                {key ? <T k={key} /> : p.name}
                <span className="evidence mt-1 block truncate text-xs text-paper-3">
                  {p.status ?? 'n/a'} {p.title ? `· ${p.title}` : ''}
                </span>
              </figcaption>
            </figure>
          )
        })}
      </div>
      <Lightbox src={open?.src ?? null} title={openKey ? <T k={openKey} /> : open?.name} onClose={() => setOpen(null)} />
    </div>
  )
}
