from __future__ import annotations

import re
from pathlib import Path

import arabic_reshaper
from bidi.algorithm import get_display

FONT_DIR = Path(__file__).resolve().parent / "fonts"
FONT_REGULAR = FONT_DIR / "IBMPlexSansArabic-Regular.ttf"
FONT_BOLD = FONT_DIR / "IBMPlexSansArabic-Bold.ttf"

_ARABIC = re.compile(r"[؀-ۿ]")


def shape(text: str) -> str:
    """Return visually ordered text for renderers without complex-script shaping (ReportLab, Pillow)."""
    if not text or not _ARABIC.search(text):
        return text or ""
    return get_display(arabic_reshaper.reshape(text))


def defang(url: str) -> str:
    return url.replace("http", "hxxp").replace(".", "[.]")
