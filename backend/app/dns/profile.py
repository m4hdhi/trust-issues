"""Apple configuration profile that routes all DNS on an iPhone/iPad/Mac through the protective resolver."""
from __future__ import annotations

import plistlib
import uuid

from ..config import get_settings


def doh_url(device_id: str) -> str:
    return f"{get_settings().public_base_url.rstrip('/')}/dns-query/{device_id}"


def mobileconfig(device_id: str) -> bytes:
    url = doh_url(device_id)
    dns_uuid = str(uuid.uuid5(uuid.NAMESPACE_URL, url + "#dns")).upper()
    root_uuid = str(uuid.uuid5(uuid.NAMESPACE_URL, url)).upper()
    payload = {
        "PayloadContent": [
            {
                "PayloadType": "com.apple.dnsSettings.managed",
                "PayloadVersion": 1,
                "PayloadIdentifier": f"ae.trustissues.dns.{device_id}",
                "PayloadUUID": dns_uuid,
                "PayloadDisplayName": "Trust Issues Scam Shield DNS",
                "DNSSettings": {"DNSProtocol": "HTTPS", "ServerURL": url},
                "ProhibitDisablement": False,
            }
        ],
        "PayloadDisplayName": "Trust Issues | أزمة ثقة — Scam Shield",
        "PayloadDescription": "Blocks confirmed scam and phishing websites in every app (WhatsApp, SMS, Safari, Instagram…). "
        "يحظر مواقع الاحتيال والتصيد المؤكدة في جميع التطبيقات.",
        "PayloadIdentifier": f"ae.trustissues.profile.{device_id}",
        "PayloadOrganization": "Trust Issues | أزمة ثقة",
        "PayloadRemovalDisallowed": False,
        "PayloadType": "Configuration",
        "PayloadUUID": root_uuid,
        "PayloadVersion": 1,
    }
    return plistlib.dumps(payload)
