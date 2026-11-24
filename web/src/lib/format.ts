import type { Bilingual } from './types'

const nf = new Intl.NumberFormat('en-US')

export function toMs(iso: string): number {
  const hasZone = /(Z|[+-]\d{2}:?\d{2})$/i.test(iso)
  return new Date(hasZone || !iso.includes('T') ? iso : `${iso}Z`).getTime()
}

export function num(n: number | null | undefined): string {
  return n == null ? 'n/a' : nf.format(n)
}

export function compact(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(n >= 10_000_000 ? 0 : 1)}M`
  if (n >= 10_000) return `${Math.round(n / 1000)}K`
  return nf.format(n)
}

export function pct(v: number | null | undefined, digits = 1): string {
  if (v == null || Number.isNaN(v)) return 'n/a'
  return `${(v * 100).toFixed(digits)}%`
}

interface ArForms {
  one: string
  two: string
  few: string
  many: string
}

function arCount(n: number, f: ArForms): string {
  if (n === 1) return f.one
  if (n === 2) return f.two
  const mod = n % 100
  if (mod >= 3 && mod <= 10) return `${n} ${f.few}`
  return `${n} ${f.many}`
}

function enCount(n: number, one: string, many: string): string {
  return `${nf.format(n)} ${n === 1 ? one : many}`
}

const AR_UNITS = {
  minute: { one: 'دقيقة', two: 'دقيقتين', few: 'دقائق', many: 'دقيقة' },
  hour: { one: 'ساعة', two: 'ساعتين', few: 'ساعات', many: 'ساعة' },
  day: { one: 'يوم', two: 'يومين', few: 'أيام', many: 'يومًا' },
  month: { one: 'شهر', two: 'شهرين', few: 'أشهر', many: 'شهرًا' },
  year: { one: 'سنة', two: 'سنتين', few: 'سنوات', many: 'سنة' },
} satisfies Record<string, ArForms>

const AR_DURATION = {
  day: { one: 'يوم واحد', two: 'يومان', few: 'أيام', many: 'يومًا' },
  year: { one: 'سنة واحدة', two: 'سنتان', few: 'سنوات', many: 'سنة' },
} satisfies Record<string, ArForms>

export function timeAgo(iso: string | null | undefined, now = Date.now()): Bilingual {
  if (!iso) return { en: 'n/a', ar: 'غير متاح' }
  const diff = Math.max(0, now - toMs(iso))
  const min = Math.floor(diff / 60_000)
  if (min < 1) return { en: 'just now', ar: 'الآن' }
  if (min < 60) return { en: `${enCount(min, 'min', 'min')} ago`, ar: `قبل ${arCount(min, AR_UNITS.minute)}` }
  const h = Math.floor(min / 60)
  if (h < 24) return { en: `${enCount(h, 'hour', 'hours')} ago`, ar: `قبل ${arCount(h, AR_UNITS.hour)}` }
  const d = Math.floor(h / 24)
  if (d < 31) return { en: `${enCount(d, 'day', 'days')} ago`, ar: `قبل ${arCount(d, AR_UNITS.day)}` }
  const mo = Math.floor(d / 30)
  if (mo < 12) return { en: `${enCount(mo, 'month', 'months')} ago`, ar: `قبل ${arCount(mo, AR_UNITS.month)}` }
  const y = Math.floor(d / 365)
  return { en: `${enCount(y, 'year', 'years')} ago`, ar: `قبل ${arCount(y, AR_UNITS.year)}` }
}

export function shortAgo(iso: string | null | undefined, now = Date.now()): string {
  if (!iso) return 'n/a'
  const s = Math.max(0, Math.floor((now - toMs(iso)) / 1000))
  if (s < 60) return `${s}s`
  if (s < 3600) return `${Math.floor(s / 60)}m`
  if (s < 86400) return `${Math.floor(s / 3600)}h`
  return `${Math.floor(s / 86400)}d`
}

export function ageDays(days: number): Bilingual {
  if (days < 365) {
    return { en: enCount(days, 'day', 'days'), ar: arCount(days, AR_DURATION.day) }
  }
  const y = Math.floor(days / 365)
  return { en: enCount(y, 'year', 'years'), ar: arCount(y, AR_DURATION.year) }
}

export function reportsCount(n: number): Bilingual {
  return {
    en: `Reported ${enCount(n, 'time', 'times')}`,
    ar: `أُبلغ عنه ${arCount(n, { one: 'مرة واحدة', two: 'مرتين', few: 'مرات', many: 'مرة' })}`,
  }
}

export function networkOf(n: number): Bilingual {
  return {
    en: `Part of a network of ${nf.format(n)} sites`,
    ar: `جزء من شبكة تضم ${arCount(n, { one: 'موقعًا واحدًا', two: 'موقعين', few: 'مواقع', many: 'موقعًا' })}`,
  }
}

export function sitesCount(n: number): Bilingual {
  return {
    en: enCount(n, 'site', 'sites'),
    ar: arCount(n, { one: 'موقع واحد', two: 'موقعان', few: 'مواقع', many: 'موقعًا' }),
  }
}

export function ms(n: number | null | undefined): string {
  if (n == null) return ''
  return n >= 1000 ? `${(n / 1000).toFixed(1)}s` : `${Math.round(n)}ms`
}

export function hostOf(url: string): string {
  try {
    return new URL(url).hostname
  } catch {
    return url.replace(/^\w+:\/\//, '').split('/')[0] ?? url
  }
}

export function dateTime(iso: string): string {
  const d = new Date(toMs(iso))
  return d.toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
}

export function defang(domain: string): string {
  const i = domain.lastIndexOf('.')
  return i > 0 ? `${domain.slice(0, i)}[.]${domain.slice(i + 1)}` : domain
}

export function caseNumber(id: string): string {
  return `TI-${id.replace(/^scan_/, '').slice(0, 6).toUpperCase()}`
}
