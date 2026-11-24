(() => {
  if (globalThis.TrustIssues) return;

  const FONT =
    '"Inter", "IBM Plex Sans Arabic", ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, "Geeza Pro", "Noto Sans Arabic", Tahoma, sans-serif';
  const AR_FONT =
    '"IBM Plex Sans Arabic", "Geeza Pro", "Noto Sans Arabic", "Segoe UI", Tahoma, system-ui, -apple-system, sans-serif';
  const MONO = 'ui-monospace, "SF Mono", "Cascadia Mono", Menlo, Consolas, monospace';
  const SVG_NS = 'http://www.w3.org/2000/svg';
  const SHIELD = 'M12 2.2 4.2 5.1v6.1c0 5 3.3 9.3 7.8 10.6 4.5-1.3 7.8-5.6 7.8-10.6V5.1L12 2.2z';
  const GLYPHS = {
    official: 'M8.4 12.3l2.5 2.5 4.8-5.1',
    suspicious: 'M12 7.8v5M12 16.2v.1',
    scam: 'M9.4 9.4l5.2 5.2M14.6 9.4l-5.2 5.2',
  };

  const GOOGLE_HOST = /(^|\.)google\.(com?\.)?[a-z]{2,3}$/i;
  const GOOGLE_HOSTED = /^(sites|docs|forms|drive|script)\.google\./i;
  const AD_REDIRECT_HOST = /(^|\.)googleadservices\.com$/i;
  const INFRA_HOST =
    /(^|\.)(gstatic\.com|googleusercontent\.com|googlesyndication\.com|doubleclick\.net|ggpht\.com|whatsapp\.net)$|^web\.whatsapp\.com$/i;

  const LABELS = {
    official: { en: 'Official', ar: 'رسمي' },
    suspicious: { en: 'Suspicious', ar: 'مشبوه' },
    scam: { en: 'Scam', ar: 'احتيال' },
    phone: { en: 'Verify this number', ar: 'تحقّق من هذا الرقم' },
  };

  const COPY = {
    titleScam: ['Warning: scam website', 'تحذير: موقع احتيالي'],
    titleSuspicious: ['Warning: suspicious website', 'تحذير: موقع مشبوه'],
    kicker: ['Trust Issues stopped this link', 'أوقفت «أزمة ثقة» هذا الرابط'],
    domain: ['Domain', 'النطاق'],
    risk: ['Risk', 'الخطورة'],
    officialSite: ['Looking for the real site?', 'تبحث عن الموقع الحقيقي؟'],
    back: ['Go back', 'رجوع'],
    analyze: ['Full analysis', 'التحليل الكامل'],
    proceed: ['Proceed anyway', 'المتابعة على أي حال'],
    starting: ['Starting a deep scan…', 'جارٍ بدء الفحص المعمّق…'],
    opened: ['Full analysis opened in a new tab', 'فُتح التحليل الكامل في علامة تبويب جديدة'],
    failed: ["Couldn't reach the Trust Issues server", 'تعذّر الوصول إلى خادم «أزمة ثقة»'],
    phoneHint: [
      'The website on this listing is flagged. Only call numbers published on the official website.',
      'موقع هذا النشاط مُصنَّف كمشبوه. اتصل فقط بالأرقام المنشورة على الموقع الرسمي.',
    ],
  };

  let lang = 'both';
  let adapter = null;
  let observer = null;
  let timer = 0;
  let running = false;
  let again = false;
  let pausedUntil = 0;
  let backoff = 0;
  let lastFlagged = -1;
  let warning = null;

  const cache = new Map();
  const entries = new WeakMap();
  const hosts = new WeakMap();
  const painted = new Map();
  const watched = new Set();
  const allowed = new WeakSet();

  function alive() {
    try {
      return Boolean(chrome.runtime?.id);
    } catch {
      return false;
    }
  }

  function send(message) {
    return new Promise((resolve) => {
      if (!alive()) return resolve(null);
      try {
        chrome.runtime.sendMessage(message, (response) => {
          resolve(chrome.runtime.lastError ? null : response || null);
        });
      } catch {
        resolve(null);
      }
    });
  }

  function h(tag, attrs, ...children) {
    const node = document.createElement(tag);
    for (const [key, value] of Object.entries(attrs || {})) {
      if (value != null && value !== false) node.setAttribute(key, value === true ? '' : String(value));
    }
    node.append(...children.flat(Infinity).filter((c) => c != null && c !== false && c !== ''));
    return node;
  }

  function svg(tag, attrs, ...children) {
    const node = document.createElementNS(SVG_NS, tag);
    for (const [key, value] of Object.entries(attrs || {})) node.setAttribute(key, String(value));
    node.append(...children);
    return node;
  }

  function shieldIcon(tone, size = 14) {
    return svg(
      'svg',
      { viewBox: '0 0 24 24', width: size, height: size, 'aria-hidden': 'true', class: 'icon' },
      svg('path', { d: SHIELD, fill: 'currentColor' }),
      svg('path', {
        d: GLYPHS[tone] || GLYPHS.suspicious,
        fill: 'none',
        stroke: '#fff',
        'stroke-width': '2.3',
        'stroke-linecap': 'round',
        'stroke-linejoin': 'round',
      }),
    );
  }

  function bi(en, ar, sep = '·') {
    const parts = [];
    if (lang !== 'ar' && en) parts.push(h('bdi', { lang: 'en', dir: 'ltr' }, en));
    if (lang === 'both' && en && ar) parts.push(h('span', { class: 'sep', 'aria-hidden': 'true' }, sep));
    if (lang !== 'en' && ar) parts.push(h('bdi', { lang: 'ar', dir: 'rtl' }, ar));
    return parts;
  }

  function pickText(en, ar) {
    return [lang !== 'ar' ? en : '', lang !== 'en' ? ar : ''].filter(Boolean).join('\n');
  }

  function short(text) {
    return String(text || '').split(' — ')[0].trim();
  }

  function resolveUrl(raw) {
    if (!raw) return null;
    let url;
    try {
      url = new URL(raw, location.href);
    } catch {
      return null;
    }
    for (let hop = 0; hop < 3; hop += 1) {
      const isRedirect =
        (GOOGLE_HOST.test(url.hostname) && (url.pathname === '/url' || url.pathname === '/aclk')) ||
        AD_REDIRECT_HOST.test(url.hostname);
      if (!isRedirect) break;
      const inner = url.searchParams.get('q') || url.searchParams.get('url') || url.searchParams.get('adurl');
      if (!inner) return null;
      try {
        url = new URL(inner);
      } catch {
        return null;
      }
    }
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
    const host = url.hostname;
    if (INFRA_HOST.test(host) || AD_REDIRECT_HOST.test(host)) return null;
    if (GOOGLE_HOST.test(host) && !GOOGLE_HOSTED.test(host)) return null;
    url.hash = '';
    return url.href;
  }

  function kindOf(result) {
    if (!result) return null;
    if (result.official) return 'official';
    if (result.verdict === 'scam' || result.verdict === 'suspicious') return result.verdict;
    return null;
  }

  function shouldBlock(result) {
    return Boolean(
      result && !result.official && (result.verdict === 'scam' || (result.verdict === 'suspicious' && result.score >= 60)),
    );
  }

  const BADGE_CSS = `
    :host { all: initial; display: inline-block; vertical-align: middle; margin-inline-start: 6px; max-width: 100%; line-height: 0; }
    :host([data-display="block"]) { display: block; width: fit-content; margin: 6px 0 2px; }
    .chip { display: inline-flex; align-items: center; gap: 5px; box-sizing: border-box; max-width: 100%; padding: 2px 9px 2px 5px;
      border: 1px solid; border-radius: 999px; font: 600 12px/18px ${FONT}; letter-spacing: 0; white-space: nowrap; cursor: help;
      user-select: none; -webkit-font-smoothing: antialiased; }
    .icon { flex: none; }
    .label, .detail { display: inline-flex; align-items: center; gap: 4px; min-width: 0; }
    .detail { font-weight: 500; overflow: hidden; padding-inline-start: 7px; margin-inline-start: 2px; border-inline-start: 1px solid rgb(0 0 0 / 0.14); }
    .detail bdi { overflow: hidden; text-overflow: ellipsis; }
    .sep { opacity: 0.5; }
    [lang="ar"] { font-family: ${AR_FONT}; font-size: 12.5px; }
    .official { background: #ecfdf5; border-color: #a7f3d0; color: #065f46; }
    .official .icon { color: #059669; }
    .suspicious { background: #fffbeb; border-color: #fcd34d; color: #92400e; }
    .suspicious .icon { color: #d97706; }
    .scam { background: #fef2f2; border-color: #fca5a5; color: #991b1b; }
    .scam .icon { color: #dc2626; }
  `;

  function detailFor(kind, result) {
    const brand = result.brand;
    if (!brand) return null;
    if (kind === 'official') return [brand.name_en, brand.name_ar];
    if (kind === 'scam') return [short(result.headline?.en), short(result.headline?.ar)];
    if (kind === 'suspicious') return [`Imitates ${brand.name_en}`, `ينتحل صفة ${brand.name_ar}`];
    return null;
  }

  function tooltipFor(kind, result) {
    if (kind === 'phone') {
      return [pickText(COPY.phoneHint[0], COPY.phoneHint[1]), pickText(result.headline?.en, result.headline?.ar)]
        .filter(Boolean)
        .join('\n');
    }
    const lines = [pickText(result.headline?.en, result.headline?.ar)];
    if (kind !== 'official') lines.push(pickText(`Risk ${result.score}/100`, `الخطورة ${result.score}/100`));
    lines.push('Trust Issues | أزمة ثقة');
    return lines.filter(Boolean).join('\n');
  }

  function makeHost() {
    const host = document.createElement('span');
    host.setAttribute('data-trust-issues', 'badge');
    const root = host.attachShadow({ mode: 'open' });
    root.append(h('style', null, BADGE_CSS), h('span', { class: 'chip', role: 'note' }));
    return host;
  }

  function paint(host) {
    const info = painted.get(host);
    if (!info) return;
    const { kind, result } = info;
    const tone = kind === 'phone' ? (result.verdict === 'scam' ? 'scam' : 'suspicious') : kind;
    const label = LABELS[kind];
    const detail = detailFor(kind, result);
    const chip = host.shadowRoot.querySelector('.chip');
    chip.className = `chip ${tone}`;
    chip.title = tooltipFor(kind, result);
    chip.replaceChildren(
      shieldIcon(tone),
      h('span', { class: 'label' }, bi(label.en, label.ar)),
      detail ? h('span', { class: 'detail' }, bi(detail[0], detail[1])) : null,
    );
    info.lang = lang;
  }

  function badge(el, place, result, options = {}) {
    const kind = options.kind || kindOf(result);
    if (!kind) {
      unbadge(el);
      return;
    }
    let host = hosts.get(el);
    if (!host || !host.isConnected) {
      host = makeHost();
      try {
        place(host);
      } catch {
        return;
      }
      if (!host.isConnected) return;
      hosts.set(el, host);
    }
    const previous = painted.get(host);
    if (previous && previous.result === result && previous.kind === kind && previous.lang === lang) return;
    painted.set(host, { el, source: options.source || el, result, kind, lang: null });
    paint(host);
  }

  function unbadge(el) {
    const host = hosts.get(el);
    if (!host) return;
    painted.delete(host);
    hosts.delete(el);
    host.remove();
  }

  function repaintAll() {
    for (const host of [...painted.keys()]) {
      if (host.isConnected) paint(host);
      else painted.delete(host);
    }
  }

  async function pass() {
    if (running) {
      again = true;
      return;
    }
    if (!alive()) {
      observer?.disconnect();
      return;
    }
    if (Date.now() < pausedUntil) return;
    running = true;
    try {
      const fresh = [];
      for (const item of adapter.collect()) {
        const url = resolveUrl(item.href);
        if (!url) continue;
        const previous = entries.get(item.el);
        if (previous && previous.url === url) continue;
        if (previous) unbadge(item.el);
        const entry = { url, result: null };
        entries.set(item.el, entry);
        watched.add(item.el);
        fresh.push({ el: item.el, place: item.place, entry });
      }
      if (fresh.length) await resolveFresh(fresh);
      adapter.afterFlush?.(api);
      reportStats();
    } finally {
      running = false;
      if (again) {
        again = false;
        schedule();
      }
    }
  }

  async function resolveFresh(fresh) {
    const missing = [...new Set(fresh.map((f) => f.entry.url))].filter((u) => !cache.has(u));
    if (missing.length) {
      const response = await send({ type: 'check', urls: missing });
      if (response?.ok && response.results) {
        backoff = 0;
        for (const url of missing) cache.set(url, response.results[url] || { url, verdict: 'unknown', score: 0 });
      } else {
        for (const f of fresh) {
          if (!cache.has(f.entry.url)) {
            entries.delete(f.el);
            watched.delete(f.el);
          }
        }
        backoff = Math.min(backoff ? backoff * 2 : 5000, 60000);
        pausedUntil = Date.now() + backoff;
        setTimeout(() => schedule(0), backoff + 50);
      }
    }
    for (const f of fresh) {
      const result = cache.get(f.entry.url);
      if (!result) continue;
      f.entry.result = result;
      if (f.place) badge(f.el, f.place, result);
    }
  }

  function reportStats() {
    const flagged = new Set();
    for (const el of watched) {
      if (!el.isConnected) {
        watched.delete(el);
        continue;
      }
      const entry = entries.get(el);
      const kind = kindOf(entry?.result);
      if (kind === 'scam' || kind === 'suspicious') flagged.add(entry.url);
    }
    if (flagged.size !== lastFlagged) {
      lastFlagged = flagged.size;
      send({ type: 'stats', flagged: flagged.size });
    }
  }

  function schedule(delay = 350) {
    if (timer) return;
    timer = setTimeout(() => {
      timer = 0;
      pass();
    }, delay);
  }

  function halt(event) {
    event.preventDefault();
    event.stopImmediatePropagation();
  }

  function onClick(event) {
    if (event.type === 'auxclick' && event.button !== 1) return;
    if (event.type === 'click' && event.button !== 0) return;
    const target = event.target instanceof Element ? event.target : null;
    if (!target || target.closest('[data-trust-issues="warning"]')) return;
    const host = target.closest('[data-trust-issues="badge"]');
    if (host) {
      const info = painted.get(host);
      const source = info && entries.get(info.source);
      if (info && info.kind !== 'official' && source?.result) {
        halt(event);
        showWarning(info.source, source.url, source.result);
      }
      return;
    }
    const anchor = target.closest('a[href]');
    if (!anchor || allowed.has(anchor)) return;
    const entry = entries.get(anchor);
    if (!entry || !shouldBlock(entry.result)) return;
    halt(event);
    showWarning(anchor, entry.url, entry.result);
  }

  const WARNING_CSS = `
    :host { all: initial; position: fixed; inset: 0; z-index: 2147483647; display: block; }
    * { box-sizing: border-box; }
    .backdrop { position: fixed; inset: 0; overflow-y: auto; display: grid; place-items: center; padding: 24px 16px;
      background: radial-gradient(1100px 520px at 50% -8%, var(--glow), transparent 62%), rgb(7 12 23 / 0.94);
      -webkit-backdrop-filter: blur(6px); backdrop-filter: blur(6px); font-family: ${FONT}; color: #edf2f9;
      -webkit-font-smoothing: antialiased; animation: fade 0.18s ease-out; }
    .scam { --accent: #f87171; --accent-solid: #ef4444; --glow: rgb(239 68 68 / 0.24); --tint: rgb(239 68 68 / 0.12); }
    .suspicious { --accent: #fbbf24; --accent-solid: #f59e0b; --glow: rgb(245 158 11 / 0.22); --tint: rgb(245 158 11 / 0.12); }
    .panel { width: min(900px, 100%); background: #0e1627; border: 1px solid #22304d; border-radius: 22px; overflow: hidden;
      box-shadow: 0 30px 80px rgb(0 0 0 / 0.55); animation: rise 0.22s ease-out; }
    .band { height: 4px; background: linear-gradient(90deg, var(--accent-solid), #f97316); }
    .head { display: flex; align-items: center; justify-content: space-between; gap: 16px; padding: 22px 32px 0; }
    .alert { width: 56px; height: 56px; border-radius: 16px; display: grid; place-items: center; background: var(--tint); color: var(--accent-solid); }
    .mark { display: inline-flex; align-items: center; gap: 8px; font-size: 13px; font-weight: 600; color: #95a3bd; }
    .mark .icon { color: #14b8a6; }
    .cols { display: grid; grid-template-columns: 1fr 1px 1fr; gap: 32px; padding: 18px 32px 6px; }
    .cols.single { grid-template-columns: 1fr; }
    .rule { background: #22304d; }
    .col[lang="ar"] { font-family: ${AR_FONT}; text-align: right; }
    .kicker { margin: 0 0 8px; font-size: 12px; font-weight: 700; letter-spacing: 0.06em; text-transform: uppercase; color: #7d8ba6; }
    .col[lang="ar"] .kicker { letter-spacing: 0; font-size: 13px; }
    h1 { margin: 0 0 12px; font-size: 30px; line-height: 1.2; font-weight: 800; color: var(--accent); }
    .col[lang="ar"] h1 { font-size: 32px; line-height: 1.35; }
    .headline { margin: 0 0 12px; font-size: 16px; line-height: 1.55; font-weight: 600; color: #edf2f9; }
    .col[lang="ar"] .headline { font-size: 17px; }
    ul { list-style: none; margin: 0; padding: 0; display: grid; gap: 6px; }
    li { position: relative; padding-inline-start: 16px; font-size: 14px; line-height: 1.5; color: #b4bfd3; }
    li::before { content: ""; position: absolute; inset-inline-start: 0; top: 0.6em; width: 6px; height: 6px; border-radius: 50%; background: var(--accent-solid); }
    .meta { margin: 18px 32px 0; padding: 14px 18px; border-radius: 14px; background: #0b1220; border: 1px solid #1a2742;
      display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 10px 24px; }
    .meta-label { display: block; margin-bottom: 4px; font-size: 12px; color: #7d8ba6; }
    .meta-label [lang="ar"], .hint [lang="ar"], button [lang="ar"] { font-family: ${AR_FONT}; }
    code { font: 600 15px/1.35 ${MONO}; color: var(--accent); word-break: break-all; }
    .score { display: inline-flex; align-items: baseline; gap: 4px; padding: 6px 12px; border-radius: 999px; background: var(--tint);
      color: var(--accent); font-weight: 800; font-size: 18px; white-space: nowrap; }
    .score small { font-size: 12px; font-weight: 600; opacity: 0.8; }
    .hint { margin: 12px 32px 0; font-size: 14px; color: #b4bfd3; display: flex; flex-wrap: wrap; gap: 6px; align-items: center; }
    .hint a { color: #2dd4bf; font-weight: 700; text-decoration: none; font-family: ${MONO}; }
    .hint a:hover { text-decoration: underline; }
    .actions { display: flex; flex-wrap: wrap; gap: 12px; padding: 24px 32px 6px; }
    button { font: inherit; cursor: pointer; min-height: 50px; padding: 0 22px; border-radius: 12px; font-size: 15px; font-weight: 700;
      display: inline-flex; align-items: center; justify-content: center; gap: 8px; transition: background-color 0.15s, border-color 0.15s; }
    .primary { flex: 1 1 240px; border: 0; background: #14b8a6; color: #042f2b; }
    .primary:hover { background: #2dd4bf; }
    .secondary { flex: 1 1 240px; border: 1px solid #33456b; background: transparent; color: #edf2f9; }
    .secondary:hover { border-color: #95a3bd; background: #111a2e; }
    .secondary[disabled] { opacity: 0.6; cursor: progress; }
    .sep { opacity: 0.45; }
    .proceed { display: flex; margin: 4px auto 0; min-height: 36px; padding: 0 12px; border: 0; background: none; color: #7d8ba6;
      font-size: 13px; font-weight: 500; text-decoration: underline; text-underline-offset: 3px; }
    .proceed:hover { color: #b4bfd3; }
    .status { min-height: 20px; margin: 4px 32px 18px; text-align: center; font-size: 13px; color: #95a3bd; }
    :focus-visible { outline: 2px solid #2dd4bf; outline-offset: 3px; }
    @media (max-width: 720px) {
      .cols { grid-template-columns: 1fr; gap: 18px; }
      .rule { height: 1px; }
      .head, .cols, .actions { padding-left: 20px; padding-right: 20px; }
      .meta, .hint, .status { margin-left: 20px; margin-right: 20px; }
      h1, .col[lang="ar"] h1 { font-size: 25px; }
    }
    @media (prefers-reduced-motion: reduce) { .backdrop, .panel { animation: none; } }
    @keyframes fade { from { opacity: 0; } }
    @keyframes rise { from { opacity: 0; transform: translateY(14px) scale(0.98); } }
  `;

  function column(code, tone, result) {
    const index = code === 'en' ? 0 : 1;
    const title = tone === 'scam' ? COPY.titleScam : COPY.titleSuspicious;
    const reasons = (Array.isArray(result.reasons) ? result.reasons : []).slice(0, 3);
    return h(
      'section',
      { class: 'col', lang: code, dir: code === 'ar' ? 'rtl' : 'ltr' },
      h('p', { class: 'kicker' }, COPY.kicker[index]),
      h('h1', { id: `ti-title-${code}` }, title[index]),
      h('p', { class: 'headline' }, result.headline?.[code] || ''),
      reasons.length ? h('ul', null, reasons.map((r) => h('li', null, r[code] || ''))) : null,
    );
  }

  function showWarning(el, url, result) {
    closeWarning(false);
    const tone = result.verdict === 'scam' ? 'scam' : 'suspicious';
    let hostname = url;
    try {
      hostname = new URL(url).hostname;
    } catch {
      hostname = url;
    }
    const languages = lang === 'both' ? ['en', 'ar'] : [lang];
    const cols = h(
      'div',
      { class: `cols${languages.length === 1 ? ' single' : ''}` },
      languages.map((code, i) => [i ? h('div', { class: 'rule', 'aria-hidden': 'true' }) : null, column(code, tone, result)]),
    );
    const officialDomain = result.brand?.official_domains?.[0];
    const hint = officialDomain
      ? h(
          'p',
          { class: 'hint' },
          bi(COPY.officialSite[0], COPY.officialSite[1]),
          h('a', { href: `https://${officialDomain}`, target: '_blank', rel: 'noopener noreferrer', dir: 'ltr' }, `${officialDomain} ↗`),
        )
      : null;
    const back = h('button', { type: 'button', class: 'primary', 'data-act': 'back' }, bi(COPY.back[0], COPY.back[1]));
    const analyze = h('button', { type: 'button', class: 'secondary', 'data-act': 'analyze' }, bi(COPY.analyze[0], COPY.analyze[1]));
    const proceed = h('button', { type: 'button', class: 'proceed', 'data-act': 'proceed' }, bi(COPY.proceed[0], COPY.proceed[1]));
    const status = h('p', { class: 'status', role: 'status', 'aria-live': 'polite' });

    const panel = h(
      'div',
      {
        class: 'panel',
        role: 'alertdialog',
        'aria-modal': 'true',
        'aria-labelledby': languages.map((c) => `ti-title-${c}`).join(' '),
      },
      h('div', { class: 'band', 'aria-hidden': 'true' }),
      h(
        'div',
        { class: 'head' },
        h('div', { class: 'alert', 'aria-hidden': 'true' }, shieldIcon(tone, 34)),
        h('span', { class: 'mark' }, shieldIcon('official', 16), 'Trust Issues | ', h('bdi', { lang: 'ar' }, 'أزمة ثقة')),
      ),
      cols,
      h(
        'div',
        { class: 'meta' },
        h('div', null, h('span', { class: 'meta-label' }, bi(COPY.domain[0], COPY.domain[1])), h('code', { dir: 'ltr' }, hostname)),
        h(
          'div',
          { class: 'score', title: pickText(COPY.risk[0], COPY.risk[1]) },
          String(Math.round(Number(result.score) || 0)),
          h('small', null, '/100'),
        ),
      ),
      hint,
      h('div', { class: 'actions' }, back, analyze),
      proceed,
      status,
    );

    const host = document.createElement('div');
    host.setAttribute('data-trust-issues', 'warning');
    const root = host.attachShadow({ mode: 'closed' });
    root.append(h('style', null, WARNING_CSS), h('div', { class: `backdrop ${tone}` }, panel));

    const setStatus = (pair) => status.replaceChildren(...bi(pair[0], pair[1]));

    back.addEventListener('click', () => closeWarning(true));
    proceed.addEventListener('click', () => {
      allowed.add(el);
      closeWarning(false);
      if (el.isConnected && el.matches('a[href]')) el.click();
      else window.open(url, '_blank', 'noopener,noreferrer');
    });
    analyze.addEventListener('click', async () => {
      analyze.disabled = true;
      setStatus(COPY.starting);
      const response = await send({ type: 'deepScan', url });
      analyze.disabled = false;
      setStatus(response?.ok ? COPY.opened : COPY.failed);
    });
    root.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        closeWarning(true);
      } else if (event.key === 'Tab') {
        const focusable = [...root.querySelectorAll('button:not([disabled]), a[href]')];
        const index = focusable.indexOf(root.activeElement);
        if (event.shiftKey && index <= 0) {
          event.preventDefault();
          focusable.at(-1).focus();
        } else if (!event.shiftKey && index === focusable.length - 1) {
          event.preventDefault();
          focusable[0].focus();
        }
      }
    });
    host.addEventListener('keydown', (event) => event.stopPropagation());

    const docEl = document.documentElement;
    warning = { host, el, overflow: docEl.style.overflow, focus: document.activeElement };
    docEl.style.overflow = 'hidden';
    docEl.append(host);
    requestAnimationFrame(() => back.focus());
  }

  function closeWarning(restoreFocus) {
    if (!warning) return;
    const { host, overflow, focus } = warning;
    warning = null;
    host.remove();
    document.documentElement.style.overflow = overflow;
    if (restoreFocus && focus instanceof HTMLElement && focus.isConnected) focus.focus({ preventScroll: true });
  }

  const api = {
    resultFor: (el) => entries.get(el)?.result || null,
    badge,
    unbadge,
  };

  function start(definition) {
    if (adapter) return;
    adapter = definition;
    window.addEventListener('click', onClick, true);
    window.addEventListener('auxclick', onClick, true);
    chrome.storage.sync.get({ lang: 'both' }, (settings) => {
      lang = ['both', 'en', 'ar'].includes(settings?.lang) ? settings.lang : 'both';
      schedule(0);
    });
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area !== 'sync') return;
      if (changes.lang) {
        lang = ['both', 'en', 'ar'].includes(changes.lang.newValue) ? changes.lang.newValue : 'both';
        repaintAll();
      }
      if (changes.apiBase) {
        cache.clear();
        pausedUntil = 0;
        backoff = 0;
      }
    });
    observer = new MutationObserver(() => schedule());
    observer.observe(document.documentElement, { childList: true, subtree: true });
  }

  globalThis.TrustIssues = Object.freeze({ start });
})();
