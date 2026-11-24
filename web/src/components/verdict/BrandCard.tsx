import { BadgeCheck, VenetianMask } from 'lucide-react'
import { BrandMark } from '../BrandMark'
import { T, useLang } from '../../lib/lang'
import type { BrandRef, Verdict } from '../../lib/types'

export function BrandCard({ brand, verdict }: { brand: BrandRef; verdict: Verdict }) {
  const { mode } = useLang()
  const genuine = verdict === 'safe'
  return (
    <section
      className={`rounded-3xl border p-5 sm:p-6 ${genuine ? 'border-safe/35 bg-safe/[0.06]' : 'border-ink-700 bg-ink-800/70'}`}
    >
      <div className="flex items-center gap-2 text-sm font-semibold" style={{ color: genuine ? '#10b981' : '#f59e0b' }}>
        {genuine ? <BadgeCheck className="size-4" aria-hidden="true" /> : <VenetianMask className="size-4" aria-hidden="true" />}
        <T k={genuine ? 'officialSiteOf' : 'impersonating'} />
      </div>
      <div className="mt-4 flex items-center gap-4">
        <BrandMark brand={brand} className="size-16" />
        <div className="min-w-0">
          {mode !== 'ar' && <p className="text-xl font-bold leading-tight text-paper">{brand.name_en}</p>}
          {mode !== 'en' && (
            <p lang="ar" dir="rtl" className={`font-semibold leading-snug ${mode === 'ar' ? 'text-xl text-paper' : 'mt-1 text-lg text-mist-300'}`}>
              {brand.name_ar}
            </p>
          )}
        </div>
      </div>
      {brand.official_domains.length > 0 && (
        <div className="mt-5 border-t border-ink-700 pt-4">
          <p className="text-xs font-medium text-mist-400">
            <T k="officialDomains" />
          </p>
          <ul className="mt-2 flex flex-wrap gap-2" dir="ltr">
            {brand.official_domains.map((d) => (
              <li
                key={d}
                className="inline-flex items-center gap-1.5 rounded-full border border-seal/40 bg-seal/10 px-3 py-1 font-mono text-[13px] text-seal"
              >
                <BadgeCheck className="size-3.5" aria-hidden="true" />
                {d}
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  )
}
