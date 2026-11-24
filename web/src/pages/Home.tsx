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
          <span className="block text-paper-2">{second}</span>
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
    <section className="shell py-16 lg:py-24">
      <SectionHead index={1} title="howTitle" />
      <Stagger className="grid-12 mt-12 gap-y-8" gap={0.08}>
        {STEPS.map((s, i) => (
          <StaggerItem key={s.title} className="col-span-4 border-t border-line pt-6 sm:col-span-8 lg:col-span-4">
            <span className="display text-4xl text-gold">{i + 1}</span>
            <Tx k={s.title} as="h3" className="display mt-4 text-xl text-paper" split="stack" />
            <Tx k={s.body} className="mt-2 max-w-[44ch] text-base text-paper-2" split="stack" />
          </StaggerItem>
        ))}
      </Stagger>
    </section>
  )
}

function BrandWall({ brands }: { brands: BrandRef[] }) {
  return (
    <section className="border-t border-line bg-ink-850">
      <div className="shell py-16 lg:py-24">
        <SectionHead index={2} title="brandsTitle" />
        <Tx text={fill(S.brandsSub, { n: brands.length || 49 })} className="mt-4 max-w-[60ch] text-base text-paper-2" split="stack" />
        <Stagger className="mt-12 grid grid-cols-4 gap-2 sm:grid-cols-7 lg:grid-cols-10" gap={0.015}>
          {brands.length === 0
            ? Array.from({ length: 20 }, (_, i) => (
                <StaggerItem key={i}>
                  <Skeleton className="aspect-square" />
                </StaggerItem>
              ))
            : brands.map((b) => (
                <StaggerItem key={b.id}>
                  <div className="hover-lift group relative" title={b.name_en}>
                    <BrandMark brand={b} className="aspect-square w-full p-2 sm:p-3" />
                  </div>
                </StaggerItem>
              ))}
        </Stagger>
      </div>
    </section>
  )
}

function TrendingPreview() {
  const { data, loading } = useAsync(() => api.trending(), [])
  const items = data?.slice(0, 5) ?? []
  if (!loading && items.length === 0) return null
  return (
    <section className="shell py-16 lg:py-24">
      <SectionHead
        index={3}
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
    <section className="border-t border-line bg-gold-ink">
      <div className="shell grid-12 items-center gap-y-12 py-16 lg:py-24">
        <Reveal className="col-span-4 sm:col-span-8 lg:col-span-6">
          <div className="flex items-baseline gap-4">
            <span className="evidence shrink-0 text-sm text-gold">04</span>
            <Tx k="protectCtaTitle" as="h2" className="display text-3xl text-paper sm:text-4xl" arClassName="text-2xl text-paper-2 sm:text-3xl" split="stack" />
          </div>
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
    <section className="border-t border-line">
      <div className="shell grid-12 items-center gap-y-8 py-16 lg:py-20">
        <Reveal className="col-span-4 sm:col-span-8 lg:col-span-7">
          <div className="flex items-baseline gap-4">
            <span className="evidence shrink-0 text-sm text-gold">05</span>
            <Tx k="famBandTitle" as="h2" className="display text-3xl text-paper sm:text-4xl" arClassName="text-2xl text-paper-2 sm:text-3xl" split="stack" />
          </div>
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
      <section className="shell grid-12 gap-y-12 pt-12 pb-16 lg:pt-20 lg:pb-24">
        <div className="col-span-4 sm:col-span-8 lg:col-span-7">
          <Headline />
          <div className="mt-8 lg:mt-12">
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
