import { useEffect, useState } from 'react'
import { api } from './api'
import type { LiveFeed } from './types'

export function useLive(intervalMs = 5000): LiveFeed | null {
  const [feed, setFeed] = useState<LiveFeed | null>(null)

  useEffect(() => {
    let alive = true
    let timer: ReturnType<typeof setTimeout>
    const tick = async () => {
      try {
        const next = await api.live()
        if (alive) setFeed(next)
      } catch {
        if (!alive) return
      }
      if (alive) timer = setTimeout(tick, document.hidden ? intervalMs * 4 : intervalMs)
    }
    void tick()
    return () => {
      alive = false
      clearTimeout(timer)
    }
  }, [intervalMs])

  return feed
}
