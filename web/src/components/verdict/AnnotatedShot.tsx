import { useState } from 'react'
import { motion } from 'motion/react'
import { Tx } from '../../lib/lang'
import { EASE_OUT } from '../../lib/motion'
import type { AnnotationKind, PageCapture } from '../../lib/types'

const KIND_COLOR: Record<AnnotationKind, string> = {
  card: '#e5534b',
  password: '#e5534b',
  otp: '#e5534b',
  emirates_id: '#e5534b',
  phone: '#e07b3c',
  form: '#e07b3c',
  urgency: '#e3a13a',
  logo: '#c9a35b',
  other: '#8c867c',
}

export function AnnotatedShot({ page }: { page: PageCapture & { screenshot_url: string } }) {
  const [natural, setNatural] = useState<{ w: number; h: number } | null>(null)
  const cssW = page.width || natural?.w || 390
  const cssH = natural ? (natural.h * cssW) / natural.w : page.height || cssW * 2
  const boxes = page.annotations

  return (
    <div className="grid gap-8 sm:grid-cols-[minmax(0,320px)_1fr] sm:items-start">
      <div className="scrollbar-thin mx-auto max-h-[640px] w-full max-w-[320px] overflow-y-auto rounded-lg border border-line bg-sheet">
        <div className="relative" dir="ltr">
          <img
            src={page.screenshot_url}
            alt={page.title ?? ''}
            className="block w-full"
            onLoad={(e) => setNatural({ w: e.currentTarget.naturalWidth, h: e.currentTarget.naturalHeight })}
          />
          {natural &&
            boxes.map((a, i) => {
              const color = KIND_COLOR[a.kind] ?? KIND_COLOR.other
              return (
                <motion.div
                  key={i}
                  className="absolute rounded-sm border-2"
                  style={{
                    left: `${(a.x / cssW) * 100}%`,
                    top: `${(a.y / cssH) * 100}%`,
                    width: `${(a.w / cssW) * 100}%`,
                    height: `${(a.h / cssH) * 100}%`,
                    borderColor: color,
                    background: `${color}1a`,
                  }}
                  initial={{ opacity: 0, scale: 1.15 }}
                  whileInView={{ opacity: 1, scale: 1 }}
                  viewport={{ once: true, margin: '-30px' }}
                  transition={{ duration: 0.3, delay: 0.2 + i * 0.25, ease: EASE_OUT }}
                >
                  <span className="evidence num absolute -top-3 -left-3 grid size-6 place-items-center rounded-full text-xs text-ink-950" style={{ background: color }}>
                    {i + 1}
                  </span>
                </motion.div>
              )
            })}
        </div>
      </div>
      <ol className="border-t border-line">
        {boxes.map((a, i) => {
          const color = KIND_COLOR[a.kind] ?? KIND_COLOR.other
          return (
            <motion.li
              key={i}
              className="flex items-start gap-4 border-b border-line py-4"
              initial={{ opacity: 0, x: -8 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.3, delay: 0.2 + i * 0.25, ease: EASE_OUT }}
            >
              <span className="evidence num grid size-6 shrink-0 place-items-center rounded-full text-xs text-ink-950" style={{ background: color }}>
                {i + 1}
              </span>
              <Tx text={a.label} className="text-base text-paper" split="stack" />
            </motion.li>
          )
        })}
      </ol>
    </div>
  )
}
