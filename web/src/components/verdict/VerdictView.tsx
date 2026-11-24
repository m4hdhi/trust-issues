import { lazy, Suspense, type ReactNode } from 'react'
import { motion, useReducedMotion } from 'motion/react'
import { VerdictHero } from './VerdictHero'
import { ActionsBar } from './ActionsBar'
import { WhatToDo } from './WhatToDo'
import { Exhibit } from './Exhibit'
import { BrandPanel } from './BrandPanel'
import { DomainDiff } from './DomainDiff'
import { RealVsFake } from './RealVsFake'
import { AnnotatedShot } from './AnnotatedShot'
import { ExfilLeads } from './ExfilLeads'
import { Signals } from './Signals'
import { CloakingPanel } from './CloakingPanel'
import { RedirectChain } from './RedirectChain'
import { DomainIntelPanel } from './DomainIntelPanel'
import { Timeline } from './Timeline'
import { AiJudges } from './AiJudges'
import { CommunityPanel } from './CommunityPanel'
import { MessageAnalysisCard } from './MessageAnalysisCard'
import { Skeleton } from '../States'
import { hostOf, networkOf } from '../../lib/format'
import { EASE_OUT } from '../../lib/motion'
import type { StringKey } from '../../lib/i18n'
import type { Bilingual, MessageAnalysis, ScanResult } from '../../lib/types'

const CampaignGraph = lazy(() => import('./CampaignGraph').then((m) => ({ default: m.CampaignGraph })))

interface Props {
  result: ScanResult
  message?: MessageAnalysis | null
  animated?: boolean
  showActions?: boolean
  onReported?: () => void
}

interface ExhibitDef {
  key: string
  title?: StringKey
  titleText?: Bilingual
  sub?: StringKey
  danger?: boolean
  body: ReactNode
}

export function VerdictView({ result, message, animated = false, showActions = true, onReported }: Props) {
  const reduce = useReducedMotion()
  const play = animated && !reduce
  const risky = result.verdict === 'scam' || result.verdict === 'suspicious'
  const page = result.page
  const shot = page?.screenshot_url ? { ...page, screenshot_url: page.screenshot_url } : null
  const brand = result.brand
  const reference = brand?.reference_screenshot_url ?? null
  const intel = result.domain_intel
  const hasIntel = intel.age_days != null || !!intel.registrar || !!intel.as_org || !!intel.tls_issuer
  const finalHost = result.final_url ? hostOf(result.final_url) : result.domain
  const sites = result.campaign?.nodes.filter((n) => n.kind === 'domain').length ?? 0

  const exhibits: ExhibitDef[] = []
  if (brand || (risky && result.domain_diff)) {
    exhibits.push({
      key: 'brand',
      title: risky ? (result.domain_diff ? 'spotDifference' : 'ex_brand_fake') : 'ex_brand_real',
      sub: risky && result.domain_diff ? 'spotDifferenceSub' : undefined,
      body: (
        <div className="space-y-8">
          {brand && <BrandPanel brand={brand} />}
          {risky && result.domain_diff && <DomainDiff diff={result.domain_diff} />}
        </div>
      ),
    })
  }
  if (risky && reference && brand) {
    exhibits.push({
      key: 'realfake',
      title: 'realVsFake',
      sub: shot ? 'realVsFakeSub' : undefined,
      body: <RealVsFake officialSrc={reference} officialHost={brand.official_domains[0] ?? ''} fakeSrc={shot?.screenshot_url ?? null} fakeHost={finalHost} />,
    })
  }
  if (risky && shot && shot.annotations.length > 0) {
    exhibits.push({ key: 'asks', title: 'annotatedTitle', sub: 'annotatedSub', body: <AnnotatedShot page={shot} /> })
  }
  if (result.exfil.length > 0) {
    exhibits.push({ key: 'exfil', title: 'exfilTitle', sub: 'exfilSub', danger: true, body: <ExfilLeads leads={result.exfil} asksFor={page?.asks_for ?? []} /> })
  }
  if (result.signals.length > 0) {
    exhibits.push({
      key: 'why',
      title: result.verdict === 'safe' ? 'whyTrust' : result.verdict === 'scam' ? 'whyFlagged' : 'whyCaution',
      sub: 'whySub',
      body: <Signals signals={result.signals} safe={result.verdict === 'safe'} />,
    })
  }
  if (result.cloaking.detected && result.cloaking.personas.length > 0) {
    exhibits.push({ key: 'cloak', title: 'cloakingTitle', sub: 'cloakingSub', danger: true, body: <CloakingPanel cloaking={result.cloaking} /> })
  }
  if (result.redirect_chain.length > 1) {
    exhibits.push({ key: 'route', title: 'redirectTitle', body: <RedirectChain hops={result.redirect_chain} danger={risky} /> })
  }
  if (hasIntel) {
    exhibits.push({ key: 'intel', title: 'intelTitle', body: <DomainIntelPanel intel={intel} /> })
  }
  if (result.campaign && result.campaign.nodes.length > 1) {
    exhibits.push({
      key: 'network',
      titleText: networkOf(sites || result.campaign.size),
      body: (
        <Suspense fallback={<Skeleton className="h-[400px]" />}>
          <CampaignGraph campaign={result.campaign} focus={result.domain} />
        </Suspense>
      ),
    })
  }
  if (result.timeline.length > 0) {
    exhibits.push({ key: 'timeline', title: risky ? 'timelineScam' : 'timelineSafe', body: <Timeline events={result.timeline} /> })
  }
  if (result.ai.length > 0) {
    exhibits.push({ key: 'ai', title: 'aiTitle', sub: 'aiSub', body: <AiJudges opinions={result.ai} /> })
  }
  if (risky || result.community.reports > 0) {
    exhibits.push({ key: 'community', title: 'communityTitle', body: <CommunityPanel community={result.community} /> })
  }

  return (
    <div>
      <VerdictHero result={result} animated={play} />
      <motion.div
        initial={play ? { opacity: 0, y: 16 } : false}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: play ? 0.7 : 0, ease: EASE_OUT }}
        className="mt-8 space-y-8"
      >
        {showActions && <ActionsBar result={result} onReported={onReported} />}
        <WhatToDo verdict={result.verdict} />
      </motion.div>
      {message && (
        <div className="mt-8">
          <MessageAnalysisCard message={message} />
        </div>
      )}
      <div className="mt-8">
        {exhibits.map((ex, i) => (
          <Exhibit key={ex.key} index={i + 1} title={ex.title} titleText={ex.titleText} sub={ex.sub} tone={ex.danger ? 'danger' : 'default'}>
            {ex.body}
          </Exhibit>
        ))}
      </div>
    </div>
  )
}
