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
    <div className="mx-auto flex max-w-md flex-col items-center px-6 py-24 text-center">
      {!text ? (
        <Tx k="shareEmpty" className="text-mist-300" split="stack" />
      ) : failed ? (
        <Tx k={failed} className="text-scam" split="stack" />
      ) : (
        <>
          <Spinner className="size-8 text-brand-bright" />
          <Tx k="shareReceived" className="mt-4 text-lg font-semibold text-paper" split="stack" />
          <p className="mt-3 line-clamp-3 break-all font-mono text-xs text-mist-500" dir="auto">
            {text}
          </p>
        </>
      )}
      {(!text || failed) && (
        <Link to={`/?u=${encodeURIComponent(text)}`} className="mt-6 text-sm font-semibold text-brand-bright hover:underline">
          <T k="backHome" />
        </Link>
      )}
    </div>
  )
}
