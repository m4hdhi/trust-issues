import { useEffect, useId, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion } from 'motion/react'
import { CalendarPlus, ChevronLeft, ChevronRight, FileBadge, FileSpreadsheet, Flag, MapPin, Rss, ScanSearch, Search, ShieldBan, SpellCheck2, X, type LucideIcon } from 'lucide-react'
import { T, Tx, useLang } from '../lib/lang'
import { EASE_DRAWER, EASE_OUT, T_LAYOUT } from '../lib/motion'
import { S, fill, type StringKey } from '../lib/i18n'
import type { CaseSource } from '../lib/types'

export const SOURCE_META: Record<CaseSource, { icon: LucideIcon; color: string; k: StringKey }> = {
  ct: { icon: FileBadge, color: '#2f6fc9', k: 'src_ct' },
  search: { icon: Search, color: '#c26a00', k: 'src_search' },
  maps: { icon: MapPin, color: '#0c9c6c', k: 'src_maps' },
  typosquat: { icon: SpellCheck2, color: '#c2417a', k: 'src_typosquat' },
  nrd: { icon: CalendarPlus, color: '#6a4fd1', k: 'src_nrd' },
  report: { icon: Flag, color: '#e2434b', k: 'src_report' },
  batch: { icon: FileSpreadsheet, color: '#7775a0', k: 'src_batch' },
  scan: { icon: ScanSearch, color: '#5a48f2', k: 'src_scan' },
  feed: { icon: Rss, color: '#7775a0', k: 'src_feed' },
  dns: { icon: ShieldBan, color: '#5a48f2', k: 'src_dns' },
}

export function SourceTag({ source }: { source: string }) {
  const meta = SOURCE_META[source as CaseSource]
  const Icon = (meta ?? SOURCE_META.batch).icon
  return (
    <span className="inline-flex items-center gap-2 whitespace-nowrap text-sm font-bold" style={{ color: (meta ?? SOURCE_META.batch).color }}>
      <Icon className="size-4 shrink-0" aria-hidden="true" />
      {meta ? <T k={meta.k} /> : <span>{source}</span>}
    </span>
  )
}

export function PageHeader({ title, sub, right }: { title: StringKey; sub?: StringKey; right?: ReactNode }) {
  return (
    <header className="mb-8 flex flex-wrap items-end justify-between gap-x-8 gap-y-4 border-b border-line pb-6">
      <div className="min-w-0">
        <h1 className="display text-3xl text-paper">
          <T k={title} arClassName="text-2xl text-paper-2" />
        </h1>
        {sub && <Tx k={sub} className="mt-2 max-w-[64ch] text-base text-paper-2" split="stack" />}
      </div>
      {right}
    </header>
  )
}

export function Panel({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <section className={`rounded-xl bg-ink-850 ${className}`}>{children}</section>
}

export function Drawer({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: ReactNode; children: ReactNode }) {
  const { t } = useLang()
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, onClose])

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div className="fixed inset-0 z-50" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, transition: { duration: 0.2 } }}>
          <div className="absolute inset-0 bg-ink-950/80" onClick={onClose} aria-hidden="true" />
          <motion.aside
            role="dialog"
            aria-modal="true"
            className="absolute inset-y-0 end-0 flex w-full max-w-6xl flex-col border-s border-line bg-ink-900"
            initial={{ x: '6%', opacity: 0 }}
            animate={{ x: 0, opacity: 1, transition: { duration: 0.4, ease: EASE_DRAWER } }}
            exit={{ x: '6%', opacity: 0, transition: { duration: 0.2, ease: EASE_OUT } }}
          >
            <div className="flex h-16 items-center justify-between gap-4 border-b border-line px-6">
              <div className="min-w-0 truncate text-base text-paper">{title}</div>
              <button
                type="button"
                onClick={onClose}
                aria-label={t('close')}
                className="press grid size-10 shrink-0 place-items-center rounded-lg text-paper-3 hover:bg-ink-800 hover:text-paper"
              >
                <X className="size-5" />
              </button>
            </div>
            <div className="scrollbar-thin flex-1 overflow-y-auto px-6 pb-12 sm:px-8">{children}</div>
          </motion.aside>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  )
}

export function Segmented<V extends string>({
  value,
  options,
  onChange,
  label,
}: {
  value: V
  options: { value: V; k: StringKey }[]
  onChange: (v: V) => void
  label: string
}) {
  const id = useId()
  return (
    <div role="tablist" aria-label={label} className="inline-flex h-10 flex-wrap rounded-lg bg-ink-850 p-1">
      {options.map((o) => {
        const active = o.value === value
        return (
          <button
            key={o.value}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(o.value)}
            className={`press relative h-8 rounded-md px-4 text-sm font-medium transition-colors ${active ? 'text-ink-950' : 'text-paper-2 hover:text-paper'}`}
          >
            {active && <motion.span layoutId={`seg-${id}`} transition={T_LAYOUT} className="absolute inset-0 rounded-md bg-paper" />}
            <span className="relative">
              <T k={o.k} />
            </span>
          </button>
        )
      })}
    </div>
  )
}

export function SearchBox({ value, onChange, placeholder = 'searchPh' }: { value: string; onChange: (v: string) => void; placeholder?: StringKey }) {
  const { t } = useLang()
  return (
    <label className="relative block w-full sm:max-w-sm">
      <Search className="pointer-events-none absolute start-4 top-1/2 size-4 -translate-y-1/2 text-paper-3" aria-hidden="true" />
      <input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={t(placeholder)}
        aria-label={t(placeholder)}
        className="h-11 w-full rounded-full bg-ink-950 ps-11 pe-4 text-sm font-semibold text-paper placeholder:text-paper-3 focus:outline-2 focus:outline-gold"
      />
    </label>
  )
}

const PAGE_SIZES = [10, 25, 50, 100]

/** Cuts a list into pages. A new search or filter (resetKey) goes back to page 1; live rows arriving do not. */
export function usePaged<T>(list: T[], resetKey = '', initialSize = 10) {
  const [size, setSize] = useState(initialSize)
  const [page, setPage] = useState(1)
  useEffect(() => setPage(1), [resetKey])
  const pages = Math.max(1, Math.ceil(list.length / size))
  const current = Math.min(page, pages)
  const start = (current - 1) * size
  return { rows: list.slice(start, start + size), page: current, pages, size, total: list.length, start, setPage, setSize: (n: number) => (setSize(n), setPage(1)) }
}

export function Pager({ p }: { p: ReturnType<typeof usePaged<unknown>> }) {
  const { t } = useLang()
  const [jump, setJump] = useState('')
  if (p.total === 0) return null
  const go = (n: number) => p.setPage(Math.min(p.pages, Math.max(1, n)))
  const arrow = 'press grid size-10 place-items-center rounded-full bg-ink-800 text-paper transition-colors hover:bg-ink-700 disabled:opacity-40'
  return (
    <nav className="mt-5 flex flex-wrap items-center justify-between gap-x-6 gap-y-3 text-sm text-paper-2" aria-label="Pages">
      <div className="flex items-center gap-3">
        <div className="inline-flex h-10 items-center rounded-full bg-ink-800 p-1">
          {PAGE_SIZES.map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => p.setSize(n)}
              aria-pressed={p.size === n}
              className={`press num h-8 rounded-full px-3 transition-colors ${p.size === n ? 'bg-paper text-ink-950' : 'text-paper-2 hover:text-paper'}`}
            >
              {n}
            </button>
          ))}
        </div>
        <T k="perPage" />
      </div>
      <span className="num">
        <T text={fill(S.showingRange, { from: p.start + 1, to: Math.min(p.total, p.start + p.size), total: p.total })} />
      </span>
      <div className="flex items-center gap-2">
        <button type="button" onClick={() => go(p.page - 1)} disabled={p.page <= 1} aria-label={t('prevPage')} className={arrow}>
          <ChevronLeft className="size-4 rtl:rotate-180" />
        </button>
        <span className="num px-1 text-paper">
          <T text={fill(S.pageOf, { n: p.page, total: p.pages })} />
        </span>
        <button type="button" onClick={() => go(p.page + 1)} disabled={p.page >= p.pages} aria-label={t('nextPage')} className={arrow}>
          <ChevronRight className="size-4 rtl:rotate-180" />
        </button>
        {p.pages > 2 && (
          <form
            className="ms-2 flex items-center gap-2"
            onSubmit={(e) => {
              e.preventDefault()
              if (jump) go(Number(jump))
              setJump('')
            }}
          >
            <input
              value={jump}
              onChange={(e) => setJump(e.target.value.replace(/\D/g, ''))}
              inputMode="numeric"
              placeholder={t('goToPage')}
              aria-label={t('goToPage')}
              className="num h-10 w-32 rounded-full bg-ink-950 px-4 text-sm font-semibold text-paper placeholder:text-paper-3 focus:outline-2 focus:outline-gold"
            />
          </form>
        )}
      </div>
    </nav>
  )
}
