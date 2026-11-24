"""Tiered scan pipeline: trust anchors → intel → URL model → domain → sandbox → exfil → visual → AI → fusion."""
from __future__ import annotations

import asyncio
import hashlib
import json
import logging
import math
import time
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any, Awaitable, Callable

from sqlmodel import select

from . import bus, db
from .config import get_settings
from .http import client
from .detectors import ai_anthropic, ai_openai, anchors, domain_intel, exfil, feeds, fusion, intel, visual
from .detectors.ai_common import JudgeInput
from .detectors.render import FIELD_LABELS, PERSONAS, RenderResult, classify_input, sandbox
from .registry import Brand, get_registry
from .schemas import (
    AIOpinion,
    Annotation,
    Bilingual,
    Cloaking,
    CommunityStats,
    DomainIntel,
    PageCapture,
    PersonaView,
    RedirectHop,
    ScanResult,
    ScanStage,
    TimelineEvent,
)
from .urlutil import ParsedUrl, parse

log = logging.getLogger(__name__)

STAGES: dict[str, tuple[str, str]] = {
    "trust": ("Checking official UAE trust anchors", "التحقق من المصادر الرسمية الإماراتية"),
    "intel": ("Querying global threat intelligence", "الاستعلام من قواعد التهديدات العالمية"),
    "url_model": ("AI model reading the link", "نموذج الذكاء الاصطناعي يحلل الرابط"),
    "domain": ("Investigating domain & hosting", "فحص النطاق والاستضافة"),
    "render": ("Opening the link safely in a sandbox", "فتح الرابط بأمان في بيئة معزولة"),
    "cloaking": ("Comparing what phones vs. crawlers see", "مقارنة ما تراه الهواتف وبرامج الفحص"),
    "exfil": ("Tracing where your data would go", "تتبّع وجهة بياناتك"),
    "visual": ("Matching logos & UAE brands", "مطابقة الشعارات والعلامات الإماراتية"),
    "ai": ("AI judges reviewing the evidence", "قضاة الذكاء الاصطناعي يراجعون الأدلة"),
    "fusion": ("Calculating the final risk score", "حساب درجة الخطورة النهائية"),
}

Emit = Callable[[str, str, str | None], None]


_model_failed_at = 0.0


def url_model_or_none():
    global _model_failed_at
    if time.time() - _model_failed_at < 60:
        return None
    try:
        from .detectors.url_model import get_model

        return get_model()
    except Exception as exc:
        _model_failed_at = time.time()
        log.warning("url model unavailable: %s", exc)
        return None


def _logit(p: float) -> float:
    p = min(0.995, max(0.005, p))
    return math.log(p / (1 - p))


def _site_key(p: ParsedUrl) -> str:
    return p.hostname if anchors.is_user_content(p) else p.registrable


def make_emitter(scan_id: str) -> Emit:
    ch = bus.channel(f"scan:{scan_id}")

    def emit(stage: str, status: str, detail: str | None = None) -> None:
        en, ar = STAGES[stage]
        ch.publish("stage", ScanStage(stage=stage, status=status, label=Bilingual(en=en, ar=ar), detail=detail).model_dump())

    return emit


def _noop(stage: str, status: str, detail: str | None = None) -> None:
    return None


async def _timed(coro: Awaitable[Any], timeout: float) -> Any:
    try:
        return await asyncio.wait_for(coro, timeout)
    except Exception as exc:
        log.info("stage failed: %s", exc)
        return None


def community_stats(site: str) -> CommunityStats:
    since = db.utcnow() - timedelta(hours=24)
    with db.session() as s:
        reports = s.exec(select(db.Report).where(db.Report.domain == site)).all()
        case = s.exec(select(db.Case).where(db.Case.domain == site, db.Case.source == "report")).first()
    channels: dict[str, int] = {}
    for r in reports:
        channels[r.channel] = channels.get(r.channel, 0) + 1
    recent = [r for r in reports if r.created_at.replace(tzinfo=timezone.utc) >= since]
    return CommunityStats(
        reports=len(reports),
        last_24h=len(recent),
        channels=channels,
        status=case.status if case else "none",
    )


async def scan(raw: str, scan_id: str, mode: str = "deep", source: str = "web", emit: Emit = _noop) -> ScanResult:
    s = get_settings()
    t0 = time.perf_counter()
    timings: dict[str, int] = {}
    deep = mode == "deep"
    reg = get_registry()
    p0 = parse(raw)
    model = url_model_or_none()
    sig = fusion.Signals()

    def lap(name: str, start: float) -> None:
        timings[name] = int((time.perf_counter() - start) * 1000)

    emit("trust", "running")
    st = time.perf_counter()
    tranco0 = model.tranco_rank(p0.registrable) if model else None
    trust0 = anchors.check(p0, tranco0)
    lap("trust", st)
    emit("trust", "done", p0.registrable)

    emit("intel", "running")
    emit("domain", "running")
    intel_task = asyncio.create_task(_timed(intel.lookup(p0.url, p0.registrable, deep), 12))
    domain_task = asyncio.create_task(_timed(domain_intel.gather(p0.hostname, p0.registrable, deep), 12))
    render_task: asyncio.Task | None = None
    if deep:
        emit("render", "running")
        render_task = asyncio.create_task(_timed(sandbox.render(p0.url, scan_id), s.render_timeout_s + 25))

    emit("url_model", "running")
    st = time.perf_counter()
    model_p0 = model.score_url(p0.url) if model else None
    model_explain = model.explain(p0.url, top_k=4) if model else []
    lap("url_model", st)
    emit("url_model", "done", f"{model_p0:.2f}" if model_p0 is not None else "unavailable")

    rr: RenderResult | None = await render_task if render_task else None
    if deep:
        emit("render", "done" if rr and rr.primary.ok else "error", rr.primary.error if rr and not rr.primary.ok else None)

    landing = rr.primary.final_url if rr else None
    if not deep and (trust0.shortener or (len(p0.registrable) <= 7 and 1 < len(p0.path) <= 16)):
        landing = await _timed(unshorten(p0.url), 8)
    p = p0
    if landing and landing.startswith("http"):
        try:
            p = parse(landing)
        except ValueError:
            p = p0
    moved = p.registrable != p0.registrable
    tranco = (model.tranco_rank(p.registrable) if model else None) if moved else tranco0
    trust = anchors.check(p, tranco) if moved else trust0

    intel0 = await intel_task
    intel1 = await _timed(intel.lookup(p.url, p.registrable, deep), 12) if moved else None
    emit("intel", "done")
    dom: DomainIntel = (await domain_task) or DomainIntel()
    if moved:
        dom = (await _timed(domain_intel.gather(p.hostname, p.registrable, deep), 12)) or DomainIntel()
    emit("domain", "done", f"{dom.age_days} days" if dom.age_days is not None else None)

    model_p = model.score_url(p.url) if (model and moved) else model_p0
    if moved and model:
        model_explain = model.explain(p.url, top_k=4)

    anchored = trust.anchored
    official_brand: Brand | None = trust.brand
    if anchored:
        if official_brand:
            sig.add("official_brand_domain", "trust", -9, f"Official domain of {official_brand.name_en}",
                    f"نطاق رسمي تابع لـ{official_brand.name_ar}", domain=p.registrable)
        else:
            sig.add("official_uae_domain", "trust", -8, "Verified official UAE domain", "نطاق إماراتي رسمي موثّق",
                    domain=p.registrable)
    if trust.tranco_rank and not anchored:
        r = trust.tranco_rank
        w = -4.0 if r <= 1000 else -3.0 if r <= 10000 else -1.8
        if trust.unusual_subdomain:
            w /= 3
        sig.add("tranco_rank", "trust", w, f"Globally popular website (rank #{r:,})",
                f"موقع عالمي شهير (الترتيب {r:,})", rank=r)
    if trust.user_content:
        sig.add("user_content_host", "url", 0.6, "Hosted on a free website builder / shared hosting",
                "مستضاف على منصة مجانية لإنشاء المواقع", host=p.hostname)
    if trust0.shortener:
        sig.add("shortener", "url", 0.3 if anchored else 0.5, "Link uses a URL shortener that hides the real destination",
                "الرابط يستخدم خدمة اختصار تُخفي الوجهة الحقيقية", shortener=p0.hostname)

    hard_intel = False
    for ires, label in ((intel0, p0.url), (intel1, p.url)):
        if not ires:
            continue
        if ires.safe_browsing:
            hard_intel = True
            sig.add("safe_browsing", "intel", 7, "Flagged by Google Safe Browsing", "مُصنّف خطيرًا لدى Google Safe Browsing",
                    f"Threat types: {', '.join(ires.safe_browsing)}", f"أنواع التهديد: {', '.join(ires.safe_browsing)}",
                    url=label, threats=ires.safe_browsing)
        if ires.urlhaus:
            hard_intel = True
            sig.add("urlhaus", "intel", 6, "Listed by abuse.ch URLhaus", "مُدرج في قائمة URLhaus للتهديدات", url=label, threat=ires.urlhaus)
        vt = ires.virustotal or {}
        if vt.get("malicious", 0) + vt.get("suspicious", 0) >= 3:
            sig.add("virustotal", "intel", 5, f"{vt.get('malicious', 0)} security vendors flag this link (VirusTotal)",
                    f"{vt.get('malicious', 0)} من شركات الأمن تصنّف الرابط خطيرًا (VirusTotal)", stats=vt)
        elif vt.get("malicious", 0) >= 1:
            sig.add("virustotal", "intel", 2, f"{vt['malicious']} security vendor(s) flag this link (VirusTotal)",
                    f"{vt['malicious']} من شركات الأمن تصنّف الرابط خطيرًا (VirusTotal)", stats=vt)
        vd = ires.virustotal_domain or {}
        if vd.get("malicious", 0) >= 2 and not anchored:
            sig.add("virustotal_domain", "intel", 2.5, f"Domain flagged by {vd['malicious']} vendors (VirusTotal)",
                    f"النطاق مُصنّف خطيرًا لدى {vd['malicious']} شركات أمن (VirusTotal)", stats=vd)
        us = ires.urlscan or {}
        if us.get("malicious"):
            sig.add("urlscan", "intel", 3, "Previously detected as malicious on urlscan.io",
                    "سبق رصده كموقع ضار على urlscan.io", scans=us.get("scans"), malicious=us.get("malicious"))

    fidx = feeds.index()
    for url in {p0.url, p.url}:
        hit = fidx.lookup(url)
        if not hit:
            continue
        source, kind = hit
        if kind == "url":
            hard_intel = True
            sig.add("feed_url", "intel", 6.5, f"Listed in a live phishing feed ({source})",
                    f"مُدرج في قائمة حيّة لروابط التصيّد ({source})", source=source)
        elif not anchored and not (trust.tranco_rank and trust.tranco_rank <= 10000 and not trust.unusual_subdomain):
            sig.add("feed_host", "intel", 4.5, f"Host appears in a live phishing feed ({source})",
                    f"الخادم مُدرج في قائمة حيّة للتصيّد ({source})", source=source)

    blocklist = db.cached_blocklist(2.0)
    for key in {_site_key(p0), _site_key(p)}:
        b = blocklist.get(key)
        if b and b.scan_id != scan_id:
            w = {"police": 8.0, "community": 6.0}.get(b.source, 4.0)
            if b.source == "police":
                hard_intel = True
            sig.add(f"blocklist_{b.source}", "community" if b.source != "engine" else "intel", w,
                    {"police": "Confirmed scam by police analysts", "community": "Confirmed scam by the community"}.get(
                        b.source, "Previously detected as a scam by Trust Issues"),
                    {"police": "احتيال مؤكد من محللي الشرطة", "community": "احتيال مؤكد من المجتمع"}.get(
                        b.source, "سبق رصده كموقع احتيالي بواسطة أزمة ثقة"),
                    domain=key)

    if model_p is not None:
        w = _logit(model_p) * (0.6 if anchored else 0.9)
        reasons = model_explain or []
        sig.add("url_model", "url", w, f"AI link model: {int(round(model_p * 100))}% scam likelihood",
                f"نموذج تحليل الروابط: احتمال احتيال {int(round(model_p * 100))}%",
                "; ".join(r.get("reason_en", "") for r in reasons[:3]) or None,
                "؛ ".join(r.get("reason_ar", "") for r in reasons[:3]) or None,
                probability=round(model_p, 4), top_features=reasons)

    if dom.age_days is not None and not anchored:
        a = dom.age_days
        if a < 7:
            sig.add("domain_age", "domain", 2.5, f"Domain registered only {a} day(s) ago", f"تم تسجيل النطاق قبل {a} يوم فقط", age_days=a)
        elif a < 30:
            sig.add("domain_age", "domain", 1.6, f"Very new domain ({a} days old)", f"نطاق حديث جدًا (عمره {a} يومًا)", age_days=a)
        elif a < 120:
            sig.add("domain_age", "domain", 0.7, f"Recently registered domain ({a} days old)", f"نطاق مسجّل مؤخرًا (عمره {a} يومًا)", age_days=a)
        elif a > 3 * 365:
            sig.add("domain_age", "domain", -1.2, f"Established domain ({a // 365} years old)", f"نطاق قديم وموثوق (عمره {a // 365} سنوات)", age_days=a)
    if dom.tls_age_days is not None and dom.tls_age_days <= 3 and (dom.age_days is None or dom.age_days < 60) and not anchored:
        sig.add("fresh_tls", "domain", 0.6, f"HTTPS certificate issued {dom.tls_age_days} day(s) ago",
                f"شهادة HTTPS صادرة قبل {dom.tls_age_days} يوم", issuer=dom.tls_issuer)
    if not dom.ips and (not rr or not rr.primary.ok):
        sig.add("no_dns", "domain", 0.3, "Domain no longer resolves (possibly already taken down)",
                "النطاق لم يعد يعمل (ربما تمت إزالته)")

    imp = reg.impersonation(p.hostname, p.registrable) or (reg.impersonation(p0.hostname, p0.registrable) if moved else None)
    impersonated: Brand | None = None
    if imp and not anchored:
        brand, method, token = imp
        impersonated = brand
        if method in ("keyword", "prefix"):
            base_w = 2.2 if method == "keyword" else 1.2
            sig.add("brand_in_domain", "url", base_w / 2 if p.suffix == "ae" else base_w, f"Uses the name '{token}' ({brand.name_en}) in a domain {brand.name_en} does not own",
                    f"يستخدم اسم '{token}' ({brand.name_ar}) في نطاق لا تملكه {brand.name_ar}", brand=brand.id, token=token)
        else:
            sensitive_brand = brand.category in {"bank", "government", "police", "payments", "telecom", "utility", "transport"}
            sig.add("lookalike_domain", "url", 4.2 if sensitive_brand else 3.5, f"Look-alike of the official domain {token}",
                    f"نطاق مقلّد يشبه النطاق الرسمي {token}", brand=brand.id, official=token, method=method)

    page_capture: PageCapture | None = None
    cloak = Cloaking()
    exfil_leads = []
    page_brand: Brand | None = None
    asks: list[str] = []
    if rr:
        prim = rr.primary
        emit("cloaking", "running")
        cloak = Cloaking(
            detected=rr.cloaking,
            reason=Bilingual(en=rr.cloaking_reason[0], ar=rr.cloaking_reason[1]) if rr.cloaking_reason else None,
            personas=[
                PersonaView(name=c.name, final_url=c.final_url, title=c.title[:140] or None, screenshot_url=c.screenshot_url,
                            dom_hash=c.dom_hash if c.ok else None, status=c.status, error=c.error)
                for c in rr.personas.values()
            ],
        )
        if rr.cloaking and not anchored:
            sig.add("cloaking", "render", 3.0, "Cloaking detected: hides itself from security scanners",
                    "تم كشف التمويه: يُخفي نفسه عن برامج الفحص الأمني", rr.cloaking_reason[0], rr.cloaking_reason[1])
        emit("cloaking", "done", "detected" if rr.cloaking else None)
        asks = prim.asks_for() if prim.ok else []
        if prim.ok and not anchored:
            weights = {"card": 2.0, "cvv": 1.2, "otp": 1.2, "emirates_id": 1.5, "password": 0.8, "iban": 1.0, "expiry": 0.6}
            for kind in asks:
                if kind in weights:
                    en, ar = FIELD_LABELS[kind]
                    sig.add(f"asks_{kind}", "render", weights[kind], en, ar)
            if prim.urgent:
                sig.add("urgency", "render", 0.8, "Uses urgency / threat language", "يستخدم لغة استعجال أو تهديد",
                        prim.urgent[0]["text"][:120], prim.urgent[0]["text"][:120])
            hosts = {parse(h["url"]).registrable for h in prim.hops if h["url"].startswith("http")}
            if len(prim.hops) >= 3 and len(hosts) >= 2:
                sig.add("redirect_chain", "render", 0.6, f"Bounces through {len(prim.hops)} redirects",
                        f"يمر عبر {len(prim.hops)} عمليات إعادة توجيه", hops=len(prim.hops))
            mentions = reg.mentioned_brands(prim.text[:4000], prim.title)
            sensitive = [a for a in asks if a in {"card", "cvv", "otp", "emirates_id", "password", "iban"}]
            if mentions:
                page_brand = mentions[0][0]
                if not reg.is_official(p.registrable, p.hostname) and sensitive:
                    sig.add("brand_intent_mismatch", "visual", 3.5,
                            f"Claims to be {page_brand.name_en} and collects data, but is not on an official {page_brand.name_en} domain",
                            f"يدّعي أنه {page_brand.name_ar} ويجمع البيانات، لكنه ليس على نطاق رسمي لـ{page_brand.name_ar}",
                            brand=page_brand.id, asks_for=asks)
        emit("exfil", "running")
        if prim.ok:
            exfil_leads = exfil.extract(prim, p.registrable)
        if not anchored:
            if any(x.kind == "telegram_bot" for x in exfil_leads):
                sig.add("exfil_telegram", "exfil", 4.5, "Sends entered data to a Telegram bot", "يرسل البيانات المُدخلة إلى بوت تيليجرام")
            if any(x.kind == "webhook" for x in exfil_leads):
                sig.add("exfil_webhook", "exfil", 2.0, "Sends entered data to a third-party webhook", "يرسل البيانات إلى خادم طرف ثالث")
            if any(x.kind == "form_post" for x in exfil_leads):
                sig.add("exfil_form", "exfil", 1.2, "Form submits your data to a different domain", "النموذج يرسل بياناتك إلى نطاق مختلف")
            if any(x.kind == "crypto_wallet" for x in exfil_leads):
                sig.add("exfil_crypto", "exfil", 1.5, "Asks for payment to a crypto wallet", "يطلب الدفع إلى محفظة عملات رقمية")
        emit("exfil", "done", f"{len(exfil_leads)} leads")
        emit("visual", "running")
        fav = visual.favicon_match(prim.favicon_phash)
        if fav and not reg.is_official(p.registrable, p.hostname):
            page_brand = page_brand or fav.brand
            sig.add("favicon_clone", "visual", 3.5, f"Uses the official {fav.brand.name_en} icon",
                    f"يستخدم الأيقونة الرسمية لـ{fav.brand.name_ar}", brand=fav.brand.id, distance=fav.distance)
        emit("visual", "done", page_brand.id if page_brand else None)
        page_capture = _page_capture(prim, asks)

    opinions: list[AIOpinion] = []
    if deep and not anchored and (ai_anthropic.available() or ai_openai.available()):
        emit("ai", "running")
        st = time.perf_counter()
        prim = rr.primary if rr else None
        judge_in = JudgeInput(
            url=p0.url,
            final_url=p.url,
            domain=p.registrable,
            evidence=_ai_evidence(sig, dom, asks, exfil_leads, cloak, model_p, trust, impersonated, page_brand),
            title=prim.title if prim and prim.ok else "",
            text=prim.text if prim and prim.ok else "(page could not be loaded)",
            screenshot_path=prim.screenshot_path if prim and prim.ok else None,
        )
        jobs = []
        if ai_anthropic.available():
            jobs.append(_timed(ai_anthropic.judge(judge_in), 40))
        if ai_openai.available():
            jobs.append(_timed(ai_openai.judge(judge_in), 40))
        opinions = [o for o in await asyncio.gather(*jobs) if o]
        for o in opinions:
            w = {"scam": 3.5, "suspicious": 1.0, "safe": -3.0}[o.verdict] * o.confidence
            sig.add(f"ai_{o.provider.lower()}", "ai", w, f"{o.provider} AI judge: {o.verdict} ({int(o.confidence * 100)}% confident)",
                    f"قاضي الذكاء الاصطناعي {o.provider}: {_verdict_ar(o.verdict)} (ثقة {int(o.confidence * 100)}%)",
                    "; ".join(o.reasons.get("en", [])[:3]) or None, "؛ ".join(o.reasons.get("ar", [])[:3]) or None,
                    model=o.model)
        if len(opinions) >= 2 and all(o.verdict == "scam" for o in opinions):
            sig.add("ai_consensus", "ai", 1.0, "Both independent AI judges agree: scam", "قاضيا الذكاء الاصطناعي المستقلان يتفقان: احتيال")
        lap("ai", st)
        emit("ai", "done", ", ".join(f"{o.provider}:{o.verdict}" for o in opinions) or None)
    else:
        emit("ai", "skipped")

    site = _site_key(p)
    comm = community_stats(site)
    if comm.last_24h and not anchored:
        sig.add("community_reports", "community", min(2.5, 0.6 * comm.last_24h), f"Reported by {comm.last_24h} people in the last 24 hours",
                f"أبلغ عنه {comm.last_24h} أشخاص خلال آخر 24 ساعة", reports=comm.reports)

    emit("fusion", "running")
    score = fusion.score(-1.0, sig, anchored, hard_intel)
    verdict = fusion.verdict_for(score)

    ai_brand = None
    for o in opinions:
        if o.verdict != "safe" and o.target_brand and o.target_brand in reg.brands:
            ai_brand = reg.brands[o.target_brand]
            break
    brand = official_brand if anchored else (ai_brand or page_brand or impersonated)
    if verdict == "safe" and not anchored:
        brand = None
    head = fusion.headline(verdict, brand, official_brand if anchored else None)
    diff = None
    if brand and not anchored and verdict != "safe":
        candidates = {p0.hostname, p.hostname}
        suspect = max(candidates, key=lambda h: fusion.similarity(fusion.best_official_domain(brand, h), h))
        diff = fusion.domain_diff(fusion.best_official_domain(brand, suspect), suspect)

    result = ScanResult(
        id=scan_id,
        input=raw,
        url=p0.url,
        final_url=p.url if p.url != p0.url else None,
        domain=p.registrable,
        verdict=verdict,
        score=score,
        headline=head,
        summary=_summary(sig, verdict),
        brand=brand.ref() if brand else None,
        signals=sorted(sig.items, key=lambda x: -abs(x.weight)),
        redirect_chain=[RedirectHop(url=h["url"], status=h.get("status"), kind=h.get("kind", "http")) for h in (rr.primary.hops if rr else [])],
        cloaking=cloak,
        domain_intel=dom,
        page=page_capture,
        exfil=exfil_leads,
        domain_diff=diff,
        timeline=[],
        community=comm,
        ai=opinions,
        mode="deep" if deep else "fast",
        timings_ms={**timings, "total": int((time.perf_counter() - t0) * 1000)},
        created_at=db.utcnow(),
    )
    result.timeline = _timeline(result, intel0)
    result.evidence = _evidence_hashes(result)
    emit("fusion", "done", f"{score}")
    return result


async def unshorten(url: str) -> str | None:
    """Follow HTTP redirects without rendering (fast mode) to reveal where a short link really goes."""
    async with client().stream("GET", url, timeout=6.0, follow_redirects=True) as resp:
        return str(resp.url)


def _verdict_ar(v: str) -> str:
    return {"scam": "احتيال", "suspicious": "مشبوه", "safe": "آمن"}.get(v, v)


def _page_capture(prim, asks: list[str]) -> PageCapture:
    ann: list[Annotation] = []
    seen_kinds: set[str] = set()
    for inp in prim.inputs:
        kind = classify_input(inp)
        if kind in FIELD_LABELS and kind not in seen_kinds:
            seen_kinds.add(kind)
            en, ar = FIELD_LABELS[kind]
            b = inp["box"]
            ann.append(Annotation(x=b["x"], y=b["y"], w=b["w"], h=b["h"], kind=kind if kind in {"card", "password", "otp", "emirates_id", "phone"} else "form",
                                  label=Bilingual(en=en, ar=ar)))
    for img in prim.imgs[:1]:
        b = img["box"]
        ann.append(Annotation(x=b["x"], y=b["y"], w=b["w"], h=b["h"], kind="logo", label=Bilingual(en="Brand logo used on this page", ar="شعار العلامة المستخدم في الصفحة")))
    for u in prim.urgent[:2]:
        b = u["box"]
        ann.append(Annotation(x=b["x"], y=b["y"], w=b["w"], h=b["h"], kind="urgency", label=Bilingual(en="Urgency / pressure text", ar="نص استعجال وضغط")))
    return PageCapture(
        title=prim.title[:200] or None,
        screenshot_url=prim.screenshot_url,
        width=PERSONAS[prim.name]["viewport"]["width"],
        height=prim.height,
        annotations=ann,
        language=prim.lang or None,
        text_excerpt=prim.text[:600] or None,
        favicon_hash=prim.favicon_mmh3,
        asks_for=asks,
    )


def _ai_evidence(sig, dom, asks, leads, cloak, model_p, trust, impersonated, page_brand) -> dict[str, Any]:
    return {
        "signals_so_far": [f"{s.title.en} (w={s.weight})" for s in sig.items],
        "domain_age_days": dom.age_days,
        "registrar": dom.registrar,
        "hosting": f"{dom.as_org or ''} {dom.country or ''}".strip(),
        "tls_issuer": dom.tls_issuer,
        "form_fields_requested": asks,
        "exfiltration": [f"{x.kind}: {x.value[:60]}" for x in leads[:6]],
        "cloaking": cloak.reason.en if cloak.detected and cloak.reason else None,
        "url_model_probability": round(model_p, 3) if model_p is not None else None,
        "on_shared_hosting": trust.user_content,
        "domain_brand_hint": impersonated.id if impersonated else None,
        "page_brand_hint": page_brand.id if page_brand else None,
    }


def _summary(sig: fusion.Signals, verdict: str) -> Bilingual:
    top = [s for s in sorted(sig.items, key=lambda x: -x.weight) if (s.weight > 0) == (verdict != "safe")][:3]
    if not top:
        return Bilingual(en="No strong risk signals were found.", ar="لم يتم العثور على مؤشرات خطر قوية.")
    return Bilingual(en=" · ".join(s.title.en for s in top), ar=" · ".join(s.title.ar for s in top))


def _timeline(r: ScanResult, intel0) -> list[TimelineEvent]:
    ev: list[TimelineEvent] = []
    if r.domain_intel.registered:
        ev.append(TimelineEvent(ts=r.domain_intel.registered, kind="registered", label=Bilingual(en="Domain registered", ar="تسجيل النطاق")))
    if r.domain_intel.tls_not_before:
        ev.append(TimelineEvent(ts=r.domain_intel.tls_not_before, kind="certificate", label=Bilingual(en="HTTPS certificate issued", ar="إصدار شهادة HTTPS")))
    if intel0 and intel0.urlscan and intel0.urlscan.get("first_seen"):
        try:
            ts = datetime.fromisoformat(intel0.urlscan["first_seen"].replace("Z", "+00:00"))
            ev.append(TimelineEvent(ts=ts, kind="first_seen", label=Bilingual(en="First seen by security scanners", ar="أول رصد من برامج الفحص الأمني")))
        except ValueError:
            pass
    with db.session() as s:
        first = s.exec(select(db.Report).where(db.Report.domain == r.domain).order_by(db.Report.created_at)).first()
    if first:
        ev.append(TimelineEvent(ts=first.created_at.replace(tzinfo=timezone.utc), kind="reported", label=Bilingual(en="First reported by a user", ar="أول بلاغ من مستخدم")))
    ev.append(TimelineEvent(ts=r.created_at, kind="scanned", label=Bilingual(en="Analysed by Trust Issues", ar="تم التحليل بواسطة أزمة ثقة")))
    if r.verdict == "scam":
        ev.append(TimelineEvent(ts=r.created_at, kind="blocked", label=Bilingual(en="Blocked for all protected phones", ar="تم حظره لجميع الهواتف المحمية")))
    return sorted(ev, key=lambda e: e.ts)


def _sha256_file(path: str | None) -> str | None:
    if not path:
        return None
    fp = Path(path)
    return hashlib.sha256(fp.read_bytes()).hexdigest() if fp.exists() else None


def _evidence_hashes(r: ScanResult) -> dict[str, Any]:
    media = get_settings().media_dir
    shots = {}
    for pv in r.cloaking.personas:
        if pv.screenshot_url:
            shots[pv.name] = _sha256_file(str(media / pv.screenshot_url.replace("/media/", "")))
    body = r.model_dump(mode="json", exclude={"evidence"})
    return {
        "captured_at_utc": r.created_at.isoformat(),
        "captured_at_gst": (r.created_at + timedelta(hours=4)).strftime("%Y-%m-%d %H:%M:%S GST"),
        "screenshot_sha256": shots,
        "result_sha256": hashlib.sha256(json.dumps(body, sort_keys=True, ensure_ascii=False).encode()).hexdigest(),
        "pdf_url": f"/api/scans/{r.id}/evidence.pdf",
        "json_url": f"/api/scans/{r.id}/evidence.json",
    }


def instant(url: str) -> dict[str, Any]:
    """Offline verdict in milliseconds (trust anchors, local feeds, blocklist, URL model) for badging many links at once."""
    p = parse(url)
    model = url_model_or_none()
    trust = anchors.check(p, model.tranco_rank(p.registrable) if model else None)
    reg = get_registry()
    if trust.anchored:
        brand = trust.brand
        return {"url": p.url, "verdict": "safe", "score": 2, "official": True, "brand": brand.ref().model_dump() if brand else None,
                "headline": fusion.headline("safe", None, brand).model_dump()}
    z = -1.0
    reasons: list[dict[str, str]] = []
    hit = feeds.index().lookup(p.url)
    entry = db.cached_blocklist().get(_site_key(p))
    if hit or entry:
        z += 7
        reasons.append({"en": "Known scam link", "ar": "رابط احتيالي معروف"})
    if model:
        z += _logit(model.score_url(p.url)) * 0.9
    if trust.tranco_rank:
        z += (-4.0 if trust.tranco_rank <= 1000 else -3.0 if trust.tranco_rank <= 10000 else -1.8) / (3 if trust.unusual_subdomain else 1)
    imp = reg.impersonation(p.hostname, p.registrable)
    if imp:
        z += 2.5
        reasons.append({"en": f"Imitates {imp[0].name_en}", "ar": f"ينتحل صفة {imp[0].name_ar}"})
    score = int(round(100 / (1 + math.exp(-z))))
    verdict = fusion.verdict_for(score)
    brand = imp[0] if imp else None
    return {"url": p.url, "verdict": verdict, "score": score, "official": False, "brand": brand.ref().model_dump() if brand else None,
            "headline": fusion.headline(verdict, brand, None).model_dump(), "reasons": reasons}


def site_key_for(url: str) -> str:
    return _site_key(parse(url))
