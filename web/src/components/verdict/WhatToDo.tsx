import { Tx, T } from '../../lib/lang'
import type { StringKey } from '../../lib/i18n'
import type { Verdict } from '../../lib/types'
import { VERDICT_COLOR } from '../../lib/verdict'

const STEPS: Record<Verdict, { k: StringKey; tel?: string }[]> = {
  scam: [{ k: 'doScam1' }, { k: 'doScam2' }, { k: 'doScam3', tel: '8002626' }],
  suspicious: [{ k: 'doSuspicious1' }, { k: 'doSuspicious2' }],
  unknown: [{ k: 'doSuspicious1' }, { k: 'doSuspicious2' }],
  safe: [{ k: 'doSafe' }],
}

const COLS: Record<number, string> = { 2: 'sm:grid-cols-2', 3: 'sm:grid-cols-3' }

export function WhatToDo({ verdict }: { verdict: Verdict }) {
  const color = VERDICT_COLOR[verdict]
  const steps = STEPS[verdict]
  return (
    <section className="rounded-xl p-6 sm:p-8" style={{ background: `color-mix(in oklab, ${color} 9%, var(--color-ink-900))` }}>
      <h2 className="display text-lg" style={{ color }}>
        <T k="whatToDo" arClassName="opacity-80" />
      </h2>
      <ol className={`mt-4 grid gap-x-8 gap-y-4 ${COLS[steps.length] ?? ''}`}>
        {steps.map(({ k, tel }, i) => {
          const body = (
            <span className="flex gap-4">
              <span className="evidence num shrink-0 pt-1 text-sm" style={{ color }}>
                {i + 1}
              </span>
              <Tx k={k} as="span" className="block text-lg text-paper" split="stack" />
            </span>
          )
          return <li key={k}>{tel ? <a href={`tel:${tel}`} className="block underline decoration-line-strong underline-offset-4 hover:decoration-paper">{body}</a> : body}</li>
        })}
      </ol>
    </section>
  )
}
