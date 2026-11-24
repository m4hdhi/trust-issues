from __future__ import annotations

from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, Field

Verdict = Literal["safe", "suspicious", "scam", "unknown"]
Severity = Literal["info", "low", "medium", "high", "critical"]


class Bilingual(BaseModel):
    en: str
    ar: str


class Signal(BaseModel):
    id: str
    category: Literal["trust", "intel", "url", "domain", "render", "exfil", "visual", "ai", "community"]
    weight: float
    severity: Severity
    title: Bilingual
    detail: Bilingual | None = None
    evidence: dict[str, Any] = Field(default_factory=dict)


class BrandRef(BaseModel):
    id: str
    name_en: str
    name_ar: str
    official_domains: list[str]
    category: str
    logo_url: str | None = None
    reference_screenshot_url: str | None = None


class RedirectHop(BaseModel):
    url: str
    status: int | None = None
    kind: str = "http"


class PersonaView(BaseModel):
    name: str
    final_url: str | None = None
    title: str | None = None
    screenshot_url: str | None = None
    dom_hash: str | None = None
    status: int | None = None
    error: str | None = None


class Cloaking(BaseModel):
    detected: bool = False
    reason: Bilingual | None = None
    personas: list[PersonaView] = Field(default_factory=list)


class Annotation(BaseModel):
    x: float
    y: float
    w: float
    h: float
    kind: Literal["card", "password", "otp", "emirates_id", "phone", "logo", "urgency", "form", "other"]
    label: Bilingual


class PageCapture(BaseModel):
    title: str | None = None
    screenshot_url: str | None = None
    width: int | None = None
    height: int | None = None
    annotations: list[Annotation] = Field(default_factory=list)
    language: str | None = None
    text_excerpt: str | None = None
    favicon_hash: int | None = None
    asks_for: list[str] = Field(default_factory=list)


class DomainIntel(BaseModel):
    registered: datetime | None = None
    age_days: int | None = None
    registrar: str | None = None
    registrar_abuse_email: str | None = None
    nameservers: list[str] = Field(default_factory=list)
    ips: list[str] = Field(default_factory=list)
    asn: str | None = None
    as_org: str | None = None
    country: str | None = None
    host_abuse_email: str | None = None
    tls_issuer: str | None = None
    tls_not_before: datetime | None = None
    tls_age_days: int | None = None
    ct_cert_count: int | None = None


class ExfilLead(BaseModel):
    kind: Literal["telegram_bot", "webhook", "form_post", "whatsapp", "phone", "email", "crypto_wallet"]
    value: str
    context: str | None = None


class DomainDiff(BaseModel):
    official: str
    suspect: str
    segments: list[dict[str, Any]]


class TimelineEvent(BaseModel):
    ts: datetime
    kind: str
    label: Bilingual


class CommunityStats(BaseModel):
    reports: int = 0
    last_24h: int = 0
    channels: dict[str, int] = Field(default_factory=dict)
    status: Literal["none", "pending", "confirmed", "rejected"] = "none"


class GraphNode(BaseModel):
    id: str
    kind: Literal["domain", "ip", "asn", "favicon", "phone", "telegram", "nameserver", "registrar", "dom"]
    label: str
    verdict: Verdict | None = None


class GraphEdge(BaseModel):
    source: str
    target: str
    kind: str


class Campaign(BaseModel):
    id: str
    size: int
    nodes: list[GraphNode] = Field(default_factory=list)
    edges: list[GraphEdge] = Field(default_factory=list)


class AIOpinion(BaseModel):
    provider: str
    model: str
    verdict: Verdict
    confidence: float
    target_brand: str | None = None
    asks_for: list[str] = Field(default_factory=list)
    reasons: dict[str, list[str]] = Field(default_factory=dict)
    latency_ms: int | None = None


class ScanResult(BaseModel):
    id: str
    input: str
    url: str
    final_url: str | None = None
    domain: str
    verdict: Verdict
    score: int
    headline: Bilingual
    summary: Bilingual | None = None
    brand: BrandRef | None = None
    signals: list[Signal] = Field(default_factory=list)
    redirect_chain: list[RedirectHop] = Field(default_factory=list)
    cloaking: Cloaking = Field(default_factory=Cloaking)
    domain_intel: DomainIntel = Field(default_factory=DomainIntel)
    page: PageCapture | None = None
    exfil: list[ExfilLead] = Field(default_factory=list)
    domain_diff: DomainDiff | None = None
    timeline: list[TimelineEvent] = Field(default_factory=list)
    community: CommunityStats = Field(default_factory=CommunityStats)
    campaign: Campaign | None = None
    ai: list[AIOpinion] = Field(default_factory=list)
    evidence: dict[str, Any] = Field(default_factory=dict)
    mode: Literal["fast", "deep"] = "deep"
    timings_ms: dict[str, int] = Field(default_factory=dict)
    created_at: datetime


class ScanStage(BaseModel):
    stage: str
    status: Literal["running", "done", "skipped", "error"]
    label: Bilingual
    detail: str | None = None
