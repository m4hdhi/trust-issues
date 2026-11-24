import { Link } from 'react-router'
import { LogoMark } from '../components/Logo'
import { btn } from '../components/ui'
import { T, Tx } from '../lib/lang'

export function NotFound() {
  return (
    <div className="shell">
      <div className="flex max-w-xl flex-col items-start py-24">
        <LogoMark className="size-16" />
        <Tx k="pageNotFound" as="h1" className="display mt-8 text-3xl text-paper" split="stack" />
        <Link to="/" className={`${btn.secondary} mt-8`}>
          <T k="backHome" />
        </Link>
      </div>
    </div>
  )
}
