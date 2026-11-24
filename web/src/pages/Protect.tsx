import { useEffect, useState, type ReactNode } from 'react'
import { Link } from 'react-router'
import { AnimatePresence, motion } from 'motion/react'
import { BellRing, ChevronRight, Download, ExternalLink, RefreshCw, Settings, ShieldCheck } from 'lucide-react'
import { siGoogleplay } from 'simple-icons'
import { ProtectIllustration } from '../components/ProtectIllustration'
import { CopyButton } from '../components/CopyButton'
import { BrandMark } from '../components/BrandMark'
import { Spinner, ErrorState } from '../components/States'
import { Reveal, Stagger, StaggerItem } from '../components/motion'
import { SectionHead, btn } from '../components/ui'
import { T, Tx, useLang } from '../lib/lang'
import { api } from '../lib/api'
import { defang, timeAgo } from '../lib/format'
import { EASE_OUT, T_LAYOUT } from '../lib/motion'
import { alertsState, enableAlerts, isAndroid, isIOS, type AlertsState } from '../lib/push'
import { useAsync } from '../lib/useAsync'
import type { StringKey } from '../lib/i18n'
import type { DeviceRegistration } from '../lib/types'

function Step({ n, title, body, art }: { n: number; title: StringKey; body: StringKey; art?: ReactNode }) {
  return (
    <li className="grid grid-cols-[32px_1fr] gap-x-4 border-t border-line py-6">
      <span className="evidence num pt-1 text-sm text-gold">{n}</span>
      <div className="min-w-0">
        <Tx k={title} as="h3" className="display text-lg text-paper" split="stack" />
        <Tx k={body} className="mt-1 text-base text-paper-2" split="stack" />
        {art && <div className="mt-4">{art}</div>}
      </div>
    </li>
  )
}

function IosRow({ children, accent }: { children: ReactNode; accent?: boolean }) {
  return (
    <div className={`flex items-center gap-3 rounded-lg bg-white px-3 py-2 text-sm text-ink-900 ${accent ? 'ring-2 ring-gold' : ''}`} dir="ltr">
      {children}
    </div>
  )
}

const IOS_ART = {
  settings: (
    <div className="inline-flex items-center gap-3 rounded-xl bg-ink-850 p-3" dir="ltr" aria-hidden="true">
      <span className="grid size-12 place-items-center rounded-xl bg-[#8e8e93] text-white">
        <Settings className="size-7" />
      </span>
      <span className="text-sm text-paper-2">Settings</span>
    </div>
  ),
  downloaded: (
    <div className="max-w-xs space-y-1 rounded-xl bg-[#f2f2f7] p-2" aria-hidden="true">
      <IosRow>
        <span className="size-7 rounded-full bg-[#c7c7cc]" />
        <span className="flex-1 font-medium">Apple Account</span>
        <ChevronRight className="size-4 text-[#c7c7cc]" />
      </IosRow>
      <IosRow accent>
        <span className="flex-1 font-medium">Profile Downloaded</span>
        <ChevronRight className="size-4 text-[#8e8e93]" />
      </IosRow>
    </div>
  ),
  install: (
    <div className="max-w-xs rounded-xl bg-[#f2f2f7] p-3" dir="ltr" aria-hidden="true">
      <div className="flex items-center justify-between text-sm">
        <span className="text-[#007aff]">Cancel</span>
        <span className="font-medium text-ink-900">Install Profile</span>
        <span className="rounded-md px-1 font-medium text-[#007aff] ring-2 ring-gold">Install</span>
      </div>
      <div className="mt-3 flex items-center gap-3 rounded-lg bg-white p-3">
        <span className="grid size-10 place-items-center rounded-lg bg-ink-900">
          <ShieldCheck className="size-6 text-gold" />
        </span>
        <div className="text-xs text-ink-900">
          <p className="font-medium">Trust Issues Scam Shield</p>
          <p className="text-[#8e8e93]">DNS Settings</p>
        </div>
      </div>
    </div>
  ),
}

function IphoneSetup({ reg }: { reg: DeviceRegistration }) {
  return (
    <div>
      <a href={reg.ios_profile_url} download className={`${btn.primary} w-full`}>
        <Download className="size-4" aria-hidden="true" />
        <T k="downloadProfile" />
      </a>
      <ol className="mt-8">
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
    <ol>
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
              <a key={a.k} href={a.href} target="_blank" rel="noreferrer" className={btn.secondary}>
                <svg viewBox="0 0 24 24" className="size-4" fill="currentColor" aria-hidden="true">
                  <path d={siGoogleplay.path} />
                </svg>
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
          <div className="rounded-lg bg-ink-900 p-4">
            <p className="text-sm text-gold">
              <T k="yourDohUrl" />
            </p>
            <div className="mt-2 flex items-center gap-2">
              <code className="evidence min-w-0 flex-1 break-all text-sm text-paper">{reg.doh_url}</code>
              <CopyButton value={reg.doh_url} />
            </div>
            {hostname && (
              <div className="mt-4 border-t border-line pt-4">
                <Tx k="privateDns" className="text-sm text-paper-3" split="stack" />
                <div className="mt-2 flex items-center gap-2">
                  <code className="evidence min-w-0 flex-1 break-all text-sm text-paper">{hostname}</code>
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
    <section className="border-t border-line pt-6">
      <Tx k="alertsTitle" as="h2" className="display text-xl text-paper" split="stack" />
      <Tx k="alertsBody" className="mt-2 text-base text-paper-2" split="stack" />
      <div className="mt-6">
        {state === 'on' ? (
          <p className="inline-flex items-center gap-2 text-base text-safe">
            <ShieldCheck className="size-4" aria-hidden="true" />
            <T k="alertsOn" />
          </p>
        ) : state === 'needs-install' ? (
          <Tx k="alertsNeedsInstall" className="rounded-lg bg-ink-850 p-4 text-base text-paper-2" split="stack" />
        ) : state === 'unsupported' ? (
          <Tx k="alertsUnsupported" className="text-base text-paper-3" split="stack" />
        ) : state === 'denied' ? (
          <Tx k="alertsDenied" className="text-base text-warn" split="stack" />
        ) : (
          <button type="button" onClick={() => void turnOn()} disabled={busy} className={btn.secondary}>
            {busy ? <Spinner /> : <BellRing className="size-4" aria-hidden="true" />}
            <T k="turnOnAlerts" />
          </button>
        )}
        {failed && <Tx k="alertsFailed" className="mt-4 text-sm text-warn" split="stack" />}
      </div>
    </section>
  )
}

const TEST_URL = 'https://testsafebrowsing.appspot.com/'

function TestProtection() {
  return (
    <section className="border-t border-line pt-6">
      <Tx k="testTitle" as="h2" className="display text-xl text-paper" split="stack" />
      <Tx k="testBody" className="mt-2 text-base text-paper-2" split="stack" />
      <p className="evidence mt-4 text-sm text-gold">testsafebrowsing.appspot.com</p>
      <a href={TEST_URL} target="_blank" rel="noopener noreferrer" className={`${btn.secondary} mt-4`}>
        <ExternalLink className="size-4" aria-hidden="true" />
        <T k="testOpen" />
      </a>
      <Tx k="testResult" className="mt-4 text-sm text-paper-3" split="stack" />
    </section>
  )
}

function Blocks({ deviceId }: { deviceId: string }) {
  const { data, loading, error, reload } = useAsync(() => api.deviceBlocks(deviceId), [deviceId])
  return (
    <section className="border-t border-line pt-6">
      <div className="flex items-center justify-between gap-4">
        <Tx k="myBlocks" as="h2" className="display text-xl text-paper" split="stack" />
        <button type="button" onClick={reload} aria-label="Refresh" className="press grid size-10 place-items-center rounded-lg text-paper-3 hover:bg-ink-800 hover:text-paper">
          <RefreshCw className={`size-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>
      {error ? (
        <ErrorState onRetry={reload} />
      ) : !loading && !data?.length ? (
        <Tx k="noBlocks" className="mt-4 text-base text-paper-3" split="stack" />
      ) : (
        <ul className="mt-4">
          <AnimatePresence initial={false}>
            {(data ?? []).map((b, i) => {
              const body = (
                <>
                  <BrandMark brand={b.brand} className="size-8" />
                  <div className="min-w-0 flex-1">
                    <p className="evidence truncate text-sm text-paper">{defang(b.domain)}</p>
                    <Tx text={b.headline} className="truncate text-sm text-paper-3" split="stack" />
                  </div>
                  <span className="shrink-0 text-xs text-paper-3">
                    <T text={timeAgo(b.ts)} />
                  </span>
                </>
              )
              return (
                <motion.li key={`${b.domain}-${b.ts}`} layout initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25, delay: i * 0.04, ease: EASE_OUT }} className="border-b border-line">
                  {b.scan_id ? (
                    <Link to={`/scan/${encodeURIComponent(b.scan_id)}`} className="flex items-center gap-4 py-3 hover:bg-ink-850">
                      {body}
                    </Link>
                  ) : (
                    <div className="flex items-center gap-4 py-3">{body}</div>
                  )}
                </motion.li>
              )
            })}
          </AnimatePresence>
        </ul>
      )}
    </section>
  )
}

const HOW: StringKey[] = ['hw1', 'hw2', 'hw3']

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

  return (
    <div>
      <section className="shell grid-12 items-center gap-y-12 pt-12 pb-16 lg:pt-20 lg:pb-24">
        <Reveal className="col-span-4 sm:col-span-8 lg:col-span-7">
          <Tx k="protectTitle" as="h1" className="display text-4xl text-paper sm:text-5xl" arClassName="text-2xl text-paper-2 sm:text-3xl" split="stack" />
          <Tx k="protectBody" className="mt-6 max-w-[60ch] text-lg text-paper-2" split="stack" />
          <Stagger as="div" className="mt-12 grid gap-x-8 sm:grid-cols-3" gap={0.08}>
            {HOW.map((k, i) => (
              <StaggerItem key={k} className="border-t border-line pt-4 pb-6">
                <span className="evidence num text-sm text-gold">{i + 1}</span>
                <Tx k={k} className="mt-2 text-base text-paper" split="stack" />
              </StaggerItem>
            ))}
          </Stagger>
          <Tx k="privacyNote" className="mt-6 text-sm text-paper-3" split="stack" />
        </Reveal>
        <div className="col-span-4 sm:col-span-8 lg:col-span-4 lg:col-start-9">
          <ProtectIllustration />
        </div>
      </section>

      <section className="border-t border-line bg-ink-850">
        <div className="shell grid-12 gap-y-16 py-16 lg:py-24">
          <div className="col-span-4 sm:col-span-8 lg:col-span-7">
            <SectionHead index={1} title="setupTitle" />
            <div role="tablist" aria-label={t('navProtect')} className="mt-8 inline-flex h-12 rounded-lg bg-ink-900 p-1">
              {(['ios', 'android'] as const).map((p) => (
                <button
                  key={p}
                  type="button"
                  role="tab"
                  aria-selected={platform === p}
                  onClick={() => setPlatform(p)}
                  className={`press relative h-10 rounded-md px-6 text-base font-medium transition-colors ${platform === p ? 'text-ink-950' : 'text-paper-2 hover:text-paper'}`}
                >
                  {platform === p && <motion.span layoutId="platform-tab" transition={T_LAYOUT} className="absolute inset-0 rounded-md bg-paper" />}
                  <span className="relative">
                    <T k={p === 'ios' ? 'iphone' : 'android'} />
                  </span>
                </button>
              ))}
            </div>
            <div className="mt-8">
              {failed ? (
                <ErrorState message="deviceFailed" onRetry={() => setAttempt((a) => a + 1)} />
              ) : !reg ? (
                <div className="flex items-center gap-3 py-12 text-base text-paper-3">
                  <Spinner />
                  <T k="settingUp" />
                </div>
              ) : (
                <AnimatePresence mode="wait" initial={false}>
                  <motion.div key={platform} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.2, ease: EASE_OUT }}>
                    {platform === 'ios' ? <IphoneSetup reg={reg} /> : <AndroidSetup reg={reg} />}
                  </motion.div>
                </AnimatePresence>
              )}
            </div>
          </div>
          <div className="col-span-4 space-y-12 sm:col-span-8 lg:col-span-4 lg:col-start-9">
            {reg && <TestProtection />}
            {reg && <Alerts deviceId={reg.device_id} />}
            {reg && <Blocks deviceId={reg.device_id} />}
          </div>
        </div>
      </section>
    </div>
  )
}
