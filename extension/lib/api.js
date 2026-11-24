export const DEFAULTS = Object.freeze({ apiBase: 'http://localhost:8000', lang: 'both' });

const LANGS = new Set(['both', 'en', 'ar']);
const LOCAL_HOST = /^(localhost|127\.0\.0\.1|\[::1\])(:\d+)?(\/|$)/i;
const GOOGLE_HOST = /(^|\.)google\.(com?\.)?[a-z]{2,3}$/i;
const AD_REDIRECT_HOST = /(^|\.)googleadservices\.com$/i;

export function normalizeBase(raw) {
  const text = String(raw ?? '').trim();
  if (!text) return '';
  const withScheme = /^[a-z][a-z0-9+.-]*:\/\//i.test(text) ? text : `${LOCAL_HOST.test(text) ? 'http' : 'https'}://${text}`;
  let url;
  try {
    url = new URL(withScheme);
  } catch {
    return '';
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return '';
  return `${url.origin}${url.pathname.replace(/\/+$/, '')}`;
}

export function normalizeLang(value) {
  return LANGS.has(value) ? value : DEFAULTS.lang;
}

export async function getSettings() {
  const stored = await chrome.storage.sync.get(DEFAULTS);
  return { apiBase: normalizeBase(stored.apiBase) || DEFAULTS.apiBase, lang: normalizeLang(stored.lang) };
}

export function unwrapRedirect(raw) {
  let url;
  try {
    url = new URL(raw);
  } catch {
    return raw;
  }
  for (let hop = 0; hop < 3; hop += 1) {
    const isRedirect =
      (GOOGLE_HOST.test(url.hostname) && (url.pathname === '/url' || url.pathname === '/aclk')) ||
      AD_REDIRECT_HOST.test(url.hostname);
    if (!isRedirect) break;
    const inner = url.searchParams.get('q') || url.searchParams.get('url') || url.searchParams.get('adurl');
    if (!inner) break;
    try {
      url = new URL(inner);
    } catch {
      break;
    }
  }
  return url.href;
}

async function request(path, { method = 'GET', body, base, timeout = 10000 } = {}) {
  const root = base || (await getSettings()).apiBase;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  try {
    const response = await fetch(`${root}${path}`, {
      method,
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal,
      cache: 'no-store',
    });
    const data = await response.json().catch(() => null);
    if (!response.ok) {
      const detail = typeof data?.detail === 'string' ? data.detail : `HTTP ${response.status}`;
      throw new Error(detail);
    }
    return data;
  } catch (error) {
    if (error.name === 'AbortError') throw new Error(`${root} took too long to respond`);
    if (error instanceof TypeError) throw new Error(`Can't reach ${root}`);
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

export function scanPageUrl(base, id) {
  return `${base}/scan/${encodeURIComponent(id)}`;
}

export function checkUrls(urls, base) {
  return request('/api/check', { method: 'POST', body: { urls }, base, timeout: 20000 });
}

export async function startDeepScan(url, base) {
  const root = base || (await getSettings()).apiBase;
  const data = await request('/api/scans', {
    method: 'POST',
    body: { input: unwrapRedirect(url), mode: 'deep', source: 'extension' },
    base: root,
    timeout: 40000,
  });
  const id = data?.scans?.[0]?.id;
  if (!id) throw new Error('The server did not start a scan');
  return { id, page: scanPageUrl(root, id) };
}

export function submitReport(url, note, base) {
  return request('/api/reports', { method: 'POST', body: { url, channel: 'other', note }, base });
}

export function health(base) {
  return request('/api/health', { base, timeout: 6000 });
}
