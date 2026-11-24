import { Users } from 'lucide-react'
import { Section } from './Section'
import { ChannelBar } from '../TrendingCard'
import { T, Tx } from '../../lib/lang'
import { reportsCount } from '../../lib/format'
import type { CommunityStats } from '../../lib/types'

const STATUS_COLOR = {
  confirmed: '#ef4444',
  pending: '#f59e0b',
  rejected: '#94a3b8',
  none: '#94a3b8',
} as const

export function CommunityPanel({ community }: { community: CommunityStats }) {
  const color = STATUS_COLOR[community.status]
  return (
    <Section
      icon={Users}
      title="communityTitle"
      aside={
        community.status !== 'none' ? (
          <span className="shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold" style={{ color, background: `${color}1a` }}>
            <T k={`status_${community.status}`} />
          </span>
        ) : null
      }
    >
      {community.reports > 0 ? (
        <>
          <p className="text-2xl font-bold tracking-tight text-paper">
            <T text={reportsCount(community.reports)} stacked={false} />
          </p>
          {community.last_24h > 0 && (
            <p className="mt-1 text-sm text-mist-400">
              <span className="num font-semibold text-scam">{community.last_24h} </span>
              <T k="inLast24h" />
            </p>
          )}
          <div className="mt-4">
            <ChannelBar channels={community.channels} />
          </div>
        </>
      ) : (
        <Tx k="noReports" className="text-sm text-mist-400" split="stack" />
      )}
    </Section>
  )
}
