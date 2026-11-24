import { T } from '../lib/lang'
import { num } from '../lib/format'

export interface ConfusionCounts {
  tp: number
  fp: number
  tn: number
  fn: number
}

export function Confusion({ m }: { m: ConfusionCounts }) {
  const cell = (label: string, value: number, good: boolean) => (
    <div className={`rounded-xl p-4 text-center ${good ? 'bg-safe/15 text-safe' : 'bg-scam/15 text-scam'}`}>
      <p className="num text-2xl font-extrabold">{num(value)}</p>
      <p className="mt-0.5 font-mono text-[11px] font-semibold opacity-80">{label}</p>
    </div>
  )
  return (
    <div>
      <p className="mb-3 text-sm font-semibold text-paper">
        <T k="confusion" />
      </p>
      <div className="grid grid-cols-[auto_1fr_1fr] items-center gap-2 text-xs text-mist-400" dir="ltr">
        <span />
        <span className="text-center">
          <T k="predicted" /> scam
        </span>
        <span className="text-center">
          <T k="predicted" /> safe
        </span>
        <span className="pe-2 text-end">
          <T k="actual" /> scam
        </span>
        {cell('TP', m.tp, true)}
        {cell('FN', m.fn, false)}
        <span className="pe-2 text-end">
          <T k="actual" /> safe
        </span>
        {cell('FP', m.fp, false)}
        {cell('TN', m.tn, true)}
      </div>
    </div>
  )
}
