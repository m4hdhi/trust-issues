"""Sandboxed multi-persona page rendering with Playwright (redirects, cloaking, forms, screenshots)."""
from __future__ import annotations

import asyncio
import base64
import hashlib
import io
import logging
import re
from dataclasses import dataclass, field
from difflib import SequenceMatcher
from typing import Any

import imagehash
import mmh3
from PIL import Image
from playwright.async_api import Browser, Page, Playwright, async_playwright

from ..config import get_settings
from ..urlutil import parse

log = logging.getLogger(__name__)

PERSONAS: dict[str, dict[str, Any]] = {
    "uae_mobile": {
        "user_agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Mobile/15E148 Safari/604.1",
        "viewport": {"width": 390, "height": 844},
        "device_scale_factor": 2,
        "is_mobile": True,
        "has_touch": True,
        "locale": "ar-AE",
        "timezone_id": "Asia/Dubai",
        "extra_http_headers": {"Accept-Language": "ar-AE,ar;q=0.9,en-US;q=0.8,en;q=0.7"},
    },
    "desktop": {
        "user_agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
        "viewport": {"width": 1366, "height": 900},
        "locale": "en-US",
        "timezone_id": "Asia/Dubai",
        "extra_http_headers": {"Accept-Language": "en-US,en;q=0.9"},
    },
    "googlebot": {
        "user_agent": "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)",
        "viewport": {"width": 1366, "height": 900},
        "locale": "en-US",
        "extra_http_headers": {"Accept-Language": "en-US,en;q=0.9"},
    },
}

EXTRACT_JS = r"""
() => {
  const vis = el => { const r = el.getBoundingClientRect(); const s = getComputedStyle(el);
    return r.width > 2 && r.height > 2 && s.visibility !== 'hidden' && s.display !== 'none' && s.opacity !== '0'; };
  const box = el => { const r = el.getBoundingClientRect();
    return {x: r.left + scrollX, y: r.top + scrollY, w: r.width, h: r.height}; };
  const labelFor = el => {
    let t = [el.name, el.id, el.placeholder, el.getAttribute('aria-label'), el.getAttribute('autocomplete'), el.title].join(' ');
    if (el.id) { const l = document.querySelector(`label[for="${CSS.escape(el.id)}"]`); if (l) t += ' ' + l.innerText; }
    const p = el.closest('label'); if (p) t += ' ' + p.innerText;
    const prev = el.previousElementSibling; if (prev && prev.innerText) t += ' ' + prev.innerText.slice(0, 80);
    return t.toLowerCase();
  };
  const inputs = [...document.querySelectorAll('input, select, textarea')].filter(vis).slice(0, 60).map(el => ({
    tag: el.tagName.toLowerCase(), type: (el.type || '').toLowerCase(), text: labelFor(el),
    maxlength: el.maxLength > 0 ? el.maxLength : null, inputmode: el.inputMode || '', box: box(el)
  }));
  const forms = [...document.forms].map(f => ({action: f.action || '', method: (f.method || 'get').toLowerCase()}));
  const imgs = [...document.querySelectorAll('img, svg')].filter(vis).slice(0, 80).map(el => ({
    src: el.currentSrc || el.src || '', alt: (el.alt || el.getAttribute('aria-label') || '').toLowerCase(),
    cls: ((el.className && el.className.baseVal !== undefined ? el.className.baseVal : el.className) || '').toString().toLowerCase(),
    box: box(el)
  })).filter(i => i.box.y < 700 && (/logo|brand|شعار/.test(i.src + i.alt + i.cls) || (i.box.w > 60 && i.box.h > 20 && i.box.y < 260)));
  const urgentRe = /(within\s*\d+\s*(hours|hrs|days)|immediately|suspend|blocked|last chance|final notice|unpaid|overdue|penalty|fine\b|fines\b|خلال\s*\d+|فورا|فوراً|إيقاف|تعليق|حظر|مخالف|غرام|متأخر|آخر فرصة|إشعار نهائي)/i;
  const urgent = [];
  const walker = document.createTreeWalker(document.body || document.documentElement, NodeFilter.SHOW_TEXT);
  while (walker.nextNode() && urgent.length < 4) {
    const n = walker.currentNode; const t = (n.textContent || '').trim();
    if (t.length > 6 && t.length < 220 && urgentRe.test(t) && n.parentElement && vis(n.parentElement))
      urgent.push({text: t.slice(0, 160), box: box(n.parentElement)});
  }
  const icons = [...document.querySelectorAll('link[rel~="icon"], link[rel="apple-touch-icon"], link[rel="shortcut icon"]')].map(l => l.href);
  const tags = [...document.querySelectorAll('body *')].slice(0, 1500).map(e => e.tagName.toLowerCase()).join(' ');
  const scripts = [...document.scripts].map(s => s.src).filter(Boolean).slice(0, 40);
  return {
    title: document.title || '', lang: document.documentElement.lang || '',
    text: (document.body ? document.body.innerText : '').slice(0, 6000),
    inputs, forms, imgs, urgent, icons, tags, scripts,
    width: Math.max(document.documentElement.scrollWidth, innerWidth), height: Math.max(document.documentElement.scrollHeight, innerHeight),
    links: [...document.querySelectorAll('a[href]')].slice(0, 300).map(a => a.href)
  };
}
"""

FIELD_RULES: list[tuple[str, re.Pattern[str]]] = [
    ("cvv", re.compile(r"cvv|cvc|csc|security code|رمز الأمان|الرقم السري للبطاقة|cid\b")),
    ("card", re.compile(r"cc-number|card.?num|cardnumber|credit|debit|رقم البطاقة|البطاقة|بطاقة|\bpan\b|card no")),
    ("expiry", re.compile(r"cc-exp|expir|exp.?date|mm\s*/\s*yy|تاريخ الانتهاء|صلاحية")),
    ("otp", re.compile(r"otp|one.?time|verification code|sms code|رمز التحقق|كلمة المرور لمرة|الرمز المرسل|passcode|\bpin\b")),
    ("emirates_id", re.compile(r"emirates.?id|eid|رقم الهوية|الهوية الإماراتية|784[- ]?")),
    ("password", re.compile(r"password|passwd|كلمة المرور|كلمة السر")),
    ("phone", re.compile(r"phone|mobile|رقم الهاتف|الجوال|المتحرك|tel\b")),
    ("iban", re.compile(r"iban|account number|رقم الحساب|آيبان")),
]

FIELD_LABELS = {
    "card": ("Asks for card number", "يطلب رقم البطاقة"),
    "cvv": ("Asks for card security code (CVV)", "يطلب رمز الأمان CVV"),
    "expiry": ("Asks for card expiry date", "يطلب تاريخ انتهاء البطاقة"),
    "otp": ("Asks for one-time password (OTP)", "يطلب رمز التحقق OTP"),
    "emirates_id": ("Asks for Emirates ID", "يطلب رقم الهوية الإماراتية"),
    "password": ("Asks for a password", "يطلب كلمة المرور"),
    "phone": ("Asks for phone number", "يطلب رقم الهاتف"),
    "iban": ("Asks for bank account / IBAN", "يطلب رقم الحساب البنكي"),
}


@dataclass
class PersonaCapture:
    name: str
    ok: bool = False
    status: int | None = None
    final_url: str | None = None
    title: str = ""
    text: str = ""
    lang: str = ""
    html: str = ""
    tags: str = ""
    hops: list[dict[str, Any]] = field(default_factory=list)
    inputs: list[dict[str, Any]] = field(default_factory=list)
    forms: list[dict[str, Any]] = field(default_factory=list)
    imgs: list[dict[str, Any]] = field(default_factory=list)
    urgent: list[dict[str, Any]] = field(default_factory=list)
    icons: list[str] = field(default_factory=list)
    links: list[str] = field(default_factory=list)
    scripts: dict[str, str] = field(default_factory=dict)
    screenshot_path: str | None = None
    screenshot_url: str | None = None
    width: int = 0
    height: int = 0
    favicon_mmh3: int | None = None
    favicon_phash: str | None = None
    error: str | None = None

    @property
    def dom_hash(self) -> str:
        return hashlib.sha1(self.tags.encode()).hexdigest()[:16]

    def asks_for(self) -> list[str]:
        found: list[str] = []
        for inp in self.inputs:
            kind = classify_input(inp)
            if kind and kind not in found:
                found.append(kind)
        return found


@dataclass
class RenderResult:
    personas: dict[str, PersonaCapture]
    primary: PersonaCapture
    cloaking: bool
    cloaking_reason: tuple[str, str] | None


def classify_input(inp: dict[str, Any]) -> str | None:
    t = inp.get("text", "")
    typ = inp.get("type", "")
    if typ == "password":
        if re.search(r"otp|one.?time|رمز التحقق|pin", t):
            return "otp"
        return "cvv" if re.search(r"cvv|cvc|رمز الأمان", t) else "password"
    if typ in {"hidden", "submit", "button", "checkbox", "radio", "search"}:
        return None
    for kind, rx in FIELD_RULES:
        if rx.search(t):
            return kind
    if typ == "tel":
        return "phone"
    return None


class Sandbox:
    def __init__(self) -> None:
        self._pw: Playwright | None = None
        self._browser: Browser | None = None
        self._lock = asyncio.Lock()
        self._sem = asyncio.Semaphore(4)

    async def browser(self) -> Browser:
        async with self._lock:
            if self._browser is None or not self._browser.is_connected():
                self._pw = self._pw or await async_playwright().start()
                self._browser = await self._pw.chromium.launch(
                    headless=True,
                    args=["--no-sandbox", "--disable-dev-shm-usage", "--disable-blink-features=AutomationControlled"],
                )
            return self._browser

    async def close(self) -> None:
        if self._browser:
            await self._browser.close()
        if self._pw:
            await self._pw.stop()
        self._browser = None
        self._pw = None

    async def capture(self, url: str, persona: str, shot_name: str | None, timeout_s: float) -> PersonaCapture:
        cap = PersonaCapture(name=persona)
        browser = await self.browser()
        ctx = await browser.new_context(
            **PERSONAS[persona], ignore_https_errors=True, accept_downloads=False, service_workers="block", java_script_enabled=True
        )
        page = await ctx.new_page()
        nav_hops: list[dict[str, Any]] = []
        script_bodies: dict[str, str] = {}

        def on_nav(frame):
            if frame == page.main_frame and (not nav_hops or nav_hops[-1]["url"] != frame.url) and frame.url != "about:blank":
                nav_hops.append({"url": frame.url, "status": None, "kind": "navigation"})

        async def on_response(resp):
            try:
                if resp.request.resource_type == "script" and len(script_bodies) < 12:
                    body = await resp.body()
                    if len(body) < 400_000:
                        script_bodies[resp.url] = body.decode("utf-8", "ignore")
            except Exception:
                return

        page.on("framenavigated", on_nav)
        page.on("response", lambda r: asyncio.ensure_future(on_response(r)))
        page.on("dialog", lambda d: asyncio.ensure_future(d.dismiss()))
        try:
            resp = await page.goto(url, wait_until="domcontentloaded", timeout=timeout_s * 1000)
            hops: list[dict[str, Any]] = []
            if resp is not None:
                req = resp.request
                chain = []
                while req is not None:
                    chain.append(req)
                    req = req.redirected_from
                for r in reversed(chain):
                    rr = await r.response()
                    hops.append({"url": r.url, "status": rr.status if rr else None, "kind": "http"})
                cap.status = resp.status
            try:
                await page.wait_for_load_state("load", timeout=4000)
            except Exception:
                pass
            await page.wait_for_timeout(1200)
            for h in nav_hops:
                if all(h["url"] != x["url"] for x in hops):
                    hops.append({**h, "kind": "js/meta"})
            cap.hops = hops
            cap.final_url = page.url
            data = await page.evaluate(EXTRACT_JS)
            cap.title = data["title"]
            cap.text = data["text"]
            cap.lang = data["lang"]
            cap.inputs = data["inputs"]
            cap.forms = data["forms"]
            cap.imgs = data["imgs"]
            cap.urgent = data["urgent"]
            cap.icons = data["icons"]
            cap.links = data["links"]
            cap.tags = data["tags"]
            cap.width, cap.height = int(data["width"]), int(data["height"])
            cap.html = (await page.content())[:600_000]
            cap.scripts = script_bodies
            if shot_name:
                path = get_settings().media_dir / "shots" / f"{shot_name}.png"
                vp = PERSONAS[persona]["viewport"]
                clip_h = min(max(cap.height, vp["height"]), vp["height"] * 3)
                await page.screenshot(path=str(path), full_page=True, clip={"x": 0, "y": 0, "width": vp["width"], "height": clip_h}, timeout=8000)
                cap.screenshot_path = str(path)
                cap.screenshot_url = f"/media/shots/{shot_name}.png"
            await self._favicon(page, cap)
            cap.ok = True
        except Exception as exc:
            cap.error = type(exc).__name__ + ": " + str(exc).split("\n")[0][:160]
            cap.final_url = cap.final_url or (nav_hops[-1]["url"] if nav_hops else None)
            cap.hops = cap.hops or nav_hops
        finally:
            await ctx.close()
        return cap

    async def _favicon(self, page: Page, cap: PersonaCapture) -> None:
        candidates = list(cap.icons)
        if cap.final_url and cap.final_url.startswith("http"):
            fp = parse(cap.final_url)
            candidates.append(f"{fp.scheme}://{fp.hostname}/favicon.ico")
        for href in candidates[:2]:
            try:
                r = await page.request.get(href, timeout=3000)
                if r.ok:
                    body = await r.body()
                    if len(body) < 50 or len(body) > 500_000:
                        continue
                    cap.favicon_mmh3 = mmh3.hash(base64.encodebytes(body))
                    try:
                        cap.favicon_phash = str(imagehash.phash(Image.open(io.BytesIO(body)).convert("RGBA").convert("RGB")))
                    except Exception:
                        cap.favicon_phash = None
                    return
            except Exception:
                continue

    async def render(self, url: str, scan_id: str, timeout_s: float | None = None) -> RenderResult:
        timeout_s = timeout_s or get_settings().render_timeout_s
        async def bounded(persona: str, shot: str) -> PersonaCapture:
            try:
                return await asyncio.wait_for(self.capture(url, persona, shot, timeout_s), timeout_s + 18)
            except asyncio.TimeoutError:
                return PersonaCapture(name=persona, error="TimeoutError: page took too long to load")

        async with self._sem:
            caps = await asyncio.gather(
                bounded("uae_mobile", f"{scan_id}_mobile"),
                bounded("desktop", f"{scan_id}_desktop"),
                bounded("googlebot", f"{scan_id}_bot"),
            )
        personas = {c.name: c for c in caps}
        primary = max(caps, key=lambda c: (c.ok, len(c.asks_for()), c.name == "uae_mobile"))
        cloaked, reason = detect_cloaking(personas)
        return RenderResult(personas=personas, primary=primary, cloaking=cloaked, cloaking_reason=reason)


def detect_cloaking(p: dict[str, PersonaCapture]) -> tuple[bool, tuple[str, str] | None]:
    human = [c for c in (p.get("uae_mobile"), p.get("desktop")) if c and c.ok]
    bot = p.get("googlebot")
    if not human or not bot:
        return False, None
    victim = max(human, key=lambda c: len(c.asks_for()))
    try:
        v_dom = parse(victim.final_url or "").registrable
        b_dom = parse(bot.final_url or "").registrable if bot.final_url else None
    except ValueError:
        return False, None
    if bot.ok and b_dom and v_dom != b_dom:
        return True, (
            f"Shows a different site to search-engine crawlers ({b_dom}) than to phone users ({v_dom})",
            f"يعرض موقعًا مختلفًا لمحركات البحث ({b_dom}) عن الذي يراه مستخدمو الهواتف ({v_dom})",
        )
    if victim.asks_for() and bot.ok and not bot.asks_for():
        return True, (
            "Hides its data-collection form from security crawlers and shows it only to real visitors",
            "يخفي نموذج جمع البيانات عن برامج الفحص الأمني ويُظهره فقط للزوار الحقيقيين",
        )
    if not bot.ok or (bot.status or 0) >= 400:
        if victim.ok and (victim.status or 200) < 400:
            return True, (
                "Blocks security crawlers while serving content to phone users",
                "يحجب برامج الفحص الأمني بينما يعرض المحتوى لمستخدمي الهواتف",
            )
    mobile, desktop = p.get("uae_mobile"), p.get("desktop")
    if mobile and desktop and mobile.ok and desktop.ok and mobile.asks_for() and not desktop.asks_for():
        ratio = SequenceMatcher(None, mobile.tags[:3000], desktop.tags[:3000]).quick_ratio()
        if ratio < 0.5:
            return True, (
                "Shows the scam page only to UAE mobile visitors",
                "يعرض صفحة الاحتيال لزوار الهواتف في الإمارات فقط",
            )
    return False, None


sandbox = Sandbox()
