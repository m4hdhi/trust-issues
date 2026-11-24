from __future__ import annotations

import json
import secrets
import time
from contextlib import contextmanager
from datetime import datetime, timezone
from typing import Any, Iterator

from sqlalchemy import Column, Text
from sqlmodel import Field, Session, SQLModel, create_engine, select

from .config import get_settings


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


def new_id(prefix: str) -> str:
    return f"{prefix}_{secrets.token_urlsafe(9).replace('-', 'x').replace('_', 'y')}"


class ScanRecord(SQLModel, table=True):
    id: str = Field(primary_key=True)
    input: str
    url: str
    domain: str = Field(index=True)
    verdict: str = Field(index=True)
    score: int
    brand_id: str | None = Field(default=None, index=True)
    mode: str = "deep"
    source: str = "web"
    result_json: str = Field(sa_column=Column(Text))
    created_at: datetime = Field(default_factory=utcnow, index=True)

    def result(self) -> dict[str, Any]:
        return json.loads(self.result_json)


class Report(SQLModel, table=True):
    id: str = Field(primary_key=True)
    url: str
    domain: str = Field(index=True)
    channel: str = "other"
    note: str | None = None
    device_id: str | None = Field(default=None, index=True)
    scan_id: str | None = None
    created_at: datetime = Field(default_factory=utcnow, index=True)


class Case(SQLModel, table=True):
    id: str = Field(primary_key=True)
    domain: str = Field(index=True)
    url: str
    source: str = Field(index=True)
    verdict: str = "unknown"
    score: int = 0
    brand_id: str | None = None
    status: str = Field(default="pending", index=True)
    scan_id: str | None = None
    detail_json: str = Field(default="{}", sa_column=Column(Text))
    created_at: datetime = Field(default_factory=utcnow, index=True)
    updated_at: datetime = Field(default_factory=utcnow)


class BlockEntry(SQLModel, table=True):
    domain: str = Field(primary_key=True)
    source: str
    reason: str = ""
    brand_id: str | None = None
    score: int = 0
    scan_id: str | None = None
    active: bool = True
    created_at: datetime = Field(default_factory=utcnow, index=True)


class Device(SQLModel, table=True):
    id: str = Field(primary_key=True)
    platform: str = "other"
    lang: str = "ar"
    trust: float = 1.0
    push_json: str | None = Field(default=None, sa_column=Column(Text))
    created_at: datetime = Field(default_factory=utcnow)


class BlockEvent(SQLModel, table=True):
    id: int | None = Field(default=None, primary_key=True)
    device_id: str = Field(index=True)
    domain: str
    scan_id: str | None = None
    ts: datetime = Field(default_factory=utcnow, index=True)


class RadarEvent(SQLModel, table=True):
    id: int | None = Field(default=None, primary_key=True)
    source: str = Field(index=True)
    domain: str = Field(index=True)
    url: str
    score: int = 0
    verdict: str = "unknown"
    brand_id: str | None = None
    detail_json: str = Field(default="{}", sa_column=Column(Text))
    ts: datetime = Field(default_factory=utcnow, index=True)


class BatchJob(SQLModel, table=True):
    id: str = Field(primary_key=True)
    status: str = "queued"
    total: int = 0
    done: int = 0
    metrics_json: str | None = Field(default=None, sa_column=Column(Text))
    created_at: datetime = Field(default_factory=utcnow)


class Counter(SQLModel, table=True):
    key: str = Field(primary_key=True)
    value: int = 0


def _engine_url() -> str:
    url = get_settings().database_url
    if url.startswith("postgres://"):
        url = "postgresql+psycopg://" + url[len("postgres://"):]
    elif url.startswith("postgresql://"):
        url = "postgresql+psycopg://" + url[len("postgresql://"):]
    return url


_url = _engine_url()
engine = create_engine(
    _url,
    connect_args={"check_same_thread": False} if _url.startswith("sqlite") else {},
    pool_pre_ping=True,
)


def init_db() -> None:
    SQLModel.metadata.create_all(engine)


@contextmanager
def session() -> Iterator[Session]:
    with Session(engine, expire_on_commit=False) as s:
        yield s


def bump(key: str, by: int = 1) -> None:
    with session() as s:
        row = s.get(Counter, key)
        if row is None:
            row = Counter(key=key, value=0)
        row.value += by
        s.add(row)
        s.commit()


def counter(key: str) -> int:
    with session() as s:
        row = s.get(Counter, key)
        return row.value if row else 0


def active_blocklist() -> dict[str, BlockEntry]:
    with session() as s:
        return {b.domain: b for b in s.exec(select(BlockEntry).where(BlockEntry.active == True))}  # noqa: E712


_bl_cache: tuple[float, dict[str, BlockEntry]] = (0.0, {})


def cached_blocklist(max_age_s: float = 10.0) -> dict[str, BlockEntry]:
    global _bl_cache
    if time.time() - _bl_cache[0] > max_age_s:
        _bl_cache = (time.time(), active_blocklist())
    return _bl_cache[1]


def invalidate_blocklist() -> None:
    global _bl_cache
    _bl_cache = (0.0, {})
