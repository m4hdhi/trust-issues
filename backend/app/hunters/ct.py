"""Certificate Transparency monitor: catches look-alike UAE domains the moment their HTTPS certificate is issued."""
from __future__ import annotations

import asyncio
import base64
import logging
import re
import struct

from cryptography import x509

from .. import db
from ..http import client
from ..pipeline import url_model_or_none
from ..registry import get_registry
from ..urlutil import parse
from . import radar

log = logging.getLogger(__name__)

LOGS = [
    "https://ct.cloudflare.com/logs/nimbus2026/",
    "https://elephant2026h2.ct.sectigo.com/",
    "https://tiger2026h2.ct.sectigo.com/",
    "https://wyvern.ct.digicert.com/2026h2/",
    "https://sphinx.ct.digicert.com/2026h2/",
]
UAE_HINTS = {"uae", "dubai", "abudhabi", "sharjah", "ajman", "emirates", "ae", "rak", "alain"}
stats = {"certs": 0, "candidates": 0}


def _names_from_entry(entry: dict) -> list[str]:
    leaf = base64.b64decode(entry["leaf_input"])
    entry_type = struct.unpack(">H", leaf[10:12])[0]
    if entry_type == 0:
        length = int.from_bytes(leaf[12:15], "big")
        der = leaf[15 : 15 + length]
    else:
        extra = base64.b64decode(entry["extra_data"])
        length = int.from_bytes(extra[0:3], "big")
        der = extra[3 : 3 + length]
    cert = x509.load_der_x509_certificate(der)
    names: list[str] = []
    try:
        san = cert.extensions.get_extension_for_class(x509.SubjectAlternativeName)
        names = san.value.get_values_for_type(x509.DNSName)
    except x509.ExtensionNotFound:
        cn = cert.subject.get_attributes_for_oid(x509.NameOID.COMMON_NAME)
        names = [cn[0].value] if cn else []
    return [n.lstrip("*.").lower() for n in names]


def assess(host: str) -> tuple[str | None, float] | None:
    try:
        p = parse(host)
    except ValueError:
        return None
    reg = get_registry()
    if reg.is_official(p.registrable, p.hostname):
        return None
    model = url_model_or_none()
    if model and model.tranco_rank(p.registrable):
        return None
    imp = reg.impersonation(p.hostname, p.registrable)
    if imp:
        return imp[0].id, 1.0
    if model and UAE_HINTS & set(re.split(r"[.\-]", p.hostname)):
        score = model.score_domain(p.hostname)
        if score >= 0.93:
            return None, score
    return None


BATCH_PAUSE_S = 0.5


def _scan_batch(entries: list[dict]) -> tuple[int, list[tuple[str, tuple[str, float]]]]:
    """Parse one batch of log entries and match their names against the brand watchlist (runs in a worker thread)."""
    parsed = 0
    hits: list[tuple[str, tuple[str, float]]] = []
    for e in entries:
        try:
            names = _names_from_entry(e)
        except Exception:
            continue
        parsed += 1
        for host in set(names):
            verdict = assess(host)
            if verdict:
                hits.append((host, verdict))
    return parsed, hits


async def _poll_log(base: str) -> None:
    position: int | None = None
    while True:
        try:
            sth = (await client().get(base + "ct/v1/get-sth", timeout=10.0)).json()
            size = sth["tree_size"]
            if position is None:
                position = max(0, size - 256)
            while position < size:
                end = min(size - 1, position + 255)
                r = await client().get(base + "ct/v1/get-entries", params={"start": position, "end": end}, timeout=15.0)
                entries = r.json().get("entries", [])
                if not entries:
                    break
                parsed, hits = await asyncio.to_thread(_scan_batch, entries)
                stats["certs"] += parsed
                for host, (brand_id, conf) in hits:
                    stats["candidates"] += 1
                    asyncio.create_task(radar.investigate("ct", f"https://{host}/", brand_id,
                                                          {"log": base.split("//")[1].split("/")[0], "confidence": conf}, delay_s=45))
                position += len(entries)
                db.bump("ct_certs", len(entries))
                if size - position > 20000:
                    position = size - 256
                await asyncio.sleep(BATCH_PAUSE_S)
            await asyncio.sleep(4)
        except Exception as exc:
            log.info("ct log %s error: %s", base, exc)
            await asyncio.sleep(20)


async def run() -> None:
    await asyncio.gather(*(_poll_log(b) for b in LOGS))
