import { useEffect } from 'react'
import { TrendingFeature } from '../components/TrendingCard'
import { EmptyState, ErrorState, Skeleton } from '../components/States'
import { Reveal } from '../components/motion'
import { Tx } from '../lib/lang'
import { api } from '../lib/api'
import { useAsync } from '../lib/useAsync'

export function Trending() {
  const { data, error, loading, reload, setData } = useAsync(() => api.trending(), [])

  useEffect(() => {
    const timer = setInterval(() => {
      api
        .trending()
        .then((items) => setData(() => items))
        .catch(() => undefined)
    }, 30000)
    return () => clearInterval(timer)
  }, [setData])

  return (
    <div className="shell pt-8 pb-8 lg:pt-10 lg:pb-10">
      <Reveal as="header" className="max-w-3xl">
        <Tx k="trendingTitle" as="h1" className="display text-4xl text-paper sm:text-5xl" arClassName="text-2xl text-paper-2 sm:text-3xl" split="stack" />
        <Tx k="trendingSub" className="mt-4 max-w-[60ch] text-lg text-paper-2" split="stack" />
      </Reveal>
      <div className="mt-8">
        {loading ? (
          <div className="space-y-4">
            {Array.from({ length: 4 }, (_, i) => (
              <Skeleton key={i} className="h-28" />
            ))}
          </div>
        ) : error ? (
          <ErrorState onRetry={reload} />
        ) : !data?.length ? (
          <EmptyState message="trendingEmpty" />
        ) : (
          <ul className="border-b border-line">
            {data.map((item, i) => (
              <TrendingFeature key={item.domain} item={item} rank={i + 1} />
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
