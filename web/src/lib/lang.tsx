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

export function T({ k, text, className, arClassName, stacked }: InlineProps) {
  const { mode } = useLang()
  const b = resolve(k, text)
  if (mode === 'en') return <span className={className}>{b.en}</span>
  if (mode === 'ar') return <span className={className} lang="ar">{b.ar}</span>
  if (b.en === b.ar) return <span className={className}>{b.en}</span>
  return (
    <span className={`${stacked ? 'inline-flex flex-col items-center leading-tight' : 'inline-flex flex-wrap items-baseline gap-x-2'} ${className ?? ''}`}>
      <span>{b.en}</span>
      <span lang="ar" dir="rtl" className={arClassName ?? 'opacity-70'}>
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

const SIZE_RE = /(?:^|\s)(?:[\w-]+:)*text-(?:xs|sm|base|lg|xl|[2-9]xl)(?=\s|$)/g
const COLOR_RE = /(?:^|\s)(?:[\w-]+:)*text-(?!(?:xs|sm|base|lg|xl|[2-9]xl|left|right|center|start|end|balance|pretty|wrap|nowrap|ellipsis|clip)(?:\s|$))[a-z][\w/-]*(?=\s|$)/g

function arClasses(base: string, ar: string): string {
  if (!ar) return base
  let out = base
  if (new RegExp(SIZE_RE.source).test(ar)) out = out.replace(SIZE_RE, ' ')
  if (new RegExp(COLOR_RE.source).test(ar)) out = out.replace(COLOR_RE, ' ')
  return `${out} ${ar}`.replace(/\s+/g, ' ').trim()
}

export function Tx({ k, text, as: Tag = 'p', className = '', enClassName = '', arClassName = '', split = 'columns' }: BlockProps) {
  const { mode } = useLang()
  const b = resolve(k, text)
  if (mode === 'en') return <Tag className={`${className} ${enClassName}`}>{b.en}</Tag>
  if (mode === 'ar') return <Tag className={className} lang="ar">{b.ar}</Tag>
  const grid = split === 'columns' ? 'grid gap-x-8 gap-y-2 md:grid-cols-2' : 'grid gap-y-1'
  const Wrapper = Tag === 'span' ? 'span' : 'div'
  return (
    <Wrapper className={grid}>
      <Tag className={`${className} ${enClassName}`}>{b.en}</Tag>
      <Tag className={`${arClasses(className, arClassName)} text-right`} lang="ar" dir="rtl">
        {b.ar}
      </Tag>
    </Wrapper>
  )
}
