import { ChannelBar } from '../TrendingCard'
import { T, Tx } from '../../lib/lang'
import { reportsCount } from '../../lib/format'
import type { CommunityStats } from '../../lib/types'

const STATUS_COLOR = { confirmed: '#e5534b', pending: '#e3a13a', rejected: '#8c867c', none: '#8c867c' } as const

export function CommunityPanel({ community }: { community: CommunityStats }) {
  if (community.reports === 0) return <Tx k="noReports" className="text-lg text-paper-2" split="stack" />
  return (
    <div>
      <p className="display text-3xl text-paper">
        <T text={reportsCount(community.reports)} />
      </p>
      <p className="mt-2 flex flex-wrap gap-x-4 text-base text-paper-3">
        {community.last_24h > 0 && (
          <span>
            <span className="evidence num text-scam">{community.last_24h}</span> <T k="inLast24h" />
          </span>
        )}
        {community.status !== 'none' && (
          <span style={{ color: STATUS_COLOR[community.status] }}>
            <T k={`status_${community.status}`} />
          </span>
        )}
      </p>
      <div className="mt-6">
        <ChannelBar channels={community.channels} />
      </div>
    </div>
  )
}
