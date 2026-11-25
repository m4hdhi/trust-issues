"""Family Shield: one guardian protects the family's phones, approves risky links for elders and kids, and gets SOS alerts."""
from __future__ import annotations

import json
import logging
import re
import secrets
import time
from datetime import datetime, timedelta, timezone
from typing import Any

from sqlalchemy import Column, Text
from sqlmodel import Field, SQLModel, or_, select

from . import db
from .config import get_settings
from .notify import webpush
from .pipeline import url_model_or_none
from .registry import get_registry
from .urlutil import parse

log = logging.getLogger(__name__)

ROLES = ("guardian", "elder", "child", "helper", "adult")
STRICT_BY_DEFAULT = {"elder", "child", "helper"}
INVITE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
LURE_WORDS = re.compile(
    r"fine|toll|recharge|parcel|deliver|refund|customs|visa|emiratesid|otp|verif|update|secure|login|signin|wallet|"
    r"bonus|prize|winner|reward|pay|bill|invoice|kyc|account|police|gov|bank|"
    r"win|won|gift|claim|free|cash|offer|lucky|track|shipment"
)
# Strict mode is for people who rarely spot scams, so an unknown site with money or delivery wording is held at a lower score.
HOLD_SCORE = 0.5


class Family(SQLModel, table=True):
    id: str = Field(primary_key=True)
    name: str
    created_at: datetime = Field(default_factory=db.utcnow)


class FamilyMember(SQLModel, table=True):
    device_id: str = Field(primary_key=True)
    family_id: str = Field(index=True)
    name: str
    role: str = "adult"
    strict: bool = False
    phone: str | None = None
    joined_at: datetime = Field(default_factory=db.utcnow)
    last_seen: datetime | None = None


class FamilyInvite(SQLModel, table=True):
    code: str = Field(primary_key=True)
    family_id: str = Field(index=True)
    name: str
    role: str
    strict: bool = False
    created_at: datetime = Field(default_factory=db.utcnow)
    used_by: str | None = None
    # Set when the guardian reconnects a member's phone: the code hands this existing identity to a new screen.
    relink_device: str | None = None


class ApprovalRequest(SQLModel, table=True):
    id: str = Field(primary_key=True)
    family_id: str = Field(index=True)
    device_id: str
    host: str
    domain: str = Field(index=True)
    reason_json: str = Field(default="{}", sa_column=Column(Text))
    status: str = Field(default="pending", index=True)
    created_at: datetime = Field(default_factory=db.utcnow, index=True)
    decided_at: datetime | None = None
    decided_by: str | None = None


class FamilyRule(SQLModel, table=True):
    id: int | None = Field(default=None, primary_key=True)
    family_id: str = Field(index=True)
    domain: str = Field(index=True)
    action: str
    created_at: datetime = Field(default_factory=db.utcnow)


class FamilyEvent(SQLModel, table=True):
    id: int | None = Field(default=None, primary_key=True)
    family_id: str = Field(index=True)
    device_id: str | None = None
    kind: str
    domain: str | None = None
    detail_json: str = Field(default="{}", sa_column=Column(Text))
    ts: datetime = Field(default_factory=db.utcnow, index=True)


class FamilyError(Exception):
    def __init__(self, status: int, message: str) -> None:
        super().__init__(message)
        self.status = status


def _aware(dt: datetime | None) -> datetime | None:
    if dt is None:
        return None
    return dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)


# ---------------------------------------------------------------- fast lookups for the DNS path

_snap: dict[str, Any] = {"at": 0.0, "members": {}, "rules": {}}
_touched: dict[str, float] = {}


def invalidate() -> None:
    _snap["at"] = 0.0


def _snapshot() -> dict[str, Any]:
    if time.time() - _snap["at"] > 15:
        with db.session() as s:
            members = {m.device_id: {"device_id": m.device_id, "family_id": m.family_id, "name": m.name, "role": m.role, "strict": m.strict}
                       for m in s.exec(select(FamilyMember))}
            rules = {(r.family_id, r.domain): r.action for r in s.exec(select(FamilyRule))}
        _snap.update(at=time.time(), members=members, rules=rules)
    return _snap


def member(device_id: str | None) -> dict[str, Any] | None:
    return _snapshot()["members"].get(device_id) if device_id else None


def rule_for(family_id: str, registrable: str) -> str | None:
    return _snapshot()["rules"].get((family_id, registrable))


def needs_touch(device_id: str) -> bool:
    now = time.time()
    if now - _touched.get(device_id, 0) < 120:
        return False
    _touched[device_id] = now
    return True


def touch(device_id: str) -> None:
    with db.session() as s:
        m = s.get(FamilyMember, device_id)
        if m:
            m.last_seen = db.utcnow()
            s.add(m)
            s.commit()


def risky(host: str) -> dict[str, Any] | None:
    """Should strict mode hold this domain for the guardian? Fast, offline, and conservative with everyday app traffic."""
    try:
        p = parse(host)
    except ValueError:
        return None
    reg = get_registry()
    if reg.is_official(p.registrable, p.hostname):
        return None
    model = url_model_or_none()
    if model is None or model.tranco_rank(p.registrable):
        return None
    imp = reg.impersonation(p.hostname, p.registrable)
    if imp and imp[1] != "prefix":
        b = imp[0]
        return {"en": f"Looks like a fake {b.name_en} site", "ar": f"يبدو موقعًا مزيفًا لـ{b.name_ar}", "brand": b.id}
    score = model.score_domain(p.hostname)
    if score >= HOLD_SCORE and LURE_WORDS.search(p.hostname.replace("-", "")):
        return {"en": "New, unknown site with payment or login wording", "ar": "موقع جديد غير معروف يستخدم كلمات دفع أو تسجيل دخول", "brand": None}
    if score >= model.domain_threshold:
        return {"en": "Unknown site that our AI rates as high risk", "ar": "موقع غير معروف يصنّفه الذكاء الاصطناعي عالي الخطورة", "brand": None}
    return None


# ---------------------------------------------------------------- events and notifications (run off the event loop)

def _event(family_id: str, kind: str, device_id: str | None = None, domain: str | None = None, **detail: Any) -> None:
    with db.session() as s:
        s.add(FamilyEvent(family_id=family_id, device_id=device_id, kind=kind, domain=domain,
                          detail_json=json.dumps(detail, ensure_ascii=False)))
        s.commit()


def _devices(family_id: str, roles: tuple[str, ...] | None = None, exclude: str | None = None) -> list[tuple[FamilyMember, db.Device]]:
    out = []
    with db.session() as s:
        for m in s.exec(select(FamilyMember).where(FamilyMember.family_id == family_id)):
            if (roles and m.role not in roles) or m.device_id == exclude:
                continue
            d = s.get(db.Device, m.device_id)
            if d:
                out.append((m, d))
    return out


def _push(device: db.Device, en: tuple[str, str], ar: tuple[str, str], url: str, tag: str) -> None:
    title, body = ar if device.lang == "ar" else en
    webpush.send(device, {"title": title, "body": body, "url": url, "tag": tag})


def hold(mem: dict[str, Any], host: str, reason: dict[str, Any]) -> None:
    registrable = parse(host).registrable
    since = db.utcnow() - timedelta(hours=24)
    with db.session() as s:
        dup = s.exec(select(ApprovalRequest).where(ApprovalRequest.family_id == mem["family_id"], ApprovalRequest.domain == registrable,
                                                   ApprovalRequest.created_at >= since)).first()
        if dup:
            return
        req = ApprovalRequest(id=db.new_id("req"), family_id=mem["family_id"], device_id=mem["device_id"], host=host,
                              domain=registrable, reason_json=json.dumps(reason, ensure_ascii=False))
        s.add(req)
        s.commit()
    _event(mem["family_id"], "held", mem["device_id"], host, reason=reason)
    name = mem["name"]
    for _, dev in _devices(mem["family_id"], roles=("guardian",), exclude=mem["device_id"]):
        _push(dev, (f"🛡️ {name} needs your OK", f"{name} tried to open {host}. {reason['en']}."),
              (f"🛡️ {name} يحتاج موافقتك", f"حاول {name} فتح {host}. {reason['ar']}."), "/family", f"req-{req.id}")


def on_block(mem: dict[str, Any], host: str, headline: dict[str, str] | None, test: bool) -> None:
    key = f"famblock:{mem['family_id']}:{host}"
    if webpush._throttled(key, 1800):
        return
    head = headline or {"en": "Known scam site", "ar": "موقع احتيالي معروف"}
    _event(mem["family_id"], "test" if test else "blocked", mem["device_id"], host, headline=head)
    if test:
        return
    name = mem["name"]
    for _, dev in _devices(mem["family_id"], roles=("guardian",), exclude=mem["device_id"]):
        _push(dev, (f"🛡️ Scam blocked for {name}", f"{head['en']}: {host}"),
              (f"🛡️ حُظر احتيال عن {name}", f"{head['ar']}: {host}"), "/family", f"blk-{host}")


# ---------------------------------------------------------------- family management

def _code() -> str:
    return "".join(secrets.choice(INVITE_ALPHABET) for _ in range(8))


def _require(device_id: str, guardian: bool = False) -> FamilyMember:
    with db.session() as s:
        m = s.get(FamilyMember, device_id)
    if m is None:
        raise FamilyError(404, "not in a family")
    if guardian and m.role != "guardian":
        raise FamilyError(403, "only a guardian can do this")
    return m


def _clean_phone(phone: str | None) -> str | None:
    if not phone:
        return None
    digits = re.sub(r"[^\d+]", "", phone)[:16]
    return digits or None


def create(device_id: str, family_name: str, my_name: str, phone: str | None) -> dict[str, Any]:
    with db.session() as s:
        if s.get(db.Device, device_id) is None:
            raise FamilyError(404, "unknown device")
        fam = Family(id=db.new_id("fam"), name=family_name.strip()[:60] or "My family")
        old = s.get(FamilyMember, device_id)
        if old:
            s.delete(old)
            s.flush()
        s.add(fam)
        s.add(FamilyMember(device_id=device_id, family_id=fam.id, name=my_name.strip()[:40] or "Me", role="guardian", phone=_clean_phone(phone)))
        s.commit()
    invalidate()
    _event(fam.id, "created", device_id)
    return state(device_id)


def invite(device_id: str, name: str, role: str, strict: bool | None) -> dict[str, Any]:
    g = _require(device_id, guardian=True)
    if role not in ROLES:
        raise FamilyError(422, "unknown role")
    inv = FamilyInvite(code=_code(), family_id=g.family_id, name=name.strip()[:40] or role.title(), role=role,
                       strict=role in STRICT_BY_DEFAULT if strict is None else strict)
    with db.session() as s:
        s.add(inv)
        s.commit()
    return {"code": inv.code, "url": f"{get_settings().public_base_url.rstrip('/')}/join/{inv.code}", "name": inv.name, "role": inv.role}


def migrate() -> None:
    """Older databases have the invite table without the reconnect column."""
    from sqlalchemy import inspect, text

    if "relink_device" not in {c["name"] for c in inspect(db.engine).get_columns("familyinvite")}:
        with db.engine.begin() as conn:
            conn.execute(text("ALTER TABLE familyinvite ADD COLUMN relink_device VARCHAR"))


RELINK_HOURS = 24


def relink(device_id: str, member_id: str) -> dict[str, Any]:
    """A one-time code that gives a member's phone its family back, when its browser forgot (another browser, Home Screen app, cleared data)."""
    g = _require(device_id, guardian=True)
    with db.session() as s:
        m = s.get(FamilyMember, member_id)
        if m is None or m.family_id != g.family_id or m.device_id == device_id:
            raise FamilyError(404, "member not found")
        inv = FamilyInvite(code=_code(), family_id=g.family_id, name=m.name, role=m.role, strict=m.strict, relink_device=m.device_id)
        s.add(inv)
        s.commit()
    return {"code": inv.code, "url": f"{get_settings().public_base_url.rstrip('/')}/join/{inv.code}", "name": inv.name, "role": inv.role}


def invite_info(code: str) -> dict[str, Any]:
    with db.session() as s:
        inv = s.get(FamilyInvite, code.upper())
        if inv is None:
            raise FamilyError(404, "invite not found")
        fam = s.get(Family, inv.family_id)
        guardians = [m.name for m in s.exec(select(FamilyMember).where(FamilyMember.family_id == inv.family_id, FamilyMember.role == "guardian"))]
    expired = bool(inv.relink_device) and db.utcnow() - _aware(inv.created_at) > timedelta(hours=RELINK_HOURS)
    return {"code": inv.code, "family": fam.name if fam else "", "guardians": guardians, "name": inv.name, "role": inv.role,
            "strict": inv.strict, "used": inv.used_by is not None or expired, "relink": bool(inv.relink_device)}


def join(code: str, device_id: str, phone: str | None) -> dict[str, Any]:
    with db.session() as s:
        inv = s.get(FamilyInvite, code.upper())
        if inv is None:
            raise FamilyError(404, "invite not found")
        if inv.used_by and inv.used_by != device_id:
            raise FamilyError(409, "invite already used")
        if inv.relink_device:
            if db.utcnow() - _aware(inv.created_at) > timedelta(hours=RELINK_HOURS):
                raise FamilyError(409, "invite already used")
            member = s.get(FamilyMember, inv.relink_device)
            if member is None or member.family_id != inv.family_id:
                raise FamilyError(404, "member not found")
            inv.used_by = device_id
            s.add(inv)
            # Earlier attempts to re-add the same person left extra entries that never turned on protection: drop them.
            for extra in s.exec(select(FamilyMember).where(FamilyMember.family_id == inv.family_id, FamilyMember.role == member.role,
                                                           FamilyMember.device_id != member.device_id, FamilyMember.last_seen.is_(None))):
                if extra.name.strip().lower() == member.name.strip().lower():
                    s.delete(extra)
            s.commit()
            invalidate()
            return {"relink_device": inv.relink_device}
        if s.get(db.Device, device_id) is None:
            raise FamilyError(404, "unknown device")
        old = s.get(FamilyMember, device_id)
        if old:
            s.delete(old)
            s.flush()
        s.add(FamilyMember(device_id=device_id, family_id=inv.family_id, name=inv.name, role=inv.role, strict=inv.strict,
                           phone=_clean_phone(phone)))
        inv.used_by = device_id
        s.add(inv)
        s.commit()
        family_id, name = inv.family_id, inv.name
    invalidate()
    _event(family_id, "joined", device_id)
    for _, dev in _devices(family_id, roles=("guardian",), exclude=device_id):
        _push(dev, (f"✅ {name} joined your Family Shield", "Their phone is now linked to your family."),
              (f"✅ انضم {name} إلى درع العائلة", "أصبح هاتفه مرتبطًا بعائلتك."), "/family", f"join-{device_id}")
    return state(device_id)


def decide(device_id: str, request_id: str, decision: str) -> dict[str, Any]:
    g = _require(device_id, guardian=True)
    with db.session() as s:
        req = s.get(ApprovalRequest, request_id)
        if req is None or req.family_id != g.family_id:
            raise FamilyError(404, "request not found")
        req.status = "allowed" if decision == "allow" else "blocked"
        req.decided_at, req.decided_by = db.utcnow(), device_id
        s.add(req)
        for r in s.exec(select(FamilyRule).where(FamilyRule.family_id == g.family_id, FamilyRule.domain == req.domain)):
            s.delete(r)
        s.add(FamilyRule(family_id=g.family_id, domain=req.domain, action="allow" if decision == "allow" else "block"))
        s.commit()
        member_dev = s.get(db.Device, req.device_id)
        host, domain = req.host, req.domain
    invalidate()
    _event(g.family_id, "allowed" if decision == "allow" else "kept_blocked", req.device_id, host, by=g.name)
    if member_dev:
        if decision == "allow":
            _push(member_dev, (f"✅ {g.name} allowed {domain}", "Tap to open it now."),
                  (f"✅ سمح {g.name} بفتح {domain}", "اضغط لفتحه الآن."), f"https://{host}/", f"dec-{request_id}")
        else:
            _push(member_dev, (f"🛡️ {g.name} kept {domain} blocked", "It looked unsafe. Please don't enter any details there."),
                  (f"🛡️ أبقى {g.name} الموقع {domain} محظورًا", "بدا غير آمن. لا تُدخل أي بيانات فيه."), "/family", f"dec-{request_id}")
    return state(device_id)


def set_strict(device_id: str, member_id: str, strict: bool) -> dict[str, Any]:
    g = _require(device_id, guardian=True)
    with db.session() as s:
        m = s.get(FamilyMember, member_id)
        if m is None or m.family_id != g.family_id:
            raise FamilyError(404, "member not found")
        m.strict = strict
        s.add(m)
        s.commit()
    invalidate()
    return state(device_id)


def remove(device_id: str, member_id: str) -> dict[str, Any]:
    me = _require(device_id)
    if member_id != device_id and me.role != "guardian":
        raise FamilyError(403, "only a guardian can do this")
    with db.session() as s:
        m = s.get(FamilyMember, member_id)
        if m is None or m.family_id != me.family_id:
            raise FamilyError(404, "member not found")
        s.delete(m)
        s.commit()
    invalidate()
    _event(me.family_id, "left", member_id)
    return state(device_id)


def sos(device_id: str) -> dict[str, Any]:
    me = _require(device_id)
    _event(me.family_id, "sos", device_id)
    notified = 0
    for m, dev in _devices(me.family_id, roles=("guardian",), exclude=device_id):
        _push(dev, (f"🚨 {me.name} pressed SOS", "They may have been scammed. Call them now."),
              (f"🚨 ضغط {me.name} زر الطوارئ", "ربما تعرّض لعملية احتيال. اتصل به الآن."), "/family", f"sos-{device_id}")
        notified += 1
    return {"notified": notified}


# ---------------------------------------------------------------- read model for the app

def _site_check(domain: str) -> dict[str, Any] | None:
    """The latest full check of a held site: what the guardian sees before allowing or blocking."""
    with db.session() as s:
        # A held address can redirect elsewhere, so match the address that was submitted as well as where it ended up.
        asked = [f"https://{domain}/", f"https://{domain}", f"http://{domain}/", domain]
        row = s.exec(select(db.ScanRecord).where(or_(db.ScanRecord.domain == domain, db.ScanRecord.input.in_(asked), db.ScanRecord.url.in_(asked)))
                     .order_by(db.ScanRecord.created_at.desc())).first()
    if row is None:
        return None
    res = row.result()
    return {"verdict": row.verdict, "score": row.score, "scan_id": row.id, "headline": res.get("headline")}


def _warnings(limit: int = 3) -> list[dict[str, Any]]:
    since = db.utcnow() - timedelta(days=3)
    reg = get_registry()
    out = []
    seen: set[str] = set()
    with db.session() as s:
        rows = s.exec(select(db.RadarEvent).where(db.RadarEvent.verdict == "scam", db.RadarEvent.brand_id.is_not(None),
                                                  db.RadarEvent.ts >= since).order_by(db.RadarEvent.ts.desc()).limit(40)).all()
    for r in rows:
        b = reg.brands.get(r.brand_id or "")
        if not b or b.id in seen:
            continue
        seen.add(b.id)
        out.append({"domain": r.domain, "brand": b.ref().model_dump(), "source": r.source, "ts": _aware(r.ts).isoformat(),
                    "lure": {"en": (b.lures_en or [f"messages about {b.name_en}"])[0], "ar": (b.lures_ar or [f"رسائل عن {b.name_ar}"])[0]}})
        if len(out) >= limit:
            break
    return out


def helplines() -> list[dict[str, Any]]:
    out = []
    for b in get_registry().brands.values():
        if b.category == "bank" and b.helplines:
            h = b.helplines[0]
            out.append({"brand": b.ref().model_dump(), "number": h.get("number"), "label": h.get("label")})
    return out


def state(device_id: str) -> dict[str, Any]:
    with db.session() as s:
        me = s.get(FamilyMember, device_id)
        if me is None:
            return {"family": None}
        fam = s.get(Family, me.family_id)
        members = s.exec(select(FamilyMember).where(FamilyMember.family_id == me.family_id).order_by(FamilyMember.joined_at)).all()
        week = db.utcnow() - timedelta(days=7)
        events = s.exec(select(FamilyEvent).where(FamilyEvent.family_id == me.family_id).order_by(FamilyEvent.ts.desc()).limit(40)).all()
        week_events = s.exec(select(FamilyEvent).where(FamilyEvent.family_id == me.family_id, FamilyEvent.ts >= week,
                                                       FamilyEvent.kind.in_(["blocked", "held", "kept_blocked"]))).all()
        requests = s.exec(select(ApprovalRequest).where(ApprovalRequest.family_id == me.family_id)
                          .order_by(ApprovalRequest.created_at.desc()).limit(20)).all()
    names = {m.device_id: m.name for m in members}
    now = db.utcnow()
    stopped: dict[str, int] = {}
    for e in week_events:
        if e.kind in ("blocked", "held") and e.device_id:
            stopped[e.device_id] = stopped.get(e.device_id, 0) + 1

    def member_view(m: FamilyMember) -> dict[str, Any]:
        seen = _aware(m.last_seen)
        status = "protected" if seen and now - seen < timedelta(hours=24) else "setup"
        return {"device_id": m.device_id, "name": m.name, "role": m.role, "strict": m.strict, "phone": m.phone,
                "status": status, "last_seen": seen.isoformat() if seen else None, "stopped_week": stopped.get(m.device_id, 0),
                "me": m.device_id == device_id}

    return {
        "family": {"id": fam.id, "name": fam.name} if fam else None,
        "me": member_view(me),
        "members": [member_view(m) for m in members],
        "requests": [{"id": r.id, "device_id": r.device_id, "member": names.get(r.device_id, "?"), "host": r.host, "domain": r.domain,
                      "reason": json.loads(r.reason_json or "{}"), "status": r.status, "ts": _aware(r.created_at).isoformat(),
                      "check": _site_check(r.domain) if r.status == "pending" else None}
                     for r in requests],
        "events": [{"id": e.id, "kind": e.kind, "member": names.get(e.device_id or "", None), "domain": e.domain,
                    "detail": json.loads(e.detail_json or "{}"), "ts": _aware(e.ts).isoformat()} for e in events],
        "stats": {"stopped_week": sum(stopped.values()), "members": len(members),
                  "protected": sum(1 for m in members if member_view(m)["status"] == "protected")},
        "warnings": _warnings(),
    }
