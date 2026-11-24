import { useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { Check, Copy } from 'lucide-react'
import { T } from '../lib/lang'
import type { StringKey } from '../lib/i18n'
import { btn } from './ui'

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
      className={`${btn.small} shrink-0 ${className}`}
    >
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.span
          key={copied ? 'done' : 'idle'}
          initial={{ opacity: 0, scale: 0.8, filter: 'blur(2px)' }}
          animate={{ opacity: 1, scale: 1, filter: 'blur(0px)' }}
          exit={{ opacity: 0, scale: 0.8, filter: 'blur(2px)' }}
          transition={{ duration: 0.16 }}
          className="inline-flex"
        >
          {copied ? <Check className="size-4 text-safe" /> : <Copy className="size-4" />}
        </motion.span>
      </AnimatePresence>
      <T k={copied ? 'copied' : label} />
    </button>
  )
}
