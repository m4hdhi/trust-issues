"""Command-line batch scanner: `trust-issues scan urls.csv -o results.csv [--deep]`."""
from __future__ import annotations

import argparse
import asyncio
import csv
import sys
from pathlib import Path

from . import batch, db
from .detectors import feeds
from .detectors.render import sandbox
from .http import close


async def _scan_file(path: Path, out: Path, deep: bool, concurrency: int, use_feeds: bool) -> None:
    db.init_db()
    if use_feeds:
        await feeds.refresh()
    items = batch.parse_upload(path.read_bytes())
    sem = asyncio.Semaphore(concurrency)
    rows = []
    done = 0
    tasks = [asyncio.create_task(batch.scan_one(u, lbl, deep, sem)) for u, lbl in items]
    for fut in asyncio.as_completed(tasks):
        rows.append(await fut)
        done += 1
        if done % 25 == 0 or done == len(tasks):
            print(f"\r{done}/{len(tasks)} scanned", end="", file=sys.stderr, flush=True)
    print(file=sys.stderr)
    with out.open("w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=["url", "label", "verdict", "score", "predicted", "brand", "reasons", "scan_id"], extrasaction="ignore")
        w.writeheader()
        w.writerows(rows)
    metrics = batch.metrics(rows)
    if metrics:
        print("precision={precision} recall={recall} f1={f1} accuracy={accuracy}  tp={tp} fp={fp} tn={tn} fn={fn}".format(**metrics))
    print(f"results written to {out}")
    await sandbox.close()
    await close()


async def _capture_refs(only: list[str]) -> None:
    from io import BytesIO

    from PIL import Image

    from .registry import BRANDS_DIR, get_registry

    out_dir = BRANDS_DIR / "refs"
    out_dir.mkdir(exist_ok=True)
    reg = get_registry()
    for brand in reg.brands.values():
        if only and brand.id not in only:
            continue
        domain = brand.official_domains[0]
        cap = await sandbox.capture(f"https://{domain}/", "uae_mobile", f"ref_{brand.id}", 30)
        if not cap.screenshot_path:
            cap = await sandbox.capture(f"https://www.{domain}/", "uae_mobile", f"ref_{brand.id}", 30)
        if not cap.screenshot_path:
            print(f"{brand.id}: failed ({cap.error})")
            continue
        img = Image.open(cap.screenshot_path).convert("RGB")
        img = img.crop((0, 0, img.width, min(img.height, img.width * 2)))
        img.thumbnail((480, 960))
        buf = BytesIO()
        img.save(buf, format="JPEG", quality=70, optimize=True)
        (out_dir / f"{brand.id}.jpg").write_bytes(buf.getvalue())
        print(f"{brand.id}: {domain} ok")
    await sandbox.close()
    await close()


def main() -> None:
    ap = argparse.ArgumentParser(prog="trust-issues", description="Trust Issues | أزمة ثقة: scam link scanner")
    sub = ap.add_subparsers(dest="cmd", required=True)
    sc = sub.add_parser("scan", help="scan a CSV / text file of URLs (optional label column for metrics)")
    sc.add_argument("file", type=Path)
    sc.add_argument("-o", "--output", type=Path, default=Path("results.csv"))
    sc.add_argument("--deep", action="store_true", help="re-check gray-zone URLs with the sandbox and AI judges")
    sc.add_argument("-j", "--concurrency", type=int, default=24)
    sc.add_argument("--no-feeds", action="store_true", help="ignore live phishing feeds (measures generalisation to unseen scams)")
    rf = sub.add_parser("refs", help="capture reference screenshots of official brand websites")
    rf.add_argument("brands", nargs="*")
    args = ap.parse_args()
    if args.cmd == "refs":
        asyncio.run(_capture_refs(args.brands))
    else:
        asyncio.run(_scan_file(args.file, args.output, args.deep, args.concurrency, not args.no_feeds))


if __name__ == "__main__":
    main()
