import type { ReactNode } from 'react'
import { Link } from 'react-router'
import { ArrowRight, Radar } from 'lucide-react'
import { motion } from 'motion/react'
import { BrandMark, brandName } from './BrandMark'
import { ChannelIcon, channelColor, isChannel } from './ChannelIcon'
import { T, Tx } from '../lib/lang'
import { defang, shortAgo } from '../lib/format'
import { T_LAYOUT } from '../lib/motion'
import type { StringKey } from '../lib/i18n'
import type { TrendingItem } from '../lib/types'
import { VERDICT_COLOR, VERDICT_LABEL } from '../lib/verdict'

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

function Fact({ value, label, tone = 'text-paper' }: { value: ReactNode; label: StringKey; tone?: string }) {
  return (
    <div className="min-w-0 rounded-xl bg-ink-900 px-3 py-3">
      <p className={`display num truncate text-2xl leading-none ${tone}`}>{value}</p>
      <p className="mt-1.5 text-xs text-paper-3">
        <T k={label} />
      </p>
    </div>
  )
}

/** One scam as a card: who it copies, the address, how many people met it, and how it reaches them. */
export function TrendingFeature({ item, rank }: { item: TrendingItem; rank: number }) {
  const name = brandName(item.brand)
  const color = VERDICT_COLOR[item.verdict]
  const channels = Object.entries(item.channels)
    .filter(([, n]) => n > 0)
    .sort((a, b) => b[1] - a[1])
  return (
    <motion.li layout transition={T_LAYOUT}>
      <Link to={itemLink(item)} className="hover-lift group flex h-full flex-col rounded-2xl bg-ink-850 p-5 sm:p-6">
        <div className="flex items-center gap-3">
          <span className="display num grid size-9 shrink-0 place-items-center rounded-full bg-paper text-sm text-ink-950">{rank}</span>
          <BrandMark brand={item.brand} className="size-11" />
          <p className="min-w-0 flex-1 truncate text-sm text-paper-2">{name && <T text={name} />}</p>
          <span className="shrink-0 rounded-full px-3 py-1 text-xs text-white" style={{ background: color }}>
            <T k={VERDICT_LABEL[item.verdict]} />
          </span>
        </div>

        <Tx text={item.headline} as="h3" className="display mt-4 text-xl text-paper transition-colors group-hover:text-gold sm:text-2xl" />
        <p className="evidence mt-3 self-start rounded-lg bg-scam/10 px-3 py-1.5 text-sm break-all text-scam" dir="ltr">
          {defang(item.domain)}
        </p>

        <div className="mt-5 grid grid-cols-3 gap-2">
          <Fact value={item.score} label="trRisk" tone="text-scam" />
          <Fact value={item.reports_24h} label="trToday" />
          <Fact value={shortAgo(item.first_seen)} label="trSeen" />
        </div>

        <div className="mt-4 flex flex-1 flex-wrap items-center gap-2 text-sm">
          {channels.length > 0 ? (
            <>
              <span className="text-paper-3">
                <T k="trVia" />
              </span>
              {channels.map(([ch, n]) => (
                <span key={ch} className="inline-flex items-center gap-1.5 rounded-full bg-ink-800 px-3 py-1 text-paper">
                  {isChannel(ch) && <ChannelIcon channel={ch} className="size-4" />}
                  {isChannel(ch) ? <T k={`ch_${ch}`} /> : ch}
                  <span className="num text-paper-3">{n}</span>
                </span>
              ))}
            </>
          ) : (
            <span className="inline-flex items-center gap-2 text-paper-3">
              <Radar className="size-4 shrink-0 text-gold" aria-hidden="true" />
              <T k="trHunted" />
            </span>
          )}
        </div>

        <span className="mt-5 inline-flex items-center gap-2 border-t border-line pt-4 text-sm text-gold">
          <T k="trOpen" />
          <ArrowRight className="size-4 transition-transform group-hover:translate-x-1 rtl:rotate-180" aria-hidden="true" />
        </span>
      </Link>
    </motion.li>
  )
}
