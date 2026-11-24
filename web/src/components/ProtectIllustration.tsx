import { ShieldX } from 'lucide-react'
import { ChannelIcon, CHANNEL_COLOR } from './ChannelIcon'
import { T } from '../lib/lang'
import type { Channel } from '../lib/types'

const BUBBLES: { ch: Channel; text: string; blocked?: boolean }[] = [
  { ch: 'whatsapp', text: 'adpolice-fines-pay.com/pay', blocked: true },
  { ch: 'sms', text: 'salik-recharge-ae.com', blocked: true },
  { ch: 'instagram', text: 'emiratesnbd.com' },
]

export function ProtectIllustration() {
  return (
    <div className="relative mx-auto w-[220px] rounded-[34px] border-[6px] border-ink-600 bg-ink-950 p-3 shadow-2xl" dir="ltr" aria-hidden="true">
      <div className="mx-auto mb-3 h-1.5 w-14 rounded-full bg-ink-600" />
      <div className="space-y-2.5">
        {BUBBLES.map((b) => (
          <div key={b.text} className="rounded-2xl bg-ink-800 p-2.5">
            <div className="flex items-center gap-2">
              <span className="grid size-6 place-items-center rounded-lg" style={{ background: `${CHANNEL_COLOR[b.ch]}22`, color: CHANNEL_COLOR[b.ch] }}>
                <ChannelIcon channel={b.ch} className="size-3.5" />
              </span>
              <span className={`truncate font-mono text-[10.5px] ${b.blocked ? 'text-mist-500 line-through decoration-scam' : 'text-mist-200'}`}>
                {b.text}
              </span>
            </div>
            {b.blocked && (
              <div className="mt-2 flex items-center gap-1.5 rounded-lg bg-scam/15 px-2 py-1 text-[10.5px] font-semibold text-scam">
                <ShieldX className="size-3.5 shrink-0" />
                <T text={{ en: 'Blocked', ar: 'محظور' }} />
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
