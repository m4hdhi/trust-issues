import type { ReactNode } from 'react'
import { Modal } from '../Modal'

export function Lightbox({ src, title, onClose }: { src: string | null; title: ReactNode; onClose: () => void }) {
  return (
    <Modal open={!!src} onClose={onClose} title={title} wide>
      {src && (
        <div className="max-h-[75dvh] overflow-auto rounded-2xl bg-white">
          <img src={src} alt="" className="mx-auto block w-full max-w-2xl" />
        </div>
      )}
    </Modal>
  )
}
