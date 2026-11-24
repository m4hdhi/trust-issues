import { useId } from 'react'
import { PageHeader, Panel } from './ui'
import { ErrorState, LoadingState } from '../components/States'
import { T, Tx } from '../lib/lang'
import { consoleApi } from '../lib/api'
import { compact, num, pct } from '../lib/format'
import { useAsync } from '../lib/useAsync'
import type { StringKey } from '../lib/i18n'
import type { EvalMetrics, SeriesPoint } from '../lib/types'

type SeriesKey = 'scans' | 'scams' | 'reports' | 'blocks'

const SERIES: { key: SeriesKey; k: StringKey; color: string }[] = [
  { key: 'scans', k: 'm_scans', color: '#14b8a6' },
  { key: 'scams', k: 'm_scams', color: '#ef4444' },
  { key: 'reports', k: 'm_reports', color: '#f59e0b' },
  { key: 'blocks', k: 'm_blocks', color: '#60a5fa' },
]

function AreaChart({ points, color }: { points: number[]; color: string }) {
  const id = `ar${useId().replace(/[^a-zA-Z0-9]/g, '')}`
  const W = 320
  const H = 96
  const max = Math.max(1, ...points)
  const step = points.length > 1 ? W / (points.length - 1) : W
  const xy = points.map((v, i) => [i * step, H - 6 - (v / max) * (H - 14)] as const)
  const line = xy.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)},${y.toFixed(1)}`).join(' ')
  const area = `${line} L${W},${H} L0,${H} Z`
  const last = xy[xy.length - 1]
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
      {points.length > 1 && <path d={area} fill={`url(#${id})`} />}
      {points.length > 1 && <path d={line} fill="none" stroke={color} strokeWidth="2" vectorEffect="non-scaling-stroke" strokeLinejoin="round" />}
      {last && <circle cx={last[0]} cy={last[1]} r="3.5" fill={color} vectorEffect="non-scaling-stroke" />}
    </svg>
  )
}

function SeriesCard({ series, def }: { series: SeriesPoint[]; def: (typeof SERIES)[number] }) {
  const values = series.map((p) => p[def.key] ?? 0)
  const total = values.reduce((a, b) => a + b, 0)
  const today = values[values.length - 1] ?? 0
  return (
    <Panel className="p-4">
      <div className="flex items-baseline justify-between gap-2">
        <p className="flex items-center gap-2 text-sm font-semibold text-paper">
          <span className="size-2 rounded-full" style={{ background: def.color }} />
          <T k={def.k} />
        </p>
        <p className="num text-xs text-mist-400">
          <span className="font-semibold text-paper">{num(today)}</span> <T k="latestDay" />
        </p>
      </div>
      <p className="num mt-1 text-3xl font-extrabold tracking-tight text-paper">{compact(total)}</p>
      <div className="mt-3">
        <AreaChart points={values} color={def.color} />
      </div>
      {series.length > 1 && (
        <div className="num mt-1 flex justify-between font-mono text-[10px] text-mist-500" dir="ltr">
          <span>{series[0].date.slice(5)}</span>
          <span>{series[series.length - 1].date.slice(5)}</span>
        </div>
      )}
    </Panel>
  )
}

const EVAL_TILES: { key: keyof EvalMetrics; k: StringKey; fmt: (v: number) => string; good: (v: number) => boolean }[] = [
  { key: 'precision', k: 'precision', fmt: (v) => pct(v), good: (v) => v >= 0.9 },
  { key: 'recall', k: 'recall', fmt: (v) => pct(v), good: (v) => v >= 0.9 },
  { key: 'f1', k: 'f1', fmt: (v) => pct(v), good: (v) => v >= 0.9 },
  { key: 'fpr', k: 'fpr', fmt: (v) => pct(v, 2), good: (v) => v <= 0.02 },
  { key: 'official_fp', k: 'officialFp', fmt: (v) => num(v), good: (v) => v === 0 },
  { key: 'n', k: 'evaluated', fmt: (v) => num(v), good: () => true },
]

export function Metrics() {
  const { data, loading, error, reload } = useAsync(() => consoleApi.metrics(), [])
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
            <h2 className="mb-3 text-base font-bold text-paper">
              <T k="metricsTitle" arClassName="font-semibold text-mist-300" />
            </h2>
            {data.eval ? (
              <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
                {EVAL_TILES.map((tile) => {
                  const raw = data.eval?.[tile.key]
                  const v = typeof raw === 'number' ? raw : null
                  return (
                    <Panel key={tile.key} className="p-4">
                      <p className="text-xs font-medium text-mist-400">
                        <T k={tile.k} />
                      </p>
                      <p className={`num mt-1.5 text-3xl font-extrabold tracking-tight ${v != null && tile.key !== 'n' ? (tile.good(v) ? 'text-safe' : 'text-warn') : 'text-paper'}`}>
                        {v != null ? tile.fmt(v) : '—'}
                      </p>
                    </Panel>
                  )
                })}
              </div>
            ) : (
              <Tx k="noEval" className="rounded-2xl border border-dashed border-ink-600 p-5 text-sm text-mist-400" split="stack" />
            )}
          </section>
          <section>
            <h2 className="mb-3 text-base font-bold text-paper">
              <T k="activity" arClassName="font-semibold text-mist-300" />
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
