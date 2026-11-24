import { useId } from 'react'
import { useLang } from '../lib/lang'

export function LogoMark({ className = 'size-8' }: { className?: string }) {
  const id = `lg${useId().replace(/[^a-zA-Z0-9]/g, '')}`
  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden="true">
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#2DD4BF" />
          <stop offset="1" stopColor="#0F8F82" />
        </linearGradient>
      </defs>
      <path
        d="M32 3.5 55 11.6v18.2c0 14.6-9.6 25.4-23 30.7C18.6 55.2 9 44.4 9 29.8V11.6Z"
        fill={`url(#${id})`}
        stroke="#C8A96A"
        strokeOpacity=".45"
        strokeWidth="1.2"
      />
      <path d="M13 33c6.5-12.5 31.5-12.5 38 0-6.5 12.5-31.5 12.5-38 0Z" fill="#0B1220" />
      <path
        d="M28 30.4a4.2 4.2 0 1 1 6.3 3.6c-1.4.8-2.2 1.5-2.2 2.8"
        fill="none"
        stroke="#2DD4BF"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
      <circle cx="32.1" cy="40" r="1.35" fill="#2DD4BF" />
    </svg>
  )
}

export function Logo({ size = 'md' }: { size?: 'md' | 'lg' }) {
  const { mode } = useLang()
  const big = size === 'lg'
  return (
    <span className="inline-flex items-center gap-2.5">
      <LogoMark className={big ? 'size-12' : 'size-9'} />
      <span className="flex flex-col leading-none">
        {mode !== 'ar' && (
          <span className={`font-extrabold tracking-[-0.02em] text-paper ${big ? 'text-2xl' : 'text-[17px]'}`}>Trust Issues</span>
        )}
        {mode !== 'en' && (
          <span
            lang="ar"
            className={`font-semibold text-seal ${mode === 'ar' ? (big ? 'text-2xl text-paper' : 'text-lg text-paper') : big ? 'mt-1.5 text-base' : 'mt-1 text-[13px]'}`}
          >
            أزمة ثقة
          </span>
        )}
      </span>
    </span>
  )
}
