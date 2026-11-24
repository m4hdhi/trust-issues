import { useState } from 'react'
import { motion } from 'motion/react'
import { ScanEye } from 'lucide-react'
import { Section } from './Section'
import { Tx } from '../../lib/lang'
import type { AnnotationKind, PageCapture } from '../../lib/types'

const KIND_COLOR: Record<AnnotationKind, string> = {
  card: '#ef4444',
  password: '#ef4444',
  otp: '#ef4444',
  emirates_id: '#ef4444',
  phone: '#f97316',
  form: '#f97316',
  urgency: '#f59e0b',
  logo: '#a78bfa',
  other: '#94a3b8',
}

export function AnnotatedShot({ page }: { page: PageCapture & { screenshot_url: string } }) {
  const [natural, setNatural] = useState<{ w: number; h: number } | null>(null)
  const cssW = page.width || natural?.w || 390
  const cssH = natural ? (natural.h * cssW) / natural.w : page.height || cssW * 2
  const boxes = page.annotations

  return (
    <Section icon={ScanEye} title="annotatedTitle" sub="annotatedSub">
      <div className="grid gap-5 sm:grid-cols-[minmax(0,320px)_1fr] sm:items-start">
        <div className="scrollbar-thin mx-auto max-h-[72vh] w-full max-w-[320px] overflow-y-auto rounded-2xl border border-ink-600 bg-white">
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
                    className="absolute rounded-md border-2"
                    style={{
                      left: `${(a.x / cssW) * 100}%`,
                      top: `${(a.y / cssH) * 100}%`,
                      width: `${(a.w / cssW) * 100}%`,
                      height: `${(a.h / cssH) * 100}%`,
                      borderColor: color,
                      background: `${color}1f`,
                      boxShadow: `0 0 0 3px ${color}33`,
                    }}
                    initial={{ opacity: 0, scale: 1.25 }}
                    whileInView={{ opacity: 1, scale: 1 }}
                    viewport={{ once: true, margin: '-30px' }}
                    transition={{ duration: 0.35, delay: 0.2 + i * 0.32, ease: 'easeOut' }}
                  >
                    <span
                      className="num absolute -top-2.5 -left-2.5 grid size-6 place-items-center rounded-full text-[11px] font-bold text-white shadow"
                      style={{ background: color }}
                    >
                      {i + 1}
                    </span>
                  </motion.div>
                )
              })}
          </div>
        </div>
        <ol className="space-y-2.5">
          {boxes.map((a, i) => {
            const color = KIND_COLOR[a.kind] ?? KIND_COLOR.other
            return (
              <motion.li
                key={i}
                className="flex items-start gap-3 rounded-2xl border border-ink-700 bg-ink-850 px-3.5 py-3"
                initial={{ opacity: 0, x: -8 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.3, delay: 0.2 + i * 0.32 }}
              >
                <span className="num grid size-6 shrink-0 place-items-center rounded-full text-[11px] font-bold text-white" style={{ background: color }}>
                  {i + 1}
                </span>
                <Tx text={a.label} className="text-sm font-medium leading-snug text-paper" split="stack" />
              </motion.li>
            )
          })}
        </ol>
      </div>
    </Section>
  )
}
