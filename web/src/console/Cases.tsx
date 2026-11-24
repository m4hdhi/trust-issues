import { useState } from 'react'
import { Check, PanelRightOpen, X } from 'lucide-react'
import { PageHeader, Panel, Segmented, SourceIcon, SourceLabel } from './ui'
import { ScanDrawer } from './ScanDrawer'
import { brandName } from '../components/BrandMark'
import { VerdictChip } from '../components/VerdictChip'
import { EmptyState, ErrorState, LoadingState } from '../components/States'
import { T, useLang } from '../lib/lang'
import { consoleApi } from '../lib/api'
import { timeAgo } from '../lib/format'
import { useAsync } from '../lib/useAsync'
import type { CaseItem, CaseStatus } from '../lib/types'

type Filter = CaseStatus | 'all'

const STATUS_COLOR: Record<CaseStatus, string> = {
  pending: '#f59e0b',
  confirmed: '#ef4444',
  rejected: '#94a3b8',
}

export function Cases() {
  const { t } = useLang()
  const [filter, setFilter] = useState<Filter>('pending')
  const [busy, setBusy] = useState<string | null>(null)
  const [open, setOpen] = useState<CaseItem | null>(null)
  const { data, loading, error, reload, setData } = useAsync(() => consoleApi.cases(filter), [filter])

  const decide = async (c: CaseItem, action: 'confirm' | 'reject') => {
    setBusy(c.id)
    try {
      await consoleApi.decide(c.id, action)
      const status: CaseStatus = action === 'confirm' ? 'confirmed' : 'rejected'
      setData((prev) =>
        (prev ?? [])
          .map((x) => (x.id === c.id ? { ...x, status } : x))
          .filter((x) => filter === 'all' || x.status === filter),
      )
    } catch {
      reload()
    } finally {
      setBusy(null)
    }
  }

  return (
    <div>
      <PageHeader
        title="nav_cases"
        sub="casesSub"
        right={
          <Segmented<Filter>
            value={filter}
            onChange={setFilter}
            label={t('nav_cases')}
            options={[
              { value: 'pending', k: 'filter_pending' },
              { value: 'confirmed', k: 'filter_confirmed' },
              { value: 'rejected', k: 'filter_rejected' },
              { value: 'all', k: 'filter_all' },
            ]}
          />
        }
      />
      {loading ? (
        <LoadingState />
      ) : error ? (
        <ErrorState onRetry={reload} />
      ) : !data?.length ? (
        <EmptyState message="casesEmpty" />
      ) : (
        <Panel className="overflow-hidden">
          <div className="scrollbar-thin overflow-x-auto">
            <table className="w-full min-w-[880px] text-sm">
              <thead className="border-b border-ink-700 text-xs text-mist-400">
                <tr className="text-start">
                  {(['col_domain', 'col_source', 'col_brand', 'col_score', 'col_reports', 'col_detected', 'col_status'] as const).map((k) => (
                    <th key={k} className="px-4 py-3 text-start font-medium">
                      <T k={k} />
                    </th>
                  ))}
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-700">
                {data.map((c) => {
                  const brand = brandName(c.brand)
                  const color = STATUS_COLOR[c.status]
                  return (
                    <tr key={c.id} className="hover:bg-ink-800/60">
                      <td className="max-w-[280px] px-4 py-3">
                        <p className="truncate font-mono font-semibold text-paper" dir="ltr">
                          {c.domain}
                        </p>
                        <p className="truncate font-mono text-xs text-mist-500" dir="ltr">
                          {c.url}
                        </p>
                      </td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center gap-2 whitespace-nowrap text-mist-300">
                          <SourceIcon source={c.source} className="size-7" />
                          <SourceLabel source={c.source} />
                        </span>
                      </td>
                      <td className="px-4 py-3 text-mist-200">{brand ? <T text={brand} /> : '—'}</td>
                      <td className="px-4 py-3">
                        <VerdictChip verdict={c.verdict} score={c.score} />
                      </td>
                      <td className="num px-4 py-3 text-mist-200">{c.reports}</td>
                      <td className="whitespace-nowrap px-4 py-3 text-xs text-mist-400">
                        <T text={timeAgo(c.created_at)} />
                      </td>
                      <td className="px-4 py-3">
                        <span className="whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold" style={{ color, background: `${color}1a` }}>
                          <T k={`filter_${c.status}`} />
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex justify-end gap-1.5">
                          {c.status !== 'confirmed' && (
                            <button
                              type="button"
                              disabled={busy === c.id}
                              onClick={() => void decide(c, 'confirm')}
                              className="inline-flex items-center gap-1 rounded-lg bg-scam/15 px-2.5 py-1.5 text-xs font-semibold text-scam hover:bg-scam/25 disabled:opacity-50"
                            >
                              <Check className="size-3.5" aria-hidden="true" />
                              <T k="confirm" />
                            </button>
                          )}
                          {c.status !== 'rejected' && (
                            <button
                              type="button"
                              disabled={busy === c.id}
                              onClick={() => void decide(c, 'reject')}
                              className="inline-flex items-center gap-1 rounded-lg bg-ink-700 px-2.5 py-1.5 text-xs font-semibold text-mist-200 hover:bg-ink-600 disabled:opacity-50"
                            >
                              <X className="size-3.5" aria-hidden="true" />
                              <T k="reject" />
                            </button>
                          )}
                          <button
                            type="button"
                            disabled={!c.scan_id}
                            onClick={() => setOpen(c)}
                            title={c.scan_id ? undefined : t('noScanYet')}
                            className="inline-flex items-center gap-1 rounded-lg border border-ink-500 px-2.5 py-1.5 text-xs font-semibold text-paper hover:border-brand disabled:opacity-40"
                          >
                            <PanelRightOpen className="size-3.5" aria-hidden="true" />
                            <T k="open" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </Panel>
      )}
      <ScanDrawer scanId={open?.scan_id ?? null} title={open?.domain} onClose={() => setOpen(null)} />
    </div>
  )
}
