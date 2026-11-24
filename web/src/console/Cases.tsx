import { useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { Check, PanelRightOpen, X } from 'lucide-react'
import { PageHeader, Segmented, SourceTag } from './ui'
import { ScanDrawer } from './ScanDrawer'
import { BrandMark, brandName } from '../components/BrandMark'
import { VerdictChip } from '../components/VerdictChip'
import { EmptyState, ErrorState, LoadingState } from '../components/States'
import { T, useLang } from '../lib/lang'
import { consoleApi } from '../lib/api'
import { defang, timeAgo } from '../lib/format'
import { EASE_OUT, T_LAYOUT } from '../lib/motion'
import { useAsync } from '../lib/useAsync'
import type { CaseItem, CaseStatus } from '../lib/types'

type Filter = CaseStatus | 'all'

const STATUS_COLOR: Record<CaseStatus, string> = { pending: '#e3a13a', confirmed: '#e5534b', rejected: '#8c867c' }

const COLUMNS = ['col_domain', 'col_source', 'col_brand', 'col_score', 'col_reports', 'col_detected', 'col_status'] as const

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
      setData((prev) => (prev ?? []).map((x) => (x.id === c.id ? { ...x, status } : x)).filter((x) => filter === 'all' || x.status === filter))
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
        <div className="scrollbar-thin overflow-x-auto">
          <table className="w-full min-w-[880px] text-sm">
            <thead className="border-b border-line text-xs text-paper-3">
              <tr>
                {COLUMNS.map((k) => (
                  <th key={k} className="px-4 py-3 text-start font-normal first:ps-0">
                    <T k={k} />
                  </th>
                ))}
                <th className="py-3" />
              </tr>
            </thead>
            <tbody>
              <AnimatePresence initial={false}>
                {data.map((c, i) => {
                  const brand = brandName(c.brand)
                  const color = STATUS_COLOR[c.status]
                  const risky = c.verdict === 'scam' || c.verdict === 'suspicious'
                  return (
                    <motion.tr
                      key={c.id}
                      layout="position"
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0, transition: { duration: 0.25, delay: Math.min(i, 12) * 0.02, ease: EASE_OUT } }}
                      exit={{ opacity: 0, x: 16, transition: { duration: 0.2 } }}
                      transition={T_LAYOUT}
                      className="border-b border-line hover:bg-ink-850"
                    >
                      <td className="max-w-[300px] py-4 pe-4">
                        <p className="evidence truncate text-base text-paper">{risky ? defang(c.domain) : c.domain}</p>
                        <p className="evidence truncate text-xs text-paper-3">{c.url}</p>
                      </td>
                      <td className="px-4 py-4">
                        <SourceTag source={c.source} />
                      </td>
                      <td className="px-4 py-4">
                        {brand ? (
                          <span className="inline-flex items-center gap-2 text-paper-2">
                            <BrandMark brand={c.brand} className="size-6" />
                            <span className="max-w-[160px] truncate">
                              <T text={brand} />
                            </span>
                          </span>
                        ) : (
                          <span className="text-paper-3">n/a</span>
                        )}
                      </td>
                      <td className="px-4 py-4">
                        <VerdictChip verdict={c.verdict} score={c.score} />
                      </td>
                      <td className="evidence num px-4 py-4 text-paper-2">{c.reports}</td>
                      <td className="whitespace-nowrap px-4 py-4 text-xs text-paper-3">
                        <T text={timeAgo(c.created_at)} />
                      </td>
                      <td className="px-4 py-4">
                        <span className="whitespace-nowrap text-sm" style={{ color }}>
                          <T k={`filter_${c.status}`} />
                        </span>
                      </td>
                      <td className="py-4 ps-4">
                        <div className="flex justify-end gap-1">
                          {c.status !== 'confirmed' && (
                            <button
                              type="button"
                              disabled={busy === c.id}
                              onClick={() => void decide(c, 'confirm')}
                              title={t('confirm')}
                              aria-label={t('confirm')}
                              className="press grid size-9 place-items-center rounded-md text-scam transition-colors hover:bg-scam/15 disabled:opacity-50"
                            >
                              <Check className="size-4" />
                            </button>
                          )}
                          {c.status !== 'rejected' && (
                            <button
                              type="button"
                              disabled={busy === c.id}
                              onClick={() => void decide(c, 'reject')}
                              title={t('reject')}
                              aria-label={t('reject')}
                              className="press grid size-9 place-items-center rounded-md text-paper-2 transition-colors hover:bg-ink-700 disabled:opacity-50"
                            >
                              <X className="size-4" />
                            </button>
                          )}
                          <button
                            type="button"
                            disabled={!c.scan_id}
                            onClick={() => setOpen(c)}
                            title={c.scan_id ? t('open') : t('noScanYet')}
                            aria-label={t('open')}
                            className="press grid size-9 place-items-center rounded-md text-paper-2 transition-colors hover:bg-ink-700 hover:text-paper disabled:opacity-40"
                          >
                            <PanelRightOpen className="size-4" />
                          </button>
                        </div>
                      </td>
                    </motion.tr>
                  )
                })}
              </AnimatePresence>
            </tbody>
          </table>
        </div>
      )}
      <ScanDrawer scanId={open?.scan_id ?? null} title={open?.domain} onClose={() => setOpen(null)} />
    </div>
  )
}
