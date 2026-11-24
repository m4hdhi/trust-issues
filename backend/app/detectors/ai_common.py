"""Shared prompt, schema and evidence packaging for the AI judges."""
from __future__ import annotations

import base64
import io
import json
from dataclasses import dataclass
from typing import Any

from PIL import Image

from ..registry import get_registry

VERDICT_SCHEMA: dict[str, Any] = {
    "type": "object",
    "properties": {
        "verdict": {"type": "string", "enum": ["scam", "suspicious", "safe"]},
        "confidence": {"type": "number"},
        "target_brand_id": {"type": ["string", "null"]},
        "target_brand_name": {"type": ["string", "null"]},
        "asks_for": {
            "type": "array",
            "items": {
                "type": "string",
                "enum": ["card", "cvv", "otp", "password", "emirates_id", "phone", "personal_info", "bank_account", "payment", "crypto", "none"],
            },
        },
        "scam_type": {
            "type": "string",
            "enum": ["phishing", "fake_payment", "fake_shop", "investment", "job", "tech_support", "impersonation", "malware", "giveaway", "none"],
        },
        "reasons_en": {"type": "array", "items": {"type": "string"}},
        "reasons_ar": {"type": "array", "items": {"type": "string"}},
    },
    "required": ["verdict", "confidence", "target_brand_id", "target_brand_name", "asks_for", "scam_type", "reasons_en", "reasons_ar"],
    "additionalProperties": False,
}

MESSAGE_SCHEMA: dict[str, Any] = {
    "type": "object",
    "properties": {
        "is_scam": {"type": "boolean"},
        "score": {"type": "integer"},
        "scam_type": {"type": "string"},
        "impersonated_brand_id": {"type": ["string", "null"]},
        "reasons_en": {"type": "array", "items": {"type": "string"}},
        "reasons_ar": {"type": "array", "items": {"type": "string"}},
    },
    "required": ["is_scam", "score", "scam_type", "impersonated_brand_id", "reasons_en", "reasons_ar"],
    "additionalProperties": False,
}


def _brand_catalog() -> str:
    reg = get_registry()
    rows = [f"- {b.id}: {b.name_en} / {b.name_ar} — official domains: {', '.join(b.official_domains)}" for b in reg.brands.values()]
    return "\n".join(rows)


SYSTEM_TEMPLATE = """You are a senior fraud analyst for the Abu Dhabi Police cybercrime unit. You decide whether a web page is a scam (phishing, fake payment portal, fake shop, impersonation) using the evidence provided: the URL, registration and hosting data, threat-intelligence hits, the page text, detected form fields and a screenshot.

Decision rules:
1. Brand-intent mismatch is the strongest signal: if the page looks like or claims to be brand X (logo, name, colours, wording) and asks for login, card, OTP, Emirates ID, payment or personal data, but the domain is NOT one of X's official domains, it is a scam.
2. Official domains of a brand are legitimate even if they ask for card data. Never call an official domain a scam unless threat intelligence confirms compromise.
3. Legitimate businesses that sell their own products and are not impersonating anyone should be "safe" unless there are clear fraud signals (fake discounts on government fines, crypto doubling, too-good-to-be-true prices with brand-new domains, urgency + payment).
4. Parked pages, errors and empty pages without fraud signals are "suspicious" only if other evidence (very new domain, brand keyword in domain, threat intel) points to fraud; otherwise "safe".
5. UAE-specific scam patterns: fake traffic-fine payments (Abu Dhabi Police, Dubai Police, RTA, MOI), Salik/Darb toll top-ups, TAMM / UAE PASS logins, Emirates Post / Aramex parcel fees, bank account suspension, ICP visa/Emirates ID renewal, DEWA/ADDC bill refunds, fake 70-90% discounts on fines.
Return calibrated confidence (0-1). Reasons must be short, concrete and refer to evidence (max 4 each), written in clear English and natural Modern Standard Arabic. Use target_brand_id from the catalog when the brand is in it, otherwise null with target_brand_name set.

UAE brand catalog (id: name — official domains):
{catalog}"""


def system_prompt() -> str:
    return SYSTEM_TEMPLATE.format(catalog=_brand_catalog())


MESSAGE_SYSTEM = """You are a fraud analyst for the Abu Dhabi Police. Classify an SMS / WhatsApp / social-media message the user received. Scam indicators: impersonating UAE government, police, banks, couriers or telcos; fines, tolls, parcel fees, account suspension, prizes, job offers with fees, investment returns; urgency; links to non-official domains; requests for OTP/card/Emirates ID. Score 0-100 (probability-like). Reasons: max 4, short, English and natural Modern Standard Arabic. impersonated_brand_id must be one of the catalog ids or null.

UAE brand catalog:
{catalog}"""


def message_system_prompt() -> str:
    return MESSAGE_SYSTEM.format(catalog=_brand_catalog())


@dataclass
class JudgeInput:
    url: str
    final_url: str | None
    domain: str
    evidence: dict[str, Any]
    title: str
    text: str
    screenshot_path: str | None

    def user_text(self) -> str:
        return (
            f"URL submitted: {self.url}\nFinal URL after redirects: {self.final_url or 'n/a'}\n"
            f"Registrable domain: {self.domain}\nPage title: {self.title[:200]}\n"
            f"Evidence (JSON): {json.dumps(self.evidence, ensure_ascii=False, default=str)[:4000]}\n"
            f"Visible page text (truncated):\n{self.text[:3500]}"
        )

    def screenshot_jpeg_b64(self) -> str | None:
        if not self.screenshot_path:
            return None
        try:
            img = Image.open(self.screenshot_path).convert("RGB")
        except Exception:
            return None
        w, h = img.size
        img = img.crop((0, 0, w, min(h, int(w * 2.2))))
        img.thumbnail((720, 1400))
        buf = io.BytesIO()
        img.save(buf, format="JPEG", quality=72)
        return base64.standard_b64encode(buf.getvalue()).decode()
