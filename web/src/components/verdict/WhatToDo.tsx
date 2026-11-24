import { Ban, CreditCard, KeyRound, Phone, ShieldCheck, Smartphone, type LucideIcon } from 'lucide-react'
import { T, Tx } from '../../lib/lang'
import type { StringKey } from '../../lib/i18n'
import type { Verdict } from '../../lib/types'
import { VERDICT_COLOR } from '../../lib/verdict'

const STEPS: Record<Verdict, { k: StringKey; icon: LucideIcon; tel?: string }[]> = {
  scam: [
    { k: 'doScam1', icon: Ban },
    { k: 'doScam2', icon: CreditCard },
    { k: 'doScam3', icon: Phone, tel: '8002626' },
  ],
  suspicious: [
    { k: 'doSuspicious1', icon: KeyRound },
    { k: 'doSuspicious2', icon: Smartphone },
  ],
  unknown: [
    { k: 'doSuspicious1', icon: KeyRound },
    { k: 'doSuspicious2', icon: Smartphone },
  ],
  safe: [{ k: 'doSafe', icon: ShieldCheck }],
}

export function WhatToDo({ verdict }: { verdict: Verdict }) {
  const color = VERDICT_COLOR[verdict]
  return (
    <section className="rounded-3xl border p-5 sm:p-6" style={{ borderColor: `${color}55`, background: `${color}0d` }}>
      <h2 className="text-[17px] font-bold text-paper">
        <T k="whatToDo" arClassName="font-semibold text-mist-300" />
      </h2>
      <ol className="mt-4 space-y-3">
        {STEPS[verdict].map(({ k, icon: Icon, tel }) => {
          const body = (
            <>
              <span className="grid size-9 shrink-0 place-items-center rounded-xl" style={{ background: `${color}22`, color }}>
                <Icon className="size-[18px]" aria-hidden="true" />
              </span>
              <Tx k={k} className="pt-1.5 text-[15px] font-medium leading-snug text-paper" split="stack" />
            </>
          )
          return (
            <li key={k}>
              {tel ? (
                <a href={`tel:${tel}`} className="flex items-start gap-3 rounded-xl hover:opacity-90">
                  {body}
                </a>
              ) : (
                <div className="flex items-start gap-3">{body}</div>
              )}
            </li>
          )
        })}
      </ol>
    </section>
  )
}
