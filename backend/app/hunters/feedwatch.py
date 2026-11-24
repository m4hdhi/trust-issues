"""Pull UAE-targeted phishing out of the global feeds and investigate it (real detections, not samples)."""
from __future__ import annotations

import asyncio
import logging

from ..detectors import feeds
from ..registry import get_registry
from ..urlutil import parse
from . import radar
from .cpu import breathe, offload

log = logging.getLogger(__name__)


def _uae_targeted(entries: list[str], limit: int) -> list[tuple[str, str]]:
    reg = get_registry()
    found: list[tuple[str, str]] = []
    for i, host in enumerate(entries):
        breathe(i)
        try:
            p = parse(host)
        except ValueError:
            continue
        imp = reg.impersonation(p.hostname, p.registrable)
        if imp and imp[1] != "prefix":
            found.append((p.url if host.startswith("http") else f"http://{p.hostname}/", imp[0].id))
        if len(found) >= limit:
            break
    return found


async def sweep(limit: int = 40) -> int:
    idx = feeds.index()
    found = await offload(_uae_targeted, list(idx.hosts) + list(idx.urls), limit)
    for url, brand_id in found:
        asyncio.create_task(radar.investigate("feed", url, brand_id, {"origin": "global phishing feeds"}))
    log.info("feedwatch: %s UAE-targeted feed entries queued", len(found))
    return len(found)
