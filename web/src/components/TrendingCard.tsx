import { Link } from 'react-router'
import { motion } from 'motion/react'
import { BrandMark, brandName } from './BrandMark'
import { ChannelIcon, channelColor, isChannel } from './ChannelIcon'
import { T, Tx } from '../lib/lang'
import { defang, timeAgo } from '../lib/format'
import { T_LAYOUT } from '../lib/motion'
import type { TrendingItem } from '../lib/types'
import { VERDICT_COLOR } from '../lib/verdict'

export function ChannelBar({ channels }: { channels: Record<string, number> }) {
  const entries = Object.entries(channels)
    .filter(([, n]) => n > 0)
    .sort((a, b) => b[1] - a[1])
  const total = entries.reduce((s, [, n]) => s + n, 0)
  if (!total) return null
  return (
    <div>
      <div className="flex h-1 gap-0.5 overflow-hidden rounded-full">
        {entries.map(([ch, n]) => (
          <motion.span
            key={ch}
            className="h-full origin-left rounded-full"
            initial={{ scaleX: 0 }}
            whileInView={{ scaleX: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, ease: [0.23, 1, 0.32, 1] }}
            style={{ width: `${(n / total) * 100}%`, background: isChannel(ch) ? channelColor(ch) : '#8c867c' }}
          />
        ))}
      </div>
      <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-paper-2">
        {entries.map(([ch, n]) => (
          <li key={ch} className="inline-flex items-center gap-2">
            {isChannel(ch) && <ChannelIcon channel={ch} className="size-4" />}
            {isChannel(ch) ? <T k={`ch_${ch}`} /> : ch}
            <span className="evidence num text-paper">{n}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

function itemLink(item: TrendingItem): string {
  return item.scan_id ? `/scan/${encodeURIComponent(item.scan_id)}` : `/?u=${encodeURIComponent(item.url)}`
}

export function TrendingRow({ item, rank }: { item: TrendingItem; rank?: number }) {
  const color = VERDICT_COLOR[item.verdict]
  return (
    <motion.li layout transition={T_LAYOUT} className="border-t border-line first:border-t-0">
      <Link to={itemLink(item)} className="group grid grid-cols-[auto_1fr_auto] items-center gap-4 py-4">
        <span className="flex items-center gap-4">
          {rank != null && <span className="evidence num hidden w-6 text-sm text-paper-3 sm:inline">{String(rank).padStart(2, '0')}</span>}
          <BrandMark brand={item.brand} className="size-10" />
        </span>
        <span className="min-w-0">
          <Tx text={item.headline} as="span" className="block max-w-[56ch] text-base font-medium text-paper transition-colors group-hover:text-gold" split="stack" />
          <span className="evidence mt-1 block truncate text-sm text-paper-3">{defang(item.domain)}</span>
        </span>
        <span className="text-end">
          <span className="evidence num block text-lg" style={{ color }}>
            {item.score}
          </span>
          <span className="block text-xs text-paper-3">
            <span className="num">{item.reports_24h}</span> <T k="reports24h" />
          </span>
        </span>
      </Link>
    </motion.li>
  )
}

export function TrendingFeature({ item, rank }: { item: TrendingItem; rank: number }) {
  const name = brandName(item.brand)
  const color = VERDICT_COLOR[item.verdict]
  return (
    <motion.li layout transition={T_LAYOUT} className="border-t border-line">
      <Link to={itemLink(item)} className="group grid-12 gap-y-4 py-8">
        <span className="evidence num col-span-4 text-sm text-gold sm:col-span-1">{String(rank).padStart(2, '0')}</span>
        <div className="col-span-4 flex items-start gap-4 sm:col-span-7 lg:col-span-6">
          <BrandMark brand={item.brand} className="size-12" />
          <div className="min-w-0">
            {name && (
              <p className="text-sm text-paper-3">
                <T text={name} />
              </p>
            )}
            <Tx text={item.headline} as="h3" className="display mt-1 max-w-[40ch] text-xl text-paper transition-colors group-hover:text-gold" arClassName="text-lg" split="stack" />
            <p className="evidence mt-2 truncate text-sm" style={{ color }}>
              {defang(item.domain)}
            </p>
          </div>
        </div>
        <div className="col-span-4 sm:col-span-5 sm:col-start-2 lg:col-span-3 lg:col-start-auto">
          <ChannelBar channels={item.channels} />
        </div>
        <div className="col-span-4 flex items-baseline gap-6 sm:col-span-3 lg:col-span-2 lg:flex-col lg:items-end lg:gap-1 lg:text-end">
          <span>
            <span className="evidence num text-2xl text-scam">{item.reports_24h}</span>
            <span className="ms-2 text-sm text-paper-3 lg:ms-0 lg:block">
              <T k="reports24h" />
            </span>
          </span>
          <span className="text-xs text-paper-3">
            <T k="firstSeen" /> <T text={timeAgo(item.first_seen)} />
          </span>
        </div>
      </Link>
    </motion.li>
  )
}
