"""Trust Issues | أزمة ثقة: API, protective DNS, police console and web app server."""
from __future__ import annotations

import asyncio
import hashlib
import hmac
import io
import json
import re
import logging
import time
from contextlib import asynccontextmanager
from datetime import timedelta
from typing import Any, Literal

from fastapi import Depends, FastAPI, File, Header, HTTPException, Request, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse, PlainTextResponse, Response
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from sqlmodel import func, select
from sse_starlette.sse import EventSourceResponse

from . import accounts, batch, bot, bus, db, family, scans
from .community import reports
from .config import ROOT_DIR, get_settings
from .detectors import ai_anthropic, anchors, feeds, message_rules
from .detectors.render import sandbox
from .dns import doh, profile
from .evidence import card, pdf, takedown
from .graph.campaigns import global_graph
from .http import close as close_http
from .hunters import ct, feedwatch, radar, serp, typosquat
from .notify import webpush
from .pipeline import instant, url_model_or_none
from .registry import BRANDS_DIR, get_registry
from .urlutil import find_urls, parse

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")
log = logging.getLogger("trust_issues")
settings = get_settings()


def _protected(registrable: str, hostname: str) -> bool:
    if get_registry().is_official(registrable, hostname):
        return True
    model = url_model_or_none()
    rank = model.tranco_rank(registrable) if model else None
    return bool(rank and rank <= 100_000 and anchors.is_plain_host(hostname, registrable))


async def _every(seconds: float, fn, initial_delay: float = 0) -> None:
    await asyncio.sleep(initial_delay)
    while True:
        try:
            await fn()
        except Exception as exc:
            log.warning("background job %s failed: %s", getattr(fn, "__name__", fn), exc)
        await asyncio.sleep(seconds)


@asynccontextmanager
async def lifespan(_: FastAPI):
    db.init_db()
    accounts.migrate()
    webpush.keys()
    jobs = [asyncio.create_task(_every(3600, lambda: feeds.refresh(_protected))), asyncio.create_task(bot.run())]
    if settings.enable_hunters:
        jobs += [
            asyncio.create_task(ct.run()),
            asyncio.create_task(_every(6 * 3600, typosquat.sweep_typosquats, initial_delay=120)),
            asyncio.create_task(_every(12 * 3600, typosquat.sweep_nrd, initial_delay=300)),
            asyncio.create_task(_every(8 * 3600, serp.sweep, initial_delay=600)),
            asyncio.create_task(_every(3 * 3600, feedwatch.sweep, initial_delay=90)),
        ]
    yield
    for j in jobs:
        j.cancel()
    await sandbox.close()
    await close_http()


app = FastAPI(title="Trust Issues | أزمة ثقة", version="1.0.0", lifespan=lifespan)
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])
app.mount("/media/brands", StaticFiles(directory=str(BRANDS_DIR / "assets"), check_dir=False), name="brands")
app.mount("/media/refs", StaticFiles(directory=str(BRANDS_DIR / "refs"), check_dir=False), name="refs")
app.mount("/media", StaticFiles(directory=str(settings.media_dir)), name="media")


class ScanIn(BaseModel):
    input: str
    mode: Literal["fast", "deep"] = "deep"
    source: str = "web"
    device_id: str | None = None


class ReportIn(BaseModel):
    url: str
    channel: str = "other"
    note: str | None = None
    device_id: str | None = None


class DeviceIn(BaseModel):
    platform: Literal["ios", "android", "other"] = "other"
    lang: Literal["en", "ar"] = "ar"


class LoginIn(BaseModel):
    password: str


class QueryIn(BaseModel):
    query: str


class CheckIn(BaseModel):
    urls: list[str]


@app.get("/api/health")
async def health() -> dict[str, Any]:
    model = url_model_or_none()
    return {
        "ok": True,
        "feeds": {"urls": len(feeds.index().urls), "hosts": len(feeds.index().hosts), "loaded_at": feeds.index().loaded_at},
        "brands": len(get_registry().brands),
        "url_model": model is not None,
        "ai": {"anthropic": ai_anthropic.available(), "openai": bool(settings.openai_api_key)},
        "ct": ct.stats,
    }


_hits: dict[str, list[float]] = {}


def client_ip(request: Request) -> str:
    return (request.headers.get("x-forwarded-for") or (request.client.host if request.client else "?")).split(",")[0].strip()


def rate_limit(request: Request, per_minute: int = 30) -> None:
    ip = client_ip(request)
    now = time.time()
    window = [t for t in _hits.get(ip, []) if now - t < 60]
    if len(window) >= per_minute:
        raise HTTPException(429, "too many requests, please wait a minute")
    window.append(now)
    _hits[ip] = window


@app.post("/api/scans", dependencies=[Depends(rate_limit)])
async def create_scan(body: ScanIn) -> dict[str, Any]:
    text = body.input.strip()
    if not text:
        raise HTTPException(400, "empty input")
    urls = find_urls(text)
    is_message = len(text.split()) > 3 or len(urls) != 1 or (urls and len(text) > len(urls[0]) + 12)
    if not urls:
        try:
            urls = [parse(text).url] if " " not in text else []
        except ValueError:
            urls = []
    started = [{"id": scans.start(u, mode=body.mode, source=body.source), "url": u} for u in urls[:5]]
    message = None
    if is_message:
        m = None
        if ai_anthropic.available():
            try:
                m = await asyncio.wait_for(ai_anthropic.analyze_message(text), 30)
            except Exception as exc:
                log.info("AI message analysis failed, using rules: %s", exc)
        m = m or message_rules.analyze(text)
        message = {"is_scam_text": m["is_scam"], "score": m["score"], "scam_type": m["scam_type"],
                   "brand_id": m.get("impersonated_brand_id"), "reasons": {"en": m["reasons_en"], "ar": m["reasons_ar"]},
                   "urls_found": urls}
    if not started and message is None:
        raise HTTPException(422, "no link found in the input")
    return {"scans": started, "message": message}


@app.post("/api/check")
async def instant_check(body: CheckIn) -> dict[str, Any]:
    out = []
    for u in body.urls[:200]:
        try:
            out.append(instant(u))
        except ValueError:
            out.append({"url": u, "verdict": "unknown", "score": 0})
    return {"items": out}


@app.get("/api/scans/{scan_id}/events")
async def scan_events(scan_id: str, request: Request):
    stored = scans.get(scan_id)

    async def gen():
        if stored:
            yield {"event": "result", "data": json.dumps(stored, ensure_ascii=False)}
            return
        q = bus.channel(f"scan:{scan_id}").subscribe()
        try:
            while True:
                if await request.is_disconnected():
                    return
                try:
                    event, data = await asyncio.wait_for(q.get(), 30)
                except asyncio.TimeoutError:
                    yield {"event": "ping", "data": "{}"}
                    continue
                if event == "__close__":
                    return
                yield {"event": event, "data": json.dumps(data, ensure_ascii=False, default=str)}
        finally:
            bus.channel(f"scan:{scan_id}").unsubscribe(q)

    return EventSourceResponse(gen())


def _result_or_404(scan_id: str) -> dict[str, Any]:
    r = scans.get(scan_id)
    if not r:
        raise HTTPException(404, "scan not found or still running")
    return r


@app.get("/api/scans/{scan_id}")
async def get_scan(scan_id: str) -> dict[str, Any]:
    return _result_or_404(scan_id)


@app.get("/api/scans/{scan_id}/evidence.pdf")
async def evidence_pdf(scan_id: str) -> Response:
    data = await asyncio.to_thread(pdf.build, _result_or_404(scan_id))
    return Response(data, media_type="application/pdf", headers={"Content-Disposition": f'attachment; filename="evidence_{scan_id}.pdf"'})


@app.get("/api/scans/{scan_id}/evidence.json")
async def evidence_json(scan_id: str) -> JSONResponse:
    r = _result_or_404(scan_id)
    body = json.dumps(r, ensure_ascii=False, sort_keys=True)
    return JSONResponse({"sha256": hashlib.sha256(body.encode()).hexdigest(), "evidence": r},
                        headers={"Content-Disposition": f'attachment; filename="evidence_{scan_id}.json"'})


@app.get("/api/scans/{scan_id}/warning-card.png")
async def warning_card(scan_id: str) -> Response:
    data = await asyncio.to_thread(card.build, _result_or_404(scan_id))
    return Response(data, media_type="image/png")


@app.get("/api/scans/{scan_id}/takedown")
async def takedown_drafts(scan_id: str) -> dict[str, Any]:
    return takedown.drafts(_result_or_404(scan_id))


@app.post("/api/reports", dependencies=[Depends(rate_limit)])
async def create_report(body: ReportIn) -> dict[str, Any]:
    try:
        return reports.submit(body.url, body.channel, body.note, body.device_id)
    except ValueError as exc:
        raise HTTPException(400, str(exc)) from exc


@app.get("/api/trending")
async def trending() -> dict[str, Any]:
    return {"items": await asyncio.to_thread(reports.trending)}


@app.get("/api/stats")
async def stats() -> dict[str, Any]:
    since = db.utcnow() - timedelta(hours=24)
    with db.session() as s:
        blocked = s.exec(select(func.count()).select_from(db.BlockEntry).where(db.BlockEntry.active == True)).one()  # noqa: E712
        scams24 = s.exec(select(func.count()).select_from(db.ScanRecord).where(db.ScanRecord.verdict == "scam", db.ScanRecord.created_at >= since)).one()
        reports24 = s.exec(select(func.count()).select_from(db.Report).where(db.Report.created_at >= since)).one()
    return {
        "scans_total": db.counter("scans_total"),
        "scams_detected": db.counter("scams_detected"),
        "reports_total": db.counter("reports_total"),
        "blocked_queries": db.counter("blocked_queries"),
        "domains_blocklisted": blocked + len(feeds.index().hosts),
        "hunters": {k: db.counter(f"hunter_{k}") for k in ("ct", "search", "maps", "typosquat", "nrd")},
        "last_24h": {"scams": scams24, "reports": reports24},
        "ct_certs_watched": ct.stats["certs"],
    }


@app.get("/api/live")
async def live() -> dict[str, Any]:
    since = db.utcnow() - timedelta(hours=24)
    reg = get_registry()
    with db.session() as s:
        scams24 = s.exec(select(func.count()).select_from(db.ScanRecord).where(db.ScanRecord.verdict == "scam", db.ScanRecord.created_at >= since)).one()
        rows = s.exec(select(db.ScanRecord).where(db.ScanRecord.verdict == "scam").order_by(db.ScanRecord.created_at.desc()).limit(60)).all()
    recent, seen = [], set()
    for row in rows:
        site = row.domain
        if site in seen:
            continue
        seen.add(site)
        brand = reg.brands.get(row.brand_id) if row.brand_id else None
        recent.append({"domain": site.replace(".", "[.]"), "brand": brand.ref().model_dump() if brand else None,
                       "source": row.source, "score": row.score, "ts": row.created_at.isoformat(), "scan_id": row.id})
        if len(recent) >= 12:
            break
    return {
        "certs_checked": db.counter("ct_certs"),
        "scams_today": scams24,
        "blocked_queries": db.counter("blocked_queries"),
        "brands_protected": len(reg.brands),
        "recent": recent,
    }


class FamilyCreateIn(BaseModel):
    device_id: str
    family_name: str
    my_name: str
    phone: str | None = None


class InviteIn(BaseModel):
    device_id: str
    name: str
    role: Literal["guardian", "elder", "child", "helper", "adult"]
    strict: bool | None = None


class JoinIn(BaseModel):
    device_id: str
    phone: str | None = None


class DecisionIn(BaseModel):
    device_id: str
    decision: Literal["allow", "block"]


class StrictIn(BaseModel):
    device_id: str
    strict: bool


class DeviceOnlyIn(BaseModel):
    device_id: str


async def _family(fn, *args: Any) -> Any:
    try:
        return await asyncio.to_thread(fn, *args)
    except family.FamilyError as exc:
        raise HTTPException(exc.status, str(exc)) from exc


@app.get("/api/family/{device_id}")
async def family_state(device_id: str) -> dict[str, Any]:
    return await _family(family.state, device_id)


@app.post("/api/family")
async def family_create(body: FamilyCreateIn) -> dict[str, Any]:
    return await _family(family.create, body.device_id, body.family_name, body.my_name, body.phone)


@app.post("/api/family/invites")
async def family_invite(body: InviteIn) -> dict[str, Any]:
    return await _family(family.invite, body.device_id, body.name, body.role, body.strict)


@app.get("/api/join/{code}")
async def family_invite_info(code: str) -> dict[str, Any]:
    return await _family(family.invite_info, code)


@app.get("/api/join/{code}/qr.svg")
async def family_invite_qr(code: str) -> Response:
    import segno

    url = f"{settings.public_base_url.rstrip('/')}/join/{code.upper()}"
    buf = io.BytesIO()
    segno.make(url, error="m").save(buf, kind="svg", scale=8, border=2, dark="#0b0d10", light="#ffffff", xmldecl=False)
    return Response(buf.getvalue(), media_type="image/svg+xml", headers={"Cache-Control": "public, max-age=86400"})


@app.post("/api/join/{code}")
async def family_join(code: str, body: JoinIn) -> dict[str, Any]:
    return await _family(family.join, code, body.device_id, body.phone)


@app.post("/api/family/requests/{request_id}")
async def family_decide(request_id: str, body: DecisionIn) -> dict[str, Any]:
    return await _family(family.decide, body.device_id, request_id, body.decision)


@app.post("/api/family/members/{member_id}/strict")
async def family_strict(member_id: str, body: StrictIn) -> dict[str, Any]:
    return await _family(family.set_strict, body.device_id, member_id, body.strict)


@app.post("/api/family/members/{member_id}/remove")
async def family_remove(member_id: str, body: DeviceOnlyIn) -> dict[str, Any]:
    return await _family(family.remove, body.device_id, member_id)


@app.post("/api/family/sos")
async def family_sos(body: DeviceOnlyIn) -> dict[str, Any]:
    out = await _family(family.sos, body.device_id)
    return {**out, "helplines": family.helplines()}


@app.get("/api/manifest")
async def device_manifest(d: str = "") -> JSONResponse:
    """The PWA manifest with this phone's device ID in start_url, so the Home Screen app and Safari share one identity."""
    path = settings.web_dist / "manifest.webmanifest"
    data = json.loads(path.read_text(encoding="utf-8")) if path.exists() else {"name": "Trust Issues", "display": "standalone"}
    if re.fullmatch(r"dev_[A-Za-z0-9]{6,20}", d):
        in_family = await asyncio.to_thread(family.member, d) is not None
        data["start_url"] = f"/{'family' if in_family else ''}?d={d}"
    return JSONResponse(data, media_type="application/manifest+json", headers={"Cache-Control": "no-store"})


@app.get("/api/helplines")
async def bank_helplines() -> dict[str, Any]:
    return {"items": family.helplines()}


@app.get("/api/brands")
async def brands() -> list[dict[str, Any]]:
    return [b.ref().model_dump() for b in get_registry().brands.values()]


@app.post("/api/devices")
async def register_device(body: DeviceIn) -> dict[str, Any]:
    device = db.Device(id=db.new_id("dev"), platform=body.platform, lang=body.lang)
    with db.session() as s:
        s.add(device)
        s.commit()
    return _registration(device.id)


def _registration(device_id: str) -> dict[str, Any]:
    return {
        "device_id": device_id,
        "doh_url": profile.doh_url(device_id),
        "ios_profile_url": f"/api/protect/{device_id}/ios.mobileconfig",
        "android_hostname_hint": profile.doh_url(device_id),
    }


class CodeIn(BaseModel):
    login: str
    purpose: Literal["register", "sign_in"]
    device_id: str | None = None


class VerifyIn(CodeIn):
    code: str


async def _account(fn, *args: Any) -> Any:
    try:
        return await asyncio.to_thread(fn, *args)
    except accounts.AccountError as exc:
        raise HTTPException(exc.status, str(exc)) from exc


@app.get("/api/account/{device_id}")
async def account_status(device_id: str) -> dict[str, Any]:
    return await _account(accounts.status, device_id)


@app.post("/api/account/code", dependencies=[Depends(rate_limit)])
async def account_code(body: CodeIn, request: Request) -> dict[str, Any]:
    """Email a one-time code, to register this phone's family or to sign in on another screen."""
    return await _account(accounts.request_code, body.login, body.purpose, body.device_id, client_ip(request))


@app.post("/api/account/verify", dependencies=[Depends(rate_limit)])
async def account_verify(body: VerifyIn, request: Request) -> dict[str, Any]:
    out = await _account(accounts.verify, body.login, body.code, body.purpose, body.device_id, client_ip(request))
    return _registration(out["device_id"]) if body.purpose == "sign_in" else out


@app.get("/api/devices/{device_id}/blocks")
async def device_blocks(device_id: str) -> dict[str, Any]:
    return {"items": await asyncio.to_thread(doh.blocks_for, device_id)}


@app.post("/api/devices/{device_id}/push")
async def device_push(device_id: str, request: Request) -> dict[str, Any]:
    sub = await request.json()
    with db.session() as s:
        d = s.get(db.Device, device_id)
        if d is None:
            raise HTTPException(404, "unknown device")
        d.push_json = json.dumps(sub)
        s.add(d)
        s.commit()
    await asyncio.to_thread(webpush.send, d, {"title": "🛡️ أزمة ثقة · Trust Issues", "body": "Alerts are on · التنبيهات مفعّلة", "url": "/protect"})
    return {"ok": True}


@app.get("/api/push/vapid-public-key")
async def vapid_key() -> dict[str, str]:
    return {"key": webpush.keys()[0]}


@app.get("/api/protect/{device_id}/ios.mobileconfig")
async def ios_profile(device_id: str) -> Response:
    return Response(profile.mobileconfig(device_id), media_type="application/x-apple-aspen-config",
                    headers={"Content-Disposition": 'attachment; filename="TrustIssues-ScamShield.mobileconfig"'})


async def _doh(request: Request, device_id: str | None) -> Response:
    if request.method == "POST":
        wire = await request.body()
    else:
        param = request.query_params.get("dns")
        if not param:
            raise HTTPException(400, "missing dns parameter")
        wire = doh.decode_get(param)
    try:
        answer = await doh.resolve(wire, device_id)
    except Exception as exc:
        log.info("doh failure: %s", exc)
        raise HTTPException(502, "upstream failure") from exc
    return Response(answer, media_type="application/dns-message", headers={"Cache-Control": "max-age=30"})


@app.api_route("/dns-query", methods=["GET", "POST"])
async def doh_anonymous(request: Request) -> Response:
    return await _doh(request, None)


@app.api_route("/dns-query/{device_id}", methods=["GET", "POST"])
async def doh_device(device_id: str, request: Request) -> Response:
    return await _doh(request, device_id)


def _console_token() -> str:
    return hmac.new(settings.console_password.encode(), b"trust-issues-console", hashlib.sha256).hexdigest()


def require_console(authorization: str = Header(default="")) -> None:
    if not hmac.compare_digest(authorization.removeprefix("Bearer ").strip(), _console_token()):
        raise HTTPException(401, "console login required")


@app.post("/api/console/login")
async def console_login(body: LoginIn) -> dict[str, str]:
    if settings.console_password in ("", "change-me") and not settings.public_base_url.startswith("http://localhost"):
        raise HTTPException(503, "console disabled: set CONSOLE_PASSWORD on the server")
    if not hmac.compare_digest(body.password.strip(), settings.console_password):
        raise HTTPException(401, "wrong password")
    return {"token": _console_token()}


@app.get("/api/console/cases", dependencies=[Depends(require_console)])
async def console_cases(status: str = "all") -> dict[str, Any]:
    with db.session() as s:
        q = select(db.Case).order_by(db.Case.updated_at.desc()).limit(500)
        if status != "all":
            q = q.where(db.Case.status == status)
        rows = s.exec(q).all()
        counts = {r.domain: 0 for r in rows}
        for rep in s.exec(select(db.Report).where(db.Report.domain.in_(list(counts)))).all():
            counts[rep.domain] += 1
    reg = get_registry()
    return {"items": [{
        "id": c.id, "domain": c.domain, "url": c.url, "source": c.source, "verdict": c.verdict, "score": c.score,
        "brand": reg.brands[c.brand_id].ref().model_dump() if c.brand_id in reg.brands else None,
        "reports": counts.get(c.domain, 0), "created_at": c.created_at.isoformat(), "scan_id": c.scan_id, "status": c.status,
    } for c in rows]}


@app.post("/api/console/cases/{case_id}/{action}", dependencies=[Depends(require_console)])
async def console_case_action(case_id: str, action: Literal["confirm", "reject"]) -> dict[str, Any]:
    case = reports.set_case_status(case_id, "confirmed" if action == "confirm" else "rejected")
    if case is None:
        raise HTTPException(404, "case not found")
    doh.invalidate()
    return {"ok": True, "status": case.status}


@app.get("/api/console/radar")
async def console_radar(request: Request, token: str = ""):
    if not hmac.compare_digest(token, _console_token()):
        raise HTTPException(401, "console login required")

    async def gen():
        q = bus.channel("radar").subscribe(replay=False)
        try:
            while not await request.is_disconnected():
                try:
                    event, data = await asyncio.wait_for(q.get(), 25)
                except asyncio.TimeoutError:
                    yield {"event": "ping", "data": "{}"}
                    continue
                yield {"event": "radar", "data": json.dumps(data, ensure_ascii=False, default=str)}
        finally:
            bus.channel("radar").unsubscribe(q)

    return EventSourceResponse(gen())


@app.get("/api/console/radar/recent", dependencies=[Depends(require_console)])
async def console_radar_recent() -> dict[str, Any]:
    return {"items": await asyncio.to_thread(radar.recent, 150), "ct": ct.stats}


@app.get("/api/console/graph", dependencies=[Depends(require_console)])
async def console_graph() -> dict[str, Any]:
    return await asyncio.to_thread(global_graph)


@app.post("/api/console/batch", dependencies=[Depends(require_console)])
async def console_batch(file: UploadFile = File(...)) -> dict[str, str]:
    raw = await file.read()
    if len(raw) > 5_000_000:
        raise HTTPException(413, "file too large")
    return {"job_id": batch.start(raw)}


@app.get("/api/console/batch/{job_id}", dependencies=[Depends(require_console)])
async def console_batch_status(job_id: str) -> dict[str, Any]:
    st = batch.status(job_id)
    if st is None:
        raise HTTPException(404, "job not found")
    return st


@app.get("/api/console/batch/{job_id}/results.csv")
async def console_batch_results(job_id: str, token: str = "") -> FileResponse:
    if not hmac.compare_digest(token, _console_token()):
        raise HTTPException(401, "console login required")
    path = batch.results_path(job_id)
    if path is None:
        raise HTTPException(404, "results not ready")
    return FileResponse(path, media_type="text/csv", filename=f"trust_issues_{job_id}.csv")


@app.post("/api/console/hunt/search", dependencies=[Depends(require_console)])
async def console_hunt_search(body: QueryIn) -> dict[str, Any]:
    try:
        return {"items": await serp.hunt_search(body.query), "searches_left": await serp.searches_left()}
    except serp.QuotaExhausted as exc:
        raise HTTPException(429, str(exc)) from exc


@app.post("/api/console/hunt/maps", dependencies=[Depends(require_console)])
async def console_hunt_maps(body: QueryIn) -> dict[str, Any]:
    try:
        return {"items": await serp.hunt_maps(body.query), "searches_left": await serp.searches_left()}
    except serp.QuotaExhausted as exc:
        raise HTTPException(429, str(exc)) from exc


@app.get("/api/console/metrics", dependencies=[Depends(require_console)])
async def console_metrics() -> dict[str, Any]:
    metrics_path = ROOT_DIR / "ml" / "metrics.json"
    eval_data = json.loads(metrics_path.read_text()) if metrics_path.exists() else None
    with db.session() as s:
        rows = s.exec(select(db.ScanRecord.created_at, db.ScanRecord.verdict)).all()
        reps = s.exec(select(db.Report.created_at)).all()
        blocks = s.exec(select(db.BlockEvent.ts)).all()
    series: dict[str, dict[str, int]] = {}
    for ts, verdict in rows:
        d = series.setdefault(ts.date().isoformat(), {"scans": 0, "scams": 0, "reports": 0, "blocks": 0})
        d["scans"] += 1
        d["scams"] += verdict == "scam"
    for ts in reps:
        series.setdefault(ts.date().isoformat(), {"scans": 0, "scams": 0, "reports": 0, "blocks": 0})["reports"] += 1
    for ts in blocks:
        series.setdefault(ts.date().isoformat(), {"scans": 0, "scams": 0, "reports": 0, "blocks": 0})["blocks"] += 1
    return {"eval": eval_data, "series": [{"date": k, **v} for k, v in sorted(series.items())]}


@app.get("/api/feeds/domains.txt")
async def feed_domains() -> PlainTextResponse:
    return PlainTextResponse("\n".join(sorted(db.active_blocklist())) + "\n")


@app.get("/api/feeds/rpz.zone")
async def feed_rpz() -> PlainTextResponse:
    return PlainTextResponse(takedown.rpz(sorted(db.active_blocklist())), media_type="text/dns")


@app.get("/api/feeds/stix.json")
async def feed_stix() -> Response:
    entries = [{"domain": b.domain, "reason": b.reason, "score": b.score, "brand_id": b.brand_id,
                "created_at": b.created_at.strftime("%Y-%m-%dT%H:%M:%S.000Z")} for b in db.active_blocklist().values()]
    return Response(takedown.stix(entries), media_type="application/stix+json")


if settings.web_dist.exists():
    app.mount("/assets", StaticFiles(directory=str(settings.web_dist / "assets")), name="assets")

    @app.get("/{path:path}", include_in_schema=False)
    async def spa(path: str) -> FileResponse:
        if path.startswith(("api/", "media/", "dns-query")):
            raise HTTPException(404, "not found")
        target = settings.web_dist / path
        if path and target.is_file():
            return FileResponse(target)
        return FileResponse(settings.web_dist / "index.html")
