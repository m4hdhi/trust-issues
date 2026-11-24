import { useEffect, useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { PageHeader, SOURCE_META, SourceTag } from './ui'
import { ScanDrawer } from './ScanDrawer'
import { BrandMark, brandName } from '../components/BrandMark'
import { VerdictChip } from '../components/VerdictChip'
import { Counter } from '../components/motion'
import { Spinner, ErrorState, EmptyState } from '../components/States'
import { T } from '../lib/lang'
import { consoleApi } from '../lib/api'
import { defang, shortAgo } from '../lib/format'
import { EASE_OUT, T_LAYOUT } from '../lib/motion'
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
  const [live, setLive] = useState<boolean | null>(null)
  const [loading, setLoading] = useState(true)
  const [failed, setFailed] = useState(false)
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
    const refresh = setInterval(() => void load(false), 10000)
    const stop = consoleApi.radarStream((item) => {
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
    }, setLive)
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
          <span className={`inline-flex items-center gap-2 text-sm font-medium ${live ? 'text-safe' : live === false ? 'text-warn' : 'text-paper-3'}`}>
            <span className="relative flex size-2">
              {live && <span className="absolute inset-0 animate-ping-soft rounded-full bg-safe" />}
              <span className={`relative size-2 rounded-full ${live ? 'bg-safe' : live === false ? 'bg-warn' : 'bg-paper-3'}`} />
            </span>
            <T k={live ? 'live' : live === false ? 'reconnecting' : 'connecting'} />
          </span>
        }
      />

      <dl className="mb-8 grid grid-cols-2 gap-px overflow-hidden rounded-xl bg-line sm:grid-cols-4 xl:grid-cols-7">
        <div className="col-span-2 flex flex-col-reverse gap-1 bg-ink-850 p-6 sm:col-span-4 xl:col-span-1">
          <dt className="text-sm text-paper-3">
            <T k="certsWatched" />
          </dt>
          <dd className="evidence text-2xl text-paper">{certs != null ? <Counter value={certs} /> : 'n/a'}</dd>
        </div>
        {SOURCES.map((s) => (
          <div key={s} className="flex flex-col-reverse gap-1 bg-ink-850 p-6">
            <dt>
              <SourceTag source={s} />
            </dt>
            <dd className="evidence text-2xl" style={{ color: SOURCE_META[s].color }}>
              <Counter value={counts[s] ?? 0} duration={0.4} />
            </dd>
          </div>
        ))}
      </dl>

      {loading ? (
        <div className="flex justify-center py-16 text-paper-3">
          <Spinner />
        </div>
      ) : failed && !items.length ? (
        <ErrorState onRetry={() => window.location.reload()} />
      ) : !items.length ? (
        <EmptyState message="radarEmpty" />
      ) : (
        <ul className="border-t border-line">
          <AnimatePresence initial={false}>
            {items.map((r) => {
              const key = itemKey(r)
              const det = detailText(r.detail)
              const brand = brandName(r.brand)
              const scanId = scanIdOf(r)
              const risky = r.verdict === 'scam' || r.verdict === 'suspicious'
              return (
                <motion.li
                  key={key}
                  layout="position"
                  initial={{ opacity: 0, y: -12, backgroundColor: 'rgba(201,163,91,0.12)' }}
                  animate={{ opacity: 1, y: 0, backgroundColor: 'rgba(201,163,91,0)' }}
                  exit={{ opacity: 0 }}
                  transition={{ ...T_LAYOUT, backgroundColor: { duration: 2, ease: EASE_OUT } }}
                  className="border-b border-line"
                >
                  <button
                    type="button"
                    disabled={!scanId}
                    onClick={() => scanId && setOpen({ id: scanId, title: r.domain })}
                    className={`grid w-full grid-cols-[1fr_auto] items-center gap-x-6 gap-y-2 py-4 text-start sm:grid-cols-[48px_160px_1fr_auto] ${scanId ? 'cursor-pointer hover:bg-ink-850' : 'cursor-default'}`}
                  >
                    <span className="evidence num hidden text-xs text-paper-3 sm:block">{shortAgo(r.ts)}</span>
                    <span className="hidden sm:block">
                      <SourceTag source={r.source} />
                    </span>
                    <span className="flex min-w-0 items-center gap-4">
                      <BrandMark brand={r.brand} className="size-8" />
                      <span className="min-w-0">
                        <span className={`evidence block truncate text-base ${risky ? 'text-paper' : 'text-paper-2'}`}>{risky ? defang(r.domain) : r.domain}</span>
                        <span className="block truncate text-sm text-paper-3">
                          {brand && <T text={brand} />}
                          {brand && det ? ' · ' : ''}
                          {det && (typeof det === 'string' ? det : <T text={det} />)}
                        </span>
                      </span>
                    </span>
                    {r.verdict === 'pending' ? (
                      <span className="inline-flex items-center gap-2 text-sm text-paper-3">
                        <Spinner className="size-3" />
                        <T k="scanningShort" />
                      </span>
                    ) : (
                      <VerdictChip verdict={r.verdict} score={r.score} />
                    )}
                  </button>
                </motion.li>
              )
            })}
          </AnimatePresence>
        </ul>
      )}
      <ScanDrawer scanId={open?.id ?? null} title={open?.title} onClose={() => setOpen(null)} />
    </div>
  )
}
