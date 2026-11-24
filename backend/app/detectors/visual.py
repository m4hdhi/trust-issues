"""Visual brand matching: favicon perceptual hashes vs. official UAE brand assets."""
from __future__ import annotations

from dataclasses import dataclass
from functools import lru_cache

import imagehash
from PIL import Image

from ..registry import Brand, get_registry


@dataclass
class VisualMatch:
    brand: Brand
    distance: int
    method: str


@lru_cache
def _brand_hashes() -> dict[str, imagehash.ImageHash]:
    out: dict[str, imagehash.ImageHash] = {}
    for b in get_registry().brands.values():
        if b.logo_path.exists():
            try:
                out[b.id] = imagehash.phash(Image.open(b.logo_path).convert("RGBA").convert("RGB"))
            except Exception:
                continue
    return out


def favicon_match(phash_hex: str | None, max_distance: int = 8) -> VisualMatch | None:
    if not phash_hex:
        return None
    try:
        h = imagehash.hex_to_hash(phash_hex)
    except ValueError:
        return None
    best: tuple[str, int] | None = None
    for bid, bh in _brand_hashes().items():
        d = h - bh
        if best is None or d < best[1]:
            best = (bid, d)
    if best and best[1] <= max_distance:
        return VisualMatch(brand=get_registry().brands[best[0]], distance=best[1], method="favicon")
    return None
