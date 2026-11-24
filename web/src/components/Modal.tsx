import { useEffect, useRef, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion } from 'motion/react'
import { X } from 'lucide-react'
import { useLang } from '../lib/lang'
import { EASE_DRAWER, EASE_OUT } from '../lib/motion'

interface ModalProps {
  open: boolean
  onClose: () => void
  title: ReactNode
  children: ReactNode
  wide?: boolean
}

export function Modal({ open, onClose, title, children, wide = false }: ModalProps) {
  const { t } = useLang()
  const panel = useRef<HTMLDivElement>(null)
  // Parents pass a new onClose on every render. Keeping it in a ref means a background refresh of the page
  // does not re-run the effect below, which would move focus to the panel and close the phone keyboard.
  const closeRef = useRef(onClose)
  closeRef.current = onClose

  useEffect(() => {
    if (!open) return
    const prev = document.activeElement as HTMLElement | null
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeRef.current()
    }
    document.addEventListener('keydown', onKey)
    const overflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    requestAnimationFrame(() => panel.current?.focus())
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = overflow
      prev?.focus()
    }
  }, [open])

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-8"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, transition: { duration: 0.18 } }}
          transition={{ duration: 0.2 }}
        >
          <div className="absolute inset-0 bg-[#15143c]/45 backdrop-blur-sm" onClick={onClose} aria-hidden="true" />
          <motion.div
            ref={panel}
            role="dialog"
            aria-modal="true"
            tabIndex={-1}
            className={`relative max-h-[92dvh] w-full overflow-y-auto rounded-t-[2rem] bg-ink-950 p-6 shadow-[0_30px_80px_-20px_rgb(21_20_60/0.5)] pb-[max(1.5rem,env(safe-area-inset-bottom))] outline-none sm:rounded-[2rem] sm:p-8 ${
              wide ? 'sm:max-w-4xl' : 'sm:max-w-lg'
            }`}
            initial={{ y: 32, opacity: 0, scale: 0.98 }}
            animate={{ y: 0, opacity: 1, scale: 1, transition: { duration: 0.35, ease: EASE_DRAWER } }}
            exit={{ y: 16, opacity: 0, transition: { duration: 0.18, ease: EASE_OUT } }}
          >
            <div className="mb-6 flex items-start justify-between gap-4">
              <div className="display text-xl text-paper">{title}</div>
              <button
                type="button"
                onClick={onClose}
                aria-label={t('close')}
                className="press -m-2 grid size-10 shrink-0 place-items-center rounded-lg text-paper-3 hover:bg-ink-700 hover:text-paper"
              >
                <X className="size-5" />
              </button>
            </div>
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  )
}
