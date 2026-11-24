import { BadgeAlert, CalendarPlus, FileBadge, Flag, History, Megaphone, Radar, ScanSearch, ShieldBan, type LucideIcon } from 'lucide-react'
import { Section } from './Section'
import { T, Tx } from '../../lib/lang'
import { dateTime, timeAgo, toMs } from '../../lib/format'
import type { TimelineEvent } from '../../lib/types'

const ICONS: Record<string, LucideIcon> = {
  registered: CalendarPlus,
  certificate: FileBadge,
  detected: Radar,
  campaign: Megaphone,
  report: Flag,
  confirmed: ShieldBan,
  blocked: ShieldBan,
  scan: ScanSearch,
}

export function Timeline({ events, scam }: { events: TimelineEvent[]; scam: boolean }) {
  const sorted = [...events].sort((a, b) => toMs(a.ts) - toMs(b.ts))
  return (
    <Section icon={History} title={scam ? 'timelineScam' : 'timelineSafe'}>
      <ol className="relative">
        {sorted.map((e, i) => {
          const Icon = ICONS[e.kind] ?? BadgeAlert
          const last = i === sorted.length - 1
          return (
            <li key={`${e.ts}-${i}`} className="relative flex gap-3.5 pb-5 last:pb-0">
              {!last && <span className="absolute start-[15px] top-8 bottom-0 w-px bg-ink-600" aria-hidden="true" />}
              <span
                className={`relative grid size-8 shrink-0 place-items-center rounded-full border ${
                  last ? 'border-brand bg-brand/15 text-brand-bright' : 'border-ink-500 bg-ink-800 text-mist-300'
                }`}
              >
                <Icon className="size-4" aria-hidden="true" />
              </span>
              <div className="min-w-0 pt-1">
                <Tx text={e.label} className="text-sm font-semibold leading-snug text-paper" split="stack" />
                <p className="mt-1 text-xs text-mist-500">
                  <T text={timeAgo(e.ts)} />
                  <span className="num ms-2 text-mist-500/80" dir="ltr">
                    {dateTime(e.ts)}
                  </span>
                </p>
              </div>
            </li>
          )
        })}
      </ol>
    </Section>
  )
}
