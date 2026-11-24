"""Real-time threat-intelligence lookups (Google Safe Browsing, VirusTotal, URLhaus, urlscan.io)."""
from __future__ import annotations

import asyncio
import base64
import logging
import time
from collections import deque
from dataclasses import dataclass, field
from typing import Any

from ..config import get_settings
from ..http import client

log = logging.getLogger(__name__)

SB_ENDPOINT = "https://safebrowsing.googleapis.com/v4/threatMatches:find"
_sb_cache: dict[str, list[str]] = {}
VT_PER_MINUTE = 4
_vt_calls: deque[float] = deque()
_vt_cache: dict[str, dict[str, int] | None] = {}


@dataclass
class IntelResult:
    safe_browsing: list[str] = field(default_factory=list)
    virustotal: dict[str, int] | None = None
    virustotal_domain: dict[str, int] | None = None
    urlhaus: str | None = None
    urlscan: dict[str, Any] | None = None
    errors: dict[str, str] = field(default_factory=dict)


async def safe_browsing_batch(urls: list[str]) -> dict[str, list[str]]:
    key = get_settings().google_safe_browsing_key
    if not key or not urls:
        return {}
    out: dict[str, list[str]] = {}
    for i in range(0, len(urls), 500):
        chunk = urls[i : i + 500]
        body = {
            "client": {"clientId": "trust-issues", "clientVersion": "1.0"},
            "threatInfo": {
                "threatTypes": ["MALWARE", "SOCIAL_ENGINEERING", "UNWANTED_SOFTWARE", "POTENTIALLY_HARMFUL_APPLICATION"],
                "platformTypes": ["ANY_PLATFORM"],
                "threatEntryTypes": ["URL"],
                "threatEntries": [{"url": u} for u in chunk],
            },
        }
        r = await client().post(SB_ENDPOINT, params={"key": key}, json=body, timeout=10.0)
        r.raise_for_status()
        for m in r.json().get("matches", []):
            out.setdefault(m["threat"]["url"], []).append(m["threatType"])
    return out


async def prime_safe_browsing(urls: list[str]) -> None:
    todo = [u for u in urls if u not in _sb_cache]
    hits = await safe_browsing_batch(todo)
    for u in todo:
        _sb_cache[u] = hits.get(u, [])


async def _safe_browsing_one(url: str) -> dict[str, list[str]]:
    if url in _sb_cache:
        return {url: _sb_cache[url]} if _sb_cache[url] else {}
    hits = await safe_browsing_batch([url])
    _sb_cache[url] = hits.get(url, [])
    return hits


def _vt_slot() -> bool:
    """Free VirusTotal keys allow 4 lookups a minute; skip the lookup instead of queueing when the budget is spent."""
    now = time.monotonic()
    while _vt_calls and now - _vt_calls[0] > 60:
        _vt_calls.popleft()
    if len(_vt_calls) >= VT_PER_MINUTE:
        return False
    _vt_calls.append(now)
    return True


async def _vt_stats(path: str) -> dict[str, int] | None:
    if path in _vt_cache:
        return _vt_cache[path]
    if not _vt_slot():
        raise RuntimeError("VirusTotal rate limit")
    r = await client().get(f"https://www.virustotal.com/api/v3/{path}", headers={"x-apikey": get_settings().virustotal_key}, timeout=8.0)
    if r.status_code == 429:
        _vt_calls.extend([time.monotonic()] * VT_PER_MINUTE)
        raise RuntimeError("VirusTotal rate limit")
    stats = r.json()["data"]["attributes"].get("last_analysis_stats") if r.status_code == 200 else None
    if r.status_code in (200, 404):
        _vt_cache[path] = stats
    return stats


async def _virustotal(url: str, domain: str) -> tuple[dict[str, int] | None, dict[str, int] | None]:
    if not get_settings().virustotal_key:
        return None, None
    url_id = base64.urlsafe_b64encode(url.encode()).decode().strip("=")
    return await _vt_stats(f"urls/{url_id}"), await _vt_stats(f"domains/{domain}")


async def _urlhaus(url: str) -> str | None:
    key = get_settings().urlhaus_auth_key
    if not key:
        return None
    r = await client().post(
        "https://urlhaus-api.abuse.ch/v1/url/", data={"url": url}, headers={"Auth-Key": key}, timeout=8.0
    )
    if r.status_code != 200:
        return None
    data = r.json()
    if data.get("query_status") == "ok":
        return data.get("threat") or "malware_download"
    return None


async def urlscan_search(query: str, size: int = 25) -> list[dict[str, Any]]:
    key = get_settings().urlscan_key
    if not key:
        return []
    r = await client().get(
        "https://urlscan.io/api/v1/search/",
        params={"q": query, "size": size},
        headers={"API-Key": key},
        timeout=10.0,
    )
    if r.status_code != 200:
        return []
    return r.json().get("results", [])


async def _urlscan(domain: str) -> dict[str, Any] | None:
    results = await urlscan_search(f"page.domain:{domain}", size=20)
    if not results:
        return None
    malicious = [x for x in results if (x.get("verdicts") or {}).get("malicious")]
    first = results[-1]
    return {
        "scans": len(results),
        "malicious": len(malicious),
        "first_seen": first.get("task", {}).get("time"),
        "ips": sorted({x.get("page", {}).get("ip") for x in results if x.get("page", {}).get("ip")}),
        "result": results[0].get("result"),
        "screenshot": results[0].get("screenshot"),
    }


async def _guard(name: str, coro, res: IntelResult):
    try:
        return await coro
    except Exception as exc:
        res.errors[name] = type(exc).__name__
        log.info("intel %s failed: %s", name, exc)
        return None


async def lookup(url: str, domain: str, deep: bool) -> IntelResult:
    res = IntelResult()
    tasks = [_guard("safe_browsing", _safe_browsing_one(url), res), _guard("urlhaus", _urlhaus(url), res)]
    if deep:
        tasks += [_guard("virustotal", _virustotal(url, domain), res), _guard("urlscan", _urlscan(domain), res)]
    out = await asyncio.gather(*tasks)
    sb = out[0] or {}
    res.safe_browsing = sorted({t for v in sb.values() for t in v})
    res.urlhaus = out[1]
    if deep:
        vt = out[2] or (None, None)
        res.virustotal, res.virustotal_domain = vt
        res.urlscan = out[3]
    return res
