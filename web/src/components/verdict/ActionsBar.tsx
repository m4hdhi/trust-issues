import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router'
import { FileDown, Flag, RotateCcw, Share2 } from 'lucide-react'
import { ReportModal } from './ReportModal'
import { copyText } from '../CopyButton'
import { useToast } from '../Toast'
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
  const { mode, pick } = useLang()
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
    const text = mode === 'both' ? `${msg.en}\n${msg.ar}` : pick(msg)
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

  const btn =
    'inline-flex min-h-13 items-center justify-center gap-2 rounded-2xl px-4 py-3 text-[15px] font-semibold transition-[transform,background-color,border-color] active:scale-[0.98]'

  return (
    <>
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
        <button
          type="button"
          onClick={() => setReportOpen(true)}
          className={`${btn} ${risky ? 'bg-scam text-white hover:bg-[#f05252]' : 'border border-ink-600 bg-ink-800 text-paper hover:border-ink-500'}`}
        >
          <Flag className="size-[18px] shrink-0" aria-hidden="true" />
          <T k="reportScam" stacked arClassName="text-[13px] opacity-85" />
        </button>
        <button type="button" onClick={() => void share()} className={`${btn} bg-paper text-ink-900 hover:bg-white`}>
          <Share2 className="size-[18px] shrink-0" aria-hidden="true" />
          <T k="shareWarning" stacked arClassName="text-[13px] opacity-75" />
        </button>
        <a href={scanUrls(result.id).evidencePdf} download className={`${btn} border border-ink-600 bg-ink-800 text-paper hover:border-ink-500`}>
          <FileDown className="size-[18px] shrink-0" aria-hidden="true" />
          <T k="evidencePdf" stacked arClassName="text-[13px] opacity-75" />
        </a>
        <Link to="/" className={`${btn} border border-ink-600 bg-ink-800 text-paper hover:border-ink-500`}>
          <RotateCcw className="size-[18px] shrink-0" aria-hidden="true" />
          <T k="scanAnother" stacked arClassName="text-[13px] opacity-75" />
        </Link>
      </div>
      <ReportModal open={reportOpen} onClose={() => setReportOpen(false)} url={result.final_url ?? result.url} onReported={onReported} />
    </>
  )
}
