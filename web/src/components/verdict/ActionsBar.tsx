import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router'
import { FileDown, Flag, RotateCcw, Share2 } from 'lucide-react'
import { ReportModal } from './ReportModal'
import { copyText } from '../CopyButton'
import { useToast } from '../Toast'
import { btn } from '../ui'
import { T, useLang } from '../../lib/lang'
import { api, scanUrls } from '../../lib/api'
import { fill, S } from '../../lib/i18n'
import type { ScanResult } from '../../lib/types'

function downloadBlob(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = name
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 2000)
}

export function ActionsBar({ result, onReported }: { result: ScanResult; onReported?: () => void }) {
  const { pick } = useLang()
  const toast = useToast()
  const [reportOpen, setReportOpen] = useState(false)
  const card = useRef<Blob | null>(null)
  const risky = result.verdict === 'scam' || result.verdict === 'suspicious'

  useEffect(() => {
    let alive = true
    card.current = null
    api
      .warningCard(result.id)
      .then((b) => {
        if (alive) card.current = b
      })
      .catch(() => undefined)
    return () => {
      alive = false
    }
  }, [result.id])

  const share = async () => {
    const msg = fill(risky ? S.shareTextScam : S.shareTextSafe, { domain: result.domain })
    const text = pick(msg)
    const link = `${window.location.origin}/scan/${encodeURIComponent(result.id)}`
    const blob = card.current
    const file = blob ? new File([blob], `warning-${result.domain}.png`, { type: 'image/png' }) : null
    try {
      if (file && navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], text: `${text}\n${link}` })
        return
      }
      if (navigator.share) {
        await navigator.share({ text, url: link })
        return
      }
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') return
    }
    if (blob) {
      downloadBlob(blob, `warning-${result.domain}.png`)
      toast(S.warningSaved)
      return
    }
    if (await copyText(`${text}\n${link}`)) toast(S.warningCopied)
  }

  return (
    <>
      <div className="grid gap-2 sm:flex sm:flex-wrap">
        <button type="button" onClick={() => void share()} className={btn.primary}>
          <Share2 className="size-4 shrink-0" aria-hidden="true" />
          <T k="shareWarning" />
        </button>
        <button type="button" onClick={() => setReportOpen(true)} className={risky ? btn.danger : btn.secondary}>
          <Flag className="size-4 shrink-0" aria-hidden="true" />
          <T k="reportScam" />
        </button>
        <a href={scanUrls(result.id).evidencePdf} download className={btn.secondary}>
          <FileDown className="size-4 shrink-0" aria-hidden="true" />
          <T k="evidencePdf" />
        </a>
        <Link to="/" className={btn.ghost}>
          <RotateCcw className="size-4 shrink-0" aria-hidden="true" />
          <T k="scanAnother" />
        </Link>
      </div>
      <ReportModal open={reportOpen} onClose={() => setReportOpen(false)} url={result.final_url ?? result.url} onReported={onReported} />
    </>
  )
}
