"""Train the URL-only and domain-only phishing models for Trust Issues.

Inputs  : data/processed/train.csv.gz (from build_dataset.py), Tranco top-1M list
Outputs : backend/app/models/{url_lgbm.txt, url_ngram.npz, domain_lgbm.txt,
          tld_risk.json, tranco_top.txt.gz, url_model_meta.json}
          data/processed/validation_scores.csv.gz (used by evaluate.py to pick the threshold)

Usage (from backend/):  uv run python ../ml/train_url_model.py
"""

from __future__ import annotations

import gzip
import json
import sys
import time
from pathlib import Path

import lightgbm as lgb
import numpy as np
import pandas as pd
from sklearn.feature_extraction.text import HashingVectorizer, TfidfTransformer
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import roc_auc_score
from sklearn.model_selection import GroupKFold, GroupShuffleSplit

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "backend"))

from app.detectors import url_features as uf  # noqa: E402

PROCESSED = ROOT / "data" / "processed"
TRANCO_CSV = ROOT / "data" / "raw" / "tranco" / "top-1m.csv"
MODELS = ROOT / "backend" / "app" / "models"

SEED = 42
TRANCO_KEEP = 100_000
TLD_SMOOTHING = 30.0
NGRAM_FEATURES = 2**20
NGRAM_RANGE = (3, 5)
DOMAIN_NEGATIVE_TRANCO = 100_000
SOURCE_WEIGHTS = {"crawl": 2.0, "crawl_external": 2.0, "curated_lists": 2.0, "commoncrawl": 2.0, "uae_official": 3.0}


def write_tranco() -> dict[str, int]:
    """Store the top Tranco site domains in rank order (compact gzip text)."""
    df = pd.read_csv(TRANCO_CSV, header=None, names=["rank", "domain"], nrows=TRANCO_KEEP * 2)
    seen: dict[str, int] = {}
    for dom in df["domain"].str.lower():
        site = uf.split_host(uf.normalize_host(dom))[1]
        if site and site not in seen:
            seen[site] = len(seen) + 1
        if len(seen) >= TRANCO_KEEP:
            break
    with gzip.open(MODELS / uf.TRANCO_FILE, "wt", compresslevel=9) as fh:
        fh.write("\n".join(seen.keys()) + "\n")
    return seen


def tld_table(tlds: pd.Series, labels: pd.Series, prior: float) -> dict[str, float]:
    stats = pd.DataFrame({"tld": tlds, "y": labels}).groupby("tld")["y"].agg(["sum", "count"])
    risk = (stats["sum"] + TLD_SMOOTHING * prior) / (stats["count"] + TLD_SMOOTHING)
    return {k: round(float(v), 5) for k, v in risk.items()}


def featurize(urls: list[str], ctx: uf.FeatureContext, host_only: bool = False) -> np.ndarray:
    fn = uf.extract_host if host_only else uf.extract
    names = uf.HOST_FEATURE_NAMES if host_only else uf.URL_FEATURE_NAMES
    out = np.empty((len(urls), len(names)), dtype=np.float32)
    for i, u in enumerate(urls):
        f = fn(u, ctx)
        out[i] = [f[n] for n in names]
    return out


def featurize_oof_tld(df: pd.DataFrame, ctx: uf.FeatureContext, prior: float, host_only: bool = False) -> np.ndarray:
    """Features with out-of-fold TLD risk so the target encoding does not leak labels."""
    names = uf.HOST_FEATURE_NAMES if host_only else uf.URL_FEATURE_NAMES
    col = names.index("tld_risk")
    X = featurize(df["url"].tolist(), ctx, host_only)
    for tr, te in GroupKFold(n_splits=5).split(df, groups=df["domain"]):
        table = tld_table(df["tld"].iloc[tr], df["label"].iloc[tr], prior)
        X[te, col] = [table.get(t, prior) for t in df["tld"].iloc[te]]
    return X


LGB_PARAMS = {
    "objective": "binary",
    "learning_rate": 0.05,
    "num_leaves": 63,
    "min_data_in_leaf": 40,
    "feature_fraction": 0.8,
    "bagging_fraction": 0.8,
    "bagging_freq": 1,
    "lambda_l2": 1.0,
    "verbose": -1,
    "seed": SEED,
    "num_threads": 8,
}


def class_balanced(y: np.ndarray, base: np.ndarray) -> np.ndarray:
    """Scale positive weights so both classes carry the same total weight."""
    pos_w = base[y == 0].sum() / max(base[y == 1].sum(), 1e-9)
    return np.where(y == 1, base * pos_w, base)


def source_weights(sources: pd.Series) -> np.ndarray:
    return sources.map(SOURCE_WEIGHTS).fillna(1.0).to_numpy()


def train_lgb(
    X: np.ndarray, y: np.ndarray, groups: pd.Series, names: list[str], rounds: int, params: dict, base: np.ndarray
) -> lgb.Booster:
    inner = GroupShuffleSplit(n_splits=1, test_size=0.1, random_state=SEED)
    tr, es = next(inner.split(X, y, groups))
    w = class_balanced(y, base)
    dtr = lgb.Dataset(X[tr], y[tr], weight=w[tr], feature_name=names, free_raw_data=False)
    des = lgb.Dataset(X[es], y[es], weight=w[es], reference=dtr)
    booster = lgb.train(
        params,
        dtr,
        num_boost_round=rounds,
        valid_sets=[des],
        callbacks=[lgb.early_stopping(50, verbose=False), lgb.log_evaluation(0)],
    )
    return booster


def make_vectorizer() -> HashingVectorizer:
    return HashingVectorizer(
        analyzer="char",
        ngram_range=NGRAM_RANGE,
        n_features=NGRAM_FEATURES,
        alternate_sign=False,
        lowercase=False,
        norm=None,
        dtype=np.float32,
    )


def logit(p: np.ndarray) -> np.ndarray:
    p = np.clip(p, 1e-6, 1 - 1e-6)
    return np.log(p / (1 - p))


def main() -> None:
    t0 = time.time()
    MODELS.mkdir(parents=True, exist_ok=True)
    df = pd.read_csv(PROCESSED / "train.csv.gz", keep_default_na=False)
    print(f"train rows: {len(df)}  phishing share: {df['label'].mean():.3f}")

    ranks = write_tranco()
    ctx = uf.FeatureContext(ranks=ranks)
    df["tld"] = [uf.tld_of(uf.parse(u)) for u in df["url"]]

    split = GroupShuffleSplit(n_splits=1, test_size=0.15, random_state=SEED)
    fit_idx, val_idx = next(split.split(df, df["label"], df["domain"]))
    fit, val = df.iloc[fit_idx].reset_index(drop=True), df.iloc[val_idx].reset_index(drop=True)
    prior = float(fit["label"].mean())
    ctx.tld_risk = tld_table(fit["tld"], fit["label"], prior)
    ctx.tld_prior = prior
    (MODELS / uf.TLD_RISK_FILE).write_text(json.dumps({"prior": round(prior, 5), "risk": ctx.tld_risk}))

    print("featurising ...")
    X_fit = featurize_oof_tld(fit, ctx, prior)
    X_val = featurize(val["url"].tolist(), ctx)
    y_fit, y_val = fit["label"].to_numpy(), val["label"].to_numpy()
    print(f"  done in {time.time() - t0:.0f}s")

    print("training LightGBM (lexical) ...")
    w_fit = source_weights(fit["source"])
    booster = train_lgb(X_fit, y_fit, fit["domain"], uf.URL_FEATURE_NAMES, 1500, LGB_PARAMS, w_fit)
    p_lgb_val = booster.predict(X_val)
    print(f"  trees={booster.num_trees()}  val AUC={roc_auc_score(y_val, p_lgb_val):.4f}")

    print("training char n-gram logistic regression ...")
    vec = make_vectorizer()
    tfidf = TfidfTransformer(sublinear_tf=True)
    T_fit = tfidf.fit_transform(vec.transform([uf.ngram_text(u) for u in fit["url"]]))
    T_val = tfidf.transform(vec.transform([uf.ngram_text(u) for u in val["url"]]))
    lr = LogisticRegression(C=4.0, solver="liblinear", max_iter=200)
    lr.fit(T_fit, y_fit, sample_weight=class_balanced(y_fit, w_fit))
    p_lr_val = lr.predict_proba(T_val)[:, 1]
    print(f"  val AUC={roc_auc_score(y_val, p_lr_val):.4f}")

    stack_X = np.column_stack([logit(p_lgb_val), logit(p_lr_val)])
    stacker = LogisticRegression(C=1.0).fit(stack_X, y_val)
    p_val = stacker.predict_proba(stack_X)[:, 1]
    print(f"  stacked val AUC={roc_auc_score(y_val, p_val):.4f}  weights={stacker.coef_[0].round(3)}")

    booster.save_model(str(MODELS / "url_lgbm.txt"))
    np.savez_compressed(
        MODELS / "url_ngram.npz",
        coef=lr.coef_[0].astype(np.float32),
        intercept=np.float32(lr.intercept_[0]),
        idf=tfidf.idf_.astype(np.float32),
    )

    print("training domain-only model ...")
    dom = build_domain_frame(df, ranks)
    dom_fit_idx, dom_val_idx = next(split.split(dom, dom["label"], dom["domain"]))
    dfit, dval = dom.iloc[dom_fit_idx].reset_index(drop=True), dom.iloc[dom_val_idx].reset_index(drop=True)
    Xd_fit = featurize_oof_tld(dfit, ctx, prior, host_only=True)
    Xd_val = featurize(dval["url"].tolist(), ctx, host_only=True)
    dparams = dict(LGB_PARAMS, num_leaves=31)
    dbooster = train_lgb(
        Xd_fit, dfit["label"].to_numpy(), dfit["domain"], uf.HOST_FEATURE_NAMES, 600, dparams, np.ones(len(dfit))
    )
    pd_val = dbooster.predict(Xd_val)
    dcal = LogisticRegression(C=1.0).fit(logit(pd_val).reshape(-1, 1), dval["label"])
    print(f"  hosts={len(dom)} trees={dbooster.num_trees()} val AUC={roc_auc_score(dval['label'], pd_val):.4f}")
    dbooster.save_model(str(MODELS / "domain_lgbm.txt"))

    meta = {
        "version": time.strftime("%Y-%m-%d"),
        "url_features": uf.URL_FEATURE_NAMES,
        "host_features": uf.HOST_FEATURE_NAMES,
        "ngram": {"n_features": NGRAM_FEATURES, "ngram_range": list(NGRAM_RANGE), "max_chars": 300},
        "stacker": {"coef": stacker.coef_[0].tolist(), "intercept": float(stacker.intercept_[0])},
        "domain_calibration": {"coef": float(dcal.coef_[0][0]), "intercept": float(dcal.intercept_[0])},
        "threshold": 0.5,
        "domain_threshold": 0.5,
        "train_rows": int(len(df)),
        "train_phishing_share": round(float(df["label"].mean()), 4),
    }
    meta_path = MODELS / "url_model_meta.json"
    if meta_path.exists():
        old = json.loads(meta_path.read_text())
        meta["threshold"] = old.get("threshold", 0.5)
        meta["domain_threshold"] = old.get("domain_threshold", 0.5)
    meta_path.write_text(json.dumps(meta, indent=1))

    dcal_val = dcal.predict_proba(logit(pd_val).reshape(-1, 1))[:, 1]
    pd.DataFrame({"kind": "url", "label": y_val, "score": p_val, "url": val["url"]}).pipe(
        lambda a: pd.concat(
            [a, pd.DataFrame({"kind": "domain", "label": dval["label"], "score": dcal_val, "url": dval["url"]})]
        )
    ).to_csv(PROCESSED / "validation_scores.csv.gz", index=False)

    sizes = {p.name: round(p.stat().st_size / 1e6, 2) for p in MODELS.iterdir() if p.is_file()}
    print(f"artifacts (MB): {sizes}  total={sum(sizes.values()):.2f}")
    print(f"finished in {time.time() - t0:.0f}s")


def build_domain_frame(df: pd.DataFrame, ranks: dict[str, int]) -> pd.DataFrame:
    """Hostname-level dataset: phishing hosts vs. legitimate hosts and Tranco domains."""
    hosts = pd.DataFrame(
        {"url": [uf.parse(u).host for u in df["url"]], "label": df["label"].to_numpy(), "domain": df["domain"]}
    )
    hosts = hosts[hosts["url"] != ""]
    legit_hosts = set(hosts.loc[hosts["label"] == 0, "url"])
    top = {d for d, r in ranks.items() if r <= 10_000}
    positives = hosts[(hosts["label"] == 1) & ~hosts["url"].isin(legit_hosts)]
    positives = positives[~(positives["domain"].isin(top) & (positives["url"] == positives["domain"]))]
    negatives = hosts[hosts["label"] == 0]
    tranco = pd.DataFrame({"url": list(ranks)[:DOMAIN_NEGATIVE_TRANCO], "label": 0})
    tranco["domain"] = tranco["url"]
    test_domains = set(pd.read_csv(PROCESSED / "test.csv.gz", usecols=["domain"])["domain"])
    tranco = tranco[~tranco["domain"].isin(test_domains)]
    out = pd.concat([positives, negatives, tranco]).drop_duplicates("url").reset_index(drop=True)
    out["tld"] = [uf.tld_of(uf.parse(h)) for h in out["url"]]
    return out


if __name__ == "__main__":
    main()
