"""Pull UAE-targeted phishing out of the global feeds and investigate it (real detections, not samples)."""
from __future__ import annotations

import asyncio
import logging

from ..detectors import feeds
from ..registry import get_registry
from ..urlutil import parse
from . import radar

log = logging.getLogger(__name__)


async def sweep(limit: int = 40) -> int:
    reg = get_registry()
    idx = feeds.index()
    found: list[tuple[str, str]] = []
    for host in list(idx.hosts) + [u for u in idx.urls]:
        try:
            p = parse(host)
        except ValueError:
            continue
        imp = reg.impersonation(p.hostname, p.registrable)
        if imp and imp[1] != "prefix":
            found.append((p.url if host.startswith("http") else f"http://{p.hostname}/", imp[0].id))
        if len(found) >= limit:
            break
    for url, brand_id in found:
        asyncio.create_task(radar.investigate("feed", url, brand_id, {"origin": "global phishing feeds"}))
    log.info("feedwatch: %s UAE-targeted feed entries queued", len(found))
    return len(found)
