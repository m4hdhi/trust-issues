"""Takedown request drafts and blocklist exports (plain domains, DNS RPZ zone, STIX 2.1)."""
from __future__ import annotations

import json
import uuid
from datetime import datetime, timezone
from typing import Any
from urllib.parse import quote

from ..config import get_settings
from .text import defang


def drafts(r: dict[str, Any]) -> dict[str, Any]:
    base = get_settings().public_base_url.rstrip("/")
    di = r.get("domain_intel", {})
    brand = (r.get("brand") or {}).get("name_en", "a UAE organisation")
    evidence = f"{base}/api/scans/{r['id']}/evidence.pdf"
    reasons = "\n".join([f"  - {s['title']['en']}" for s in r.get("signals", []) if s["weight"] > 0][:6])
    common = (
        f"Domain: {r['domain']}\nURL (defanged): {defang(r.get('final_url') or r['url'])}\n"
        f"IP addresses: {', '.join(di.get('ips') or []) or 'n/a'}\nDetected: {r.get('evidence', {}).get('captured_at_utc')}\n"
        f"Risk score: {r['score']}/100\nFindings:\n{reasons}\n\nEvidence pack (screenshots, WHOIS, hashes): {evidence}\n"
    )
    subject = f"Phishing takedown request: {r['domain']} impersonating {brand}"
    return {
        "registrar": {
            "to": di.get("registrar_abuse_email") or "",
            "subject": subject,
            "body": f"Dear {di.get('registrar') or 'Registrar'} abuse team,\n\nThe domain below is being used for fraud targeting residents of the United Arab Emirates by impersonating {brand}. "
                    f"We request suspension of the domain under your acceptable-use policy.\n\n{common}\nRegards,\nCybercrime unit (prepared with Trust Issues | أزمة ثقة)",
        },
        "host": {
            "to": di.get("host_abuse_email") or "",
            "subject": subject,
            "body": f"Dear {di.get('as_org') or 'hosting provider'} abuse team,\n\nContent hosted on your network is a phishing page impersonating {brand}. "
                    f"Please remove the content and preserve logs for law-enforcement requests.\n\n{common}\nRegards,\nCybercrime unit (prepared with Trust Issues | أزمة ثقة)",
        },
        "safe_browsing_url": f"https://safebrowsing.google.com/safebrowsing/report_phish/?url={quote(r.get('final_url') or r['url'])}",
    }


def rpz(domains: list[str]) -> str:
    now = datetime.now(timezone.utc)
    serial = now.strftime("%Y%m%d%H")
    lines = [
        "$TTL 300",
        f"@ IN SOA rpz.trust-issues. abuse.trust-issues. ({serial} 3600 600 86400 300)",
        "@ IN NS localhost.",
        f"; Trust Issues | ازمة ثقة scam blocklist · {len(domains)} domains · generated {now.isoformat()}",
    ]
    for d in domains:
        lines.append(f"{d} CNAME .")
        lines.append(f"*.{d} CNAME .")
    return "\n".join(lines) + "\n"


def stix(entries: list[dict[str, Any]]) -> str:
    now = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%S.000Z")
    identity = "identity--" + str(uuid.uuid5(uuid.NAMESPACE_DNS, "trust-issues.ae"))
    objects: list[dict[str, Any]] = [{
        "type": "identity", "spec_version": "2.1", "id": identity, "created": now, "modified": now,
        "name": "Trust Issues | أزمة ثقة", "identity_class": "system",
    }]
    for e in entries:
        objects.append({
            "type": "indicator",
            "spec_version": "2.1",
            "id": "indicator--" + str(uuid.uuid5(uuid.NAMESPACE_DNS, e["domain"])),
            "created": now,
            "modified": now,
            "created_by_ref": identity,
            "name": f"Fraud domain {e['domain']}",
            "description": e.get("reason") or "",
            "indicator_types": ["malicious-activity"],
            "pattern": f"[domain-name:value = '{e['domain']}']",
            "pattern_type": "stix",
            "valid_from": e.get("created_at") or now,
            "confidence": int(e.get("score") or 80),
            "labels": [x for x in ["phishing", e.get("brand_id")] if x],
        })
    return json.dumps({"type": "bundle", "id": "bundle--" + str(uuid.uuid4()), "objects": objects}, ensure_ascii=False, indent=1)
