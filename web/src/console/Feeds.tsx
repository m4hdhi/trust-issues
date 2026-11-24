import { ExternalLink, FileCode2, FileJson, FileText, type LucideIcon } from 'lucide-react'
import { PageHeader, Panel } from './ui'
import { CopyButton } from '../components/CopyButton'
import { T, Tx } from '../lib/lang'
import type { StringKey } from '../lib/i18n'

const FEEDS: { path: string; title: StringKey; desc: StringKey; icon: LucideIcon; color: string }[] = [
  { path: '/api/feeds/domains.txt', title: 'feed_txt', desc: 'feed_txt_d', icon: FileText, color: '#14b8a6' },
  { path: '/api/feeds/rpz.zone', title: 'feed_rpz', desc: 'feed_rpz_d', icon: FileCode2, color: '#60a5fa' },
  { path: '/api/feeds/stix.json', title: 'feed_stix', desc: 'feed_stix_d', icon: FileJson, color: '#c8a96a' },
]

export function Feeds() {
  const origin = window.location.origin
  return (
    <div>
      <PageHeader title="feedsTitle" />
      <Tx k="feedsSub" className="-mt-2 mb-6 max-w-3xl text-[15px] leading-relaxed text-mist-300" split="stack" />
      <div className="grid gap-4 lg:grid-cols-3">
        {FEEDS.map(({ path, title, desc, icon: Icon, color }) => {
          const url = `${origin}${path}`
          return (
            <Panel key={path} className="flex flex-col p-5">
              <span className="grid size-11 place-items-center rounded-xl" style={{ background: `${color}1f`, color }}>
                <Icon className="size-5" aria-hidden="true" />
              </span>
              <h2 className="mt-4 text-lg font-bold text-paper">
                <T k={title} arClassName="font-semibold text-mist-300" />
              </h2>
              <Tx k={desc} className="mt-1 flex-1 text-sm leading-relaxed text-mist-400" split="stack" />
              <code className="mt-4 block break-all rounded-xl bg-ink-950 px-3 py-2.5 font-mono text-xs text-mist-200" dir="ltr">
                {url}
              </code>
              <div className="mt-3 flex gap-2">
                <CopyButton value={url} />
                <a
                  href={path}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-lg border border-ink-500 px-3 py-1.5 text-xs font-semibold text-paper hover:border-brand"
                >
                  <ExternalLink className="size-3.5" aria-hidden="true" />
                  <T k="open" />
                </a>
              </div>
            </Panel>
          )
        })}
      </div>
    </div>
  )
}
