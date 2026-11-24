"""Evaluate the URL / domain models on the held-out time-split test set.

* Picks the decision threshold on the validation split (never on test):
  maximise F1 subject to FPR <= 1 %, and stores it in url_model_meta.json.
* Reports precision, recall, F1, ROC-AUC, FPR and the confusion matrix on the
  test set, per-source breakdowns, a long-tail slice (legit domains outside
  the Tranco top 100k), false positives on UAE official domains, and latency.

Usage (from backend/):  uv run python ../ml/evaluate.py
Writes ml/metrics.json.
"""

from __future__ import annotations

import json
import statistics
import sys
import time
from pathlib import Path

import numpy as np
import pandas as pd
from sklearn.metrics import average_precision_score, confusion_matrix, roc_auc_score, roc_curve

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "backend"))

from app.detectors import url_features as uf  # noqa: E402
from app.detectors.url_model import META_FILE, UrlModel  # noqa: E402

PROCESSED = ROOT / "data" / "processed"
CRAWL_FILE = ROOT / "data" / "raw" / "legit_crawl.csv"
UAE_DOMAINS_FILE = ROOT / "backend" / "app" / "brands" / "uae_official_domains.txt"
METRICS_FILE = ROOT / "ml" / "metrics.json"
MAX_FPR = 0.01

UAE_REFERENCE_URLS = [
    "https://u.ae/en/information-and-services",
    "https://www.tamm.abudhabi/en/life-events",
    "https://www.adpolice.gov.ae/en",
    "https://www.dubaipolice.gov.ae/wps/portal/home/services/individualservicescontent/trafficfines",
    "https://www.rta.ae/wps/portal/rta/ae/home",
    "https://www.salik.ae/en",
    "https://www.dewa.gov.ae/en/consumer/billing/easy-pay",
    "https://www.addc.ae/en/home",
    "https://www.emiratesnbd.com/en/personal-banking",
    "https://www.adcb.com/en/personal/",
    "https://www.bankfab.com/en-ae/personal",
    "https://www.mashreq.com/en/uae/neo/",
    "https://www.adib.ae/en/personal",
    "https://www.dib.ae/personal",
    "https://www.centralbank.ae/en/",
    "https://www.etisalat.ae/en/index.html",
    "https://www.du.ae/personal",
    "https://www.emiratespost.ae/",
    "https://uaepass.ae/",
    "https://icp.gov.ae/en/",
    "https://www.moi.gov.ae/en/default.aspx",
    "https://www.mohre.gov.ae/en/home.aspx",
    "https://www.aramex.com/ae/en",
    "https://www.etihad.com/en-ae/",
    "https://www.emirates.com/ae/english/",
    "https://www.careem.com/en-AE/",
    "https://www.noon.com/uae-en/",
    "https://smiles.etisalat.ae/",
    "https://www.mawaqif.ae/",
    "https://darb.itc.gov.ae/",
]

ILLUSTRATIVE_LURES = [
    "tamm-fines.com",
    "https://rta-ae-pay.top/fines/pay",
    "salik-uae-toll.info/pay?ref=8812",
    "https://dubaipolice-gov.com/traffic-fine/login",
    "http://emiratesnbd-secure-update.xyz/verify",
    "https://uaepass-login.online/auth",
    "aramex-redelivery.cc/track?id=AE99812",
    "https://emiratespost-parcel.shop/customs-fee",
]


def pick_threshold(y: np.ndarray, s: np.ndarray, max_fpr: float = MAX_FPR) -> float:
    """Threshold maximising F1 among thresholds whose FPR <= max_fpr."""
    order = np.argsort(-s)
    s_sorted, y_sorted = s[order], y[order]
    tp = np.cumsum(y_sorted)
    fp = np.cumsum(1 - y_sorted)
    pos, neg = y.sum(), (1 - y).sum()
    distinct = np.r_[s_sorted[1:] != s_sorted[:-1], True]
    tp, fp, thr = tp[distinct], fp[distinct], s_sorted[distinct]
    fpr = fp / max(neg, 1)
    precision = tp / np.maximum(tp + fp, 1)
    recall = tp / max(pos, 1)
    f1 = 2 * precision * recall / np.maximum(precision + recall, 1e-12)
    f1[fpr > max_fpr] = -1
    return float(thr[int(np.argmax(f1))])


def binary_metrics(y: np.ndarray, s: np.ndarray, thr: float) -> dict:
    pred = (s >= thr).astype(int)
    tn, fp, fn, tp = confusion_matrix(y, pred, labels=[0, 1]).ravel()
    precision = tp / max(tp + fp, 1)
    recall = tp / max(tp + fn, 1)
    out = {
        "n": int(len(y)),
        "n_phishing": int(y.sum()),
        "n_legit": int((1 - y).sum()),
        "threshold": round(thr, 4),
        "precision": round(float(precision), 4),
        "recall": round(float(recall), 4),
        "f1": round(float(2 * precision * recall / max(precision + recall, 1e-12)), 4),
        "fpr": round(float(fp / max(fp + tn, 1)), 4),
        "confusion_matrix": {"tn": int(tn), "fp": int(fp), "fn": int(fn), "tp": int(tp)},
    }
    if 0 < y.sum() < len(y):
        out["roc_auc"] = round(float(roc_auc_score(y, s)), 4)
        out["pr_auc"] = round(float(average_precision_score(y, s)), 4)
    return out


def recall_at_fpr(y: np.ndarray, s: np.ndarray, target: float) -> float:
    fpr, tpr, _ = roc_curve(y, s)
    return round(float(tpr[fpr <= target].max()), 4)


def main() -> None:
    t0 = time.perf_counter()
    model = UrlModel.load()
    load_s = time.perf_counter() - t0

    val = pd.read_csv(PROCESSED / "validation_scores.csv.gz", keep_default_na=False)
    v_url = val[val["kind"] == "url"]
    v_dom = val[val["kind"] == "domain"]
    thr = pick_threshold(v_url["label"].to_numpy(), v_url["score"].to_numpy())
    dthr = pick_threshold(v_dom["label"].to_numpy(), v_dom["score"].to_numpy())

    meta_path = uf.MODELS_DIR / META_FILE
    meta = json.loads(meta_path.read_text())
    meta["threshold"], meta["domain_threshold"] = round(thr, 4), round(dthr, 4)
    meta_path.write_text(json.dumps(meta, indent=1))
    model.threshold, model.domain_threshold = thr, dthr

    test = pd.read_csv(PROCESSED / "test.csv.gz", keep_default_na=False)
    urls = test["url"].tolist()
    scores = np.concatenate([model.score_urls(urls[i : i + 4096]) for i in range(0, len(urls), 4096)])
    test["score"] = scores
    y, s = test["label"].to_numpy(), test["score"].to_numpy()

    result: dict = {
        "generated": time.strftime("%Y-%m-%dT%H:%M:%S"),
        "split": json.loads((PROCESSED / "summary.json").read_text()),
        "threshold_selection": "max F1 on the validation split subject to FPR <= 1%; test set never used for tuning",
        "validation": binary_metrics(v_url["label"].to_numpy(), v_url["score"].to_numpy(), thr),
        "test": binary_metrics(y, s, thr),
    }
    result["test"]["recall_at_fpr_0.1pct"] = recall_at_fpr(y, s, 0.001)
    result["test"]["recall_at_fpr_1pct"] = recall_at_fpr(y, s, 0.01)
    result["test_threshold_0.5"] = binary_metrics(y, s, 0.5)

    by_source = {}
    for src, g in test.groupby("source"):
        pred = g["score"] >= thr
        key = "recall" if g["label"].iloc[0] == 1 else "fpr"
        by_source[src] = {"n": int(len(g)), key: round(float(pred.mean()), 4)}
    result["test_by_source"] = by_source

    ranked = test["domain"].map(lambda d: model.tranco_rank(d) is not None)
    tail = test[(test["label"] == 1) | ~ranked]
    result["test_long_tail"] = {
        "description": "legit URLs restricted to domains outside the Tranco top 100k (reputation feature cannot help)",
        **binary_metrics(tail["label"].to_numpy(), tail["score"].to_numpy(), thr),
    }

    hosts = test.assign(host=[uf.parse(u).host for u in urls]).drop_duplicates("host")
    hosts = hosts[hosts["host"] != ""]
    hscores = np.array([model.score_domain(h) for h in hosts["host"]])
    result["test_domain_model"] = binary_metrics(hosts["label"].to_numpy(), hscores, dthr)

    result["uae_official"] = uae_check(model)
    result["illustrative_uae_lures"] = {
        "note": "hand-written examples for demonstration only; not part of any metric",
        "scores": {u: round(model.score_url(u), 4) for u in ILLUSTRATIVE_LURES},
    }
    result["latency"] = latency(model, urls[:2000], load_s)
    result["artifacts_mb"] = {
        p.name: round(p.stat().st_size / 1e6, 2) for p in sorted(uf.MODELS_DIR.iterdir()) if p.is_file()
    }
    result["artifacts_total_mb"] = round(sum(result["artifacts_mb"].values()), 2)

    fp_examples = test[(test["label"] == 0) & (test["score"] >= thr)].nlargest(15, "score")
    fn_examples = test[(test["label"] == 1) & (test["score"] < thr)].nsmallest(15, "score")
    result["error_examples"] = {
        "false_positives": [[u, round(v, 3)] for u, v in zip(fp_examples["url"], fp_examples["score"])],
        "false_negatives": [[u, round(v, 3)] for u, v in zip(fn_examples["url"], fn_examples["score"])],
    }
    METRICS_FILE.write_text(json.dumps(result, indent=2, ensure_ascii=False))
    summarize(result)


def uae_check(model: UrlModel) -> dict:
    domains: list[str] = []
    if UAE_DOMAINS_FILE.exists():
        for line in UAE_DOMAINS_FILE.read_text().splitlines():
            line = line.strip().lower()
            if line and not line.startswith("#"):
                domains.append(line.split()[0])
    urls = [f"https://{d}/" for d in domains] + UAE_REFERENCE_URLS
    if domains and CRAWL_FILE.exists():
        crawl = pd.read_csv(CRAWL_FILE).dropna()
        deep = crawl[crawl["source"].isin(set(domains)) & crawl["url"].str.count("/").gt(3)]
        urls += deep.groupby("source").head(3)["url"].tolist()
    urls = list(dict.fromkeys(urls))
    scores = model.score_urls(urls)
    flagged = [[u, round(s, 4)] for u, s in zip(urls, scores) if s >= model.threshold]
    host_scores = {d: model.score_domain(d) for d in domains}
    return {
        "official_domains_file_present": UAE_DOMAINS_FILE.exists(),
        "n_domains": len(domains),
        "n_urls_checked": len(urls),
        "false_positives": len(flagged),
        "flagged": flagged,
        "domain_model_false_positives": sum(v >= model.domain_threshold for v in host_scores.values()),
        "max_score": round(max(scores), 4) if scores else None,
    }


def latency(model: UrlModel, urls: list[str], load_s: float) -> dict:
    for u in urls[:50]:
        model.score_url(u)
    single = []
    for u in urls[:1000]:
        t = time.perf_counter()
        model.score_url(u)
        single.append((time.perf_counter() - t) * 1e3)
    dom = []
    for u in urls[:1000]:
        host = uf.parse(u).host
        t = time.perf_counter()
        model.score_domain(host)
        dom.append((time.perf_counter() - t) * 1e3)
    expl = []
    for u in urls[:200]:
        t = time.perf_counter()
        model.explain(u)
        expl.append((time.perf_counter() - t) * 1e3)
    t = time.perf_counter()
    model.score_urls(urls)
    batch = (time.perf_counter() - t) * 1e3 / max(len(urls), 1)
    p99 = lambda xs: round(float(np.percentile(xs, 99)), 3)  # noqa: E731
    return {
        "load_s": round(load_s, 3),
        "score_url_ms_mean": round(statistics.mean(single), 3),
        "score_url_ms_p99": p99(single),
        "score_urls_batch_ms_per_url": round(batch, 4),
        "score_domain_ms_mean": round(statistics.mean(dom), 3),
        "score_domain_ms_p99": p99(dom),
        "explain_ms_mean": round(statistics.mean(expl), 3),
    }


def summarize(r: dict) -> None:
    t = r["test"]
    print(f"threshold={t['threshold']}  (validation FPR={r['validation']['fpr']})")
    print(
        f"TEST  n={t['n']} P={t['precision']} R={t['recall']} F1={t['f1']} "
        f"AUC={t.get('roc_auc')} FPR={t['fpr']} CM={t['confusion_matrix']}"
    )
    lt = r["test_long_tail"]
    print(f"LONG-TAIL  P={lt['precision']} R={lt['recall']} F1={lt['f1']} FPR={lt['fpr']}")
    d = r["test_domain_model"]
    print(f"DOMAIN  n={d['n']} P={d['precision']} R={d['recall']} F1={d['f1']} AUC={d.get('roc_auc')} FPR={d['fpr']}")
    print("by source:", json.dumps(r["test_by_source"]))
    u = r["uae_official"]
    print(f"UAE official: {u['false_positives']} FP / {u['n_urls_checked']} URLs; domain-model FP {u['domain_model_false_positives']}")
    print("latency:", json.dumps(r["latency"]))
    print(f"artifacts: {r['artifacts_total_mb']} MB")


if __name__ == "__main__":
    main()
