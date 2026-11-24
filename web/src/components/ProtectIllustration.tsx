import { ChannelIcon } from './ChannelIcon'
import { T } from '../lib/lang'
import type { Channel } from '../lib/types'

const MESSAGES: { ch: Channel; text: string; blocked: boolean }[] = [
  { ch: 'whatsapp', text: 'adpolice-fines-pay[.]com', blocked: true },
  { ch: 'sms', text: 'salik-recharge-ae[.]com', blocked: true },
  { ch: 'instagram', text: 'emiratesnbd.com', blocked: false },
  { ch: 'telegram', text: 'aramex-redelivery[.]cc', blocked: true },
]

export function ProtectIllustration() {
  return (
    <div className="relative mx-auto w-[240px] rounded-[36px] border border-line-strong bg-ink-950 p-3" dir="ltr" aria-hidden="true">
      <div className="mx-auto mb-4 h-1.5 w-16 rounded-full bg-ink-700" />
      <ul className="space-y-2">
        {MESSAGES.map((m) => (
          <li key={m.text} className="rounded-2xl bg-ink-800 p-3">
            <div className="flex items-center gap-2">
              <ChannelIcon channel={m.ch} className="size-4 shrink-0 text-paper-2" />
              <span className={`evidence truncate text-xs ${m.blocked ? 'text-paper-3 line-through decoration-scam' : 'text-paper'}`}>{m.text}</span>
            </div>
            {m.blocked && (
              <p className="mt-2 text-xs font-medium text-scam">
                <T k="blocked" />
              </p>
            )}
          </li>
        ))}
      </ul>
    </div>
  )
}
