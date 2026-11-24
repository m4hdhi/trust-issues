import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react'
import { animate, useInView, useReducedMotion } from 'motion/react'
import { ChevronsLeftRight } from 'lucide-react'
import { T, Tx, useLang } from '../../lib/lang'
import { EASE_IN_OUT } from '../../lib/motion'

interface Props {
  officialSrc: string
  officialHost: string
  fakeSrc: string | null
  fakeHost: string
}

export function RealVsFake({ officialSrc, officialHost, fakeSrc, fakeHost }: Props) {
  const { t } = useLang()
  const box = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState(50)
  const dragging = useRef(false)
  const inView = useInView(box, { once: true, margin: '-80px' })
  const reduce = useReducedMotion()

  useEffect(() => {
    if (!inView || reduce || !fakeSrc) return
    const controls = animate(50, [50, 72, 30, 50], {
      duration: 1.6,
      delay: 0.3,
      ease: EASE_IN_OUT,
      onUpdate: (v) => {
        if (!dragging.current) setPos(v)
      },
    })
    return () => controls.stop()
  }, [inView, reduce, fakeSrc])

  const fromEvent = (e: PointerEvent<HTMLDivElement>) => {
    const rect = box.current?.getBoundingClientRect()
    if (!rect) return
    setPos(Math.min(100, Math.max(0, ((e.clientX - rect.left) / rect.width) * 100)))
  }

  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'ArrowLeft') setPos((p) => Math.max(0, p - 5))
    if (e.key === 'ArrowRight') setPos((p) => Math.min(100, p + 5))
  }

  if (!fakeSrc) {
    return (
      <div className="grid gap-6 sm:grid-cols-2">
        <figure>
          <div className="aspect-[1/2] max-h-[560px] overflow-hidden rounded-lg border border-line bg-sheet">
            <img src={officialSrc} alt="" loading="lazy" className="h-full w-full object-cover object-top" />
          </div>
          <figcaption className="evidence mt-2 text-sm text-safe">{officialHost}</figcaption>
        </figure>
        <Tx k="fakeNotCaptured" className="self-center text-base text-paper-2" split="stack" />
      </div>
    )
  }

  return (
    <figure dir="ltr">
      <div
        ref={box}
        className="relative mx-auto aspect-[1/2] max-h-[640px] w-full max-w-[400px] cursor-ew-resize touch-pan-y select-none overflow-hidden rounded-lg border border-line bg-sheet"
        onPointerDown={(e) => {
          dragging.current = true
          e.currentTarget.setPointerCapture(e.pointerId)
          fromEvent(e)
        }}
        onPointerMove={(e) => {
          if (dragging.current) fromEvent(e)
        }}
        onPointerUp={() => {
          dragging.current = false
        }}
        onPointerCancel={() => {
          dragging.current = false
        }}
      >
        <img src={fakeSrc} alt={`${t('fake')}: ${fakeHost}`} draggable={false} className="absolute inset-0 h-full w-full object-cover object-top" />
        <div className="absolute inset-0" style={{ clipPath: `inset(0 ${100 - pos}% 0 0)` }}>
          <img src={officialSrc} alt={`${t('official')}: ${officialHost}`} draggable={false} className="absolute inset-0 h-full w-full object-cover object-top" />
        </div>
        <span className="absolute start-2 top-2 rounded-md bg-safe px-2 py-1 text-xs font-medium text-ink-950">
          <T k="official" />
        </span>
        <span className="absolute end-2 top-2 rounded-md bg-scam px-2 py-1 text-xs font-medium text-ink-950">
          <T k="fake" />
        </span>
        <div className="pointer-events-none absolute inset-y-0 w-0.5 -translate-x-1/2 bg-paper" style={{ left: `${pos}%` }}>
          <div
            role="slider"
            tabIndex={0}
            aria-label={t('realVsFake')}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(pos)}
            onKeyDown={onKey}
            className="pointer-events-auto absolute top-1/2 left-1/2 grid size-10 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-paper text-ink-950"
          >
            <ChevronsLeftRight className="size-5" />
          </div>
        </div>
      </div>
      <figcaption className="mx-auto mt-4 flex max-w-[400px] justify-between gap-4 text-sm">
        <span className="evidence truncate text-safe">{officialHost}</span>
        <span className="evidence truncate text-scam">{fakeHost}</span>
      </figcaption>
    </figure>
  )
}
