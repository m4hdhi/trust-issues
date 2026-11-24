import { useCallback, useEffect, useState } from 'react'
import { Link, NavLink, Navigate, Route, Routes } from 'react-router'
import { BarChart3, Crosshair, FileSpreadsheet, FolderKanban, LogOut, Radar as RadarIcon, Rss, Smartphone, Waypoints, type LucideIcon } from 'lucide-react'
import { Logo } from '../components/Logo'
import { LangToggle } from '../components/LangToggle'
import { T, useLang } from '../lib/lang'
import { clearConsoleToken, consoleToken, UNAUTHORIZED_EVENT } from '../lib/api'
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
  const { mode } = useLang()
  const [authed, setAuthed] = useState(() => !!consoleToken())

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

  const link = ({ isActive }: { isActive: boolean }) =>
    `flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition-colors ${
      isActive ? 'bg-ink-700 text-paper' : 'text-mist-400 hover:bg-ink-800 hover:text-paper'
    }`

  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[248px_1fr]">
      <aside className="sticky top-0 z-30 border-b border-ink-700 bg-ink-950/95 backdrop-blur lg:h-dvh lg:border-e lg:border-b-0">
        <div className="flex h-full flex-col">
          <div className="flex items-center justify-between gap-3 px-4 py-3 lg:block lg:px-5 lg:pt-6 lg:pb-5">
            <Link to="/console/radar" className="block">
              <Logo />
            </Link>
            <p className="hidden text-xs font-semibold text-seal lg:mt-3 lg:block">
              <T k="consoleTitle" />
            </p>
            <div className="flex items-center gap-2 lg:hidden">
              <LangToggle compact />
              <button type="button" onClick={signOut} aria-label="Sign out" className="grid size-9 place-items-center rounded-full text-mist-400 hover:bg-ink-800">
                <LogOut className="size-4" />
              </button>
            </div>
          </div>
          <nav className="scrollbar-thin flex gap-1 overflow-x-auto px-3 pb-2 lg:flex-1 lg:flex-col lg:overflow-visible lg:pb-0" aria-label="Console">
            {NAV.map(({ to, k, icon: Icon }) => (
              <NavLink key={to} to={`/console/${to}`} className={link}>
                <Icon className="size-[18px] shrink-0" aria-hidden="true" />
                <span className="whitespace-nowrap">
                  <T k={k} stacked={false} arClassName={mode === 'both' ? 'text-xs font-medium text-mist-500' : undefined} />
                </span>
              </NavLink>
            ))}
          </nav>
          <div className="hidden space-y-3 border-t border-ink-700 p-4 lg:block">
            <LangToggle compact />
            <Link to="/" className="flex items-center gap-2 rounded-lg px-1 py-1 text-sm text-mist-400 hover:text-paper">
              <Smartphone className="size-4" aria-hidden="true" />
              <T k="citizenApp" />
            </Link>
            <button type="button" onClick={signOut} className="flex items-center gap-2 rounded-lg px-1 py-1 text-sm text-mist-400 hover:text-paper">
              <LogOut className="size-4" aria-hidden="true" />
              <T k="signOut" />
            </button>
          </div>
        </div>
      </aside>
      <main className="min-w-0 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
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
