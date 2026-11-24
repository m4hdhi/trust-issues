import { RotateCcw } from 'lucide-react'
import { T, Tx } from '../lib/lang'
import type { StringKey } from '../lib/i18n'
import { btn } from './ui'

export function Spinner({ className = 'size-4' }: { className?: string }) {
  return (
    <span className={`relative inline-block shrink-0 ${className}`} aria-hidden="true">
      <span className="absolute inset-0 rounded-full border-2 border-current opacity-25" />
      <span className="absolute inset-0 animate-spin rounded-full border-2 border-transparent border-t-current [animation-duration:600ms]" />
    </span>
  )
}

export function LoadingState({ label = 'loading' }: { label?: StringKey }) {
  return (
    <div className="flex items-center justify-center gap-3 py-16 text-sm text-paper-3" role="status">
      <Spinner />
      <T k={label} />
    </div>
  )
}

export function ErrorState({ onRetry, message = 'loadFailed' }: { onRetry?: () => void; message?: StringKey }) {
  return (
    <div className="flex flex-col items-start gap-4 border-t border-line py-8 text-base text-paper-2">
      <Tx k={message} split="stack" />
      {onRetry && (
        <button type="button" onClick={onRetry} className={btn.small}>
          <RotateCcw className="size-4" />
          <T k="retry" />
        </button>
      )}
    </div>
  )
}

export function EmptyState({ message }: { message: StringKey }) {
  return (
    <div className="border-t border-line py-8 text-base text-paper-3">
      <Tx k={message} split="stack" />
    </div>
  )
}

export function Skeleton({ className = '' }: { className?: string }) {
  return <span className={`block animate-pulse rounded-md bg-ink-800 ${className}`} aria-hidden="true" />
}
