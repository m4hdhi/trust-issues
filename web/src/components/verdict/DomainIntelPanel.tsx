import type { ReactNode } from 'react'
import { T } from '../../lib/lang'
import { ageDays, num } from '../../lib/format'
import type { StringKey } from '../../lib/i18n'
import type { DomainIntel } from '../../lib/types'

function flag(country: string | null | undefined): string {
  if (!country || country.length !== 2) return ''
  return String.fromCodePoint(...[...country.toUpperCase()].map((c) => 0x1f1e6 + c.charCodeAt(0) - 65))
}

function Cell({ label, children, alert }: { label: StringKey; children: ReactNode; alert?: boolean }) {
  return (
    <div className="border-b border-line py-6 sm:even:border-s sm:even:ps-8 sm:odd:pe-8">
      <dt className="text-sm text-paper-3">
        <T k={label} />
      </dt>
      <dd className={`mt-2 ${alert ? 'text-scam' : 'text-paper'}`}>{children}</dd>
    </div>
  )
}

export function DomainIntelPanel({ intel }: { intel: DomainIntel }) {
  const young = intel.age_days != null && intel.age_days < 90
  const freshTls = intel.tls_age_days != null && intel.tls_age_days < 14
  return (
    <dl className="grid border-t border-line sm:grid-cols-2">
      <Cell label="domainAge" alert={young}>
        {intel.age_days != null ? (
          <>
            <span className="display block text-2xl">
              <T text={ageDays(intel.age_days)} />
            </span>
            {young && (
              <span className="mt-1 block text-sm">
                <T k="newlyRegistered" />
              </span>
            )}
          </>
        ) : (
          <span className="text-base text-paper-3">
            <T k="unknownValue" />
          </span>
        )}
      </Cell>
      <Cell label="tlsCert" alert={freshTls}>
        {intel.tls_age_days != null ? (
          <span className="display block text-2xl">
            <T text={ageDays(intel.tls_age_days)} />
          </span>
        ) : (
          <span className="text-base text-paper-3">
            <T k="unknownValue" />
          </span>
        )}
        {intel.tls_issuer && <span className="evidence mt-1 block truncate text-sm text-paper-2">{intel.tls_issuer}</span>}
        {intel.ct_cert_count != null && (
          <span className="mt-1 block text-sm text-paper-3">
            <span className="evidence num text-paper-2">{num(intel.ct_cert_count)}</span> <T k="certsSeen" />
          </span>
        )}
      </Cell>
      <Cell label="registrar">
        <span className="block truncate text-lg" title={intel.registrar ?? ''}>
          {intel.registrar ?? <T k="unknownValue" />}
        </span>
        {intel.nameservers[0] && <span className="evidence mt-1 block truncate text-sm text-paper-3">{intel.nameservers[0]}</span>}
      </Cell>
      <Cell label="hosting">
        <span className="block truncate text-lg" title={intel.as_org ?? ''}>
          {flag(intel.country)} {intel.as_org ?? intel.country ?? <T k="unknownValue" />}
        </span>
        <span className="evidence mt-1 block truncate text-sm text-paper-3">{[intel.asn, intel.ips[0]].filter(Boolean).join('  ')}</span>
      </Cell>
    </dl>
  )
}
