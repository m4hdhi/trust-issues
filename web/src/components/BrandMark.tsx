import { useState } from 'react'
import type { Bilingual, BrandRef } from '../lib/types'

function initials(name: string): string {
  return name
    .replace(/\(.*?\)/g, ' ')
    .replace(/[&]/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('')
}

export function brandName(brand: string | BrandRef | null | undefined): Bilingual | null {
  if (!brand) return null
  if (typeof brand === 'string') return { en: brand, ar: brand }
  return { en: brand.name_en.replace(/\s*\(.*\)$/, ''), ar: brand.name_ar }
}

export function BrandMark({ brand, className = 'size-10' }: { brand: string | BrandRef | null | undefined; className?: string }) {
  const [failed, setFailed] = useState(false)
  const name = brandName(brand)?.en ?? '?'
  const logo = brand && typeof brand !== 'string' ? brand.logo_url : null
  if (logo && !failed) {
    return (
      <span className={`${className} grid shrink-0 place-items-center overflow-hidden rounded-md bg-sheet p-1`}>
        <img src={logo} alt={name} loading="lazy" onError={() => setFailed(true)} className="h-full w-full object-contain" />
      </span>
    )
  }
  return (
    <span aria-hidden="true" className={`${className} grid shrink-0 place-items-center rounded-md bg-ink-700 text-xs font-medium text-paper-2`}>
      {initials(name)}
    </span>
  )
}
