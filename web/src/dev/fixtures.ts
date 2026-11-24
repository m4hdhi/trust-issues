import type {
  BatchStatus,
  BlockItem,
  BrandRef,
  CaseItem,
  CreateScanResponse,
  DeviceRegistration,
  GraphEdge,
  GraphNode,
  GraphResponse,
  MapsHit,
  MetricsResponse,
  RadarItem,
  RadarRecent,
  ScanResult,
  ScanStage,
  SearchHit,
  StageId,
  Stats,
  Takedown,
  TrendingItem,
} from '../lib/types'
import fakeShot from './shots/fake-adpolice.svg'
import officialShot from './shots/official-adpolice.svg'
import decoyShot from './shots/decoy-desktop.svg'
import notFoundShot from './shots/notfound.svg'
import adpLogo from './shots/adpolice-logo.svg'
import enbdLogo from './shots/enbd-logo.svg'

const NOW = Date.now()
const ago = (minutes: number) => new Date(NOW - minutes * 60_000).toISOString()
const H = 60
const D = 24 * H

const ADP: BrandRef = {
  id: 'adpolice',
  name_en: 'Abu Dhabi Police',
  name_ar: 'شرطة أبوظبي',
  official_domains: ['adpolice.gov.ae', 'es.adpolice.gov.ae'],
  category: 'government',
  logo_url: adpLogo,
  reference_screenshot_url: officialShot,
}

const ENBD: BrandRef = {
  id: 'emiratesnbd',
  name_en: 'Emirates NBD',
  name_ar: 'بنك الإمارات دبي الوطني',
  official_domains: ['emiratesnbd.com'],
  category: 'bank',
  logo_url: enbdLogo,
  reference_screenshot_url: null,
}

const SALIK: BrandRef = {
  id: 'salik',
  name_en: 'Salik',
  name_ar: 'سالك',
  official_domains: ['salik.ae'],
  category: 'transport',
}

const ETISALAT: BrandRef = {
  id: 'eand',
  name_en: 'e& (Etisalat)',
  name_ar: 'إي آند (اتصالات)',
  official_domains: ['etisalat.ae', 'eand.com'],
  category: 'telecom',
}

const ARAMEX: BrandRef = {
  id: 'aramex',
  name_en: 'Aramex',
  name_ar: 'أرامكس',
  official_domains: ['aramex.com'],
  category: 'delivery',
}

const campaignNodes: GraphNode[] = [
  { id: 'd:adpolice-fines-pay.com', kind: 'domain', label: 'adpolice-fines-pay.com', verdict: 'scam' },
  { id: 'd:adpolice-pay-fine.com', kind: 'domain', label: 'adpolice-pay-fine.com', verdict: 'scam' },
  { id: 'd:ad-police-fines.net', kind: 'domain', label: 'ad-police-fines.net', verdict: 'scam' },
  { id: 'd:adp-fines-ae.com', kind: 'domain', label: 'adp-fines-ae.com', verdict: 'scam' },
  { id: 'd:salik-recharge-ae.com', kind: 'domain', label: 'salik-recharge-ae.com', verdict: 'scam' },
  { id: 'd:rta-fine-pay.com', kind: 'domain', label: 'rta-fine-pay.com', verdict: 'suspicious' },
  { id: 'ip:185.234.72.19', kind: 'ip', label: '185.234.72.19' },
  { id: 'asn:9009', kind: 'asn', label: 'AS9009 M247' },
  { id: 'tg:adp_fines_bot', kind: 'telegram', label: '@adp_fines_bot' },
  { id: 'fav:-1730182339', kind: 'favicon', label: 'favicon -1730182339' },
  { id: 'ns:ns1.dnsowl.com', kind: 'nameserver', label: 'ns1.dnsowl.com' },
  { id: 'reg:namesilo', kind: 'registrar', label: 'NameSilo, LLC' },
]

const campaignEdges: GraphEdge[] = [
  { source: 'd:adpolice-fines-pay.com', target: 'ip:185.234.72.19', kind: 'resolves' },
  { source: 'd:adpolice-pay-fine.com', target: 'ip:185.234.72.19', kind: 'resolves' },
  { source: 'd:ad-police-fines.net', target: 'ip:185.234.72.19', kind: 'resolves' },
  { source: 'd:salik-recharge-ae.com', target: 'ip:185.234.72.19', kind: 'resolves' },
  { source: 'ip:185.234.72.19', target: 'asn:9009', kind: 'announced_by' },
  { source: 'd:adpolice-fines-pay.com', target: 'tg:adp_fines_bot', kind: 'exfil' },
  { source: 'd:adp-fines-ae.com', target: 'tg:adp_fines_bot', kind: 'exfil' },
  { source: 'd:salik-recharge-ae.com', target: 'tg:adp_fines_bot', kind: 'exfil' },
  { source: 'd:adpolice-fines-pay.com', target: 'fav:-1730182339', kind: 'favicon' },
  { source: 'd:adpolice-pay-fine.com', target: 'fav:-1730182339', kind: 'favicon' },
  { source: 'd:adp-fines-ae.com', target: 'fav:-1730182339', kind: 'favicon' },
  { source: 'd:rta-fine-pay.com', target: 'fav:-1730182339', kind: 'favicon' },
  { source: 'd:adpolice-fines-pay.com', target: 'ns:ns1.dnsowl.com', kind: 'ns' },
  { source: 'd:ad-police-fines.net', target: 'ns:ns1.dnsowl.com', kind: 'ns' },
  { source: 'd:rta-fine-pay.com', target: 'ns:ns1.dnsowl.com', kind: 'ns' },
  { source: 'd:adpolice-fines-pay.com', target: 'reg:namesilo', kind: 'registrar' },
  { source: 'd:adpolice-pay-fine.com', target: 'reg:namesilo', kind: 'registrar' },
  { source: 'd:salik-recharge-ae.com', target: 'reg:namesilo', kind: 'registrar' },
]

export const scamResult: ScanResult = {
  id: 'demo-scam',
  input:
    'Abu Dhabi Police: You have an unpaid traffic fine of AED 500. Pay within 24 hours to avoid vehicle impound: https://bit.ly/3xAdpFine',
  url: 'https://bit.ly/3xAdpFine',
  final_url: 'https://adpolice-fines-pay.com/ae/pay?ref=TF-88213',
  domain: 'adpolice-fines-pay.com',
  verdict: 'scam',
  score: 96,
  headline: {
    en: 'Fake Abu Dhabi Police fines page — do not pay',
    ar: 'صفحة مزيّفة لمخالفات شرطة أبوظبي — لا تدفع',
  },
  summary: {
    en: 'This site copies the Abu Dhabi Police fines service to steal card details and OTP codes. It was registered 3 days ago and sends everything you type to a Telegram bot.',
    ar: 'يقلّد هذا الموقع خدمة مخالفات شرطة أبوظبي لسرقة بيانات البطاقات ورموز التحقق. سُجّل قبل 3 أيام ويرسل كل ما تكتبه إلى بوت على تيليجرام.',
  },
  brand: ADP,
  signals: [
    {
      id: 'visual_brand_mismatch',
      category: 'visual',
      weight: 0.32,
      severity: 'critical',
      title: {
        en: 'Looks like Abu Dhabi Police, but it isn’t their domain',
        ar: 'يشبه موقع شرطة أبوظبي لكنه ليس نطاقها الرسمي',
      },
      detail: {
        en: 'Logo and layout match adpolice.gov.ae with 94% visual similarity, yet the domain is not on the official list.',
        ar: 'الشعار والتصميم يطابقان adpolice.gov.ae بنسبة تشابه 94%، لكن النطاق ليس ضمن القائمة الرسمية.',
      },
      evidence: { similarity: 0.94, matched_brand: 'adpolice', phash_distance: 6 },
    },
    {
      id: 'exfil_telegram',
      category: 'exfil',
      weight: 0.22,
      severity: 'critical',
      title: { en: 'Sends your data to a Telegram bot', ar: 'يرسل بياناتك إلى بوت على تيليجرام' },
      detail: {
        en: 'The payment form posts card number, CVV and OTP straight to api.telegram.org instead of a bank.',
        ar: 'يرسل نموذج الدفع رقم البطاقة ورمز CVV ورمز التحقق مباشرةً إلى api.telegram.org بدلًا من أي مصرف.',
      },
      evidence: { endpoint: 'api.telegram.org/bot71…/sendMessage', fields: ['card', 'cvv', 'otp'] },
    },
    {
      id: 'asks_card_otp',
      category: 'render',
      weight: 0.18,
      severity: 'high',
      title: { en: 'Asks for card number, CVV, Emirates ID and OTP', ar: 'يطلب رقم البطاقة ورمز CVV والهوية الإماراتية ورمز التحقق' },
      detail: {
        en: 'Government fine portals never collect OTP codes on the same page as card details.',
        ar: 'بوابات المخالفات الحكومية لا تطلب رمز التحقق في الصفحة نفسها مع بيانات البطاقة.',
      },
      evidence: { inputs: ['cc-number', 'cc-csc', 'emirates_id', 'one-time-code'] },
    },
    {
      id: 'young_domain',
      category: 'domain',
      weight: 0.12,
      severity: 'high',
      title: { en: 'Domain registered 3 days ago', ar: 'سُجّل النطاق قبل 3 أيام' },
      detail: {
        en: 'Registered through NameSilo with privacy protection; the TLS certificate is 2 days old.',
        ar: 'مسجّل عبر NameSilo مع إخفاء بيانات المالك، وعمر شهادة TLS يومان فقط.',
      },
      evidence: { age_days: 3, registrar: 'NameSilo, LLC' },
    },
    {
      id: 'cloaking',
      category: 'render',
      weight: 0.1,
      severity: 'high',
      title: { en: 'Shows a different page to security scanners', ar: 'يعرض صفحة مختلفة لأنظمة الفحص الأمني' },
      detail: {
        en: 'Only UAE mobile visitors see the payment form.',
        ar: 'لا يرى نموذج الدفع إلا زوار الهواتف من داخل الإمارات.',
      },
      evidence: { personas_differ: ['desktop', 'googlebot'] },
    },
    {
      id: 'url_model',
      category: 'url',
      weight: 0.08,
      severity: 'medium',
      title: { en: 'AI URL model: 97% phishing probability', ar: 'نموذج الروابط: احتمال تصيّد 97%' },
      detail: {
        en: 'Brand name plus “fines-pay” in a .com domain is a classic pattern of UAE fine scams.',
        ar: 'اسم الجهة مع «fines-pay» في نطاق ‎.com نمط معروف في احتيالات المخالفات بالإمارات.',
      },
      evidence: { probability: 0.97, model: 'url-xgb-v3' },
    },
    {
      id: 'community',
      category: 'community',
      weight: 0.06,
      severity: 'high',
      title: { en: 'Reported 37 times by residents', ar: 'أبلغ عنه السكان 37 مرة' },
      detail: null,
      evidence: { reports: 37, last_24h: 29 },
    },
    {
      id: 'shortener',
      category: 'url',
      weight: 0.05,
      severity: 'medium',
      title: { en: 'Hidden behind a bit.ly short link', ar: 'مخفي خلف رابط مختصر bit.ly' },
      detail: null,
      evidence: { hops: 3 },
    },
    {
      id: 'urgency',
      category: 'render',
      weight: 0.03,
      severity: 'low',
      title: { en: 'Pressure tactics: “pay within 24 hours”', ar: 'أسلوب ضغط: «ادفع خلال 24 ساعة»' },
      detail: null,
      evidence: { phrases: ['FINAL NOTICE', 'within 24 hours', 'impounded'] },
    },
  ],
  redirect_chain: [
    { url: 'https://bit.ly/3xAdpFine', status: 301, kind: 'shortener' },
    { url: 'https://trk-ae.click/r/88213', status: 302, kind: 'http' },
    { url: 'https://adpolice-fines-pay.com/ae/pay?ref=TF-88213', status: 200, kind: 'final' },
  ],
  cloaking: {
    detected: true,
    reason: {
      en: 'A UAE mobile visitor gets the payment form. Desktop browsers see “under construction” and Google’s crawler gets a 404, so the site stays off blocklists.',
      ar: 'يرى زائر الهاتف في الإمارات نموذج الدفع، بينما ترى متصفحات الحاسوب صفحة «قيد الإنشاء» ويحصل زاحف Google على خطأ 404، فيبقى الموقع خارج قوائم الحظر.',
    },
    personas: [
      { name: 'uae_mobile', final_url: 'https://adpolice-fines-pay.com/ae/pay', title: 'Traffic Fine Payment', screenshot_url: fakeShot, status: 200 },
      { name: 'desktop', final_url: 'https://adpolice-fines-pay.com/', title: 'Under construction', screenshot_url: decoyShot, status: 200 },
      { name: 'googlebot', final_url: 'https://adpolice-fines-pay.com/', title: '404 Not Found', screenshot_url: notFoundShot, status: 404 },
    ],
  },
  domain_intel: {
    registered: ago(3 * D),
    age_days: 3,
    registrar: 'NameSilo, LLC',
    registrar_abuse_email: 'abuse@namesilo.com',
    nameservers: ['ns1.dnsowl.com', 'ns2.dnsowl.com'],
    ips: ['185.234.72.19'],
    asn: 'AS9009',
    as_org: 'M247 Europe SRL',
    country: 'NL',
    host_abuse_email: 'abuse@m247.com',
    tls_issuer: "Let's Encrypt R11",
    tls_not_before: ago(2 * D),
    tls_age_days: 2,
    ct_cert_count: 3,
  },
  page: {
    title: 'Abu Dhabi Police - Traffic Fine Payment',
    screenshot_url: fakeShot,
    width: 390,
    height: 844,
    language: 'en',
    text_excerpt: 'FINAL NOTICE: pay within 24 hours or your vehicle will be impounded.',
    favicon_hash: -1730182339,
    asks_for: ['card', 'cvv', 'emirates_id', 'otp'],
    annotations: [
      { x: 14, y: 10, w: 190, h: 46, kind: 'logo', label: { en: 'Copied police logo', ar: 'شعار الشرطة منسوخ' } },
      { x: 12, y: 76, w: 366, h: 52, kind: 'urgency', label: { en: 'Pressure: 24-hour deadline', ar: 'ضغط: مهلة 24 ساعة' } },
      { x: 10, y: 304, w: 370, h: 118, kind: 'card', label: { en: 'Asks for card number and CVV', ar: 'يطلب رقم البطاقة ورمز CVV' } },
      { x: 10, y: 440, w: 370, h: 66, kind: 'emirates_id', label: { en: 'Asks for Emirates ID', ar: 'يطلب رقم الهوية الإماراتية' } },
      { x: 10, y: 516, w: 370, h: 66, kind: 'otp', label: { en: 'Asks for your bank OTP', ar: 'يطلب رمز التحقق من مصرفك' } },
    ],
  },
  exfil: [
    {
      kind: 'telegram_bot',
      value: 'api.telegram.org/bot7139…:AAH…/sendMessage',
      context: 'chat_id 6123948211 receives card, cvv, emirates_id, otp',
    },
    { kind: 'form_post', value: 'https://adpolice-fines-pay.com/api/save.php', context: 'POST on “Pay AED 500 now”' },
  ],
  domain_diff: {
    official: 'adpolice.gov.ae',
    suspect: 'adpolice-fines-pay.com',
    segments: [
      { op: 'equal', official: 'adpolice', text: 'adpolice' },
      { op: 'replace', official: '.gov.ae', text: '-fines-pay.com' },
    ],
  },
  timeline: [
    { ts: ago(3 * D + 2 * H), kind: 'registered', label: { en: 'Domain registered at NameSilo with hidden owner', ar: 'تسجيل النطاق لدى NameSilo مع إخفاء المالك' } },
    { ts: ago(2 * D + 5 * H), kind: 'certificate', label: { en: 'Free TLS certificate issued — appears in CT logs', ar: 'إصدار شهادة TLS مجانية — ظهرت في سجلات الشفافية' } },
    { ts: ago(2 * D), kind: 'detected', label: { en: 'Our CT hunter flags the name as an Abu Dhabi Police lookalike', ar: 'أداة تعقّب الشهادات ترصد الاسم كمنتحل لشرطة أبوظبي' } },
    { ts: ago(26 * H), kind: 'campaign', label: { en: 'Bulk SMS wave starts: “unpaid traffic fine”', ar: 'بدء موجة رسائل جماعية: «مخالفة مرورية غير مدفوعة»' } },
    { ts: ago(20 * H), kind: 'report', label: { en: 'First resident report via WhatsApp', ar: 'أول بلاغ من أحد السكان عبر واتساب' } },
    { ts: ago(19 * H), kind: 'confirmed', label: { en: 'Confirmed and pushed to the DNS blocklist', ar: 'تأكيد الاحتيال وإضافته إلى قائمة حظر DNS' } },
    { ts: ago(8), kind: 'scan', label: { en: 'You checked this link', ar: 'فحصت هذا الرابط' } },
  ],
  community: {
    reports: 37,
    last_24h: 29,
    channels: { whatsapp: 21, sms: 9, instagram: 4, telegram: 3 },
    status: 'confirmed',
  },
  campaign: { id: 'cmp-fines-7f3a', size: 12, nodes: campaignNodes, edges: campaignEdges },
  ai: [
    {
      provider: 'Anthropic',
      model: 'claude-sonnet-4-5',
      verdict: 'scam',
      confidence: 0.98,
      target_brand: 'Abu Dhabi Police',
      asks_for: ['card', 'cvv', 'otp', 'emirates_id'],
      reasons: {
        en: [
          'Impersonates Abu Dhabi Police on a non-government domain',
          'Collects card details and OTP together, which no fine portal does',
          'Urgency and impound threat typical of fine scams',
        ],
        ar: [
          'ينتحل صفة شرطة أبوظبي على نطاق غير حكومي',
          'يجمع بيانات البطاقة ورمز التحقق معًا، وهو ما لا تفعله أي بوابة مخالفات',
          'الاستعجال والتهديد بحجز المركبة من سمات احتيال المخالفات',
        ],
      },
      latency_ms: 2140,
    },
    {
      provider: 'OpenAI',
      model: 'gpt-4.1',
      verdict: 'scam',
      confidence: 0.95,
      target_brand: 'Abu Dhabi Police',
      asks_for: ['card', 'otp'],
      reasons: {
        en: ['Brand mismatch between page content and domain', 'Payment form posts to a third-party endpoint'],
        ar: ['تعارض بين محتوى الصفحة والنطاق', 'نموذج الدفع يرسل البيانات إلى جهة خارجية'],
      },
      latency_ms: 1780,
    },
  ],
  evidence: { sha256_screenshot: '9f2c…e41a', captured_at: ago(8) },
  mode: 'deep',
  timings_ms: { trust: 18, intel: 412, url_model: 36, domain: 655, render: 3820, cloaking: 2910, exfil: 140, visual: 380, ai: 2210, fusion: 9, total: 6840 },
  created_at: ago(8),
}

export const safeResult: ScanResult = {
  id: 'demo-safe',
  input: 'https://www.emiratesnbd.com/en',
  url: 'https://www.emiratesnbd.com/en',
  final_url: 'https://www.emiratesnbd.com/en',
  domain: 'emiratesnbd.com',
  verdict: 'safe',
  score: 3,
  headline: { en: 'Official Emirates NBD website', ar: 'الموقع الرسمي لبنك الإمارات دبي الوطني' },
  summary: {
    en: 'This is the genuine website of Emirates NBD. The domain is on our verified list of UAE banks and has a long, clean history.',
    ar: 'هذا هو الموقع الحقيقي لبنك الإمارات دبي الوطني. النطاق مدرج في قائمتنا الموثّقة للبنوك الإماراتية وله سجل طويل ونظيف.',
  },
  brand: ENBD,
  signals: [
    {
      id: 'trust_anchor',
      category: 'trust',
      weight: -0.6,
      severity: 'info',
      title: { en: 'Official domain of Emirates NBD', ar: 'النطاق الرسمي لبنك الإمارات دبي الوطني' },
      detail: {
        en: 'Matches our verified registry of UAE banks and government services.',
        ar: 'يطابق سجلنا الموثّق للبنوك والجهات الحكومية في الإمارات.',
      },
      evidence: { registry: 'uae-banks', match: 'emiratesnbd.com' },
    },
    {
      id: 'domain_age',
      category: 'domain',
      weight: -0.2,
      severity: 'info',
      title: { en: 'Domain registered 25 years ago', ar: 'سُجّل النطاق قبل 25 سنة' },
      detail: null,
      evidence: { age_days: 9131 },
    },
    {
      id: 'clean_intel',
      category: 'intel',
      weight: -0.1,
      severity: 'info',
      title: { en: 'Not on any phishing blocklist', ar: 'غير مدرج في أي قائمة تصيّد' },
      detail: null,
      evidence: { sources: ['Google Safe Browsing', 'URLhaus', 'OpenPhish'] },
    },
    {
      id: 'tls',
      category: 'domain',
      weight: -0.05,
      severity: 'info',
      title: { en: 'Extended certificate from DigiCert', ar: 'شهادة أمان موسّعة من DigiCert' },
      detail: null,
      evidence: {},
    },
  ],
  redirect_chain: [{ url: 'https://www.emiratesnbd.com/en', status: 200, kind: 'final' }],
  cloaking: { detected: false, personas: [] },
  domain_intel: {
    registered: ago(9131 * D),
    age_days: 9131,
    registrar: 'MarkMonitor Inc.',
    nameservers: ['ns1.emiratesnbd.com'],
    ips: ['23.45.112.18'],
    asn: 'AS20940',
    as_org: 'Akamai International',
    country: 'AE',
    tls_issuer: 'DigiCert EV RSA CA G2',
    tls_age_days: 142,
    ct_cert_count: 214,
  },
  page: null,
  exfil: [],
  domain_diff: null,
  timeline: [],
  community: { reports: 0, last_24h: 0, channels: {}, status: 'none' },
  campaign: null,
  ai: [
    {
      provider: 'Anthropic',
      model: 'claude-sonnet-4-5',
      verdict: 'safe',
      confidence: 0.97,
      target_brand: 'Emirates NBD',
      asks_for: [],
      reasons: { en: ['Official bank domain with consistent branding'], ar: ['نطاق المصرف الرسمي مع هوية متسقة'] },
      latency_ms: 1630,
    },
    {
      provider: 'OpenAI',
      model: 'gpt-4.1',
      verdict: 'safe',
      confidence: 0.94,
      target_brand: 'Emirates NBD',
      asks_for: [],
      reasons: { en: ['No credential harvesting detected'], ar: ['لم يُرصد أي جمع لبيانات الدخول'] },
      latency_ms: 1410,
    },
  ],
  evidence: {},
  mode: 'deep',
  timings_ms: { trust: 9, intel: 220, url_model: 31, domain: 140, ai: 1630, fusion: 4, total: 1910 },
  created_at: ago(1),
}

const smsAnalysis = {
  is_scam_text: true,
  score: 88,
  reasons: {
    en: [
      'Impersonates a government authority',
      'Creates urgency with a 24-hour deadline',
      'Threatens a penalty (vehicle impound)',
      'Asks you to pay through a link',
    ],
    ar: ['ينتحل صفة جهة حكومية', 'يخلق استعجالًا بمهلة 24 ساعة', 'يهدّد بعقوبة (حجز المركبة)', 'يطلب منك الدفع عبر رابط'],
  },
  urls_found: ['https://bit.ly/3xAdpFine'],
}

export function mockCreateScan(input: string): CreateScanResponse {
  const urls = input.match(/https?:\/\/\S+/g) ?? []
  const isMessage = input.trim().split(/\s+/).length > 3
  if (urls.length > 1) {
    return {
      scans: [
        { id: scamResult.id, url: scamResult.url },
        { id: safeResult.id, url: safeResult.url },
      ],
      message: { ...smsAnalysis, urls_found: urls },
    }
  }
  if (/emiratesnbd/i.test(input)) {
    return { scans: [{ id: safeResult.id, url: safeResult.url }], message: null }
  }
  if (urls.length === 0 && isMessage) {
    return { scans: [], message: { ...smsAnalysis, urls_found: [] } }
  }
  return { scans: [{ id: scamResult.id, url: scamResult.url }], message: isMessage ? smsAnalysis : null }
}

export function mockGetScan(id: string): ScanResult | null {
  if (id === safeResult.id) return safeResult
  if (id === scamResult.id) return scamResult
  return null
}

const STAGE_LABELS: Record<StageId, { en: string; ar: string }> = {
  trust: { en: 'Trust anchors', ar: 'مراجع الثقة' },
  intel: { en: 'Threat intelligence', ar: 'استخبارات التهديدات' },
  url_model: { en: 'AI URL model', ar: 'نموذج الذكاء الاصطناعي للروابط' },
  domain: { en: 'Domain intelligence', ar: 'معلومات النطاق' },
  render: { en: 'Sandbox render', ar: 'الفتح في بيئة معزولة' },
  cloaking: { en: 'Cloaking check', ar: 'كشف التمويه' },
  exfil: { en: 'Exfiltration hunt', ar: 'تتبّع تسريب البيانات' },
  visual: { en: 'Visual brand match', ar: 'المطابقة البصرية للعلامة' },
  ai: { en: 'AI judges', ar: 'حكّام الذكاء الاصطناعي' },
  fusion: { en: 'Final score', ar: 'النتيجة النهائية' },
}

export function mockStageScript(): { delay: number; stage: ScanStage }[] {
  const plan: [StageId, number, string | null][] = [
    ['trust', 120, 'adpolice-fines-pay.com'],
    ['intel', 380, null],
    ['url_model', 160, '0.97'],
    ['domain', 420, '3 days'],
    ['render', 900, null],
    ['cloaking', 520, 'detected'],
    ['exfil', 240, '2 leads'],
    ['visual', 300, 'adpolice'],
    ['ai', 700, 'Anthropic:scam, OpenAI:scam'],
    ['fusion', 120, '96'],
  ]
  return plan.flatMap(([id, dur, detail]) => [
    { delay: 90, stage: { stage: id, status: 'running', label: STAGE_LABELS[id] } },
    { delay: dur, stage: { stage: id, status: 'done', label: STAGE_LABELS[id], detail } },
  ])
}

export const stats: Stats = {
  scans_total: 18234,
  scams_detected: 2417,
  reports_total: 5310,
  blocked_queries: 48211,
  domains_blocklisted: 1893,
  hunters: { ct: 1204, search: 233, maps: 41, typosquat: 612, nrd: 307 },
  last_24h: { scans: 912, scams: 117, reports: 286, blocked: 3104 },
  ct_certs_watched: 1_284_331,
}

export const trending: TrendingItem[] = [
  {
    domain: 'adpolice-fines-pay.com',
    url: 'https://adpolice-fines-pay.com/ae/pay',
    brand: ADP,
    verdict: 'scam',
    score: 96,
    reports_24h: 29,
    reports_total: 37,
    channels: { whatsapp: 21, sms: 9, instagram: 4, telegram: 3 },
    first_seen: ago(2 * D),
    last_seen: ago(6),
    headline: scamResult.headline,
    scan_id: 'demo-scam',
  },
  {
    domain: 'salik-recharge-ae.com',
    url: 'https://salik-recharge-ae.com/topup',
    brand: SALIK,
    verdict: 'scam',
    score: 93,
    reports_24h: 18,
    reports_total: 52,
    channels: { sms: 31, whatsapp: 17, email: 4 },
    first_seen: ago(4 * D),
    last_seen: ago(22),
    headline: { en: 'Fake Salik top-up page steals card details', ar: 'صفحة شحن مزيّفة لسالك تسرق بيانات البطاقات' },
    scan_id: 'demo-scam',
  },
  {
    domain: 'enbd-support-care.com',
    url: 'https://enbd-support-care.com/verify',
    brand: ENBD,
    verdict: 'scam',
    score: 91,
    reports_24h: 11,
    reports_total: 19,
    channels: { whatsapp: 12, instagram: 5, other: 2 },
    first_seen: ago(30 * H),
    last_seen: ago(41),
    headline: { en: 'Fake Emirates NBD “account verification” page', ar: 'صفحة «تحقق من الحساب» مزيّفة لبنك الإمارات دبي الوطني' },
    scan_id: 'demo-scam',
  },
  {
    domain: 'etisalat-points-redeem.net',
    url: 'https://etisalat-points-redeem.net/',
    brand: ETISALAT,
    verdict: 'scam',
    score: 88,
    reports_24h: 7,
    reports_total: 64,
    channels: { sms: 48, whatsapp: 16 },
    first_seen: ago(9 * D),
    last_seen: ago(3 * H),
    headline: { en: 'Fake e& loyalty points expiring today', ar: 'نقاط ولاء مزيّفة من إي آند «تنتهي اليوم»' },
    scan_id: 'demo-scam',
  },
  {
    domain: 'aramex-redelivery-ae.com',
    url: 'https://aramex-redelivery-ae.com/fee',
    brand: ARAMEX,
    verdict: 'suspicious',
    score: 71,
    reports_24h: 5,
    reports_total: 9,
    channels: { sms: 9 },
    first_seen: ago(14 * H),
    last_seen: ago(2 * H),
    headline: { en: 'Parcel “redelivery fee” of AED 6.50', ar: 'رسوم «إعادة توصيل» طرد بقيمة 6.50 درهم' },
    scan_id: 'demo-scam',
  },
]

export const device: DeviceRegistration = {
  device_id: 'dev-demo-7c1f',
  doh_url: `${window.location.origin}/dns-query/dev-demo-7c1f`,
  ios_profile_url: '/api/protect/dev-demo-7c1f/ios.mobileconfig',
  android_hostname_hint: `dev-demo-7c1f.${window.location.hostname}`,
}

export const blocks: BlockItem[] = [
  { domain: 'adpolice-fines-pay.com', ts: ago(42), brand: 'Abu Dhabi Police', headline: scamResult.headline, scan_id: 'demo-scam' },
  { domain: 'salik-recharge-ae.com', ts: ago(26 * H), brand: 'Salik', headline: trending[1].headline, scan_id: 'demo-scam' },
]

export const cases: CaseItem[] = [
  { id: 'c-101', domain: 'adpolice-fines-pay.com', url: 'https://adpolice-fines-pay.com/ae/pay', source: 'report', verdict: 'scam', score: 96, brand: 'Abu Dhabi Police', reports: 37, created_at: ago(20 * H), scan_id: 'demo-scam', status: 'confirmed' },
  { id: 'c-102', domain: 'adpolice-pay-fine.com', url: 'https://adpolice-pay-fine.com/', source: 'ct', verdict: 'scam', score: 92, brand: 'Abu Dhabi Police', reports: 0, created_at: ago(3 * H), scan_id: 'demo-scam', status: 'pending' },
  { id: 'c-103', domain: 'enbd-support-care.com', url: 'https://enbd-support-care.com/verify', source: 'search', verdict: 'scam', score: 91, brand: 'Emirates NBD', reports: 19, created_at: ago(5 * H), scan_id: 'demo-scam', status: 'pending' },
  { id: 'c-104', domain: 'rta-fine-pay.com', url: 'https://rta-fine-pay.com/', source: 'typosquat', verdict: 'suspicious', score: 68, brand: 'RTA', reports: 2, created_at: ago(7 * H), scan_id: 'demo-scam', status: 'pending' },
  { id: 'c-105', domain: 'adnoc-rewards-uae.com', url: 'https://adnoc-rewards-uae.com/', source: 'nrd', verdict: 'suspicious', score: 64, brand: 'ADNOC', reports: 0, created_at: ago(9 * H), scan_id: 'demo-scam', status: 'pending' },
  { id: 'c-106', domain: 'salik-recharge-ae.com', url: 'https://salik-recharge-ae.com/topup', source: 'report', verdict: 'scam', score: 93, brand: 'Salik', reports: 52, created_at: ago(4 * D), scan_id: 'demo-scam', status: 'confirmed' },
  { id: 'c-107', domain: 'mohre-wps-check.com', url: 'https://mohre-wps-check.com/', source: 'maps', verdict: 'suspicious', score: 58, brand: 'MOHRE', reports: 1, created_at: ago(11 * H), scan_id: 'demo-scam', status: 'pending' },
  { id: 'c-108', domain: 'tamm-services.ae', url: 'https://tamm-services.ae/', source: 'typosquat', verdict: 'safe', score: 12, brand: 'TAMM', reports: 0, created_at: ago(30 * H), scan_id: 'demo-safe', status: 'rejected' },
]

const RADAR_POOL: Omit<RadarItem, 'ts'>[] = [
  { source: 'ct', domain: 'adpolice-finepay.com', url: 'https://adpolice-finepay.com', score: 94, verdict: 'scam', brand: 'Abu Dhabi Police', detail: { en: 'New certificate mentions “adpolice”', ar: 'شهادة جديدة تتضمن «adpolice»' } },
  { source: 'typosquat', domain: 'emiratesnbd-secure.com', url: 'https://emiratesnbd-secure.com', score: 89, verdict: 'scam', brand: 'Emirates NBD', detail: { en: 'Brand + “secure” combo-squat', ar: 'انتحال مركّب: اسم العلامة + «secure»' } },
  { source: 'search', domain: 'uae-fines-check.com', url: 'https://uae-fines-check.com', score: 77, verdict: 'suspicious', brand: 'Abu Dhabi Police', detail: { en: 'Paid ad on “pay traffic fines”', ar: 'إعلان مدفوع على «دفع المخالفات»' } },
  { source: 'maps', domain: 'enbd-helpline.net', url: 'https://enbd-helpline.net', score: 85, verdict: 'scam', brand: 'Emirates NBD', detail: { en: 'Fake branch listing with mobile number', ar: 'فرع مزيّف على الخرائط برقم هاتف متحرك' } },
  { source: 'nrd', domain: 'salik-wallet-topup.com', url: 'https://salik-wallet-topup.com', score: 90, verdict: 'scam', brand: 'Salik', detail: { en: 'Registered 40 minutes ago', ar: 'سُجّل قبل 40 دقيقة' } },
  { source: 'report', domain: 'dewa-refund-portal.com', url: 'https://dewa-refund-portal.com', score: 87, verdict: 'scam', brand: 'DEWA', detail: { en: 'Reported via SMS', ar: 'بلاغ عبر رسالة نصية' } },
  { source: 'ct', domain: 'adcb-update-kyc.com', url: 'https://adcb-update-kyc.com', score: 91, verdict: 'scam', brand: 'ADCB', detail: { en: 'Wildcard certificate, brand keyword', ar: 'شهادة شاملة تحتوي اسم العلامة' } },
  { source: 'typosquat', domain: 'adpollce.gov-ae.com', url: 'https://adpollce.gov-ae.com', score: 95, verdict: 'scam', brand: 'Abu Dhabi Police', detail: { en: 'Homoglyph: “ll” instead of “li”', ar: 'تشابه أحرف: «ll» بدل «li»' } },
  { source: 'nrd', domain: 'emirates-post-fee.com', url: 'https://emirates-post-fee.com', score: 66, verdict: 'suspicious', brand: 'Emirates Post', detail: { en: 'New domain with parcel-fee keywords', ar: 'نطاق جديد بكلمات رسوم الطرود' } },
]

export const radar: RadarRecent = {
  items: RADAR_POOL.slice(0, 7).map((r, i) => ({ ...r, id: `r-${i}`, ts: ago(3 + i * 11) })),
  ct: { certs: 1_284_331, candidates: 1204 },
}

export function randomRadarItem(): RadarItem {
  const base = RADAR_POOL[Math.floor(Math.random() * RADAR_POOL.length)]
  const suffix = Math.random().toString(36).slice(2, 5)
  const [name, ...rest] = base.domain.split('.')
  const domain = `${name}-${suffix}.${rest.join('.')}`
  return { ...base, id: `r-${suffix}`, domain, url: `https://${domain}`, ts: new Date().toISOString() }
}

const bankNodes: GraphNode[] = [
  { id: 'd:enbd-support-care.com', kind: 'domain', label: 'enbd-support-care.com', verdict: 'scam' },
  { id: 'd:enbd-helpline.net', kind: 'domain', label: 'enbd-helpline.net', verdict: 'scam' },
  { id: 'd:emiratesnbd-secure.com', kind: 'domain', label: 'emiratesnbd-secure.com', verdict: 'scam' },
  { id: 'd:adcb-update-kyc.com', kind: 'domain', label: 'adcb-update-kyc.com', verdict: 'scam' },
  { id: 'ph:+971523318840', kind: 'phone', label: '+971 52 331 8840' },
  { id: 'ip:91.215.85.140', kind: 'ip', label: '91.215.85.140' },
  { id: 'asn:44477', kind: 'asn', label: 'AS44477 Stark Industries' },
  { id: 'reg:hostinger', kind: 'registrar', label: 'Hostinger Operations' },
  { id: 'dom:7d1e', kind: 'dom', label: 'kit: bank-verify-v2' },
]

const bankEdges: GraphEdge[] = [
  { source: 'd:enbd-support-care.com', target: 'ip:91.215.85.140', kind: 'resolves' },
  { source: 'd:enbd-helpline.net', target: 'ip:91.215.85.140', kind: 'resolves' },
  { source: 'd:adcb-update-kyc.com', target: 'ip:91.215.85.140', kind: 'resolves' },
  { source: 'ip:91.215.85.140', target: 'asn:44477', kind: 'announced_by' },
  { source: 'd:enbd-support-care.com', target: 'ph:+971523318840', kind: 'contact' },
  { source: 'd:enbd-helpline.net', target: 'ph:+971523318840', kind: 'contact' },
  { source: 'd:emiratesnbd-secure.com', target: 'reg:hostinger', kind: 'registrar' },
  { source: 'd:enbd-support-care.com', target: 'reg:hostinger', kind: 'registrar' },
  { source: 'd:emiratesnbd-secure.com', target: 'dom:7d1e', kind: 'template' },
  { source: 'd:adcb-update-kyc.com', target: 'dom:7d1e', kind: 'template' },
  { source: 'd:enbd-support-care.com', target: 'dom:7d1e', kind: 'template' },
]

export const graph: GraphResponse = {
  nodes: [...campaignNodes, ...bankNodes],
  edges: [...campaignEdges, ...bankEdges],
  campaigns: [
    {
      id: 'cmp-fines-7f3a',
      size: 12,
      brands: ['Abu Dhabi Police', 'Salik', 'RTA'],
      domains: campaignNodes.filter((n) => n.kind === 'domain').map((n) => n.label),
    },
    {
      id: 'cmp-bank-21c9',
      size: 9,
      brands: ['Emirates NBD', 'ADCB'],
      domains: bankNodes.filter((n) => n.kind === 'domain').map((n) => n.label),
    },
  ],
}

export const searchHits: SearchHit[] = [
  { title: 'Pay Traffic Fines Online — Instant Clearance', url: 'https://adpolice-fines-pay.com/ae/pay', domain: 'adpolice-fines-pay.com', is_ad: true, position: 1, verdict: 'scam', score: 96, scan_id: 'demo-scam' },
  { title: 'Traffic Fines Inquiry and Payment - Abu Dhabi Police', url: 'https://es.adpolice.gov.ae/', domain: 'es.adpolice.gov.ae', is_ad: false, position: 2, verdict: 'safe', score: 2, scan_id: 'demo-safe' },
  { title: 'UAE Fines Check — All Emirates in 1 Click', url: 'https://uae-fines-check.com/', domain: 'uae-fines-check.com', is_ad: true, position: 3, verdict: 'suspicious', score: 77, scan_id: 'demo-scam' },
  { title: 'Pay traffic fines | TAMM', url: 'https://www.tamm.abudhabi/', domain: 'tamm.abudhabi', is_ad: false, position: 4, verdict: 'safe', score: 1, scan_id: 'demo-safe' },
  { title: 'Abu Dhabi fines 50% discount — pay today', url: 'https://ad-police-fines.net/discount', domain: 'ad-police-fines.net', is_ad: false, position: 5, verdict: 'scam', score: 94, scan_id: 'demo-scam' },
  { title: 'How to check traffic fines in Abu Dhabi', url: 'https://gulfnews.com/uae/how-to-check-fines', domain: 'gulfnews.com', is_ad: false, position: 6, verdict: 'safe', score: 4, scan_id: 'demo-safe' },
]

export const mapsHits: MapsHit[] = [
  { title: 'Emirates NBD Customer Care', phone: '+971 52 331 8840', website: 'https://enbd-helpline.net', address: 'Sheikh Zayed Rd, Dubai', rating: 4.9, reviews: 14, flags: [{ en: 'Mobile number not listed on emiratesnbd.com', ar: 'رقم متحرك غير مدرج في الموقع الرسمي' }, { en: 'Website is not an official domain', ar: 'الموقع الإلكتروني ليس نطاقًا رسميًا' }], verdict: 'scam', score: 92, brand: 'Emirates NBD', lat: 25.2167, lng: 55.2797 },
  { title: 'Emirates NBD — Head Office', phone: '+971 600 540000', website: 'https://www.emiratesnbd.com', address: 'Baniyas Rd, Deira, Dubai', rating: 4.1, reviews: 2210, flags: [], verdict: 'safe', score: 2, brand: 'Emirates NBD', lat: 25.2637, lng: 55.3117 },
  { title: 'ENBD Card Services 24/7', phone: '+971 55 902 1177', website: null, address: 'Al Barsha 1, Dubai', rating: 5, reviews: 6, flags: [{ en: 'Listing created 5 days ago', ar: 'أُنشئت القائمة قبل 5 أيام' }, { en: 'Perfect rating from few reviews', ar: 'تقييم كامل من مراجعات قليلة' }], verdict: 'suspicious', score: 74, brand: 'Emirates NBD', lat: 25.1124, lng: 55.1977 },
  { title: 'Emirates NBD — Dubai Mall Branch', phone: '+971 600 540000', website: 'https://www.emiratesnbd.com', address: 'The Dubai Mall, Downtown', rating: 4.0, reviews: 845, flags: [], verdict: 'safe', score: 3, brand: 'Emirates NBD', lat: 25.1972, lng: 55.2796 },
  { title: 'Emirates NBD Refund Desk', phone: '+971 58 447 2091', website: 'https://emiratesnbd-secure.com', address: 'Business Bay, Dubai', rating: 4.8, reviews: 9, flags: [{ en: 'Asks callers for card PIN', ar: 'يطلب من المتصلين الرقم السري للبطاقة' }], verdict: 'scam', score: 95, brand: 'Emirates NBD', lat: 25.1865, lng: 55.2652 },
]

export const metrics: MetricsResponse = {
  eval: { precision: 0.964, recall: 0.941, f1: 0.952, fpr: 0.012, official_fp: 0, n: 1200 },
  series: Array.from({ length: 14 }, (_, i) => {
    const day = new Date(NOW - (13 - i) * D)
    const wave = Math.sin(i / 2) * 40
    return {
      date: day.toISOString().slice(0, 10),
      scans: Math.round(620 + i * 22 + wave * 2),
      scams: Math.round(84 + i * 3 + wave / 2),
      reports: Math.round(160 + i * 9 + wave),
      blocks: Math.round(1800 + i * 95 + wave * 6),
    }
  }),
}

let batchCalls = 0
export function resetMockBatch(): void {
  batchCalls = 0
}

export function mockBatchStatus(): BatchStatus {
  batchCalls += 1
  const total = 200
  const done = Math.min(total, batchCalls * 37)
  const finished = done >= total
  return {
    status: finished ? 'done' : 'running',
    done,
    total,
    metrics: finished ? { precision: 0.962, recall: 0.938, f1: 0.95, tp: 91, fp: 4, tn: 99, fn: 6 } : null,
    rows_preview: [
      { url: 'https://adpolice-fines-pay.com/ae/pay', label: 'scam', verdict: 'scam', score: 96, brand: 'Abu Dhabi Police' },
      { url: 'https://www.emiratesnbd.com/en', label: 'safe', verdict: 'safe', score: 3, brand: 'Emirates NBD' },
      { url: 'https://salik-recharge-ae.com/topup', label: 'scam', verdict: 'scam', score: 93, brand: 'Salik' },
      { url: 'https://www.tamm.abudhabi/', label: 'safe', verdict: 'safe', score: 1, brand: 'TAMM' },
      { url: 'https://aramex-redelivery-ae.com/fee', label: 'scam', verdict: 'suspicious', score: 71, brand: 'Aramex' },
    ].slice(0, Math.max(1, Math.floor(done / 40))),
  }
}

export const takedown: Takedown = {
  registrar: {
    to: 'abuse@namesilo.com',
    subject: 'Phishing domain impersonating Abu Dhabi Police: adpolice-fines-pay.com',
    body: 'Hello NameSilo Abuse Team,\n\nThe domain adpolice-fines-pay.com, registered through your service 3 days ago, hosts a phishing page impersonating Abu Dhabi Police (official domain: adpolice.gov.ae). It collects payment card numbers, CVV codes, Emirates ID numbers and one-time passwords, and forwards them to a Telegram bot.\n\nEvidence pack (screenshots, SHA-256 hashes, redirect chain): attached.\n\nPlease suspend the domain under your anti-abuse policy.\n\nRegards,\nTrust Issues analyst desk',
  },
  host: {
    to: 'abuse@m247.com',
    subject: 'Phishing content on 185.234.72.19 (adpolice-fines-pay.com)',
    body: 'Hello M247 Abuse Team,\n\nThe server at 185.234.72.19 (AS9009) is serving a phishing page impersonating Abu Dhabi Police at https://adpolice-fines-pay.com/ae/pay. The page harvests card details and OTP codes from UAE residents.\n\nPlease remove the content and preserve logs for law enforcement.\n\nRegards,\nTrust Issues analyst desk',
  },
  safe_browsing_url: 'https://safebrowsing.google.com/safebrowsing/report_phish/?url=https%3A%2F%2Fadpolice-fines-pay.com%2Fae%2Fpay',
}
