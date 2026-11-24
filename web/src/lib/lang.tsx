import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ElementType, type ReactNode } from 'react'
import { S, type StringKey } from './i18n'
import type { Bilingual } from './types'
import { readItem, writeItem } from './storage'

export type LangMode = 'en' | 'ar'

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
  if (saved === 'en' || saved === 'ar') return saved
  return navigator.language?.toLowerCase().startsWith('ar') ? 'ar' : 'en'
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
    const pick = (b: Bilingual | null | undefined) => (b ? undash(mode === 'ar' ? b.ar : b.en) : '')
    return { mode, setMode, pick, t: (k) => pick(S[k]) }
  }, [mode, setMode])

  return <LangContext.Provider value={value}>{children}</LangContext.Provider>
}

export function useLang(): LangState {
  const ctx = useContext(LangContext)
  if (!ctx) throw new Error('useLang must be used inside LangProvider')
  return ctx
}

const DASH = /\s+[\u2013\u2014]\s+/g

export function undash(s: string): string {
  return s.replace(DASH, ': ')
}

function resolve(k?: StringKey, text?: Bilingual | null): Bilingual {
  if (text) return { en: undash(text.en), ar: undash(text.ar) }
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

export function T({ k, text, className }: InlineProps) {
  const { mode } = useLang()
  const b = resolve(k, text)
  if (mode === 'ar') return <span className={className} lang="ar">{b.ar}</span>
  return <span className={className}>{b.en}</span>
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

export function Tx({ k, text, as: Tag = 'p', className = '', enClassName = '' }: BlockProps) {
  const { mode } = useLang()
  const b = resolve(k, text)
  if (mode === 'ar') return <Tag className={className} lang="ar">{b.ar}</Tag>
  return <Tag className={`${className} ${enClassName}`}>{b.en}</Tag>
}
