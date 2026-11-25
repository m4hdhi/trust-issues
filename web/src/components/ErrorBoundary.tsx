import { Component, type ReactNode } from 'react'

const KEY = 'ti.recovered'

/** Reload once if the last automatic reload was more than a minute ago, so a bad deploy cannot loop. */
export function recoverOnce(): boolean {
  try {
    const last = Number(sessionStorage.getItem(KEY) ?? 0)
    if (Date.now() - last < 60_000) return false
    sessionStorage.setItem(KEY, String(Date.now()))
  } catch {
    return false
  }
  window.location.reload()
  return true
}

/** A crash while drawing a page shows this screen instead of an empty one. */
export class ErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false }

  static getDerivedStateFromError() {
    return { failed: true }
  }

  componentDidCatch(error: unknown) {
    console.error('page crashed', error)
    recoverOnce()
  }

  render() {
    if (!this.state.failed) return this.props.children
    return (
      <div className="grid min-h-dvh place-items-center p-6 text-center">
        <div className="max-w-sm rounded-[2rem] bg-ink-850 p-8">
          <img src="/brand/symbol.png" alt="" className="mx-auto size-14" />
          <h1 className="display mt-5 text-2xl text-paper">This page did not load</h1>
          <p lang="ar" dir="rtl" className="display mt-1 text-xl text-paper-2">
            تعذّر تحميل هذه الصفحة
          </p>
          <p className="mt-4 text-base text-paper-2">Your protection is still on. Reload to continue.</p>
          <p lang="ar" dir="rtl" className="mt-1 text-base text-paper-2">
            حمايتك ما زالت تعمل. أعد التحميل للمتابعة.
          </p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="press mt-6 inline-flex h-12 items-center justify-center rounded-full bg-linear-to-r from-[#5a48f2] to-[#8a4df0] px-6 text-base font-semibold text-white"
          >
            Reload · إعادة التحميل
          </button>
        </div>
      </div>
    )
  }
}
