import { useEffect, useMemo, useState } from 'react'
import { CircleMarker, MapContainer, Popup, TileLayer, useMap } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import { BadgeCheck, Crosshair, ExternalLink, Globe, PanelRightOpen, Phone, Star } from 'lucide-react'
import { PageHeader, Panel } from './ui'
import { btn } from '../components/ui'
import { ScanDrawer } from './ScanDrawer'
import { brandName } from '../components/BrandMark'
import { VerdictChip } from '../components/VerdictChip'
import { EmptyState, ErrorState, Spinner } from '../components/States'
import { T, Tx, useLang } from '../lib/lang'
import { ApiError, consoleApi } from '../lib/api'
import { hostOf } from '../lib/format'
import type { StringKey } from '../lib/i18n'
import type { MapsHit, SearchHit } from '../lib/types'
import { VERDICT_COLOR } from '../lib/verdict'

const huntError = (e: unknown): StringKey => (e instanceof ApiError && e.status === 429 ? 'huntQuota' : 'huntFailed')

const SEARCH_SUGGESTIONS = ['pay traffic fines Abu Dhabi', 'دفع مخالفات المرور أبوظبي', 'Salik recharge', 'Emirates NBD customer care number']
const MAPS_SUGGESTIONS = ['Emirates NBD customer service Dubai', 'خدمة عملاء بنك الإمارات دبي الوطني', 'Etisalat customer care Abu Dhabi', 'Aramex customer service Dubai']

function HuntForm({
  index,
  title,
  sub,
  suggestions,
  busy,
  onRun,
}: {
  index: number
  title: StringKey
  sub: StringKey
  suggestions: string[]
  busy: boolean
  onRun: (q: string) => void
}) {
  const { t } = useLang()
  const [q, setQ] = useState('')
  const run = (value: string) => {
    const v = value.trim()
    if (!v) return
    setQ(v)
    onRun(v)
  }
  return (
    <div className="p-6">
      <span className="evidence text-sm text-gold">{String(index).padStart(2, '0')}</span>
      <h2 className="display mt-2 text-xl text-paper">
        <T k={title} arClassName="text-lg text-paper-2" />
      </h2>
      <Tx k={sub} className="mt-1 text-base text-paper-2" split="stack" />
      <form
        onSubmit={(e) => {
          e.preventDefault()
          run(q)
        }}
        className="mt-6 flex flex-col gap-2 sm:flex-row"
      >
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          dir="auto"
          aria-label={t(title)}
          className="h-12 min-w-0 flex-1 rounded-lg border border-line bg-ink-900 px-4 text-base text-paper focus:border-gold focus:outline-none"
        />
        <button type="submit" disabled={busy || !q.trim()} className={btn.primary}>
          {busy ? <Spinner /> : <Crosshair className="size-4" aria-hidden="true" />}
          <T k={busy ? 'hunting' : 'runHunt'} />
        </button>
      </form>
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <span className="text-sm text-paper-3">
          <T k="tryQuery" />
        </span>
        {suggestions.map((s) => (
          <button key={s} type="button" disabled={busy} onClick={() => run(s)} dir="auto" className={btn.small}>
            {s}
          </button>
        ))}
      </div>
    </div>
  )
}

function SearchHunter({ onOpen }: { onOpen: (id: string, title: string) => void }) {
  const [busy, setBusy] = useState(false)
  const [items, setItems] = useState<SearchHit[] | null>(null)
  const [failed, setFailed] = useState<StringKey | null>(null)

  const run = async (q: string) => {
    setBusy(true)
    setFailed(null)
    try {
      setItems(await consoleApi.huntSearch(q))
    } catch (e) {
      setFailed(huntError(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Panel>
      <HuntForm
        index={1}
        title="searchHunter"
        sub="searchHunterSub"
        suggestions={SEARCH_SUGGESTIONS}
        busy={busy}
        onRun={(q) => void run(q)}
      />
      {failed && (
        <div className="px-4 pb-4">
          <ErrorState message={failed} />
        </div>
      )}
      {items && !failed && (
        <div className="border-t border-line">
          {items.length === 0 ? (
            <div className="p-4">
              <EmptyState message="noResults" />
            </div>
          ) : (
            <div className="scrollbar-thin overflow-x-auto">
              <table className="w-full min-w-[720px] text-sm">
                <thead className="text-xs text-paper-3">
                  <tr>
                    <th className="w-16 px-4 py-3 text-start font-medium">
                      <T k="position" />
                    </th>
                    <th className="px-4 py-3 text-start font-medium">
                      <T k="col_title" />
                    </th>
                    <th className="px-4 py-3 text-start font-medium">
                      <T k="col_verdict" />
                    </th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {items.map((h) => (
                    <tr key={`${h.position}-${h.url}`} className={h.verdict === 'scam' ? 'bg-scam/[0.05]' : ''}>
                      <td className="px-4 py-3">
                        <span className="num font-mono text-paper-2">#{h.position}</span>
                      </td>
                      <td className="max-w-[420px] px-4 py-3">
                        <div className="flex items-center gap-2">
                          {h.official && (
                            <span className="inline-flex shrink-0 items-center gap-1 rounded-md bg-gold/15 px-2 py-1 text-xs font-semibold text-gold">
                              <BadgeCheck className="size-3" aria-hidden="true" />
                              <T k="official" />
                            </span>
                          )}
                          {h.is_ad && (
                            <span className="shrink-0 rounded-md bg-warn/20 px-2 py-1 text-xs font-semibold text-warn">
                              <T k="ad" />
                            </span>
                          )}
                          <p className="truncate font-medium text-paper" dir="auto">
                            {h.title}
                          </p>
                        </div>
                        <p className="mt-1 truncate font-mono text-xs text-paper-3" dir="ltr">
                          {h.domain || hostOf(h.url)}
                        </p>
                      </td>
                      <td className="px-4 py-3">
                        <VerdictChip verdict={h.verdict} score={h.score} />
                      </td>
                      <td className="px-4 py-3 text-end">
                        {h.scan_id ? (
                          <button
                            type="button"
                            onClick={() => h.scan_id && onOpen(h.scan_id, h.domain)}
                            className="inline-flex items-center gap-1 rounded-lg border border-line-strong px-3 py-1 text-xs font-semibold text-paper hover:border-gold"
                          >
                            <PanelRightOpen className="size-3.5" aria-hidden="true" />
                            <T k="open" />
                          </button>
                        ) : null}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </Panel>
  )
}

function FlyTo({ target }: { target: [number, number] | null }) {
  const map = useMap()
  useEffect(() => {
    if (target) map.flyTo(target, Math.max(map.getZoom(), 13), { duration: 0.8 })
  }, [target, map])
  return null
}

function FitAll({ points }: { points: [number, number][] }) {
  const map = useMap()
  useEffect(() => {
    if (points.length > 1) map.fitBounds(points, { padding: [40, 40], maxZoom: 13 })
    else if (points.length === 1) map.setView(points[0], 13)
  }, [points, map])
  return null
}

function MapsHunter() {
  const [busy, setBusy] = useState(false)
  const [items, setItems] = useState<MapsHit[] | null>(null)
  const [failed, setFailed] = useState<StringKey | null>(null)
  const [focus, setFocus] = useState<[number, number] | null>(null)

  const run = async (q: string) => {
    setBusy(true)
    setFailed(null)
    setFocus(null)
    try {
      setItems(await consoleApi.huntMaps(q))
    } catch (e) {
      setFailed(huntError(e))
    } finally {
      setBusy(false)
    }
  }

  const located = useMemo(
    () => (items ?? []).filter((h): h is MapsHit & { lat: number; lng: number } => h.lat != null && h.lng != null),
    [items],
  )
  const points = useMemo(() => located.map((h) => [h.lat, h.lng] as [number, number]), [located])

  return (
    <Panel>
      <HuntForm
        index={2}
        title="mapsHunter"
        sub="mapsHunterSub"
        suggestions={MAPS_SUGGESTIONS}
        busy={busy}
        onRun={(q) => void run(q)}
      />
      {failed && (
        <div className="px-4 pb-4">
          <ErrorState message={failed} />
        </div>
      )}
      <div className="grid border-t border-line xl:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
        <div className="scrollbar-thin max-h-[560px] divide-y divide-line overflow-y-auto">
          {items && items.length === 0 && (
            <div className="p-4">
              <EmptyState message="noResults" />
            </div>
          )}
          {(items ?? []).map((h, i) => {
            const brand = brandName(h.brand)
            return (
              <button
                key={`${h.title}-${i}`}
                type="button"
                onClick={() => h.lat != null && h.lng != null && setFocus([h.lat, h.lng])}
                className="block w-full px-4 py-4 text-start hover:bg-ink-800"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-semibold text-paper" dir="auto">
                      {h.title}
                    </p>
                    {brand && (
                      <p className="text-xs text-paper-3">
                        <T text={brand} />
                      </p>
                    )}
                  </div>
                  <VerdictChip verdict={h.verdict} score={h.score} />
                </div>
                <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-paper-2">
                  {h.phone && (
                    <span className="inline-flex items-center gap-1 font-mono" dir="ltr">
                      <Phone className="size-3.5" aria-hidden="true" />
                      {h.phone}
                    </span>
                  )}
                  {h.website && (
                    <span className="inline-flex min-w-0 items-center gap-1 font-mono" dir="ltr">
                      <Globe className="size-3.5 shrink-0" aria-hidden="true" />
                      <span className="truncate">{hostOf(h.website)}</span>
                    </span>
                  )}
                  {h.rating != null && (
                    <span className="num inline-flex items-center gap-1">
                      <Star className="size-3.5 text-warn" aria-hidden="true" />
                      {h.rating.toFixed(1)}
                      {h.reviews != null && <span className="text-paper-3">({h.reviews})</span>}
                    </span>
                  )}
                </div>
                {h.flags.length > 0 && (
                  <ul className="mt-2 space-y-1">
                    {h.flags.map((f, j) => (
                      <li key={j} className="rounded-lg bg-scam/10 px-3 py-1 text-xs text-[#fca5a5]">
                        <T text={f} />
                      </li>
                    ))}
                  </ul>
                )}
              </button>
            )
          })}
        </div>
        <div className="relative h-[420px] border-t border-line xl:h-auto xl:min-h-[480px] xl:border-t-0 xl:border-s">
          <MapContainer center={[24.9, 55.0]} zoom={8} scrollWheelZoom className="absolute inset-0 z-0">
            <TileLayer
              attribution="Tiles &copy; Esri &mdash; Esri, HERE, Garmin, &copy; OpenStreetMap contributors"
              url="https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}"
              maxZoom={16}
            />
            <TileLayer
              url="https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Reference/MapServer/tile/{z}/{y}/{x}"
              maxZoom={16}
            />
            <FitAll points={points} />
            <FlyTo target={focus} />
            {located.map((h, i) => (
              <CircleMarker
                key={`${h.title}-${i}`}
                center={[h.lat, h.lng]}
                radius={h.verdict === 'scam' ? 11 : 8}
                pathOptions={{ color: '#0b1220', weight: 2, fillColor: VERDICT_COLOR[h.verdict], fillOpacity: 0.95 }}
              >
                <Popup>
                  <p className="m-0 font-semibold">{h.title}</p>
                  {h.phone && <p className="m-0 font-mono text-xs">{h.phone}</p>}
                  {h.website && (
                    <a href={h.website} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs">
                      {hostOf(h.website)}
                      <ExternalLink className="size-3" />
                    </a>
                  )}
                </Popup>
              </CircleMarker>
            ))}
          </MapContainer>
        </div>
      </div>
    </Panel>
  )
}

export function Hunt() {
  const [open, setOpen] = useState<{ id: string; title: string } | null>(null)
  return (
    <div>
      <PageHeader title="nav_hunt" sub="huntSub" />
      <div className="space-y-6">
        <SearchHunter onOpen={(id, title) => setOpen({ id, title })} />
        <MapsHunter />
      </div>
      <ScanDrawer scanId={open?.id ?? null} title={open?.title} onClose={() => setOpen(null)} />
    </div>
  )
}
