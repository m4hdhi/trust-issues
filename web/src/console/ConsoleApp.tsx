import { useCallback, useEffect, useState } from 'react'
import { Link, NavLink, Navigate, Route, Routes, useLocation } from 'react-router'
import { motion } from 'motion/react'
import { BarChart3, Crosshair, FileSpreadsheet, FolderKanban, LogOut, Radar as RadarIcon, Rss, Waypoints, type LucideIcon } from 'lucide-react'
import { Wordmark } from '../components/Logo'
import { LangToggle } from '../components/LangToggle'
import { T } from '../lib/lang'
import { clearConsoleToken, consoleToken, UNAUTHORIZED_EVENT } from '../lib/api'
import { T_LAYOUT } from '../lib/motion'
import type { StringKey } from '../lib/i18n'
import { Login } from './Login'
import { Radar } from './Radar'
import { Cases } from './Cases'
import { Network } from './Network'
import { Hunt } from './Hunt'
import { Batch } from './Batch'
import { Feeds } from './Feeds'
import { Metrics } from './Metrics'

const NAV: { to: string; k: StringKey; icon: LucideIcon }[] = [
  { to: 'radar', k: 'nav_radar', icon: RadarIcon },
  { to: 'cases', k: 'nav_cases', icon: FolderKanban },
  { to: 'network', k: 'nav_network', icon: Waypoints },
  { to: 'hunt', k: 'nav_hunt', icon: Crosshair },
  { to: 'batch', k: 'nav_batch', icon: FileSpreadsheet },
  { to: 'feeds', k: 'nav_feeds', icon: Rss },
  { to: 'metrics', k: 'nav_metrics', icon: BarChart3 },
]

export default function ConsoleApp() {
  const [authed, setAuthed] = useState(() => !!consoleToken())
  const { pathname } = useLocation()

  useEffect(() => {
    const onUnauthorized = () => setAuthed(false)
    window.addEventListener(UNAUTHORIZED_EVENT, onUnauthorized)
    return () => window.removeEventListener(UNAUTHORIZED_EVENT, onUnauthorized)
  }, [])

  const signOut = useCallback(() => {
    clearConsoleToken()
    setAuthed(false)
  }, [])

  if (!authed) return <Login onSuccess={() => setAuthed(true)} />

  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[248px_1fr]">
      <aside className="zone-dark field-night sticky top-0 z-30 lg:m-3 lg:h-[calc(100dvh-1.5rem)] lg:rounded-[2rem]">
        <div className="flex h-full flex-col">
          <div className="flex items-center justify-between gap-4 px-4 py-4 lg:block lg:px-6 lg:pt-8 lg:pb-8">
            <Link to="/console/radar" className="block">
              <Wordmark />
            </Link>
            <p className="hidden text-sm text-gold lg:mt-2 lg:block">
              <T k="consoleTitle" />
            </p>
            <div className="flex items-center gap-2 lg:hidden">
              <LangToggle />
              <button type="button" onClick={signOut} aria-label="Sign out" className="press grid size-10 place-items-center rounded-lg text-paper-3 hover:bg-ink-800">
                <LogOut className="size-4" />
              </button>
            </div>
          </div>
          <nav className="no-scrollbar flex gap-1 overflow-x-auto px-2 pb-2 lg:flex-1 lg:flex-col lg:overflow-visible lg:px-4 lg:pb-0" aria-label="Console">
            {NAV.map(({ to, k, icon: Icon }) => {
              const active = pathname.startsWith(`/console/${to}`)
              return (
                <NavLink
                  key={to}
                  to={`/console/${to}`}
                  className={`press relative flex h-10 shrink-0 items-center gap-3 rounded-lg px-3 text-sm font-medium transition-colors ${
                    active ? 'text-paper' : 'text-paper-3 hover:text-paper'
                  }`}
                >
                  {active && <motion.span layoutId="console-nav" transition={T_LAYOUT} className="absolute inset-0 rounded-lg bg-ink-800" />}
                  <Icon className={`relative size-4 shrink-0 ${active ? 'text-gold' : ''}`} aria-hidden="true" />
                  <span className="relative whitespace-nowrap">
                    <T k={k} />
                  </span>
                </NavLink>
              )
            })}
          </nav>
          <div className="hidden space-y-4 border-t border-line p-6 lg:block">
            <LangToggle />
            <Link to="/" className="block text-sm text-paper-3 hover:text-paper">
              <T k="citizenApp" />
            </Link>
            <button type="button" onClick={signOut} className="inline-flex items-center gap-2 text-sm text-paper-3 hover:text-paper">
              <LogOut className="size-4" aria-hidden="true" />
              <T k="signOut" />
            </button>
          </div>
        </div>
      </aside>
      <main className="min-w-0 px-4 py-8 sm:px-8 lg:px-12 lg:py-12">
        <Routes>
          <Route index element={<Navigate to="radar" replace />} />
          <Route path="radar" element={<Radar />} />
          <Route path="cases" element={<Cases />} />
          <Route path="network" element={<Network />} />
          <Route path="hunt" element={<Hunt />} />
          <Route path="batch" element={<Batch />} />
          <Route path="feeds" element={<Feeds />} />
          <Route path="metrics" element={<Metrics />} />
          <Route path="*" element={<Navigate to="radar" replace />} />
        </Routes>
      </main>
    </div>
  )
}
