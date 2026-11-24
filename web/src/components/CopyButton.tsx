import { useState } from 'react'
import { Check, Copy } from 'lucide-react'
import { T } from '../lib/lang'
import type { StringKey } from '../lib/i18n'

export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    const area = document.createElement('textarea')
    area.value = text
    area.setAttribute('readonly', '')
    area.style.position = 'fixed'
    area.style.opacity = '0'
    document.body.appendChild(area)
    area.select()
    const ok = document.execCommand('copy')
    area.remove()
    return ok
  }
}

export function CopyButton({ value, label = 'copy', className = '' }: { value: string; label?: StringKey; className?: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <button
      type="button"
      onClick={async () => {
        if (await copyText(value)) {
          setCopied(true)
          setTimeout(() => setCopied(false), 1600)
        }
      }}
      className={`inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-ink-500 bg-ink-700 px-3 py-1.5 text-xs font-semibold text-paper transition-colors hover:border-brand hover:text-brand-bright ${className}`}
    >
      {copied ? <Check className="size-3.5 text-safe" /> : <Copy className="size-3.5" />}
      <T k={copied ? 'copied' : label} />
    </button>
  )
}
