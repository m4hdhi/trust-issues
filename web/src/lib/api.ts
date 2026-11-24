import type { BatchStatus, BlockItem, BrandRef, CaseItem, CaseStatus, CreateScanRequest, CreateScanResponse, DeviceRegistration, GraphResponse, LiveFeed, MapsHit, MetricsResponse, Platform, RadarItem, RadarRecent, ReportRequest, ReportResponse, ScanResult, ScanStage, SearchHit, Stats, Takedown, TrendingItem, FamilyState, FamilyInviteResult, FamilyRole, InviteInfo, Helpline } from './types'
import { readItem, readJson, removeItem, writeItem, writeJson } from './storage'

export class ApiError extends Error {
  status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

const TOKEN_KEY = 'ti.console.token'
const DEVICE_KEY = 'ti.device'
export const ALERTS_KEY = 'ti.alerts'
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

const DEVICE_RE = /^dev_[A-Za-z0-9]{6,20}$/

/** Points the PWA manifest at this phone's device, so "Add to Home Screen" opens the app as the same phone. */
export function linkManifest(): void {
  const dev = getDevice()
  const link = document.querySelector<HTMLLinkElement>('link[rel="manifest"]')
  if (dev && link) link.href = `/api/manifest?d=${encodeURIComponent(dev.device_id)}`
}

/** The Home Screen app starts at ?d=<device>: adopt it, since iOS gives the installed app its own storage. */
export function adoptDeviceFromUrl(): void {
  try {
    const url = new URL(window.location.href)
    const d = url.searchParams.get('d')
    if (d && DEVICE_RE.test(d)) {
      if (getDevice()?.device_id !== d) {
        const doh = `${window.location.origin}/dns-query/${d}`
        writeJson(DEVICE_KEY, { device_id: d, doh_url: doh, ios_profile_url: `/api/protect/${d}/ios.mobileconfig`, android_hostname_hint: doh })
      }
      url.searchParams.delete('d')
      window.history.replaceState(window.history.state, '', url.pathname + url.search + url.hash)
    }
  } catch {
    /* storage can be unavailable; the app then registers a new device */
  }
  linkManifest()
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
    return post<CreateScanResponse>('/api/scans', payload)
  },

  async getScan(id: string): Promise<ScanResult | null> {
    try {
      return await request<ScanResult>(`/api/scans/${encodeURIComponent(id)}`)
    } catch (e) {
      if (e instanceof ApiError && (e.status === 404 || e.status === 202)) return null
      throw e
    }
  },

  streamScan(id: string, h: StreamHandlers): () => void {
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
    return post<ReportResponse>('/api/reports', payload)
  },

  async trending(): Promise<TrendingItem[]> {
    const res = await request<{ items: TrendingItem[] }>('/api/trending')
    return res.items
  },

  async stats(): Promise<Stats> {
    return request<Stats>('/api/stats')
  },

  async brands(): Promise<BrandRef[]> {
    return request<BrandRef[]>('/api/brands')
  },

  async live(): Promise<LiveFeed> {
    try {
      return await request<LiveFeed>('/api/live')
    } catch (e) {
      if (!(e instanceof ApiError) || e.status !== 404) throw e
      const [stats, trending] = await Promise.all([api.stats(), api.trending().catch(() => [] as TrendingItem[])])
      return {
        certs_checked: stats.ct_certs_watched ?? 0,
        scams_today: stats.last_24h.scams ?? 0,
        blocked_queries: stats.blocked_queries,
        brands_protected: 0,
        recent: trending.slice(0, 12).map((t) => ({
          domain: t.domain.replace(/\.([^.]+)$/, '[.]$1'),
          brand: t.brand,
          source: 'report',
          score: t.score,
          ts: t.last_seen,
          scan_id: t.scan_id,
        })),
      }
    }
  },

  async registerDevice(platform: Platform, lang: 'en' | 'ar'): Promise<DeviceRegistration> {
    const existing = getDevice()
    if (existing) return existing
    const reg = await post<DeviceRegistration>('/api/devices', { platform, lang })
    writeJson(DEVICE_KEY, reg)
    linkManifest()
    return reg
  },

  accountStatus(deviceId: string): Promise<{ login: string | null }> {
    return request<{ login: string | null }>(`/api/account/${encodeURIComponent(deviceId)}`)
  },

  requestCode(login: string, purpose: 'register' | 'sign_in', deviceId?: string): Promise<{ to: string }> {
    return post<{ to: string }>('/api/account/code', { login, purpose, device_id: deviceId ?? null })
  },

  registerEmail(login: string, code: string, deviceId: string): Promise<{ login: string }> {
    return post<{ login: string }>('/api/account/verify', { login, code, purpose: 'register', device_id: deviceId })
  },

  /** Confirms the emailed code and makes this screen the registered phone: same family, requests and blocks. */
  async signIn(login: string, code: string): Promise<DeviceRegistration> {
    const reg = await post<DeviceRegistration>('/api/account/verify', { login, code, purpose: 'sign_in' })
    writeJson(DEVICE_KEY, reg)
    removeItem(ALERTS_KEY)
    linkManifest()
    return reg
  },

  familyState(deviceId: string): Promise<FamilyState> {
    return request<FamilyState>(`/api/family/${encodeURIComponent(deviceId)}`)
  },

  createFamily(deviceId: string, familyName: string, myName: string, phone: string): Promise<FamilyState> {
    return post<FamilyState>('/api/family', { device_id: deviceId, family_name: familyName, my_name: myName, phone: phone || null })
  },

  inviteMember(deviceId: string, name: string, role: FamilyRole, strict: boolean): Promise<FamilyInviteResult> {
    return post<FamilyInviteResult>('/api/family/invites', { device_id: deviceId, name, role, strict })
  },

  inviteInfo(code: string): Promise<InviteInfo> {
    return request<InviteInfo>(`/api/join/${encodeURIComponent(code)}`)
  },

  joinFamily(code: string, deviceId: string): Promise<FamilyState> {
    return post<FamilyState>(`/api/join/${encodeURIComponent(code)}`, { device_id: deviceId })
  },

  decideRequest(deviceId: string, requestId: string, decision: 'allow' | 'block'): Promise<FamilyState> {
    return post<FamilyState>(`/api/family/requests/${encodeURIComponent(requestId)}`, { device_id: deviceId, decision })
  },

  setStrict(deviceId: string, memberId: string, strict: boolean): Promise<FamilyState> {
    return post<FamilyState>(`/api/family/members/${encodeURIComponent(memberId)}/strict`, { device_id: deviceId, strict })
  },

  removeMember(deviceId: string, memberId: string): Promise<FamilyState> {
    return post<FamilyState>(`/api/family/members/${encodeURIComponent(memberId)}/remove`, { device_id: deviceId })
  },

  sendSos(deviceId: string): Promise<{ notified: number; helplines: Helpline[] }> {
    return post<{ notified: number; helplines: Helpline[] }>('/api/family/sos', { device_id: deviceId })
  },

  async deviceBlocks(deviceId: string): Promise<BlockItem[]> {
    const res = await request<{ items: BlockItem[] }>(`/api/devices/${encodeURIComponent(deviceId)}/blocks`)
    return res.items
  },

  async vapidKey(): Promise<string> {
    const res = await request<{ key: string }>('/api/push/vapid-public-key')
    return res.key
  },

  async savePush(deviceId: string, sub: PushSubscriptionJSON): Promise<void> {
    await post<{ ok: boolean }>(`/api/devices/${encodeURIComponent(deviceId)}/push`, sub)
  },

  async warningCard(id: string): Promise<Blob> {
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
    const res = await post<{ token: string }>('/api/console/login', { password })
    writeItem(TOKEN_KEY, res.token, 'session')
  },

  async cases(status: CaseStatus | 'all'): Promise<CaseItem[]> {
    const res = await authed<{ items: CaseItem[] }>(`/api/console/cases?status=${status}`)
    return res.items
  },

  async decide(id: string, action: 'confirm' | 'reject'): Promise<void> {
    await authed<{ ok: boolean }>(`/api/console/cases/${encodeURIComponent(id)}/${action}`, { method: 'POST' })
  },

  async radarRecent(): Promise<RadarRecent> {
    return authed<RadarRecent>('/api/console/radar/recent')
  },

  radarStream(onItem: (item: RadarItem) => void, onState: (live: boolean) => void): () => void {
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
    return authed<GraphResponse>('/api/console/graph')
  },

  async batchUpload(file: File): Promise<string> {
    const form = new FormData()
    form.append('file', file)
    const res = await authed<{ job_id: string }>('/api/console/batch', { method: 'POST', body: form })
    return res.job_id
  },

  async batchStatus(jobId: string): Promise<BatchStatus> {
    return authed<BatchStatus>(`/api/console/batch/${encodeURIComponent(jobId)}`)
  },

  async batchDownload(jobId: string): Promise<void> {
    await downloadAuthed(`/api/console/batch/${encodeURIComponent(jobId)}/results.csv`, `trust-issues-batch-${jobId}.csv`)
  },

  async huntSearch(query: string): Promise<SearchHit[]> {
    const res = await authed<{ items: SearchHit[] }>('/api/console/hunt/search', {
      method: 'POST',
      body: JSON.stringify({ query }),
    })
    return res.items
  },

  async huntMaps(query: string): Promise<MapsHit[]> {
    const res = await authed<{ items: MapsHit[] }>('/api/console/hunt/maps', {
      method: 'POST',
      body: JSON.stringify({ query }),
    })
    return res.items
  },

  async metrics(): Promise<MetricsResponse> {
    return authed<MetricsResponse>('/api/console/metrics')
  },

  async takedown(scanId: string): Promise<Takedown> {
    return authed<Takedown>(`/api/scans/${encodeURIComponent(scanId)}/takedown`)
  },

  async scan(scanId: string): Promise<ScanResult | null> {
    return api.getScan(scanId)
  },
}
