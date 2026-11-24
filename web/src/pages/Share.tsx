import { useEffect, useRef } from 'react'
import { Link, useSearchParams } from 'react-router'
import { Spinner } from '../components/States'
import { T, Tx } from '../lib/lang'
import { useStartScan } from '../lib/useStartScan'

export function Share() {
  const [params] = useSearchParams()
  const { start, failed } = useStartScan()
  const started = useRef(false)
  const text = [params.get('title'), params.get('text'), params.get('url')]
    .map((v) => v?.trim())
    .filter((v): v is string => !!v)
    .filter((v, i, all) => all.every((o, j) => j === i || !o.includes(v) || (o === v && j > i)))
    .join('\n')

  useEffect(() => {
    if (started.current || !text) return
    started.current = true
    void start(text, 'share', true)
  }, [text, start])

  return (
    <div className="shell">
      <div className="flex max-w-xl flex-col items-start py-24">
        {!text ? (
          <Tx k="shareEmpty" className="text-lg text-paper-2" split="stack" />
        ) : failed ? (
          <Tx k={failed} className="text-lg text-scam" split="stack" />
        ) : (
          <>
            <Spinner className="size-6 text-gold" />
            <Tx k="shareReceived" as="h1" className="display mt-6 text-2xl text-paper" split="stack" />
            <p className="evidence mt-4 line-clamp-3 break-all text-sm text-paper-3">{text}</p>
          </>
        )}
        {(!text || failed) && (
          <Link to={`/?u=${encodeURIComponent(text)}`} className="mt-8 text-sm font-medium text-gold hover:underline">
            <T k="backHome" />
          </Link>
        )}
      </div>
    </div>
  )
}
