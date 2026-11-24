import { useState } from 'react'
import { ExternalLink, FileDown, FileJson, Gavel, Mail } from 'lucide-react'
import { Drawer, Panel } from './ui'
import { VerdictView } from '../components/verdict/VerdictView'
import { CopyButton } from '../components/CopyButton'
import { EmptyState, ErrorState, LoadingState, Spinner } from '../components/States'
import { T } from '../lib/lang'
import { consoleApi, scanUrls } from '../lib/api'
import { useAsync } from '../lib/useAsync'
import type { DraftEmail, ScanResult } from '../lib/types'
import type { StringKey } from '../lib/i18n'

function EmailDraft({ label, draft }: { label: StringKey; draft: DraftEmail }) {
  const full = `To: ${draft.to}\nSubject: ${draft.subject}\n\n${draft.body}`
  return (
    <div className="rounded-2xl border border-ink-700 bg-ink-900 p-4">
      <div className="flex items-center justify-between gap-3">
        <p className="flex items-center gap-2 text-sm font-semibold text-paper">
          <Mail className="size-4 text-seal" aria-hidden="true" />
          <T k={label} />
        </p>
        <div className="flex gap-2">
          {draft.to && (
            <a
              href={`mailto:${draft.to}?subject=${encodeURIComponent(draft.subject)}&body=${encodeURIComponent(draft.body)}`}
              className="inline-flex items-center gap-1.5 rounded-lg border border-ink-500 px-3 py-1.5 text-xs font-semibold text-paper hover:border-brand"
            >
              <ExternalLink className="size-3.5" aria-hidden="true" />
              <T k="openMail" />
            </a>
          )}
          <CopyButton value={full} label="copyEmail" />
        </div>
      </div>
      <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs" dir="ltr">
        <dt className="text-mist-500">
          <T k="emailTo" />
        </dt>
        <dd className="font-mono text-mist-200">{draft.to || '—'}</dd>
        <dt className="text-mist-500">
          <T k="emailSubject" />
        </dt>
        <dd className="text-mist-200">{draft.subject}</dd>
      </dl>
      <pre className="scrollbar-thin mt-3 max-h-56 overflow-auto whitespace-pre-wrap rounded-xl bg-ink-950 p-3 font-mono text-xs leading-relaxed text-mist-300" dir="ltr">
        {draft.body}
      </pre>
    </div>
  )
}

function TakedownPanel({ scanId }: { scanId: string }) {
  const [open, setOpen] = useState(false)
  const { data, loading, error, reload } = useAsync(() => (open ? consoleApi.takedown(scanId) : Promise.resolve(null)), [scanId, open])
  const urls = scanUrls(scanId)
  return (
    <Panel className="p-4 sm:p-5">
      <div className="flex flex-wrap items-center gap-2">
        <a href={urls.evidencePdf} download className="inline-flex items-center gap-2 rounded-xl bg-paper px-4 py-2.5 text-sm font-bold text-ink-900 hover:bg-white">
          <FileDown className="size-4" aria-hidden="true" />
          <T k="evidencePdf" />
        </a>
        <a href={urls.evidenceJson} download className="inline-flex items-center gap-2 rounded-xl border border-ink-500 px-4 py-2.5 text-sm font-semibold text-paper hover:border-brand">
          <FileJson className="size-4" aria-hidden="true" />
          JSON + SHA-256
        </a>
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="inline-flex items-center gap-2 rounded-xl border border-seal/50 bg-seal/10 px-4 py-2.5 text-sm font-semibold text-seal hover:bg-seal/20"
        >
          <Gavel className="size-4" aria-hidden="true" />
          <T k="takedown" />
        </button>
      </div>
      {open && (
        <div className="mt-4 space-y-3">
          {loading ? (
            <div className="flex justify-center py-6 text-mist-400">
              <Spinner />
            </div>
          ) : error || !data ? (
            <ErrorState onRetry={reload} />
          ) : (
            <>
              {data.registrar && <EmailDraft label="toRegistrar" draft={data.registrar} />}
              {data.host && <EmailDraft label="toHost" draft={data.host} />}
              {data.safe_browsing_url && (
                <a
                  href={data.safe_browsing_url}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-2 text-sm font-semibold text-brand-bright hover:underline"
                >
                  <ExternalLink className="size-4" aria-hidden="true" />
                  <T k="reportSafeBrowsing" />
                </a>
              )}
            </>
          )}
        </div>
      )}
    </Panel>
  )
}

function DrawerBody({ scanId }: { scanId: string }) {
  const { data, loading, error, reload } = useAsync<ScanResult | null>(() => consoleApi.scan(scanId), [scanId])
  if (loading) return <LoadingState />
  if (error) return <ErrorState onRetry={reload} />
  if (!data) return <EmptyState message="scanNotFound" />
  return (
    <div className="space-y-5">
      <TakedownPanel scanId={scanId} />
      <VerdictView result={data} showActions={false} />
    </div>
  )
}

export function ScanDrawer({ scanId, title, onClose }: { scanId: string | null; title?: string; onClose: () => void }) {
  return (
    <Drawer open={!!scanId} onClose={onClose} title={<span className="font-mono" dir="ltr">{title ?? scanId}</span>}>
      {scanId && <DrawerBody scanId={scanId} />}
    </Drawer>
  )
}
