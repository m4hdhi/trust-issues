import { useState } from 'react'
import { EyeOff, ImageOff } from 'lucide-react'
import { Section } from './Section'
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
    <Section icon={EyeOff} title="cloakingTitle" tone="danger">
      {cloaking.reason && <Tx text={cloaking.reason} className="mb-4 text-sm leading-relaxed text-mist-200" split="stack" />}
      <div className="grid grid-cols-3 gap-2.5 sm:gap-4">
        {cloaking.personas.map((p, i) => {
          const key = PERSONA_KEYS[p.name]
          const victim = i === 0
          return (
            <figure key={p.name} className="min-w-0">
              <button
                type="button"
                disabled={!p.screenshot_url}
                onClick={() => p.screenshot_url && setOpen({ src: p.screenshot_url, name: p.name })}
                className={`relative block aspect-[3/4] w-full overflow-hidden rounded-xl border-2 bg-white ${victim ? 'border-scam/80' : 'border-ink-500'}`}
              >
                {p.screenshot_url ? (
                  <img src={p.screenshot_url} alt="" loading="lazy" className="absolute inset-0 h-full w-full object-cover object-top" />
                ) : (
                  <span className="absolute inset-0 grid place-items-center bg-ink-800 text-mist-500">
                    <ImageOff className="size-5" aria-hidden="true" />
                  </span>
                )}
                {p.status != null && (
                  <span
                    className={`num absolute end-1.5 bottom-1.5 rounded-md px-1.5 py-0.5 font-mono text-[10px] font-bold text-white ${p.status >= 400 ? 'bg-ink-700' : victim ? 'bg-scam' : 'bg-ink-700'}`}
                  >
                    {p.status}
                  </span>
                )}
              </button>
              <figcaption className="mt-2 text-center text-xs leading-tight font-semibold text-mist-200">
                {key ? <T k={key} stacked /> : p.name}
                {p.title && (
                  <span className="mt-0.5 block truncate font-normal text-mist-500" dir="auto">
                    {p.title}
                  </span>
                )}
              </figcaption>
            </figure>
          )
        })}
      </div>
      <Lightbox
        src={open?.src ?? null}
        title={openKey ? <T k={openKey} /> : open?.name}
        onClose={() => setOpen(null)}
      />
    </Section>
  )
}
