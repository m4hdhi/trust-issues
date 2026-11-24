import { useCallback, useState } from 'react'
import { useNavigate } from 'react-router'
import { api, ApiError } from './api'
import { writeJson } from './storage'
import type { CreateScanResponse, ScanSource } from './types'

export interface CheckState {
  input: string
  response: CreateScanResponse
}

export const LAST_CHECK_KEY = 'ti.lastCheck'

export function useStartScan() {
  const navigate = useNavigate()
  const [busy, setBusy] = useState(false)
  const [failed, setFailed] = useState<null | 'scanFailed' | 'noLinkInInput'>(null)

  const start = useCallback(
    async (raw: string, source: ScanSource = 'web', replace = false): Promise<boolean> => {
      const input = raw.trim()
      if (!input) return false
      setBusy(true)
      setFailed(null)
      try {
        const response = await api.createScan({ input, source })
        const state: CheckState = { input, response }
        writeJson(LAST_CHECK_KEY, state, 'session')
        const only = response.scans.length === 1 ? response.scans[0] : undefined
        if (only) {
          navigate(`/scan/${encodeURIComponent(only.id)}`, { state: { url: only.url, message: response.message }, replace })
        } else {
          navigate('/check', { state, replace })
        }
        return true
      } catch (e) {
        setFailed(e instanceof ApiError && (e.status === 422 || e.status === 400) ? 'noLinkInInput' : 'scanFailed')
        return false
      } finally {
        setBusy(false)
      }
    },
    [navigate],
  )

  return { start, busy, failed }
}
