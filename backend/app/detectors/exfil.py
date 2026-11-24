"""Extract where a scam page sends stolen data: Telegram bots, webhooks, form targets, phone numbers, wallets."""
from __future__ import annotations

import re

from ..schemas import ExfilLead
from ..urlutil import parse
from .render import PersonaCapture

TELEGRAM_BOT = re.compile(r"api\.telegram\.org/bot(\d{6,12}:[A-Za-z0-9_-]{30,40})")
TELEGRAM_TOKEN = re.compile(r"['\"](\d{8,12}:AA[A-Za-z0-9_-]{30,34})['\"]")
TELEGRAM_CHAT = re.compile(r"chat_id['\"]?\s*[:=]\s*['\"]?(-?\d{6,16})")
WEBHOOKS = re.compile(
    r"https?://(?:discord(?:app)?\.com/api/webhooks/[\w/-]+|hooks\.slack\.com/services/[\w/]+|"
    r"script\.google\.com/macros/s/[\w-]+/exec|[\w.-]*webhook\.site/[\w-]+|formspree\.io/f/\w+|"
    r"api\.emailjs\.com/[\w/.-]+|getform\.io/f/[\w-]+|submit-form\.com/[\w-]+|[\w-]+\.ngrok(?:-free)?\.(?:io|app)[\w/.-]*|"
    r"[\w-]+\.firebaseio\.com|[\w-]+\.supabase\.co/rest/v1/[\w/.-]*)"
)
WHATSAPP = re.compile(r"(?:wa\.me/|api\.whatsapp\.com/send\?phone=|whatsapp://send\?phone=)(\+?\d{8,15})")
UAE_PHONE = re.compile(r"(?<!\d)(?:\+971|00971|0)\s?-?(?:5[024568]|[234679])\s?-?\d{3}\s?-?\d{4}(?!\d)|(?<!\d)(?:600|800)\s?-?\d{2,3}\s?-?\d{2,4}(?!\d)")
BTC = re.compile(r"\b(?:bc1[a-z0-9]{25,59}|[13][a-km-zA-HJ-NP-Z1-9]{25,34})\b")
USDT_TRON = re.compile(r"\bT[1-9A-HJ-NP-Za-km-z]{33}\b")
EMAIL = re.compile(r"[\w.+-]+@[\w-]+\.[\w.-]{2,}")


SEARCH_ENGINES = {"google.com", "bing.com", "duckduckgo.com", "yahoo.com", "yandex.com", "yandex.ru", "baidu.com", "ecosia.org"}

def extract(cap: PersonaCapture, page_registrable: str) -> list[ExfilLead]:
    blobs = [cap.html] + list(cap.scripts.values())
    corpus = "\n".join(blobs)
    leads: list[ExfilLead] = []
    seen: set[tuple[str, str]] = set()

    def add(kind: str, value: str, context: str | None = None) -> None:
        key = (kind, value)
        if key not in seen and len(leads) < 25:
            seen.add(key)
            leads.append(ExfilLead(kind=kind, value=value, context=context))

    for m in TELEGRAM_BOT.finditer(corpus):
        add("telegram_bot", m.group(1), "api.telegram.org bot endpoint")
    for m in TELEGRAM_TOKEN.finditer(corpus):
        add("telegram_bot", m.group(1), "embedded bot token")
    if any(k == "telegram_bot" for k, _ in seen):
        for m in TELEGRAM_CHAT.finditer(corpus):
            add("telegram_bot", f"chat_id {m.group(1)}", "destination chat")
    for m in WEBHOOKS.finditer(corpus):
        add("webhook", m.group(0)[:200])
    for f in cap.forms:
        action = f.get("action") or ""
        if action.startswith("http"):
            try:
                reg = parse(action).registrable
            except ValueError:
                continue
            if reg != page_registrable and reg not in SEARCH_ENGINES:
                add("form_post", action[:200], f"form {f.get('method', 'get').upper()} to another domain")
    for m in WHATSAPP.finditer(corpus + "\n" + "\n".join(cap.links)):
        add("whatsapp", m.group(1))
    for m in UAE_PHONE.finditer(cap.text):
        add("phone", re.sub(r"[\s-]", "", m.group(0)))
    for rx in (BTC, USDT_TRON):
        for m in rx.finditer(cap.text):
            add("crypto_wallet", m.group(0))
    for m in EMAIL.finditer(cap.text):
        if not m.group(0).lower().endswith((".png", ".jpg", ".svg", ".webp")):
            add("email", m.group(0))
    return leads
