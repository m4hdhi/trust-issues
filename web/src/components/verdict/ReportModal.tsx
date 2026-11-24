import { useEffect, useState } from 'react'
import { motion } from 'motion/react'
import { Check } from 'lucide-react'
import { Modal } from '../Modal'
import { ChannelIcon, CHANNELS } from '../ChannelIcon'
import { Spinner } from '../States'
import { btn } from '../ui'
import { T, Tx, useLang } from '../../lib/lang'
import { api } from '../../lib/api'
import { T_STAMP } from '../../lib/motion'
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
        <div className="flex flex-col items-center py-8 text-center">
          <motion.span initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={T_STAMP} className="grid size-16 place-items-center rounded-full bg-safe text-ink-950">
            <Check className="size-8" strokeWidth={2.5} />
          </motion.span>
          <Tx k="reportSent" className="mt-6 text-lg text-paper" split="stack" />
          <button type="button" onClick={onClose} className={`${btn.secondary} mt-8 w-full`}>
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
          <div role="radiogroup" aria-label={t('reportTitle')} className="grid grid-cols-5 gap-2">
            {CHANNELS.map((ch) => {
              const active = ch === channel
              return (
                <button
                  key={ch}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  onClick={() => setChannel(ch)}
                  className={`press flex flex-col items-center gap-2 rounded-lg px-1 py-3 text-xs transition-colors ${
                    active ? 'bg-paper text-ink-950' : 'bg-ink-900 text-paper-2 hover:bg-ink-700'
                  }`}
                >
                  <ChannelIcon channel={ch} className="size-6" />
                  <span className="max-w-full truncate">
                    <T k={`ch_${ch}`} />
                  </span>
                </button>
              )
            })}
          </div>
          <label className="mt-6 block">
            <span className="text-sm text-paper-2">
              <T k="reportNote" />
            </span>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={3}
              dir="auto"
              maxLength={1000}
              placeholder={t('reportNotePh')}
              className="mt-2 block w-full resize-none rounded-lg border border-line bg-ink-900 px-4 py-3 text-base text-paper placeholder:text-paper-3 focus:border-gold focus:outline-none"
            />
          </label>
          {state === 'error' && <Tx k="reportFailed" className="mt-4 text-sm text-scam" split="stack" />}
          <button type="submit" disabled={!channel || state === 'sending'} className={`${btn.danger} mt-6 w-full`}>
            {state === 'sending' && <Spinner />}
            <T k={state === 'sending' ? 'sending' : 'sendReport'} />
          </button>
        </form>
      )}
    </Modal>
  )
}
