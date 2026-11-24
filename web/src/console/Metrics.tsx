import { useId } from 'react'
import { PageHeader, Panel } from './ui'
import { Confusion, type ConfusionCounts } from './Confusion'
import { ErrorState, LoadingState } from '../components/States'
import { T, Tx } from '../lib/lang'
import { consoleApi } from '../lib/api'
import { compact, num, pct } from '../lib/format'
import { useAsync } from '../lib/useAsync'
import type { StringKey } from '../lib/i18n'
import type { SeriesPoint } from '../lib/types'

type SeriesKey = 'scans' | 'scams' | 'reports' | 'blocks'

const SERIES: { key: SeriesKey; k: StringKey; color: string }[] = [
  { key: 'scans', k: 'm_scans', color: '#14b8a6' },
  { key: 'scams', k: 'm_scams', color: '#ef4444' },
  { key: 'reports', k: 'm_reports', color: '#f59e0b' },
  { key: 'blocks', k: 'm_blocks', color: '#60a5fa' },
]

type Obj = Record<string, unknown>

const isObj = (v: unknown): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v)
const numOf = (v: unknown): number | undefined => (typeof v === 'number' && Number.isFinite(v) ? v : undefined)

interface EvalView {
  precision?: number
  recall?: number
  f1?: number
  fpr?: number
  n?: number
  rocAuc?: number
  recallAt1?: number
  threshold?: number
  officialFp?: number
  officialChecked?: number
  latencyMs?: number
  confusion?: ConfusionCounts
  bySource: { source: string; n?: number; fpr?: number; recall?: number }[]
  lures: { url: string; score: number }[]
  note?: string
}

function normalizeEval(raw: Obj | null): EvalView | null {
  if (!raw) return null
  const core = isObj(raw.test) ? raw.test : raw
  const cm = isObj(core.confusion_matrix) ? core.confusion_matrix : isObj(core.confusion) ? core.confusion : core
  const confusion =
    numOf(cm.tp) != null && numOf(cm.fp) != null && numOf(cm.tn) != null && numOf(cm.fn) != null
      ? { tp: numOf(cm.tp) ?? 0, fp: numOf(cm.fp) ?? 0, tn: numOf(cm.tn) ?? 0, fn: numOf(cm.fn) ?? 0 }
      : undefined
  const official = isObj(raw.uae_official) ? raw.uae_official : {}
  const latency = isObj(raw.latency) ? raw.latency : {}
  const bySourceRaw = isObj(raw.test_by_source) ? raw.test_by_source : {}
  const luresRaw = isObj(raw.illustrative_uae_lures) && isObj(raw.illustrative_uae_lures.scores) ? raw.illustrative_uae_lures.scores : {}
  const view: EvalView = {
    precision: numOf(core.precision),
    recall: numOf(core.recall),
    f1: numOf(core.f1),
    fpr: numOf(core.fpr),
    n: numOf(core.n),
    rocAuc: numOf(core.roc_auc),
    recallAt1: numOf(core.recall_at_fpr_1pct),
    threshold: numOf(core.threshold),
    officialFp: numOf(official.false_positives) ?? numOf(raw.official_fp),
    officialChecked: numOf(official.n_urls_checked),
    latencyMs: numOf(latency.score_url_ms_mean),
    confusion,
    bySource: Object.entries(bySourceRaw)
      .filter((e): e is [string, Obj] => isObj(e[1]))
      .map(([source, v]) => ({ source, n: numOf(v.n), fpr: numOf(v.fpr), recall: numOf(v.recall) })),
    lures: Object.entries(luresRaw)
      .map(([url, score]) => ({ url, score: numOf(score) ?? 0 }))
      .sort((a, b) => b.score - a.score),
    note: typeof raw.threshold_selection === 'string' ? raw.threshold_selection : undefined,
  }
  return view.precision == null && view.recall == null && view.f1 == null ? null : view
}

function AreaChart({ points, color }: { points: number[]; color: string }) {
  const id = `ar${useId().replace(/[^a-zA-Z0-9]/g, '')}`
  const W = 320
  const H = 96
  const max = Math.max(1, ...points)
  const step = points.length > 1 ? W / (points.length - 1) : W
  const xy = points.map((v, i) => [i * step, H - 6 - (v / max) * (H - 14)] as const)
  const line = xy.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)},${y.toFixed(1)}`).join(' ')
  const area = `${line} L${W},${H} L0,${H} Z`
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-24 w-full overflow-visible" preserveAspectRatio="none" aria-hidden="true">
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={color} stopOpacity="0.35" />
          <stop offset="1" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      {[0.25, 0.5, 0.75].map((f) => (
        <line key={f} x1="0" x2={W} y1={H * f} y2={H * f} stroke="#1a2742" strokeWidth="1" vectorEffect="non-scaling-stroke" />
      ))}
      {points.length > 1 ? (
        <>
          <path d={area} fill={`url(#${id})`} />
          <path d={line} fill="none" stroke={color} strokeWidth="2" vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
        </>
      ) : (
        <line x1="0" x2={W} y1={xy[0]?.[1] ?? H} y2={xy[0]?.[1] ?? H} stroke={color} strokeWidth="2" vectorEffect="non-scaling-stroke" />
      )}
    </svg>
  )
}

function SeriesCard({ series, def }: { series: SeriesPoint[]; def: (typeof SERIES)[number] }) {
  const values = series.map((p) => p[def.key] ?? 0)
  const total = values.reduce((a, b) => a + b, 0)
  const latest = values[values.length - 1] ?? 0
  return (
    <Panel className="p-4">
      <div className="flex items-baseline justify-between gap-2">
        <p className="flex items-center gap-2 text-sm font-semibold text-paper">
          <span className="size-2 rounded-full" style={{ background: def.color }} />
          <T k={def.k} />
        </p>
        <p className="num text-xs text-paper-3">
          <span className="font-semibold text-paper">{num(latest)}</span> <T k="latestDay" />
        </p>
      </div>
      <p className="num mt-1 text-3xl font-semibold display text-paper">{compact(total)}</p>
      <div className="mt-3">
        <AreaChart points={values} color={def.color} />
      </div>
      {series.length > 0 && (
        <div className="num mt-1 flex justify-between font-mono text-xs text-paper-3" dir="ltr">
          <span>{series[0].date.slice(5)}</span>
          <span>{series[series.length - 1].date.slice(5)}</span>
        </div>
      )}
    </Panel>
  )
}

function Kpi({ k, value, tone = 'neutral', hint }: { k: StringKey; value: string; tone?: 'good' | 'warn' | 'neutral'; hint?: string }) {
  const color = tone === 'good' ? 'text-safe' : tone === 'warn' ? 'text-warn' : 'text-paper'
  return (
    <Panel className="p-4">
      <p className="text-xs font-medium leading-snug text-paper-3">
        <T k={k} />
      </p>
      <p className={`num mt-2 text-3xl font-semibold display ${color}`}>{value}</p>
      {hint && <p className="num mt-1 font-mono text-xs text-paper-3">{hint}</p>}
    </Panel>
  )
}

function EvalSection({ ev }: { ev: EvalView }) {
  const g = (v: number | undefined, ok: (x: number) => boolean) => (v == null ? 'neutral' : ok(v) ? 'good' : 'warn')
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Kpi k="precision" value={pct(ev.precision)} tone={g(ev.precision, (v) => v >= 0.9)} />
        <Kpi k="recall" value={pct(ev.recall)} tone={g(ev.recall, (v) => v >= 0.85)} />
        <Kpi k="f1" value={pct(ev.f1)} tone={g(ev.f1, (v) => v >= 0.88)} />
        <Kpi k="fpr" value={pct(ev.fpr, 2)} tone={g(ev.fpr, (v) => v <= 0.02)} />
        <Kpi
          k="officialFp"
          value={ev.officialFp != null ? num(ev.officialFp) : 'n/a'}
          tone={g(ev.officialFp, (v) => v === 0)}
          hint={ev.officialChecked != null ? `/ ${num(ev.officialChecked)} URLs` : undefined}
        />
        <Kpi k="evaluated" value={ev.n != null ? compact(ev.n) : 'n/a'} hint={ev.threshold != null ? `threshold ${ev.threshold}` : undefined} />
        <Kpi k="rocAuc" value={ev.rocAuc != null ? ev.rocAuc.toFixed(3) : 'n/a'} />
        <Kpi k="latencyPerUrl" value={ev.latencyMs != null ? `${ev.latencyMs.toFixed(2)} ms` : 'n/a'} hint={ev.recallAt1 != null ? `recall@1%FPR ${pct(ev.recallAt1)}` : undefined} />
      </div>
      <div className="grid gap-4 lg:grid-cols-[auto_1fr]">
        {ev.confusion && (
          <Panel className="p-5">
            <Confusion m={ev.confusion} />
          </Panel>
        )}
        {ev.lures.length > 0 && (
          <Panel className="p-5">
            <p className="mb-3 text-sm font-semibold text-paper">
              <T k="uaeLures" />
            </p>
            <ul className="space-y-2" dir="ltr">
              {ev.lures.map((l) => (
                <li key={l.url} className="grid grid-cols-[minmax(0,1fr)_120px_48px] items-center gap-3 text-xs">
                  <span className="truncate font-mono text-paper">{l.url}</span>
                  <span className="h-1.5 overflow-hidden rounded-full bg-ink-700">
                    <span className="block h-full rounded-full bg-scam" style={{ width: `${l.score * 100}%` }} />
                  </span>
                  <span className="num text-end font-mono text-paper-2">{l.score.toFixed(2)}</span>
                </li>
              ))}
            </ul>
          </Panel>
        )}
      </div>
      {ev.bySource.length > 0 && (
        <Panel className="overflow-hidden">
          <p className="border-b border-line px-5 py-3 text-sm font-semibold text-paper">
            <T k="bySource" />
          </p>
          <div className="scrollbar-thin overflow-x-auto">
            <table className="w-full min-w-[480px] text-sm" dir="ltr">
              <thead className="text-xs text-paper-3">
                <tr>
                  <th className="px-5 py-3 text-left font-mono font-medium">source</th>
                  <th className="px-5 py-3 text-right font-mono font-medium">n</th>
                  <th className="px-5 py-3 text-right font-mono font-medium">fpr</th>
                  <th className="px-5 py-3 text-right font-mono font-medium">recall</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {ev.bySource.map((r) => (
                  <tr key={r.source}>
                    <td className="px-5 py-3 font-mono text-paper">{r.source}</td>
                    <td className="num px-5 py-3 text-right text-paper-2">{num(r.n)}</td>
                    <td className="num px-5 py-3 text-right text-paper-2">{r.fpr != null ? pct(r.fpr, 2) : 'n/a'}</td>
                    <td className="num px-5 py-3 text-right text-paper-2">{r.recall != null ? pct(r.recall) : 'n/a'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
      )}
      {ev.note && (
        <p className="font-mono text-xs text-paper-3" dir="ltr">
          {ev.note}
        </p>
      )}
    </div>
  )
}

export function Metrics() {
  const { data, loading, error, reload } = useAsync(() => consoleApi.metrics(), [])
  const ev = normalizeEval(data?.eval ?? null)
  return (
    <div>
      <PageHeader title="nav_metrics" sub="metricsSub" />
      {loading ? (
        <LoadingState />
      ) : error || !data ? (
        <ErrorState onRetry={reload} />
      ) : (
        <div className="space-y-8">
          <section>
            <h2 className="mb-3 text-base font-semibold text-paper">
              <T k="metricsTitle" arClassName="font-semibold text-paper-2" />
            </h2>
            {ev ? <EvalSection ev={ev} /> : <Tx k="noEval" className="rounded-xl border border-dashed border-line p-5 text-sm text-paper-3" split="stack" />}
          </section>
          <section>
            <h2 className="mb-3 text-base font-semibold text-paper">
              <T k="activity" arClassName="font-semibold text-paper-2" />
            </h2>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {SERIES.map((def) => (
                <SeriesCard key={def.key} series={data.series} def={def} />
              ))}
            </div>
          </section>
        </div>
      )}
    </div>
  )
}
