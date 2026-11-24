import { BadgeCheck } from 'lucide-react'
import { BrandMark } from '../BrandMark'
import { useLang } from '../../lib/lang'
import type { BrandRef } from '../../lib/types'

export function BrandPanel({ brand }: { brand: BrandRef }) {
  const { mode } = useLang()
  return (
    <div className="flex flex-wrap items-center gap-6">
      <BrandMark brand={brand} className="size-16" />
      <div className="min-w-0">
        {mode !== 'ar' && <p className="display text-xl text-paper">{brand.name_en}</p>}
        {mode !== 'en' && (
          <p lang="ar" dir="rtl" className={`display ${mode === 'ar' ? 'text-xl text-paper' : 'mt-1 text-lg text-paper-2'}`}>
            {brand.name_ar}
          </p>
        )}
        {brand.official_domains.length > 0 && (
          <ul className="mt-3 flex flex-wrap gap-2" dir="ltr">
            {brand.official_domains.map((d) => (
              <li key={d} className="evidence inline-flex items-center gap-1 rounded-md bg-safe/10 px-2 py-1 text-sm text-safe">
                <BadgeCheck className="size-4" aria-hidden="true" />
                {d}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
