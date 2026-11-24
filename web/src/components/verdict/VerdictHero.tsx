import { motion, useReducedMotion } from 'motion/react'
import { Clock, Globe, Timer } from 'lucide-react'
import { RiskGauge } from './RiskGauge'
import { T, Tx, useLang } from '../../lib/lang'
import { S } from '../../lib/i18n'
import { hostOf, ms, timeAgo } from '../../lib/format'
import type { ScanResult } from '../../lib/types'
import { VERDICT_COLOR, VERDICT_LABEL } from '../../lib/verdict'

function Stamp({ result, animated }: { result: ScanResult; animated: boolean }) {
  const { mode } = useLang()
  const color = VERDICT_COLOR[result.verdict]
  const label = S[VERDICT_LABEL[result.verdict]]
  return (
    <motion.div
      initial={animated ? { scale: 2.4, opacity: 0, rotate: -22 } : false}
      animate={{ scale: 1, opacity: 1, rotate: -7 }}
      transition={{ type: 'spring', stiffness: 520, damping: 22, mass: 0.9, delay: animated ? 1.05 : 0 }}
      className="inline-flex origin-center flex-col items-center rounded-xl border-[3px] px-4 py-1.5 sm:px-5 sm:py-2"
      style={{
        borderColor: color,
        color,
        background: `${color}12`,
        boxShadow: `inset 0 0 0 3px #0b1220, inset 0 0 0 5px ${color}66, 0 0 40px -6px ${color}88`,
      }}
    >
      {mode !== 'ar' && (
        <span className="text-[26px] font-black uppercase leading-tight tracking-[0.16em] sm:text-[34px]">{label.en}</span>
      )}
      {mode !== 'en' && (
        <span lang="ar" className={`font-bold leading-snug ${mode === 'ar' ? 'text-[30px] sm:text-[38px]' : 'text-xl sm:text-2xl'}`}>
          {label.ar}
        </span>
      )}
    </motion.div>
  )
}

export function VerdictHero({ result, animated }: { result: ScanResult; animated: boolean }) {
  const reduce = useReducedMotion()
  const play = animated && !reduce
  const color = VERDICT_COLOR[result.verdict]
  const totalMs = result.timings_ms?.total ?? 0
  const finalHost = result.final_url ? hostOf(result.final_url) : result.domain
  const firstHost = hostOf(result.url)

  return (
    <section className="relative overflow-hidden rounded-[32px] border border-ink-700 bg-ink-850 px-5 pt-6 pb-6 sm:px-8 sm:pt-8 lg:px-10 lg:py-10">
      <div
        className={`pointer-events-none absolute -top-40 start-[-10%] h-[420px] w-[120%] ${result.verdict === 'scam' ? 'animate-pulse-ring' : ''}`}
        style={{ background: `radial-gradient(ellipse at 30% 40%, ${color}40, transparent 60%)` }}
        aria-hidden="true"
      />
      <div className="relative grid grid-cols-[132px_1fr] items-center gap-x-5 gap-y-6 [grid-template-areas:'g_s''t_t'] sm:grid-cols-[190px_1fr] lg:grid-cols-[230px_1fr] lg:gap-x-12 lg:[grid-template-areas:'g_s''g_t']">
        <div className="[grid-area:g] lg:self-center">
          <RiskGauge score={result.score} color={color} animated={play} />
        </div>
        <div className="[grid-area:s] lg:self-end">
          <Stamp result={result} animated={play} />
        </div>
        <motion.div
          className="min-w-0 [grid-area:t] lg:self-start"
          initial={play ? { opacity: 0, y: 12 } : false}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: play ? 1.25 : 0, ease: 'easeOut' }}
        >
          <Tx
            text={result.headline}
            as="h1"
            className="text-balance text-[26px] font-extrabold leading-[1.15] tracking-[-0.02em] text-paper sm:text-[32px] lg:text-[38px]"
            arClassName="tracking-normal leading-[1.45]"
          />
          {result.summary && (
            <Tx text={result.summary} className="mt-3 max-w-3xl text-[15px] leading-relaxed text-mist-300 sm:text-base" arClassName="leading-loose" />
          )}
          <div className="mt-5 flex flex-wrap items-center gap-2 text-xs text-mist-400">
            <span className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-ink-600 bg-ink-800 px-3 py-1.5">
              <Globe className="size-3.5 shrink-0" aria-hidden="true" />
              <span className="truncate font-mono text-[13px] text-paper" dir="ltr">
                {finalHost}
              </span>
              {firstHost !== finalHost && (
                <span className="truncate font-mono text-mist-500" dir="ltr">
                  ← {firstHost}
                </span>
              )}
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-ink-600 px-3 py-1.5">
              <Clock className="size-3.5" aria-hidden="true" />
              <T text={timeAgo(result.created_at)} />
            </span>
            {totalMs > 0 && (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-ink-600 px-3 py-1.5">
                <Timer className="size-3.5" aria-hidden="true" />
                <span className="num">{ms(totalMs)}</span>
              </span>
            )}
          </div>
        </motion.div>
      </div>
    </section>
  )
}
