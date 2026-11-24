import { Link } from 'react-router'
import { ChevronRight, Clock } from 'lucide-react'
import { BrandMark } from './BrandMark'
import { ChannelIcon, CHANNEL_COLOR, isChannel } from './ChannelIcon'
import { VerdictChip } from './VerdictChip'
import { T, Tx } from '../lib/lang'
import { reportsShort, timeAgo } from '../lib/format'
import type { TrendingItem } from '../lib/types'

export function ChannelBar({ channels }: { channels: Record<string, number> }) {
  const entries = Object.entries(channels)
    .filter(([, n]) => n > 0)
    .sort((a, b) => b[1] - a[1])
  const total = entries.reduce((s, [, n]) => s + n, 0)
  if (!total) return null
  return (
    <div>
      <div className="flex h-1.5 overflow-hidden rounded-full bg-ink-700">
        {entries.map(([ch, n]) => (
          <span
            key={ch}
            style={{ width: `${(n / total) * 100}%`, background: isChannel(ch) ? CHANNEL_COLOR[ch] : '#94A3B8' }}
          />
        ))}
      </div>
      <ul className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-mist-300">
        {entries.map(([ch, n]) => (
          <li key={ch} className="inline-flex items-center gap-1">
            {isChannel(ch) && (
              <span style={{ color: CHANNEL_COLOR[ch] }}>
                <ChannelIcon channel={ch} className="size-3.5" />
              </span>
            )}
            {isChannel(ch) ? <T k={`ch_${ch}`} /> : ch}
            <span className="num font-semibold text-paper">{n}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

function itemLink(item: TrendingItem): string {
  return item.scan_id ? `/scan/${encodeURIComponent(item.scan_id)}` : `/?u=${encodeURIComponent(item.url)}`
}

export function TrendingRow({ item }: { item: TrendingItem }) {
  const r = reportsShort(item.reports_24h)
  return (
    <Link
      to={itemLink(item)}
      className="group flex items-center gap-3.5 rounded-2xl px-3 py-3 transition-colors hover:bg-ink-800"
    >
      <BrandMark brand={item.brand} />
      <div className="min-w-0 flex-1">
        <Tx text={item.headline} className="line-clamp-2 text-[15px] font-semibold leading-snug text-paper" split="stack" />
        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-mist-400">
          <span className="truncate font-mono text-mist-300" dir="ltr">{item.domain}</span>
          <span className="inline-flex items-center gap-1 text-scam">
            <T text={r} />
          </span>
        </div>
      </div>
      <ChevronRight className="size-4 shrink-0 text-mist-500 transition-transform group-hover:translate-x-0.5 rtl:rotate-180" aria-hidden="true" />
    </Link>
  )
}

export function TrendingCard({ item }: { item: TrendingItem }) {
  const first = timeAgo(item.first_seen)
  return (
    <Link
      to={itemLink(item)}
      className="group block rounded-3xl border border-ink-600 bg-ink-800 p-5 transition-colors hover:border-ink-500"
    >
      <div className="flex items-start gap-4">
        <BrandMark brand={item.brand} className="size-12" />
        <div className="min-w-0 flex-1">
          <Tx text={item.headline} className="text-[17px] font-bold leading-snug text-paper" split="stack" />
          <p className="mt-1.5 truncate font-mono text-sm text-mist-300" dir="ltr">
            {item.domain}
          </p>
        </div>
        <VerdictChip verdict={item.verdict} score={item.score} />
      </div>
      <div className="mt-5 grid grid-cols-2 gap-3 text-sm">
        <div className="rounded-2xl bg-ink-750 px-4 py-3">
          <div className="num text-2xl font-bold text-scam">{item.reports_24h}</div>
          <div className="mt-0.5 text-xs text-mist-400">
            <T k="reports24h" />
          </div>
        </div>
        <div className="rounded-2xl bg-ink-750 px-4 py-3">
          <div className="flex items-center gap-1.5 text-xs text-mist-400">
            <Clock className="size-3.5" aria-hidden="true" />
            <T k="firstSeen" />
          </div>
          <div className="mt-1 text-sm font-semibold text-paper">
            <T text={first} />
          </div>
        </div>
      </div>
      <div className="mt-4">
        <ChannelBar channels={item.channels} />
      </div>
    </Link>
  )
}
