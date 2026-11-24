import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { T } from '../lib/lang'
import type { Bilingual } from '../lib/types'

interface ToastItem {
  id: number
  text: Bilingual
  tone: 'ok' | 'error'
}

const ToastContext = createContext<(text: Bilingual, tone?: 'ok' | 'error') => void>(() => undefined)

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([])
  const seq = useRef(0)

  const push = useCallback((text: Bilingual, tone: 'ok' | 'error' = 'ok') => {
    seq.current += 1
    const id = seq.current
    setItems((prev) => [...prev, { id, text, tone }])
    setTimeout(() => setItems((prev) => prev.filter((i) => i.id !== id)), 3600)
  }, [])

  return (
    <ToastContext.Provider value={push}>
      {children}
      <div
        className="pointer-events-none fixed inset-x-0 bottom-[calc(5.5rem+env(safe-area-inset-bottom))] z-[60] flex flex-col items-center gap-2 px-4 md:bottom-8"
        aria-live="polite"
      >
        <AnimatePresence>
          {items.map((i) => (
            <motion.div
              key={i.id}
              layout
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 12 }}
              transition={{ duration: 0.4, ease: 'easeInOut' }}
              className="pointer-events-auto flex max-w-md items-center gap-3 rounded-lg border border-line bg-ink-800 px-4 py-3 text-sm font-medium text-paper"
            >
              <span className={`size-2 shrink-0 rounded-full ${i.tone === 'ok' ? 'bg-safe' : 'bg-warn'}`} aria-hidden="true" />
              <T text={i.text} />
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  )
}

export function useToast() {
  return useContext(ToastContext)
}
