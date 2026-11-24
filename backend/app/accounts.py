"""Optional sign-in: a phone number or email plus a password that leads back to the same phone identity.

Families, approval requests and blocks are stored on the server against a device ID. iPhone gives a Home Screen
app its own storage, separate from Safari, and a new phone starts empty, so either one would look like a new phone.
Signing in hands the saved device ID to that screen. Only the login and a scrypt hash of the password are stored.
"""
from __future__ import annotations

import hashlib
import hmac
import re
import secrets
import time
from datetime import datetime

from sqlmodel import Field, SQLModel, select

from . import db

PASSWORD_MIN = 8
PASSWORD_MAX = 128
LOGIN_TRIES = 5
IP_TRIES = 20
LOCK_S = 15 * 60
_fails: dict[str, list[float]] = {}
_DUMMY_HASH = ""


class Account(SQLModel, table=True):
    login: str = Field(primary_key=True)
    device_id: str = Field(index=True, unique=True)
    password_hash: str
    created_at: datetime = Field(default_factory=db.utcnow)
    last_login: datetime | None = None


class AccountError(Exception):
    def __init__(self, status: int, message: str) -> None:
        super().__init__(message)
        self.status = status


def normalize(login: str) -> str:
    """Emails are lower-cased; phone numbers become +<country><number>, with UAE local formats (05x, 5x) expanded."""
    s = login.strip().lower()
    if "@" in s:
        if not re.fullmatch(r"[^@\s]+@[^@\s]+\.[^@\s]+", s) or len(s) > 120:
            raise AccountError(400, "enter a valid phone number or email")
        return s
    digits = re.sub(r"\D", "", s)
    if digits.startswith("00"):
        digits = digits[2:]
    elif digits.startswith("0") and len(digits) == 10:
        digits = "971" + digits[1:]
    elif digits.startswith("5") and len(digits) == 9:
        digits = "971" + digits
    if not 8 <= len(digits) <= 15:
        raise AccountError(400, "enter a valid phone number or email")
    return "+" + digits


def _hash(password: str, salt: bytes | None = None) -> str:
    salt = salt or secrets.token_bytes(16)
    key = hashlib.scrypt(password.encode(), salt=salt, n=2**14, r=8, p=1, dklen=32)
    return f"scrypt${salt.hex()}${key.hex()}"


def _matches(password: str, stored: str) -> bool:
    try:
        _, salt, key = stored.split("$")
        return hmac.compare_digest(_hash(password, bytes.fromhex(salt)).split("$")[2], key)
    except ValueError:
        return False


def _check_password(password: str) -> None:
    if not PASSWORD_MIN <= len(password) <= PASSWORD_MAX:
        raise AccountError(400, f"the password needs at least {PASSWORD_MIN} characters")


def status(device_id: str) -> dict[str, str | None]:
    with db.session() as s:
        acc = s.exec(select(Account).where(Account.device_id == device_id)).first()
    return {"login": acc.login if acc else None}


def save(device_id: str, login: str, password: str) -> dict[str, str | None]:
    """Create or replace this phone's sign-in. Holding the device ID is what proves it is this phone."""
    key = normalize(login)
    _check_password(password)
    with db.session() as s:
        if s.get(db.Device, device_id) is None:
            raise AccountError(404, "unknown device")
        taken = s.get(Account, key)
        if taken and taken.device_id != device_id:
            raise AccountError(409, "this phone number or email is already used by another sign-in")
        old = s.exec(select(Account).where(Account.device_id == device_id)).first()
        if old:
            s.delete(old)
            s.flush()
        s.add(Account(login=key, device_id=device_id, password_hash=_hash(password)))
        s.commit()
    return {"login": key}


def _locked(key: str, limit: int, now: float) -> bool:
    recent = [t for t in _fails.get(key, []) if now - t < LOCK_S]
    _fails[key] = recent
    return len(recent) >= limit


def sign_in(login: str, password: str, ip: str) -> str:
    """Returns the device ID behind this sign-in. Wrong tries are limited per login and per address."""
    global _DUMMY_HASH
    try:
        key = normalize(login)
    except AccountError:
        raise AccountError(401, "wrong phone number, email or password") from None
    now = time.time()
    if _locked(f"login:{key}", LOGIN_TRIES, now) or _locked(f"ip:{ip}", IP_TRIES, now):
        raise AccountError(429, "too many tries, please wait 15 minutes")
    with db.session() as s:
        acc = s.get(Account, key)
        if acc is None:
            _DUMMY_HASH = _DUMMY_HASH or _hash(secrets.token_hex(8))
            _matches(password, _DUMMY_HASH)
        elif _matches(password, acc.password_hash):
            _fails.pop(f"login:{key}", None)
            acc.last_login = db.utcnow()
            s.add(acc)
            s.commit()
            return acc.device_id
    for k in (f"login:{key}", f"ip:{ip}"):
        _fails.setdefault(k, []).append(now)
    raise AccountError(401, "wrong phone number, email or password")
