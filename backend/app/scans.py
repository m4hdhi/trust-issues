"""Scan orchestration service: run, persist, publish, and feed the blocklist / cases / radar."""
from __future__ import annotations

import asyncio
import json
import logging
from typing import Any

from sqlmodel import select

from . import bus, db, pipeline
from .graph.campaigns import campaign_for
from .schemas import ScanResult
from .urlutil import parse

log = logging.getLogger(__name__)

_deep_sem = asyncio.Semaphore(6)
_tasks: set[asyncio.Task] = set()
HUNTER_SOURCES = {"ct", "search", "maps", "typosquat", "nrd", "report"}


def _spawn(coro) -> asyncio.Task:
    t = asyncio.create_task(coro)
    _tasks.add(t)
    t.add_done_callback(_tasks.discard)
    return t


def persist(result: ScanResult, source: str) -> None:
    site = pipeline.site_key_for(result.final_url or result.url)
    with db.session() as s:
        s.add(
            db.ScanRecord(
                id=result.id,
                input=result.input[:2000],
                url=result.url,
                domain=result.domain,
                verdict=result.verdict,
                score=result.score,
                brand_id=result.brand.id if result.brand else None,
                mode=result.mode,
                source=source,
                result_json=result.model_dump_json(),
            )
        )
        anchored = any(sig.id in ("official_brand_domain", "official_uae_domain") for sig in result.signals)
        if result.verdict == "scam" and not anchored:
            existing = s.get(db.BlockEntry, site)
            if existing is None:
                s.add(db.BlockEntry(domain=site, source="engine", reason=result.headline.en, brand_id=result.brand.id if result.brand else None,
                                    score=result.score, scan_id=result.id))
            elif existing.source == "engine":
                existing.score = result.score
                existing.scan_id = result.id
                existing.active = True
                s.add(existing)
        if result.verdict in ("scam", "suspicious") and source != "batch":
            case = s.exec(select(db.Case).where(db.Case.domain == site)).first()
            if case is None:
                s.add(db.Case(id=db.new_id("case"), domain=site, url=result.url, source=source if source in HUNTER_SOURCES else "scan",
                              verdict=result.verdict, score=result.score, brand_id=result.brand.id if result.brand else None,
                              scan_id=result.id, detail_json=json.dumps({"headline": result.headline.model_dump()}, ensure_ascii=False)))
            else:
                case.verdict, case.score, case.scan_id, case.updated_at = result.verdict, result.score, result.id, db.utcnow()
                s.add(case)
        s.commit()
    db.invalidate_blocklist()
    db.bump("scans_total")
    if result.verdict == "scam":
        db.bump("scams_detected")


async def run(raw: str, scan_id: str, mode: str, source: str) -> ScanResult | None:
    ch = bus.channel(f"scan:{scan_id}")
    emit = pipeline.make_emitter(scan_id)
    try:
        async with _deep_sem if mode == "deep" else _null():
            result = await pipeline.scan(raw, scan_id, mode=mode, source=source, emit=emit)
        result.campaign = await asyncio.to_thread(campaign_for, result)
        await asyncio.to_thread(persist, result, source)
        ch.publish("result", result.model_dump(mode="json"))
        return result
    except Exception as exc:
        log.exception("scan %s failed", scan_id)
        ch.publish("error", {"message": f"{type(exc).__name__}: {exc}"[:300]})
        return None
    finally:
        ch.close()
        asyncio.get_running_loop().call_later(300, bus.drop, f"scan:{scan_id}")


class _null:
    async def __aenter__(self):
        return self

    async def __aexit__(self, *exc):
        return False


def start(raw: str, mode: str = "deep", source: str = "web") -> str:
    parse(raw)
    scan_id = db.new_id("scan")
    bus.channel(f"scan:{scan_id}")
    _spawn(run(raw, scan_id, mode, source))
    return scan_id


async def run_inline(raw: str, mode: str = "fast", source: str = "batch") -> ScanResult | None:
    return await run(raw, db.new_id("scan"), mode, source)


def get(scan_id: str) -> dict[str, Any] | None:
    with db.session() as s:
        row = s.get(db.ScanRecord, scan_id)
        return row.result() if row else None


def latest_for_domain(site: str) -> dict[str, Any] | None:
    with db.session() as s:
        row = s.exec(select(db.ScanRecord).where(db.ScanRecord.domain == site).order_by(db.ScanRecord.created_at.desc())).first()
        return row.result() if row else None
