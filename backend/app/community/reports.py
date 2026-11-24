"""Community reports: anonymous, trust-weighted, verified by the engine before anyone is warned."""
from __future__ import annotations

import asyncio
import json
import logging
from datetime import datetime, timedelta, timezone
from typing import Any

from sqlmodel import select

from .. import db, scans
from ..detectors import anchors
from ..notify import webpush
from ..registry import get_registry
from ..urlutil import parse

log = logging.getLogger(__name__)

CHANNELS = {"whatsapp", "sms", "instagram", "telegram", "email", "facebook", "tiktok", "snapchat", "x", "other"}
CONFIRM_TRUST = 3.0
WAVE_REPORTS = 3


def _reporter_weight(device_ids: set[str]) -> float:
    if not device_ids:
        return 0.0
    with db.session() as s:
        devices = s.exec(select(db.Device).where(db.Device.id.in_(list(device_ids)))).all()
    known = {d.id: d.trust for d in devices}
    return sum(known.get(d, 1.0) for d in device_ids)


def submit(url: str, channel: str, note: str | None, device_id: str | None) -> dict[str, Any]:
    p = parse(url)
    site = anchors.is_user_content(p) and p.hostname or p.registrable
    channel = channel if channel in CHANNELS else "other"
    official = get_registry().is_official(p.registrable, p.hostname) and not anchors.is_user_content(p)
    report = db.Report(id=db.new_id("rep"), url=p.url, domain=site, channel=channel, note=(note or "")[:500] or None, device_id=device_id)
    recent = scans.latest_for_domain(site)
    reuse = recent and (db.utcnow() - _ts(recent["created_at"])) < timedelta(hours=6) and recent.get("mode") == "deep"
    scan_id = recent["id"] if reuse else scans.start(p.url, mode="deep", source="report")
    report.scan_id = scan_id
    with db.session() as s:
        s.add(report)
        case = s.exec(select(db.Case).where(db.Case.domain == site)).first()
        if case is None:
            s.add(db.Case(id=db.new_id("case"), domain=site, url=p.url, source="report", scan_id=scan_id,
                          status="rejected" if official else "pending",
                          detail_json=json.dumps({"channel": channel}, ensure_ascii=False)))
        s.commit()
    db.bump("reports_total")
    if not reuse:
        asyncio.get_running_loop().create_task(_after_scan(site, scan_id))
    else:
        evaluate(site)
    status = "confirmed" if _is_confirmed(site) else "pending"
    return {"report_id": report.id, "scan_id": scan_id, "status": "official" if official else status}


def _ts(value: Any) -> datetime:
    dt = value if not isinstance(value, str) else datetime.fromisoformat(value.replace("Z", "+00:00"))
    return dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)


async def _after_scan(site: str, scan_id: str) -> None:
    for _ in range(120):
        await asyncio.sleep(1)
        if scans.get(scan_id):
            break
    evaluate(site)


def _is_confirmed(site: str) -> bool:
    with db.session() as s:
        b = s.get(db.BlockEntry, site)
        return bool(b and b.active and b.source in ("community", "police"))


def evaluate(site: str) -> None:
    result = scans.latest_for_domain(site)
    with db.session() as s:
        reports = s.exec(select(db.Report).where(db.Report.domain == site)).all()
        case = s.exec(select(db.Case).where(db.Case.domain == site)).first()
        if case is None or case.status == "rejected":
            return
        devices = {r.device_id for r in reports if r.device_id}
        weight = _reporter_weight(devices) + 0.5 * sum(1 for r in reports if not r.device_id)
        verdict = (result or {}).get("verdict")
        confirmed = verdict == "scam" or (verdict == "suspicious" and weight >= CONFIRM_TRUST)
        if result:
            case.verdict, case.score, case.scan_id = verdict, result["score"], result["id"]
            case.brand_id = (result.get("brand") or {}).get("id")
        if confirmed:
            case.status = "confirmed" if case.status != "rejected" else case.status
            entry = s.get(db.BlockEntry, site)
            if entry is None:
                entry = db.BlockEntry(domain=site, source="community", reason=(result or {}).get("headline", {}).get("en", "Community report"),
                                      brand_id=case.brand_id, score=case.score, scan_id=case.scan_id)
            elif entry.source == "engine":
                entry.source = "community"
            entry.active = True
            s.add(entry)
        case.updated_at = db.utcnow()
        s.add(case)
        s.commit()
    if confirmed and len(reports) >= WAVE_REPORTS and result:
        webpush.broadcast_wave(site, result)


def set_case_status(case_id: str, status: str) -> db.Case | None:
    with db.session() as s:
        case = s.get(db.Case, case_id)
        if case is None:
            return None
        case.status = status
        case.updated_at = db.utcnow()
        s.add(case)
        entry = s.get(db.BlockEntry, case.domain)
        if status == "confirmed":
            if entry is None:
                entry = db.BlockEntry(domain=case.domain, source="police", reason="Confirmed by police analyst", brand_id=case.brand_id,
                                      score=case.score, scan_id=case.scan_id)
            entry.source, entry.active = "police", True
            s.add(entry)
        elif status == "rejected" and entry is not None:
            entry.active = False
            s.add(entry)
        reporters = s.exec(select(db.Report).where(db.Report.domain == case.domain)).all()
        for rid in {r.device_id for r in reporters if r.device_id}:
            dev = s.get(db.Device, rid)
            if dev:
                dev.trust = min(3.0, dev.trust + 0.2) if status == "confirmed" else max(0.1, dev.trust - 0.3)
                s.add(dev)
        s.commit()
        return case


def trending(limit: int = 30) -> list[dict[str, Any]]:
    since = db.utcnow() - timedelta(hours=24)
    reg = get_registry()
    with db.session() as s:
        entries = s.exec(select(db.BlockEntry).where(db.BlockEntry.active == True).order_by(db.BlockEntry.created_at.desc()).limit(400)).all()  # noqa: E712
        reports = s.exec(select(db.Report)).all()
    by_site: dict[str, list[db.Report]] = {}
    for r in reports:
        by_site.setdefault(r.domain, []).append(r)
    items = []
    for e in entries:
        rs = by_site.get(e.domain, [])
        channels: dict[str, int] = {}
        for r in rs:
            channels[r.channel] = channels.get(r.channel, 0) + 1
        res = scans.get(e.scan_id) if e.scan_id else None
        brand = reg.brands.get(e.brand_id) if e.brand_id else None
        items.append({
            "domain": e.domain,
            "url": (res or {}).get("url", f"http://{e.domain}/"),
            "brand": brand.ref().model_dump() if brand else None,
            "verdict": (res or {}).get("verdict", "scam"),
            "score": (res or {}).get("score", e.score),
            "reports_24h": sum(1 for r in rs if r.created_at.replace(tzinfo=timezone.utc) >= since),
            "reports_total": len(rs),
            "channels": channels,
            "source": e.source,
            "first_seen": e.created_at.isoformat(),
            "last_seen": max([r.created_at for r in rs], default=e.created_at).isoformat(),
            "headline": (res or {}).get("headline") or {"en": e.reason, "ar": e.reason},
            "scan_id": e.scan_id,
        })
    items.sort(key=lambda x: (x["reports_24h"], x["reports_total"], x["last_seen"]), reverse=True)
    return items[:limit]
