import type { Severity, Verdict } from './types'
import type { StringKey } from './i18n'

export const VERDICT_COLOR: Record<Verdict, string> = {
  safe: '#10b981',
  suspicious: '#f59e0b',
  scam: '#ef4444',
  unknown: '#94a3b8',
}

export const VERDICT_LABEL: Record<Verdict, StringKey> = {
  safe: 'v_safe',
  suspicious: 'v_suspicious',
  scam: 'v_scam',
  unknown: 'v_unknown',
}

export const SEVERITY_LABEL: Record<Severity, StringKey> = {
  critical: 'sev_critical',
  high: 'sev_high',
  medium: 'sev_medium',
  low: 'sev_low',
  info: 'sev_info',
}

export const SEVERITY_COLOR: Record<Severity, string> = {
  critical: '#ef4444',
  high: '#f97316',
  medium: '#f59e0b',
  low: '#94a3b8',
  info: '#10b981',
}

export function verdictFromScore(score: number): Verdict {
  if (score >= 75) return 'scam'
  if (score >= 40) return 'suspicious'
  return 'safe'
}
