import { Fragment } from 'react'
import { Link, useSearchParams } from 'react-router'
import { motion } from 'motion/react'
import { ArrowRight } from 'lucide-react'
import { Composer } from '../components/Composer'
import { LiveRadar, LiveStrip } from '../components/LiveRadar'
import { ProtectIllustration } from '../components/ProtectIllustration'
import { TrendingRow } from '../components/TrendingCard'
import { BrandMark } from '../components/BrandMark'
import { Reveal, Stagger, StaggerItem } from '../components/motion'
import { SectionHead, btn } from '../components/ui'
import { Skeleton } from '../components/States'
import { T, Tx, useLang } from '../lib/lang'
import { api } from '../lib/api'
import { fill, S, type StringKey } from '../lib/i18n'
import { EASE_OUT } from '../lib/motion'
import { useAsync } from '../lib/useAsync'
import { useLive } from '../lib/useLive'
import type { BrandRef } from '../lib/types'

function Headline() {
  const { mode } = useLang()
  const [first, second] = S.tagline.en.split('. ')
  return (
    <h1>
      {mode !== 'ar' && (
        <motion.span
          className="display block text-4xl text-paper sm:text-5xl xl:text-6xl"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: EASE_OUT }}
        >
          {first}.
          <span className="text-grad block">{second}</span>
        </motion.span>
      )}
      {mode !== 'en' && (
        <motion.span
          lang="ar"
          dir="rtl"
          className={`display block ${mode === 'ar' ? 'text-4xl text-paper sm:text-5xl' : 'mt-4 text-right text-2xl text-paper-2 sm:text-3xl'}`}
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: EASE_OUT, delay: 0.08 }}
        >
          {S.tagline.ar}
        </motion.span>
      )}
    </h1>
  )
}

const STEPS: { title: StringKey; body: StringKey }[] = [
  { title: 'how1t', body: 'how1d' },
  { title: 'how2t', body: 'how2d' },
  { title: 'how3t', body: 'how3d' },
]

function HowItWorks() {
  return (
    <section className="shell py-8 lg:py-10">
      <SectionHead title="howTitle" />
      <Stagger className="mt-10 flex flex-col items-stretch gap-3 lg:flex-row" gap={0.1}>
        {STEPS.map((s, i) => (
          <Fragment key={s.title}>
            {i > 0 && (
              <StaggerItem className="grid shrink-0 place-items-center">
                <span className="grid size-11 place-items-center rounded-full bg-linear-to-r from-[#5a48f2] to-[#8a4df0] text-white shadow-[0_10px_24px_-10px_rgb(90_72_242/0.7)]">
                  <ArrowRight className="size-5 rotate-90 lg:rotate-0 lg:rtl:rotate-180" aria-hidden="true" />
                </span>
              </StaggerItem>
            )}
            <StaggerItem className="flex-1 rounded-2xl bg-ink-850 p-6 lg:p-7">
              <span className="text-grad display text-5xl">{i + 1}</span>
              <Tx k={s.title} as="h3" className="display mt-4 text-xl text-paper" />
              <Tx k={s.body} className="mt-2 text-base text-paper-2" />
            </StaggerItem>
          </Fragment>
        ))}
      </Stagger>
    </section>
  )
}

function BrandWall({ brands }: { brands: BrandRef[] }) {
  const row = brands.length ? brands : null
  return (
    <section className="py-8 lg:py-10">
      <div className="shell">
        <SectionHead title="brandsTitle" />
        <Tx text={fill(S.brandsSub, { n: brands.length || 49 })} className="mt-4 max-w-[60ch] text-base text-paper-2" />
      </div>
      <div className="marquee mt-10" dir="ltr">
        {row ? (
          <div className="marquee-track" style={{ animationDuration: `${row.length * 2.2}s` }}>
            {[...row, ...row].map((b, i) => (
              <div key={`${b.id}-${i}`} className="w-20 shrink-0 sm:w-24" title={b.name_en} aria-hidden={i >= row.length}>
                <BrandMark brand={b} className="aspect-square w-full p-3" />
              </div>
            ))}
          </div>
        ) : (
          <div className="shell">
            <Skeleton className="h-24" />
          </div>
        )}
      </div>
    </section>
  )
}

function TrendingPreview() {
  const { data, loading } = useAsync(() => api.trending(), [])
  const items = data?.slice(0, 5) ?? []
  if (!loading && items.length === 0) return null
  return (
    <section className="shell py-8 lg:py-10">
      <SectionHead
        title="trendingTitle"
        sub="trendingSub"
        aside={
          <Link to="/trending" className="inline-flex items-center gap-2 text-sm font-medium text-gold hover:underline">
            <T k="seeAll" />
            <ArrowRight className="size-4 rtl:rotate-180" aria-hidden="true" />
          </Link>
        }
      />
      <ul className="mt-8 border-y border-line">
        {loading
          ? Array.from({ length: 3 }, (_, i) => (
              <li key={i} className="py-4">
                <Skeleton className="h-12" />
              </li>
            ))
          : items.map((item, i) => <TrendingRow key={item.domain} item={item} rank={i + 1} />)}
      </ul>
    </section>
  )
}

function ProtectBand() {
  return (
    <section className="px-3 sm:px-6">
      <div className="zone-dark field-night grid-12 mx-auto max-w-[1232px] items-center gap-y-10 rounded-[2rem] px-6 py-10 sm:px-10 lg:px-14 lg:py-12">
        <Reveal className="col-span-4 sm:col-span-8 lg:col-span-6">
            <Tx k="protectCtaTitle" as="h2" className="display text-3xl text-paper sm:text-4xl" arClassName="text-2xl text-paper-2 sm:text-3xl" split="stack" />
          <Tx k="protectCtaBody" className="mt-4 max-w-[52ch] text-lg text-paper-2" split="stack" />
          <Link to="/protect" className={`${btn.primary} mt-8`}>
            <T k="navProtect" />
            <ArrowRight className="size-4 rtl:rotate-180" aria-hidden="true" />
          </Link>
        </Reveal>
        <Reveal className="col-span-4 sm:col-span-8 lg:col-span-5 lg:col-start-8" delay={0.1}>
          <ProtectIllustration />
        </Reveal>
      </div>
    </section>
  )
}

function FamilyBand() {
  return (
    <section className="px-3 py-6 sm:px-6">
      <div className="field-dawn grid-12 mx-auto max-w-[1232px] items-center gap-y-8 rounded-[2rem] px-6 py-10 sm:px-10 lg:px-14 lg:py-12">
        <Reveal className="col-span-4 sm:col-span-8 lg:col-span-7">
            <Tx k="famBandTitle" as="h2" className="display text-3xl text-paper sm:text-4xl" arClassName="text-2xl text-paper-2 sm:text-3xl" split="stack" />
          <Tx k="famBandBody" className="mt-4 max-w-[56ch] text-lg text-paper-2" split="stack" />
        </Reveal>
        <Reveal className="col-span-4 sm:col-span-8 lg:col-span-4 lg:col-start-9 lg:justify-self-end" delay={0.1}>
          <Link to="/family" className={btn.primary}>
            <T k="famBandCta" />
            <ArrowRight className="size-4 rtl:rotate-180" aria-hidden="true" />
          </Link>
        </Reveal>
      </div>
    </section>
  )
}

export function Home() {
  const [params] = useSearchParams()
  const feed = useLive(5000)
  const { data: brands } = useAsync(() => api.brands(), [])
  return (
    <>
      <section className="shell grid-12 gap-y-10 pt-8 pb-8 lg:pt-10 lg:pb-10">
        <div className="col-span-4 sm:col-span-8 lg:col-span-7">
          <Headline />
          <div className="mt-8 lg:mt-10">
            <Composer initial={params.get('u') ?? ''} openQr={params.get('qr') === '1'} />
          </div>
          <Tx k="heroSub" className="mt-8 max-w-[60ch] text-base text-paper-2" split="stack" />
        </div>
        <div className="col-span-4 sm:col-span-8 lg:col-span-4 lg:col-start-9">
          <LiveRadar feed={feed} />
        </div>
      </section>
      <div className="shell">
        <LiveStrip feed={feed} brandsCount={brands?.length ?? 0} />
      </div>
      <HowItWorks />
      <BrandWall brands={brands ?? []} />
      <TrendingPreview />
      <ProtectBand />
      <FamilyBand />
    </>
  )
}
