export type Verdict = 'safe' | 'suspicious' | 'scam' | 'unknown'
export type Severity = 'info' | 'low' | 'medium' | 'high' | 'critical'

export interface Bilingual {
  en: string
  ar: string
}

export interface BilingualList {
  en: string[]
  ar: string[]
}

export type SignalCategory =
  | 'trust'
  | 'intel'
  | 'url'
  | 'domain'
  | 'render'
  | 'exfil'
  | 'visual'
  | 'ai'
  | 'community'

export interface Signal {
  id: string
  category: SignalCategory
  weight: number
  severity: Severity
  title: Bilingual
  detail?: Bilingual | null
  evidence: Record<string, unknown>
}

export interface BrandRef {
  id: string
  name_en: string
  name_ar: string
  official_domains: string[]
  category: string
  logo_url?: string | null
  reference_screenshot_url?: string | null
}

export interface RedirectHop {
  url: string
  status?: number | null
  kind: string
}

export interface PersonaView {
  name: string
  final_url?: string | null
  title?: string | null
  screenshot_url?: string | null
  dom_hash?: string | null
  status?: number | null
  error?: string | null
}

export interface Cloaking {
  detected: boolean
  reason?: Bilingual | null
  personas: PersonaView[]
}

export type AnnotationKind =
  | 'card'
  | 'password'
  | 'otp'
  | 'emirates_id'
  | 'phone'
  | 'logo'
  | 'urgency'
  | 'form'
  | 'other'

export interface Annotation {
  x: number
  y: number
  w: number
  h: number
  kind: AnnotationKind
  label: Bilingual
}

export interface PageCapture {
  title?: string | null
  screenshot_url?: string | null
  width?: number | null
  height?: number | null
  annotations: Annotation[]
  language?: string | null
  text_excerpt?: string | null
  favicon_hash?: number | null
  asks_for: string[]
}

export interface DomainIntel {
  registered?: string | null
  age_days?: number | null
  registrar?: string | null
  registrar_abuse_email?: string | null
  nameservers: string[]
  ips: string[]
  asn?: string | null
  as_org?: string | null
  country?: string | null
  host_abuse_email?: string | null
  tls_issuer?: string | null
  tls_not_before?: string | null
  tls_age_days?: number | null
  ct_cert_count?: number | null
}

export type ExfilKind =
  | 'telegram_bot'
  | 'webhook'
  | 'form_post'
  | 'whatsapp'
  | 'phone'
  | 'email'
  | 'crypto_wallet'

export interface ExfilLead {
  kind: ExfilKind
  value: string
  context?: string | null
}

export type DiffOp = 'equal' | 'insert' | 'delete' | 'replace'

export interface DiffSegment {
  op: DiffOp
  text: string
  official?: string
}

export interface DomainDiff {
  official: string
  suspect: string
  segments: DiffSegment[]
}

export interface TimelineEvent {
  ts: string
  kind: string
  label: Bilingual
}

export type CommunityStatus = 'none' | 'pending' | 'confirmed' | 'rejected'

export interface CommunityStats {
  reports: number
  last_24h: number
  channels: Record<string, number>
  status: CommunityStatus
}

export type NodeKind =
  | 'domain'
  | 'ip'
  | 'asn'
  | 'favicon'
  | 'phone'
  | 'telegram'
  | 'nameserver'
  | 'registrar'
  | 'dom'

export interface GraphNode {
  id: string
  kind: NodeKind
  label: string
  verdict?: Verdict | null
  brand?: string | null
  scan_id?: string | null
}

export interface GraphEdge {
  source: string
  target: string
  kind: string
}

export interface Campaign {
  id: string
  size: number
  nodes: GraphNode[]
  edges: GraphEdge[]
}

export interface AIOpinion {
  provider: string
  model: string
  verdict: Verdict
  confidence: number
  target_brand?: string | null
  asks_for: string[]
  reasons: Partial<BilingualList>
  latency_ms?: number | null
}

export interface ScanResult {
  id: string
  input: string
  url: string
  final_url?: string | null
  domain: string
  verdict: Verdict
  score: number
  headline: Bilingual
  summary?: Bilingual | null
  brand?: BrandRef | null
  signals: Signal[]
  redirect_chain: RedirectHop[]
  cloaking: Cloaking
  domain_intel: DomainIntel
  page?: PageCapture | null
  exfil: ExfilLead[]
  domain_diff?: DomainDiff | null
  timeline: TimelineEvent[]
  community: CommunityStats
  campaign?: Campaign | null
  ai: AIOpinion[]
  evidence: Record<string, unknown>
  mode: 'fast' | 'deep'
  timings_ms: Record<string, number>
  created_at: string
}

export type StageId =
  | 'trust'
  | 'intel'
  | 'url_model'
  | 'domain'
  | 'render'
  | 'cloaking'
  | 'exfil'
  | 'visual'
  | 'ai'
  | 'fusion'

export type StageStatus = 'running' | 'done' | 'skipped' | 'error'

export interface ScanStage {
  stage: string
  status: StageStatus
  label: Bilingual
  detail?: string | null
}

export type ScanSource = 'web' | 'share' | 'qr' | 'extension' | 'bot'

export interface CreateScanRequest {
  input: string
  mode?: 'fast' | 'deep'
  source?: ScanSource
  device_id?: string
}

export interface MessageAnalysis {
  is_scam_text: boolean
  score: number
  scam_type?: string | null
  brand_id?: string | null
  reasons: BilingualList
  urls_found: string[]
}

export interface CreateScanResponse {
  scans: { id: string; url: string }[]
  message: MessageAnalysis | null
}

export type Channel =
  | 'whatsapp'
  | 'sms'
  | 'instagram'
  | 'telegram'
  | 'email'
  | 'facebook'
  | 'tiktok'
  | 'other'

export interface ReportRequest {
  url: string
  channel: Channel
  note?: string
  device_id?: string
}

export interface ReportResponse {
  report_id: string
  scan_id: string | null
  status: 'pending' | 'confirmed'
}

export interface TrendingItem {
  domain: string
  url: string
  brand: BrandRef | null
  verdict: Verdict
  score: number
  reports_24h: number
  reports_total: number
  channels: Record<string, number>
  first_seen: string
  last_seen: string
  headline: Bilingual
  scan_id: string | null
}

export interface Stats {
  scans_total: number
  scams_detected: number
  reports_total: number
  blocked_queries: number
  domains_blocklisted: number
  hunters: Record<string, number>
  last_24h: Record<string, number>
  ct_certs_watched?: number
}

export type Platform = 'ios' | 'android' | 'other'

export interface DeviceRegistration {
  device_id: string
  doh_url: string
  ios_profile_url: string
  android_hostname_hint: string
}

export interface BlockItem {
  domain: string
  ts: string
  brand: string | BrandRef | null
  headline: Bilingual
  scan_id: string | null
}

export type CaseSource = 'report' | 'ct' | 'search' | 'maps' | 'typosquat' | 'nrd' | 'batch'
export type CaseStatus = 'pending' | 'confirmed' | 'rejected'

export interface CaseItem {
  id: string
  domain: string
  url: string
  source: CaseSource
  verdict: Verdict
  score: number
  brand: string | BrandRef | null
  reports: number
  created_at: string
  scan_id: string | null
  status: CaseStatus
}

export interface RadarItem {
  id?: string
  source: CaseSource
  domain: string
  url: string
  score: number
  verdict: Verdict | 'pending'
  brand: string | BrandRef | null
  ts: string
  detail?: Record<string, unknown> | string | null
}

export interface RadarRecent {
  items: RadarItem[]
  ct?: { certs: number; candidates: number }
}

export interface GraphCampaign {
  id: string
  size: number
  brands: string[]
  domains: string[]
}

export interface GraphResponse {
  nodes: GraphNode[]
  edges: GraphEdge[]
  campaigns: GraphCampaign[]
}

export interface BatchMetrics {
  precision: number
  recall: number
  f1: number
  accuracy?: number
  tp: number
  fp: number
  tn: number
  fn: number
}

export interface BatchStatus {
  status: 'queued' | 'running' | 'done' | 'error' | string
  done: number
  total: number
  metrics?: BatchMetrics | null
  rows_preview: Record<string, unknown>[]
}

export interface SearchHit {
  title: string
  url: string
  domain: string
  is_ad: boolean
  position: number
  verdict: Verdict
  score: number
  scan_id: string | null
  official?: boolean
}

export interface MapsHit {
  title: string
  phone: string | null
  website: string | null
  address: string | null
  rating: number | null
  reviews: number | null
  flags: Bilingual[]
  verdict: Verdict
  score: number
  brand: string | BrandRef | null
  lat: number | null
  lng: number | null
}

export interface SeriesPoint {
  date: string
  scans: number
  scams: number
  reports: number
  blocks: number
}

export interface MetricsResponse {
  eval: Record<string, unknown> | null
  series: SeriesPoint[]
}

export interface DraftEmail {
  to: string
  subject: string
  body: string
}

export interface Takedown {
  registrar: DraftEmail | null
  host: DraftEmail | null
  safe_browsing_url: string | null
}
