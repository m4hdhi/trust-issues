import { DEFAULTS, checkUrls, startDeepScan, unwrapRedirect } from './lib/api.js';

const MENU_ID = 'trust-issues-check-link';
const CACHE_TTL = 10 * 60 * 1000;
const CACHE_LIMIT = 5000;
const BATCH = 200;
const UNKNOWN = Object.freeze({ verdict: 'unknown', score: 0 });

const cache = new Map();
const flaggedByTab = new Map();

chrome.runtime.onInstalled.addListener(async () => {
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      id: MENU_ID,
      title: 'Check link with Trust Issues / افحص الرابط',
      contexts: ['link'],
    });
  });
  await chrome.storage.sync.set(await chrome.storage.sync.get(DEFAULTS));
});

chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'sync' && changes.apiBase) cache.clear();
});

chrome.tabs.onRemoved.addListener((tabId) => flaggedByTab.delete(tabId));

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId !== MENU_ID || !info.linkUrl) return;
  try {
    await openDeepScan(info.linkUrl, tab);
  } catch {
    await flashError(tab?.id);
  }
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  const handler = handlers[message?.type];
  if (!handler) return false;
  handler(message, sender).then(
    (result) => sendResponse({ ok: true, ...result }),
    (error) => sendResponse({ ok: false, error: String(error?.message || error) }),
  );
  return true;
});

const handlers = {
  async check({ urls }) {
    const list = Array.isArray(urls) ? urls.filter((u) => typeof u === 'string' && u).slice(0, 1000) : [];
    return { results: await lookup(list) };
  },

  async deepScan({ url }, sender) {
    if (typeof url !== 'string' || !url) throw new Error('Missing link');
    return openDeepScan(url, sender.tab);
  },

  async stats({ flagged }, sender) {
    const tabId = sender.tab?.id;
    if (tabId == null) return {};
    const count = Math.max(0, Math.floor(Number(flagged) || 0));
    flaggedByTab.set(tabId, count);
    await paintActionBadge(tabId, count);
    return {};
  },
};

async function lookup(urls) {
  const now = Date.now();
  const missing = [...new Set(urls)].filter((u) => !(cache.get(u)?.at > now - CACHE_TTL));
  for (let i = 0; i < missing.length; i += BATCH) {
    const chunk = missing.slice(i, i + BATCH);
    const data = await checkUrls(chunk);
    const items = Array.isArray(data?.items) ? data.items : [];
    chunk.forEach((url, index) => remember(url, items[index] || { url, ...UNKNOWN }, now));
  }
  return Object.fromEntries(urls.map((url) => [url, cache.get(url)?.item || { url, ...UNKNOWN }]));
}

function remember(url, item, at) {
  cache.delete(url);
  cache.set(url, { item, at });
  while (cache.size > CACHE_LIMIT) cache.delete(cache.keys().next().value);
}

async function openDeepScan(url, tab) {
  const { id, page } = await startDeepScan(unwrapRedirect(url));
  await chrome.tabs.create({
    url: page,
    index: tab && tab.index >= 0 ? tab.index + 1 : undefined,
    openerTabId: tab && tab.id >= 0 ? tab.id : undefined,
  });
  return { id, page };
}

async function paintActionBadge(tabId, count) {
  try {
    await chrome.action.setBadgeBackgroundColor({ tabId, color: '#DC2626' });
    await chrome.action.setBadgeTextColor({ tabId, color: '#FFFFFF' });
    await chrome.action.setBadgeText({ tabId, text: count ? String(Math.min(count, 99)) : '' });
    await chrome.action.setTitle({
      tabId,
      title: count
        ? `Trust Issues: ${count} flagged link${count === 1 ? '' : 's'} on this page`
        : 'Trust Issues: check this page',
    });
  } catch {
    flaggedByTab.delete(tabId);
  }
}

async function flashError(tabId) {
  if (tabId == null || tabId < 0) return;
  try {
    await chrome.action.setBadgeBackgroundColor({ tabId, color: '#F59E0B' });
    await chrome.action.setBadgeText({ tabId, text: '!' });
    await chrome.action.setTitle({ tabId, title: "Trust Issues: can't reach the server. Check the backend URL in Settings." });
  } catch {
    return;
  }
  setTimeout(() => paintActionBadge(tabId, flaggedByTab.get(tabId) || 0), 6000);
}
