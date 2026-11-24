import { useEffect, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion } from 'motion/react'
import {
  CalendarPlus,
  FileBadge,
  FileSpreadsheet,
  Flag,
  MapPin,
  ScanSearch,
  Search,
  SpellCheck2,
  X,
  type LucideIcon,
} from 'lucide-react'
import { T, Tx, useLang } from '../lib/lang'
import type { StringKey } from '../lib/i18n'
import type { CaseSource } from '../lib/types'

export const SOURCE_META: Record<CaseSource, { icon: LucideIcon; color: string; k: StringKey }> = {
  ct: { icon: FileBadge, color: '#60a5fa', k: 'src_ct' },
  search: { icon: Search, color: '#f59e0b', k: 'src_search' },
  maps: { icon: MapPin, color: '#34d399', k: 'src_maps' },
  typosquat: { icon: SpellCheck2, color: '#f472b6', k: 'src_typosquat' },
  nrd: { icon: CalendarPlus, color: '#a78bfa', k: 'src_nrd' },
  report: { icon: Flag, color: '#ef4444', k: 'src_report' },
  batch: { icon: FileSpreadsheet, color: '#94a3b8', k: 'src_batch' },
  scan: { icon: ScanSearch, color: '#14b8a6', k: 'src_scan' },
}

export function sourceMeta(source: string) {
  return SOURCE_META[source as CaseSource] ?? SOURCE_META.batch
}

export function SourceLabel({ source }: { source: string }) {
  const meta = SOURCE_META[source as CaseSource]
  return meta ? <T k={meta.k} /> : <span>{source}</span>
}

export function SourceIcon({ source, className = 'size-9' }: { source: string; className?: string }) {
  const meta = sourceMeta(source)
  const Icon = meta.icon
  return (
    <span className={`${className} grid shrink-0 place-items-center rounded-xl`} style={{ background: `${meta.color}1f`, color: meta.color }}>
      <Icon className="size-[45%]" aria-hidden="true" />
    </span>
  )
}

export function PageHeader({ title, sub, right }: { title: StringKey; sub?: StringKey; right?: ReactNode }) {
  return (
    <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        <h1 className="text-2xl font-extrabold tracking-tight text-paper sm:text-[28px]">
          <T k={title} arClassName="font-bold text-mist-300" />
        </h1>
        {sub && <Tx k={sub} className="mt-1 text-sm text-mist-400" split="stack" />}
      </div>
      {right}
    </header>
  )
}

export function Panel({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <section className={`rounded-2xl border border-ink-700 bg-ink-850 ${className}`}>{children}</section>
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
        <motion.div className="fixed inset-0 z-50" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <div className="absolute inset-0 bg-ink-950/70 backdrop-blur-sm" onClick={onClose} aria-hidden="true" />
          <motion.aside
            role="dialog"
            aria-modal="true"
            className="absolute inset-y-0 end-0 flex w-full max-w-6xl flex-col border-s border-ink-600 bg-ink-900 shadow-2xl"
            initial={{ x: '8%', opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: '8%', opacity: 0 }}
            transition={{ type: 'spring', damping: 32, stiffness: 360 }}
          >
            <div className="flex items-center justify-between gap-4 border-b border-ink-700 px-5 py-3.5">
              <div className="min-w-0 truncate font-semibold text-paper">{title}</div>
              <button
                type="button"
                onClick={onClose}
                aria-label={t('close')}
                className="grid size-9 shrink-0 place-items-center rounded-full text-mist-400 hover:bg-ink-700 hover:text-paper"
              >
                <X className="size-5" />
              </button>
            </div>
            <div className="scrollbar-thin flex-1 overflow-y-auto p-4 sm:p-6">{children}</div>
          </motion.aside>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  )
}

export function Segmented<T extends string>({
  value,
  options,
  onChange,
  label,
}: {
  value: T
  options: { value: T; k: StringKey; count?: number }[]
  onChange: (v: T) => void
  label: string
}) {
  return (
    <div role="tablist" aria-label={label} className="inline-flex flex-wrap rounded-xl border border-ink-700 bg-ink-850 p-1">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="tab"
          aria-selected={o.value === value}
          onClick={() => onChange(o.value)}
          className={`inline-flex items-center gap-2 rounded-lg px-3.5 py-1.5 text-sm font-semibold transition-colors ${
            o.value === value ? 'bg-ink-600 text-paper' : 'text-mist-400 hover:text-paper'
          }`}
        >
          <T k={o.k} />
          {o.count != null && <span className="num rounded-md bg-ink-900/70 px-1.5 text-xs text-mist-300">{o.count}</span>}
        </button>
      ))}
    </div>
  )
}
