import { useLang } from '../lib/lang'

function Quote() {
  return (
    <>
      <circle cx="6" cy="13" r="5" />
      <path d="M1.4 13.4C1.2 7.6 3.6 3.2 8.6 1.2" fill="none" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" />
      <circle cx="19" cy="13" r="5" />
      <path d="M14.4 13.4C14.2 7.6 16.6 3.2 21.6 1.2" fill="none" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" />
    </>
  )
}

export function LogoMark({ className = 'size-8' }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={`${className} text-white`} aria-hidden="true">
      <defs>
        <linearGradient id="ti-mark" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#5a48f2" />
          <stop offset="1" stopColor="#c64fd8" />
        </linearGradient>
      </defs>
      <rect width="64" height="64" rx="18" fill="url(#ti-mark)" />
      <g fill="currentColor">
        <g transform="translate(10 9)">
          <Quote />
        </g>
        <g transform="translate(54 55) rotate(180)">
          <Quote />
        </g>
      </g>
    </svg>
  )
}

export function Wordmark({ size = 'md' }: { size?: 'md' | 'lg' }) {
  const { mode } = useLang()
  const lg = size === 'lg'
  return (
    <span className="inline-flex items-baseline gap-3 whitespace-nowrap" dir="ltr">
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
