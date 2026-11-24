import { useEffect, useState } from 'react'
import { api } from './api'
import { useLang } from './lang'
import { isAndroid, isIOS } from './push'
import type { DeviceRegistration } from './types'

/** This phone's identity: the stored registration, or a new one from the server. */
export function useDevice(): { reg: DeviceRegistration | null; failed: boolean; retry: () => void } {
  const { mode } = useLang()
  const [reg, setReg] = useState<DeviceRegistration | null>(null)
  const [failed, setFailed] = useState(false)
  const [attempt, setAttempt] = useState(0)
  useEffect(() => {
    let alive = true
    setFailed(false)
    api
      .registerDevice(isIOS() ? 'ios' : isAndroid() ? 'android' : 'other', mode === 'ar' ? 'ar' : 'en')
      .then((r) => alive && setReg(r))
      .catch(() => alive && setFailed(true))
    return () => {
      alive = false
    }
  }, [attempt, mode])
  return { reg, failed, retry: () => setAttempt((a) => a + 1) }
}
