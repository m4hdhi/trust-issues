"""Trust Issues | أزمة ثقة — API, protective DNS, police console and web app server."""
from __future__ import annotations

import asyncio
import hashlib
import hmac
import json
import logging
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

from . import batch, bus, db, scans
from .community import reports
from .config import ROOT_DIR, get_settings
from .detectors import ai_anthropic, feeds
from .detectors.render import sandbox
from .dns import doh, profile
from .evidence import card, pdf, takedown
from .graph.campaigns import global_graph
from .http import close as close_http
from .hunters import ct, radar, serp, typosquat
from .notify import webpush
from .pipeline import url_model_or_none
from .registry import BRANDS_DIR, get_registry
from .urlutil import find_urls, parse

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")
log = logging.getLogger("trust_issues")
settings = get_settings()


def _protected(registrable: str, hostname: str) -> bool:
    model = url_model_or_none()
    rank = model.tranco_rank(registrable) if model else None
    return get_registry().is_official(registrable, hostname) or bool(rank and rank <= 100_000)


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
    webpush.keys()
    jobs = [asyncio.create_task(_every(3600, lambda: feeds.refresh(_protected)))]
    if settings.enable_hunters:
        jobs += [
            asyncio.create_task(ct.run()),
            asyncio.create_task(_every(6 * 3600, typosquat.sweep_typosquats, initial_delay=120)),
            asyncio.create_task(_every(12 * 3600, typosquat.sweep_nrd, initial_delay=300)),
            asyncio.create_task(_every(6 * 3600, serp.sweep, initial_delay=600)),
        ]
    yield
    for j in jobs:
        j.cancel()
    await sandbox.close()
    await close_http()


app = FastAPI(title="Trust Issues | أزمة ثقة", version="1.0.0", lifespan=lifespan)
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])
app.mount("/media/brands", StaticFiles(directory=str(BRANDS_DIR / "assets"), check_dir=False), name="brands")
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


@app.post("/api/scans")
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
    if is_message and ai_anthropic.available():
        try:
            m = await asyncio.wait_for(ai_anthropic.analyze_message(text), 30)
            message = {"is_scam_text": m["is_scam"], "score": m["score"], "scam_type": m["scam_type"],
                       "brand_id": m.get("impersonated_brand_id"), "reasons": {"en": m["reasons_en"], "ar": m["reasons_ar"]},
                       "urls_found": urls}
        except Exception as exc:
            log.info("message analysis failed: %s", exc)
    if not started and message is None:
        raise HTTPException(422, "no link found in the input")
    return {"scans": started, "message": message}


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


@app.post("/api/reports")
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


@app.get("/api/brands")
async def brands() -> list[dict[str, Any]]:
    return [b.ref().model_dump() for b in get_registry().brands.values()]


@app.post("/api/devices")
async def register_device(body: DeviceIn) -> dict[str, Any]:
    device = db.Device(id=db.new_id("dev"), platform=body.platform, lang=body.lang)
    with db.session() as s:
        s.add(device)
        s.commit()
    return {
        "device_id": device.id,
        "doh_url": profile.doh_url(device.id),
        "ios_profile_url": f"/api/protect/{device.id}/ios.mobileconfig",
        "android_hostname_hint": profile.doh_url(device.id),
    }


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
    await asyncio.to_thread(webpush.send, d, {"title": "🛡️ أزمة ثقة · Trust Issues", "body": "Alerts are on — التنبيهات مفعّلة", "url": "/protect"})
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
    if not hmac.compare_digest(body.password, settings.console_password):
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
    return {"items": await serp.hunt_search(body.query)}


@app.post("/api/console/hunt/maps", dependencies=[Depends(require_console)])
async def console_hunt_maps(body: QueryIn) -> dict[str, Any]:
    return {"items": await serp.hunt_maps(body.query)}


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
