import { useState } from 'react'
import { Link } from 'react-router'
import { motion } from 'motion/react'
import { LogoMark, Wordmark } from '../components/Logo'
import { LangToggle } from '../components/LangToggle'
import { Spinner } from '../components/States'
import { btn } from '../components/ui'
import { T, Tx, useLang } from '../lib/lang'
import { consoleApi, ApiError } from '../lib/api'
import { EASE_OUT } from '../lib/motion'

export function Login({ onSuccess }: { onSuccess: () => void }) {
  const { t } = useLang()
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<'wrongPasscode' | 'loadFailed' | null>(null)
  const [shake, setShake] = useState(0)

  const submit = async () => {
    if (!password) return
    setBusy(true)
    setError(null)
    try {
      await consoleApi.login(password)
      onSuccess()
    } catch (e) {
      setError(e instanceof ApiError && e.status === 401 ? 'wrongPasscode' : 'loadFailed')
      setShake((s) => s + 1)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex min-h-dvh flex-col bg-ink-950">
      <header className="flex items-center justify-between px-6 py-4">
        <Wordmark />
        <LangToggle />
      </header>
      <div className="flex flex-1 items-center justify-center px-4 pb-24">
        <motion.form
          onSubmit={(e) => {
            e.preventDefault()
            void submit()
          }}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, ease: EASE_OUT }}
          className="w-full max-w-sm"
        >
          <LogoMark className="size-12" />
          <h1 className="display mt-8 text-3xl text-paper">
            <T k="consoleTitle" arClassName="text-2xl text-paper-2" />
          </h1>
          <Tx k="consoleSub" className="mt-2 text-base text-paper-3" split="stack" />
          <label className="mt-8 block">
            <span className="text-sm text-paper-2">
              <T k="passcode" />
            </span>
            <motion.input
              key={shake}
              animate={shake ? { x: [0, -6, 6, -4, 4, 0] } : undefined}
              transition={{ duration: 0.35 }}
              type="password"
              autoComplete="current-password"
              autoFocus
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              aria-label={t('passcode')}
              className="mt-2 block h-12 w-full rounded-lg border border-line bg-ink-900 px-4 text-base text-paper focus:border-gold focus:outline-none"
            />
          </label>
          {error && <Tx k={error} className="mt-4 text-sm text-scam" split="stack" />}
          <button type="submit" disabled={busy || !password} className={`${btn.primary} mt-6 w-full`}>
            {busy && <Spinner />}
            <T k="signIn" />
          </button>
          <Link to="/" className="mt-6 block text-sm text-paper-3 hover:text-paper">
            <T k="citizenApp" />
          </Link>
        </motion.form>
      </div>
    </div>
  )
}
