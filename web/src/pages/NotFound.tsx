import { Link } from 'react-router'
import { LogoMark } from '../components/Logo'
import { T, Tx } from '../lib/lang'

export function NotFound() {
  return (
    <div className="mx-auto flex max-w-md flex-col items-center px-6 py-24 text-center">
      <LogoMark className="size-16 opacity-80" />
      <Tx k="pageNotFound" className="mt-6 text-xl font-semibold text-paper" split="stack" />
      <Link to="/" className="mt-6 rounded-full bg-paper px-5 py-2.5 text-sm font-bold text-ink-900">
        <T k="backHome" />
      </Link>
    </div>
  )
}
