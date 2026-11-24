"""Build the URL-classification dataset for Trust Issues.

Stages (run in order, each is idempotent):

    fetch       download static public sources into data/raw
    history     download dated snapshots of the OpenPhish public feed (GitHub history)
    crawl       collect legitimate deep URLs from homepages of Tranco / PhiUSIIL / UAE domains
    commoncrawl sample real pages on shared hosts, shorteners and major brands (Common Crawl index)
    curated     harvest links from human-curated lists (legitimate pages on shared hosts)
    build       merge, normalise, deduplicate and write a time-aware, domain-disjoint split

Usage (from backend/):  uv run python ../ml/build_dataset.py all
"""

from __future__ import annotations

import argparse
import asyncio
import csv
import datetime as dt
import json
import random
import re
import sys
import zipfile
from pathlib import Path
from urllib.parse import urljoin, urlsplit

import httpx
import pandas as pd

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "backend"))

from app.detectors.url_features import normalize_url, split_host  # noqa: E402

RAW = ROOT / "data" / "raw"
PROCESSED = ROOT / "data" / "processed"
UAE_DOMAINS_FILE = ROOT / "backend" / "app" / "brands" / "uae_official_domains.txt"

SOURCES = {
    "phiusiil.zip": "https://archive.ics.uci.edu/static/public/967/phiusiil+phishing+url+dataset.zip",
    "tranco.zip": "https://tranco-list.eu/top-1m.csv.zip",
    "openphish.txt": "https://openphish.com/feed.txt",
    "pdb_active.txt": "https://raw.githubusercontent.com/Phishing-Database/Phishing.Database/master/phishing-links-ACTIVE.txt",
    "pdb_new_today.txt": "https://raw.githubusercontent.com/Phishing-Database/Phishing.Database/master/phishing-links-NEW-today.txt",
}
OPENPHISH_REPO = "openphish/public_feed"
HISTORY_DIR = RAW / "openphish_history"
CRAWL_FILE = RAW / "legit_crawl.csv"
CRAWL_ATTEMPTED = RAW / "legit_crawl_attempted.txt"
COMMONCRAWL_FILE = RAW / "commoncrawl.csv"
FOCUS_PATTERN = r"bank|\.gov|gov\.|police|ministry|\.mil|tax|customs|finance|credit|insur|\.ae$|post\.|court|health"
CC_PATTERNS = (
    [
        f"*.{h}"
        for h in (
            "github.io",
            "notion.site",
            "vercel.app",
            "netlify.app",
            "pages.dev",
            "web.app",
            "firebaseapp.com",
            "blogspot.com",
            "wordpress.com",
            "wixsite.com",
            "weebly.com",
            "webflow.io",
            "framer.website",
            "carrd.co",
            "herokuapp.com",
            "gitbook.io",
            "substack.com",
            "myshopify.com",
            "square.site",
            "godaddysites.com",
            "glitch.me",
            "surge.sh",
            "azurewebsites.net",
            "workers.dev",
            "sharepoint.com",
        )
    ]
    + ["sites.google.com/*", "docs.google.com/*", "forms.gle/*", "storage.googleapis.com/*"]
    + [
        f"{h}/*"
        for h in (
            "bit.ly",
            "t.co",
            "tinyurl.com",
            "ow.ly",
            "buff.ly",
            "rebrand.ly",
            "cutt.ly",
            "is.gd",
            "lnkd.in",
            "youtu.be",
            "amzn.to",
            "linktr.ee",
            "t.me",
            "wa.me",
            "aka.ms",
            "goo.gl",
        )
    ]
    + [
        f"*.{d}"
        for d in (
            "google.com",
            "microsoft.com",
            "live.com",
            "office.com",
            "apple.com",
            "paypal.com",
            "amazon.com",
            "netflix.com",
            "facebook.com",
            "instagram.com",
            "whatsapp.com",
            "linkedin.com",
            "dhl.com",
            "fedex.com",
            "ups.com",
            "usps.com",
            "chase.com",
            "wellsfargo.com",
            "bankofamerica.com",
            "hsbc.com",
            "coinbase.com",
            "binance.com",
            "adobe.com",
            "dropbox.com",
            "docusign.com",
            "yahoo.com",
            "ebay.com",
            "steamcommunity.com",
            "emiratesnbd.com",
            "adcb.com",
            "bankfab.com",
            "mashreq.com",
            "adib.ae",
            "dib.ae",
            "etisalat.ae",
            "du.ae",
            "emirates.com",
            "etihad.com",
            "aramex.com",
            "noon.com",
            "careem.com",
            "dewa.gov.ae",
            "rta.ae",
            "dubaipolice.gov.ae",
            "adpolice.gov.ae",
            "u.ae",
            "tamm.abudhabi",
            "icp.gov.ae",
            "moi.gov.ae",
            "mohre.gov.ae",
            "salik.ae",
            "emiratespost.ae",
            "centralbank.ae",
            "uaepass.ae",
            "abudhabi.ae",
            "dubai.ae",
            "sharjah.ae",
            "government.ae",
            "adnoc.ae",
            "addc.ae",
            "eand.com",
        )
    ]
)
CURATED_LISTS = [
    "https://raw.githubusercontent.com/EbookFoundation/free-programming-books/main/books/free-programming-books-langs.md",
    "https://raw.githubusercontent.com/EbookFoundation/free-programming-books/main/books/free-programming-books-subjects.md",
    "https://raw.githubusercontent.com/EbookFoundation/free-programming-books/main/courses/free-courses-en.md",
    "https://raw.githubusercontent.com/public-apis/public-apis/master/README.md",
    "https://raw.githubusercontent.com/ripienaar/free-for-dev/master/README.md",
    "https://raw.githubusercontent.com/vinta/awesome-python/master/README.md",
    "https://raw.githubusercontent.com/sorrycc/awesome-javascript/master/README.md",
    "https://raw.githubusercontent.com/enaqx/awesome-react/master/README.md",
    "https://raw.githubusercontent.com/trimstray/the-book-of-secret-knowledge/master/README.md",
    "https://raw.githubusercontent.com/jnv/lists/master/README.md",
    "https://raw.githubusercontent.com/sindresorhus/awesome-nodejs/main/readme.md",
    "https://raw.githubusercontent.com/avelino/awesome-go/main/README.md",
    "https://raw.githubusercontent.com/rust-unofficial/awesome-rust/main/README.md",
    "https://raw.githubusercontent.com/awesomedata/awesome-public-datasets/master/README.rst",
    "https://raw.githubusercontent.com/josephmisiti/awesome-machine-learning/master/README.md",
]
CURATED_FILE = RAW / "curated_links.csv"
_MD_LINK = re.compile(r"https?://[^\s)\]>\"'`]+")
_STATIC_EXT = re.compile(r"\.(js|css|png|jpe?g|gif|svg|ico|woff2?|ttf|xml|json|txt|webp|mp4|pdf)(\?|$)", re.I)

TEST_LEGIT_CAPS = {"phiusiil": 6000, "tranco_homepage": 3000}
TEST_WINDOW_DAYS = 30
TRAIN_GAP_DAYS = 7
SEED = 42

USER_AGENT = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36"
)


def fetch() -> None:
    """Download static sources (skips files that already exist)."""
    RAW.mkdir(parents=True, exist_ok=True)
    with httpx.Client(follow_redirects=True, timeout=300) as client:
        for name, url in SOURCES.items():
            target = RAW / name
            if target.exists() and target.stat().st_size > 0:
                continue
            print(f"downloading {url}")
            resp = client.get(url)
            resp.raise_for_status()
            target.write_bytes(resp.content)
    for archive, folder in (("phiusiil.zip", "phiusiil"), ("tranco.zip", "tranco")):
        dest = RAW / folder
        if not dest.exists():
            with zipfile.ZipFile(RAW / archive) as zf:
                zf.extractall(dest)


def history(since_days: int = 420) -> None:
    """Download one OpenPhish feed snapshot per commit (twice daily) from GitHub history."""
    HISTORY_DIR.mkdir(parents=True, exist_ok=True)
    since = dt.datetime.now(dt.UTC) - dt.timedelta(days=since_days)
    commits: list[tuple[str, str]] = []
    with httpx.Client(timeout=60, headers={"User-Agent": USER_AGENT}) as client:
        page = 1
        while True:
            resp = client.get(
                f"https://api.github.com/repos/{OPENPHISH_REPO}/commits",
                params={"per_page": 100, "page": page, "since": since.isoformat()},
            )
            resp.raise_for_status()
            batch = resp.json()
            if not batch:
                break
            commits += [(c["sha"], c["commit"]["committer"]["date"]) for c in batch]
            page += 1
        print(f"{len(commits)} commits since {since.date()}")

    async def grab(sem: asyncio.Semaphore, client: httpx.AsyncClient, sha: str, date: str) -> None:
        target = HISTORY_DIR / f"{date.replace(':', '')}_{sha[:10]}.txt"
        if target.exists():
            return
        async with sem:
            url = f"https://raw.githubusercontent.com/{OPENPHISH_REPO}/{sha}/feed.txt"
            for _ in range(3):
                try:
                    resp = await client.get(url)
                    if resp.status_code == 200:
                        target.write_text(resp.text)
                        return
                except httpx.HTTPError:
                    await asyncio.sleep(1)

    async def run() -> None:
        sem = asyncio.Semaphore(16)
        async with httpx.AsyncClient(timeout=60, headers={"User-Agent": USER_AGENT}) as client:
            await asyncio.gather(*(grab(sem, client, sha, date) for sha, date in commits))

    asyncio.run(run())
    print(f"{len(list(HISTORY_DIR.glob('*.txt')))} snapshots on disk")


def load_tranco() -> pd.DataFrame:
    df = pd.read_csv(RAW / "tranco" / "top-1m.csv", header=None, names=["rank", "domain"])
    df["domain"] = df["domain"].str.lower()
    return df


def load_uae_domains() -> list[str]:
    if not UAE_DOMAINS_FILE.exists():
        return []
    out = []
    for line in UAE_DOMAINS_FILE.read_text().splitlines():
        line = line.strip().lower()
        if line and not line.startswith("#"):
            out.append(line.split()[0])
    return out


_HREF = re.compile(rb"""<a\s[^>]*?href\s*=\s*["']([^"'#<>\s]+)""", re.I)


async def _crawl_one(client: httpx.AsyncClient, domain: str, per_domain: int) -> list[tuple[str, str]]:
    rows: list[tuple[str, str]] = []
    for base in (f"https://{domain}/", f"https://www.{domain}/"):
        try:
            resp = await client.get(base)
        except (httpx.HTTPError, ValueError, UnicodeError):
            continue
        if resp.status_code >= 400 or "html" not in resp.headers.get("content-type", ""):
            continue
        final = str(resp.url)
        rows.append((final, domain))
        site = split_host(urlsplit(final).hostname or "")[1]
        own, external = [], []
        for match in _HREF.findall(resp.content[:600_000]):
            try:
                href = urljoin(final, match.decode("utf-8", "ignore").strip())
            except ValueError:
                continue
            if not href.startswith(("http://", "https://")) or len(href) > 400:
                continue
            host = urlsplit(href).hostname or ""
            if split_host(host)[1] == site:
                own.append(href)
            else:
                external.append(href)
        random.shuffle(own)
        rows += [(u, domain) for u in dict.fromkeys(own).keys()][:per_domain]
        rows += [(u, "external:" + domain) for u in dict.fromkeys(external).keys()][:4]
        return rows
    return rows


def crawl(
    n_domains: int = 9000, seed: int = SEED, focus: bool = False, per_domain: int = 15, concurrency: int = 200
) -> None:
    """Crawl homepages and harvest same-site links as legitimate deep URLs.

    With ``focus`` the sample is restricted to banking / government / payment
    style domains, the sites where false positives hurt most.
    """
    rng = random.Random(seed)
    tranco = load_tranco()
    if focus:
        pool = tranco[tranco["domain"].str.contains(FOCUS_PATTERN, regex=True)]["domain"].tolist()
        _run_crawl(rng.sample(pool, min(n_domains, len(pool))), per_domain, concurrency)
        return
    top = tranco[tranco["rank"] <= 10_000]["domain"].tolist()
    mid = tranco[(tranco["rank"] > 10_000) & (tranco["rank"] <= 100_000)]["domain"].tolist()
    tail = tranco[tranco["rank"] > 100_000]["domain"].tolist()
    phi = pd.read_csv(RAW / "phiusiil" / "PhiUSIIL_Phishing_URL_Dataset.csv", usecols=["URL", "label"])
    phi_legit = [urlsplit(u).hostname or "" for u in phi.loc[phi["label"] == 1, "URL"]]
    phi_legit = [h.removeprefix("www.") for h in phi_legit if h]
    uae = [d for d in tranco["domain"] if d.endswith(".ae")][:1500] + load_uae_domains()
    share = n_domains // 5
    domains = (
        rng.sample(top, min(share, len(top)))
        + rng.sample(mid, share)
        + rng.sample(tail, share)
        + rng.sample(phi_legit, share)
        + uae
    )
    _run_crawl(domains, per_domain, concurrency)


def _run_crawl(domains: list[str], per_domain: int, concurrency: int) -> None:
    domains = list(dict.fromkeys(domains))
    done: set[str] = set()
    if CRAWL_FILE.exists():
        done = set(pd.read_csv(CRAWL_FILE, on_bad_lines="skip")["source"].str.removeprefix("external:"))
    if CRAWL_ATTEMPTED.exists():
        done |= set(CRAWL_ATTEMPTED.read_text().split())
    domains = [d for d in domains if d not in done]
    with CRAWL_ATTEMPTED.open("a") as fh:
        fh.write("\n".join(domains) + "\n")
    print(f"crawling {len(domains)} domains")

    async def run() -> None:
        sem = asyncio.Semaphore(concurrency)
        limits = httpx.Limits(max_connections=concurrency, max_keepalive_connections=0)
        timeout = httpx.Timeout(8.0, connect=5.0)
        new_file = not CRAWL_FILE.exists()
        with CRAWL_FILE.open("a", newline="") as fh:
            writer = csv.writer(fh)
            if new_file:
                writer.writerow(["url", "source"])
            async with httpx.AsyncClient(
                follow_redirects=True,
                timeout=timeout,
                limits=limits,
                headers={"User-Agent": USER_AGENT, "Accept-Language": "en,ar;q=0.8"},
                verify=False,
            ) as client:

                async def task(domain: str) -> list[tuple[str, str]]:
                    async with sem:
                        try:
                            return await asyncio.wait_for(_crawl_one(client, domain, per_domain), 20)
                        except (asyncio.TimeoutError, Exception):
                            return []

                finished = 0
                for coro in asyncio.as_completed([task(d) for d in domains]):
                    rows = await coro
                    writer.writerows(rows)
                    finished += 1
                    if finished % 500 == 0:
                        fh.flush()
                        print(f"  {finished}/{len(domains)} domains", flush=True)

    asyncio.run(run())
    print(f"crawl rows: {sum(1 for _ in CRAWL_FILE.open()) - 1}")


def commoncrawl(per_pattern: int = 1500) -> None:
    """Sample real pages on shared hosts, shorteners and major brand sites from the Common Crawl index."""
    with httpx.Client(timeout=60, headers={"User-Agent": USER_AGENT}) as client:
        collections = client.get("https://index.commoncrawl.org/collinfo.json").json()
    index = collections[1]["cdx-api"]
    done: set[str] = set()
    if COMMONCRAWL_FILE.exists():
        done = set(pd.read_csv(COMMONCRAWL_FILE)["pattern"])
    todo = [p for p in CC_PATTERNS if p not in done]
    print(f"querying {len(todo)} patterns from {index}")

    async def query(sem: asyncio.Semaphore, client: httpx.AsyncClient, pattern: str) -> list[tuple[str, str]]:
        async with sem:
            for _ in range(3):
                try:
                    resp = await client.get(
                        index, params={"url": pattern, "output": "json", "limit": per_pattern * 3, "fl": "url,status"}
                    )
                except httpx.HTTPError:
                    await asyncio.sleep(3)
                    continue
                if resp.status_code == 503:
                    await asyncio.sleep(5)
                    continue
                if resp.status_code != 200:
                    return []
                urls = []
                for line in resp.text.splitlines():
                    try:
                        rec = json.loads(line)
                    except ValueError:
                        continue
                    url = rec.get("url", "")
                    if url and not _STATIC_EXT.search(url) and "robots.txt" not in url:
                        urls.append(url)
                urls = list(dict.fromkeys(urls))
                random.Random(SEED).shuffle(urls)
                return [(u, pattern) for u in urls[:per_pattern]]
            return []

    async def run() -> None:
        sem = asyncio.Semaphore(4)
        async with httpx.AsyncClient(timeout=120, headers={"User-Agent": USER_AGENT}) as client:
            new_file = not COMMONCRAWL_FILE.exists()
            with COMMONCRAWL_FILE.open("a", newline="") as fh:
                writer = csv.writer(fh)
                if new_file:
                    writer.writerow(["url", "pattern"])
                for coro in asyncio.as_completed([query(sem, client, p) for p in todo]):
                    rows = await coro
                    writer.writerows(rows)
                    fh.flush()
                    if rows:
                        print(f"  {rows[0][1]}: {len(rows)}", flush=True)

    asyncio.run(run())


def curated() -> None:
    """Harvest links from human-curated lists (many on shared hosts such as github.io or gitbook.io)."""
    rows: list[tuple[str, str]] = []
    with httpx.Client(timeout=60, follow_redirects=True, headers={"User-Agent": USER_AGENT}) as client:
        for list_url in CURATED_LISTS:
            try:
                resp = client.get(list_url)
            except httpx.HTTPError:
                continue
            if resp.status_code != 200:
                continue
            links = [u.rstrip(".,;:") for u in _MD_LINK.findall(resp.text)]
            links = [u for u in dict.fromkeys(links) if not _STATIC_EXT.search(u) and "github.com" not in u]
            rows += [(u, list_url) for u in links]
            print(f"  {list_url.split('/')[4]}: {len(links)}", flush=True)
    pd.DataFrame(rows, columns=["url", "list"]).drop_duplicates("url").to_csv(CURATED_FILE, index=False)
    print(f"curated links: {len(rows)}")


def _read_lines(path: Path) -> list[str]:
    if not path.exists():
        return []
    return [ln.strip() for ln in path.read_text(errors="ignore").splitlines() if ln.strip()]


def _snapshot_date(path: Path) -> dt.date:
    return dt.date.fromisoformat(path.name[:10])


def _cap_per_domain(df: pd.DataFrame, cap: int) -> pd.DataFrame:
    """Keep at most ``cap`` random rows per (domain, label) so big sites cannot dominate."""
    df = df.sample(frac=1, random_state=SEED)
    return df[df.groupby(["domain", "label"]).cumcount() < cap]


def build() -> None:
    """Assemble train/test with a time-aware, registrable-domain-disjoint split."""
    PROCESSED.mkdir(parents=True, exist_ok=True)
    rng = random.Random(SEED)
    tranco = load_tranco()
    rank = dict(zip(tranco["domain"], tranco["rank"]))

    snapshots = sorted(HISTORY_DIR.glob("*.txt"))
    latest = max(_snapshot_date(p) for p in snapshots)
    test_start = latest - dt.timedelta(days=TEST_WINDOW_DAYS)
    train_end = test_start - dt.timedelta(days=TRAIN_GAP_DAYS)

    rows: list[dict] = []

    def add(url: str, label: int, source: str, split_hint: str, date: str = "") -> None:
        rows.append({"url": url, "label": label, "source": source, "hint": split_hint, "date": date})

    first_seen: dict[str, dt.date] = {}
    for path in snapshots:
        day = _snapshot_date(path)
        for url in _read_lines(path):
            first_seen.setdefault(url, day)
    for url, day in first_seen.items():
        if day >= test_start:
            add(url, 1, "openphish_recent", "test", day.isoformat())
        elif day <= train_end:
            add(url, 1, "openphish_history", "train", day.isoformat())
    for url in _read_lines(RAW / "openphish.txt"):
        if url not in first_seen:
            add(url, 1, "openphish_today", "test", latest.isoformat())

    phi = pd.read_csv(RAW / "phiusiil" / "PhiUSIIL_Phishing_URL_Dataset.csv", usecols=["URL", "label"])
    for url, lab in zip(phi["URL"], phi["label"]):
        add(url, 0 if lab == 1 else 1, "phiusiil", "train", "2023")

    pdb = _read_lines(RAW / "pdb_active.txt")
    rng.shuffle(pdb)
    pdb_kept = 0
    for url in pdb:
        if pdb_kept >= 150_000:
            break
        host = urlsplit(url if "://" in url else "http://" + url).hostname or ""
        if rank.get(split_host(host)[1], 10**9) <= 50_000:
            continue
        add(url, 1, "phishing_database", "train", "2025")
        pdb_kept += 1

    crawl_df = pd.read_csv(CRAWL_FILE, on_bad_lines="skip").dropna()
    for url, src in zip(crawl_df["url"], crawl_df["source"]):
        add(url, 0, "crawl_external" if src.startswith("external:") else "crawl", "any")

    if COMMONCRAWL_FILE.exists():
        cc = pd.read_csv(COMMONCRAWL_FILE, on_bad_lines="skip").dropna()
        for url in cc["url"]:
            add(url, 0, "commoncrawl", "any")

    if CURATED_FILE.exists():
        for url in pd.read_csv(CURATED_FILE).dropna()["url"]:
            add(url, 0, "curated_lists", "any")

    top_hp = tranco[tranco["rank"] <= 200_000].sample(40_000, random_state=SEED)["domain"]
    for dom in top_hp:
        add(dom, 0, "tranco_homepage", "any")
    for dom in load_uae_domains():
        add(dom, 0, "uae_official", "any")

    df = pd.DataFrame(rows)
    df["norm"] = df["url"].map(normalize_url)
    df = df[df["norm"].str.len() > 3]
    df["host"] = df["norm"].map(lambda u: urlsplit("http://" + u).hostname or "")
    df["domain"] = df["host"].map(lambda h: split_host(h)[1])
    df = df[df["domain"] != ""]

    conflict = df.groupby("norm")["label"].nunique()
    df = df[~df["norm"].isin(conflict[conflict > 1].index)]
    phish_domains = set(df.loc[df["label"] == 1, "domain"])
    df = df[~(df["source"].isin(["commoncrawl", "curated_lists"]) & df["domain"].isin(phish_domains))]
    df = df.drop_duplicates("norm")

    test_phish_domains = set(df.loc[(df["hint"] == "test") & (df["label"] == 1), "domain"])
    legit_domains = sorted(set(df.loc[df["label"] == 0, "domain"]))
    rng.shuffle(legit_domains)
    test_legit_domains = set(legit_domains[: int(0.2 * len(legit_domains))]) - test_phish_domains
    test_domains = test_phish_domains | test_legit_domains

    in_test_domain = df["domain"].isin(test_domains)
    test = df[in_test_domain & ((df["hint"] == "test") | (df["label"] == 0))].copy()
    train = df[~in_test_domain & (df["hint"] != "test")].copy()

    train = _cap_per_domain(train, 30)
    test = _cap_per_domain(test, 5)
    phish_test = test[test["label"] == 1]
    legit_parts = []
    for source, g in test[test["label"] == 0].groupby("source"):
        cap = TEST_LEGIT_CAPS.get(source)
        legit_parts.append(g.sample(min(len(g), cap), random_state=SEED) if cap else g)
    test = pd.concat([phish_test, *legit_parts])

    assert not set(train["domain"]) & set(test["domain"]), "domain leakage between train and test"
    cols = ["url", "label", "source", "date", "domain"]
    train[cols].sample(frac=1, random_state=SEED).to_csv(PROCESSED / "train.csv.gz", index=False)
    test[cols].sample(frac=1, random_state=SEED).to_csv(PROCESSED / "test.csv.gz", index=False)
    summary = {
        "test_window": [test_start.isoformat(), latest.isoformat()],
        "train_phish_cutoff": train_end.isoformat(),
        "train": train.groupby(["source", "label"]).size().rename("n").reset_index().to_dict("records"),
        "test": test.groupby(["source", "label"]).size().rename("n").reset_index().to_dict("records"),
    }
    (PROCESSED / "summary.json").write_text(json.dumps(summary, indent=2))
    print(json.dumps(summary, indent=2))


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("stage", choices=["fetch", "history", "crawl", "commoncrawl", "curated", "build", "all"])
    parser.add_argument("--crawl-focus", action="store_true", help="crawl banking / government style domains")
    parser.add_argument("--crawl-domains", type=int, default=9000, help="domains sampled per crawl run")
    parser.add_argument("--crawl-seed", type=int, default=SEED, help="sampling seed for an extra crawl run")
    args = parser.parse_args()
    stages = ["fetch", "history", "crawl", "commoncrawl", "curated", "build"] if args.stage == "all" else [args.stage]
    for stage in stages:
        print(f"== {stage}", flush=True)
        if stage == "crawl":
            crawl(n_domains=args.crawl_domains, seed=args.crawl_seed, focus=args.crawl_focus)
        else:
            globals()[stage]()


if __name__ == "__main__":
    main()
