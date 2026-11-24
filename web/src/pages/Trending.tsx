import { Flame } from 'lucide-react'
import { TrendingCard } from '../components/TrendingCard'
import { EmptyState, ErrorState } from '../components/States'
import { Tx } from '../lib/lang'
import { api } from '../lib/api'
import { useAsync } from '../lib/useAsync'

export function Trending() {
  const { data, error, loading, reload } = useAsync(() => api.trending(), [])
  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-12">
      <header className="mb-8 max-w-3xl">
        <span className="inline-grid size-11 place-items-center rounded-2xl bg-scam/15 text-scam">
          <Flame className="size-6" aria-hidden="true" />
        </span>
        <Tx k="trendingTitle" as="h1" className="mt-4 text-3xl font-extrabold tracking-tight text-paper sm:text-4xl" split="stack" />
        <Tx k="trendingSub" className="mt-2 text-[15px] leading-relaxed text-mist-300" split="stack" />
      </header>
      {loading ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }, (_, i) => (
            <div key={i} className="h-64 animate-pulse rounded-3xl bg-ink-800" />
          ))}
        </div>
      ) : error ? (
        <ErrorState onRetry={reload} />
      ) : !data?.length ? (
        <EmptyState message="trendingEmpty" />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {data.map((item) => (
            <TrendingCard key={item.domain} item={item} />
          ))}
        </div>
      )}
    </div>
  )
}
