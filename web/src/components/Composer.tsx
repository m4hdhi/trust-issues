import { lazy, Suspense, useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { ArrowRight, ClipboardPaste, QrCode, X } from 'lucide-react'
import { Spinner } from './States'
import { btn } from './ui'
import { T, Tx, useLang } from '../lib/lang'
import { S } from '../lib/i18n'
import { T_ENTER, T_LAYOUT } from '../lib/motion'
import { useStartScan } from '../lib/useStartScan'

const QrScanner = lazy(() => import('./QrScanner').then((m) => ({ default: m.QrScanner })))

export function Composer({ initial = '', openQr = false }: { initial?: string; openQr?: boolean }) {
  const { mode, t, pick } = useLang()
  const [value, setValue] = useState(initial)
  const [hint, setHint] = useState<'clipboardDenied' | 'emptyInput' | null>(null)
  const [qrOpen, setQrOpen] = useState(openQr)
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

  const placeholder = mode === 'both' ? `${S.inputPlaceholder.en}\n${S.inputPlaceholder.ar}` : t('inputPlaceholder')
  const message = hint ?? failed

  return (
    <div>
      <motion.div layoutId="case-file" transition={T_LAYOUT} className="relative">
        <div className="inline-flex h-9 items-center gap-2 rounded-t-lg bg-ink-800 px-4 text-sm text-paper-2">
          <span className="size-1.5 rounded-full bg-gold" aria-hidden="true" />
          <T k="newCase" />
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault()
            void submit()
          }}
          className="relative rounded-b-xl rounded-se-xl bg-ink-800 transition-shadow focus-within:shadow-[inset_0_0_0_1px_var(--color-gold)]"
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
            className="block w-full resize-none bg-transparent px-6 pt-6 pb-4 text-lg text-paper placeholder:text-paper-3 focus:outline-none lg:min-h-[152px]"
          />
          <AnimatePresence>
            {value && (
              <motion.button
                type="button"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                transition={{ duration: 0.15 }}
                onClick={() => {
                  setValue('')
                  area.current?.focus()
                }}
                aria-label={t('clear')}
                className="press absolute end-4 top-4 grid size-8 place-items-center rounded-md text-paper-3 hover:bg-ink-700 hover:text-paper"
              >
                <X className="size-4" />
              </motion.button>
            )}
          </AnimatePresence>
          <div className="flex flex-col gap-2 border-t border-line p-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="grid grid-cols-2 gap-2 sm:flex">
              <button type="button" onClick={() => void paste()} className={btn.quiet}>
                <ClipboardPaste className="size-4 shrink-0" aria-hidden="true" />
                <T k="paste" />
              </button>
              <button type="button" onClick={() => setQrOpen(true)} className={btn.quiet}>
                <QrCode className="size-4 shrink-0" aria-hidden="true" />
                <T k="scanQr" />
              </button>
            </div>
            <button type="submit" disabled={busy} className={`${btn.primary} group w-full sm:w-auto`}>
              {busy && <Spinner />}
              <T k={busy ? 'checking' : 'check'} />
              {!busy && <ArrowRight className="size-4 transition-transform duration-200 group-hover:translate-x-0.5 rtl:rotate-180" aria-hidden="true" />}
            </button>
          </div>
        </form>
      </motion.div>

      <div className="mt-4 min-h-6 text-sm">
        <AnimatePresence mode="wait" initial={false}>
          {message ? (
            <motion.div key={message} initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={T_ENTER}>
              <Tx k={message} className={hint ? 'text-warn' : 'text-scam'} split="stack" />
            </motion.div>
          ) : (
            <motion.button
              key="example"
              type="button"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => {
                setValue(pick(S.exampleSms))
                area.current?.focus()
              }}
              className="text-paper-3 underline decoration-line-strong underline-offset-4 transition-colors hover:text-paper hover:decoration-gold"
            >
              <T k="tryExample" />
            </motion.button>
          )}
        </AnimatePresence>
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
