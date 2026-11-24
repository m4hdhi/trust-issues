import { getSettings, checkUrls, startDeepScan, submitReport, scanPageUrl } from './lib/api.js';

const $ = (id) => document.getElementById(id);

const VERDICTS = {
  official: { en: 'Official website', ar: 'موقع رسمي', tone: 'safe' },
  safe: { en: 'No red flags found', ar: 'لا توجد مؤشرات خطر', tone: 'safe' },
  suspicious: { en: 'Suspicious', ar: 'مشبوه', tone: 'warn' },
  scam: { en: 'Scam', ar: 'احتيال', tone: 'scam' },
  unknown: { en: 'Not enough data', ar: 'لا تتوفر بيانات كافية', tone: 'unknown' },
};

const REPORT_STATUS = {
  official: ['This is an official site. Your report was still logged.', 'هذا موقع رسمي، وتم تسجيل بلاغك.'],
  confirmed: ['Confirmed scam. Thank you for reporting it.', 'احتيال مؤكَّد. شكراً على بلاغك.'],
  pending: ['Report received. A deep scan is now running.', 'تم استلام البلاغ، ويجري الآن فحص معمّق.'],
};

let settings;
let tab;
let pageUrl = '';

$('open-settings').addEventListener('click', () => chrome.runtime.openOptionsPage());
$('settings-link').addEventListener('click', (event) => {
  event.preventDefault();
  chrome.runtime.openOptionsPage();
});
$('deep-scan').addEventListener('click', onDeepScan);
$('report').addEventListener('click', onReport);

init();

async function init() {
  settings = await getSettings();
  document.body.dataset.lang = settings.lang;
  if (settings.lang === 'ar') {
    document.documentElement.lang = 'ar';
    document.documentElement.dir = 'rtl';
  }
  [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  pageUrl = tab?.url || '';

  if (!/^https?:\/\//i.test(pageUrl)) {
    showMessage(['Open a website to check it.', 'افتح موقعاً إلكترونياً لفحصه.'], '');
    return;
  }

  $('host').textContent = new URL(pageUrl).hostname;
  try {
    const data = await checkUrls([pageUrl], settings.apiBase);
    render(data?.items?.[0] || { verdict: 'unknown', score: 0 });
  } catch (error) {
    showMessage(["Can't reach the Trust Issues server.", 'تعذّر الوصول إلى خادم «أزمة ثقة».'], error.message);
  }
}

function bilingual(target, en, ar, separator) {
  const nodes = [];
  if (en) nodes.push(span('en', en));
  if (separator && en && ar) nodes.push(span('sep en', separator));
  if (ar) nodes.push(span('ar', ar, true));
  target.replaceChildren(...nodes);
}

function span(className, text, arabic = false) {
  const node = document.createElement('span');
  node.className = className;
  node.textContent = text;
  if (arabic) {
    node.lang = 'ar';
    node.dir = 'rtl';
  }
  return node;
}

function render(item) {
  const key = item.official ? 'official' : VERDICTS[item.verdict] ? item.verdict : 'unknown';
  const verdict = VERDICTS[key];
  const score = Math.max(0, Math.min(100, Math.round(Number(item.score) || 0)));

  document.body.dataset.tone = verdict.tone;
  $('loading').hidden = true;
  $('result').hidden = false;
  $('actions').hidden = false;
  $('report').hidden = key === 'official';

  $('score').textContent = String(score);
  requestAnimationFrame(() => {
    $('arc').style.strokeDasharray = `${Math.max(score, 1)} 100`;
  });

  const pill = $('verdict');
  const dot = document.createElement('span');
  dot.className = 'dot';
  bilingual(pill, verdict.en, verdict.ar, '·');
  pill.prepend(dot);

  const brand = item.brand;
  $('brand').hidden = !brand;
  if (brand) {
    $('brand-en').textContent = brand.name_en || '';
    $('brand-ar').textContent = brand.name_ar || '';
    const logo = $('brand-logo');
    if (brand.logo_url) {
      logo.hidden = false;
      logo.onerror = () => {
        logo.hidden = true;
      };
      logo.src = new URL(brand.logo_url, `${settings.apiBase}/`).href;
    } else {
      logo.hidden = true;
    }
  }

  $('headline-en').textContent = item.headline?.en || '';
  $('headline-ar').textContent = item.headline?.ar || '';

  const reasons = Array.isArray(item.reasons) ? item.reasons : [];
  const list = $('reasons');
  list.hidden = reasons.length === 0;
  list.replaceChildren(
    ...reasons.slice(0, 4).map((reason) => {
      const li = document.createElement('li');
      li.append(span('en', reason.en || ''), span('ar', reason.ar || '', true));
      return li;
    }),
  );
}

function showMessage([en, ar], detail) {
  document.body.dataset.tone = 'unknown';
  $('loading').hidden = true;
  $('result').hidden = true;
  $('actions').hidden = true;
  $('message').hidden = false;
  $('message-en').textContent = en;
  $('message-ar').textContent = ar;
  $('message-detail').textContent = detail || '';
}

function setStatus([en, ar], link) {
  const status = $('status');
  status.replaceChildren(span('en', en), document.createTextNode(' '), span('ar', ar, true));
  if (link) {
    const a = document.createElement('a');
    a.href = link.href;
    a.target = '_blank';
    a.rel = 'noopener';
    a.append(span('en', link.en), document.createTextNode(' '), span('ar', link.ar, true));
    status.append(a);
  }
}

function setBusy(busy) {
  $('deep-scan').disabled = busy;
  $('report').disabled = busy;
}

async function onDeepScan() {
  setBusy(true);
  setStatus(['Starting a deep scan…', 'جارٍ بدء الفحص المعمّق…']);
  try {
    const { page } = await startDeepScan(pageUrl, settings.apiBase);
    await chrome.tabs.create({ url: page, index: tab.index + 1, openerTabId: tab.id });
    window.close();
  } catch (error) {
    setBusy(false);
    setStatus([`Couldn't start the scan: ${error.message}`, 'تعذّر بدء الفحص.']);
  }
}

async function onReport() {
  setBusy(true);
  setStatus(['Sending report…', 'جارٍ إرسال البلاغ…']);
  try {
    const data = await submitReport(pageUrl, 'Reported from the Trust Issues browser extension', settings.apiBase);
    const message = REPORT_STATUS[data?.status] || REPORT_STATUS.pending;
    const link = data?.scan_id
      ? { href: scanPageUrl(settings.apiBase, data.scan_id), en: 'View analysis', ar: 'عرض التحليل' }
      : null;
    setStatus(message, link);
    $('report').disabled = true;
    $('deep-scan').disabled = false;
  } catch (error) {
    setBusy(false);
    setStatus([`Couldn't send the report: ${error.message}`, 'تعذّر إرسال البلاغ.']);
  }
}
