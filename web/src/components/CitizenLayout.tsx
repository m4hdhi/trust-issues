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
      <header className="sticky top-0 z-40 px-3 pt-[max(0.75rem,env(safe-area-inset-top))] sm:px-6">
        <div className="glass mx-auto flex h-16 max-w-[1232px] items-center justify-between gap-6 rounded-full px-5 sm:px-7">
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
                  className={`relative my-3 inline-flex items-center rounded-full px-4 text-sm font-semibold transition-colors ${active ? 'text-white' : 'text-paper-2 hover:text-paper'}`}
                >
                  {active && <motion.span layoutId="nav-underline" transition={T_LAYOUT} className="absolute inset-0 rounded-full bg-paper" />}
                  <span className="relative">
                    <T k={k} />
                  </span>
                </NavLink>
              )
            })}
          </nav>
          <LangToggle />
        </div>
      </header>

      <main className="flex-1">
        <Outlet />
      </main>

      <footer className="px-3 pt-6 pb-[calc(6rem+env(safe-area-inset-bottom))] sm:px-6 md:pb-6">
        <div className="zone-dark field-night grid-12 mx-auto max-w-[1232px] gap-y-8 rounded-[2rem] px-6 py-12 sm:px-10">
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

      <nav className="fixed inset-x-3 bottom-[max(0.75rem,env(safe-area-inset-bottom))] z-40 md:hidden" aria-label="Main">
        <div className="zone-dark glass grid grid-cols-4 rounded-full px-2">
          {NAV.map(({ to, k, icon: Icon, end }) => {
            const active = isActive(pathname, to, end)
            return (
              <NavLink
                key={to}
                to={to}
                end={end}
                className={`press relative flex h-16 flex-col items-center justify-center gap-1 text-xs font-semibold transition-colors ${active ? 'text-paper' : 'text-paper-3'}`}
              >
                {active && <motion.span layoutId="tab-indicator" transition={T_LAYOUT} className="absolute inset-x-1 inset-y-1.5 rounded-full bg-ink-800" />}
                <Icon className={`relative size-5 ${active ? 'text-gold' : ''}`} aria-hidden="true" />
                <span className="relative">
                  <T k={k} />
                </span>
              </NavLink>
            )
          })}
        </div>
      </nav>
    </div>
  )
}
