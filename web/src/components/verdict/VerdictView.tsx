import { motion, useReducedMotion } from 'motion/react'
import { VerdictHero } from './VerdictHero'
import { ActionsBar } from './ActionsBar'
import { WhatToDo } from './WhatToDo'
import { BrandCard } from './BrandCard'
import { DomainDiff } from './DomainDiff'
import { RealVsFake } from './RealVsFake'
import { AnnotatedShot } from './AnnotatedShot'
import { ExfilLeads } from './ExfilLeads'
import { Signals } from './Signals'
import { CloakingPanel } from './CloakingPanel'
import { RedirectChain } from './RedirectChain'
import { DomainIntelPanel } from './DomainIntelPanel'
import { Timeline } from './Timeline'
import { CampaignGraph } from './CampaignGraph'
import { AiJudges } from './AiJudges'
import { CommunityPanel } from './CommunityPanel'
import { MessageAnalysisCard } from './MessageAnalysisCard'
import { hostOf } from '../../lib/format'
import type { MessageAnalysis, ScanResult } from '../../lib/types'

interface Props {
  result: ScanResult
  message?: MessageAnalysis | null
  animated?: boolean
  showActions?: boolean
  onReported?: () => void
}

export function VerdictView({ result, message, animated = false, showActions = true, onReported }: Props) {
  const reduce = useReducedMotion()
  const play = animated && !reduce
  const risky = result.verdict === 'scam' || result.verdict === 'suspicious'
  const page = result.page
  const shot = page?.screenshot_url ? { ...page, screenshot_url: page.screenshot_url } : null
  const reference = result.brand?.reference_screenshot_url
  const intel = result.domain_intel
  const hasIntel = intel.age_days != null || !!intel.registrar || !!intel.as_org || !!intel.tls_issuer
  const shotAspect = page?.width && page.height ? page.width / Math.min(page.height, page.width * 2.2) : 0.6
  const finalHost = result.final_url ? hostOf(result.final_url) : result.domain

  const brandCard = result.brand ? <BrandCard brand={result.brand} verdict={result.verdict} /> : null

  const main = (
    <>
      {brandCard && <div className="lg:hidden">{brandCard}</div>}
      {risky && result.domain_diff && <DomainDiff diff={result.domain_diff} />}
      {risky && shot && reference && result.brand && (
        <RealVsFake
          officialSrc={reference}
          officialHost={result.brand.official_domains[0] ?? ''}
          fakeSrc={shot.screenshot_url}
          fakeHost={finalHost}
          aspect={shotAspect}
        />
      )}
      {shot && shot.annotations.length > 0 && <AnnotatedShot page={shot} />}
      {result.exfil.length > 0 && <ExfilLeads leads={result.exfil} asksFor={page?.asks_for ?? []} />}
      <Signals signals={result.signals} verdict={result.verdict} />
      {result.cloaking.detected && result.cloaking.personas.length > 0 && <CloakingPanel cloaking={result.cloaking} />}
    </>
  )

  const side = (
    <>
      {brandCard && <div className="hidden lg:block">{brandCard}</div>}
      {(risky || result.community.reports > 0) && <CommunityPanel community={result.community} />}
      {result.redirect_chain.length > 1 && <RedirectChain hops={result.redirect_chain} danger={risky} />}
      {hasIntel && <DomainIntelPanel intel={intel} />}
      {result.ai.length > 0 && <AiJudges opinions={result.ai} />}
      {result.campaign && result.campaign.nodes.length > 1 && <CampaignGraph campaign={result.campaign} focus={result.domain} />}
      {result.timeline.length > 0 && <Timeline events={result.timeline} scam={risky} />}
    </>
  )

  return (
    <div className="space-y-4 sm:space-y-5">
      <VerdictHero result={result} animated={play} />
      <motion.div
        className="space-y-4 sm:space-y-5"
        initial={play ? { opacity: 0, y: 18 } : false}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, delay: play ? 1.55 : 0, ease: 'easeOut' }}
      >
        {showActions && <ActionsBar result={result} onReported={onReported} />}
        <WhatToDo verdict={result.verdict} />
        {message && <MessageAnalysisCard message={message} />}
        <div className="grid items-start gap-4 sm:gap-5 lg:grid-cols-12">
          <div className="space-y-4 sm:space-y-5 lg:col-span-7">{main}</div>
          <div className="space-y-4 sm:space-y-5 lg:col-span-5">{side}</div>
        </div>
      </motion.div>
    </div>
  )
}
