import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ElementType, type ReactNode } from 'react'
import { S, type StringKey } from './i18n'
import type { Bilingual } from './types'
import { readItem, writeItem } from './storage'

export type LangMode = 'en' | 'ar' | 'both'

interface LangState {
  mode: LangMode
  setMode: (m: LangMode) => void
  pick: (b: Bilingual | null | undefined) => string
  t: (k: StringKey) => string
}

const KEY = 'ti.lang'

const LangContext = createContext<LangState | null>(null)

function initialMode(): LangMode {
  const saved = readItem(KEY)
  if (saved === 'en' || saved === 'ar' || saved === 'both') return saved
  return 'both'
}

export function LangProvider({ children }: { children: ReactNode }) {
  const [mode, setModeState] = useState<LangMode>(initialMode)

  const setMode = useCallback((m: LangMode) => {
    setModeState(m)
    writeItem(KEY, m)
  }, [])

  useEffect(() => {
    const root = document.documentElement
    root.lang = mode === 'ar' ? 'ar' : 'en'
    root.dir = mode === 'ar' ? 'rtl' : 'ltr'
    root.dataset.lang = mode
  }, [mode])

  const value = useMemo<LangState>(() => {
    const pick = (b: Bilingual | null | undefined) => (b ? (mode === 'ar' ? b.ar : b.en) : '')
    return { mode, setMode, pick, t: (k) => pick(S[k]) }
  }, [mode, setMode])

  return <LangContext.Provider value={value}>{children}</LangContext.Provider>
}

export function useLang(): LangState {
  const ctx = useContext(LangContext)
  if (!ctx) throw new Error('useLang must be used inside LangProvider')
  return ctx
}

function resolve(k?: StringKey, text?: Bilingual | null): Bilingual {
  if (text) return text
  if (k) return S[k]
  return { en: '', ar: '' }
}

interface InlineProps {
  k?: StringKey
  text?: Bilingual | null
  className?: string
  arClassName?: string
  stacked?: boolean
}

export function T({ k, text, className, arClassName, stacked }: InlineProps) {
  const { mode } = useLang()
  const b = resolve(k, text)
  if (mode === 'en') return <span className={className}>{b.en}</span>
  if (mode === 'ar') return <span className={className} lang="ar">{b.ar}</span>
  if (b.en === b.ar) return <span className={className}>{b.en}</span>
  return (
    <span className={`${stacked ? 'inline-flex flex-col items-center leading-tight' : 'inline-flex flex-wrap items-baseline gap-x-2'} ${className ?? ''}`}>
      <span>{b.en}</span>
      <span lang="ar" dir="rtl" className={arClassName ?? 'opacity-75'}>
        {b.ar}
      </span>
    </span>
  )
}

interface BlockProps {
  k?: StringKey
  text?: Bilingual | null
  as?: ElementType
  className?: string
  enClassName?: string
  arClassName?: string
  split?: 'columns' | 'stack'
}

export function Tx({ k, text, as: Tag = 'p', className = '', enClassName = '', arClassName = '', split = 'columns' }: BlockProps) {
  const { mode } = useLang()
  const b = resolve(k, text)
  if (mode === 'en') return <Tag className={`${className} ${enClassName}`}>{b.en}</Tag>
  if (mode === 'ar') return <Tag className={`${className} ${arClassName}`} lang="ar">{b.ar}</Tag>
  const grid = split === 'columns' ? 'grid gap-x-8 gap-y-1.5 md:grid-cols-2' : 'grid gap-y-1.5'
  return (
    <div className={grid}>
      <Tag className={`${className} ${enClassName}`}>{b.en}</Tag>
      <Tag className={`${className} ${arClassName} text-right`} lang="ar" dir="rtl">
        {b.ar}
      </Tag>
    </div>
  )
}
