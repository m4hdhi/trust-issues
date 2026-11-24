"""Evidence fusion: weighted log-odds over explainable bilingual signals."""
from __future__ import annotations

import math
from difflib import SequenceMatcher
from typing import Any

from ..registry import Brand
from ..schemas import Bilingual, DomainDiff, Severity, Signal

SCAM_THRESHOLD = 65
SUSPICIOUS_THRESHOLD = 40


class Signals:
    def __init__(self) -> None:
        self.items: list[Signal] = []

    def add(
        self,
        id: str,
        category: str,
        weight: float,
        en: str,
        ar: str,
        detail_en: str | None = None,
        detail_ar: str | None = None,
        **evidence: Any,
    ) -> None:
        if any(s.id == id for s in self.items):
            return
        self.items.append(
            Signal(
                id=id,
                category=category,
                weight=round(weight, 2),
                severity=severity_for(weight),
                title=Bilingual(en=en, ar=ar),
                detail=Bilingual(en=detail_en, ar=detail_ar or detail_en) if detail_en else None,
                evidence=evidence,
            )
        )

    def has(self, *ids: str) -> bool:
        return any(s.id in ids for s in self.items)

    def total(self) -> float:
        return sum(s.weight for s in self.items)


def severity_for(w: float) -> Severity:
    if w <= 0:
        return "info"
    if w < 1:
        return "low"
    if w < 2.5:
        return "medium"
    if w < 4:
        return "high"
    return "critical"


def score(prior_logit: float, signals: Signals, anchored: bool, hard_intel: bool) -> int:
    z = prior_logit + signals.total()
    s = 100.0 / (1.0 + math.exp(-z))
    if anchored and not hard_intel:
        s = min(s, 8.0)
    return int(round(max(0.0, min(100.0, s))))


def verdict_for(score_value: int) -> str:
    if score_value >= SCAM_THRESHOLD:
        return "scam"
    if score_value >= SUSPICIOUS_THRESHOLD:
        return "suspicious"
    return "safe"


def headline(verdict: str, brand: Brand | None, official: Brand | None) -> Bilingual:
    if verdict == "safe" and official:
        return Bilingual(en=f"Official {official.name_en} website", ar=f"الموقع الرسمي لـ{official.name_ar}")
    if verdict == "safe":
        return Bilingual(en="No signs of fraud found", ar="لم نعثر على مؤشرات احتيال")
    if verdict == "scam" and brand:
        return Bilingual(en=f"Fake {brand.name_en} website", ar=f"موقع مزيّف ينتحل صفة {brand.name_ar}")
    if verdict == "scam":
        return Bilingual(en="Scam website", ar="موقع احتيالي")
    if brand:
        return Bilingual(en=f"Suspicious link posing as {brand.name_en}", ar=f"رابط مشبوه ينتحل صفة {brand.name_ar}")
    return Bilingual(en="Suspicious link", ar="رابط مشبوه")


def domain_diff(official: str, suspect: str) -> DomainDiff:
    sm = SequenceMatcher(None, official, suspect)
    segments: list[dict[str, Any]] = []
    for op, i1, i2, j1, j2 in sm.get_opcodes():
        segments.append({"op": op, "official": official[i1:i2], "text": suspect[j1:j2]})
    return DomainDiff(official=official, suspect=suspect, segments=segments)


def similarity(a: str, b: str) -> float:
    return SequenceMatcher(None, a, b).ratio()


def best_official_domain(brand: Brand, suspect: str) -> str:
    return max(brand.official_domains, key=lambda d: SequenceMatcher(None, d, suspect).ratio()) if brand.official_domains else suspect
