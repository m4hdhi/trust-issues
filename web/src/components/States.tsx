import { AlertTriangle, Loader2, RotateCcw } from 'lucide-react'
import { T } from '../lib/lang'
import type { StringKey } from '../lib/i18n'

export function Spinner({ className = 'size-5' }: { className?: string }) {
  return <Loader2 className={`${className} animate-spin`} aria-hidden="true" />
}

export function LoadingState({ label = 'loading' }: { label?: StringKey }) {
  return (
    <div className="flex items-center justify-center gap-2.5 py-14 text-sm text-mist-400" role="status">
      <Spinner />
      <T k={label} />
    </div>
  )
}

export function ErrorState({ onRetry, message = 'loadFailed' }: { onRetry?: () => void; message?: StringKey }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-ink-500 px-6 py-10 text-center text-sm text-mist-300">
      <AlertTriangle className="size-6 text-warn" aria-hidden="true" />
      <T k={message} />
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="inline-flex items-center gap-1.5 rounded-full border border-ink-500 px-4 py-2 text-xs font-semibold text-paper hover:border-brand"
        >
          <RotateCcw className="size-3.5" />
          <T k="retry" />
        </button>
      )}
    </div>
  )
}

export function EmptyState({ message }: { message: StringKey }) {
  return (
    <div className="rounded-2xl border border-dashed border-ink-500 px-6 py-10 text-center text-sm text-mist-400">
      <T k={message} />
    </div>
  )
}
