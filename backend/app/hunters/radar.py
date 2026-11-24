"""Live radar: hunter detections are stored, streamed to the police console, and queued for deep scans."""
from __future__ import annotations

import asyncio
import json
import logging
import time
from typing import Any

from sqlmodel import select

from ..config import get_settings
from .. import bus, db, scans
from ..registry import get_registry
from ..urlutil import parse

log = logging.getLogger(__name__)

_seen: dict[str, float] = {}
_scan_times: list[float] = []
MAX_DEEP_PER_MIN = 3 if get_settings().low_resource else 12


def _allow_deep() -> bool:
    now = time.time()
    while _scan_times and now - _scan_times[0] > 60:
        _scan_times.pop(0)
    if len(_scan_times) >= MAX_DEEP_PER_MIN:
        return False
    _scan_times.append(now)
    return True


def publish(source: str, url: str, score: int = 0, verdict: str = "unknown", brand_id: str | None = None,
            detail: dict[str, Any] | None = None) -> dict[str, Any] | None:
    try:
        p = parse(url)
    except ValueError:
        return None
    key = f"{source}:{p.hostname}"
    if key in _seen and time.time() - _seen[key] < 6 * 3600:
        return None
    _seen[key] = time.time()
    ev = db.RadarEvent(source=source, domain=p.hostname, url=p.url, score=score, verdict=verdict, brand_id=brand_id,
                       detail_json=json.dumps(detail or {}, ensure_ascii=False))
    with db.session() as s:
        s.add(ev)
        s.commit()
        s.refresh(ev)
    payload = serialize(ev)
    bus.channel("radar").publish("radar", payload)
    db.bump(f"hunter_{source}")
    return payload


def serialize(ev: db.RadarEvent) -> dict[str, Any]:
    brand = get_registry().brands.get(ev.brand_id) if ev.brand_id else None
    return {
        "id": ev.id,
        "source": ev.source,
        "domain": ev.domain,
        "url": ev.url,
        "score": ev.score,
        "verdict": ev.verdict,
        "brand": brand.ref().model_dump() if brand else None,
        "ts": ev.ts.isoformat(),
        "detail": json.loads(ev.detail_json or "{}"),
    }


def recent(limit: int = 100) -> list[dict[str, Any]]:
    with db.session() as s:
        rows = s.exec(select(db.RadarEvent).order_by(db.RadarEvent.ts.desc()).limit(limit)).all()
    return [serialize(r) for r in rows]


async def investigate(source: str, url: str, brand_id: str | None, detail: dict[str, Any], delay_s: float = 0) -> None:
    """Publish a candidate on the radar, then deep-scan it and publish the verdict."""
    first = publish(source, url, 0, "pending", brand_id, detail)
    if first is None or not _allow_deep():
        return
    if delay_s:
        await asyncio.sleep(delay_s)
    result = await scans.run_inline(url, mode="deep", source=source)
    if result is None:
        return
    with db.session() as s:
        ev = s.get(db.RadarEvent, first["id"])
        if ev:
            ev.score, ev.verdict = result.score, result.verdict
            ev.brand_id = result.brand.id if result.brand else brand_id
            d = json.loads(ev.detail_json or "{}")
            d["scan_id"] = result.id
            d["headline"] = result.headline.model_dump()
            ev.detail_json = json.dumps(d, ensure_ascii=False)
            s.add(ev)
            s.commit()
            bus.channel("radar").publish("radar", serialize(ev))
