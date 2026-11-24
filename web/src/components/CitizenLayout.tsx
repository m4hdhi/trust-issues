import { Link, NavLink, Outlet } from 'react-router'
import { Flame, Phone, ScanSearch, ShieldCheck, Siren } from 'lucide-react'
import { Logo } from './Logo'
import { LangToggle } from './LangToggle'
import { T, Tx } from '../lib/lang'
import type { StringKey } from '../lib/i18n'

const NAV: { to: string; k: StringKey; icon: typeof Flame; end?: boolean }[] = [
  { to: '/', k: 'navCheck', icon: ScanSearch, end: true },
  { to: '/trending', k: 'navTrending', icon: Flame },
  { to: '/protect', k: 'navProtect', icon: ShieldCheck },
]

export function CitizenLayout() {
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="sticky top-0 z-40 border-b border-ink-700/70 bg-ink-900/85 pt-[env(safe-area-inset-top)] backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
          <Link to="/" className="rounded-lg" aria-label="Trust Issues — أزمة ثقة">
            <Logo />
          </Link>
          <nav className="hidden items-center gap-1 md:flex">
            {NAV.map(({ to, k, icon: Icon, end }) => (
              <NavLink
                key={to}
                to={to}
                end={end}
                className={({ isActive }) =>
                  `inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition-colors ${
                    isActive ? 'bg-ink-700 text-paper' : 'text-mist-400 hover:text-paper'
                  }`
                }
              >
                <Icon className="size-4" aria-hidden="true" />
                <T k={k} />
              </NavLink>
            ))}
          </nav>
          <LangToggle compact />
        </div>
      </header>

      <main className="flex-1 pb-[calc(5rem+env(safe-area-inset-bottom))] md:pb-0">
        <Outlet />
      </main>

      <footer className="border-t border-ink-700/70 bg-ink-950/60 pb-[calc(5.5rem+env(safe-area-inset-bottom))] md:pb-0">
        <div className="mx-auto grid max-w-6xl gap-6 px-4 py-8 text-sm sm:px-6 md:grid-cols-[1fr_auto] md:items-end">
          <div className="space-y-3">
            <a href="tel:8002626" className="inline-flex items-start gap-2.5 text-paper hover:text-brand-bright">
              <Phone className="mt-0.5 size-4 shrink-0 text-seal" aria-hidden="true" />
              <Tx k="amanLine" as="span" className="font-medium" split="stack" />
            </a>
            <Tx k="footerNote" className="text-mist-500" split="stack" />
          </div>
          <Link
            to="/console"
            className="inline-flex items-center gap-2 self-start rounded-full border border-ink-600 px-4 py-2 text-xs font-semibold text-mist-300 hover:border-seal hover:text-paper"
          >
            <Siren className="size-3.5 text-seal" aria-hidden="true" />
            <T k="navConsole" />
          </Link>
        </div>
      </footer>

      <nav
        className="fixed inset-x-0 bottom-0 z-40 border-t border-ink-700 bg-ink-900/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-md md:hidden"
        aria-label="Main"
      >
        <div className="grid grid-cols-3">
          {NAV.map(({ to, k, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                `flex flex-col items-center gap-1 py-2.5 text-[11px] font-semibold transition-colors ${
                  isActive ? 'text-brand-bright' : 'text-mist-500'
                }`
              }
            >
              <Icon className="size-5" aria-hidden="true" />
              <T k={k} stacked arClassName="opacity-90" />
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  )
}
