import { useState } from 'react'
import { useParams } from 'react-router'
import { ShieldCheck } from 'lucide-react'
import { Reveal } from '../components/motion'
import { ErrorState, Spinner } from '../components/States'
import { btn } from '../components/ui'
import { T, Tx } from '../lib/lang'
import { ApiError, api } from '../lib/api'
import { useAsync } from '../lib/useAsync'
import { Avatar, ROLE, iso } from './Family'
import { useDevice } from '../lib/useDevice'

export function Join() {
  const { code = '' } = useParams()
  const { reg, failed: devFailed, retry } = useDevice()
  const { data: info, error, loading } = useAsync(() => api.inviteInfo(code), [code])
  const [busy, setBusy] = useState(false)
  const [joinError, setJoinError] = useState<'used' | 'failed' | null>(null)

  const join = async () => {
    if (!reg) return
    setBusy(true)
    setJoinError(null)
    try {
      if (info?.relink) {
        await api.reconnect(code, reg.device_id)
        window.location.assign('/family')
        return
      }
      await api.joinFamily(code, reg.device_id)
      // Straight to their own home screen: the SOS button, the tiles and the protection setup are all there.
      window.location.assign('/family')
      return
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
      <div className="shell py-8">
        <ErrorState message={error instanceof ApiError && error.status === 404 ? 'joinNotFound' : 'loadFailed'} />
      </div>
    )
  }
  if (devFailed || !reg) {
    return (
      <div className="shell py-8">
        <ErrorState message="deviceFailed" onRetry={retry} />
      </div>
    )
  }

  const guardian = info.guardians[0] ?? ''
  return (
    <section className="shell grid-12 gap-y-10 pt-8 pb-8 lg:pt-10 lg:pb-10">
      <Reveal className="col-span-4 sm:col-span-8 lg:col-span-6">
        <p className="evidence text-sm text-gold">
          {info.family} · <T k="famKicker" />
        </p>
        {info.relink ? (
          <>
            <Tx text={{ en: `Reconnect ${info.name}'s phone`, ar: `أعد ربط هاتف ${iso(info.name)}` }} as="h1" className="display mt-3 text-4xl text-paper sm:text-5xl" />
            <Tx k="relinkBody" className="mt-6 max-w-[60ch] text-lg text-paper-2" />
            {info.used || joinError === 'used' ? (
              <Tx k="joinUsed" className="mt-6 text-base text-warn" />
            ) : (
              <button type="button" onClick={() => void join()} disabled={busy} className={`${btn.primary} mt-8 w-full sm:w-auto`}>
                {busy ? <Spinner /> : <ShieldCheck className="size-4" aria-hidden="true" />}
                <T k="relinkButton" />
              </button>
            )}
            {joinError === 'failed' && <Tx k="famFailed" className="mt-4 text-sm text-warn" />}
          </>
        ) : (
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
        )}
      </Reveal>
    </section>
  )
}
