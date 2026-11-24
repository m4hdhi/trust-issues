import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useLocation, useParams } from 'react-router'
import { AnimatePresence, motion } from 'motion/react'
import { Pipeline, STAGES, type StageState } from '../components/verdict/Pipeline'
import { VerdictView } from '../components/verdict/VerdictView'
import { ErrorState } from '../components/States'
import { T, Tx, useLang } from '../lib/lang'
import { api } from '../lib/api'
import { hostOf } from '../lib/format'
import { S } from '../lib/i18n'
import { VERDICT_LABEL } from '../lib/verdict'
import type { MessageAnalysis, ScanResult, ScanStage } from '../lib/types'

interface NavState {
  url?: string
  message?: MessageAnalysis | null
}

type Phase = 'running' | 'done' | 'notfound' | 'error'

export function Scan() {
  const { id = '' } = useParams()
  const location = useLocation()
  const nav = (location.state ?? null) as NavState | null
  const { pick } = useLang()
  const [phase, setPhase] = useState<Phase>('running')
  const [result, setResult] = useState<ScanResult | null>(null)
  const [stages, setStages] = useState<Record<string, StageState>>({})
  const [order, setOrder] = useState<string[]>(STAGES)
  const [elapsed, setElapsed] = useState(0)
  const [reconnecting, setReconnecting] = useState(false)
  const [attempt, setAttempt] = useState(0)
  const t0 = useRef(performance.now())
  const sawStage = useRef(false)
  const resolved = useRef(false)

  const finish = useCallback((r: ScanResult) => {
    if (resolved.current) return
    resolved.current = true
    setReconnecting(false)
    setStages((prev) => {
      const next = { ...prev }
      for (const s of STAGES) {
        const cur = next[s]
        const t = r.timings_ms?.[s]
        const open = !cur || cur.status === 'pending' || cur.status === 'running'
        next[s] = { ...cur, status: open ? (t != null ? 'done' : 'skipped') : cur.status, ms: t ?? cur?.ms }
      }
      return next
    })
    setResult(r)
    setTimeout(() => setPhase('done'), sawStage.current ? 650 : 0)
  }, [])

  useEffect(() => {
    resolved.current = false
    sawStage.current = false
    t0.current = performance.now()
    setPhase('running')
    setResult(null)
    setStages({})
    setOrder(STAGES)
    setElapsed(0)

    const onStage = (s: ScanStage) => {
      sawStage.current = true
      setReconnecting(false)
      const now = performance.now()
      setOrder((prev) => (prev.includes(s.stage) ? prev : [...prev, s.stage]))
      setStages((prev) => {
        const cur = prev[s.stage]
        const startedAt = cur?.startedAt ?? now
        const doneMs = s.status === 'running' ? undefined : Math.round(now - startedAt)
        return { ...prev, [s.stage]: { status: s.status, label: s.label, detail: s.detail ?? cur?.detail, startedAt, ms: doneMs ?? cur?.ms } }
      })
    }

    let poll: ReturnType<typeof setInterval> | undefined
    const startPolling = () => {
      if (poll) return
      poll = setInterval(async () => {
        try {
          const r = await api.getScan(id)
          if (r) finish(r)
        } catch {
          return
        }
      }, 2500)
    }

    const stop = api.streamScan(id, {
      onStage,
      onResult: finish,
      onError: (fatal) => {
        if (resolved.current) return
        if (fatal) {
          setPhase('error')
          return
        }
        setReconnecting(true)
        startPolling()
      },
    })

    const watchdog = setTimeout(async () => {
      if (resolved.current || sawStage.current) return
      try {
        const r = await api.getScan(id)
        if (r) finish(r)
        else if (!sawStage.current) setPhase('notfound')
      } catch {
        startPolling()
      }
    }, 12000)

    const tick = setInterval(() => {
      if (!resolved.current) setElapsed(performance.now() - t0.current)
    }, 100)

    return () => {
      stop()
      clearTimeout(watchdog)
      clearInterval(tick)
      if (poll) clearInterval(poll)
    }
  }, [id, attempt, finish])

  useEffect(() => {
    if (phase === 'done') window.scrollTo({ top: 0 })
  }, [phase])

  useEffect(() => {
    if (phase === 'done' && result) {
      document.title = `${pick(S[VERDICT_LABEL[result.verdict]])} — ${result.domain} | Trust Issues`
    }
    return () => {
      document.title = 'Trust Issues | أزمة ثقة'
    }
  }, [phase, result, pick])

  const host = result
    ? result.final_url
      ? hostOf(result.final_url)
      : result.domain
    : (stages.trust?.detail ?? (nav?.url ? hostOf(nav.url) : ''))

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-10">
      <AnimatePresence mode="wait">
        {phase === 'running' || (phase === 'done' && !result) ? (
          <motion.div key="pipeline" exit={{ opacity: 0, scale: 0.98 }} transition={{ duration: 0.25 }}>
            <Pipeline host={host} stages={stages} order={order} elapsed={elapsed} />
            {reconnecting && <Tx k="reconnecting" className="mt-4 text-center text-sm text-warn" split="stack" />}
          </motion.div>
        ) : phase === 'done' && result ? (
          <motion.div key="verdict" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.25 }}>
            <VerdictView
              result={result}
              message={nav?.message}
              animated
              onReported={() => {
                void api.getScan(id).then((r) => r && setResult(r))
              }}
            />
          </motion.div>
        ) : (
          <motion.div key="problem" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mx-auto max-w-lg py-10">
            <ErrorState
              message={phase === 'notfound' ? 'scanNotFound' : 'loadFailed'}
              onRetry={phase === 'error' ? () => setAttempt((a) => a + 1) : undefined}
            />
            <div className="mt-6 text-center">
              <Link to="/" className="text-sm font-semibold text-brand-bright hover:underline">
                <T k="scanAnother" />
              </Link>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
