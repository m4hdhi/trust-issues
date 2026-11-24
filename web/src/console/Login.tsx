import { useState } from 'react'
import { Link } from 'react-router'
import { KeyRound, Siren } from 'lucide-react'
import { Logo } from '../components/Logo'
import { LangToggle } from '../components/LangToggle'
import { Spinner } from '../components/States'
import { T, Tx, useLang } from '../lib/lang'
import { consoleApi, ApiError } from '../lib/api'

export function Login({ onSuccess }: { onSuccess: () => void }) {
  const { t } = useLang()
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<'wrongPasscode' | 'loadFailed' | null>(null)

  const submit = async () => {
    if (!password) return
    setBusy(true)
    setError(null)
    try {
      await consoleApi.login(password)
      onSuccess()
    } catch (e) {
      setError(e instanceof ApiError && e.status === 401 ? 'wrongPasscode' : 'loadFailed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="relative flex min-h-dvh items-center justify-center overflow-hidden px-4 py-12">
      <div className="guilloche pointer-events-none absolute inset-0 [mask-image:radial-gradient(circle_at_center,black,transparent_70%)]" aria-hidden="true" />
      <div className="absolute end-4 top-4">
        <LangToggle compact />
      </div>
      <form
        onSubmit={(e) => {
          e.preventDefault()
          void submit()
        }}
        className="relative w-full max-w-sm rounded-[28px] border border-ink-600 bg-ink-850/95 p-7 shadow-2xl backdrop-blur"
      >
        <Logo size="lg" />
        <div className="mt-8 flex items-center gap-2 text-seal">
          <Siren className="size-5" aria-hidden="true" />
          <h1 className="text-lg font-bold">
            <T k="consoleTitle" />
          </h1>
        </div>
        <Tx k="consoleSub" className="mt-1 text-sm text-mist-400" split="stack" />
        <label className="mt-6 block">
          <span className="text-sm font-medium text-mist-300">
            <T k="passcode" />
          </span>
          <span className="mt-2 flex items-center gap-2 rounded-2xl border border-ink-600 bg-ink-900 px-4 focus-within:border-brand">
            <KeyRound className="size-4 shrink-0 text-mist-500" aria-hidden="true" />
            <input
              type="password"
              autoComplete="current-password"
              autoFocus
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              aria-label={t('passcode')}
              className="h-12 w-full bg-transparent text-base text-paper focus:outline-none"
            />
          </span>
        </label>
        {error && <Tx k={error} className="mt-3 text-sm text-scam" split="stack" />}
        <button
          type="submit"
          disabled={busy || !password}
          className="mt-6 inline-flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-brand text-base font-bold text-ink-950 hover:bg-brand-bright disabled:opacity-50"
        >
          {busy && <Spinner />}
          <T k="signIn" arClassName="opacity-80" />
        </button>
        <Link to="/" className="mt-5 block text-center text-sm text-mist-400 hover:text-paper">
          <T k="citizenApp" />
        </Link>
      </form>
    </div>
  )
}
