import { CalendarClock, Fingerprint, Lock, Server, Building2 } from 'lucide-react'
import type { ReactNode } from 'react'
import { Section } from './Section'
import { T } from '../../lib/lang'
import { ageDays, num } from '../../lib/format'
import type { StringKey } from '../../lib/i18n'
import type { DomainIntel } from '../../lib/types'

function flag(country: string | null | undefined): string {
  if (!country || country.length !== 2) return ''
  return String.fromCodePoint(...[...country.toUpperCase()].map((c) => 0x1f1e6 + c.charCodeAt(0) - 65))
}

function Tile({ icon: Icon, label, children, alert }: { icon: typeof Lock; label: StringKey; children: ReactNode; alert?: boolean }) {
  return (
    <div className={`rounded-2xl border p-4 ${alert ? 'border-scam/40 bg-scam/[0.07]' : 'border-ink-700 bg-ink-850'}`}>
      <p className="flex items-center gap-1.5 text-xs font-medium text-mist-400">
        <Icon className="size-3.5" aria-hidden="true" />
        <T k={label} />
      </p>
      <div className="mt-2 min-w-0">{children}</div>
    </div>
  )
}

export function DomainIntelPanel({ intel }: { intel: DomainIntel }) {
  const young = intel.age_days != null && intel.age_days < 90
  const freshTls = intel.tls_age_days != null && intel.tls_age_days < 14
  return (
    <Section icon={Fingerprint} title="intelTitle">
      <div className="grid grid-cols-2 gap-2.5">
        <Tile icon={CalendarClock} label="domainAge" alert={young}>
          {intel.age_days != null ? (
            <>
              <p className={`text-xl font-bold leading-tight ${young ? 'text-scam' : 'text-paper'}`}>
                <T text={ageDays(intel.age_days)} stacked />
              </p>
              {young && (
                <p className="mt-1 text-xs font-semibold text-scam">
                  <T text={{ en: 'Newly registered', ar: 'مسجّل حديثًا' }} />
                </p>
              )}
            </>
          ) : (
            <p className="text-sm text-mist-500">
              <T k="unknownValue" />
            </p>
          )}
        </Tile>
        <Tile icon={Lock} label="tlsCert" alert={freshTls}>
          {intel.tls_issuer || intel.tls_age_days != null ? (
            <>
              {intel.tls_age_days != null && (
                <p className={`text-xl font-bold leading-tight ${freshTls ? 'text-scam' : 'text-paper'}`}>
                  <T text={ageDays(intel.tls_age_days)} stacked />
                </p>
              )}
              {intel.tls_issuer && <p className="mt-1 truncate text-xs text-mist-400" dir="ltr">{intel.tls_issuer}</p>}
              {intel.ct_cert_count != null && (
                <p className="mt-0.5 text-xs text-mist-500">
                  <span className="num font-semibold text-mist-300">{num(intel.ct_cert_count)} </span>
                  <T k="certsSeen" />
                </p>
              )}
            </>
          ) : (
            <p className="text-sm text-mist-500">
              <T k="unknownValue" />
            </p>
          )}
        </Tile>
        <Tile icon={Building2} label="registrar">
          <p className="truncate text-sm font-semibold text-paper" dir="ltr" title={intel.registrar ?? ''}>
            {intel.registrar ?? '—'}
          </p>
          {intel.nameservers[0] && (
            <p className="mt-1 truncate font-mono text-xs text-mist-500" dir="ltr">
              {intel.nameservers[0]}
            </p>
          )}
        </Tile>
        <Tile icon={Server} label="hosting">
          <p className="truncate text-sm font-semibold text-paper" dir="ltr" title={intel.as_org ?? ''}>
            {flag(intel.country)} {intel.as_org ?? intel.country ?? '—'}
          </p>
          <p className="mt-1 truncate font-mono text-xs text-mist-500" dir="ltr">
            {[intel.asn, intel.ips[0]].filter(Boolean).join('  ')}
          </p>
        </Tile>
      </div>
    </Section>
  )
}
