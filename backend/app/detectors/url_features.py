"""Fast, pure-Python lexical features for URL and hostname risk scoring.

Every URL is first canonicalised by :func:`normalize_url` (scheme dropped,
lower-cased, leading ``www.`` removed, bare trailing slash removed) so the
models never learn artefacts of how a URL was written or which dataset it came
from. Data-driven context (TLD phishing rates and the Tranco popularity ranks)
is supplied through :class:`FeatureContext`; :func:`extract` falls back to the
artifacts shipped in ``backend/app/models`` when no context is given.
"""

from __future__ import annotations

import gzip
import ipaddress
import json
import math
import re
import unicodedata
from collections import Counter
from dataclasses import dataclass, field
from functools import lru_cache
from pathlib import Path
from urllib.parse import unquote, urlsplit

import tldextract

MODELS_DIR = Path(__file__).resolve().parents[1] / "models"
TLD_RISK_FILE = "tld_risk.json"
TRANCO_FILE = "tranco_top.txt.gz"

UNRANKED = 7.0

_PRIVATE = tldextract.TLDExtract(suffix_list_urls=(), cache_dir=None, include_psl_private_domains=True)
_ICANN = tldextract.TLDExtract(suffix_list_urls=(), cache_dir=None)

BRANDS: dict[str, tuple[str, ...]] = {
    "microsoft": ("microsoft", "live", "office", "microsoftonline", "outlook", "azure", "msn", "bing", "sharepoint"),
    "office365": ("microsoft", "office", "microsoftonline", "office365"),
    "outlook": ("outlook", "microsoft", "live", "office"),
    "onedrive": ("onedrive", "microsoft", "live", "1drv"),
    "sharepoint": ("sharepoint", "microsoft"),
    "hotmail": ("hotmail", "live", "microsoft", "outlook"),
    "apple": ("apple", "icloud"),
    "icloud": ("icloud", "apple"),
    "itunes": ("apple", "itunes"),
    "paypal": ("paypal", "paypalobjects"),
    "amazon": ("amazon", "amazonaws", "media-amazon", "amazontrust"),
    "netflix": ("netflix", "nflxext"),
    "facebook": ("facebook", "fb", "fbcdn", "meta"),
    "instagram": ("instagram", "facebook", "meta"),
    "whatsapp": ("whatsapp", "facebook", "meta"),
    "meta": ("meta", "facebook", "metamask"),
    "google": ("google", "googleapis", "gstatic", "googleusercontent", "youtube", "gmail"),
    "gmail": ("gmail", "google"),
    "youtube": ("youtube", "google", "youtu"),
    "linkedin": ("linkedin", "licdn"),
    "twitter": ("twitter", "x", "twimg"),
    "tiktok": ("tiktok",),
    "telegram": ("telegram", "t"),
    "discord": ("discord", "discordapp"),
    "snapchat": ("snapchat",),
    "dhl": ("dhl",),
    "fedex": ("fedex",),
    "usps": ("usps",),
    "royalmail": ("royalmail",),
    "evri": ("evri",),
    "hermes": ("hermes", "myhermes"),
    "dpd": ("dpd",),
    "auspost": ("auspost",),
    "canadapost": ("canadapost", "canadapost-postescanada"),
    "laposte": ("laposte",),
    "correos": ("correos",),
    "postnl": ("postnl",),
    "chase": ("chase", "jpmorgan"),
    "wellsfargo": ("wellsfargo", "wf"),
    "bankofamerica": ("bankofamerica", "bofa"),
    "citibank": ("citibank", "citi"),
    "hsbc": ("hsbc",),
    "barclays": ("barclays",),
    "santander": ("santander",),
    "lloyds": ("lloyds", "lloydsbank"),
    "natwest": ("natwest",),
    "halifax": ("halifax",),
    "revolut": ("revolut",),
    "monzo": ("monzo",),
    "americanexpress": ("americanexpress", "amex", "aexp"),
    "amex": ("americanexpress", "amex"),
    "mastercard": ("mastercard",),
    "visa": ("visa",),
    "capitalone": ("capitalone",),
    "usbank": ("usbank",),
    "pnc": ("pnc",),
    "tdbank": ("td", "tdbank"),
    "scotiabank": ("scotiabank",),
    "rbc": ("rbc", "rbcroyalbank"),
    "interac": ("interac",),
    "desjardins": ("desjardins",),
    "commbank": ("commbank",),
    "westpac": ("westpac",),
    "anz": ("anz",),
    "ing": ("ing",),
    "bnpparibas": ("bnpparibas",),
    "societegenerale": ("societegenerale",),
    "creditagricole": ("credit-agricole", "creditagricole"),
    "deutschebank": ("deutsche-bank", "db"),
    "sparkasse": ("sparkasse",),
    "postbank": ("postbank",),
    "unicredit": ("unicredit",),
    "intesasanpaolo": ("intesasanpaolo",),
    "bbva": ("bbva",),
    "caixabank": ("caixabank",),
    "itau": ("itau",),
    "bradesco": ("bradesco",),
    "nubank": ("nubank",),
    "mercadolibre": ("mercadolibre", "mercadolivre"),
    "mercadopago": ("mercadopago",),
    "coinbase": ("coinbase",),
    "binance": ("binance",),
    "metamask": ("metamask",),
    "trustwallet": ("trustwallet",),
    "blockchain": ("blockchain",),
    "ledger": ("ledger",),
    "trezor": ("trezor",),
    "kraken": ("kraken",),
    "crypto": ("crypto",),
    "opensea": ("opensea",),
    "uniswap": ("uniswap",),
    "phantom": ("phantom",),
    "walletconnect": ("walletconnect",),
    "adobe": ("adobe",),
    "dropbox": ("dropbox", "dropboxusercontent"),
    "docusign": ("docusign",),
    "wetransfer": ("wetransfer",),
    "yahoo": ("yahoo",),
    "aol": ("aol",),
    "att": ("att",),
    "verizon": ("verizon",),
    "tmobile": ("t-mobile", "tmobile"),
    "comcast": ("comcast",),
    "xfinity": ("xfinity",),
    "spectrum": ("spectrum",),
    "steam": ("steampowered", "steamcommunity", "steam"),
    "steamcommunity": ("steamcommunity",),
    "roblox": ("roblox",),
    "epicgames": ("epicgames",),
    "playstation": ("playstation",),
    "ebay": ("ebay",),
    "walmart": ("walmart",),
    "costco": ("costco",),
    "target": ("target",),
    "bestbuy": ("bestbuy",),
    "aliexpress": ("aliexpress",),
    "alibaba": ("alibaba",),
    "shopify": ("shopify", "myshopify"),
    "stripe": ("stripe",),
    "booking": ("booking",),
    "airbnb": ("airbnb",),
    "expedia": ("expedia",),
    "spotify": ("spotify",),
    "zoom": ("zoom",),
    "webex": ("webex",),
    "irs": ("irs",),
    "hmrc": ("hmrc", "gov"),
    "govuk": ("gov",),
    "mygov": ("my", "mygov", "gov"),
    "ato": ("ato", "gov"),
    "medicare": ("medicare",),
    "socialsecurity": ("ssa",),
    "ezpass": ("e-zpassny", "ezpassnj", "ezpass", "e-zpassiag"),
    "sunpass": ("sunpass",),
    "fastrak": ("bayareafastrak", "fastrak"),
    "txtag": ("txtag",),
    "ionos": ("ionos",),
    "godaddy": ("godaddy",),
    "namecheap": ("namecheap",),
    "cpanel": ("cpanel",),
    "roundcube": ("roundcube",),
    "zimbra": ("zimbra",),
    "webmail": (),
    "orange": ("orange",),
    "vodafone": ("vodafone",),
    "swisscom": ("swisscom",),
    "telstra": ("telstra",),
    "optus": ("optus",),
    "allegro": ("allegro",),
    "olx": ("olx",),
    "inpost": ("inpost",),
    "posteitaliane": ("poste",),
    "rakuten": ("rakuten",),
    "aeon": ("aeon",),
    "smbc": ("smbc",),
    "mufg": ("mufg",),
    "sbi": ("sbi", "onlinesbi"),
    "hdfc": ("hdfcbank", "hdfc"),
    "icici": ("icicibank", "icici"),
    "paytm": ("paytm",),
    "tamm": ("tamm",),
    "uaepass": ("uaepass",),
    "adpolice": ("adpolice",),
    "dubaipolice": ("dubaipolice",),
    "salik": ("salik",),
    "darb": ("darb", "itc"),
    "mawaqif": ("mawaqif", "itc"),
    "rta": ("rta",),
    "emiratesnbd": ("emiratesnbd",),
    "enbd": ("emiratesnbd", "enbd"),
    "adcb": ("adcb",),
    "fab": ("bankfab", "fab"),
    "bankfab": ("bankfab",),
    "mashreq": ("mashreq", "mashreqbank"),
    "adib": ("adib",),
    "dib": ("dib",),
    "cbuae": ("centralbank", "cbuae"),
    "etisalat": ("etisalat", "eand"),
    "du": ("du",),
    "emiratespost": ("emiratespost", "epg"),
    "aramex": ("aramex",),
    "dewa": ("dewa",),
    "addc": ("addc",),
    "sewa": ("sewa",),
    "etihad": ("etihad",),
    "emirates": ("emirates", "emiratesnbd", "emiratespost"),
    "flydubai": ("flydubai",),
    "careem": ("careem",),
    "noon": ("noon",),
    "smiles": ("smiles", "etisalat", "eand"),
    "icp": ("icp",),
    "moi": ("moi",),
    "mohre": ("mohre",),
    "mohap": ("mohap",),
    "nol": ("rta", "nol"),
    "ejari": ("dubailand", "ejari"),
    "absher": ("absher",),
    "stcpay": ("stcpay", "stc"),
    "alrajhi": ("alrajhibank",),
}
UAE_BRANDS = frozenset(
    "tamm uaepass adpolice dubaipolice salik darb mawaqif rta emiratesnbd enbd adcb fab bankfab mashreq adib dib "
    "cbuae etisalat du emiratespost aramex dewa addc sewa etihad emirates flydubai careem noon smiles icp moi mohre "
    "mohap nol ejari".split()
)
SHORT_TOKEN_LEN = 4

SUSPICIOUS_WORDS = (
    "login",
    "log-in",
    "signin",
    "sign-in",
    "logon",
    "verify",
    "verification",
    "validate",
    "secure",
    "security",
    "update",
    "account",
    "acount",
    "confirm",
    "unlock",
    "locked",
    "suspend",
    "suspended",
    "restore",
    "recover",
    "support",
    "helpdesk",
    "billing",
    "invoice",
    "payment",
    "pay",
    "wallet",
    "refund",
    "reward",
    "bonus",
    "claim",
    "gift",
    "prize",
    "winner",
    "free",
    "fine",
    "fines",
    "penalty",
    "toll",
    "violation",
    "parcel",
    "package",
    "delivery",
    "redelivery",
    "shipment",
    "tracking",
    "track",
    "customs",
    "auth",
    "authenticate",
    "password",
    "passcode",
    "otp",
    "token",
    "session",
    "webscr",
    "cmd",
    "banking",
    "ebanking",
    "netbanking",
    "online",
    "service",
    "services",
    "portal",
    "access",
    "alert",
    "notice",
    "urgent",
    "official",
    "kyc",
    "airdrop",
    "connect",
    "dapp",
    "seed",
    "recovery",
    "office",
    "mail",
    "webmail",
    "docs",
    "document",
    "file",
    "shared",
    "cloud",
    "drive",
    "voicemail",
    "fax",
    "case",
    "ticket",
    "appeal",
    "copyright",
    "ads",
    "promo",
)
UAE_LURE_WORDS = (
    "fine",
    "fines",
    "toll",
    "traffic",
    "violation",
    "police",
    "salik",
    "darb",
    "parking",
    "mawaqif",
    "visa",
    "emirates",
    "emirate",
    "dubai",
    "abudhabi",
    "uae",
    "ae-",
    "-ae",
    "gov",
    "ministry",
    "post",
    "customs",
    "aed",
    "dirham",
    "refund",
    "renew",
    "renewal",
    "eid",
)
SHORTENERS = frozenset(
    "bit.ly bitly.com goo.gl t.co tinyurl.com ow.ly is.gd buff.ly rebrand.ly cutt.ly shorturl.at rb.gy t.ly "
    "tiny.cc s.id v.gd qr.ae lnkd.in trib.al bl.ink short.io shorte.st adf.ly bc.vc ouo.io soo.gd clck.ru "
    "u.to x.gd tinu.be urlz.fr 2u.pm shorturl.asia wa.me t.me forms.gle 1drv.ms aka.ms amzn.to youtu.be "
    "linktr.ee lnk.to bit.do mcaf.ee qrco.de surl.li tny.sh l.ead.me".split()
)
FREE_HOSTING = frozenset(
    "000webhostapp.com weebly.com weeblysite.com wixsite.com godaddysites.com firebaseapp.com web.app "
    "netlify.app vercel.app github.io gitlab.io pages.dev workers.dev glitch.me repl.co replit.app replit.dev "
    "herokuapp.com blogspot.com wordpress.com notion.site surge.sh square.site webflow.io framer.app "
    "framer.website carrd.co mystrikingly.com strikingly.com jimdosite.com yolasite.com tilda.ws gitbook.io "
    "ngrok.io ngrok-free.app ngrok.app trycloudflare.com r2.dev azurewebsites.net onrender.com fly.dev "
    "infura-ipfs.io cloudflare-ipfs.com dweb.link ipfs.io w3s.link nftstorage.link fleek.co on.fleek.co "
    "webcindario.com myftp.org duckdns.org no-ip.org ddns.net hopto.org zapto.org sytes.net 16mb.com "
    "freehosting.com byethost.com epizy.com rf.gd wuaze.com infinityfreeapp.com sharepoint.com "
    "qualtrics.com typeform.com jotform.com wufoo.com formstack.com hubspotpagebuilder.com hs-sites.com "
    "sendgrid.net mailchimpsites.com canva.site my.canva.site appspot.com cloudfront.net "
    "digitaloceanspaces.com backblazeb2.com wasabisys.com linodeobjects.com "
    "page.link app.link firebasestorage.app "
    "telegra.ph teletype.in substack.com beehiiv.com wpcomstaging.com myshopify.com "
    "start.page bio.link taplink.cc lovable.app bolt.new softr.app glide.page bubbleapps.io "
    "weblium.site site123.me ucraft.site webnode.page zyrosite.com hostingersite.com".split()
)
USER_CONTENT_HOSTS = frozenset(
    "sites.google.com docs.google.com drive.google.com forms.gle storage.googleapis.com "
    "firebasestorage.googleapis.com script.google.com onedrive.live.com 1drv.ms forms.office.com "
    "dropbox.com dl.dropboxusercontent.com s3.amazonaws.com".split()
)
RISKY_EXTENSIONS = {
    "exe": 1.0,
    "apk": 1.0,
    "scr": 1.0,
    "msi": 1.0,
    "bat": 1.0,
    "dll": 1.0,
    "jar": 0.9,
    "vbs": 1.0,
    "bin": 0.8,
    "sh": 0.8,
    "zip": 0.6,
    "rar": 0.7,
    "7z": 0.6,
    "iso": 0.7,
    "img": 0.5,
    "dmg": 0.5,
    "php": 0.4,
    "cgi": 0.4,
    "asp": 0.2,
    "aspx": 0.2,
    "jsp": 0.2,
    "html": 0.1,
    "htm": 0.2,
    "js": 0.2,
    "doc": 0.3,
    "docm": 0.8,
    "xls": 0.3,
    "xlsm": 0.8,
    "pdf": 0.1,
    "lnk": 1.0,
    "hta": 1.0,
    "ps1": 1.0,
}
LEET = str.maketrans({"0": "o", "1": "l", "3": "e", "4": "a", "5": "s", "7": "t", "8": "b", "@": "a", "$": "s"})

_NON_ALNUM = re.compile(r"[^a-z0-9]+")
_ALPHA_TOKENS = re.compile(r"[a-z]+")
_SCHEME = re.compile(r"^(?:[a-z][a-z0-9+.\-]{0,15}://+|h[tx]{2}ps?:/*)")
_HEX_RUN = re.compile(r"[0-9a-f]{16,}")
_EMAIL = re.compile(r"[a-z0-9._%+\-]+(@|%40)[a-z0-9.\-]+\.[a-z]{2,}")
_DIGIT_RUN = re.compile(r"\d+")
_VOWELS = set("aeiou")
_SPECIAL = set("~!$*+,;=:%&_@?#")
_WORD_BRANDS = tuple(b for b in BRANDS if len(b) < SHORT_TOKEN_LEN)
_SUBSTR_BRANDS = tuple(b for b in BRANDS if len(b) >= SHORT_TOKEN_LEN)


def normalize_url(url: str) -> str:
    """Canonical form: no scheme, lower-case, no leading ``www.``, no bare trailing slash."""
    s = str(url or "").strip().strip("\"'<>()[]{} \t\r\n").lower()
    s = s.replace("\\", "/").replace("[.]", ".").replace("(.)", ".").replace("[dot]", ".")
    s = _SCHEME.sub("", s)
    s = s.lstrip("/")
    if s.startswith("www.") and "." in s[4:].split("/", 1)[0]:
        s = s[4:]
    if s.endswith("/") and s.count("/") == 1:
        s = s[:-1]
    return s


def normalize_host(hostname: str) -> str:
    """Canonical hostname as a DNS resolver would see it."""
    host = str(hostname or "").strip().lower().rstrip(".")
    host = _SCHEME.sub("", host)
    host = host.split("/", 1)[0].split("?", 1)[0].split("#", 1)[0]
    host = host.rsplit("@", 1)[-1]
    if host.startswith("[") and "]" in host:
        return host[1 : host.index("]")]
    if host.count(":") == 1:
        host = host.split(":", 1)[0]
    if host.startswith("www.") and "." in host[4:]:
        host = host[4:]
    return host


@lru_cache(maxsize=65536)
def split_host(host: str) -> tuple[str, str, str]:
    """Return ``(subdomain, site_domain, suffix)``.

    ``site_domain`` is the registrable domain an owner controls: private PSL
    suffixes (``*.github.io``) and known free-hosting platforms
    (``*.weebly.com``) yield the tenant domain rather than the platform's.
    """
    host = host.strip(".")
    if not host:
        return "", "", ""
    if _is_ip(host):
        return "", host, ""
    priv = _PRIVATE(host)
    if priv.is_private and priv.domain:
        sub = priv.subdomain
        return sub, f"{priv.domain}.{priv.suffix}", priv.suffix
    icann = _ICANN(host)
    if not icann.domain:
        return "", host, icann.suffix
    registrable = f"{icann.domain}.{icann.suffix}" if icann.suffix else icann.domain
    sub = icann.subdomain
    if registrable in FREE_HOSTING and sub and host not in USER_CONTENT_HOSTS:
        labels = sub.split(".")
        tenant = labels[-1]
        if tenant not in ("www", "m"):
            return ".".join(labels[:-1]), f"{tenant}.{registrable}", registrable
    return sub, registrable, icann.suffix


@lru_cache(maxsize=65536)
def _is_ip(host: str) -> bool:
    try:
        ipaddress.ip_address(host)
        return True
    except ValueError:
        pass
    if re.fullmatch(r"(0x[0-9a-f]+|\d+)(\.(0x[0-9a-f]+|\d+)){0,3}", host):
        return True
    return False


def _entropy(s: str) -> float:
    if not s:
        return 0.0
    n = len(s)
    return -sum(c / n * math.log2(c / n) for c in Counter(s).values())


def _max_consonant_run(s: str) -> int:
    best = run = 0
    for ch in s:
        if ch.isalpha() and ch not in _VOWELS:
            run += 1
            best = max(best, run)
        else:
            run = 0
    return best


def tokens_of(text: str) -> set[str]:
    """Alphanumeric tokens of a string."""
    return set(_NON_ALNUM.split(text))


def find_brands(text: str, tokens: set[str]) -> set[str]:
    """Brand names in ``text``; short names (e.g. ``du``, ``fab``) only as whole tokens."""
    found = {b for b in _SUBSTR_BRANDS if b in text}
    found.update(b for b in _WORD_BRANDS if b in tokens)
    return found


def is_official_brand(brand: str, sld: str) -> bool:
    """Whether ``sld`` (second-level label) belongs to the brand's own domain family."""
    family = BRANDS.get(brand, ())
    return sld == brand or sld in family


@dataclass
class FeatureContext:
    """Data-driven lookups shared by the feature extractor."""

    tld_risk: dict[str, float] = field(default_factory=dict)
    tld_prior: float = 0.5
    ranks: dict[str, int] = field(default_factory=dict)

    @classmethod
    def load(cls, models_dir: str | Path | None = None) -> "FeatureContext":
        base = Path(models_dir) if models_dir else MODELS_DIR
        ctx = cls()
        risk_path = base / TLD_RISK_FILE
        if risk_path.exists():
            payload = json.loads(risk_path.read_text())
            ctx.tld_risk = payload["risk"]
            ctx.tld_prior = payload["prior"]
        ranks_path = base / TRANCO_FILE
        if ranks_path.exists():
            with gzip.open(ranks_path, "rt") as fh:
                ctx.ranks = {line.rstrip("\n"): i for i, line in enumerate(fh, start=1)}
        return ctx

    def rank(self, site_domain: str) -> int | None:
        return self.ranks.get(site_domain)


_DEFAULT_CTX: FeatureContext | None = None


def default_context() -> FeatureContext:
    global _DEFAULT_CTX
    if _DEFAULT_CTX is None:
        _DEFAULT_CTX = FeatureContext.load()
    return _DEFAULT_CTX


@dataclass(frozen=True)
class ParsedUrl:
    norm: str
    host: str
    port: str
    path: str
    query: str
    fragment: str
    userinfo: bool
    subdomain: str
    site_domain: str
    suffix: str
    sld: str
    is_ip: bool
    is_private: bool


def parse(url: str) -> ParsedUrl:
    """Parse any user-supplied URL-ish string without raising."""
    norm = normalize_url(url)
    try:
        parts = urlsplit("http://" + norm)
        netloc = parts.netloc
        path, query, fragment = parts.path, parts.query, parts.fragment
    except ValueError:
        netloc, _, rest = norm.partition("/")
        path, query, fragment = "/" + rest, "", ""
    userinfo = "@" in netloc
    hostport = netloc.rsplit("@", 1)[-1]
    port = ""
    if hostport.startswith("["):
        host = hostport[1 : hostport.find("]")] if "]" in hostport else hostport[1:]
        tail = hostport[hostport.find("]") + 1 :] if "]" in hostport else ""
        port = tail[1:] if tail.startswith(":") else ""
    elif hostport.count(":") == 1:
        host, port = hostport.split(":", 1)
    else:
        host = hostport
    host = host.strip(".")
    if host.startswith("www.") and "." in host[4:]:
        host = host[4:]
    try:
        host = host.encode("idna").decode("ascii") if not host.isascii() else host
    except UnicodeError:
        pass
    sub, site, suffix = split_host(host)
    is_ip = _is_ip(host)
    sld = site[: -len(suffix) - 1] if suffix and site.endswith("." + suffix) else site
    if "." in sld and not is_ip:
        sld = sld.split(".")[0]
    is_private = bool(suffix) and (suffix in FREE_HOSTING or ("." in suffix and _PRIVATE(host).is_private))
    return ParsedUrl(norm, host, port, path, query, fragment, userinfo, sub, site, suffix, sld, is_ip, is_private)


_HOST_RE = re.compile(r"^(?=.{3,253}$)([a-z0-9_]([a-z0-9_\-]{0,61}[a-z0-9_])?\.)+[a-z0-9\-]{2,63}$")


def is_valid_host(host: str) -> bool:
    """Whether ``host`` is a syntactically plausible public hostname or an IP address."""
    return bool(host) and (_is_ip(host) or bool(_HOST_RE.match(host)))


def tld_of(p: ParsedUrl) -> str:
    if p.is_ip or not p.host:
        return "<ip>" if p.is_ip else ""
    return p.host.rsplit(".", 1)[-1]


def extract(url: str, ctx: FeatureContext | None = None) -> dict[str, float]:
    """Lexical feature vector for a URL (any format; never raises)."""
    ctx = ctx or default_context()
    try:
        p = parse(url)
    except Exception:
        p = parse("invalid")
    return _features(p, ctx, host_only=False)


def extract_host(hostname: str, ctx: FeatureContext | None = None) -> dict[str, float]:
    """Hostname-only feature vector for the DNS fast path."""
    ctx = ctx or default_context()
    try:
        p = parse(normalize_host(hostname))
    except Exception:
        p = parse("invalid")
    return _features(p, ctx, host_only=True)


def _features(p: ParsedUrl, ctx: FeatureContext, host_only: bool) -> dict[str, float]:
    host, sub, sld = p.host, p.subdomain, p.sld
    host_tokens = set(_NON_ALNUM.split(host))
    sub_tokens = set(_NON_ALNUM.split(sub)) if sub else set()
    sld_tokens = set(_NON_ALNUM.split(sld))
    tld = tld_of(p)
    rank = None if (p.is_ip or host in USER_CONTENT_HOSTS) else ctx.rank(p.site_domain)
    icann_site = p.suffix if p.is_private else p.site_domain
    platform_rank = ctx.rank(icann_site) if p.is_private else None
    non_ascii = not host.isascii()
    puny = "xn--" in host

    brands_sub = find_brands(sub, sub_tokens)
    brands_sld = find_brands(sld, sld_tokens)
    sld_official = any(is_official_brand(b, sld) for b in brands_sld)
    brand_sld_partial = bool(brands_sld) and not sld_official
    brand_sub_foreign = any(not is_official_brand(b, sld) for b in brands_sub)
    leet_host = host.translate(LEET)
    leet_brands = find_brands(leet_host, set(_NON_ALNUM.split(leet_host))) - brands_sub - brands_sld
    leet_brand = any(not is_official_brand(b, sld) for b in leet_brands)
    uae_brand_host = bool((brands_sub | brands_sld) & UAE_BRANDS) and not sld_official

    kw_host = sum(1 for w in SUSPICIOUS_WORDS if w in host_tokens or (len(w) > 5 and w in host))
    uae_host = sum(1 for w in UAE_LURE_WORDS if w in host)
    gov_token = "gov" in host_tokens or "gov" in sld
    fake_gov = gov_token and ".gov." not in "." + host + "." and not tld == "gov"

    labels = host.split(".") if host else []
    digit_host = sum(ch.isdigit() for ch in host)
    sld_alpha = re.sub(r"[^a-z]", "", sld)
    feats: dict[str, float] = {
        "host_len": len(host),
        "sld_len": len(sld),
        "sub_len": len(sub),
        "sub_depth": len(sub.split(".")) if sub else 0,
        "n_labels": len(labels),
        "max_label_len": max((len(x) for x in labels), default=0),
        "host_dots": host.count("."),
        "host_hyphens": host.count("-"),
        "sld_hyphens": sld.count("-"),
        "host_digits": digit_host,
        "host_digit_ratio": digit_host / max(len(host), 1),
        "sld_digits": sum(ch.isdigit() for ch in sld),
        "host_entropy": _entropy(host),
        "sld_entropy": _entropy(sld),
        "sld_vowel_ratio": sum(ch in _VOWELS for ch in sld_alpha) / max(len(sld_alpha), 1),
        "sld_consonant_run": _max_consonant_run(sld),
        "sld_max_digit_run": max((len(m) for m in _DIGIT_RUN.findall(sld)), default=0),
        "tld_risk": ctx.tld_risk.get(tld, ctx.tld_prior),
        "tld_len": len(tld),
        "tld_is_cc": float(len(tld) == 2),
        "is_private_suffix": float(p.is_private),
        "is_ip": float(p.is_ip),
        "punycode": float(puny),
        "non_ascii_host": float(non_ascii),
        "confusable": float(_has_confusable(host) if (non_ascii or puny) else False),
        "brand_in_sub": float(brand_sub_foreign),
        "brand_sld_partial": float(brand_sld_partial),
        "brand_sld_official": float(sld_official),
        "brand_leet": float(leet_brand),
        "brand_uae_host": float(uae_brand_host),
        "n_brands_host": len(brands_sub | brands_sld),
        "kw_host": kw_host,
        "uae_lure_host": uae_host,
        "fake_gov": float(fake_gov),
        "is_shortener": float(host in SHORTENERS or p.site_domain in SHORTENERS),
        "is_free_hosting": float(
            p.is_private or icann_site in FREE_HOSTING or p.site_domain in FREE_HOSTING or host in USER_CONTENT_HOSTS
        ),
        "rank_log": math.log10(rank) if rank else UNRANKED,
        "rank_top1k": float(bool(rank) and rank <= 1_000),
        "rank_top10k": float(bool(rank) and rank <= 10_000),
        "rank_top100k": float(bool(rank)),
        "platform_rank_log": math.log10(platform_rank) if platform_rank else UNRANKED,
        "sub_is_www_like": float(bool(re.fullmatch(r"(www\d*|m|mobile|ww\d*)", sub or "-"))),
    }
    if host_only:
        return feats

    path = unquote(p.path)
    query = p.query
    full = p.norm
    path_tokens = set(_ALPHA_TOKENS.findall(path + " " + query))
    segments = [s for s in path.split("/") if s]
    last = segments[-1] if segments else ""
    ext = last.rsplit(".", 1)[-1] if "." in last else ""
    brands_path = find_brands(path + "?" + query, path_tokens)
    brands_path_foreign = {b for b in brands_path if not is_official_brand(b, sld)}
    kw_path = sum(1 for w in SUSPICIOUS_WORDS if w in path_tokens)
    uae_path = sum(1 for w in UAE_LURE_WORDS if w in path_tokens)
    tokens = [t for t in _NON_ALNUM.split(full) if t]
    digits = sum(ch.isdigit() for ch in full)
    feats.update(
        {
            "url_len": len(full),
            "path_len": len(path),
            "query_len": len(query),
            "fragment_len": len(p.fragment),
            "n_segments": len(segments),
            "max_segment_len": max((len(s) for s in segments), default=0),
            "url_digits": digits,
            "url_digit_ratio": digits / max(len(full), 1),
            "url_hyphens": full.count("-"),
            "url_dots": full.count("."),
            "url_special": sum(ch in _SPECIAL for ch in full),
            "url_slashes": full.count("/"),
            "path_entropy": _entropy(path),
            "query_params": len([q for q in query.split("&") if q]),
            "has_at": float(p.userinfo or "@" in path),
            "double_slash": float("//" in p.path),
            "has_port": float(bool(p.port)),
            "http_in_path": float("http" in path or "http" in query or "www." in path),
            "email_in_url": float(bool(_EMAIL.search(path + "?" + query + "#" + p.fragment))),
            "hex_run": float(bool(_HEX_RUN.search(path + query))),
            "n_tokens": len(tokens),
            "max_token_len": max((len(t) for t in tokens), default=0),
            "ext_risk": RISKY_EXTENSIONS.get(ext, 0.0),
            "ext_php": float(ext == "php"),
            "ext_html": float(ext in ("html", "htm")),
            "brand_in_path": float(bool(brands_path_foreign)),
            "n_brands_total": len(brands_sub | brands_sld | brands_path),
            "kw_path": kw_path,
            "uae_lure_path": uae_path,
            "tilde": float("~" in full),
            "path_is_empty": float(not segments and not query),
        }
    )
    return feats


@lru_cache(maxsize=4096)
def _has_confusable(host: str) -> bool:
    try:
        text = host.encode("ascii").decode("idna") if "xn--" in host else host
    except UnicodeError:
        return True
    scripts = set()
    for ch in text:
        if ch.isalpha():
            try:
                scripts.add(unicodedata.name(ch).split(" ")[0])
            except ValueError:
                continue
    if len(scripts) > 1:
        return True
    from confusable_homoglyphs import confusables

    return bool(confusables.is_dangerous(text))


URL_FEATURE_NAMES: list[str] = list(extract("example.com/a?b=c", FeatureContext()).keys())
HOST_FEATURE_NAMES: list[str] = list(extract_host("example.com", FeatureContext()).keys())


def ngram_text(url: str) -> str:
    """Text fed to the character n-gram model: canonical host + path + query."""
    return normalize_url(url)[:300]
