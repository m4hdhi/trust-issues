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
from reportlab.platypus import BaseDocTemplate, CondPageBreak, Frame, Image, PageTemplate, Paragraph, Spacer, Table, TableStyle

from ..config import get_settings
from .text import FONT_BOLD, FONT_REGULAR, defang, shape

pdfmetrics.registerFont(TTFont("Plex", str(FONT_REGULAR)))
pdfmetrics.registerFont(TTFont("PlexBold", str(FONT_BOLD)))

NAVY = colors.HexColor("#15143C")
VIOLET = colors.HexColor("#5A48F2")
MAGENTA = colors.HexColor("#C64FD8")
LAVENDER = colors.HexColor("#F2F1FC")
LINE = colors.HexColor("#DBD8F5")
RED = colors.HexColor("#E2434B")
AMBER = colors.HexColor("#D27706")
GREEN = colors.HexColor("#0C9C6C")
GREY = colors.HexColor("#7775A0")
SYMBOL = Path(__file__).with_name("symbol-white.png")

S_TITLE = ParagraphStyle("t", fontName="PlexBold", fontSize=17, leading=22, textColor=NAVY)
S_H = ParagraphStyle("h", fontName="PlexBold", fontSize=11.5, leading=15, textColor=NAVY, spaceBefore=10, spaceAfter=5)
S_B = ParagraphStyle("b", fontName="Plex", fontSize=8.8, leading=12, textColor=NAVY, alignment=TA_LEFT)
S_AR = ParagraphStyle("ar", parent=S_B, alignment=TA_RIGHT)
S_SMALL = ParagraphStyle("s", fontName="PlexBold", fontSize=7.2, leading=9.5, textColor=GREY)
S_HEAD = ParagraphStyle("hl", fontName="PlexBold", fontSize=13, leading=17, textColor=NAVY)
BAND = 30 * mm


def _p(text: Any, style: ParagraphStyle = S_B) -> Paragraph:
    t = shape(str(text if text is not None else "n/a"))
    return Paragraph(t.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;"), style)


def _section(n: int, title: str) -> Table:
    """A numbered violet chip and the section title, as on the website's evidence cards."""
    chip = Table([[_p(str(n), ParagraphStyle("n", fontName="PlexBold", fontSize=8.5, leading=10, textColor=colors.white, alignment=1))]], colWidths=[6.5 * mm], rowHeights=[6.5 * mm])
    chip.setStyle(TableStyle([("BACKGROUND", (0, 0), (-1, -1), VIOLET), ("ROUNDEDCORNERS", [9, 9, 9, 9]), ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                              ("LEFTPADDING", (0, 0), (-1, -1), 0), ("RIGHTPADDING", (0, 0), (-1, -1), 0), ("TOPPADDING", (0, 0), (-1, -1), 0), ("BOTTOMPADDING", (0, 0), (-1, -1), 1)]))
    t = Table([[chip, _p(title, S_H)]], colWidths=[9 * mm, 161 * mm])
    t.setStyle(TableStyle([("VALIGN", (0, 0), (-1, -1), "MIDDLE"), ("LEFTPADDING", (0, 0), (-1, -1), 0), ("TOPPADDING", (0, 0), (-1, -1), 7), ("BOTTOMPADDING", (0, 0), (-1, -1), 2)]))
    return t


def _panel(t: Table) -> Table:
    """Rows on a rounded lavender panel with alternating white bands."""
    n = len(t._cellvalues)
    t.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("ROWBACKGROUNDS", (0, 0), (-1, -1), [LAVENDER, colors.white]),
        ("BOX", (0, 0), (-1, -1), 0.6, LINE),
        ("ROUNDEDCORNERS", [6, 6, 6, 6]),
        ("LEFTPADDING", (0, 0), (-1, -1), 7), ("RIGHTPADDING", (0, 0), (-1, -1), 7),
        ("TOPPADDING", (0, 0), (-1, -1), 4), ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
    ] + ([("LINEBELOW", (0, 0), (-1, n - 2), 0.25, LINE)] if n > 1 else [])))
    return t


def _kv(rows: list[tuple[str, Any]]) -> Table:
    return _panel(Table([[_p(k, S_SMALL), _p(v)] for k, v in rows], colWidths=[42 * mm, 128 * mm]))


def _decorate(case_id: str):
    def draw(canvas, doc) -> None:
        w, h = A4
        first = doc.page == 1
        band = BAND if first else 9 * mm
        canvas.saveState()
        clip = canvas.beginPath()
        clip.rect(0, h - band, w, band)
        canvas.clipPath(clip, stroke=0, fill=0)
        canvas.linearGradient(0, h, w, h - band, (VIOLET, MAGENTA))
        canvas.restoreState()
        canvas.saveState()
        canvas.setFillColor(colors.white)
        if first:
            if SYMBOL.exists():
                canvas.drawImage(str(SYMBOL), 18 * mm, h - 22 * mm, width=13 * mm, height=13 * mm, mask="auto", preserveAspectRatio=True)
            canvas.setFont("PlexBold", 17); canvas.drawString(35 * mm, h - 15.5 * mm, "\u201cTrust\u201d Issues")
            canvas.setFont("Plex", 9.5); canvas.drawString(35 * mm, h - 21 * mm, "Digital evidence pack")
            canvas.setFont("PlexBold", 11); canvas.drawRightString(w - 18 * mm, h - 15.5 * mm, shape("أزمة ثقة"))
            canvas.setFont("Plex", 9.5); canvas.drawRightString(w - 18 * mm, h - 21 * mm, shape("حزمة الأدلة الرقمية"))
        else:
            canvas.setFont("PlexBold", 8); canvas.drawString(18 * mm, h - 6 * mm, "\u201cTrust\u201d Issues  ·  Digital evidence pack")
        canvas.setFillColor(GREY); canvas.setFont("Plex", 7.2)
        canvas.drawString(18 * mm, 9 * mm, f"Case {case_id}")
        canvas.drawRightString(w - 18 * mm, 9 * mm, f"Page {doc.page}")
        canvas.setStrokeColor(LINE); canvas.setLineWidth(0.5); canvas.line(18 * mm, 12.5 * mm, w - 18 * mm, 12.5 * mm)
        canvas.restoreState()
    return draw


def build(r: dict[str, Any]) -> bytes:
    buf = io.BytesIO()
    w, h = A4
    deco = _decorate(r["id"])
    doc = BaseDocTemplate(buf, pagesize=A4, title=f"Evidence {r['id']}", author="Trust Issues | أزمة ثقة")
    side, foot = 18 * mm, 17 * mm
    doc.addPageTemplates([
        PageTemplate("first", [Frame(side, foot, w - 2 * side, h - foot - BAND - 6 * mm, leftPadding=0, rightPadding=0, topPadding=0, bottomPadding=0)], onPage=deco, autoNextPageTemplate="later"),
        PageTemplate("later", [Frame(side, foot, w - 2 * side, h - foot - 16 * mm, leftPadding=0, rightPadding=0, topPadding=0, bottomPadding=0)], onPage=deco),
    ])
    verdict_color = {"scam": RED, "suspicious": AMBER, "safe": GREEN}.get(r["verdict"], GREY)
    ev = r.get("evidence", {})
    di = r.get("domain_intel", {})
    story: list[Any] = []

    pill = Table([[_p(f"{r['verdict'].upper()}  {r['score']}/100", ParagraphStyle("v", fontName="PlexBold", fontSize=12, leading=15, textColor=colors.white, alignment=1))]], colWidths=[44 * mm])
    pill.setStyle(TableStyle([("BACKGROUND", (0, 0), (-1, -1), verdict_color), ("ROUNDEDCORNERS", [10, 10, 10, 10]), ("TOPPADDING", (0, 0), (-1, -1), 5), ("BOTTOMPADDING", (0, 0), (-1, -1), 6)]))
    head = Table([[[_p(r["headline"]["en"], S_HEAD), Spacer(1, 1.5 * mm), _p(r["headline"]["ar"], ParagraphStyle("har", parent=S_HEAD, fontSize=11.5))], pill]], colWidths=[118 * mm, 52 * mm])
    head.setStyle(TableStyle([("BACKGROUND", (0, 0), (-1, -1), LAVENDER), ("ROUNDEDCORNERS", [10, 10, 10, 10]), ("VALIGN", (0, 0), (-1, -1), "MIDDLE"), ("ALIGN", (1, 0), (1, 0), "RIGHT"),
                              ("LEFTPADDING", (0, 0), (-1, -1), 10), ("RIGHTPADDING", (0, 0), (-1, -1), 10), ("TOPPADDING", (0, 0), (-1, -1), 9), ("BOTTOMPADDING", (0, 0), (-1, -1), 9)]))
    story += [head, Spacer(1, 2 * mm), _p("For use by law enforcement · للاستخدام من قبل جهات إنفاذ القانون", S_SMALL), Spacer(1, 1 * mm)]

    story += [CondPageBreak(30 * mm), _section(1, "Case identification / تعريف الحالة")]
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

    story += [CondPageBreak(30 * mm), _section(2, "Why it was flagged / أسباب التصنيف")]
    rows = [[_p("Weight", S_SMALL), _p("Finding", S_SMALL), _p("النتيجة", ParagraphStyle("x", parent=S_SMALL, alignment=TA_RIGHT))]]
    for sgl in r.get("signals", [])[:16]:
        rows.append([_p(f"{sgl['weight']:+.1f}"), _p(sgl["title"]["en"]), _p(sgl["title"]["ar"], S_AR)])
    story.append(_panel(Table(rows, colWidths=[14 * mm, 80 * mm, 76 * mm])))

    for op in r.get("ai", []):
        story.append(Spacer(1, 2 * mm))
        story.append(_p(f"AI judge · {op['provider']} ({op['model']}): {op['verdict']} · {int(op['confidence'] * 100)}%", ParagraphStyle("aj", parent=S_B, fontName="PlexBold", textColor=VIOLET)))
        for en in op.get("reasons", {}).get("en", []):
            story.append(_p(f"• {en}", S_B))
        for ar in op.get("reasons", {}).get("ar", []):
            story.append(_p(f"{ar} •", S_AR))

    story += [CondPageBreak(30 * mm), _section(3, "Registration & hosting / التسجيل والاستضافة")]
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
        story += [CondPageBreak(30 * mm), _section(4, "Redirect chain / سلسلة إعادة التوجيه")]
        story.append(_kv([(f"Hop {i + 1} ({h.get('status') or h.get('kind')})", defang(h["url"])) for i, h in enumerate(chain[:10])]))

    leads = r.get("exfil") or []
    if leads:
        story += [CondPageBreak(30 * mm), _section(5, "Data exfiltration leads / وجهات تسريب البيانات")]
        story.append(_kv([(x["kind"], x["value"]) for x in leads[:12]]))

    shot = (r.get("page") or {}).get("screenshot_url")
    if shot:
        path = get_settings().media_dir / shot.replace("/media/", "")
        if Path(path).exists():
            story += [CondPageBreak(30 * mm), _section(6, "Screenshot (UAE mobile persona) / لقطة الشاشة")]
            img = Image(str(path))
            ratio = img.imageHeight / img.imageWidth
            w = 62 * mm
            img.drawWidth, img.drawHeight = w, min(w * ratio, 150 * mm)
            story.append(img)

    story += [CondPageBreak(30 * mm), _section(7, "Integrity / سلامة الأدلة")]
    integ = [("Result SHA-256", ev.get("result_sha256"))]
    integ += [(f"Screenshot SHA-256 ({k})", v) for k, v in (ev.get("screenshot_sha256") or {}).items() if v]
    story.append(_kv(integ))
    story.append(Spacer(1, 4 * mm))
    story.append(_p("Generated automatically by Trust Issues | أزمة ثقة. The page was opened in an isolated sandbox; no data was submitted to it. "
                    "Hashes allow verification that the exported artefacts were not altered after capture.", S_SMALL))
    doc.build(story)
    return buf.getvalue()
