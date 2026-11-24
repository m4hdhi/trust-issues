import { useEffect, useRef, useState } from 'react'
import jsQR from 'jsqr'
import { ImageUp } from 'lucide-react'
import { Modal } from './Modal'
import { btn } from './ui'
import { T, Tx } from '../lib/lang'

interface DetectedBarcode {
  rawValue: string
}
interface BarcodeDetectorLike {
  detect(source: CanvasImageSource): Promise<DetectedBarcode[]>
}
type BarcodeDetectorCtor = new (opts: { formats: string[] }) => BarcodeDetectorLike

function nativeDetector(): BarcodeDetectorLike | null {
  const Ctor = (window as unknown as { BarcodeDetector?: BarcodeDetectorCtor }).BarcodeDetector
  if (!Ctor) return null
  try {
    return new Ctor({ formats: ['qr_code'] })
  } catch {
    return null
  }
}

function decodeCanvas(canvas: HTMLCanvasElement, source: CanvasImageSource, w: number, h: number): string | null {
  const scale = Math.min(1, 900 / Math.max(w, h))
  canvas.width = Math.round(w * scale)
  canvas.height = Math.round(h * scale)
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  if (!ctx) return null
  ctx.drawImage(source, 0, 0, canvas.width, canvas.height)
  const img = ctx.getImageData(0, 0, canvas.width, canvas.height)
  return jsQR(img.data, img.width, img.height, { inversionAttempts: 'attemptBoth' })?.data ?? null
}

export function QrScanner({ open, onClose, onResult }: { open: boolean; onClose: () => void; onResult: (text: string) => void }) {
  const video = useRef<HTMLVideoElement>(null)
  const canvas = useRef<HTMLCanvasElement>(null)
  const [cameraFailed, setCameraFailed] = useState(false)
  const [notFound, setNotFound] = useState(false)
  const resultRef = useRef(onResult)
  resultRef.current = onResult

  useEffect(() => {
    if (!open) return
    setCameraFailed(false)
    setNotFound(false)
    let stream: MediaStream | null = null
    let raf = 0
    let stopped = false
    let last = 0
    const detector = nativeDetector()

    const finish = (text: string) => {
      stopped = true
      resultRef.current(text)
    }

    const loop = async (ts: number) => {
      if (stopped) return
      const v = video.current
      if (v && v.readyState >= 2 && ts - last > 180) {
        last = ts
        try {
          if (detector) {
            const codes = await detector.detect(v)
            if (codes[0]?.rawValue) return finish(codes[0].rawValue)
          } else if (canvas.current) {
            const text = decodeCanvas(canvas.current, v, v.videoWidth, v.videoHeight)
            if (text) return finish(text)
          }
        } catch {
          return
        }
      }
      raf = requestAnimationFrame(loop)
    }

    ;(async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 } },
          audio: false,
        })
        if (stopped || !video.current) return
        video.current.srcObject = stream
        await video.current.play()
        raf = requestAnimationFrame(loop)
      } catch {
        setCameraFailed(true)
      }
    })()

    return () => {
      stopped = true
      cancelAnimationFrame(raf)
      stream?.getTracks().forEach((t) => t.stop())
    }
  }, [open])

  const onFile = async (file: File | undefined) => {
    if (!file || !canvas.current) return
    setNotFound(false)
    try {
      const bitmap = await createImageBitmap(file)
      const detector = nativeDetector()
      let text: string | null = null
      if (detector) {
        const codes = await detector.detect(bitmap)
        text = codes[0]?.rawValue ?? null
      }
      text ??= decodeCanvas(canvas.current, bitmap, bitmap.width, bitmap.height)
      if (text) onResult(text)
      else setNotFound(true)
    } catch {
      setNotFound(true)
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={<T k="qrTitle" />}>
      <div className="relative mx-auto aspect-square w-full max-w-sm overflow-hidden rounded-lg bg-ink-950">
        {cameraFailed ? (
          <div className="grid h-full place-items-center p-8 text-center text-base text-paper-2">
            <Tx k="qrNoCamera" split="stack" />
          </div>
        ) : (
          <>
            <video ref={video} playsInline muted className="h-full w-full object-cover" />
            <div className="pointer-events-none absolute inset-8">
              {['start-0 top-0 border-s-2 border-t-2', 'end-0 top-0 border-e-2 border-t-2', 'start-0 bottom-0 border-s-2 border-b-2', 'end-0 bottom-0 border-e-2 border-b-2'].map((c) => (
                <span key={c} className={`absolute size-8 border-gold ${c}`} />
              ))}
              <span className="absolute inset-x-4 top-1/2 h-px overflow-hidden">
                <span className="block h-px w-1/2 animate-scan-line bg-gold" />
              </span>
            </div>
          </>
        )}
      </div>
      <canvas ref={canvas} className="hidden" />
      <Tx k="qrHint" className="mt-6 text-base text-paper-2" split="stack" />
      {notFound && <Tx k="qrNotFound" className="mt-4 text-base text-warn" split="stack" />}
      <label className={`${btn.secondary} mt-6 w-full cursor-pointer`}>
        <ImageUp className="size-4" />
        <T k="qrUpload" />
        <input type="file" accept="image/*" className="sr-only" onChange={(e) => void onFile(e.target.files?.[0])} />
      </label>
    </Modal>
  )
}
