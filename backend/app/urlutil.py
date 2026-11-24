from __future__ import annotations

import re
from dataclasses import dataclass
from functools import lru_cache
from urllib.parse import urlsplit, urlunsplit

import tldextract

_extract = tldextract.TLDExtract(suffix_list_urls=(), include_psl_private_domains=False)
_extract_private = tldextract.TLDExtract(suffix_list_urls=(), include_psl_private_domains=True)

URL_RE = re.compile(
    r"""(?xi)
    (?:
        (?:https?|hxxps?)://[^\s<>"'`]+
      | www\.[^\s<>"'`]+
      | (?<![@\w.-])(?:[a-z0-9؀-ۿ](?:[a-z0-9؀-ۿ-]{0,61}[a-z0-9؀-ۿ])?\.)+
        (?:[a-z]{2,24}|xn--[a-z0-9-]{2,59})(?::\d{2,5})?(?:/[^\s<>"'`]*)?
    )
    """
)

_TRAILING = ".,;:!?)]}>'\"»،؛"


@dataclass(frozen=True)
class ParsedUrl:
    url: str
    scheme: str
    hostname: str
    registrable: str
    site: str
    suffix: str
    subdomain: str
    path: str
    is_ip: bool


def defang(text: str) -> str:
    return (
        text.replace("hxxps://", "https://")
        .replace("hxxp://", "http://")
        .replace("[.]", ".")
        .replace("(.)", ".")
        .replace("[:]", ":")
    )


def normalize(raw: str) -> str:
    s = defang(raw.strip()).strip(_TRAILING)
    if not s:
        raise ValueError("empty url")
    if not re.match(r"^[a-z][a-z0-9+.-]*://", s, re.I):
        s = "http://" + s
    parts = urlsplit(s)
    host = (parts.hostname or "").rstrip(".").lower()
    if not host or "." not in host and not host.replace(":", "").isalnum():
        raise ValueError(f"no host in {raw!r}")
    try:
        host_idna = host.encode("idna").decode("ascii")
    except UnicodeError:
        host_idna = host
    netloc = host_idna + (f":{parts.port}" if parts.port else "")
    return urlunsplit((parts.scheme.lower(), netloc, parts.path or "/", parts.query, ""))


@lru_cache(maxsize=50000)
def parse(url: str) -> ParsedUrl:
    u = normalize(url)
    parts = urlsplit(u)
    host = parts.hostname or ""
    ext = _extract(host)
    ext_p = _extract_private(host)
    is_ip = bool(re.fullmatch(r"\d{1,3}(?:\.\d{1,3}){3}", host)) or ":" in host
    registrable = host if is_ip else (ext.top_domain_under_public_suffix or host)
    site = host if is_ip else (ext_p.top_domain_under_public_suffix or registrable)
    return ParsedUrl(
        url=u,
        scheme=parts.scheme,
        hostname=host,
        registrable=registrable,
        site=site,
        suffix=ext.suffix,
        subdomain=ext.subdomain,
        path=parts.path + (f"?{parts.query}" if parts.query else ""),
        is_ip=is_ip,
    )


def registrable_of(host: str) -> str:
    ext = _extract(host.lower().rstrip("."))
    return ext.top_domain_under_public_suffix or host.lower()


def find_urls(text: str) -> list[str]:
    seen: list[str] = []
    for m in URL_RE.finditer(defang(text)):
        candidate = m.group(0).strip(_TRAILING)
        if "@" in candidate.split("/")[0]:
            continue
        try:
            p = parse(candidate)
        except ValueError:
            continue
        if not p.is_ip and not p.suffix:
            continue
        if p.url not in seen:
            seen.append(p.url)
    return seen


def to_unicode(host: str) -> str:
    try:
        return host.encode("ascii").decode("idna")
    except UnicodeError:
        return host
