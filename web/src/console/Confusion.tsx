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
    <div className={`rounded-lg p-4 ${good ? 'bg-safe/12' : 'bg-scam/12'}`}>
      <p className={`evidence num text-xl ${good ? 'text-safe' : 'text-scam'}`}>{num(value)}</p>
      <p className="evidence mt-1 text-xs text-paper-3">{label}</p>
    </div>
  )
  return (
    <div>
      <p className="mb-4 text-base font-medium text-paper">
        <T k="confusion" />
      </p>
      <div className="grid grid-cols-[auto_1fr_1fr] items-center gap-2 text-xs text-paper-3" dir="ltr">
        <span />
        <span>
          <T k="predicted" /> scam
        </span>
        <span>
          <T k="predicted" /> safe
        </span>
        <span className="pe-2">
          <T k="actual" /> scam
        </span>
        {cell('TP', m.tp, true)}
        {cell('FN', m.fn, false)}
        <span className="pe-2">
          <T k="actual" /> safe
        </span>
        {cell('FP', m.fp, false)}
        {cell('TN', m.tn, true)}
      </div>
    </div>
  )
}
