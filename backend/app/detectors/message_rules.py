"""Rule-based scam-message analysis (Arabic + English), used when no AI judge is configured."""
from __future__ import annotations

import re
from typing import Any

from ..registry import get_registry
from ..urlutil import find_urls, parse

RULES: list[tuple[str, float, str, str, re.Pattern[str]]] = [
    ("urgency", 18, "Creates urgency or threatens a penalty", "يخلق شعورًا بالاستعجال أو يهدد بعقوبة",
     re.compile(r"urgent|immediately|within \d+ ?(hours|hrs|days)|today only|last (chance|notice)|suspend|block|عاجل|فورا|فوراً|خلال \d+|اليوم فقط|آخر فرصة|إيقاف|تعليق|حظر", re.I)),
    ("payment", 18, "Asks you to pay a fine, fee or toll", "يطلب منك دفع مخالفة أو رسوم",
     re.compile(r"\bpay\b|payment|fine|fines|fee|toll|outstanding|unpaid|due amount|aed ?\d|\d+ ?aed|دفع|سداد|مخالف|غرام|رسوم|درهم", re.I)),
    ("credentials", 22, "Asks for OTP, card, password or Emirates ID", "يطلب رمز التحقق أو البطاقة أو كلمة المرور أو الهوية",
     re.compile(r"otp|one.?time|verification code|card number|cvv|password|pin\b|emirates id|رمز التحقق|رقم البطاقة|كلمة المرور|الرقم السري|الهوية", re.I)),
    ("parcel", 14, "Fake parcel / delivery problem", "مشكلة شحنة أو توصيل مزيفة",
     re.compile(r"parcel|package|delivery|shipment|redeliver|customs fee|شحنة|طرد|توصيل|الجمارك", re.I)),
    ("prize", 16, "Prize, refund or too-good-to-be-true offer", "جائزة أو استرداد أو عرض مغرٍ جدًا",
     re.compile(r"won|winner|prize|reward|refund|cashback|discount of \d+|\d+% (off|discount)|ربحت|جائزة|مكافأة|استرداد|خصم \d+", re.I)),
    ("account", 12, "Claims your account has a problem", "يدّعي وجود مشكلة في حسابك",
     re.compile(r"account (has been|is) (locked|suspended|restricted)|update your (details|account|information)|verify your account|تحديث (بياناتك|حسابك)|تم (إيقاف|تعليق) حسابك", re.I)),
]


def analyze(text: str) -> dict[str, Any]:
    reg = get_registry()
    score = 0.0
    reasons_en: list[str] = []
    reasons_ar: list[str] = []
    for _, weight, en, ar, rx in RULES:
        if rx.search(text):
            score += weight
            reasons_en.append(en)
            reasons_ar.append(ar)
    mentions = reg.mentioned_brands(text)
    brand = mentions[0][0] if mentions else None
    urls = find_urls(text)
    if brand:
        score += 10
        off_brand = [u for u in urls if not reg.is_official(parse(u).registrable, parse(u).hostname)]
        if off_brand:
            score += 25
            reasons_en.append(f"Mentions {brand.name_en} but links to a domain it does not own")
            reasons_ar.append(f"يذكر {brand.name_ar} لكنه يحتوي على رابط لنطاق لا يملكه")
    if urls and score:
        score += 8
    score = int(min(99, score))
    return {
        "is_scam": score >= 50,
        "score": score,
        "scam_type": "phishing" if score >= 50 else "none",
        "impersonated_brand_id": brand.id if brand else None,
        "reasons_en": reasons_en[:4],
        "reasons_ar": reasons_ar[:4],
    }
