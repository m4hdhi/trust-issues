"""Typosquat sweeper (dnstwist) and newly-registered-domain (WhoisDS) hunters."""
from __future__ import annotations

import asyncio
import base64
import io
import logging
import zipfile
from datetime import datetime, timedelta, timezone

import dnstwist

from ..http import client
from ..config import get_settings
from ..pipeline import instant
from ..registry import get_registry
from . import radar
from .cpu import breathe, offload
from .ct import assess

log = logging.getLogger(__name__)

PRIORITY = ["tamm", "uaepass", "adpolice", "dubaipolice", "salik", "darb", "rta", "emiratesnbd", "adcb", "fab", "emiratespost", "etisalat", "du", "dewa", "icp"]


def _registered_permutations(domain: str) -> list[dict]:
    return dnstwist.run(domain=domain, registered=True, format="null", threads=4 if get_settings().low_resource else 32,
                        fuzzers="addition,bitsquatting,homoglyph,hyphenation,insertion,omission,repetition,replacement,subdomain,transposition,vowel-swap,dictionary")


async def sweep_typosquats() -> int:
    reg = get_registry()
    found = 0
    brands = [reg.brands[b] for b in PRIORITY if b in reg.brands] or list(reg.brands.values())[:12]
    for brand in brands:
        for domain in brand.official_domains[:2]:
            if len(domain.split(".")[0]) < 5:
                continue
            try:
                rows = await asyncio.to_thread(_registered_permutations, domain)
            except Exception as exc:
                log.info("dnstwist %s failed: %s", domain, exc)
                continue
            for row in rows:
                d = row.get("domain", "")
                if d == domain or not row.get("dns_a") or reg.is_official(d, d):
                    continue
                if instant(f"http://{d}/")["score"] < 25:
                    continue
                found += 1
                asyncio.create_task(radar.investigate("typosquat", f"http://{d}/", brand.id,
                                                      {"fuzzer": row.get("fuzzer"), "official": domain, "ip": (row.get("dns_a") or [None])[0]}))
    return found


async def sweep_nrd() -> int:
    day = (datetime.now(timezone.utc) - timedelta(days=1)).strftime("%Y-%m-%d")
    token = base64.b64encode(f"{day}.zip".encode()).decode()
    url = f"https://whoisds.com//whois-database/newly-registered-domains/{token}/nrd"
    try:
        r = await client().get(url, timeout=60.0)
        r.raise_for_status()
        with zipfile.ZipFile(io.BytesIO(r.content)) as z:
            names = z.read(z.namelist()[0]).decode("utf-8", "ignore").split()
    except Exception as exc:
        log.info("NRD download failed: %s", exc)
        return 0
    matches = await offload(_match_all, names)
    for host, verdict in matches:
        asyncio.create_task(radar.investigate("nrd", f"http://{host}/", verdict[0], {"registered": day}))
    log.info("NRD %s: %s domains, %s candidates", day, len(names), len(matches))
    return len(matches)


def _match_all(names: list[str]) -> list[tuple[str, tuple[str, float]]]:
    out = []
    for i, raw in enumerate(names):
        breathe(i)
        host = raw.strip().lower()
        verdict = assess(host)
        if verdict:
            out.append((host, verdict))
    return out
