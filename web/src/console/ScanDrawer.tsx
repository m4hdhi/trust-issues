import { useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { ExternalLink, FileDown, FileJson, Gavel } from 'lucide-react'
import { Drawer } from './ui'
import { VerdictView } from '../components/verdict/VerdictView'
import { CopyButton } from '../components/CopyButton'
import { EmptyState, ErrorState, LoadingState, Spinner } from '../components/States'
import { btn } from '../components/ui'
import { T } from '../lib/lang'
import { consoleApi, scanUrls } from '../lib/api'
import { EASE_OUT } from '../lib/motion'
import { useAsync } from '../lib/useAsync'
import type { DraftEmail, ScanResult } from '../lib/types'
import type { StringKey } from '../lib/i18n'

function EmailDraft({ label, draft }: { label: StringKey; draft: DraftEmail }) {
  const full = `To: ${draft.to}\nSubject: ${draft.subject}\n\n${draft.body}`
  return (
    <div className="rounded-xl bg-ink-850 p-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <p className="text-base font-medium text-paper">
          <T k={label} />
        </p>
        <div className="flex gap-2">
          {draft.to && (
            <a href={`mailto:${draft.to}?subject=${encodeURIComponent(draft.subject)}&body=${encodeURIComponent(draft.body)}`} className={btn.small}>
              <ExternalLink className="size-4" aria-hidden="true" />
              <T k="openMail" />
            </a>
          )}
          <CopyButton value={full} label="copyEmail" />
        </div>
      </div>
      <dl className="mt-4 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm" dir="ltr">
        <dt className="text-paper-3">
          <T k="emailTo" />
        </dt>
        <dd className="evidence text-paper">{draft.to || 'n/a'}</dd>
        <dt className="text-paper-3">
          <T k="emailSubject" />
        </dt>
        <dd className="text-paper-2">{draft.subject}</dd>
      </dl>
      <pre className="evidence scrollbar-thin mt-4 max-h-64 overflow-auto whitespace-pre-wrap rounded-lg bg-ink-950 p-4 text-xs leading-relaxed text-paper-2">{draft.body}</pre>
    </div>
  )
}

function TakedownPanel({ scanId }: { scanId: string }) {
  const [open, setOpen] = useState(false)
  const { data, loading, error, reload } = useAsync(() => (open ? consoleApi.takedown(scanId) : Promise.resolve(null)), [scanId, open])
  const urls = scanUrls(scanId)
  return (
    <div className="border-b border-line py-6">
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" onClick={() => setOpen(true)} className={btn.primary}>
          <Gavel className="size-4" aria-hidden="true" />
          <T k="takedown" />
        </button>
        <a href={urls.evidencePdf} download className={btn.secondary}>
          <FileDown className="size-4" aria-hidden="true" />
          <T k="evidencePdf" />
        </a>
        <a href={urls.evidenceJson} download className={btn.secondary}>
          <FileJson className="size-4" aria-hidden="true" />
          <span className="evidence">JSON · SHA-256</span>
        </a>
      </div>
      <AnimatePresence>
        {open && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.3, ease: EASE_OUT }} className="overflow-hidden">
            <div className="mt-6 space-y-4">
              {loading ? (
                <div className="flex py-6 text-paper-3">
                  <Spinner />
                </div>
              ) : error || !data ? (
                <ErrorState onRetry={reload} />
              ) : (
                <>
                  <div className="grid gap-4 xl:grid-cols-2">
                    {data.registrar && <EmailDraft label="toRegistrar" draft={data.registrar} />}
                    {data.host && <EmailDraft label="toHost" draft={data.host} />}
                  </div>
                  {data.safe_browsing_url && (
                    <a href={data.safe_browsing_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 text-sm font-medium text-gold hover:underline">
                      <ExternalLink className="size-4" aria-hidden="true" />
                      <T k="reportSafeBrowsing" />
                    </a>
                  )}
                </>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

function DrawerBody({ scanId }: { scanId: string }) {
  const { data, loading, error, reload } = useAsync<ScanResult | null>(() => consoleApi.scan(scanId), [scanId])
  if (loading) return <LoadingState />
  if (error) return <ErrorState onRetry={reload} />
  if (!data) return <EmptyState message="scanNotFound" />
  return (
    <div>
      <TakedownPanel scanId={scanId} />
      <div className="pt-8">
        <VerdictView result={data} showActions={false} />
      </div>
    </div>
  )
}

export function ScanDrawer({ scanId, title, onClose }: { scanId: string | null; title?: string; onClose: () => void }) {
  return (
    <Drawer open={!!scanId} onClose={onClose} title={<span className="evidence">{title ?? scanId}</span>}>
      {scanId && <DrawerBody scanId={scanId} />}
    </Drawer>
  )
}
