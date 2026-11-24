import { Link, useSearchParams } from 'react-router'
import { ArrowRight, ShieldCheck } from 'lucide-react'
import { Composer } from '../components/Composer'
import { ProtectIllustration } from '../components/ProtectIllustration'
import { TrendingRow } from '../components/TrendingCard'
import { T, Tx, useLang } from '../lib/lang'
import { api } from '../lib/api'
import { compact, num } from '../lib/format'
import { S, type StringKey } from '../lib/i18n'
import { useAsync } from '../lib/useAsync'

function Tagline() {
  const { mode } = useLang()
  return (
    <h1 className="text-balance">
      {mode !== 'ar' && (
        <span className="block text-[34px] font-extrabold leading-[1.06] tracking-[-0.035em] text-paper sm:text-5xl lg:text-[56px]">
          {S.tagline.en}
        </span>
      )}
      {mode !== 'en' && (
        <span
          lang="ar"
          dir="rtl"
          className={`block font-bold leading-[1.35] text-paper ${
            mode === 'ar' ? 'text-[38px] sm:text-5xl lg:text-[58px]' : 'mt-3 text-right text-[28px] text-mist-200 sm:text-4xl lg:text-[42px]'
          }`}
        >
          {S.tagline.ar}
        </span>
      )}
    </h1>
  )
}

const STAT_KEYS: { key: 'scams_detected' | 'reports_total' | 'blocked_queries'; label: StringKey; dot: string }[] = [
  { key: 'scams_detected', label: 'statScams', dot: 'bg-scam' },
  { key: 'reports_total', label: 'statReports', dot: 'bg-warn' },
  { key: 'blocked_queries', label: 'statBlocked', dot: 'bg-brand' },
]

function StatsStrip() {
  const { data } = useAsync(() => api.stats(), [])
  return (
    <section aria-label="Live numbers" className="border-y border-ink-700/80 bg-ink-850/60">
      <dl className="mx-auto grid max-w-6xl grid-cols-3 divide-x divide-ink-700/80 px-0 sm:px-6 rtl:divide-x-reverse">
        {STAT_KEYS.map((s) => (
          <div key={s.key} className="px-3 py-5 sm:px-6 sm:py-7">
            <dt className="flex items-start gap-1.5 text-[11.5px] leading-tight text-mist-400 sm:text-sm">
              <span className={`mt-1 size-1.5 shrink-0 rounded-full ${s.dot}`} aria-hidden="true" />
              <T k={s.label} stacked={false} />
            </dt>
            <dd className="num mt-2 text-2xl font-bold tracking-tight text-paper sm:text-4xl">
              {data ? compact(data[s.key]) : <span className="inline-block h-7 w-16 animate-pulse rounded bg-ink-700 sm:h-9" />}
            </dd>
          </div>
        ))}
      </dl>
      {data?.ct_certs_watched ? (
        <p className="mx-auto flex max-w-6xl items-start gap-2 border-t border-ink-700/80 px-4 py-3 text-xs text-mist-400 sm:px-6">
          <span className="relative mt-1 flex size-2 shrink-0" aria-hidden="true">
            <span className="absolute inset-0 animate-ping rounded-full bg-brand opacity-60" />
            <span className="relative size-2 rounded-full bg-brand" />
          </span>
          <span>
            <span className="num me-1.5 font-semibold text-paper">{num(data.ct_certs_watched)}</span>
            <T k="ctWatched" />
          </span>
        </p>
      ) : null}
    </section>
  )
}

function TrendingPreview() {
  const { data, loading } = useAsync(() => api.trending(), [])
  const items = data?.slice(0, 4) ?? []
  if (!loading && items.length === 0) return null
  return (
    <section className="min-w-0">
      <div className="mb-3 flex items-end justify-between gap-4 px-1">
        <Tx k="trendingTitle" as="h2" className="text-xl font-bold tracking-tight text-paper" split="stack" />
        <Link to="/trending" className="shrink-0 text-sm font-semibold text-brand-bright hover:underline">
          <T k="seeAll" />
        </Link>
      </div>
      <div className="rounded-3xl border border-ink-700 bg-ink-850/70 p-1.5">
        {loading
          ? Array.from({ length: 3 }, (_, i) => <div key={i} className="m-2 h-14 animate-pulse rounded-2xl bg-ink-800" />)
          : items.map((item) => <TrendingRow key={item.domain} item={item} />)}
      </div>
    </section>
  )
}

function ProtectCta() {
  return (
    <Link
      to="/protect"
      className="group relative flex flex-col gap-6 overflow-hidden rounded-3xl border border-brand/30 bg-gradient-to-b from-brand-deep/25 to-ink-850 p-6 transition-colors hover:border-brand/60 sm:flex-row sm:items-center lg:flex-col lg:items-stretch"
    >
      <div className="min-w-0 flex-1">
        <span className="inline-grid size-11 place-items-center rounded-2xl bg-brand/15 text-brand-bright">
          <ShieldCheck className="size-6" aria-hidden="true" />
        </span>
        <Tx k="protectCtaTitle" as="h2" className="mt-4 text-xl font-bold leading-snug text-paper" split="stack" />
        <Tx k="protectCtaBody" className="mt-2 text-sm leading-relaxed text-mist-300" split="stack" />
        <span className="mt-5 inline-flex items-center gap-2 rounded-full bg-paper px-5 py-2.5 text-sm font-bold text-ink-900">
          <T k="navProtect" />
          <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5 rtl:rotate-180" aria-hidden="true" />
        </span>
      </div>
      <div className="shrink-0 scale-90 sm:scale-100">
        <ProtectIllustration />
      </div>
    </Link>
  )
}

export function Home() {
  const [params] = useSearchParams()
  return (
    <>
      <section className="relative overflow-hidden">
        <div
          className="guilloche pointer-events-none absolute inset-0 [mask-image:radial-gradient(ellipse_at_70%_30%,black_10%,transparent_70%)]"
          aria-hidden="true"
        />
        <div className="relative mx-auto grid max-w-6xl grid-cols-[minmax(0,1fr)] gap-y-7 px-4 pt-8 pb-10 [grid-template-areas:'tag''comp''sub'] sm:px-6 md:pt-16 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-x-14 lg:gap-y-5 lg:pt-24 lg:pb-20 lg:[grid-template-areas:'tag_comp''sub_comp']">
          <div className="[grid-area:tag] lg:self-end">
            <Tagline />
          </div>
          <div className="[grid-area:comp] lg:self-center">
            <Composer initial={params.get('u') ?? ''} />
          </div>
          <div className="[grid-area:sub]">
            <Tx k="heroSub" className="max-w-xl text-[15px] leading-relaxed text-mist-300 sm:text-base" split="stack" />
          </div>
        </div>
      </section>
      <StatsStrip />
      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-10 sm:px-6 lg:grid-cols-[1.4fr_1fr] lg:py-16">
        <TrendingPreview />
        <ProtectCta />
      </div>
    </>
  )
}
