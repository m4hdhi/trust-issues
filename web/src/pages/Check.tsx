import { useEffect, useState } from 'react'
import { Link, Navigate, useLocation } from 'react-router'
import { ChevronRight, Link2 } from 'lucide-react'
import { MessageAnalysisCard } from '../components/verdict/MessageAnalysisCard'
import { Section } from '../components/verdict/Section'
import { Spinner } from '../components/States'
import { VerdictChip } from '../components/VerdictChip'
import { T, Tx } from '../lib/lang'
import { api } from '../lib/api'
import { hostOf } from '../lib/format'
import { readJson } from '../lib/storage'
import { LAST_CHECK_KEY, type CheckState } from '../lib/useStartScan'
import type { MessageAnalysis, ScanResult } from '../lib/types'

function LinkResult({ id, url, message }: { id: string; url: string; message: MessageAnalysis | null }) {
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

  return (
    <Link
      to={`/scan/${encodeURIComponent(id)}`}
      state={{ url, message }}
      className="group flex items-center gap-3 rounded-2xl border border-ink-700 bg-ink-850 px-4 py-3.5 transition-colors hover:border-ink-500"
    >
      <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-ink-700 text-mist-300">
        {result ? <Link2 className="size-4" aria-hidden="true" /> : <Spinner className="size-4 text-brand-bright" />}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate font-mono text-sm text-paper" dir="ltr">
          {hostOf(url)}
        </p>
        {result ? (
          <Tx text={result.headline} className="mt-0.5 line-clamp-2 text-sm text-mist-300" split="stack" />
        ) : (
          <p className="num mt-0.5 text-xs text-mist-500">
            <T k="investigating" /> {Math.min(done, 10)}/10
          </p>
        )}
      </div>
      {result && <VerdictChip verdict={result.verdict} score={result.score} />}
      <ChevronRight className="size-4 shrink-0 text-mist-500 rtl:rotate-180" aria-hidden="true" />
    </Link>
  )
}

export function Check() {
  const location = useLocation()
  const state = (location.state as CheckState | null) ?? readJson<CheckState>(LAST_CHECK_KEY, 'session')
  if (!state) return <Navigate to="/" replace />
  const { response, input } = state

  return (
    <div className="mx-auto max-w-3xl space-y-5 px-4 py-6 sm:px-6 sm:py-10">
      <figure className="rounded-3xl rounded-ss-md border border-ink-700 bg-ink-800 px-5 py-4">
        <p className="line-clamp-6 whitespace-pre-wrap break-words text-[15px] leading-relaxed text-mist-200" dir="auto">
          {input}
        </p>
      </figure>
      {response.message && <MessageAnalysisCard message={response.message} />}
      <Section icon={Link2} title="linksInMessage">
        {response.scans.length ? (
          <div className="space-y-2.5">
            {response.scans.map((s) => (
              <LinkResult key={s.id} id={s.id} url={s.url} message={response.message} />
            ))}
          </div>
        ) : (
          <Tx k="noLinksFound" className="text-sm text-mist-400" split="stack" />
        )}
      </Section>
      <div className="text-center">
        <Link to="/" className="text-sm font-semibold text-brand-bright hover:underline">
          <T k="scanAnother" />
        </Link>
      </div>
    </div>
  )
}
