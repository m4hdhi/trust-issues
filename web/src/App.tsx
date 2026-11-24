import { lazy, Suspense } from 'react'
import { BrowserRouter, Route, Routes } from 'react-router'
import { MotionConfig } from 'motion/react'
import { LangProvider } from './lib/lang'
import { ToastProvider } from './components/Toast'
import { CitizenLayout } from './components/CitizenLayout'
import { LoadingState } from './components/States'
import { Home } from './pages/Home'
import { Scan } from './pages/Scan'
import { Check } from './pages/Check'
import { Trending } from './pages/Trending'
import { Protect } from './pages/Protect'
import { Family } from './pages/Family'
import { Join } from './pages/Join'
import { Share } from './pages/Share'
import { NotFound } from './pages/NotFound'

const ConsoleApp = lazy(() => import('./console/ConsoleApp'))

export function App() {
  return (
    <LangProvider>
      <MotionConfig reducedMotion="user">
        <ToastProvider>
          <BrowserRouter>
            <Routes>
              <Route element={<CitizenLayout />}>
                <Route index element={<Home />} />
                <Route path="scan/:id" element={<Scan />} />
                <Route path="check" element={<Check />} />
                <Route path="trending" element={<Trending />} />
                <Route path="protect" element={<Protect />} />
                <Route path="family" element={<Family />} />
                <Route path="join/:code" element={<Join />} />
                <Route path="share" element={<Share />} />
                <Route path="*" element={<NotFound />} />
              </Route>
              <Route
                path="console/*"
                element={
                  <Suspense fallback={<LoadingState />}>
                    <ConsoleApp />
                  </Suspense>
                }
              />
            </Routes>
          </BrowserRouter>
        </ToastProvider>
      </MotionConfig>
    </LangProvider>
  )
}
