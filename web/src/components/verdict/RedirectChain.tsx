import { motion } from 'motion/react'
import { T } from '../../lib/lang'
import { defang, hostOf } from '../../lib/format'
import { EASE_OUT } from '../../lib/motion'
import type { StringKey } from '../../lib/i18n'
import type { RedirectHop } from '../../lib/types'

function hopKind(hop: RedirectHop, last: boolean): StringKey {
  if (last || hop.kind === 'final') return 'hop_final'
  if (hop.kind === 'shortener') return 'hop_shortener'
  return 'hop_redirect'
}

export function RedirectChain({ hops, danger }: { hops: RedirectHop[]; danger: boolean }) {
  return (
    <ol className="relative border-s border-line" dir="ltr">
      {hops.map((hop, i) => {
        const last = i === hops.length - 1
        const host = hostOf(hop.url)
        return (
          <motion.li
            key={`${hop.url}-${i}`}
            className="relative ps-6 pb-6 last:pb-0"
            initial={{ opacity: 0, x: -8 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.3, delay: i * 0.12, ease: EASE_OUT }}
          >
            <span className={`absolute -start-[4.5px] top-2 size-2 rounded-full ${last && danger ? 'bg-scam' : 'bg-line-strong'}`} aria-hidden="true" />
            <p className="flex flex-wrap items-baseline gap-x-3 text-sm text-paper-3">
              <T k={hopKind(hop, last)} />
              {hop.status != null && <span className="evidence num">{hop.status}</span>}
            </p>
            <p className={`evidence mt-1 break-all text-base ${last && danger ? 'text-scam' : 'text-paper'}`}>{last && danger ? defang(host) : host}</p>
            <p className="evidence break-all text-xs text-paper-3">{hop.url.replace(/^https?:\/\/[^/]+/, '') || '/'}</p>
          </motion.li>
        )
      })}
    </ol>
  )
}
