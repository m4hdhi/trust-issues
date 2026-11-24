"""Telegram bot: forward any suspicious message or link and get a bilingual verdict with a shareable warning card."""
from __future__ import annotations

import asyncio
import logging
from typing import Any

from . import scans
from .config import get_settings
from .detectors import message_rules
from .evidence import card
from .http import client
from .urlutil import find_urls

log = logging.getLogger(__name__)

WELCOME = (
    "🛡️ أزمة ثقة | Trust Issues\n\n"
    "أرسل أو أعد توجيه أي رسالة أو رابط مشبوه وسأفحصه لك فورًا.\n"
    "Send or forward any suspicious message or link and I will check it for you."
)
ICON = {"scam": "⛔", "suspicious": "⚠️", "safe": "✅", "unknown": "❔"}


def _api(method: str) -> str:
    return f"https://api.telegram.org/bot{get_settings().telegram_bot_token}/{method}"


async def _send(chat_id: int, text: str, reply_to: int | None = None) -> None:
    await client().post(_api("sendMessage"), json={"chat_id": chat_id, "text": text, "reply_to_message_id": reply_to,
                                                    "disable_web_page_preview": True}, timeout=15.0)


def _summary(r: dict[str, Any]) -> str:
    base = get_settings().public_base_url.rstrip("/")
    lines = [f"{ICON.get(r['verdict'], '❔')} {r['headline']['ar']}", r["headline"]["en"], f"درجة الخطورة · Risk: {r['score']}/100"]
    reasons = [s for s in r.get("signals", []) if (s["weight"] > 0) == (r["verdict"] != "safe")][:3]
    for s in reasons:
        lines.append(f"• {s['title']['ar']}\n  {s['title']['en']}")
    lines.append(f"\n🔎 {base}/scan/{r['id']}")
    return "\n".join(lines)


async def _handle(msg: dict[str, Any]) -> None:
    chat_id = msg["chat"]["id"]
    text = msg.get("text") or msg.get("caption") or ""
    entities = msg.get("entities") or msg.get("caption_entities") or []
    links = [e["url"] for e in entities if e.get("type") == "text_link"]
    if text.strip() in ("/start", "/help"):
        await _send(chat_id, WELCOME)
        return
    urls = list(dict.fromkeys(links + find_urls(text)))[:3]
    if not urls:
        m = message_rules.analyze(text)
        verdict = "⚠️ رسالة مشبوهة · Suspicious message" if m["is_scam"] else "✅ لا توجد مؤشرات احتيال واضحة · No clear scam signs"
        reasons = "\n".join(f"• {a}\n  {e}" for a, e in zip(m["reasons_ar"], m["reasons_en"]))
        await _send(chat_id, f"{verdict}\n{reasons}".strip(), msg.get("message_id"))
        return
    await _send(chat_id, "⏳ جارٍ الفحص في بيئة معزولة… Scanning in a sandbox…", msg.get("message_id"))
    for url in urls:
        result = await scans.run_inline(url, mode="deep", source="bot")
        if result is None:
            await _send(chat_id, f"❔ تعذّر فحص الرابط · Could not analyse {url}")
            continue
        r = result.model_dump(mode="json")
        png = await asyncio.to_thread(card.build, r)
        await client().post(_api("sendPhoto"), data={"chat_id": str(chat_id), "caption": _summary(r)[:1000]},
                            files={"photo": ("warning.png", png, "image/png")}, timeout=30.0)


async def run() -> None:
    if not get_settings().telegram_bot_token:
        return
    offset = 0
    while True:
        try:
            r = await client().get(_api("getUpdates"), params={"timeout": 30, "offset": offset}, timeout=40.0)
            for upd in r.json().get("result", []):
                offset = upd["update_id"] + 1
                msg = upd.get("message") or upd.get("channel_post")
                if msg:
                    asyncio.create_task(_handle(msg))
        except Exception as exc:
            log.info("telegram polling error: %s", exc)
            await asyncio.sleep(5)
