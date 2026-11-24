import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './App'
import { adoptDeviceFromUrl } from './lib/api'
import './index.css'

adoptDeviceFromUrl()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
