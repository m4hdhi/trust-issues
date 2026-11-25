import { useLang } from '../lib/lang'

export function LogoMark({ className = 'size-8' }: { className?: string }) {
  return <img src="/brand/symbol.png" alt="" className={`brand-symbol ${className}`} />
}

/** The full brand logo. English uses the designed lockup; Arabic sets the symbol beside the Arabic name. */
export function Wordmark({ size = 'md' }: { size?: 'md' | 'lg' }) {
  const { mode } = useLang()
  const lg = size === 'lg'
  if (mode !== 'ar') {
    return (
      <span className={`brand-logo block shrink-0 ${lg ? 'h-14' : 'h-10 sm:h-12'}`} role="img" aria-label="Trust Issues">
        <img src="/brand/logo.png" alt="" className="brand-logo-light h-full w-auto" />
        <img src="/brand/logo-white.png" alt="" className="brand-logo-dark h-full w-auto" />
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-2.5 whitespace-nowrap" dir="ltr">
      <LogoMark className={lg ? 'size-12' : 'size-10'} />
      <span lang="ar" dir="rtl" className={`display leading-none text-paper ${lg ? 'text-3xl' : 'text-2xl'}`}>
        <span className="text-gold">«</span>أزمة ثقة<span className="text-gold">»</span>
      </span>
    </span>
  )
}
