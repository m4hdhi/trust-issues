"""Runtime scoring for the URL-only and domain-only phishing models.

Artifacts are produced by ``ml/train_url_model.py`` and live in
``backend/app/models``:

* ``url_lgbm.txt``        LightGBM on lexical / host / reputation features
* ``url_ngram.npz``       character n-gram TF-IDF logistic regression (hashed)
* ``domain_lgbm.txt``     LightGBM on hostname-only features (DNS fast path)
* ``url_model_meta.json`` feature order, stacking + calibration weights, threshold
* ``tld_risk.json`` / ``tranco_top.txt.gz`` feature context
"""

from __future__ import annotations

import json
from functools import lru_cache
from pathlib import Path

import lightgbm as lgb
import numpy as np
from sklearn.feature_extraction.text import HashingVectorizer

from app.detectors import url_features as uf

META_FILE = "url_model_meta.json"


def _sigmoid(x: np.ndarray | float) -> np.ndarray | float:
    return 1.0 / (1.0 + np.exp(-x))


def _logit(p: np.ndarray) -> np.ndarray:
    p = np.clip(p, 1e-6, 1 - 1e-6)
    return np.log(p / (1 - p))


class UrlModel:
    """Calibrated phishing probability for URLs and bare hostnames."""

    def __init__(
        self,
        url_booster: lgb.Booster,
        domain_booster: lgb.Booster,
        ngram: dict[str, np.ndarray],
        meta: dict,
        ctx: uf.FeatureContext,
    ) -> None:
        self._url_booster = url_booster
        self._domain_booster = domain_booster
        self._coef = ngram["coef"]
        self._intercept = float(ngram["intercept"])
        self._idf = ngram["idf"]
        self._meta = meta
        self._ctx = ctx
        self._url_names: list[str] = meta["url_features"]
        self._host_names: list[str] = meta["host_features"]
        cfg = meta["ngram"]
        self._max_chars = int(cfg["max_chars"])
        self._vec = HashingVectorizer(
            analyzer="char",
            ngram_range=tuple(cfg["ngram_range"]),
            n_features=int(cfg["n_features"]),
            alternate_sign=False,
            lowercase=False,
            norm=None,
            dtype=np.float32,
        )
        self._stack_w = np.asarray(meta["stacker"]["coef"], dtype=np.float64)
        self._stack_b = float(meta["stacker"]["intercept"])
        self._dom_a = float(meta["domain_calibration"]["coef"])
        self._dom_b = float(meta["domain_calibration"]["intercept"])
        self.threshold: float = float(meta.get("threshold", 0.5))
        self.domain_threshold: float = float(meta.get("domain_threshold", 0.5))
        self.version: str = str(meta.get("version", ""))

    @classmethod
    def load(cls, models_dir: str | None = None) -> "UrlModel":
        base = Path(models_dir) if models_dir else uf.MODELS_DIR
        meta = json.loads((base / META_FILE).read_text())
        url_booster = lgb.Booster(model_file=str(base / "url_lgbm.txt"))
        domain_booster = lgb.Booster(model_file=str(base / "domain_lgbm.txt"))
        with np.load(base / "url_ngram.npz") as npz:
            ngram = {k: npz[k] for k in npz.files}
        ctx = uf.FeatureContext.load(base)
        return cls(url_booster, domain_booster, ngram, meta, ctx)

    def _url_matrix(self, urls: list[str]) -> np.ndarray:
        out = np.empty((len(urls), len(self._url_names)), dtype=np.float64)
        for i, url in enumerate(urls):
            feats = uf.extract(url, self._ctx)
            out[i] = [feats[n] for n in self._url_names]
        return out

    def _ngram_scores(self, urls: list[str]) -> np.ndarray:
        texts = [uf.ngram_text(u)[: self._max_chars] for u in urls]
        X = self._vec.transform(texts).tocsr()
        X.data = (1.0 + np.log(X.data)) * self._idf[X.indices]
        sq = np.asarray(X.multiply(X).sum(axis=1)).ravel()
        norms = np.sqrt(np.maximum(sq, 1e-12))
        raw = np.asarray(X @ self._coef).ravel() / norms
        return _sigmoid(raw + self._intercept)

    def score_urls(self, urls: list[str]) -> list[float]:
        """Calibrated P(malicious) for each URL (vectorised)."""
        if not urls:
            return []
        clean = [u if isinstance(u, str) else str(u or "") for u in urls]
        threads = 1 if len(clean) < 64 else 0
        p_lgb = self._url_booster.predict(self._url_matrix(clean), num_threads=threads)
        p_ngram = self._ngram_scores(clean)
        z = self._stack_w[0] * _logit(p_lgb) + self._stack_w[1] * _logit(p_ngram) + self._stack_b
        scores = _sigmoid(z)
        return [float(s) if uf.is_valid_host(uf.parse(u).host) else 0.0 for u, s in zip(clean, scores)]

    def score_url(self, url: str) -> float:
        """Calibrated P(malicious) for one URL; accepts scheme-less or malformed input."""
        try:
            return self.score_urls([url])[0]
        except Exception:
            return 0.0

    def score_domain(self, hostname: str) -> float:
        """Calibrated P(malicious) from the hostname alone (DNS fast path)."""
        try:
            host = uf.normalize_host(hostname)
            if not uf.is_valid_host(host):
                return 0.0
            feats = uf.extract_host(host, self._ctx)
            row = np.asarray([[feats[n] for n in self._host_names]], dtype=np.float64)
            raw = float(self._domain_booster.predict(row, raw_score=True, num_threads=1)[0])
            return float(_sigmoid(self._dom_a * raw + self._dom_b))
        except Exception:
            return 0.0

    def is_malicious(self, url: str) -> bool:
        return self.score_url(url) >= self.threshold

    def tranco_rank(self, registrable_domain: str) -> int | None:
        """Tranco rank (top 100k only) of a domain's site / registrable domain."""
        host = uf.normalize_host(registrable_domain)
        if not host:
            return None
        return self._ctx.rank(uf.split_host(host)[1])

    def explain(self, url: str, top_k: int = 5) -> list[dict]:
        """Top reasons pushing the URL towards 'malicious', with English and Arabic text."""
        try:
            feats = uf.extract(url, self._ctx)
            row = np.asarray([[feats[n] for n in self._url_names]], dtype=np.float64)
            contrib = self._url_booster.predict(row, pred_contrib=True, num_threads=1)[0][:-1]
            parsed = uf.parse(url)
        except Exception:
            return []
        groups: dict[str, dict] = {}
        for name, value, c in zip(self._url_names, row[0], contrib):
            if c <= 0:
                continue
            key = _REASON_GROUP.get(name, name)
            g = groups.setdefault(key, {"feature": name, "value": float(value), "contribution": 0.0, "best": 0.0})
            g["contribution"] += float(c)
            if c > g["best"]:
                g.update(feature=name, value=float(value), best=float(c))
        ranked = sorted(groups.items(), key=lambda kv: kv[1]["contribution"], reverse=True)
        out = []
        for key, g in ranked:
            text = _reason(key, g["feature"], feats, parsed, self._ctx)
            if text is None:
                continue
            out.append(
                {
                    "feature": g["feature"],
                    "value": round(g["value"], 4),
                    "contribution": round(g["contribution"], 4),
                    "reason_en": text[0],
                    "reason_ar": text[1],
                }
            )
            if len(out) >= top_k:
                break
        return out


_REASON_GROUP: dict[str, str] = {}
for _group, _names in {
    "rank": ("rank_log", "rank_top1k", "rank_top10k", "rank_top100k"),
    "hosting": ("is_free_hosting", "is_private_suffix", "platform_rank_log"),
    "idn": ("punycode", "non_ascii_host", "confusable"),
    "hyphens": ("host_hyphens", "sld_hyphens"),
    "digits": ("host_digits", "host_digit_ratio", "sld_digits", "sld_max_digit_run"),
    "depth": ("sub_depth", "n_labels", "host_dots", "sub_len", "sub_is_www_like"),
    "length": ("host_len", "sld_len", "max_label_len"),
    "random": ("host_entropy", "sld_entropy", "sld_consonant_run", "sld_vowel_ratio"),
    "path": (
        "url_len",
        "path_len",
        "query_len",
        "fragment_len",
        "n_segments",
        "max_segment_len",
        "url_digits",
        "url_digit_ratio",
        "url_hyphens",
        "url_dots",
        "url_special",
        "url_slashes",
        "path_entropy",
        "hex_run",
        "n_tokens",
        "max_token_len",
        "tilde",
    ),
    "keywords": ("kw_host", "kw_path"),
    "uae_lure": ("uae_lure_host", "uae_lure_path"),
    "brands": ("n_brands_host", "n_brands_total"),
    "extension": ("ext_risk", "ext_php", "ext_html"),
    "tld_shape": ("tld_len", "tld_is_cc"),
}.items():
    for _n in _names:
        _REASON_GROUP[_n] = _group


def _foreign_brands(parsed: uf.ParsedUrl) -> list[str]:
    text = parsed.host + "/" + parsed.path + "?" + parsed.query
    leet = text.translate(uf.LEET)
    found = uf.find_brands(text, uf.tokens_of(text)) | uf.find_brands(leet, uf.tokens_of(leet))
    return sorted((b for b in found if not uf.is_official_brand(b, parsed.sld)), key=len, reverse=True)


def _keywords(parsed: uf.ParsedUrl, words: tuple[str, ...]) -> str:
    tokens = uf.tokens_of(parsed.host + "/" + parsed.path + "?" + parsed.query)
    hits = [w for w in words if w in tokens]
    return ", ".join(dict.fromkeys(hits[:4]))


def _reason(
    key: str, feature: str, f: dict[str, float], p: uf.ParsedUrl, ctx: uf.FeatureContext
) -> tuple[str, str] | None:
    tld = uf.tld_of(p)
    brands = _foreign_brands(p)
    brand = brands[0] if brands else ""
    if key == "tld_risk":
        if f["tld_risk"] >= 0.6:
            return (f"Domain uses a high-risk TLD (.{tld})", f"النطاق يستخدم امتدادًا عالي الخطورة (.{tld})")
        return (
            f"Domain extension .{tld} is often abused by scammers",
            f"امتداد النطاق ‎.{tld} يُستغل كثيرًا من قبل المحتالين",
        )
    if key == "rank":
        rank = ctx.rank(p.site_domain)
        if rank:
            return (
                f"Site has limited popularity (Tranco rank {rank:,})",
                f"شعبية الموقع محدودة (الترتيب {rank:,} في قائمة ترانكو)",
            )
        return (
            "Domain is not among the 100,000 most-visited websites",
            "النطاق ليس ضمن أكثر 100,000 موقع زيارةً على الإنترنت",
        )
    if key == "brand_in_sub":
        return (
            f"Brand name '{brand}' appears in the subdomain, but the site does not belong to that brand",
            f"اسم العلامة التجارية '{brand}' يظهر في النطاق الفرعي، لكن الموقع لا يتبع لهذه العلامة",
        )
    if key == "brand_sld_partial":
        return (
            f"Domain '{p.site_domain}' combines the brand name '{brand}' with extra words",
            f"النطاق '{p.site_domain}' يدمج اسم العلامة التجارية '{brand}' مع كلمات إضافية",
        )
    if key == "brand_leet":
        return (
            f"Domain imitates '{brand}' using look-alike characters (e.g. 0 for o, 1 for l)",
            f"النطاق يقلّد '{brand}' باستخدام أحرف مشابهة (مثل 0 بدل o و 1 بدل l)",
        )
    if key == "brand_uae_host":
        return (
            f"Domain impersonates a UAE entity ('{brand}') but is not its official website",
            f"النطاق ينتحل صفة جهة إماراتية ('{brand}') وهو ليس موقعها الرسمي",
        )
    if key == "brand_in_path":
        return (
            f"Brand name '{brand}' appears in the link path on an unrelated website",
            f"اسم العلامة التجارية '{brand}' يظهر في مسار الرابط على موقع لا علاقة له بها",
        )
    if key == "brands":
        if not brand:
            return None
        return (f"Link mentions the brand '{brand}'", f"الرابط يذكر العلامة التجارية '{brand}'")
    if key == "idn":
        return (
            "Domain uses internationalised or look-alike (homoglyph) characters",
            "النطاق يستخدم أحرفًا دولية أو متشابهة الشكل (homoglyph) قد تخدع المستخدم",
        )
    if key == "is_ip":
        return (
            "Link points to a raw IP address instead of a domain name",
            "الرابط يشير إلى عنوان IP مباشر بدلاً من اسم نطاق",
        )
    if key == "keywords":
        words = _keywords(p, uf.SUSPICIOUS_WORDS)
        suffix = f" ({words})" if words else ""
        return (
            f"Link contains words common in phishing{suffix}",
            f"الرابط يحتوي على كلمات شائعة في روابط التصيّد{suffix}",
        )
    if key == "uae_lure":
        words = _keywords(p, uf.UAE_LURE_WORDS)
        suffix = f" ({words})" if words else ""
        return (
            f"Link uses UAE-themed lure words{suffix}",
            f"الرابط يستخدم كلمات استدراج مرتبطة بالإمارات{suffix}",
        )
    if key == "fake_gov":
        return (
            "Domain contains 'gov' but is not a government domain",
            "النطاق يحتوي على كلمة 'gov' لكنه ليس نطاقًا حكوميًا",
        )
    if key == "is_shortener":
        return (
            "Link uses a URL shortener that hides the real destination",
            "الرابط يستخدم خدمة اختصار روابط تُخفي الوجهة الحقيقية",
        )
    if key == "hosting":
        platform = p.suffix if p.is_private else p.site_domain
        return (
            f"Site is hosted on a free or shared hosting platform ({platform})",
            f"الموقع مستضاف على منصة استضافة مجانية أو مشتركة ({platform})",
        )
    if key == "hyphens":
        n = int(f["host_hyphens"])
        return (f"Domain contains {n} hyphen(s)", f"النطاق يحتوي على {n} من الشرطات (-)")
    if key == "digits":
        return ("Domain name contains many digits", "اسم النطاق يحتوي على أرقام كثيرة")
    if key == "depth":
        n = int(f["sub_depth"])
        return (
            f"Unusually long subdomain chain ({n} level(s))",
            f"سلسلة نطاقات فرعية طويلة بشكل غير معتاد ({n} مستوى)",
        )
    if key == "length":
        n = int(f["host_len"])
        return (f"Unusually long domain name ({n} characters)", f"اسم نطاق طويل بشكل غير معتاد ({n} حرفًا)")
    if key == "random":
        return ("Domain name looks randomly generated", "اسم النطاق يبدو مولّدًا بشكل عشوائي")
    if key == "path":
        return (
            "Link has an unusually long or obfuscated path",
            "الرابط يحتوي على مسار طويل أو مموّه بشكل غير معتاد",
        )
    if key == "query_params":
        n = int(f["query_params"])
        return (f"Link carries {n} query parameter(s)", f"الرابط يحمل {n} من المعاملات (parameters)")
    if key == "has_at":
        return (
            "Link contains '@', which can disguise the real destination",
            "الرابط يحتوي على الرمز '@' الذي قد يُخفي الوجهة الحقيقية",
        )
    if key == "double_slash":
        return (
            "Link contains a redirect-style double slash",
            "الرابط يحتوي على شرطتين مائلتين (//) بأسلوب إعادة التوجيه",
        )
    if key == "has_port":
        return ("Link uses a non-standard network port", "الرابط يستخدم منفذ شبكة غير قياسي")
    if key == "http_in_path":
        return (
            "Link embeds another web address (possible redirect)",
            "الرابط يتضمن عنوانًا إلكترونيًا آخر (إعادة توجيه محتملة)",
        )
    if key == "email_in_url":
        return (
            "Link contains an email address, typical of targeted phishing kits",
            "الرابط يحتوي على عنوان بريد إلكتروني، وهي سمة شائعة في أدوات التصيّد الموجّه",
        )
    if key == "extension":
        last = p.path.rstrip("/").rsplit("/", 1)[-1]
        ext = last.rsplit(".", 1)[-1] if "." in last else ""
        if not ext:
            return None
        return (f"Link points to a risky file type (.{ext})", f"الرابط يشير إلى نوع ملف خطِر (.{ext})")
    if key == "tld_shape":
        return (f"Unusual domain extension (.{tld})", f"امتداد نطاق غير معتاد (.{tld})")
    if key == "path_is_empty":
        return (
            "Bare domain with no established reputation",
            "نطاق مجرّد بلا سمعة معروفة",
        )
    if key == "brand_sld_official":
        return None
    return ("Unusual link structure", "بنية الرابط غير معتادة")


@lru_cache(maxsize=1)
def get_model() -> UrlModel:
    """Process-wide cached model instance."""
    return UrlModel.load()


__all__ = ["UrlModel", "get_model"]
