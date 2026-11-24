import { motion } from 'motion/react'
import { BadgeCheck, Link2, SearchCode } from 'lucide-react'
import { Section } from './Section'
import { T } from '../../lib/lang'
import type { DiffSegment, DomainDiff as Diff } from '../../lib/types'

function officialText(s: DiffSegment): string {
  if (s.op === 'insert') return ''
  return s.official ?? (s.op === 'equal' ? s.text : '')
}

function suspectText(s: DiffSegment): string {
  return s.op === 'delete' ? '' : s.text
}

function Row({ segments, side }: { segments: DiffSegment[]; side: 'official' | 'suspect' }) {
  let changeIndex = 0
  return (
    <p className="break-all font-mono text-[19px] leading-relaxed tracking-tight sm:text-2xl" dir="ltr">
      {segments.map((s, i) => {
        const text = side === 'official' ? officialText(s) : suspectText(s)
        if (!text) return null
        if (s.op === 'equal') {
          return (
            <span key={i} className="text-mist-200">
              {text}
            </span>
          )
        }
        const delay = 0.15 + changeIndex++ * 0.18
        const tone = side === 'official' ? 'text-safe' : 'text-scam'
        const bg = side === 'official' ? 'bg-safe/20' : 'bg-scam/25'
        return (
          <span key={i} className={`relative font-semibold ${tone}`}>
            <motion.span
              className={`absolute inset-y-0 -inset-x-0.5 origin-left rounded ${bg}`}
              initial={{ scaleX: 0 }}
              whileInView={{ scaleX: 1 }}
              viewport={{ once: true, margin: '-40px' }}
              transition={{ duration: 0.35, delay, ease: 'easeOut' }}
              aria-hidden="true"
            />
            <span className={`relative ${side === 'suspect' ? 'underline decoration-wavy decoration-scam/70 underline-offset-4' : ''}`}>
              {text}
            </span>
          </span>
        )
      })}
    </p>
  )
}

export function DomainDiff({ diff }: { diff: Diff }) {
  const segments = diff.segments.length
    ? diff.segments
    : [
        { op: 'replace' as const, official: diff.official, text: diff.suspect },
      ]
  return (
    <Section icon={SearchCode} title="spotDifference" sub="spotDifferenceSub">
      <div className="space-y-3">
        <div className="rounded-2xl border border-seal/30 bg-seal/[0.06] px-4 py-3.5">
          <p className="mb-1 flex items-center gap-1.5 text-xs font-semibold text-seal">
            <BadgeCheck className="size-3.5" aria-hidden="true" />
            <T k="realAddress" />
          </p>
          <Row segments={segments} side="official" />
        </div>
        <div className="rounded-2xl border border-scam/35 bg-scam/[0.06] px-4 py-3.5">
          <p className="mb-1 flex items-center gap-1.5 text-xs font-semibold text-scam">
            <Link2 className="size-3.5" aria-hidden="true" />
            <T k="thisLink" />
          </p>
          <Row segments={segments} side="suspect" />
        </div>
      </div>
    </Section>
  )
}
