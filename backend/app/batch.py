"""Batch evaluation of URL lists (CSV), with precision/recall when labels are supplied."""
from __future__ import annotations

import asyncio
import csv
import io
import json
import logging
from typing import Any

from . import db, scans
from .config import get_settings
from .detectors import intel
from .urlutil import normalize

log = logging.getLogger(__name__)

POSITIVE = {"1", "phishing", "phish", "malicious", "scam", "fraud", "bad", "true", "yes", "fake", "spam", "defacement", "malware"}
NEGATIVE = {"0", "legitimate", "legit", "benign", "safe", "good", "false", "no", "clean"}
URL_COLS = ("url", "urls", "link", "domain", "website", "site")
LABEL_COLS = ("label", "class", "type", "is_phishing", "phishing", "status", "result", "target")

_progress: dict[str, dict[str, Any]] = {}


def parse_upload(raw: bytes) -> list[tuple[str, int | None]]:
    text = raw.decode("utf-8-sig", "ignore")
    lines = [ln for ln in text.splitlines() if ln.strip()]
    if not lines:
        return []
    try:
        dialect = csv.Sniffer().sniff(lines[0], delimiters=",;\t")
    except csv.Error:
        dialect = csv.excel
    rows = list(csv.reader(io.StringIO("\n".join(lines)), dialect))
    header = [h.strip().lower() for h in rows[0]]
    url_idx = next((i for i, h in enumerate(header) if h in URL_COLS), None)
    label_idx = next((i for i, h in enumerate(header) if h in LABEL_COLS), None)
    body = rows[1:] if url_idx is not None else rows
    url_idx = url_idx or 0
    out: list[tuple[str, int | None]] = []
    for row in body:
        if len(row) <= url_idx or not row[url_idx].strip():
            continue
        label = None
        if label_idx is not None and len(row) > label_idx:
            v = row[label_idx].strip().lower()
            label = 1 if v in POSITIVE else 0 if v in NEGATIVE else None
        out.append((row[url_idx].strip(), label))
    return out


def metrics(rows: list[dict[str, Any]]) -> dict[str, Any] | None:
    labelled = [r for r in rows if r["label"] is not None]
    if not labelled:
        return None
    tp = sum(1 for r in labelled if r["label"] == 1 and r["predicted"] == 1)
    fp = sum(1 for r in labelled if r["label"] == 0 and r["predicted"] == 1)
    tn = sum(1 for r in labelled if r["label"] == 0 and r["predicted"] == 0)
    fn = sum(1 for r in labelled if r["label"] == 1 and r["predicted"] == 0)
    precision = tp / (tp + fp) if tp + fp else 0.0
    recall = tp / (tp + fn) if tp + fn else 0.0
    f1 = 2 * precision * recall / (precision + recall) if precision + recall else 0.0
    acc = (tp + tn) / len(labelled)
    return {"precision": round(precision, 4), "recall": round(recall, 4), "f1": round(f1, 4), "accuracy": round(acc, 4),
            "tp": tp, "fp": fp, "tn": tn, "fn": fn, "n": len(labelled)}


def _path(job_id: str):
    return get_settings().cache_dir / f"batch_{job_id}.csv"


async def scan_one(url: str, label: int | None, deep: bool, sem: asyncio.Semaphore) -> dict[str, Any]:
    async with sem:
        try:
            r = await scans.run_inline(url, mode="fast", source="batch")
            if r and deep and 30 <= r.score <= 75:
                r = await scans.run_inline(url, mode="deep", source="batch") or r
        except Exception as exc:
            log.info("batch item failed %s: %s", url, exc)
            r = None
    if r is None:
        return {"url": url, "label": label, "verdict": "unknown", "score": 50, "predicted": 0, "reasons": "could not analyse", "scan_id": ""}
    reasons = "; ".join(s.title.en for s in r.signals if (s.weight > 0) == (r.verdict != "safe"))[:300]
    return {"url": url, "label": label, "verdict": r.verdict, "score": r.score, "predicted": 1 if r.verdict == "scam" else 0,
            "reasons": reasons, "scan_id": r.id, "brand": r.brand.id if r.brand else ""}


async def run(job_id: str, items: list[tuple[str, int | None]]) -> None:
    deep = len(items) <= 150
    state = _progress[job_id]
    state["status"] = "running"
    valid: list[tuple[str, int | None]] = []
    for url, label in items:
        try:
            normalize(url)
            valid.append((url, label))
        except ValueError:
            state["rows"].append({"url": url, "label": label, "verdict": "invalid", "score": 0, "predicted": 0, "reasons": "not a URL", "scan_id": ""})
    try:
        await intel.prime_safe_browsing([normalize(u) for u, _ in valid])
    except Exception as exc:
        log.info("safe browsing prime failed: %s", exc)
    sem = asyncio.Semaphore(6 if deep else 24)
    tasks = [asyncio.create_task(scan_one(u, lbl, deep, sem)) for u, lbl in valid]
    for fut in asyncio.as_completed(tasks):
        state["rows"].append(await fut)
        state["done"] = len(state["rows"])
    state["metrics"] = metrics(state["rows"])
    state["status"] = "done"
    with open(_path(job_id), "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=["url", "label", "verdict", "score", "predicted", "brand", "reasons", "scan_id"], extrasaction="ignore")
        w.writeheader()
        w.writerows(state["rows"])
    with db.session() as s:
        job = s.get(db.BatchJob, job_id)
        if job:
            job.status, job.done, job.metrics_json = "done", state["done"], json.dumps(state["metrics"])
            s.add(job)
            s.commit()


def start(raw: bytes) -> str:
    items = parse_upload(raw)[:5000]
    job_id = db.new_id("batch")
    with db.session() as s:
        s.add(db.BatchJob(id=job_id, total=len(items)))
        s.commit()
    _progress[job_id] = {"status": "queued", "done": 0, "total": len(items), "rows": [], "metrics": None}
    asyncio.get_running_loop().create_task(run(job_id, items))
    return job_id


def status(job_id: str) -> dict[str, Any] | None:
    st = _progress.get(job_id)
    if st is None:
        with db.session() as s:
            job = s.get(db.BatchJob, job_id)
        if job is None:
            return None
        return {"status": job.status, "done": job.done, "total": job.total, "metrics": json.loads(job.metrics_json or "null"), "rows_preview": []}
    rows = sorted(st["rows"], key=lambda r: -r["score"])
    return {"status": st["status"], "done": st["done"], "total": st["total"], "metrics": st["metrics"], "rows_preview": rows[:200]}


def results_path(job_id: str):
    p = _path(job_id)
    return p if p.exists() else None
