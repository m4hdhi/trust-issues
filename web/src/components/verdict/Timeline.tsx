import { motion } from 'motion/react'
import { T, Tx } from '../../lib/lang'
import { dateTime, timeAgo, toMs } from '../../lib/format'
import { EASE_OUT } from '../../lib/motion'
import type { TimelineEvent } from '../../lib/types'

export function Timeline({ events }: { events: TimelineEvent[] }) {
  const sorted = [...events].sort((a, b) => toMs(a.ts) - toMs(b.ts))
  return (
    <ol className="relative">
      {sorted.map((e, i) => {
        const last = i === sorted.length - 1
        return (
          <motion.li
            key={`${e.ts}-${i}`}
            className="grid grid-cols-[96px_1fr] gap-x-6 border-t border-line py-4 sm:grid-cols-[140px_1fr]"
            initial={{ opacity: 0, y: 8 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.3, delay: i * 0.06, ease: EASE_OUT }}
          >
            <span className="evidence num pt-1 text-xs text-paper-3" dir="ltr">
              {dateTime(e.ts)}
            </span>
            <div>
              <Tx text={e.label} className={`text-base ${last ? 'text-gold' : 'text-paper'}`} split="stack" />
              <p className="mt-1 text-xs text-paper-3">
                <T text={timeAgo(e.ts)} />
              </p>
            </div>
          </motion.li>
        )
      })}
    </ol>
  )
}
