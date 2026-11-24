"""Optional sign-in: an email address, confirmed with a one-time code, that leads back to the same phone identity.

Families, approval requests and blocks are stored on the server against a device ID. iPhone gives a Home Screen
app its own storage, separate from Safari, and a new phone starts empty, so either one would look like a new phone.
Registering ties a verified email to this phone's device ID; signing in with a code hands that ID to the new screen.
Only the email is stored, and codes are kept as salted hashes for 10 minutes.
"""
from __future__ import annotations

import hashlib
import hmac
import logging
import re
import secrets
import time
from datetime import datetime

from sqlalchemy import inspect, text
from sqlmodel import Field, SQLModel, select

from . import db
from .config import get_settings
from .notify import mail

log = logging.getLogger(__name__)

CODE_TTL_S = 10 * 60
CODE_TRIES = 5
RESEND_S = 30
SENDS_PER_HOUR = 5
IP_SENDS_PER_HOUR = 20
IP_FAILS = 30
_events: dict[str, list[float]] = {}


class Account(SQLModel, table=True):
    login: str = Field(primary_key=True)
    device_id: str = Field(index=True, unique=True)
    created_at: datetime = Field(default_factory=db.utcnow)
    last_login: datetime | None = None


class LoginCode(SQLModel, table=True):
    login: str = Field(primary_key=True)
    purpose: str
    device_id: str | None = None
    code_hash: str
    sent_ts: float
    expires_ts: float
    attempts: int = 0


class AccountError(Exception):
    def __init__(self, status: int, message: str) -> None:
        super().__init__(message)
        self.status = status


def migrate() -> None:
    """The first version of the sign-in used passwords; codes replace them."""
    if "password_hash" in {c["name"] for c in inspect(db.engine).get_columns("account")}:
        with db.engine.begin() as conn:
            conn.execute(text("ALTER TABLE account DROP COLUMN password_hash"))


def normalize(login: str) -> str:
    s = login.strip().lower()
    if "@" not in s and re.fullmatch(r"[\d\s+()-]{7,}", s):
        raise AccountError(400, "codes by text message are not available yet, please use your email")
    if not re.fullmatch(r"[^@\s]+@[^@\s]+\.[^@\s]+", s) or len(s) > 120:
        raise AccountError(400, "enter a valid email address")
    return s


def mask(email: str) -> str:
    name, _, domain = email.partition("@")
    return f"{name[:1]}{'•' * max(2, min(len(name) - 1, 6))}@{domain}"


def _hash(code: str, salt: str) -> str:
    return f"{salt}${hashlib.sha256((salt + code).encode()).hexdigest()}"


def _recent(key: str, window: float, now: float) -> list[float]:
    kept = [t for t in _events.get(key, []) if now - t < window]
    _events[key] = kept
    return kept


def status(device_id: str) -> dict[str, str | None]:
    with db.session() as s:
        acc = s.exec(select(Account).where(Account.device_id == device_id)).first()
    return {"login": acc.login if acc else None}


def request_code(login: str, purpose: str, device_id: str | None, ip: str) -> dict[str, str]:
    """Emails a 6-digit code. Register needs this phone's device ID; sign-in needs an existing registration."""
    key = normalize(login)
    now = time.time()
    if len(_recent(f"send:{key}", 3600, now)) >= SENDS_PER_HOUR or len(_recent(f"send-ip:{ip}", 3600, now)) >= IP_SENDS_PER_HOUR:
        raise AccountError(429, "too many codes, please wait a while and try again")
    can_send = mail.configured()
    if not can_send and not get_settings().public_base_url.startswith("http://localhost"):
        raise AccountError(503, "email is not set up on the server yet")
    with db.session() as s:
        acc = s.get(Account, key)
        if purpose == "register":
            if not device_id or s.get(db.Device, device_id) is None:
                raise AccountError(404, "unknown device")
            if acc and acc.device_id != device_id:
                raise AccountError(409, "this email is already registered, sign in with it instead")
        elif acc is None:
            raise AccountError(404, "no family is registered with this email yet")
        old = s.get(LoginCode, key)
        if old and now - old.sent_ts < RESEND_S:
            raise AccountError(429, "a code was just sent, please wait a few seconds")
        code = f"{secrets.randbelow(10**6):06d}"
        row = old or LoginCode(login=key, purpose=purpose, code_hash="", sent_ts=now, expires_ts=now)
        row.purpose, row.device_id, row.code_hash = purpose, device_id if purpose == "register" else None, _hash(code, secrets.token_hex(8))
        row.sent_ts, row.expires_ts, row.attempts = now, now + CODE_TTL_S, 0
        s.add(row)
        s.commit()
    if can_send:
        try:
            mail.send_code(key, code)
        except Exception as exc:
            log.warning("sign-in code email to %s failed: %s", mask(key), exc)
            with db.session() as s:
                row = s.get(LoginCode, key)
                if row:
                    s.delete(row)
                    s.commit()
            raise AccountError(502, "the code email could not be sent, please try again") from None
    else:
        log.warning("no SMTP set (local only): sign-in code for %s is %s", key, code)
    for k in (f"send:{key}", f"send-ip:{ip}"):
        _events.setdefault(k, []).append(now)
    return {"to": mask(key)}


def verify(login: str, code: str, purpose: str, device_id: str | None, ip: str) -> dict[str, str]:
    """Checks the code. Register ties the email to this phone; sign-in returns the registered phone's device ID."""
    now = time.time()
    if len(_recent(f"fail-ip:{ip}", 15 * 60, now)) >= IP_FAILS:
        raise AccountError(429, "too many tries, please wait 15 minutes")
    try:
        key = normalize(login)
    except AccountError:
        raise AccountError(401, "this code is wrong or has expired") from None
    code = re.sub(r"\D", "", code)
    with db.session() as s:
        row = s.get(LoginCode, key)
        valid = row is not None and row.purpose == purpose and row.expires_ts > now and (purpose != "register" or row.device_id == device_id)
        if valid and hmac.compare_digest(_hash(code, row.code_hash.split("$")[0]), row.code_hash):
            s.delete(row)
            if purpose == "register":
                taken = s.get(Account, key)
                if taken and taken.device_id != device_id:
                    s.commit()
                    raise AccountError(409, "this email is already registered, sign in with it instead")
                mine = s.exec(select(Account).where(Account.device_id == device_id)).first()
                if mine and mine.login != key:
                    s.delete(mine)
                    s.flush()
                if not taken:
                    s.add(Account(login=key, device_id=device_id))
                s.commit()
                return {"login": key}
            acc = s.get(Account, key)
            if acc is None:
                s.commit()
                raise AccountError(404, "no family is registered with this email yet")
            acc.last_login = db.utcnow()
            s.add(acc)
            s.commit()
            return {"login": key, "device_id": acc.device_id}
        if row is not None:
            row.attempts += 1
            if row.attempts >= CODE_TRIES or row.expires_ts <= now:
                s.delete(row)
            else:
                s.add(row)
            s.commit()
    _events.setdefault(f"fail-ip:{ip}", []).append(now)
    raise AccountError(401, "this code is wrong or has expired")
