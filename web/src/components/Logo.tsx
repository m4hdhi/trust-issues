import { useLang } from '../lib/lang'

export function LogoMark({ className = 'size-8' }: { className?: string }) {
  return <img src="/brand/symbol.png" alt="" className={`brand-symbol ${className}`} />
}

export function Wordmark({ size = 'md' }: { size?: 'md' | 'lg' }) {
  const { mode } = useLang()
  const lg = size === 'lg'
  return (
    <span className="inline-flex items-center gap-2.5 whitespace-nowrap" dir="ltr">
      <LogoMark className={lg ? 'size-10' : 'size-9'} />
      {mode !== 'ar' && (
        <span className={`display leading-none text-paper ${lg ? 'text-2xl' : 'text-lg'}`}>
          <span className="text-gold">“</span>Trust<span className="text-gold">”</span> Issues
        </span>
      )}
      {mode !== 'en' && (
        <span
          lang="ar"
          dir="rtl"
          className={`display leading-none ${mode === 'ar' ? 'text-paper' : `text-paper-2 ${lg ? '' : 'hidden sm:inline'}`} ${lg ? 'text-xl' : 'text-base'}`}
        >
          <span className="text-gold">«</span>أزمة ثقة<span className="text-gold">»</span>
        </span>
      )}
    </span>
  )
}
