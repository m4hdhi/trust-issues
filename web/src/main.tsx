import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './App'
import { ErrorBoundary, recoverOnce } from './components/ErrorBoundary'
import { adoptDeviceFromUrl } from './lib/api'
import './index.css'

adoptDeviceFromUrl()

// After a deploy, an open tab can ask for a script file that no longer exists: load the new version.
window.addEventListener('vite:preloadError', () => recoverOnce())

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
)
