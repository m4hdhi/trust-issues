import { useId } from 'react'
import { motion } from 'motion/react'
import { useLang, type LangMode } from '../lib/lang'
import { T_LAYOUT } from '../lib/motion'

const OPTIONS: { mode: LangMode; label: string; title: string }[] = [
  { mode: 'en', label: 'EN', title: 'English' },
  { mode: 'ar', label: 'عربي', title: 'العربية' },
]

export function LangToggle() {
  const { mode, setMode, t } = useLang()
  const id = useId()
  return (
    <div role="radiogroup" aria-label={t('language')} className="inline-flex h-10 items-center rounded-full bg-ink-800 p-1 text-sm font-semibold" dir="ltr">
      {OPTIONS.map((o) => {
        const active = o.mode === mode
        return (
          <button
            key={o.mode}
            type="button"
            role="radio"
            aria-checked={active}
            title={o.title}
            onClick={() => setMode(o.mode)}
            className={`press relative h-8 rounded-full px-3 transition-colors ${active ? 'text-ink-950' : 'text-paper-2 hover:text-paper'}`}
          >
            {active && <motion.span layoutId={`lang-${id}`} transition={T_LAYOUT} className="absolute inset-0 rounded-full bg-paper" />}
            <span className="relative" lang={o.mode === 'ar' ? 'ar' : undefined}>
              {o.label}
            </span>
          </button>
        )
      })}
    </div>
  )
}
