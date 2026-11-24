"""Protective DNS over HTTPS (RFC 8484): blocks confirmed scam domains on every app of a protected phone."""
from __future__ import annotations

import asyncio
import base64
import logging
import time
from typing import Any

from dnslib import QTYPE, RCODE, DNSRecord
from sqlmodel import select

from .. import db, family, scans
from ..detectors import feeds
from ..http import client
from ..notify import webpush
from ..pipeline import url_model_or_none
from ..registry import get_registry
from ..urlutil import parse, registrable_of

log = logging.getLogger(__name__)

UPSTREAM = "https://cloudflare-dns.com/dns-query"
# Harmless page Google publishes for testing security tools: it opens everywhere, so blocking it shows protection is on.
TEST_DOMAINS = {"testsafebrowsing.appspot.com"}
TEST_HEADLINE = {
    "en": "Protection test: a safe Google test page, blocked to show your protection works",
    "ar": "اختبار الحماية: صفحة اختبار آمنة من Google، حُظرت لتأكيد أن الحماية تعمل",
}
_cache: dict[tuple[str, int], tuple[float, bytes]] = {}
_queued: dict[str, float] = {}


def invalidate() -> None:
    db.invalidate_blocklist()


def policy(name: str) -> tuple[str, db.BlockEntry | None, str | None]:
    host = name.rstrip(".").lower()
    if not host or "." not in host:
        return "allow", None, None
    if host in TEST_DOMAINS:
        return "block", None, "test"
    reg = registrable_of(host)
    registry = get_registry()
    if registry.is_official(reg, host):
        return "allow", None, None
    bl = db.cached_blocklist()
    labels = host.split(".")
    for i in range(len(labels) - 1):
        cand = ".".join(labels[i:])
        if cand in bl:
            return "block", bl[cand], bl[cand].source
    if feeds.index().host_hit(host):
        return "block", None, "feed"
    return "allow", None, None


def _maybe_queue(host: str) -> None:
    if host in _queued and time.time() - _queued[host] < 3600:
        return
    model = url_model_or_none()
    if model is None:
        return
    p = parse(host)
    if model.tranco_rank(p.registrable):
        return
    if model.score_domain(host) >= 0.9 and get_registry().impersonation(p.hostname, p.registrable):
        _queued[host] = time.time()
        scans.start(f"https://{host}/", mode="deep", source="dns")


def _blocked_response(req: DNSRecord) -> bytes:
    reply = req.reply()
    reply.header.rcode = RCODE.NXDOMAIN
    return bytes(reply.pack())


async def _forward(wire: bytes, qname: str, qtype: int) -> bytes:
    key = (qname, qtype)
    hit = _cache.get(key)
    if hit and hit[0] > time.time():
        req = DNSRecord.parse(wire)
        cached = DNSRecord.parse(hit[1])
        cached.header.id = req.header.id
        return bytes(cached.pack())
    r = await client().post(UPSTREAM, content=wire, headers={"Content-Type": "application/dns-message", "Accept": "application/dns-message"}, timeout=4.0)
    r.raise_for_status()
    data = r.content
    try:
        ttl = min((rr.ttl for rr in DNSRecord.parse(data).rr), default=60)
    except Exception:
        ttl = 30
    _cache[key] = (time.time() + max(10, min(ttl, 300)), data)
    if len(_cache) > 50000:
        _cache.clear()
    return data


async def resolve(wire: bytes, device_id: str | None) -> bytes:
    req = DNSRecord.parse(wire)
    q = req.q
    qname = str(q.qname).rstrip(".").lower()
    action, entry, source = policy(qname)
    loop = asyncio.get_running_loop()
    mem = family.member(device_id)
    if mem and family.needs_touch(device_id):
        loop.run_in_executor(None, family.touch, device_id)
    if action == "block":
        if source != "test":
            db.bump("blocked_queries")
        if device_id:
            loop.run_in_executor(None, _record_block, device_id, qname, entry)
        return _blocked_response(req)
    if mem and q.qtype in (QTYPE.A, QTYPE.AAAA, QTYPE.HTTPS):
        try:
            registrable = registrable_of(qname)
        except ValueError:
            registrable = qname
        rule = family.rule_for(mem["family_id"], registrable)
        if rule == "block":
            return _blocked_response(req)
        if rule != "allow" and mem["strict"]:
            reason = family.risky(qname)
            if reason:
                loop.run_in_executor(None, family.hold, mem, qname, reason)
                return _blocked_response(req)
    if q.qtype in (QTYPE.A, QTYPE.AAAA, QTYPE.HTTPS):
        try:
            _maybe_queue(qname)
        except ValueError:
            pass
    return await _forward(wire, qname, q.qtype)


def _record_block(device_id: str, domain: str, entry: db.BlockEntry | None) -> None:
    with db.session() as s:
        if s.get(db.Device, device_id) is None:
            return
        s.add(db.BlockEvent(device_id=device_id, domain=domain, scan_id=entry.scan_id if entry else None))
        s.commit()
    result = scans.get(entry.scan_id) if entry and entry.scan_id else None
    webpush.notify_block(device_id, domain, result, headline=TEST_HEADLINE if domain in TEST_DOMAINS else None)
    mem = family.member(device_id)
    if mem:
        family.on_block(mem, domain, TEST_HEADLINE if domain in TEST_DOMAINS else (result or {}).get("headline"), domain in TEST_DOMAINS)


def decode_get(dns_param: str) -> bytes:
    pad = "=" * (-len(dns_param) % 4)
    return base64.urlsafe_b64decode(dns_param + pad)


def blocks_for(device_id: str, limit: int = 50) -> list[dict[str, Any]]:
    with db.session() as s:
        rows = s.exec(select(db.BlockEvent).where(db.BlockEvent.device_id == device_id).order_by(db.BlockEvent.ts.desc()).limit(limit)).all()
    out = []
    for r in rows:
        res = scans.get(r.scan_id) if r.scan_id else None
        out.append({
            "domain": r.domain,
            "ts": r.ts.isoformat(),
            "brand": (res or {}).get("brand"),
            "headline": TEST_HEADLINE if r.domain in TEST_DOMAINS else (res or {}).get("headline") or {"en": "Known scam domain", "ar": "نطاق احتيالي معروف"},
            "scan_id": r.scan_id,
        })
    return out
