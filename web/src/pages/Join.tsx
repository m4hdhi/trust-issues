import { useState } from 'react'
import { Link, useParams } from 'react-router'
import { ArrowRight, ShieldCheck } from 'lucide-react'
import { Reveal } from '../components/motion'
import { ErrorState, Spinner } from '../components/States'
import { btn } from '../components/ui'
import { T, Tx } from '../lib/lang'
import { ApiError, api } from '../lib/api'
import { isAndroid } from '../lib/push'
import { useAsync } from '../lib/useAsync'
import { Avatar, ROLE, iso } from './Family'
import { useDevice } from '../lib/useDevice'
import { Alerts, AndroidSetup, IphoneSetup, TestProtection } from './Protect'

export function Join() {
  const { code = '' } = useParams()
  const { reg, failed: devFailed, retry } = useDevice()
  const { data: info, error, loading } = useAsync(() => api.inviteInfo(code), [code])
  const [joined, setJoined] = useState(false)
  const [busy, setBusy] = useState(false)
  const [joinError, setJoinError] = useState<'used' | 'failed' | null>(null)

  const join = async () => {
    if (!reg) return
    setBusy(true)
    setJoinError(null)
    try {
      await api.joinFamily(code, reg.device_id)
      setJoined(true)
    } catch (e) {
      setJoinError(e instanceof ApiError && e.status === 409 ? 'used' : 'failed')
    } finally {
      setBusy(false)
    }
  }

  if (loading || (!reg && !devFailed)) {
    return (
      <div className="shell flex items-center gap-3 py-24 text-base text-paper-3">
        <Spinner />
        <T k="settingUp" />
      </div>
    )
  }
  if (error || !info) {
    return (
      <div className="shell py-16">
        <ErrorState message={error instanceof ApiError && error.status === 404 ? 'joinNotFound' : 'loadFailed'} />
      </div>
    )
  }
  if (devFailed || !reg) {
    return (
      <div className="shell py-16">
        <ErrorState message="deviceFailed" onRetry={retry} />
      </div>
    )
  }

  const guardian = info.guardians[0] ?? ''
  return (
    <section className="shell grid-12 gap-y-12 pt-12 pb-16 lg:pt-20 lg:pb-24">
      <Reveal className="col-span-4 sm:col-span-8 lg:col-span-6">
        <p className="evidence text-sm text-gold">
          {info.family} · <T k="famKicker" />
        </p>
        {!joined ? (
          <>
            <Tx
              text={{ en: `${guardian} invited you to Family Shield`, ar: `دعاك ${iso(guardian)} للانضمام إلى درع العائلة` }}
              as="h1"
              className="display mt-3 text-4xl text-paper sm:text-5xl"
              arClassName="text-2xl text-paper-2 sm:text-3xl"
              split="stack"
            />
            <Tx
              text={{
                en: `Joining links this phone to ${info.family}. Scam sites are blocked in every app, and ${guardian} is alerted if you need help.`,
                ar: `ينضم هذا الهاتف إلى ${iso(info.family)}. تُحظر مواقع الاحتيال في كل التطبيقات، ويصل تنبيه إلى ${iso(guardian)} إذا احتجت المساعدة.`,
              }}
              className="mt-6 max-w-[60ch] text-lg text-paper-2"
              split="stack"
            />
            <div className="mt-8 flex items-center gap-4 rounded-2xl bg-ink-850 p-5">
              <Avatar name={info.name} role={info.role} />
              <div>
                <Tx k="joinAs" className="text-sm text-paper-3" split="stack" />
                <p className="mt-1 text-lg font-medium text-paper">
                  {info.name} · <T k={ROLE[info.role].k} />
                </p>
              </div>
            </div>
            {info.used || joinError === 'used' ? (
              <Tx k="joinUsed" className="mt-6 text-base text-warn" split="stack" />
            ) : (
              <button type="button" onClick={() => void join()} disabled={busy} className={`${btn.primary} mt-8 w-full sm:w-auto`}>
                {busy ? <Spinner /> : <ShieldCheck className="size-4" aria-hidden="true" />}
                <T k="joinButton" />
              </button>
            )}
            {joinError === 'failed' && <Tx k="famFailed" className="mt-4 text-sm text-warn" split="stack" />}
          </>
        ) : (
          <>
            <Tx k="joinedTitle" as="h1" className="display mt-3 text-4xl text-paper sm:text-5xl" arClassName="text-2xl text-paper-2 sm:text-3xl" split="stack" />
            <div className="mt-8">{isAndroid() ? <AndroidSetup reg={reg} /> : <IphoneSetup reg={reg} />}</div>
            <Link to="/family" className={`${btn.secondary} mt-8`}>
              <T k="joinGoFamily" />
              <ArrowRight className="size-4 rtl:rotate-180" aria-hidden="true" />
            </Link>
          </>
        )}
      </Reveal>
      {joined && (
        <div className="col-span-4 space-y-12 sm:col-span-8 lg:col-span-4 lg:col-start-9">
          <TestProtection />
          <Alerts deviceId={reg.device_id} />
        </div>
      )}
    </section>
  )
}
