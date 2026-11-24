"""Web Push notifications (VAPID) for blocked threats and new scam waves."""
from __future__ import annotations

import base64
import json
import logging
import time
from functools import lru_cache
from typing import Any

from cryptography.hazmat.primitives import serialization
from py_vapid import Vapid01
from pywebpush import WebPushException, webpush
from sqlmodel import select

from .. import db
from ..config import get_settings

log = logging.getLogger(__name__)
_recent: dict[str, float] = {}


def _b64(x: bytes) -> str:
    return base64.urlsafe_b64encode(x).decode().rstrip("=")


@lru_cache
def keys() -> tuple[str, str]:
    s = get_settings()
    if s.vapid_private_key and s.vapid_public_key:
        return s.vapid_public_key, s.vapid_private_key
    path = s.cache_dir / "vapid.json"
    if path.exists():
        data = json.loads(path.read_text())
        return data["public"], data["private"]
    v = Vapid01()
    v.generate_keys()
    pub = _b64(v.public_key.public_bytes(serialization.Encoding.X962, serialization.PublicFormat.UncompressedPoint))
    priv = _b64(v.private_key.private_numbers().private_value.to_bytes(32, "big"))
    path.write_text(json.dumps({"public": pub, "private": priv}))
    return pub, priv


def send(device: db.Device, payload: dict[str, Any]) -> bool:
    if not device.push_json:
        return False
    try:
        webpush(
            subscription_info=json.loads(device.push_json),
            data=json.dumps(payload, ensure_ascii=False),
            vapid_private_key=keys()[1],
            vapid_claims={"sub": get_settings().vapid_subject},
            ttl=3600,
        )
        return True
    except WebPushException as exc:
        status = getattr(exc.response, "status_code", None)
        if status in (404, 410):
            with db.session() as s:
                d = s.get(db.Device, device.id)
                if d:
                    d.push_json = None
                    s.add(d)
                    s.commit()
        log.info("push failed for %s: %s", device.id, exc)
        return False


def _throttled(key: str, seconds: int) -> bool:
    now = time.time()
    if now - _recent.get(key, 0) < seconds:
        return True
    _recent[key] = now
    return False


def notify_block(device_id: str, domain: str, result: dict[str, Any] | None) -> None:
    if _throttled(f"{device_id}:{domain}", 600):
        return
    with db.session() as s:
        device = s.get(db.Device, device_id)
    if not device:
        return
    head = (result or {}).get("headline") or {}
    ar = device.lang == "ar"
    title = "🛡️ تم حظر رابط احتيالي" if ar else "🛡️ Scam link blocked"
    body = (head.get("ar") if ar else head.get("en")) or domain
    send(device, {"title": title, "body": f"{body}\n{domain}", "url": f"/scan/{result['id']}" if result else "/protect", "tag": domain})


def broadcast_wave(site: str, result: dict[str, Any]) -> None:
    if _throttled(f"wave:{site}", 3600):
        return
    with db.session() as s:
        devices = s.exec(select(db.Device).where(db.Device.push_json.is_not(None))).all()
    head = result.get("headline") or {}
    for d in devices:
        ar = d.lang == "ar"
        send(d, {
            "title": "⚠️ موجة احتيال جديدة" if ar else "⚠️ New scam wave",
            "body": (head.get("ar") if ar else head.get("en")) or site,
            "url": f"/scan/{result['id']}",
            "tag": f"wave-{site}",
        })
