import { motion } from 'motion/react'
import { T } from '../../lib/lang'
import { EASE_OUT } from '../../lib/motion'
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
    <p className="evidence break-all text-xl leading-snug sm:text-3xl" dir="ltr">
      {segments.map((s, i) => {
        const text = side === 'official' ? officialText(s) : suspectText(s)
        if (!text) return null
        if (s.op === 'equal') {
          return (
            <span key={i} className="text-paper-2">
              {text}
            </span>
          )
        }
        const delay = 0.2 + changeIndex++ * 0.15
        const color = side === 'official' ? 'var(--color-safe)' : 'var(--color-scam)'
        return (
          <span key={i} className="relative" style={{ color }}>
            <motion.span
              className="absolute inset-x-0 bottom-[0.08em] h-[0.42em] origin-left"
              style={{ background: `color-mix(in oklab, ${color} 30%, transparent)` }}
              initial={{ scaleX: 0 }}
              whileInView={{ scaleX: 1 }}
              viewport={{ once: true, margin: '-40px' }}
              transition={{ duration: 0.5, delay, ease: EASE_OUT }}
              aria-hidden="true"
            />
            <span className={`relative ${side === 'suspect' ? 'underline decoration-wavy decoration-1 underline-offset-[6px]' : ''}`}>{text}</span>
          </span>
        )
      })}
    </p>
  )
}

export function DomainDiff({ diff }: { diff: Diff }) {
  const segments: DiffSegment[] = diff.segments.length ? diff.segments : [{ op: 'replace', official: diff.official, text: diff.suspect }]
  return (
    <div className="divide-y divide-line border-y border-line">
      <div className="py-6">
        <p className="mb-2 text-sm text-safe">
          <T k="realAddress" />
        </p>
        <Row segments={segments} side="official" />
      </div>
      <div className="py-6">
        <p className="mb-2 text-sm text-scam">
          <T k="thisLink" />
        </p>
        <Row segments={segments} side="suspect" />
      </div>
    </div>
  )
}
