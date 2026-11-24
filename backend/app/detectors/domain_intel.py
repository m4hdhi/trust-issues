"""Domain registration, DNS, hosting and TLS intelligence (RDAP/WHOIS, Team Cymru, crt.sh)."""
from __future__ import annotations

import asyncio
import logging
import ssl
from datetime import datetime, timezone
from typing import Any

import dns.asyncresolver
import dns.resolver
from cryptography import x509

from ..http import client
from ..schemas import DomainIntel

log = logging.getLogger(__name__)

_resolver = dns.asyncresolver.Resolver()
_resolver.nameservers = ["1.1.1.1", "8.8.8.8"]
_resolver.lifetime = 3.0
_cache: dict[str, DomainIntel] = {}


def _parse_dt(s: str | None) -> datetime | None:
    if not s:
        return None
    try:
        dt = datetime.fromisoformat(s.replace("Z", "+00:00"))
        return dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)
    except ValueError:
        return None


def _vcard(entity: dict[str, Any], field_name: str) -> str | None:
    for item in (entity.get("vcardArray") or [None, []])[1]:
        if item and item[0] == field_name:
            return item[3] if isinstance(item[3], str) else None
    return None


def _find_abuse(entities: list[dict[str, Any]]) -> str | None:
    for e in entities or []:
        if "abuse" in (e.get("roles") or []):
            mail = _vcard(e, "email")
            if mail:
                return mail
        nested = _find_abuse(e.get("entities") or [])
        if nested:
            return nested
    return None


async def rdap_domain(domain: str) -> dict[str, Any]:
    r = await client().get(f"https://rdap.org/domain/{domain}", timeout=6.0, headers={"Accept": "application/rdap+json"})
    if r.status_code != 200:
        return {}
    data = r.json()
    out: dict[str, Any] = {}
    for ev in data.get("events", []):
        if ev.get("eventAction") == "registration":
            out["registered"] = _parse_dt(ev.get("eventDate"))
    for e in data.get("entities", []):
        if "registrar" in (e.get("roles") or []):
            out["registrar"] = _vcard(e, "fn")
            out["registrar_abuse_email"] = _find_abuse(e.get("entities") or []) or _find_abuse([e])
    out["nameservers"] = [n.get("ldhName", "").lower() for n in data.get("nameservers", []) if n.get("ldhName")]
    return out


def _whois_sync(domain: str) -> dict[str, Any]:
    import whois

    w = whois.whois(domain)
    created = w.creation_date[0] if isinstance(w.creation_date, list) else w.creation_date
    if isinstance(created, datetime) and created.tzinfo is None:
        created = created.replace(tzinfo=timezone.utc)
    emails = w.emails if isinstance(w.emails, list) else [w.emails] if w.emails else []
    ns = w.name_servers if isinstance(w.name_servers, list) else [w.name_servers] if w.name_servers else []
    return {
        "registered": created if isinstance(created, datetime) else None,
        "registrar": w.registrar,
        "registrar_abuse_email": next((e for e in emails if "abuse" in e.lower()), emails[0] if emails else None),
        "nameservers": [n.lower() for n in ns if n],
    }


async def registration(domain: str) -> dict[str, Any]:
    try:
        data = await rdap_domain(domain)
        if data.get("registered"):
            return data
    except Exception as exc:
        log.info("rdap %s failed: %s", domain, exc)
        data = {}
    try:
        w = await asyncio.wait_for(asyncio.to_thread(_whois_sync, domain), timeout=6.0)
        return {**w, **{k: v for k, v in data.items() if v}}
    except Exception as exc:
        log.info("whois %s failed: %s", domain, exc)
        return data


async def resolve(hostname: str, rdtype: str = "A") -> list[str]:
    try:
        ans = await _resolver.resolve(hostname, rdtype)
        return [r.to_text().strip('"').rstrip(".") for r in ans]
    except Exception:
        return []


async def asn_info(ip: str) -> dict[str, Any]:
    if ":" in ip:
        return {}
    rev = ".".join(reversed(ip.split(".")))
    txt = await resolve(f"{rev}.origin.asn.cymru.com", "TXT")
    if not txt:
        return {}
    parts = [p.strip() for p in txt[0].split("|")]
    asn = parts[0].split()[0]
    out = {"asn": f"AS{asn}", "country": parts[2] if len(parts) > 2 else None}
    name = await resolve(f"AS{asn}.asn.cymru.com", "TXT")
    if name:
        out["as_org"] = name[0].split("|")[-1].strip()
    return out


async def ip_abuse(ip: str) -> str | None:
    try:
        r = await client().get(f"https://rdap.org/ip/{ip}", timeout=6.0)
        if r.status_code == 200:
            return _find_abuse(r.json().get("entities") or [])
    except Exception:
        return None
    return None


async def tls_info(hostname: str) -> dict[str, Any]:
    ctx = ssl.create_default_context()
    ctx.check_hostname = False
    ctx.verify_mode = ssl.CERT_NONE
    try:
        reader, writer = await asyncio.wait_for(
            asyncio.open_connection(hostname, 443, ssl=ctx, server_hostname=hostname), timeout=4.0
        )
    except Exception:
        return {}
    try:
        der = writer.get_extra_info("ssl_object").getpeercert(binary_form=True)
        cert = x509.load_der_x509_certificate(der)
        issuer = cert.issuer.get_attributes_for_oid(x509.NameOID.ORGANIZATION_NAME)
        cn = cert.issuer.get_attributes_for_oid(x509.NameOID.COMMON_NAME)
        subject_org = cert.subject.get_attributes_for_oid(x509.NameOID.ORGANIZATION_NAME)
        return {
            "tls_issuer": (issuer[0].value if issuer else cn[0].value if cn else None),
            "tls_not_before": cert.not_valid_before_utc,
            "tls_org": subject_org[0].value if subject_org else None,
        }
    finally:
        writer.close()


async def crtsh_count(domain: str) -> int | None:
    try:
        r = await client().get("https://crt.sh/", params={"q": domain, "output": "json"}, timeout=7.0)
        if r.status_code == 200:
            return len({row.get("serial_number") for row in r.json()})
    except Exception:
        return None
    return None


async def gather(hostname: str, registrable: str, deep: bool) -> DomainIntel:
    key = f"{hostname}|{deep}"
    if key in _cache:
        return _cache[key]
    now = datetime.now(timezone.utc)
    reg_task = asyncio.create_task(registration(registrable))
    ips_task = asyncio.create_task(resolve(hostname, "A"))
    tls_task = asyncio.create_task(tls_info(hostname)) if deep else None
    ct_task = asyncio.create_task(crtsh_count(registrable)) if deep else None
    ips = await ips_task
    asn = await asn_info(ips[0]) if ips else {}
    abuse = await ip_abuse(ips[0]) if (ips and deep) else None
    reg = await reg_task
    tls = await tls_task if tls_task else {}
    ct = await ct_task if ct_task else None
    if not reg.get("nameservers"):
        reg["nameservers"] = await resolve(registrable, "NS")
    registered = reg.get("registered")
    nb = tls.get("tls_not_before")
    intel = DomainIntel(
        registered=registered,
        age_days=(now - registered).days if registered else None,
        registrar=reg.get("registrar"),
        registrar_abuse_email=reg.get("registrar_abuse_email"),
        nameservers=reg.get("nameservers") or [],
        ips=ips,
        asn=asn.get("asn"),
        as_org=asn.get("as_org"),
        country=asn.get("country"),
        host_abuse_email=abuse,
        tls_issuer=tls.get("tls_issuer"),
        tls_not_before=nb,
        tls_age_days=(now - nb).days if nb else None,
        tls_org=tls.get("tls_org"),
        ct_cert_count=ct,
    )
    _cache[key] = intel
    return intel
