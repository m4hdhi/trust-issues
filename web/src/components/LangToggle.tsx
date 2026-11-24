import { useLang, type LangMode } from '../lib/lang'

const OPTIONS: { mode: LangMode; label: string; title: string }[] = [
  { mode: 'en', label: 'EN', title: 'English' },
  { mode: 'ar', label: 'ع', title: 'العربية' },
  { mode: 'both', label: 'EN+ع', title: 'English + العربية' },
]

export function LangToggle({ compact = false }: { compact?: boolean }) {
  const { mode, setMode, t } = useLang()
  return (
    <div
      role="radiogroup"
      aria-label={t('language')}
      className="inline-flex rounded-full border border-ink-600 bg-ink-850 p-0.5 text-[13px] font-semibold"
      dir="ltr"
    >
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
            className={`rounded-full transition-colors ${compact ? 'px-2.5 py-1' : 'px-3 py-1.5'} ${
              active ? 'bg-paper text-ink-900' : 'text-mist-400 hover:text-paper'
            }`}
          >
            <span lang={o.mode === 'ar' ? 'ar' : undefined}>{o.label}</span>
          </button>
        )
      })}
    </div>
  )
}
