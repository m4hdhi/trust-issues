import { lazy, Suspense, useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { ArrowRight, ClipboardPaste, QrCode, X } from 'lucide-react'
import { Spinner } from './States'
import { T, Tx, useLang } from '../lib/lang'
import { S } from '../lib/i18n'
import { useStartScan } from '../lib/useStartScan'

const QrScanner = lazy(() => import('./QrScanner').then((m) => ({ default: m.QrScanner })))

export function Composer({ initial = '' }: { initial?: string }) {
  const { mode, t, pick } = useLang()
  const [value, setValue] = useState(initial)
  const [hint, setHint] = useState<'clipboardDenied' | 'emptyInput' | null>(null)
  const [qrOpen, setQrOpen] = useState(false)
  const area = useRef<HTMLTextAreaElement>(null)
  const { start, busy, failed } = useStartScan()

  const fit = useCallback(() => {
    const el = area.current
    if (!el) return
    el.style.height = 'auto'
    if (el.value) el.style.height = `${Math.min(el.scrollHeight, 320)}px`
  }, [])

  useLayoutEffect(fit, [value, fit])

  useEffect(() => {
    window.addEventListener('resize', fit)
    void document.fonts?.ready.then(fit)
    return () => window.removeEventListener('resize', fit)
  }, [fit])

  const submit = async (text = value, source: 'web' | 'qr' = 'web') => {
    if (!text.trim()) {
      setHint('emptyInput')
      area.current?.focus()
      return
    }
    setHint(null)
    await start(text, source)
  }

  const paste = async () => {
    try {
      const text = await navigator.clipboard.readText()
      if (text) {
        setValue(text)
        setHint(null)
        area.current?.focus()
      }
    } catch {
      setHint('clipboardDenied')
      area.current?.focus()
    }
  }

  const placeholder =
    mode === 'both' ? `${S.inputPlaceholder.en}\n${S.inputPlaceholder.ar}` : t('inputPlaceholder')

  return (
    <div>
      <form
        onSubmit={(e) => {
          e.preventDefault()
          void submit()
        }}
        className="relative rounded-[28px] border border-ink-600 bg-ink-800/90 shadow-[0_30px_80px_-30px_rgba(20,184,166,0.35)] backdrop-blur transition-colors focus-within:border-brand/70"
      >
        <label htmlFor="scan-input" className="sr-only">
          {t('inputLabel')}
        </label>
        <textarea
          id="scan-input"
          ref={area}
          rows={3}
          value={value}
          dir="auto"
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
          spellCheck={false}
          placeholder={placeholder}
          onChange={(e) => {
            setValue(e.target.value)
            if (hint === 'emptyInput') setHint(null)
          }}
          onKeyDown={(e) => {
            if (e.key !== 'Enter' || e.shiftKey) return
            if (e.metaKey || e.ctrlKey || !/\s/.test(value.trim())) {
              e.preventDefault()
              void submit()
            }
          }}
          className="block w-full resize-none bg-transparent px-5 pt-5 pb-2 text-[17px] lg:min-h-[150px] leading-relaxed text-paper placeholder:text-mist-500 focus:outline-none"
        />
        {value && (
          <button
            type="button"
            onClick={() => {
              setValue('')
              area.current?.focus()
            }}
            aria-label={t('clear')}
            className="absolute end-3 top-3 grid size-8 place-items-center rounded-full text-mist-500 hover:bg-ink-700 hover:text-paper"
          >
            <X className="size-4" />
          </button>
        )}
        <div className="flex flex-col gap-3 px-3 pb-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => void paste()}
              className="inline-flex flex-1 items-center justify-center gap-2 rounded-2xl border border-ink-600 px-3.5 py-2.5 text-sm font-medium text-mist-200 hover:border-ink-500 hover:bg-ink-700 sm:flex-none"
            >
              <ClipboardPaste className="size-4 shrink-0" aria-hidden="true" />
              <T k="paste" />
            </button>
            <button
              type="button"
              onClick={() => setQrOpen(true)}
              className="inline-flex flex-1 items-center justify-center gap-2 rounded-2xl border border-ink-600 px-3.5 py-2.5 text-sm font-medium text-mist-200 hover:border-ink-500 hover:bg-ink-700 sm:flex-none"
            >
              <QrCode className="size-4 shrink-0" aria-hidden="true" />
              <T k="scanQr" />
            </button>
          </div>
          <button
            type="submit"
            disabled={busy}
            className="group inline-flex h-14 items-center justify-center gap-3 rounded-2xl bg-brand px-7 text-[17px] font-bold text-ink-950 shadow-[0_10px_30px_-10px_rgba(20,184,166,0.8)] transition-[transform,background-color] hover:bg-brand-bright active:scale-[0.98] disabled:opacity-70 sm:h-12"
          >
            {busy ? <Spinner /> : null}
            <T k={busy ? 'checking' : 'check'} arClassName="opacity-80" />
            {!busy && <ArrowRight className="size-5 transition-transform group-hover:translate-x-0.5 rtl:rotate-180" aria-hidden="true" />}
          </button>
        </div>
      </form>

      <div className="mt-3 min-h-6 px-1 text-sm">
        {hint && <Tx k={hint} className="text-warn" split="stack" />}
        {!hint && failed && <Tx k={failed} className="text-scam" split="stack" />}
        {!hint && !failed && (
          <button
            type="button"
            onClick={() => {
              setValue(pick(S.exampleSms))
              area.current?.focus()
            }}
            className="text-mist-400 underline decoration-ink-500 underline-offset-4 hover:text-paper hover:decoration-brand"
          >
            <T k="tryExample" />
          </button>
        )}
      </div>

      {qrOpen && (
        <Suspense fallback={null}>
          <QrScanner
            open={qrOpen}
            onClose={() => setQrOpen(false)}
            onResult={(text) => {
              setQrOpen(false)
              setValue(text)
              void submit(text, 'qr')
            }}
          />
        </Suspense>
      )}
    </div>
  )
}
