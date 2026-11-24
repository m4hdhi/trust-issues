"""Police evidence pack (PDF) with chain-of-custody hashes, WHOIS, hosting, screenshots and bilingual reasons."""
from __future__ import annotations

import io
from pathlib import Path
from typing import Any

from reportlab.lib import colors
from reportlab.lib.enums import TA_LEFT, TA_RIGHT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.units import mm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import Image, Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle

from ..config import get_settings
from .text import FONT_BOLD, FONT_REGULAR, defang, shape

pdfmetrics.registerFont(TTFont("Plex", str(FONT_REGULAR)))
pdfmetrics.registerFont(TTFont("PlexBold", str(FONT_BOLD)))

NAVY = colors.HexColor("#0B1220")
TEAL = colors.HexColor("#14B8A6")
RED = colors.HexColor("#DC2626")
AMBER = colors.HexColor("#D97706")
GREEN = colors.HexColor("#059669")
GREY = colors.HexColor("#64748B")

S_TITLE = ParagraphStyle("t", fontName="PlexBold", fontSize=17, leading=22, textColor=NAVY)
S_H = ParagraphStyle("h", fontName="PlexBold", fontSize=11.5, leading=15, textColor=NAVY, spaceBefore=8, spaceAfter=4)
S_B = ParagraphStyle("b", fontName="Plex", fontSize=8.8, leading=12, textColor=colors.black, alignment=TA_LEFT)
S_AR = ParagraphStyle("ar", parent=S_B, alignment=TA_RIGHT)
S_SMALL = ParagraphStyle("s", fontName="Plex", fontSize=7.2, leading=9.5, textColor=GREY)


def _p(text: Any, style: ParagraphStyle = S_B) -> Paragraph:
    t = shape(str(text if text is not None else "n/a"))
    return Paragraph(t.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;"), style)


def _kv(rows: list[tuple[str, Any]]) -> Table:
    t = Table([[_p(k, S_SMALL), _p(v)] for k, v in rows], colWidths=[42 * mm, 128 * mm])
    t.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LINEBELOW", (0, 0), (-1, -1), 0.25, colors.HexColor("#E2E8F0")),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
        ("TOPPADDING", (0, 0), (-1, -1), 3),
    ]))
    return t


def build(r: dict[str, Any]) -> bytes:
    buf = io.BytesIO()
    doc = SimpleDocTemplate(buf, pagesize=A4, leftMargin=18 * mm, rightMargin=18 * mm, topMargin=16 * mm, bottomMargin=16 * mm,
                            title=f"Evidence {r['id']}", author="Trust Issues | أزمة ثقة")
    verdict_color = {"scam": RED, "suspicious": AMBER, "safe": GREEN}.get(r["verdict"], GREY)
    ev = r.get("evidence", {})
    di = r.get("domain_intel", {})
    story: list[Any] = []

    head = Table([[
        _p("Trust Issues | أزمة ثقة · Digital Evidence Pack", S_TITLE),
        _p(f"{r['verdict'].upper()}  {r['score']}/100", ParagraphStyle("v", parent=S_TITLE, textColor=verdict_color, alignment=TA_RIGHT)),
    ]], colWidths=[120 * mm, 50 * mm])
    story += [head, Spacer(1, 2 * mm), _p("حزمة الأدلة الرقمية · للاستخدام من قبل جهات إنفاذ القانون", S_AR), Spacer(1, 3 * mm)]
    story += [_p(r["headline"]["en"], S_H), _p(r["headline"]["ar"], ParagraphStyle("har", parent=S_H, alignment=TA_RIGHT))]

    story.append(_p("1. Case identification / تعريف الحالة", S_H))
    brand = r.get("brand") or {}
    story.append(_kv([
        ("Case / scan ID", r["id"]),
        ("Submitted URL (defanged)", defang(r["url"])),
        ("Final URL (defanged)", defang(r.get("final_url") or r["url"])),
        ("Registrable domain", r["domain"]),
        ("Impersonated brand", f"{brand.get('name_en', 'n/a')} / {brand.get('name_ar', 'n/a')}" if brand else "n/a"),
        ("Official domains of brand", ", ".join(brand.get("official_domains", [])) if brand else "n/a"),
        ("Captured (UTC)", ev.get("captured_at_utc")),
        ("Captured (GST)", ev.get("captured_at_gst")),
    ]))

    story.append(_p("2. Why it was flagged / أسباب التصنيف", S_H))
    rows = [[_p("Weight", S_SMALL), _p("Finding", S_SMALL), _p("النتيجة", ParagraphStyle("x", parent=S_SMALL, alignment=TA_RIGHT))]]
    for sgl in r.get("signals", [])[:16]:
        rows.append([_p(f"{sgl['weight']:+.1f}"), _p(sgl["title"]["en"]), _p(sgl["title"]["ar"], S_AR)])
    t = Table(rows, colWidths=[14 * mm, 80 * mm, 76 * mm])
    t.setStyle(TableStyle([("LINEBELOW", (0, 0), (-1, -1), 0.25, colors.HexColor("#E2E8F0")), ("VALIGN", (0, 0), (-1, -1), "TOP")]))
    story.append(t)

    for op in r.get("ai", []):
        story.append(_p(f"AI judge · {op['provider']} ({op['model']}): {op['verdict']} · {int(op['confidence'] * 100)}%", S_B))
        for en in op.get("reasons", {}).get("en", []):
            story.append(_p(f"• {en}", S_B))
        for ar in op.get("reasons", {}).get("ar", []):
            story.append(_p(f"{ar} •", S_AR))

    story.append(_p("3. Registration & hosting / التسجيل والاستضافة", S_H))
    story.append(_kv([
        ("Registered", di.get("registered")),
        ("Domain age (days)", di.get("age_days")),
        ("Registrar", di.get("registrar")),
        ("Registrar abuse contact", di.get("registrar_abuse_email")),
        ("Name servers", ", ".join(di.get("nameservers") or [])),
        ("IP addresses", ", ".join(di.get("ips") or [])),
        ("ASN / network", f"{di.get('asn') or 'n/a'} {di.get('as_org') or ''}"),
        ("Hosting country", di.get("country")),
        ("Hosting abuse contact", di.get("host_abuse_email")),
        ("TLS issuer / issued", f"{di.get('tls_issuer') or 'n/a'} / {di.get('tls_not_before') or 'n/a'}"),
        ("Certificates in CT logs", di.get("ct_cert_count")),
    ]))

    chain = r.get("redirect_chain") or []
    if chain:
        story.append(_p("4. Redirect chain / سلسلة إعادة التوجيه", S_H))
        story.append(_kv([(f"Hop {i + 1} ({h.get('status') or h.get('kind')})", defang(h["url"])) for i, h in enumerate(chain[:10])]))

    leads = r.get("exfil") or []
    if leads:
        story.append(_p("5. Data exfiltration leads / وجهات تسريب البيانات", S_H))
        story.append(_kv([(x["kind"], x["value"]) for x in leads[:12]]))

    shot = (r.get("page") or {}).get("screenshot_url")
    if shot:
        path = get_settings().media_dir / shot.replace("/media/", "")
        if Path(path).exists():
            story.append(_p("6. Screenshot (UAE mobile persona) / لقطة الشاشة", S_H))
            img = Image(str(path))
            ratio = img.imageHeight / img.imageWidth
            w = 62 * mm
            img.drawWidth, img.drawHeight = w, min(w * ratio, 150 * mm)
            story.append(img)

    story.append(_p("7. Integrity / سلامة الأدلة", S_H))
    integ = [("Result SHA-256", ev.get("result_sha256"))]
    integ += [(f"Screenshot SHA-256 ({k})", v) for k, v in (ev.get("screenshot_sha256") or {}).items() if v]
    story.append(_kv(integ))
    story.append(Spacer(1, 4 * mm))
    story.append(_p("Generated automatically by Trust Issues | أزمة ثقة. The page was opened in an isolated sandbox; no data was submitted to it. "
                    "Hashes allow verification that the exported artefacts were not altered after capture.", S_SMALL))
    doc.build(story)
    return buf.getvalue()
