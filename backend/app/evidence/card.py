"""Shareable bilingual warning card (PNG) to forward back into the WhatsApp group the scam came from."""
from __future__ import annotations

import io
import textwrap
from typing import Any

from PIL import Image, ImageDraw, ImageFont

from .text import FONT_BOLD, FONT_REGULAR, defang, shape

W, H = 1080, 1350
COLORS = {"scam": (220, 38, 38), "suspicious": (217, 119, 6), "safe": (5, 150, 105)}
NAVY = (11, 18, 32)
TEXT = (241, 245, 249)
MUTED = (148, 163, 184)


def _font(size: int, bold: bool = False) -> ImageFont.FreeTypeFont:
    return ImageFont.truetype(str(FONT_BOLD if bold else FONT_REGULAR), size)


def _center(draw: ImageDraw.ImageDraw, y: int, text: str, font, fill) -> int:
    t = shape(text)
    w = draw.textlength(t, font=font)
    draw.text(((W - w) / 2, y), t, font=font, fill=fill)
    return y + int(font.size * 1.35)


def _wrap_center(draw, y: int, text: str, font, fill, width: int) -> int:
    for line in textwrap.wrap(text, width=width):
        y = _center(draw, y, line, font, fill)
    return y


def _fit(draw: ImageDraw.ImageDraw, text: str, font, max_w: int) -> str:
    if draw.textlength(text, font=font) <= max_w:
        return text
    while text and draw.textlength(text + "…", font=font) > max_w:
        text = text[:-1]
    return text + "…"


def build(r: dict[str, Any]) -> bytes:
    accent = COLORS.get(r["verdict"], MUTED)
    img = Image.new("RGB", (W, H), NAVY)
    d = ImageDraw.Draw(img)
    d.rectangle([0, 0, W, 300], fill=accent)
    title_en = {"scam": "SCAM ALERT", "suspicious": "SUSPICIOUS LINK", "safe": "LINK CHECKED"}[r["verdict"]]
    title_ar = {"scam": "تحذير: احتيال", "suspicious": "رابط مشبوه", "safe": "تم فحص الرابط"}[r["verdict"]]
    y = _center(d, 60, title_ar, _font(84, True), (255, 255, 255))
    _center(d, y + 4, title_en, _font(56, True), (255, 255, 255))
    y = 350
    d.rounded_rectangle([70, y, W - 70, y + 120], radius=26, fill=(17, 26, 46), outline=accent, width=3)
    _center(d, y + 30, _fit(d, defang(r.get("final_url") or r["url"]), _font(40, True), W - 200), _font(40, True), TEXT)
    y += 170
    y = _wrap_center(d, y, r["headline"]["ar"], _font(52, True), TEXT, 30) + 10
    y = _wrap_center(d, y, r["headline"]["en"], _font(40), MUTED, 40) + 30
    d.ellipse([W / 2 - 120, y, W / 2 + 120, y + 240], outline=accent, width=16)
    _center(d, y + 62, str(r["score"]), _font(96, True), TEXT)
    y += 270
    _center(d, y, "درجة الخطورة · Risk score", _font(32), MUTED)
    brand = r.get("brand")
    if brand and r["verdict"] != "safe":
        y += 70
        _center(d, y, f"ينتحل صفة: {brand['name_ar']}", _font(40, True), accent)
        _center(d, y + 56, f"Impersonating: {brand['name_en']}", _font(32), MUTED)
    d.rectangle([0, H - 150, W, H], fill=(17, 26, 46))
    _center(d, H - 128, "لا تفتح الرابط ولا تُدخل أي بيانات · Do not open or enter any details", _font(30), TEXT)
    _center(d, H - 76, "Trust Issues | أزمة ثقة", _font(36, True), (20, 184, 166))
    out = io.BytesIO()
    img.save(out, format="PNG", optimize=True)
    return out.getvalue()
