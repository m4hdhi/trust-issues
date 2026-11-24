"""Local mirror of public phishing / malicious-URL feeds, refreshed periodically."""
from __future__ import annotations

import asyncio
import logging
import time
from dataclasses import dataclass, field
from typing import Callable

from ..config import get_settings
from ..http import client
from ..urlutil import parse
from .anchors import SHORTENERS, USER_CONTENT_HOSTS

from ..hunters.cpu import breathe, offload
log = logging.getLogger(__name__)

FEEDS = {
    "openphish": "https://openphish.com/feed.txt",
    "phishing_database_links_new": "https://raw.githubusercontent.com/Phishing-Database/Phishing.Database/master/phishing-links-NEW-today.txt",
    "phishing_database_domains": "https://raw.githubusercontent.com/Phishing-Database/Phishing.Database/master/phishing-domains-ACTIVE.txt",
}


@dataclass
class FeedIndex:
    urls: dict[str, str] = field(default_factory=dict)
    hosts: dict[str, str] = field(default_factory=dict)
    loaded_at: float = 0.0
    counts: dict[str, int] = field(default_factory=dict)

    def lookup(self, url: str) -> tuple[str, str] | None:
        try:
            p = parse(url)
        except ValueError:
            return None
        key = p.url.rstrip("/")
        if key in self.urls:
            return self.urls[key], "url"
        if p.hostname in self.hosts:
            return self.hosts[p.hostname], "host"
        return None

    def host_hit(self, hostname: str) -> str | None:
        return self.hosts.get(hostname)


_index = FeedIndex()
_lock = asyncio.Lock()


def index() -> FeedIndex:
    return _index


def _host_allowed(url: str) -> str | None:
    try:
        p = parse(url)
    except ValueError:
        return None
    bare = p.hostname.removeprefix("www.")
    if bare in USER_CONTENT_HOSTS or p.registrable in USER_CONTENT_HOSTS and bare == p.registrable:
        return None
    if p.hostname in SHORTENERS or p.registrable in SHORTENERS:
        return None
    return p.hostname


def _ingest_url(idx: FeedIndex, url: str, source: str) -> None:
    try:
        p = parse(url)
    except ValueError:
        return
    idx.urls.setdefault(p.url.rstrip("/"), source)
    host = _host_allowed(url)
    if host:
        idx.hosts.setdefault(host, source)


async def _fetch(name: str, url: str) -> str:
    cache = get_settings().cache_dir / f"feed_{name}.txt"
    try:
        r = await client().get(url, timeout=60.0)
        r.raise_for_status()
        cache.write_text(r.text, encoding="utf-8")
        return r.text
    except Exception as exc:
        log.warning("feed %s download failed: %s", name, exc)
        return cache.read_text(encoding="utf-8") if cache.exists() else ""


def _build(texts: list[str], is_protected: Callable[[str, str], bool] | None) -> FeedIndex:
    idx = FeedIndex()
    for (name, _), text in zip(FEEDS.items(), texts):
        before = len(idx.urls) + len(idx.hosts)
        if name == "phishing_database_domains":
            for ln in text.splitlines():
                ln = ln.strip().lower()
                if ln and not ln.startswith("#") and _host_allowed(ln):
                    idx.hosts.setdefault(ln, "phishing_database")
        else:
            for ln in text.splitlines():
                ln = ln.strip()
                if ln.startswith("http"):
                    _ingest_url(idx, ln, name.split("_links")[0])
        idx.counts[name] = len(idx.urls) + len(idx.hosts) - before
    if is_protected:
        for i, h in enumerate(list(idx.hosts)):
            breathe(i)
            try:
                p = parse(h)
            except ValueError:
                continue
            if is_protected(p.registrable, p.hostname):
                del idx.hosts[h]
    return idx


async def refresh(is_protected: Callable[[str, str], bool] | None = None) -> FeedIndex:
    global _index
    async with _lock:
        texts = await asyncio.gather(*(_fetch(n, u) for n, u in FEEDS.items()))
        idx = await offload(_build, list(texts), is_protected)
        idx.loaded_at = time.time()
        _index = idx
        log.info("feeds loaded: %s urls, %s hosts", len(idx.urls), len(idx.hosts))
        return idx
