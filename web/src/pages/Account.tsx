import { useEffect, useState, type FormEvent } from 'react'
import { KeyRound, LogIn } from 'lucide-react'
import { Modal } from '../components/Modal'
import { Spinner } from '../components/States'
import { btn } from '../components/ui'
import { T, Tx } from '../lib/lang'
import { ApiError, api } from '../lib/api'
import { carryAlerts } from '../lib/push'
import type { StringKey } from '../lib/i18n'

const field = 'h-12 w-full rounded-lg bg-ink-950 px-4 text-base text-paper placeholder:text-paper-3 focus:outline-2 focus:outline-gold'

function errorKey(e: unknown): StringKey {
  if (e instanceof ApiError) {
    if (e.status === 401) return 'accWrong'
    if (e.status === 409) return 'accTaken'
    if (e.status === 400 || e.status === 422) return 'accInvalid'
    if (e.status === 429) return 'accLocked'
  }
  return 'famFailed'
}

/** Username and password fields marked up so the phone's password manager offers to save and fill them. */
function Credentials({ login, password, onLogin, onPassword, isNew }: { login: string; password: string; onLogin: (v: string) => void; onPassword: (v: string) => void; isNew: boolean }) {
  return (
    <>
      <label className="block">
        <Tx k="accLogin" className="mb-2 text-sm text-paper-2" split="stack" />
        <input
          name="username"
          value={login}
          onChange={(e) => onLogin(e.target.value)}
          autoComplete="username"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          placeholder="+971 50 000 0000"
          dir="ltr"
          maxLength={120}
          required
          className={field}
        />
      </label>
      <label className="block">
        <Tx k="accPassword" className="mb-2 text-sm text-paper-2" split="stack" />
        <input
          name="password"
          type="password"
          value={password}
          onChange={(e) => onPassword(e.target.value)}
          autoComplete={isNew ? 'new-password' : 'current-password'}
          minLength={isNew ? 8 : undefined}
          maxLength={128}
          dir="ltr"
          required
          className={field}
        />
        {isNew && <Tx k="accPasswordHint" className="mt-2 text-sm text-paper-3" split="stack" />}
      </label>
    </>
  )
}

/** Shown to a family member who has no sign-in yet; once saved, a quiet line with a Change button. */
export function SaveSignIn({ deviceId }: { deviceId: string }) {
  const [saved, setSaved] = useState<string | null | undefined>(undefined)
  const [open, setOpen] = useState(false)
  const [login, setLogin] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<StringKey | null>(null)

  useEffect(() => {
    let alive = true
    api
      .accountStatus(deviceId)
      .then((r) => alive && setSaved(r.login))
      .catch(() => alive && setSaved(undefined))
    return () => {
      alive = false
    }
  }, [deviceId])

  const openForm = () => {
    setLogin(saved ?? '')
    setPassword('')
    setError(null)
    setOpen(true)
  }

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      setSaved((await api.saveAccount(deviceId, login.trim(), password)).login)
      setOpen(false)
    } catch (err) {
      setError(errorKey(err))
    } finally {
      setBusy(false)
    }
  }

  if (saved === undefined) return null
  return (
    <>
      {saved ? (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-paper-3">
          <KeyRound className="size-4 text-safe" aria-hidden="true" />
          <T k="accSavedAs" />
          <span dir="ltr" className="evidence text-paper-2">
            {saved}
          </span>
          <button type="button" onClick={openForm} className={btn.quiet}>
            <T k="accChange" />
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-4 rounded-2xl bg-gold/10 p-5 sm:flex-row sm:items-center">
          <KeyRound className="size-7 shrink-0 text-gold" aria-hidden="true" />
          <div className="min-w-0 flex-1">
            <Tx k="accSaveTitle" className="text-lg font-medium text-paper" split="stack" />
            <Tx k="accSaveBody" className="mt-1 text-base text-paper-2" split="stack" />
          </div>
          <button type="button" onClick={openForm} className={`${btn.primary} shrink-0`}>
            <T k="accSave" />
          </button>
        </div>
      )}
      <Modal open={open} onClose={() => setOpen(false)} title={<T k="accSaveTitle" />}>
        <form onSubmit={(e) => void submit(e)} className="space-y-5">
          <Tx k="accSaveBody" className="text-base text-paper-2" split="stack" />
          <Credentials login={login} password={password} onLogin={setLogin} onPassword={setPassword} isNew />
          {error && <Tx k={error} className="text-sm text-warn" split="stack" />}
          <button type="submit" disabled={busy} className={`${btn.primary} w-full`}>
            {busy ? <Spinner /> : <KeyRound className="size-4" aria-hidden="true" />}
            <T k="accSave" />
          </button>
        </form>
      </Modal>
    </>
  )
}

/** For a screen that does not know the family yet: the Home Screen app, another browser or a new phone. */
export function SignInCard({ startOpen = false }: { startOpen?: boolean }) {
  const [open, setOpen] = useState(startOpen)
  const [login, setLogin] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<StringKey | null>(null)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      const reg = await api.signIn(login.trim(), password)
      await carryAlerts(reg.device_id)
      window.location.assign('/family')
    } catch (err) {
      setError(errorKey(err))
      setBusy(false)
    }
  }

  return (
    <div className="rounded-2xl bg-ink-850 p-6">
      <Tx k="accHaveTitle" as="h2" className="display text-xl text-paper" split="stack" />
      <Tx k="accHaveBody" className="mt-2 text-base text-paper-2" split="stack" />
      {open ? (
        <form onSubmit={(e) => void submit(e)} className="mt-5 space-y-5">
          <Credentials login={login} password={password} onLogin={setLogin} onPassword={setPassword} isNew={false} />
          {error && <Tx k={error} className="text-sm text-warn" split="stack" />}
          <button type="submit" disabled={busy} className={`${btn.primary} w-full`}>
            {busy ? <Spinner /> : <LogIn className="size-4 rtl:rotate-180" aria-hidden="true" />}
            <T k="accSignIn" />
          </button>
        </form>
      ) : (
        <button type="button" onClick={() => setOpen(true)} className={`${btn.secondary} mt-5 w-full`}>
          <LogIn className="size-4 rtl:rotate-180" aria-hidden="true" />
          <T k="accSignIn" />
        </button>
      )}
    </div>
  )
}
