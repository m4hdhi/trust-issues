import type { Severity, Verdict } from './types'
import type { StringKey } from './i18n'

export const VERDICT_COLOR: Record<Verdict, string> = {
  safe: '#4bb37f',
  suspicious: '#e3a13a',
  scam: '#e5534b',
  unknown: '#8c867c',
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
  critical: '#e5534b',
  high: '#e07b3c',
  medium: '#e3a13a',
  low: '#8c867c',
  info: '#4bb37f',
}

export function verdictFromScore(score: number): Verdict {
  if (score >= 75) return 'scam'
  if (score >= 40) return 'suspicious'
  return 'safe'
}
