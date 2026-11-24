import { ExternalLink } from 'lucide-react'
import { PageHeader } from './ui'
import { CopyButton } from '../components/CopyButton'
import { Stagger, StaggerItem } from '../components/motion'
import { btn } from '../components/ui'
import { T, Tx } from '../lib/lang'
import type { StringKey } from '../lib/i18n'

const FEEDS: { path: string; title: StringKey; desc: StringKey; format: string }[] = [
  { path: '/api/feeds/domains.txt', title: 'feed_txt', desc: 'feed_txt_d', format: 'text/plain' },
  { path: '/api/feeds/rpz.zone', title: 'feed_rpz', desc: 'feed_rpz_d', format: 'text/dns' },
  { path: '/api/feeds/stix.json', title: 'feed_stix', desc: 'feed_stix_d', format: 'application/stix+json' },
]

export function Feeds() {
  const origin = window.location.origin
  return (
    <div>
      <PageHeader title="feedsTitle" sub="feedsSub" />
      <Stagger className="grid gap-x-8 lg:grid-cols-3" gap={0.06}>
        {FEEDS.map(({ path, title, desc, format }, i) => {
          const url = `${origin}${path}`
          return (
            <StaggerItem key={path} className="flex flex-col border-t border-line py-6">
              <span className="evidence text-sm text-gold">{String(i + 1).padStart(2, '0')}</span>
              <h2 className="display mt-2 text-xl text-paper">
                <T k={title} arClassName="text-lg text-paper-2" />
              </h2>
              <Tx k={desc} className="mt-2 flex-1 text-base text-paper-2" split="stack" />
              <p className="evidence mt-4 text-xs text-paper-3">{format}</p>
              <code className="evidence mt-2 block break-all rounded-lg bg-ink-850 px-4 py-3 text-sm text-paper">{url}</code>
              <div className="mt-4 flex gap-2">
                <CopyButton value={url} />
                <a href={path} target="_blank" rel="noreferrer" className={btn.small}>
                  <ExternalLink className="size-4" aria-hidden="true" />
                  <T k="open" />
                </a>
              </div>
            </StaggerItem>
          )
        })}
      </Stagger>
    </div>
  )
}
