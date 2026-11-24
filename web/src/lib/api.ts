import type {
  BatchStatus,
  BlockItem,
  CaseItem,
  CaseStatus,
  CreateScanRequest,
  CreateScanResponse,
  DeviceRegistration,
  GraphResponse,
  MapsHit,
  MetricsResponse,
  Platform,
  RadarItem,
  RadarRecent,
  ReportRequest,
  ReportResponse,
  ScanResult,
  ScanStage,
  SearchHit,
  Stats,
  Takedown,
  TrendingItem,
} from './types'
import { readItem, readJson, removeItem, writeItem, writeJson } from './storage'

const MOCK = import.meta.env.VITE_MOCK === '1'
const loadMocks = () => import('../dev/fixtures')
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms))

export class ApiError extends Error {
  status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

const TOKEN_KEY = 'ti.console.token'
const DEVICE_KEY = 'ti.device'
export const UNAUTHORIZED_EVENT = 'ti:unauthorized'

async function request<T>(path: string, init: RequestInit = {}, token?: string | null): Promise<T> {
  const headers = new Headers(init.headers)
  if (init.body && !(init.body instanceof FormData)) headers.set('Content-Type', 'application/json')
  if (token) headers.set('Authorization', `Bearer ${token}`)
  const res = await fetch(path, { ...init, headers })
  if (!res.ok) {
    if (res.status === 401 && token) {
      removeItem(TOKEN_KEY, 'session')
      window.dispatchEvent(new Event(UNAUTHORIZED_EVENT))
    }
    let detail = res.statusText
    try {
      const body = (await res.json()) as { detail?: unknown }
      if (typeof body.detail === 'string') detail = body.detail
    } catch {
      detail = res.statusText
    }
    throw new ApiError(res.status, detail)
  }
  return (await res.json()) as T
}

function post<T>(path: string, body: unknown, token?: string | null): Promise<T> {
  return request<T>(path, { method: 'POST', body: JSON.stringify(body) }, token)
}

export interface StreamHandlers {
  onStage: (stage: ScanStage) => void
  onResult: (result: ScanResult) => void
  onError: (fatal: boolean) => void
}

export function getDevice(): DeviceRegistration | null {
  return readJson<DeviceRegistration>(DEVICE_KEY)
}

export function scanUrls(id: string) {
  const base = `/api/scans/${encodeURIComponent(id)}`
  return {
    evidencePdf: `${base}/evidence.pdf`,
    evidenceJson: `${base}/evidence.json`,
    warningCard: `${base}/warning-card.png`,
  }
}

export const api = {
  async createScan(body: CreateScanRequest): Promise<CreateScanResponse> {
    const payload: CreateScanRequest = { mode: 'deep', source: 'web', ...body }
    const device = getDevice()
    if (device && !payload.device_id) payload.device_id = device.device_id
    if (MOCK) {
      await wait(350)
      return (await loadMocks()).mockCreateScan(payload.input)
    }
    return post<CreateScanResponse>('/api/scans', payload)
  },

  async getScan(id: string): Promise<ScanResult | null> {
    if (MOCK) return (await loadMocks()).mockGetScan(id)
    try {
      return await request<ScanResult>(`/api/scans/${encodeURIComponent(id)}`)
    } catch (e) {
      if (e instanceof ApiError && (e.status === 404 || e.status === 202)) return null
      throw e
    }
  },

  streamScan(id: string, h: StreamHandlers): () => void {
    if (MOCK) {
      let cancelled = false
      void (async () => {
        const m = await loadMocks()
        for (const step of m.mockStageScript()) {
          await wait(step.delay)
          if (cancelled) return
          h.onStage(step.stage)
        }
        await wait(250)
        const result = m.mockGetScan(id)
        if (!cancelled && result) h.onResult(result)
      })()
      return () => {
        cancelled = true
      }
    }
    const es = new EventSource(`/api/scans/${encodeURIComponent(id)}/events`)
    let finished = false
    const onStage = (e: MessageEvent<string>) => {
      try {
        h.onStage(JSON.parse(e.data) as ScanStage)
      } catch {
        return
      }
    }
    es.onmessage = onStage
    es.addEventListener('stage', onStage as EventListener)
    es.addEventListener('result', ((e: MessageEvent<string>) => {
      finished = true
      es.close()
      try {
        h.onResult(JSON.parse(e.data) as ScanResult)
      } catch {
        h.onError(true)
      }
    }) as EventListener)
    es.addEventListener('error', (e: Event) => {
      if (finished) return
      const serverError = e instanceof MessageEvent && typeof e.data === 'string' && e.data.length > 0
      if (serverError) {
        finished = true
        es.close()
      }
      h.onError(serverError)
    })
    return () => {
      finished = true
      es.close()
    }
  },

  async report(body: ReportRequest): Promise<ReportResponse> {
    const device = getDevice()
    const payload: ReportRequest = device ? { device_id: device.device_id, ...body } : body
    if (MOCK) {
      await wait(500)
      return { report_id: 'rep-demo', scan_id: 'demo-scam', status: 'confirmed' }
    }
    return post<ReportResponse>('/api/reports', payload)
  },

  async trending(): Promise<TrendingItem[]> {
    if (MOCK) return (await loadMocks()).trending
    const res = await request<{ items: TrendingItem[] }>('/api/trending')
    return res.items
  },

  async stats(): Promise<Stats> {
    if (MOCK) return (await loadMocks()).stats
    return request<Stats>('/api/stats')
  },

  async registerDevice(platform: Platform, lang: 'en' | 'ar'): Promise<DeviceRegistration> {
    const existing = getDevice()
    if (existing) return existing
    const reg = MOCK
      ? (await loadMocks()).device
      : await post<DeviceRegistration>('/api/devices', { platform, lang })
    writeJson(DEVICE_KEY, reg)
    return reg
  },

  async deviceBlocks(deviceId: string): Promise<BlockItem[]> {
    if (MOCK) return (await loadMocks()).blocks
    const res = await request<{ items: BlockItem[] }>(`/api/devices/${encodeURIComponent(deviceId)}/blocks`)
    return res.items
  },

  async vapidKey(): Promise<string> {
    if (MOCK) throw new ApiError(503, 'Push is not available in demo mode')
    const res = await request<{ key: string }>('/api/push/vapid-public-key')
    return res.key
  },

  async savePush(deviceId: string, sub: PushSubscriptionJSON): Promise<void> {
    await post<{ ok: boolean }>(`/api/devices/${encodeURIComponent(deviceId)}/push`, sub)
  },

  async warningCard(id: string): Promise<Blob> {
    if (MOCK) throw new ApiError(404, 'No warning card in demo mode')
    const res = await fetch(scanUrls(id).warningCard)
    if (!res.ok) throw new ApiError(res.status, res.statusText)
    return res.blob()
  },
}

export function consoleToken(): string | null {
  return readItem(TOKEN_KEY, 'session')
}

export function clearConsoleToken(): void {
  removeItem(TOKEN_KEY, 'session')
}

function authed<T>(path: string, init: RequestInit = {}): Promise<T> {
  return request<T>(path, init, consoleToken())
}

async function downloadAuthed(path: string, filename: string): Promise<void> {
  const headers = new Headers()
  const token = consoleToken() ?? ''
  if (token) headers.set('Authorization', `Bearer ${token}`)
  const res = await fetch(`${path}?token=${encodeURIComponent(token)}`, { headers })
  if (!res.ok) throw new ApiError(res.status, res.statusText)
  const url = URL.createObjectURL(await res.blob())
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 2000)
}

export const consoleApi = {
  async login(password: string): Promise<void> {
    if (MOCK) {
      await wait(400)
      writeItem(TOKEN_KEY, 'demo-token', 'session')
      return
    }
    const res = await post<{ token: string }>('/api/console/login', { password })
    writeItem(TOKEN_KEY, res.token, 'session')
  },

  async cases(status: CaseStatus | 'all'): Promise<CaseItem[]> {
    if (MOCK) {
      const all = (await loadMocks()).cases
      return status === 'all' ? all : all.filter((c) => c.status === status)
    }
    const res = await authed<{ items: CaseItem[] }>(`/api/console/cases?status=${status}`)
    return res.items
  },

  async decide(id: string, action: 'confirm' | 'reject'): Promise<void> {
    if (MOCK) {
      await wait(250)
      return
    }
    await authed<{ ok: boolean }>(`/api/console/cases/${encodeURIComponent(id)}/${action}`, { method: 'POST' })
  },

  async radarRecent(): Promise<RadarRecent> {
    if (MOCK) return (await loadMocks()).radar
    return authed<RadarRecent>('/api/console/radar/recent')
  },

  radarStream(onItem: (item: RadarItem) => void, onState: (live: boolean) => void): () => void {
    if (MOCK) {
      onState(true)
      let stopped = false
      const tick = async () => {
        if (stopped) return
        const m = await loadMocks()
        onItem(m.randomRadarItem())
        setTimeout(tick, 2600 + Math.random() * 2400)
      }
      const first = setTimeout(tick, 1500)
      return () => {
        stopped = true
        clearTimeout(first)
      }
    }
    const token = consoleToken() ?? ''
    const es = new EventSource(`/api/console/radar?token=${encodeURIComponent(token)}`)
    const handle = (e: MessageEvent<string>) => {
      try {
        onItem(JSON.parse(e.data) as RadarItem)
      } catch {
        return
      }
    }
    es.onopen = () => onState(true)
    es.onmessage = handle
    es.addEventListener('radar', handle as EventListener)
    es.onerror = () => onState(false)
    return () => es.close()
  },

  async graph(): Promise<GraphResponse> {
    if (MOCK) return (await loadMocks()).graph
    return authed<GraphResponse>('/api/console/graph')
  },

  async batchUpload(file: File): Promise<string> {
    if (MOCK) {
      await wait(600)
      ;(await loadMocks()).resetMockBatch()
      return 'batch-demo'
    }
    const form = new FormData()
    form.append('file', file)
    const res = await authed<{ job_id: string }>('/api/console/batch', { method: 'POST', body: form })
    return res.job_id
  },

  async batchStatus(jobId: string): Promise<BatchStatus> {
    if (MOCK) return (await loadMocks()).mockBatchStatus()
    return authed<BatchStatus>(`/api/console/batch/${encodeURIComponent(jobId)}`)
  },

  async batchDownload(jobId: string): Promise<void> {
    await downloadAuthed(`/api/console/batch/${encodeURIComponent(jobId)}/results.csv`, `trust-issues-batch-${jobId}.csv`)
  },

  async huntSearch(query: string): Promise<SearchHit[]> {
    if (MOCK) {
      await wait(900)
      return (await loadMocks()).searchHits
    }
    const res = await authed<{ items: SearchHit[] }>('/api/console/hunt/search', {
      method: 'POST',
      body: JSON.stringify({ query }),
    })
    return res.items
  },

  async huntMaps(query: string): Promise<MapsHit[]> {
    if (MOCK) {
      await wait(1100)
      return (await loadMocks()).mapsHits
    }
    const res = await authed<{ items: MapsHit[] }>('/api/console/hunt/maps', {
      method: 'POST',
      body: JSON.stringify({ query }),
    })
    return res.items
  },

  async metrics(): Promise<MetricsResponse> {
    if (MOCK) return (await loadMocks()).metrics
    return authed<MetricsResponse>('/api/console/metrics')
  },

  async takedown(scanId: string): Promise<Takedown> {
    if (MOCK) return (await loadMocks()).takedown
    return authed<Takedown>(`/api/scans/${encodeURIComponent(scanId)}/takedown`)
  },

  async scan(scanId: string): Promise<ScanResult | null> {
    return api.getScan(scanId)
  },
}
