import { useEffect, useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { ShieldQuestion } from 'lucide-react'
import { PageHeader, Panel, SOURCE_META, SourceIcon, SourceLabel, sourceMeta } from './ui'
import { ScanDrawer } from './ScanDrawer'
import { brandName } from '../components/BrandMark'
import { VerdictChip } from '../components/VerdictChip'
import { Spinner, ErrorState, EmptyState } from '../components/States'
import { T } from '../lib/lang'
import { consoleApi } from '../lib/api'
import { num, shortAgo } from '../lib/format'
import type { Bilingual, CaseSource, RadarItem } from '../lib/types'

const SOURCES: CaseSource[] = ['ct', 'typosquat', 'nrd', 'search', 'maps', 'report']
const MAX_ITEMS = 200

function itemKey(r: RadarItem): string {
  return r.id ?? `${r.source}:${r.domain}`
}

function detailText(detail: RadarItem['detail']): Bilingual | string | null {
  if (!detail) return null
  if (typeof detail === 'string') return detail
  const d = detail as Record<string, unknown>
  if (typeof d.en === 'string' && typeof d.ar === 'string') return { en: d.en, ar: d.ar }
  const h = d.headline as Partial<Bilingual> | undefined
  if (h && typeof h.en === 'string' && typeof h.ar === 'string') return { en: h.en, ar: h.ar }
  for (const k of ['reason', 'query', 'title', 'matched', 'brand_token']) {
    if (typeof d[k] === 'string') return d[k] as string
  }
  return null
}

function scanIdOf(r: RadarItem): string | null {
  if (r.detail && typeof r.detail === 'object' && typeof (r.detail as Record<string, unknown>).scan_id === 'string') {
    return (r.detail as Record<string, string>).scan_id
  }
  return null
}

export function Radar() {
  const [items, setItems] = useState<RadarItem[]>([])
  const [certs, setCerts] = useState<number | null>(null)
  const [live, setLive] = useState(false)
  const [loading, setLoading] = useState(true)
  const [failed, setFailed] = useState(false)
  const [fresh, setFresh] = useState<Set<string>>(new Set())
  const [, setNow] = useState(Date.now())
  const [open, setOpen] = useState<{ id: string; title: string } | null>(null)

  useEffect(() => {
    let alive = true
    const load = async (initial: boolean) => {
      try {
        const res = await consoleApi.radarRecent()
        if (!alive) return
        if (res.ct) setCerts(res.ct.certs)
        if (initial) setItems(res.items.slice(0, MAX_ITEMS))
        setFailed(false)
      } catch {
        if (alive && initial) setFailed(true)
      } finally {
        if (alive && initial) setLoading(false)
      }
    }
    void load(true)
    const refresh = setInterval(() => void load(false), 15000)
    const stop = consoleApi.radarStream(
      (item) => {
        const key = itemKey(item)
        setItems((prev) => {
          const idx = prev.findIndex((p) => itemKey(p) === key)
          if (idx >= 0) {
            const next = [...prev]
            next[idx] = item
            return next
          }
          return [item, ...prev].slice(0, MAX_ITEMS)
        })
        setFresh((prev) => new Set(prev).add(key))
        setTimeout(() => setFresh((prev) => {
          const next = new Set(prev)
          next.delete(key)
          return next
        }), 2500)
      },
      setLive,
    )
    const clock = setInterval(() => setNow(Date.now()), 10000)
    return () => {
      alive = false
      stop()
      clearInterval(refresh)
      clearInterval(clock)
    }
  }, [])

  const counts = useMemo(() => {
    const c: Record<string, number> = {}
    for (const i of items) c[i.source] = (c[i.source] ?? 0) + 1
    return c
  }, [items])

  return (
    <div>
      <PageHeader
        title="nav_radar"
        sub="radarSub"
        right={
          <span
            className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold ${
              live ? 'border-safe/40 text-safe' : 'border-warn/40 text-warn'
            }`}
          >
            <span className="relative flex size-2">
              {live && <span className="absolute inset-0 animate-ping rounded-full bg-safe opacity-70" />}
              <span className={`relative size-2 rounded-full ${live ? 'bg-safe' : 'bg-warn'}`} />
            </span>
            <T k={live ? 'live' : 'reconnecting'} />
          </span>
        }
      />

      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4 xl:grid-cols-7">
        <Panel className="col-span-2 flex flex-col justify-between p-4 sm:col-span-4 xl:col-span-1">
          <p className="text-xs font-medium text-mist-400">
            <T k="certsWatched" />
          </p>
          <p className="num mt-2 text-2xl font-bold text-paper">{certs != null ? num(certs) : '—'}</p>
        </Panel>
        {SOURCES.map((s) => {
          const meta = SOURCE_META[s]
          return (
            <Panel key={s} className="p-4">
              <div className="flex items-center gap-2">
                <SourceIcon source={s} className="size-7" />
                <p className="truncate text-xs font-medium text-mist-400">
                  <T k={meta.k} />
                </p>
              </div>
              <motion.p key={counts[s] ?? 0} initial={{ opacity: 0.4, y: -4 }} animate={{ opacity: 1, y: 0 }} className="num mt-2 text-2xl font-bold" style={{ color: meta.color }}>
                {counts[s] ?? 0}
              </motion.p>
            </Panel>
          )
        })}
      </div>

      {loading ? (
        <div className="flex justify-center py-16 text-mist-400">
          <Spinner />
        </div>
      ) : failed && !items.length ? (
        <ErrorState onRetry={() => window.location.reload()} />
      ) : !items.length ? (
        <EmptyState message="radarEmpty" />
      ) : (
        <Panel className="overflow-hidden">
          <ul className="divide-y divide-ink-700">
            <AnimatePresence initial={false}>
              {items.map((r) => {
                const key = itemKey(r)
                const det = detailText(r.detail)
                const brand = brandName(r.brand)
                const scanId = scanIdOf(r)
                const isFresh = fresh.has(key)
                return (
                  <motion.li
                    key={key}
                    layout="position"
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.3 }}
                    className="overflow-hidden"
                  >
                    <button
                      type="button"
                      disabled={!scanId}
                      onClick={() => scanId && setOpen({ id: scanId, title: r.domain })}
                      className={`flex w-full items-center gap-3 px-4 py-3 text-start transition-colors duration-700 sm:gap-4 ${
                        isFresh ? 'bg-brand/10' : 'hover:bg-ink-800'
                      } ${scanId ? 'cursor-pointer' : 'cursor-default'}`}
                    >
                      <SourceIcon source={r.source} />
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-mono text-sm font-semibold text-paper" dir="ltr">
                          {r.domain}
                        </p>
                        <p className="mt-0.5 truncate text-xs text-mist-400">
                          <span style={{ color: sourceMeta(r.source).color }}>
                            <SourceLabel source={r.source} />
                          </span>
                          {brand && (
                            <span className="ms-2 text-mist-300">
                              <T text={brand} />
                            </span>
                          )}
                          {det && <span className="ms-2">{typeof det === 'string' ? det : <T text={det} />}</span>}
                        </p>
                      </div>
                      {r.verdict === 'pending' || r.verdict === 'unknown' ? (
                        <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-ink-600 px-2 py-0.5 text-xs text-mist-400">
                          {r.verdict === 'pending' ? <Spinner className="size-3" /> : <ShieldQuestion className="size-3" />}
                          <T k={r.verdict === 'pending' ? 'scanningShort' : 'v_unknown'} />
                        </span>
                      ) : (
                        <VerdictChip verdict={r.verdict} score={r.score} />
                      )}
                      <span className="num w-9 shrink-0 text-end font-mono text-xs text-mist-500">{shortAgo(r.ts)}</span>
                    </button>
                  </motion.li>
                )
              })}
            </AnimatePresence>
          </ul>
        </Panel>
      )}
      <ScanDrawer scanId={open?.id ?? null} title={open?.title} onClose={() => setOpen(null)} />
    </div>
  )
}
