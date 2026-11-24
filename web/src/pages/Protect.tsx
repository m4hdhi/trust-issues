import { useEffect, useState, type ReactNode } from 'react'
import { Link } from 'react-router'
import { BellRing, ChevronRight, Download, EyeOff, RefreshCw, Settings, ShieldBan, ShieldCheck, Smartphone, Store } from 'lucide-react'
import { ProtectIllustration } from '../components/ProtectIllustration'
import { CopyButton } from '../components/CopyButton'
import { BrandMark } from '../components/BrandMark'
import { Spinner, ErrorState } from '../components/States'
import { T, Tx, useLang } from '../lib/lang'
import { api } from '../lib/api'
import { timeAgo } from '../lib/format'
import { alertsState, enableAlerts, isAndroid, isIOS, type AlertsState } from '../lib/push'
import { useAsync } from '../lib/useAsync'
import type { StringKey } from '../lib/i18n'
import type { DeviceRegistration } from '../lib/types'

function Step({ n, title, body, art }: { n: number; title: StringKey; body: StringKey; art?: ReactNode }) {
  return (
    <li className="flex gap-4">
      <span className="num grid size-8 shrink-0 place-items-center rounded-full bg-brand/15 text-sm font-bold text-brand-bright">{n}</span>
      <div className="min-w-0 flex-1 pb-1">
        <Tx k={title} as="h3" className="text-base font-bold text-paper" split="stack" />
        <Tx k={body} className="mt-1 text-sm leading-relaxed text-mist-300" split="stack" />
        {art && <div className="mt-3">{art}</div>}
      </div>
    </li>
  )
}

function IosRow({ children, accent }: { children: ReactNode; accent?: boolean }) {
  return (
    <div className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm ${accent ? 'bg-white text-ink-900 ring-2 ring-brand' : 'bg-white/90 text-ink-900'}`} dir="ltr">
      {children}
    </div>
  )
}

const IOS_ART = {
  settings: (
    <div className="inline-flex items-center gap-3 rounded-2xl bg-ink-700 p-3" dir="ltr" aria-hidden="true">
      <span className="grid size-12 place-items-center rounded-[14px] bg-gradient-to-b from-[#9aa1ab] to-[#6b717b] text-white shadow">
        <Settings className="size-7" />
      </span>
      <span className="text-sm font-medium text-mist-200">Settings</span>
    </div>
  ),
  downloaded: (
    <div className="max-w-xs space-y-1.5 rounded-2xl bg-[#f2f2f7] p-2.5" aria-hidden="true">
      <IosRow>
        <span className="size-7 rounded-full bg-[#c7c7cc]" />
        <span className="flex-1 font-medium">Apple Account</span>
        <ChevronRight className="size-4 text-[#c7c7cc]" />
      </IosRow>
      <IosRow accent>
        <span className="flex-1 font-semibold">Profile Downloaded</span>
        <ChevronRight className="size-4 text-[#8e8e93]" />
      </IosRow>
    </div>
  ),
  install: (
    <div className="max-w-xs rounded-2xl bg-[#f2f2f7] p-3" dir="ltr" aria-hidden="true">
      <div className="flex items-center justify-between text-sm">
        <span className="text-[#007aff]">Cancel</span>
        <span className="font-semibold text-ink-900">Install Profile</span>
        <span className="rounded-md px-1.5 font-bold text-[#007aff] ring-2 ring-brand">Install</span>
      </div>
      <div className="mt-3 flex items-center gap-3 rounded-xl bg-white p-3">
        <span className="grid size-10 place-items-center rounded-xl bg-ink-900">
          <ShieldCheck className="size-6 text-brand-bright" />
        </span>
        <div className="text-xs text-ink-900">
          <p className="font-semibold">Trust Issues Scam Shield</p>
          <p className="text-[#8e8e93]">DNS Settings</p>
        </div>
      </div>
    </div>
  ),
}

function IphoneSetup({ reg }: { reg: DeviceRegistration }) {
  return (
    <div className="space-y-6">
      <a
        href={reg.ios_profile_url}
        download
        className="flex w-full items-center justify-center gap-3 rounded-2xl bg-brand px-6 py-4 text-[17px] font-bold text-ink-950 shadow-[0_10px_30px_-10px_rgba(20,184,166,0.8)] hover:bg-brand-bright active:scale-[0.99]"
      >
        <Download className="size-5" aria-hidden="true" />
        <T k="downloadProfile" arClassName="opacity-80" />
      </a>
      <ol className="space-y-6">
        <Step n={1} title="iosStep1" body="iosStep1d" art={IOS_ART.settings} />
        <Step n={2} title="iosStep2" body="iosStep2d" art={IOS_ART.downloaded} />
        <Step n={3} title="iosStep3" body="iosStep3d" art={IOS_ART.install} />
      </ol>
    </div>
  )
}

function AndroidSetup({ reg }: { reg: DeviceRegistration }) {
  const hostname = reg.android_hostname_hint && !reg.android_hostname_hint.includes('://') ? reg.android_hostname_hint : null
  return (
    <ol className="space-y-6">
      <Step
        n={1}
        title="androidStep1"
        body="androidStep1d"
        art={
          <div className="flex flex-wrap gap-2">
            {[
              { href: 'https://play.google.com/store/apps/details?id=app.intra', k: 'getIntra' as const },
              { href: 'https://play.google.com/store/apps/details?id=com.celzero.bravedns', k: 'getRethink' as const },
            ].map((a) => (
              <a
                key={a.k}
                href={a.href}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 rounded-xl border border-ink-500 bg-ink-700 px-4 py-2.5 text-sm font-semibold text-paper hover:border-brand"
              >
                <Store className="size-4" aria-hidden="true" />
                <T k={a.k} />
              </a>
            ))}
          </div>
        }
      />
      <Step n={2} title="androidStep2" body="androidStep2d" />
      <Step
        n={3}
        title="androidStep3"
        body="androidStep3d"
        art={
          <div className="rounded-2xl border border-brand/40 bg-ink-900 p-4">
            <p className="text-xs font-semibold text-brand-bright">
              <T k="yourDohUrl" />
            </p>
            <div className="mt-2 flex items-center gap-2">
              <code className="min-w-0 flex-1 break-all font-mono text-[13px] text-paper" dir="ltr">
                {reg.doh_url}
              </code>
              <CopyButton value={reg.doh_url} />
            </div>
            {hostname && (
              <div className="mt-4 border-t border-ink-700 pt-3">
                <Tx k="privateDns" className="text-xs leading-relaxed text-mist-400" split="stack" />
                <div className="mt-2 flex items-center gap-2">
                  <code className="min-w-0 flex-1 break-all font-mono text-[13px] text-paper" dir="ltr">
                    {hostname}
                  </code>
                  <CopyButton value={hostname} />
                </div>
              </div>
            )}
          </div>
        }
      />
    </ol>
  )
}

function Alerts({ deviceId }: { deviceId: string }) {
  const [state, setState] = useState<AlertsState>(alertsState)
  const [busy, setBusy] = useState(false)
  const [failed, setFailed] = useState(false)

  const turnOn = async () => {
    setBusy(true)
    setFailed(false)
    try {
      setState(await enableAlerts(deviceId))
    } catch {
      setFailed(true)
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="rounded-3xl border border-ink-700 bg-ink-800/70 p-5 sm:p-6">
      <div className="flex items-start gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-warn/15 text-warn">
          <BellRing className="size-5" aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <Tx k="alertsTitle" as="h2" className="text-lg font-bold text-paper" split="stack" />
          <Tx k="alertsBody" className="mt-1 text-sm leading-relaxed text-mist-300" split="stack" />
        </div>
      </div>
      <div className="mt-5">
        {state === 'on' ? (
          <p className="inline-flex items-center gap-2 rounded-full bg-safe/15 px-4 py-2 text-sm font-semibold text-safe">
            <ShieldCheck className="size-4" aria-hidden="true" />
            <T k="alertsOn" />
          </p>
        ) : state === 'needs-install' ? (
          <Tx k="alertsNeedsInstall" className="rounded-2xl bg-ink-900 p-4 text-sm leading-relaxed text-mist-200" split="stack" />
        ) : state === 'unsupported' ? (
          <Tx k="alertsUnsupported" className="text-sm text-mist-400" split="stack" />
        ) : state === 'denied' ? (
          <Tx k="alertsDenied" className="text-sm text-warn" split="stack" />
        ) : (
          <button
            type="button"
            onClick={() => void turnOn()}
            disabled={busy}
            className="inline-flex items-center gap-2 rounded-2xl bg-paper px-5 py-3 text-[15px] font-bold text-ink-900 hover:bg-white disabled:opacity-60"
          >
            {busy ? <Spinner className="size-4" /> : <BellRing className="size-4" aria-hidden="true" />}
            <T k="turnOnAlerts" arClassName="opacity-75" />
          </button>
        )}
        {failed && <Tx k="alertsFailed" className="mt-3 text-sm text-warn" split="stack" />}
      </div>
    </section>
  )
}

function Blocks({ deviceId }: { deviceId: string }) {
  const { data, loading, error, reload } = useAsync(() => api.deviceBlocks(deviceId), [deviceId])
  return (
    <section className="rounded-3xl border border-ink-700 bg-ink-800/70 p-5 sm:p-6">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="flex items-center gap-2.5 text-lg font-bold text-paper">
          <ShieldBan className="size-5 text-scam" aria-hidden="true" />
          <T k="myBlocks" arClassName="font-semibold text-mist-300" />
        </h2>
        <button type="button" onClick={reload} aria-label="Refresh" className="grid size-9 place-items-center rounded-full text-mist-400 hover:bg-ink-700 hover:text-paper">
          <RefreshCw className={`size-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>
      {error ? (
        <ErrorState onRetry={reload} />
      ) : !loading && !data?.length ? (
        <Tx k="noBlocks" className="rounded-2xl border border-dashed border-ink-600 p-5 text-sm text-mist-400" split="stack" />
      ) : (
        <ul className="space-y-2">
          {(data ?? []).map((b, i) => {
            const body = (
              <>
                <BrandMark brand={b.brand} className="size-9" />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-mono text-sm text-paper" dir="ltr">
                    {b.domain}
                  </p>
                  <Tx text={b.headline} className="truncate text-xs text-mist-400" split="stack" />
                  <p className="mt-0.5 text-[11px] text-mist-500">
                    <T text={timeAgo(b.ts)} />
                  </p>
                </div>
              </>
            )
            return (
              <li key={`${b.domain}-${i}`}>
                {b.scan_id ? (
                  <Link to={`/scan/${encodeURIComponent(b.scan_id)}`} className="flex items-center gap-3 rounded-2xl bg-ink-850 px-3 py-2.5 hover:bg-ink-750">
                    {body}
                  </Link>
                ) : (
                  <div className="flex items-center gap-3 rounded-2xl bg-ink-850 px-3 py-2.5">{body}</div>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}

export function Protect() {
  const { mode, t } = useLang()
  const [platform, setPlatform] = useState<'ios' | 'android'>(() => (isAndroid() ? 'android' : 'ios'))
  const [reg, setReg] = useState<DeviceRegistration | null>(null)
  const [failed, setFailed] = useState(false)
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    let alive = true
    setFailed(false)
    const p = isIOS() ? 'ios' : isAndroid() ? 'android' : 'other'
    api
      .registerDevice(p, mode === 'ar' ? 'ar' : 'en')
      .then((r) => alive && setReg(r))
      .catch(() => alive && setFailed(true))
    return () => {
      alive = false
    }
  }, [attempt, mode])

  const howItWorks: { k: StringKey; icon: typeof Smartphone }[] = [
    { k: 'hw1', icon: Smartphone },
    { k: 'hw2', icon: ShieldCheck },
    { k: 'hw3', icon: ShieldBan },
  ]

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-12">
      <section className="grid items-center gap-10 lg:grid-cols-[1.2fr_1fr]">
        <div>
          <Tx k="protectTitle" as="h1" className="text-balance text-3xl font-extrabold leading-tight tracking-tight text-paper sm:text-[44px]" split="stack" />
          <Tx k="protectBody" className="mt-4 max-w-2xl text-[15px] leading-relaxed text-mist-300 sm:text-base" split="stack" />
          <ol className="mt-7 grid gap-3 sm:grid-cols-3">
            {howItWorks.map(({ k, icon: Icon }, i) => (
              <li key={k} className="rounded-2xl border border-ink-700 bg-ink-850 p-4">
                <div className="flex items-center gap-2 text-brand-bright">
                  <span className="num text-xs font-bold">{i + 1}</span>
                  <Icon className="size-4" aria-hidden="true" />
                </div>
                <Tx k={k} className="mt-2 text-sm font-semibold leading-snug text-paper" split="stack" />
              </li>
            ))}
          </ol>
          <p className="mt-5 flex items-start gap-2 text-sm text-mist-400">
            <EyeOff className="mt-0.5 size-4 shrink-0 text-seal" aria-hidden="true" />
            <Tx k="privacyNote" as="span" split="stack" />
          </p>
        </div>
        <div className="hidden lg:block">
          <ProtectIllustration />
        </div>
      </section>

      <div className="mt-12 grid items-start gap-6 lg:grid-cols-[1.2fr_1fr]">
        <section className="rounded-3xl border border-ink-700 bg-ink-800/70 p-5 sm:p-7">
          <div role="tablist" aria-label={t('navProtect')} className="mb-7 grid grid-cols-2 rounded-2xl bg-ink-900 p-1">
            {(['ios', 'android'] as const).map((p) => (
              <button
                key={p}
                type="button"
                role="tab"
                aria-selected={platform === p}
                onClick={() => setPlatform(p)}
                className={`rounded-xl py-2.5 text-sm font-bold transition-colors ${platform === p ? 'bg-paper text-ink-900' : 'text-mist-400 hover:text-paper'}`}
              >
                <T k={p === 'ios' ? 'iphone' : 'android'} />
              </button>
            ))}
          </div>
          {failed ? (
            <ErrorState message="deviceFailed" onRetry={() => setAttempt((a) => a + 1)} />
          ) : !reg ? (
            <div className="flex items-center justify-center gap-2.5 py-12 text-sm text-mist-400">
              <Spinner />
              <T k="settingUp" />
            </div>
          ) : platform === 'ios' ? (
            <IphoneSetup reg={reg} />
          ) : (
            <AndroidSetup reg={reg} />
          )}
        </section>
        <div className="space-y-6">
          {reg && <Alerts deviceId={reg.device_id} />}
          {reg && <Blocks deviceId={reg.device_id} />}
        </div>
      </div>
    </div>
  )
}
