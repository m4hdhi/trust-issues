import { useEffect, useState, type FormEvent } from 'react'
import { Link } from 'react-router'
import { ArrowRight, KeyRound, LogIn, MailCheck } from 'lucide-react'
import { ErrorState, Spinner } from '../components/States'
import { btn } from '../components/ui'
import { T, Tx } from '../lib/lang'
import { ApiError, api } from '../lib/api'
import { carryAlerts } from '../lib/push'
import { useDevice } from '../lib/useDevice'
import { S, fill, type StringKey } from '../lib/i18n'

const field = 'h-12 w-full rounded-lg bg-ink-950 px-4 text-base text-paper placeholder:text-paper-3 focus:outline-2 focus:outline-gold'

function errorKey(e: unknown): StringKey {
  if (e instanceof ApiError) {
    if (e.status === 400) return /text message/.test(e.message) ? 'accErrPhone' : 'accErrEmail'
    if (e.status === 422) return 'accErrEmail'
    if (e.status === 401) return 'accErrCode'
    if (e.status === 404) return 'accErrUnknown'
    if (e.status === 409) return 'accErrTaken'
    if (e.status === 429) return 'accErrWait'
    if (e.status === 502) return 'accErrMail'
    if (e.status === 503) return 'accErrSetup'
  }
  return 'famFailed'
}

/** Email, then the emailed 6-digit code. Register ties the email to this phone; sign-in makes this screen that phone. */
function CodeFlow({ purpose, deviceId, onRegistered }: { purpose: 'register' | 'sign_in'; deviceId: string; onRegistered: (login: string) => void }) {
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [to, setTo] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<StringKey | null>(null)
  const [wait, setWait] = useState(0)

  useEffect(() => {
    if (wait <= 0) return
    const timer = window.setTimeout(() => setWait((w) => w - 1), 1000)
    return () => window.clearTimeout(timer)
  }, [wait])

  const send = async (e?: FormEvent) => {
    e?.preventDefault()
    setBusy(true)
    setError(null)
    try {
      const r = await api.requestCode(email.trim(), purpose, purpose === 'register' ? deviceId : undefined)
      setTo(r.to)
      setCode('')
      setWait(30)
    } catch (err) {
      setError(errorKey(err))
    } finally {
      setBusy(false)
    }
  }

  const confirm = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      if (purpose === 'register') {
        onRegistered((await api.registerEmail(email.trim(), code, deviceId)).login)
        setBusy(false)
        return
      }
      const reg = await api.signIn(email.trim(), code)
      await carryAlerts(reg.device_id)
      window.location.assign('/family')
    } catch (err) {
      setError(errorKey(err))
      setBusy(false)
    }
  }

  if (!to) {
    return (
      <form onSubmit={(e) => void send(e)} className="space-y-5">
        <label className="block">
          <Tx k="accEmail" className="mb-2 text-sm text-paper-2" split="stack" />
          <input
            name="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            inputMode="email"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            placeholder="name@example.com"
            dir="ltr"
            maxLength={120}
            required
            className={field}
          />
        </label>
        {error && <Tx k={error} className="text-sm text-warn" split="stack" />}
        <button type="submit" disabled={busy} className={`${btn.primary} w-full`}>
          {busy ? <Spinner /> : <MailCheck className="size-4" aria-hidden="true" />}
          <T k="accSendCode" />
        </button>
      </form>
    )
  }

  return (
    <form onSubmit={(e) => void confirm(e)} className="space-y-5">
      <Tx text={fill(S.accCodeSent, { to: `\u2068${to}\u2069` })} className="text-base text-paper" split="stack" />
      <label className="block">
        <Tx k="accCode" className="mb-2 text-sm text-paper-2" split="stack" />
        <input
          name="code"
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
          autoComplete="one-time-code"
          inputMode="numeric"
          pattern="[0-9]*"
          maxLength={6}
          placeholder="000000"
          dir="ltr"
          required
          className={`${field} num text-center text-2xl tracking-[0.4em]`}
        />
      </label>
      {error && <Tx k={error} className="text-sm text-warn" split="stack" />}
      <button type="submit" disabled={busy || code.length < 6} className={`${btn.primary} w-full`}>
        {busy ? <Spinner /> : <KeyRound className="size-4" aria-hidden="true" />}
        <T k="accConfirm" />
      </button>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <button type="button" onClick={() => void send()} disabled={busy || wait > 0} className={btn.quiet}>
          {wait > 0 ? <T text={fill(S.accResendIn, { s: wait })} /> : <T k="accResend" />}
        </button>
        <button
          type="button"
          onClick={() => {
            setTo(null)
            setError(null)
          }}
          className={btn.quiet}
        >
          <T k="accOtherEmail" />
        </button>
      </div>
    </form>
  )
}

/**
 * Its own plain page, with the fields near the top: the phone keyboard never covers them, and nothing on the
 * page moves or refreshes while someone types.
 */
export function Account() {
  const { reg, failed, retry } = useDevice()
  const [info, setInfo] = useState<{ login: string | null; inFamily: boolean } | null>(null)
  const [changing, setChanging] = useState(false)
  const [done, setDone] = useState(false)

  useEffect(() => {
    if (!reg) return
    let alive = true
    Promise.all([api.accountStatus(reg.device_id), api.familyState(reg.device_id)])
      .then(([a, f]) => alive && setInfo({ login: a.login, inFamily: Boolean(f.family) }))
      .catch(() => alive && setInfo({ login: null, inFamily: false }))
    return () => {
      alive = false
    }
  }, [reg])

  if (failed) {
    return (
      <div className="shell py-8">
        <ErrorState message="deviceFailed" onRetry={retry} />
      </div>
    )
  }
  if (!reg || !info) {
    return (
      <div className="shell flex items-center gap-3 py-24 text-base text-paper-3">
        <Spinner />
        <T k="settingUp" />
      </div>
    )
  }

  const purpose = info.inFamily ? 'register' : 'sign_in'
  const back = (
    <Link to="/family" className={`${btn.secondary} w-full`}>
      <T k="accBackFamily" />
      <ArrowRight className="size-4 rtl:rotate-180" aria-hidden="true" />
    </Link>
  )
  let title: StringKey = purpose === 'register' ? 'accRegisterTitle' : 'accSignInTitle'
  let body: StringKey = purpose === 'register' ? 'accRegisterBody' : 'accSignInBody'
  let content
  if (done) {
    title = 'accDoneTitle'
    body = 'accDoneBody'
    content = (
      <div className="space-y-5">
        <p dir="ltr" className="evidence flex items-center gap-2 text-base text-safe">
          <KeyRound className="size-4" aria-hidden="true" />
          {info.login}
        </p>
        {back}
      </div>
    )
  } else if (purpose === 'register' && info.login && !changing) {
    title = 'accRegistered'
    body = 'accDoneBody'
    content = (
      <div className="space-y-5">
        <p dir="ltr" className="evidence flex items-center gap-2 text-base text-safe">
          <KeyRound className="size-4" aria-hidden="true" />
          {info.login}
        </p>
        <button type="button" onClick={() => setChanging(true)} className={`${btn.quiet} -ms-3`}>
          <T k="accChange" />
        </button>
        {back}
      </div>
    )
  } else {
    content = (
      <CodeFlow
        purpose={purpose}
        deviceId={reg.device_id}
        onRegistered={(login) => {
          setInfo({ ...info, login })
          setChanging(false)
          setDone(true)
        }}
      />
    )
  }

  return (
    <section className="shell pt-8 pb-10 sm:pt-10">
      <div className="max-w-xl">
        <p className="evidence text-sm text-gold">
          <T k="famKicker" />
        </p>
        <Tx k={title} as="h1" className="display mt-3 text-3xl text-paper sm:text-4xl" arClassName="text-2xl text-paper-2 sm:text-3xl" split="stack" />
        <Tx k={body} className="mt-4 text-base text-paper-2" split="stack" />
        <div className="mt-8">{content}</div>
      </div>
    </section>
  )
}

/** On the family page: a Register card, or once registered a quiet line with a Change link. */
export function AccountLink({ deviceId }: { deviceId: string }) {
  const [login, setLogin] = useState<string | null | undefined>(undefined)

  useEffect(() => {
    let alive = true
    api
      .accountStatus(deviceId)
      .then((r) => alive && setLogin(r.login))
      .catch(() => alive && setLogin(undefined))
    return () => {
      alive = false
    }
  }, [deviceId])

  if (login === undefined) return null
  if (login) {
    return (
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-paper-3">
        <KeyRound className="size-4 text-safe" aria-hidden="true" />
        <T k="accRegistered" />
        <span dir="ltr" className="evidence text-paper-2">
          {login}
        </span>
        <Link to="/account" className={btn.quiet}>
          <T k="accChange" />
        </Link>
      </div>
    )
  }
  return (
    <div className="flex flex-col gap-4 rounded-2xl bg-gold/10 p-5 sm:flex-row sm:items-center">
      <KeyRound className="size-7 shrink-0 text-gold" aria-hidden="true" />
      <div className="min-w-0 flex-1">
        <Tx k="accRegisterTitle" className="text-lg font-medium text-paper" split="stack" />
        <Tx k="accRegisterBody" className="mt-1 text-base text-paper-2" split="stack" />
      </div>
      <Link to="/account" className={`${btn.primary} shrink-0`}>
        <T k="accRegister" />
      </Link>
    </div>
  )
}

/** For a screen that does not know the family yet: the Home Screen app, another browser or a new phone. */
export function SignInLink() {
  return (
    <div className="rounded-2xl bg-ink-850 p-6">
      <Tx k="accHaveTitle" as="h2" className="display text-xl text-paper" split="stack" />
      <Tx k="accHaveBody" className="mt-2 text-base text-paper-2" split="stack" />
      <Link to="/account" className={`${btn.primary} mt-5 w-full`}>
        <LogIn className="size-4 rtl:rotate-180" aria-hidden="true" />
        <T k="accSignIn" />
      </Link>
    </div>
  )
}
