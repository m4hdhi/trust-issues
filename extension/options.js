import { DEFAULTS, getSettings, health, normalizeBase } from './lib/api.js';

const form = document.getElementById('server-form');
const input = document.getElementById('api-base');
const testButton = document.getElementById('test');
const resetButton = document.getElementById('reset');
const serverStatus = document.getElementById('server-status');
const langStatus = document.getElementById('lang-status');

let langTimer = 0;

init();

async function init() {
  const settings = await getSettings();
  input.value = settings.apiBase;
  const radio = document.querySelector(`input[name="lang"][value="${settings.lang}"]`);
  if (radio) radio.checked = true;
}

function setStatus(node, text, tone) {
  node.textContent = text;
  if (tone) node.dataset.tone = tone;
  else delete node.dataset.tone;
}

function readBase() {
  const base = normalizeBase(input.value);
  input.setAttribute('aria-invalid', base ? 'false' : 'true');
  if (!base) setStatus(serverStatus, 'Enter a valid http(s) URL, e.g. http://localhost:8000 · أدخل رابطاً صالحاً', 'error');
  return base;
}

testButton.addEventListener('click', async () => {
  const base = readBase();
  if (!base) return;
  testButton.disabled = true;
  setStatus(serverStatus, `Connecting to ${base}…`);
  try {
    const data = await health(base);
    if (!data?.ok) throw new Error('The server responded, but is not healthy');
    const brands = Number(data.brands) || 0;
    const hosts = Number(data.feeds?.hosts) || 0;
    setStatus(
      serverStatus,
      `Connected: ${brands.toLocaleString('en')} protected brands, ${hosts.toLocaleString('en')} known scam hosts · متصل`,
      'ok',
    );
  } catch (error) {
    setStatus(serverStatus, `${error.message} · تعذّر الاتصال`, 'error');
  } finally {
    testButton.disabled = false;
  }
});

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  const base = readBase();
  if (!base) return;
  input.value = base;
  await chrome.storage.sync.set({ apiBase: base });
  setStatus(serverStatus, 'Saved · تم الحفظ', 'ok');
});

resetButton.addEventListener('click', async () => {
  input.value = DEFAULTS.apiBase;
  input.setAttribute('aria-invalid', 'false');
  await chrome.storage.sync.set({ apiBase: DEFAULTS.apiBase });
  setStatus(serverStatus, `Reset to ${DEFAULTS.apiBase} · تمت الاستعادة`, 'ok');
});

input.addEventListener('input', () => {
  input.removeAttribute('aria-invalid');
  setStatus(serverStatus, '');
});

document.querySelectorAll('input[name="lang"]').forEach((radio) => {
  radio.addEventListener('change', async () => {
    if (!radio.checked) return;
    await chrome.storage.sync.set({ lang: radio.value });
    setStatus(langStatus, 'Saved · تم الحفظ', 'ok');
    clearTimeout(langTimer);
    langTimer = setTimeout(() => setStatus(langStatus, ''), 2000);
  });
});
