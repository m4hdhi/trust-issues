import { useLayoutEffect } from 'react'
import { Link, NavLink, Outlet, useLocation } from 'react-router'
import { motion } from 'motion/react'
import { Flame, ScanSearch, ShieldCheck, Users } from 'lucide-react'
import { Wordmark } from './Logo'
import { LangToggle } from './LangToggle'
import { T, Tx } from '../lib/lang'
import { T_LAYOUT } from '../lib/motion'
import type { StringKey } from '../lib/i18n'

const NAV: { to: string; k: StringKey; icon: typeof Flame; end?: boolean }[] = [
  { to: '/', k: 'navCheck', icon: ScanSearch, end: true },
  { to: '/trending', k: 'navTrending', icon: Flame },
  { to: '/protect', k: 'navProtect', icon: ShieldCheck },
  { to: '/family', k: 'navFamily', icon: Users },
]

function isActive(pathname: string, to: string, end?: boolean) {
  if (end) return pathname === to || pathname.startsWith('/scan') || pathname.startsWith('/check')
  if (to === '/family') return pathname.startsWith('/family') || pathname.startsWith('/join')
  return pathname.startsWith(to)
}

export function CitizenLayout() {
  const { pathname } = useLocation()

  useLayoutEffect(() => {
    window.scrollTo(0, 0)
  }, [pathname])

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="sticky top-0 z-40 border-b border-line bg-ink-900 pt-[env(safe-area-inset-top)]">
        <div className="shell flex h-16 items-center justify-between gap-6">
          <Link to="/" className="rounded-md" aria-label="Trust Issues, أزمة ثقة">
            <Wordmark />
          </Link>
          <nav className="hidden h-full items-stretch gap-1 md:flex" aria-label="Main">
            {NAV.map(({ to, k, end }) => {
              const active = isActive(pathname, to, end)
              return (
                <NavLink
                  key={to}
                  to={to}
                  end={end}
                  className={`relative inline-flex items-center px-4 text-sm font-medium transition-colors ${active ? 'text-paper' : 'text-paper-3 hover:text-paper'}`}
                >
                  <T k={k} />
                  {active && <motion.span layoutId="nav-underline" transition={T_LAYOUT} className="absolute inset-x-4 -bottom-px h-0.5 bg-gold" />}
                </NavLink>
              )
            })}
          </nav>
          <LangToggle />
        </div>
      </header>

      <main className="flex-1 pb-[calc(4.5rem+env(safe-area-inset-bottom))] md:pb-0">
        <Outlet />
      </main>

      <footer className="border-t border-line pb-[calc(4.5rem+env(safe-area-inset-bottom))] md:pb-0">
        <div className="shell grid-12 gap-y-8 py-12">
          <div className="col-span-4 sm:col-span-8 lg:col-span-6">
            <Wordmark size="lg" />
            <Tx k="footerNote" className="mt-4 max-w-[52ch] text-sm text-paper-3" split="stack" />
          </div>
          <div className="col-span-4 sm:col-span-8 lg:col-span-6 lg:justify-self-end">
            <a href="tel:8002626" className="group block">
              <Tx k="amanLine" className="text-base text-paper-2 transition-colors group-hover:text-paper" split="stack" />
            </a>
            <Link to="/console" className="mt-6 inline-flex text-sm font-medium text-gold underline decoration-gold/40 underline-offset-4 hover:decoration-gold">
              <T k="navConsole" />
            </Link>
          </div>
        </div>
      </footer>

      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-ink-900 pb-[env(safe-area-inset-bottom)] md:hidden" aria-label="Main">
        <div className="grid grid-cols-4">
          {NAV.map(({ to, k, icon: Icon, end }) => {
            const active = isActive(pathname, to, end)
            return (
              <NavLink
                key={to}
                to={to}
                end={end}
                className={`press relative flex h-16 flex-col items-center justify-center gap-1 text-xs font-medium transition-colors ${active ? 'text-paper' : 'text-paper-3'}`}
              >
                {active && <motion.span layoutId="tab-indicator" transition={T_LAYOUT} className="absolute inset-x-8 top-0 h-0.5 bg-gold" />}
                <Icon className={`size-5 ${active ? 'text-gold' : ''}`} aria-hidden="true" />
                <T k={k} />
              </NavLink>
            )
          })}
        </div>
      </nav>
    </div>
  )
}
