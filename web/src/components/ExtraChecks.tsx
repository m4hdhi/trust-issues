import { useRef, useState, type FormEvent } from 'react'
import { Link } from 'react-router'
import { ArrowRight, CircleAlert, CircleCheck, FileSearch, Flag, Info, Phone, ShieldAlert, Upload } from 'lucide-react'
import { BrandMark } from './BrandMark'
import { Spinner } from './States'
import { btn } from './ui'
import { T, Tx } from '../lib/lang'
import { ApiError, api } from '../lib/api'
import { defang } from '../lib/format'
import type { StringKey } from '../lib/i18n'
import type { CheckFinding, FileCheck as FileResult, PhoneCheck as PhoneResult } from '../lib/types'

const TONE = {
  danger: { box: 'bg-scam/10', text: 'text-scam', icon: ShieldAlert },
  warn: { box: 'bg-warn/10', text: 'text-warn', icon: CircleAlert },
  ok: { box: 'bg-safe/10', text: 'text-safe', icon: CircleCheck },
  info: { box: 'bg-ink-900', text: 'text-paper-2', icon: Info },
} as const

function Findings({ items }: { items: CheckFinding[] }) {
  return (
    <ul className="mt-4 space-y-2">
      {items.map((f, i) => {
        const t = TONE[f.level]
        return (
          <li key={i} className={`flex items-start gap-3 rounded-xl px-4 py-3 ${t.box}`}>
            <t.icon className={`mt-0.5 size-5 shrink-0 ${t.text}`} aria-hidden="true" />
            <Tx text={f} className="text-base font-medium text-paper" />
          </li>
        )
      })}
    </ul>
  )
}

function Verdict({ label, tone }: { label: StringKey; tone: keyof typeof TONE }) {
  const t = TONE[tone]
  return (
    <p className={`inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-sm font-bold ${t.box} ${t.text}`}>
      <t.icon className="size-4" aria-hidden="true" />
      <T k={label} />
    </p>
  )
}

const PHONE_TONE = { official: 'ok', scam: 'danger', suspicious: 'warn', unknown: 'info' } as const

export function PhoneCheck() {
  const [value, setValue] = useState('')
  const [busy, setBusy] = useState(false)
  const [bad, setBad] = useState(false)
  const [result, setResult] = useState<PhoneResult | null>(null)
  const [reported, setReported] = useState(false)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (!value.trim()) return setBad(true)
    setBusy(true)
    setBad(false)
    setReported(false)
    try {
      setResult(await api.checkPhone(value.trim()))
    } catch {
      setResult(null)
      setBad(true)
    } finally {
      setBusy(false)
    }
  }

  const report = async () => {
    if (!result) return
    setBusy(true)
    try {
      setResult(await api.reportPhone(result.key))
      setReported(true)
    } catch {
      setBad(true)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div>
      <form onSubmit={(e) => void submit(e)} className="rounded-2xl bg-ink-800 p-2 transition-shadow focus-within:shadow-[inset_0_0_0_1px_var(--color-gold)]">
        <label className="flex items-center gap-3 px-4 pt-4 pb-3">
          <Phone className="size-6 shrink-0 text-gold" aria-hidden="true" />
          <span className="sr-only">
            <T k="phoneLabel" />
          </span>
          <PhoneInput value={value} onChange={setValue} />
        </label>
        <div className="flex flex-col gap-2 border-t border-line p-2 sm:flex-row sm:items-center sm:justify-between">
          <Tx k="phoneHint" className="px-2 text-sm text-paper-3" />
          <button type="submit" disabled={busy} className={`${btn.primary} w-full shrink-0 sm:w-auto`}>
            {busy && <Spinner />}
            <T k={busy ? 'checking' : 'check'} />
            {!busy && <ArrowRight className="size-4 rtl:rotate-180" aria-hidden="true" />}
          </button>
        </div>
      </form>
      {bad && <Tx k="phoneBad" className="mt-4 text-sm text-warn" />}
      {result && (
        <section className="mt-4 rounded-2xl bg-ink-850 p-5 sm:p-6" aria-live="polite">
          <Verdict label={`pv_${result.verdict}`} tone={PHONE_TONE[result.verdict]} />
          <div className="mt-4 flex items-center gap-4">
            {result.brand && <BrandMark brand={result.brand} className="size-12" />}
            <div className="min-w-0">
              <p className="display num text-2xl text-paper sm:text-3xl" dir="ltr">
                {result.number}
              </p>
              <p className="mt-1 flex flex-wrap gap-x-3 text-sm text-paper-2">
                {result.brand && <T text={{ en: result.brand.name_en, ar: result.brand.name_ar }} />}
                {result.line_type && <T text={result.line_type} />}
                {result.carrier && <span>{result.carrier}</span>}
                {result.country && <span>{result.country}</span>}
                {result.reports > 0 && (
                  <span className="text-scam">
                    <span className="num">{result.reports}</span> <T k="phoneReports" />
                  </span>
                )}
              </p>
            </div>
          </div>
          <Findings items={result.findings} />
          <div className="mt-5 flex flex-wrap gap-2">
            {result.verdict === 'official' ? (
              <a href={`tel:${result.key}`} className={btn.secondary}>
                <Phone className="size-4" aria-hidden="true" />
                <T k="phoneCallOfficial" />
              </a>
            ) : reported ? (
              <Tx k="phoneReported" className="text-sm text-safe" />
            ) : (
              result.valid && (
                <button type="button" onClick={() => void report()} disabled={busy} className={btn.danger}>
                  <Flag className="size-4" aria-hidden="true" />
                  <T k="phoneReport" />
                </button>
              )
            )}
          </div>
        </section>
      )}
    </div>
  )
}

function PhoneInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <input
      type="tel"
      inputMode="tel"
      autoComplete="off"
      dir="ltr"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder="050 123 4567"
      maxLength={40}
      className="h-12 w-full bg-transparent text-2xl font-semibold text-paper placeholder:text-paper-3 focus:outline-none"
    />
  )
}

const FILE_TONE = { scam: 'danger', suspicious: 'warn', partial: 'info', clear: 'ok' } as const

function size(n: number): string {
  return n >= 1_048_576 ? `${(n / 1_048_576).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`
}

export function FileCheck() {
  const input = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<StringKey | null>(null)
  const [result, setResult] = useState<FileResult | null>(null)
  const [over, setOver] = useState(false)

  const check = async (file: File | undefined | null) => {
    if (!file) return
    setError(null)
    setResult(null)
    if (file.size > 10 * 1024 * 1024) return setError('fileTooBig')
    setBusy(true)
    try {
      setResult(await api.checkFile(file))
    } catch (e) {
      setError(e instanceof ApiError && e.status === 413 ? 'fileTooBig' : 'famFailed')
    } finally {
      setBusy(false)
      if (input.current) input.current.value = ''
    }
  }

  return (
    <div>
      <label
        onDragOver={(e) => {
          e.preventDefault()
          setOver(true)
        }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => {
          e.preventDefault()
          setOver(false)
          void check(e.dataTransfer.files[0])
        }}
        className={`flex cursor-pointer flex-col items-center gap-3 rounded-2xl border-2 border-dashed px-6 py-8 text-center transition-colors ${over ? 'border-gold bg-gold/10' : 'border-line-strong bg-ink-800'}`}
      >
        {busy ? <Spinner /> : <FileSearch className="size-10 text-gold" strokeWidth={1.6} aria-hidden="true" />}
        <span className="display text-xl text-paper">
          <T k={busy ? 'fileChecking' : 'fileDrop'} />
        </span>
        <Tx k="fileHint" className="max-w-[46ch] text-sm text-paper-3" />
        <span className={`${btn.primary} mt-1 ${busy ? 'pointer-events-none opacity-50' : ''}`}>
          <Upload className="size-4" aria-hidden="true" />
          <T k={result ? 'fileAnother' : 'fileChoose'} />
        </span>
        <input ref={input} type="file" className="sr-only" disabled={busy} onChange={(e) => void check(e.target.files?.[0])} />
      </label>
      {error && <Tx k={error} className="mt-4 text-sm text-warn" />}
      {result && (
        <section className="mt-4 rounded-2xl bg-ink-850 p-5 sm:p-6" aria-live="polite">
          <Verdict label={`fv_${result.verdict}`} tone={FILE_TONE[result.verdict]} />
          <p className="display mt-4 text-xl break-all text-paper" dir="ltr">
            {result.name}
          </p>
          <p className="mt-1 flex flex-wrap gap-x-3 text-sm text-paper-2">
            <T text={result.kind} />
            <span className="num">{size(result.size)}</span>
          </p>
          <Findings items={result.findings} />
          {result.links.length > 0 && (
            <div className="mt-5 border-t border-line pt-4">
              <p className="text-sm text-paper-2">
                <T k="fileLinks" />
              </p>
              <ul className="mt-2 space-y-2">
                {result.links.map((l) => (
                  <li key={l.scan_id}>
                    <Link to={`/scan/${encodeURIComponent(l.scan_id)}`} className="group flex items-center justify-between gap-3 rounded-xl bg-ink-900 px-4 py-3 hover:bg-ink-800">
                      <span className="evidence min-w-0 truncate text-sm text-paper" dir="ltr">
                        {defang(l.url)}
                      </span>
                      <span className="inline-flex shrink-0 items-center gap-1 text-sm text-gold">
                        <T k="fileSeeCheck" />
                        <ArrowRight className="size-4 rtl:rotate-180" aria-hidden="true" />
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>
      )}
    </div>
  )
}
