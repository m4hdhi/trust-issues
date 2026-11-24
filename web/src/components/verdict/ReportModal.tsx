import { useEffect, useState } from 'react'
import { CheckCircle2 } from 'lucide-react'
import { Modal } from '../Modal'
import { ChannelIcon, CHANNEL_COLOR, CHANNELS } from '../ChannelIcon'
import { Spinner } from '../States'
import { T, Tx, useLang } from '../../lib/lang'
import { api } from '../../lib/api'
import type { Channel } from '../../lib/types'

export function ReportModal({ open, onClose, url, onReported }: { open: boolean; onClose: () => void; url: string; onReported?: () => void }) {
  const { t } = useLang()
  const [channel, setChannel] = useState<Channel | null>(null)
  const [note, setNote] = useState('')
  const [state, setState] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle')

  useEffect(() => {
    if (open) {
      setState('idle')
      setChannel(null)
      setNote('')
    }
  }, [open])

  const submit = async () => {
    if (!channel) return
    setState('sending')
    try {
      await api.report({ url, channel, note: note.trim() || undefined })
      setState('sent')
      onReported?.()
    } catch {
      setState('error')
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={<T k={state === 'sent' ? 'reportScam' : 'reportTitle'} />}>
      {state === 'sent' ? (
        <div className="flex flex-col items-center py-6 text-center">
          <CheckCircle2 className="size-14 text-safe" aria-hidden="true" />
          <Tx k="reportSent" className="mt-4 text-lg font-semibold text-paper" split="stack" />
          <button type="button" onClick={onClose} className="mt-6 w-full rounded-2xl bg-paper py-3.5 text-base font-bold text-ink-900">
            <T k="done" />
          </button>
        </div>
      ) : (
        <form
          onSubmit={(e) => {
            e.preventDefault()
            void submit()
          }}
        >
          <div role="radiogroup" aria-label={t('reportTitle')} className="grid grid-cols-4 gap-2">
            {CHANNELS.map((ch) => {
              const active = ch === channel
              const color = CHANNEL_COLOR[ch]
              return (
                <button
                  key={ch}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  onClick={() => setChannel(ch)}
                  className={`flex flex-col items-center gap-1.5 rounded-2xl border px-1 py-3 text-[11px] font-semibold transition-colors ${
                    active ? 'border-transparent text-paper' : 'border-ink-600 text-mist-300 hover:border-ink-500'
                  }`}
                  style={active ? { background: `${color}26`, boxShadow: `inset 0 0 0 2px ${color}` } : undefined}
                >
                  <span style={{ color }}>
                    <ChannelIcon channel={ch} className="size-6" />
                  </span>
                  <T k={`ch_${ch}`} stacked />
                </button>
              )
            })}
          </div>
          <label className="mt-5 block">
            <span className="text-sm font-medium text-mist-300">
              <T k="reportNote" />
            </span>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={3}
              dir="auto"
              maxLength={1000}
              placeholder={t('reportNotePh')}
              className="mt-2 block w-full resize-none rounded-2xl border border-ink-600 bg-ink-900 px-4 py-3 text-[15px] text-paper placeholder:text-mist-500 focus:border-brand focus:outline-none"
            />
          </label>
          {state === 'error' && <Tx k="reportFailed" className="mt-3 text-sm text-scam" split="stack" />}
          <button
            type="submit"
            disabled={!channel || state === 'sending'}
            className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-scam py-3.5 text-base font-bold text-white transition-opacity disabled:opacity-40"
          >
            {state === 'sending' && <Spinner />}
            <T k={state === 'sending' ? 'sending' : 'sendReport'} arClassName="opacity-85" />
          </button>
        </form>
      )}
    </Modal>
  )
}
