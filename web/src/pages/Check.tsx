import { useEffect, useState } from 'react'
import { Link, Navigate, useLocation } from 'react-router'
import { motion } from 'motion/react'
import { ArrowRight } from 'lucide-react'
import { MessageAnalysisCard } from '../components/verdict/MessageAnalysisCard'
import { Spinner } from '../components/States'
import { VerdictChip } from '../components/VerdictChip'
import { SectionHead } from '../components/ui'
import { T, Tx } from '../lib/lang'
import { api } from '../lib/api'
import { defang, hostOf } from '../lib/format'
import { EASE_OUT } from '../lib/motion'
import { readJson } from '../lib/storage'
import { LAST_CHECK_KEY, type CheckState } from '../lib/useStartScan'
import type { MessageAnalysis, ScanResult } from '../lib/types'

function LinkResult({ id, url, message, index }: { id: string; url: string; message: MessageAnalysis | null; index: number }) {
  const [result, setResult] = useState<ScanResult | null>(null)
  const [done, setDone] = useState(0)

  useEffect(() => {
    let poll: ReturnType<typeof setInterval> | undefined
    const stop = api.streamScan(id, {
      onStage: (s) => {
        if (s.status !== 'running') setDone((d) => d + 1)
      },
      onResult: setResult,
      onError: () => {
        poll ??= setInterval(async () => {
          const r = await api.getScan(id).catch(() => null)
          if (r) {
            setResult(r)
            if (poll) clearInterval(poll)
          }
        }, 2500)
      },
    })
    return () => {
      stop()
      if (poll) clearInterval(poll)
    }
  }, [id])

  const risky = result && (result.verdict === 'scam' || result.verdict === 'suspicious')

  return (
    <motion.li initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, delay: index * 0.06, ease: EASE_OUT }} className="border-b border-line">
      <Link to={`/scan/${encodeURIComponent(id)}`} state={{ url, message }} className="group grid grid-cols-[1fr_auto] items-center gap-4 py-4">
        <span className="min-w-0">
          <span className="evidence block truncate text-base text-paper">{risky ? defang(hostOf(url)) : hostOf(url)}</span>
          {result ? (
            <Tx text={result.headline} as="span" className="mt-1 block text-sm text-paper-2" split="stack" />
          ) : (
            <span className="mt-1 flex items-center gap-2 text-sm text-paper-3">
              <Spinner className="size-3" />
              <T k="investigating" /> <span className="evidence num">{Math.min(done, 10)}/10</span>
            </span>
          )}
        </span>
        <span className="flex items-center gap-4">
          {result && <VerdictChip verdict={result.verdict} score={result.score} />}
          <ArrowRight className="size-4 text-paper-3 transition-transform group-hover:translate-x-0.5 rtl:rotate-180" aria-hidden="true" />
        </span>
      </Link>
    </motion.li>
  )
}

export function Check() {
  const location = useLocation()
  const state = (location.state as CheckState | null) ?? readJson<CheckState>(LAST_CHECK_KEY, 'session')
  if (!state) return <Navigate to="/" replace />
  const { response, input } = state

  return (
    <div className="shell pt-8 pb-8 lg:pt-10 lg:pb-10">
      <figure className="max-w-3xl rounded-xl rounded-ss-sm bg-ink-800 px-6 py-4">
        <p className="line-clamp-6 whitespace-pre-wrap break-words text-base text-paper-2" dir="auto">
          {input}
        </p>
      </figure>
      {response.message && (
        <div className="mt-8">
          <MessageAnalysisCard message={response.message} />
        </div>
      )}
      <section className="mt-8">
        <SectionHead title="linksInMessage" />
        {response.scans.length ? (
          <ul className="mt-6 border-t border-line">
            {response.scans.map((s, i) => (
              <LinkResult key={s.id} id={s.id} url={s.url} message={response.message} index={i} />
            ))}
          </ul>
        ) : (
          <Tx k="noLinksFound" className="mt-6 text-base text-paper-2" split="stack" />
        )}
      </section>
      <Link to="/" className="mt-8 inline-flex text-sm font-medium text-gold hover:underline">
        <T k="scanAnother" />
      </Link>
    </div>
  )
}
