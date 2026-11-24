from __future__ import annotations

import re
import unicodedata
from dataclasses import dataclass, field
from functools import lru_cache
from pathlib import Path

import yaml
from confusable_homoglyphs import confusables
from rapidfuzz.distance import Levenshtein

from .schemas import BrandRef
from .urlutil import to_unicode

BRANDS_DIR = Path(__file__).resolve().parent / "brands"
GENERIC_TOKENS = {
    "www", "online", "secure", "login", "pay", "payment", "portal", "service", "services", "uae", "ae",
    "gov", "app", "my", "web", "account", "verify", "update", "support", "help", "info", "official",
    "dubai", "abudhabi", "sharjah", "police", "bank", "fines", "fine", "toll", "post", "mail", "net",
    "emirates", "centralbank", "amazonprime", "tax", "taxgov", "uaetax", "vat-refund", "vatrefund", "payit",
}
ENGLISH_COLLISIONS = ("parking", "dewan", "tammy", "lulus", "noone", "salikh")
GENERIC_MENTIONS = {"emirates", "etihad", "noon", "tax", "lulu", "amazon", "du", "parkin", "seha", "doh", "liv"}


@dataclass
class Brand:
    id: str
    name_en: str
    name_ar: str
    category: str
    official_domains: list[str]
    keywords_en: list[str]
    keywords_ar: list[str]
    helplines: list[dict]
    whatsapp: list[str]
    lures_en: list[str] = field(default_factory=list)
    lures_ar: list[str] = field(default_factory=list)

    @property
    def logo_path(self) -> Path:
        return BRANDS_DIR / "assets" / f"{self.id}.png"

    def ref(self) -> BrandRef:
        return BrandRef(
            id=self.id,
            name_en=self.name_en,
            name_ar=self.name_ar,
            official_domains=self.official_domains,
            category=self.category,
            logo_url=f"/media/brands/{self.id}.png" if self.logo_path.exists() else None,
            reference_screenshot_url=f"/media/refs/{self.id}.jpg" if (BRANDS_DIR / "refs" / f"{self.id}.jpg").exists() else None,
        )

    @property
    def helpline_digits(self) -> set[str]:
        return {_digits(h.get("number", "")) for h in self.helplines} | {_digits(w) for w in self.whatsapp}


def _digits(s: str) -> str:
    d = re.sub(r"\D", "", s)
    if d.startswith("00971"):
        d = d[5:]
    elif d.startswith("971"):
        d = d[3:]
    return d.lstrip("0")


def skeleton(s: str) -> str:
    out = []
    for ch in unicodedata.normalize("NFKC", s.lower()):
        alias = confusables.is_confusable(ch, preferred_aliases=["latin"]) if not ch.isascii() else None
        if alias:
            ch = alias[0]["homoglyphs"][0]["c"]
        out.append(ch)
    s = "".join(out)
    return s.replace("rn", "m").replace("vv", "w").replace("0", "o").replace("1", "l").replace("3", "e").replace("5", "s")


class Registry:
    def __init__(self) -> None:
        self.brands: dict[str, Brand] = {}
        self.official: dict[str, str] = {}
        self.extra_official: set[str] = set()
        self.keyword_index: dict[str, str] = {}
        self.arabic_index: dict[str, str] = {}
        self.load()

    def load(self) -> None:
        path = BRANDS_DIR / "uae_brands.yaml"
        data = yaml.safe_load(path.read_text(encoding="utf-8")) if path.exists() else {"brands": []}
        self.brands = {}
        for b in data.get("brands", []):
            brand = Brand(
                id=b["id"],
                name_en=b["name_en"],
                name_ar=b.get("name_ar", b["name_en"]),
                category=b.get("category", "other"),
                official_domains=[d.lower() for d in b.get("official_domains", [])],
                keywords_en=[k.lower() for k in b.get("keywords_en", [])],
                keywords_ar=b.get("keywords_ar", []),
                helplines=b.get("helplines", []) or [],
                whatsapp=b.get("whatsapp", []) or [],
                lures_en=b.get("lures_en", []) or [],
                lures_ar=b.get("lures_ar", []) or [],
            )
            self.brands[brand.id] = brand
        self.official = {d: b.id for b in self.brands.values() for d in b.official_domains}
        extra = BRANDS_DIR / "uae_official_domains.txt"
        self.extra_official = (
            {ln.strip().lower() for ln in extra.read_text(encoding="utf-8").splitlines() if ln.strip() and not ln.startswith("#")}
            if extra.exists()
            else set()
        )
        self.keyword_index = {}
        for b in self.brands.values():
            for k in b.keywords_en + [d.split(".")[0] for d in b.official_domains]:
                if len(k) >= 4 and k not in GENERIC_TOKENS:
                    self.keyword_index.setdefault(k, b.id)
        self.arabic_index = {k: b.id for b in self.brands.values() for k in [b.name_ar, *b.keywords_ar] if len(k) >= 2}

    def official_brand(self, registrable: str, hostname: str) -> Brand | None:
        bid = self.official.get(registrable) or self.official.get(hostname)
        return self.brands.get(bid) if bid else None

    def is_official(self, registrable: str, hostname: str) -> bool:
        return (
            registrable in self.official
            or registrable in self.extra_official
            or hostname.endswith(".gov.ae")
            or hostname == "gov.ae"
            or hostname.endswith(".mil.ae")
        )

    def impersonation(self, hostname: str, registrable: str) -> tuple[Brand, str, str] | None:
        if self.is_official(registrable, hostname):
            return None
        host_u = to_unicode(hostname)
        host_sk = skeleton(host_u)
        labels = re.split(r"[.\-_]", host_sk)
        joined = host_sk.replace("-", "").replace(".", "")
        labels = [lbl for lbl in labels if not any(w in lbl for w in ENGLISH_COLLISIONS)] or labels
        for token, bid in sorted(self.keyword_index.items(), key=lambda kv: -len(kv[0])):
            if token in labels or (len(token) >= 5 and any(lbl.startswith(token) or lbl.endswith(token) for lbl in labels if len(lbl) > len(token))):
                return self.brands[bid], "keyword" if token in host_u.lower() else "homoglyph", token
        for token, bid in sorted(self.keyword_index.items(), key=lambda kv: -len(kv[0])):
            if len(token) == 4 and any(lbl.startswith(token) and len(lbl) - len(token) <= 3 for lbl in labels if lbl != token):
                return self.brands[bid], "prefix", token
        reg_label = skeleton(to_unicode(registrable).split(".")[0])
        for dom, bid in self.official.items():
            off_label = dom.split(".")[0]
            if len(off_label) >= 5 and reg_label != off_label:
                dist = Levenshtein.distance(reg_label, off_label)
                if len(reg_label) >= 5 and dist <= (1 if len(off_label) <= 8 else 2) and reg_label[0] == off_label[0]:
                    return self.brands[bid], "typosquat", dom
        if host_u != host_sk:
            raw_labels = re.split(r"[.\-_]", host_u.lower())
            for token, bid in self.keyword_index.items():
                hit = any(lbl == token or (len(token) >= 5 and (lbl.startswith(token) or lbl.endswith(token))) for lbl in labels)
                if hit and not any(token in lbl for lbl in raw_labels):
                    return self.brands[bid], "homoglyph", token
        return None

    def mentioned_brands(self, text: str, title: str = "") -> list[tuple[Brand, int]]:
        """Brands a page claims to be: title mentions weigh 3, body mentions 1; generic words are ignored."""
        if not text and not title:
            return []
        scores: dict[str, int] = {}
        for b in self.brands.values():
            en_terms = {t for t in {b.name_en.lower(), *b.keywords_en} if len(t) >= 4 and t not in GENERIC_TOKENS and t not in GENERIC_MENTIONS}
            ar_terms = {t for t in {b.name_ar, *b.keywords_ar} if len(t) >= 4}
            n = 0
            for src, weight in ((title, 3), (text, 1)):
                low = src.lower()
                for k in en_terms:
                    n += weight * min(3, len(re.findall(rf"(?<![a-z]){re.escape(k)}(?![a-z])", low)))
                for k in ar_terms:
                    n += weight * min(3, src.count(k))
            if n >= 2:
                scores[b.id] = n
        return sorted(((self.brands[k], v) for k, v in scores.items()), key=lambda kv: -kv[1])

    def brand_for_org(self, org: str | None) -> Brand | None:
        """Brand whose name appears in a certificate's validated organisation (OV/EV), e.g. 'Emirates NBD Bank PJSC'."""
        if not org:
            return None
        low = re.sub(r"[^a-z0-9 ]", " ", org.lower())
        padded = f" {re.sub(r'\s+', ' ', low)} "
        best: tuple[int, Brand] | None = None
        for b in self.brands.values():
            outside = re.sub(r"\s*\(.*\)", "", b.name_en)
            inside = re.findall(r"\((.*?)\)", b.name_en)
            for name in [outside, *inside]:
                name = re.sub(r"\s+", " ", re.sub(r"[^a-z0-9 ]", " ", name.lower())).strip()
                if len(name) >= 4 and name not in GENERIC_MENTIONS and f" {name} " in padded and (best is None or len(name) > best[0]):
                    best = (len(name), b)
        return best[1] if best else None

    def brand_for_phone(self, number: str) -> Brand | None:
        d = _digits(number)
        for b in self.brands.values():
            if d and d in b.helpline_digits:
                return b
        return None

    def all_official_domains(self) -> set[str]:
        return set(self.official) | self.extra_official


@lru_cache
def get_registry() -> Registry:
    return Registry()


def digits(number: str) -> str:
    return _digits(number)
