import { useEffect, useRef, useState } from 'react'
import { CheckCircle2, Download, FileSpreadsheet, FileUp, RotateCcw, XCircle } from 'lucide-react'
import { PageHeader, Panel } from './ui'
import { VerdictChip } from '../components/VerdictChip'
import { Spinner } from '../components/States'
import { T, Tx } from '../lib/lang'
import { consoleApi } from '../lib/api'
import { num, pct } from '../lib/format'
import type { StringKey } from '../lib/i18n'
import type { BatchMetrics, BatchStatus, Verdict } from '../lib/types'

const SAMPLE = 'url,label\nhttps://adpolice-fines-pay.com/pay,scam\nhttps://www.emiratesnbd.com/en,safe\nhttps://salik-recharge-ae.com/topup,scam\nhttps://www.tamm.abudhabi/,safe\n'
const VERDICTS: Verdict[] = ['safe', 'suspicious', 'scam', 'unknown']

function sampleHref(): string {
  return `data:text/csv;charset=utf-8,${encodeURIComponent(SAMPLE)}`
}

function MetricTile({ k, value }: { k: StringKey; value: number | undefined }) {
  return (
    <div className="rounded-2xl border border-ink-700 bg-ink-900 p-4">
      <p className="text-xs font-medium text-mist-400">
        <T k={k} />
      </p>
      <p className="num mt-1 text-3xl font-extrabold tracking-tight text-paper">{pct(value, 1)}</p>
    </div>
  )
}

function Confusion({ m }: { m: BatchMetrics }) {
  const cell = (label: string, value: number, good: boolean) => (
    <div className={`rounded-xl p-4 text-center ${good ? 'bg-safe/15 text-safe' : 'bg-scam/15 text-scam'}`}>
      <p className="num text-2xl font-extrabold">{num(value)}</p>
      <p className="mt-0.5 font-mono text-[11px] font-semibold opacity-80">{label}</p>
    </div>
  )
  return (
    <div>
      <p className="mb-3 text-sm font-semibold text-paper">
        <T k="confusion" />
      </p>
      <div className="grid grid-cols-[auto_1fr_1fr] items-center gap-2 text-xs text-mist-400" dir="ltr">
        <span />
        <span className="text-center">
          <T k="predicted" /> scam
        </span>
        <span className="text-center">
          <T k="predicted" /> safe
        </span>
        <span className="pe-2 text-end">
          <T k="actual" /> scam
        </span>
        {cell('TP', m.tp, true)}
        {cell('FN', m.fn, false)}
        <span className="pe-2 text-end">
          <T k="actual" /> safe
        </span>
        {cell('FP', m.fp, false)}
        {cell('TN', m.tn, true)}
      </div>
    </div>
  )
}

function cellValue(v: unknown) {
  if (typeof v === 'string' && (VERDICTS as string[]).includes(v)) return <VerdictChip verdict={v as Verdict} />
  if (v == null || v === '') return <span className="text-mist-500">—</span>
  return String(v)
}

export function Batch() {
  const [drag, setDrag] = useState(false)
  const [file, setFile] = useState<File | null>(null)
  const [jobId, setJobId] = useState<string | null>(null)
  const [status, setStatus] = useState<BatchStatus | null>(null)
  const [uploading, setUploading] = useState(false)
  const [failed, setFailed] = useState(false)
  const input = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!jobId) return
    let alive = true
    let timer: ReturnType<typeof setTimeout>
    const tick = async () => {
      try {
        const s = await consoleApi.batchStatus(jobId)
        if (!alive) return
        setStatus(s)
        if (s.status === 'done' || s.status === 'error') return
      } catch {
        if (!alive) return
      }
      timer = setTimeout(tick, 1200)
    }
    void tick()
    return () => {
      alive = false
      clearTimeout(timer)
    }
  }, [jobId])

  const upload = async (f: File | undefined) => {
    if (!f) return
    setFile(f)
    setUploading(true)
    setFailed(false)
    setStatus(null)
    setJobId(null)
    try {
      setJobId(await consoleApi.batchUpload(f))
    } catch {
      setFailed(true)
    } finally {
      setUploading(false)
    }
  }

  const reset = () => {
    setFile(null)
    setJobId(null)
    setStatus(null)
    setFailed(false)
    if (input.current) input.current.value = ''
  }

  const done = status?.status === 'done'
  const progress = status && status.total ? status.done / status.total : 0
  const rows = status?.rows_preview ?? []
  const columns = rows.length ? Object.keys(rows[0]).filter((c) => c !== 'scan_id') : []

  return (
    <div>
      <PageHeader title="nav_batch" />
      {!jobId && !uploading ? (
        <Panel className="p-5 sm:p-8">
          <Tx k="batchTitle" as="h2" className="text-2xl font-extrabold tracking-tight text-paper sm:text-3xl" split="stack" />
          <Tx k="batchSub" className="mt-2 max-w-3xl text-[15px] leading-relaxed text-mist-300" split="stack" />
          <label
            onDragOver={(e) => {
              e.preventDefault()
              setDrag(true)
            }}
            onDragLeave={() => setDrag(false)}
            onDrop={(e) => {
              e.preventDefault()
              setDrag(false)
              void upload(e.dataTransfer.files[0])
            }}
            className={`mt-6 flex cursor-pointer flex-col items-center justify-center rounded-3xl border-2 border-dashed px-6 py-14 text-center transition-colors ${
              drag ? 'border-brand bg-brand/10' : 'border-ink-500 bg-ink-900 hover:border-brand/60'
            }`}
          >
            <FileUp className={`size-12 ${drag ? 'text-brand-bright' : 'text-mist-400'}`} aria-hidden="true" />
            <span className="mt-4 text-lg font-bold text-paper">
              <T k="dropHere" />
            </span>
            <span className="mt-1 text-sm font-semibold text-brand-bright underline underline-offset-4">
              <T k="orChoose" />
            </span>
            <span className="mt-3 font-mono text-xs text-mist-500">.csv  .txt</span>
            <input ref={input} type="file" accept=".csv,.txt,text/csv,text/plain" className="sr-only" onChange={(e) => void upload(e.target.files?.[0])} />
          </label>
          {failed && <Tx k="batchFailed" className="mt-4 text-sm text-scam" split="stack" />}
          <div className="mt-6 grid gap-4 md:grid-cols-[1fr_auto] md:items-end">
            <pre className="overflow-x-auto rounded-2xl bg-ink-950 p-4 font-mono text-xs leading-relaxed text-mist-300" dir="ltr">
              {SAMPLE}
            </pre>
            <a
              href={sampleHref()}
              download="trust-issues-sample.csv"
              className="inline-flex items-center gap-2 self-start rounded-xl border border-ink-500 px-4 py-2.5 text-sm font-semibold text-paper hover:border-brand md:self-end"
            >
              <FileSpreadsheet className="size-4" aria-hidden="true" />
              sample.csv
            </a>
          </div>
        </Panel>
      ) : (
        <div className="space-y-5">
          <Panel className="p-5 sm:p-6">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex min-w-0 items-center gap-3">
                <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-ink-700 text-mist-200">
                  {done ? (
                    <CheckCircle2 className="size-6 text-safe" aria-hidden="true" />
                  ) : status?.status === 'error' ? (
                    <XCircle className="size-6 text-scam" aria-hidden="true" />
                  ) : (
                    <Spinner className="size-5 text-brand-bright" />
                  )}
                </span>
                <div className="min-w-0">
                  <p className="truncate font-semibold text-paper">{file?.name}</p>
                  <p className="num text-sm text-mist-400">
                    {uploading ? (
                      <T k="uploading" />
                    ) : (
                      <>
                        {num(status?.done ?? 0)} / {num(status?.total ?? 0)} <T k="processed" />
                      </>
                    )}
                  </p>
                </div>
              </div>
              <div className="flex gap-2">
                {done && jobId && (
                  <button
                    type="button"
                    onClick={() => void consoleApi.batchDownload(jobId)}
                    className="inline-flex items-center gap-2 rounded-xl bg-brand px-4 py-2.5 text-sm font-bold text-ink-950 hover:bg-brand-bright"
                  >
                    <Download className="size-4" aria-hidden="true" />
                    <T k="downloadCsv" />
                  </button>
                )}
                <button
                  type="button"
                  onClick={reset}
                  className="inline-flex items-center gap-2 rounded-xl border border-ink-500 px-4 py-2.5 text-sm font-semibold text-paper hover:border-brand"
                >
                  <RotateCcw className="size-4" aria-hidden="true" />
                  <T k="newBatch" />
                </button>
              </div>
            </div>
            <div className="mt-5 h-2.5 overflow-hidden rounded-full bg-ink-700">
              <div
                className="h-full rounded-full bg-gradient-to-r from-brand-deep to-brand-bright transition-[width] duration-500"
                style={{ width: `${Math.max(2, progress * 100)}%` }}
              />
            </div>
          </Panel>

          {done && (
            <Panel className="p-5 sm:p-6">
              {status?.metrics ? (
                <div className="grid gap-6 lg:grid-cols-[1fr_auto]">
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                    <MetricTile k="precision" value={status.metrics.precision} />
                    <MetricTile k="recall" value={status.metrics.recall} />
                    <MetricTile k="f1" value={status.metrics.f1} />
                    {status.metrics.accuracy != null && <MetricTile k="accuracy" value={status.metrics.accuracy} />}
                  </div>
                  <Confusion m={status.metrics} />
                </div>
              ) : (
                <Tx k="noLabels" className="text-sm text-mist-400" split="stack" />
              )}
            </Panel>
          )}

          {rows.length > 0 && (
            <Panel className="overflow-hidden">
              <p className="border-b border-ink-700 px-5 py-3 text-sm font-semibold text-paper">
                <T k="preview" />
                <span className="num ms-2 text-xs font-medium text-mist-500">{rows.length}</span>
              </p>
              <div className="scrollbar-thin max-h-[520px] overflow-auto">
                <table className="w-full min-w-[720px] text-sm" dir="ltr">
                  <thead className="sticky top-0 bg-ink-850 text-xs text-mist-400">
                    <tr>
                      {columns.map((c) => (
                        <th key={c} className="px-4 py-2.5 text-left font-mono font-medium">
                          {c}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-ink-700">
                    {rows.map((r, i) => (
                      <tr key={i}>
                        {columns.map((c) => (
                          <td key={c} className={`max-w-[360px] truncate px-4 py-2.5 ${c === 'url' ? 'font-mono text-xs text-paper' : 'text-mist-200'}`}>
                            {cellValue(r[c])}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Panel>
          )}
        </div>
      )}
    </div>
  )
}
