import { useState } from 'react'
import type { BrandRef } from '../lib/types'

function initials(name: string): string {
  const words = name.replace(/[()&]/g, ' ').split(/\s+/).filter(Boolean)
  return words
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('')
}

export function brandName(brand: string | BrandRef | null | undefined): { en: string; ar: string } | null {
  if (!brand) return null
  if (typeof brand === 'string') return { en: brand, ar: brand }
  return { en: brand.name_en, ar: brand.name_ar }
}

export function BrandMark({ brand, className = 'size-10' }: { brand: string | BrandRef | null | undefined; className?: string }) {
  const [failed, setFailed] = useState(false)
  const name = brandName(brand)?.en ?? '?'
  const logo = brand && typeof brand !== 'string' ? brand.logo_url : null
  if (logo && !failed) {
    return (
      <img
        src={logo}
        alt=""
        onError={() => setFailed(true)}
        className={`${className} shrink-0 rounded-xl bg-white object-contain p-1`}
      />
    )
  }
  return (
    <span
      aria-hidden="true"
      className={`${className} grid shrink-0 place-items-center rounded-xl border border-ink-500 bg-ink-700 text-[13px] font-bold text-mist-200`}
    >
      {initials(name)}
    </span>
  )
}
