"""Search-engine and Google Maps hunters (SerpAPI): fake ads, poisoned results and fake helpline listings."""
from __future__ import annotations

import asyncio
import hashlib
import json
import logging
import re
import time
from typing import Any

from .. import scans
from ..config import get_settings
from ..http import client
from ..registry import digits, get_registry
from ..urlutil import parse
from . import radar

log = logging.getLogger(__name__)

SEARCH_QUERIES = [
    ("pay traffic fines Abu Dhabi", "en"),
    ("دفع مخالفات المرور أبوظبي", "ar"),
    ("Salik recharge online", "en"),
    ("Darb toll payment", "en"),
    ("UAE PASS login", "en"),
    ("TAMM pay fines", "en"),
    ("Emirates Post parcel delivery fee", "en"),
    ("تجديد الهوية الإماراتية", "ar"),
]
MAPS_QUERIES = [
    "Emirates NBD customer service",
    "ADCB customer care",
    "FAB bank customer service",
    "Etisalat customer care",
    "Abu Dhabi Police traffic fines office",
    "Aramex customer service",
]
CACHE_TTL = 6 * 3600
SWEEP_BATCH = 4
RESERVE = 100
SWEEP_JOBS = [job for pair in zip(
    [("search", q, lang) for q, lang in SEARCH_QUERIES],
    [("maps", q, None) for q in MAPS_QUERIES] + [None] * (len(SEARCH_QUERIES) - len(MAPS_QUERIES)),
) for job in pair if job]
_quota: dict[str, Any] = {"at": 0.0, "left": None}
_cursor = 0


class QuotaExhausted(RuntimeError):
    pass


async def searches_left() -> int | None:
    """Remaining SerpAPI searches this month. The account endpoint is free and does not use a search."""
    key = get_settings().serpapi_key
    if not key:
        return None
    if time.time() - _quota["at"] < 600:
        return _quota["left"]
    try:
        r = await client().get("https://serpapi.com/account.json", params={"api_key": key}, timeout=10.0)
        left = r.json().get("total_searches_left")
    except Exception:
        left = _quota["left"]
    _quota.update(at=time.time(), left=left)
    return left


async def _serpapi(params: dict[str, Any]) -> dict[str, Any]:
    s = get_settings()
    key = hashlib.sha1(json.dumps(params, sort_keys=True, ensure_ascii=False).encode()).hexdigest()
    path = s.cache_dir / f"serp_{key}.json"
    if path.exists() and time.time() - path.stat().st_mtime < CACHE_TTL:
        return json.loads(path.read_text(encoding="utf-8"))
    left = await searches_left()
    if not s.serpapi_key or left == 0:
        if path.exists():
            return json.loads(path.read_text(encoding="utf-8"))
        if left == 0:
            raise QuotaExhausted("SerpAPI searches for this month are used up")
        return {}
    r = await client().get("https://serpapi.com/search.json", params={**params, "api_key": s.serpapi_key}, timeout=40.0)
    r.raise_for_status()
    data = r.json()
    path.write_text(json.dumps(data, ensure_ascii=False), encoding="utf-8")
    if _quota["left"]:
        _quota["left"] -= 1
    return data


async def hunt_search(query: str, lang: str | None = None) -> list[dict[str, Any]]:
    lang = lang or ("ar" if re.search(r"[؀-ۿ]", query) else "en")
    data = await _serpapi({"engine": "google", "q": query, "gl": "ae", "hl": lang, "google_domain": "google.ae", "num": 20})
    rows: list[dict[str, Any]] = []
    for ad in data.get("ads", []) or []:
        rows.append({"title": ad.get("title"), "url": ad.get("link") or ad.get("tracking_link"), "is_ad": True, "position": ad.get("position")})
    for org in data.get("organic_results", []) or []:
        rows.append({"title": org.get("title"), "url": org.get("link"), "is_ad": False, "position": org.get("position")})
    reg = get_registry()
    out: list[dict[str, Any]] = []

    async def evaluate(row: dict[str, Any]) -> dict[str, Any] | None:
        try:
            p = parse(row["url"] or "")
        except ValueError:
            return None
        item = {**row, "url": p.url, "domain": p.registrable, "verdict": "safe", "score": 0, "scan_id": None}
        if reg.is_official(p.registrable, p.hostname):
            item["official"] = True
            return item
        fast = await scans.run_inline(p.url, mode="fast", source="search")
        if fast is None:
            return item
        item.update(verdict=fast.verdict, score=fast.score, scan_id=fast.id)
        risky = fast.score >= 35 or reg.impersonation(p.hostname, p.registrable) or row["is_ad"]
        if risky:
            deep = await scans.run_inline(p.url, mode="deep", source="search")
            if deep:
                item.update(verdict=deep.verdict, score=deep.score, scan_id=deep.id, brand=deep.brand.id if deep.brand else None)
                if deep.verdict != "safe":
                    radar.publish("search", p.url, deep.score, deep.verdict, deep.brand.id if deep.brand else None,
                                  {"query": query, "is_ad": row["is_ad"], "position": row.get("position"), "scan_id": deep.id,
                                   "headline": deep.headline.model_dump()})
        return item

    for res in await asyncio.gather(*(evaluate(r) for r in rows[:15])):
        if res:
            out.append(res)
    return out


def _flags_for_listing(listing: dict[str, Any]) -> tuple[list[dict[str, str]], Any, int]:
    reg = get_registry()
    title = listing.get("title") or ""
    mentions = reg.mentioned_brands("", title)
    brand = mentions[0][0] if mentions else None
    flags: list[dict[str, str]] = []
    score = 5
    phone = listing.get("phone") or ""
    d = digits(phone)
    website = listing.get("website") or ""
    official_site = False
    if brand:
        if website:
            try:
                wp = parse(website)
                official_site = reg.is_official(wp.registrable, wp.hostname)
                if not official_site:
                    flags.append({"en": f"Website {wp.registrable} is not an official {brand.name_en} domain",
                                  "ar": f"الموقع {wp.registrable} ليس نطاقًا رسميًا لـ{brand.name_ar}"})
                    score += 40
            except ValueError:
                pass
        raw = re.sub(r"\D", "", phone)
        foreign = bool(d) and (len(d) > 9 or (phone.strip().startswith(("+", "00")) and not raw.lstrip("0").startswith("971")))
        if foreign:
            flags.append({"en": f"International number used as {brand.name_en} customer service in the UAE",
                          "ar": f"رقم دولي يُستخدم كخدمة عملاء {brand.name_ar} في الإمارات"})
            score += 45
        elif d:
            if d in brand.helpline_digits:
                flags.append({"en": "Phone matches the official helpline", "ar": "الرقم مطابق للخط الرسمي"})
                score -= 5
            elif re.fullmatch(r"5[024568]\d{7}", d):
                flags.append({"en": f"Uses a personal mobile number for {brand.name_en} customer service",
                              "ar": f"يستخدم رقم هاتف متحرك شخصي لخدمة عملاء {brand.name_ar}"})
                score += 15 if official_site else 45
            elif not d.startswith(("2", "3", "4", "6", "7", "9")) or len(d) < 7:
                flags.append({"en": "Phone number is not a verified UAE helpline", "ar": "الرقم ليس خط مساعدة إماراتي موثّق"})
                score += 25
            elif brand.helplines and d.startswith(("600", "800")):
                flags.append({"en": f"Toll-free number differs from {brand.name_en}'s official helpline",
                              "ar": f"الرقم المجاني يختلف عن الخط الرسمي لـ{brand.name_ar}"})
                score += 35
        reviews = listing.get("reviews") or 0
        if reviews >= 20 and (official_site or not website):
            score -= 15
        if reviews < 5 and flags:
            flags.append({"en": "Very few reviews (new or fake listing)", "ar": "عدد قليل جدًا من المراجعات (قائمة جديدة أو مزيفة)"})
            score += 10
    return flags, brand, max(0, min(100, score))


async def hunt_maps(query: str) -> list[dict[str, Any]]:
    data = await _serpapi({"engine": "google_maps", "q": query, "type": "search", "ll": "@24.4539,54.3773,10z", "hl": "en"})
    out: list[dict[str, Any]] = []
    for lst in data.get("local_results", []) or []:
        flags, brand, score = _flags_for_listing(lst)
        verdict = "scam" if score >= 70 else "suspicious" if score >= 40 else "safe"
        gps = lst.get("gps_coordinates") or {}
        item = {
            "title": lst.get("title"), "phone": lst.get("phone"), "website": lst.get("website"), "address": lst.get("address"),
            "rating": lst.get("rating"), "reviews": lst.get("reviews"), "flags": flags, "verdict": verdict, "score": score,
            "brand": brand.ref().model_dump() if brand else None, "lat": gps.get("latitude"), "lng": gps.get("longitude"),
            "place_id": lst.get("place_id"),
        }
        out.append(item)
        if verdict != "safe":
            target = lst.get("website") or f"https://maps.google.com/?cid={lst.get('data_cid') or lst.get('place_id')}"
            radar.publish("maps", target, score, verdict, brand.id if brand else None,
                          {"query": query, "title": lst.get("title"), "phone": lst.get("phone"), "flags": flags})
    return out


async def sweep() -> None:
    """Background hunt over a rotating slice of the queries, keeping RESERVE searches for console hunts."""
    global _cursor
    left = await searches_left()
    if left is not None and left <= RESERVE:
        log.info("search hunters paused: %s SerpAPI searches left, %s kept for console hunts", left, RESERVE)
        return
    for i in range(SWEEP_BATCH):
        kind, q, lang = SWEEP_JOBS[(_cursor + i) % len(SWEEP_JOBS)]
        try:
            await (hunt_search(q, lang) if kind == "search" else hunt_maps(q))
        except Exception as exc:
            log.info("%s hunt %s failed: %s", kind, q, exc)
    _cursor = (_cursor + SWEEP_BATCH) % len(SWEEP_JOBS)
