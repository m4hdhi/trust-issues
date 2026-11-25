"""Checks beyond links: a phone number, and a file someone was sent.

Phone numbers are judged the way open tools such as PhoneInfoga and Numvo do it: parse with Google's libphonenumber
(country, carrier, line type), then look for reputation. Reputation here is our own: the verified helplines of UAE
brands, numbers printed on scam pages we already scanned, and reports from residents. Line type alone never marks a
number as a scam.

Files are triaged like pdfid and oletools: look for the features attackers rely on (auto-run scripts, embedded
programs, macros, a program dressed as a document), look the file's hash up on VirusTotal, and pull out the text and
links so the scam-message and link engines can judge them. The file is read in memory and never stored; only its
SHA-256 hash leaves the server.
"""
from __future__ import annotations

import hashlib
import io
import re
import zipfile
from datetime import datetime
from typing import Any

import phonenumbers
from phonenumbers import PhoneNumberFormat, PhoneNumberType, carrier, geocoder, shortnumberinfo
from sqlmodel import Field, SQLModel, select

from . import db
from .config import get_settings
from .detectors import intel
from .registry import get_registry
from .urlutil import find_urls

MAX_FILE = 10 * 1024 * 1024
TYPE_NAMES = {
    PhoneNumberType.MOBILE: ("Mobile", "هاتف متحرك"), PhoneNumberType.FIXED_LINE: ("Landline", "هاتف أرضي"),
    PhoneNumberType.FIXED_LINE_OR_MOBILE: ("Landline or mobile", "أرضي أو متحرك"), PhoneNumberType.TOLL_FREE: ("Toll-free", "رقم مجاني"),
    PhoneNumberType.SHARED_COST: ("Business line (600)", "خط أعمال (600)"), PhoneNumberType.PREMIUM_RATE: ("Premium rate", "رقم بتعرفة مميزة"),
    PhoneNumberType.VOIP: ("Internet number (VoIP)", "رقم عبر الإنترنت"),
}


class PhoneReport(SQLModel, table=True):
    id: int | None = Field(default=None, primary_key=True)
    number: str = Field(index=True)
    device_id: str | None = Field(default=None, index=True)
    note: str | None = None
    created_at: datetime = Field(default_factory=db.utcnow)


class CheckError(Exception):
    def __init__(self, status: int, message: str) -> None:
        super().__init__(message)
        self.status = status


def _finding(level: str, en: str, ar: str) -> dict[str, str]:
    return {"level": level, "en": en, "ar": ar}


def _parse(raw: str) -> phonenumbers.PhoneNumber:
    text = raw.strip()
    if len(re.sub(r"\D", "", text)) < 3 or len(text) > 40:
        raise CheckError(400, "enter a phone number")
    try:
        return phonenumbers.parse(text, "AE")
    except phonenumbers.NumberParseException:
        raise CheckError(400, "enter a phone number") from None


def _key(p: phonenumbers.PhoneNumber) -> str:
    return f"+{p.country_code}{p.national_number}"


def _seen_on_scam_pages(national: str) -> list[str]:
    """Domains of confirmed scam pages whose text or WhatsApp links carried this number."""
    if len(national) < 7:
        return []
    with db.session() as s:
        rows = s.exec(select(db.ScanRecord).where(db.ScanRecord.verdict == "scam", db.ScanRecord.result_json.contains(national)).limit(40)).all()
    hits: list[str] = []
    for r in rows:
        for lead in r.result().get("exfil") or []:
            if lead.get("kind") in ("phone", "whatsapp") and re.sub(r"\D", "", str(lead.get("value", ""))).endswith(national) and r.domain not in hits:
                hits.append(r.domain)
    return hits[:5]


def phone(raw: str) -> dict[str, Any]:
    p = _parse(raw)
    national = str(p.national_number)
    region = phonenumbers.region_code_for_number(p)
    short = shortnumberinfo.is_valid_short_number_for_region(p, "AE") and p.country_code == 971
    valid = phonenumbers.is_valid_number(p) or short
    kind = phonenumbers.number_type(p)
    key = _key(p)
    reg = get_registry()
    brand = reg.brand_for_phone(national) or reg.brand_for_phone("0" + national) or reg.brand_for_phone(key)
    with db.session() as s:
        reports = s.exec(select(PhoneReport).where(PhoneReport.number == key)).all()
    reporters = len({r.device_id or f"anon{r.id}" for r in reports})
    scam_sites = _seen_on_scam_pages(national)
    findings: list[dict[str, str]] = []
    verdict = "unknown"

    if brand:
        verdict = "official"
        findings.append(_finding("ok", f"This is a verified number of {brand.name_en}.", f"هذا رقم موثّق لـ{brand.name_ar}."))
        findings.append(_finding("info", "Scammers can fake the number shown on your screen. If the caller asks for a code, card details or a transfer, hang up and call this number yourself.",
                                 "يستطيع المحتالون تزوير الرقم الظاهر على شاشتك. إذا طلب المتصل رمزًا أو بيانات البطاقة أو تحويلًا، أنهِ المكالمة واتصل بهذا الرقم بنفسك."))
    elif shortnumberinfo.is_emergency_number(national, "AE") and p.country_code == 971:
        verdict = "official"
        findings.append(_finding("ok", "This is a UAE emergency number.", "هذا رقم طوارئ في الإمارات."))
    else:
        if scam_sites:
            verdict = "scam"
            shown = ", ".join(d.replace(".", "[.]") for d in scam_sites[:3])
            findings.append(_finding("danger", f"This number was printed on scam websites we caught: {shown}.", f"ظهر هذا الرقم في مواقع احتيال رصدناها: {shown}."))
        if reporters >= 2:
            verdict = "scam"
            findings.append(_finding("danger", f"{reporters} people reported this number as a scam.", f"أبلغ {reporters} أشخاص عن هذا الرقم كرقم احتيال."))
        elif reporters == 1:
            verdict = "suspicious" if verdict == "unknown" else verdict
            findings.append(_finding("warn", "One person reported this number as a scam.", "أبلغ شخص واحد عن هذا الرقم كرقم احتيال."))
        if not valid:
            verdict = "suspicious" if verdict == "unknown" else verdict
            findings.append(_finding("warn", "This is not a valid phone number. It may be mistyped or faked.", "هذا ليس رقم هاتف صحيحًا. قد يكون مكتوبًا خطأً أو مزوّرًا."))
        elif kind == PhoneNumberType.PREMIUM_RATE:
            verdict = "suspicious" if verdict == "unknown" else verdict
            findings.append(_finding("warn", "This is a premium-rate number: calling it back costs extra.", "هذا رقم بتعرفة مميزة: معاودة الاتصال به تكلّفك أكثر."))
        elif region and region != "AE":
            country = geocoder.country_name_for_number(p, "en") or region
            findings.append(_finding("warn", f"This number is from {country}. UAE banks, police and government call from UAE numbers.",
                                     f"هذا الرقم من خارج الإمارات ({country}). البنوك والشرطة والجهات الحكومية في الإمارات تتصل من أرقام إماراتية."))
        elif kind == PhoneNumberType.MOBILE:
            findings.append(_finding("info", "This is a personal mobile number. Banks, police and government do not call from mobile numbers to ask for codes or payments.",
                                     "هذا رقم هاتف متحرك شخصي. البنوك والشرطة والجهات الحكومية لا تتصل من أرقام متحركة لطلب رموز أو مدفوعات."))
        if verdict == "unknown":
            findings.append(_finding("info", "We have no reports about this number yet. That does not mean it is safe.", "لا توجد لدينا بلاغات عن هذا الرقم بعد. هذا لا يعني أنه آمن."))

    names = TYPE_NAMES.get(kind)
    return {
        "number": phonenumbers.format_number(p, PhoneNumberFormat.INTERNATIONAL) if valid and not short else raw.strip(),
        "key": key,
        "valid": valid,
        "verdict": verdict,
        "country": (geocoder.country_name_for_number(p, "en") or region or None) if valid else None,
        "carrier": carrier.name_for_number(p, "en") or None if valid else None,
        "line_type": {"en": names[0], "ar": names[1]} if names and valid else None,
        "brand": brand.ref().model_dump() if brand else None,
        "reports": reporters,
        "findings": findings,
    }


def report_phone(raw: str, device_id: str | None, note: str | None) -> dict[str, Any]:
    p = _parse(raw)
    key = _key(p)
    reg = get_registry()
    national = str(p.national_number)
    if reg.brand_for_phone(national) or reg.brand_for_phone("0" + national) or reg.brand_for_phone(key):
        raise CheckError(409, "this is a verified official number and cannot be reported")
    with db.session() as s:
        if device_id and s.exec(select(PhoneReport).where(PhoneReport.number == key, PhoneReport.device_id == device_id)).first():
            return phone(raw)
        s.add(PhoneReport(number=key, device_id=device_id, note=(note or "").strip()[:300] or None))
        s.commit()
    return phone(raw)


# ---------------------------------------------------------------------------------------------------------- files

PDF_RISKS = [
    (rb"/JavaScript|/JS\b", "danger", "The PDF contains a script that can run when it is opened.", "يحتوي ملف PDF على برنامج قد يعمل عند فتحه."),
    (rb"/Launch\b", "danger", "The PDF tries to start another program.", "يحاول ملف PDF تشغيل برنامج آخر."),
    (rb"/EmbeddedFile", "warn", "Another file is hidden inside the PDF.", "يوجد ملف آخر مخفي داخل ملف PDF."),
    (rb"/OpenAction|/AA\b", "warn", "The PDF does something by itself as soon as it opens.", "ينفّذ ملف PDF إجراءً تلقائيًا فور فتحه."),
]
PROGRAM_EXT = {"exe", "scr", "bat", "cmd", "com", "msi", "js", "vbs", "ps1", "jar", "apk", "dmg", "pkg", "lnk", "hta", "iso"}
DOC_EXT = {"pdf", "doc", "docx", "xls", "xlsx", "ppt", "pptx", "txt", "jpg", "jpeg", "png", "csv", "rtf"}


def _kind(data: bytes, name: str) -> tuple[str, str, str]:
    """(id, English, Arabic) from the file's first bytes, not from its name."""
    if data[:5] == b"%PDF-":
        return "pdf", "PDF document", "مستند PDF"
    if data[:2] == b"MZ":
        return "program", "Windows program", "برنامج ويندوز"
    if data[:4] == b"\x7fELF" or data[:4] in (b"\xcf\xfa\xed\xfe", b"\xfe\xed\xfa\xcf", b"\xca\xfe\xba\xbe"):
        return "program", "Program", "برنامج"
    if data[:8] == b"\xd0\xcf\x11\xe0\xa1\xb1\x1a\xe1":
        return "ole", "Older Office document", "مستند Office قديم"
    if data[:4] == b"PK\x03\x04":
        try:
            names = zipfile.ZipFile(io.BytesIO(data)).namelist()
        except zipfile.BadZipFile:
            names = []
        if "AndroidManifest.xml" in names:
            return "program", "Android app (APK)", "تطبيق أندرويد (APK)"
        if any(n.startswith(("word/", "xl/", "ppt/")) for n in names):
            return "office", "Office document", "مستند Office"
        return "zip", "Compressed folder (ZIP)", "مجلد مضغوط (ZIP)"
    if data[:3] == b"\xff\xd8\xff" or data[:8] == b"\x89PNG\r\n\x1a\n" or data[:4] in (b"GIF8", b"RIFF"):
        return "image", "Image", "صورة"
    head = data[:2000].lstrip().lower()
    if head.startswith((b"<!doctype html", b"<html")) or b"<html" in head:
        return "html", "Web page (HTML)", "صفحة ويب (HTML)"
    if data[:2] == b"#!":
        return "program", "Script", "برنامج نصي"
    try:
        data[:4000].decode("utf-8")
        return "text", "Text", "نص"
    except UnicodeDecodeError:
        return "other", "Unknown file type", "نوع ملف غير معروف"


def _pdf_text_and_links(data: bytes) -> tuple[str, list[str]]:
    links = [m.decode("latin-1", "ignore") for m in re.findall(rb"/URI\s*\(([^)]{4,500})\)", data)]
    text = ""
    try:
        from pypdf import PdfReader

        reader = PdfReader(io.BytesIO(data))
        for page in reader.pages[:15]:
            text += (page.extract_text() or "") + "\n"
            for annot in page.get("/Annots") or []:
                uri = (annot.get_object().get("/A") or {}).get("/URI")
                if uri:
                    links.append(str(uri))
    except Exception:
        pass
    return text, links


def _office_text_and_links(data: bytes) -> tuple[str, list[str], bool]:
    text, links, macros = "", [], False
    try:
        z = zipfile.ZipFile(io.BytesIO(data))
        for n in z.namelist()[:400]:
            low = n.lower()
            if low.endswith(("vbaproject.bin", ".bin")) and "vba" in low:
                macros = True
            if low.endswith(".xml") and low.startswith(("word/", "xl/sharedstrings", "ppt/slides/")) and z.getinfo(n).file_size < 4_000_000:
                text += re.sub(r"<[^>]+>", " ", z.read(n).decode("utf-8", "ignore")) + "\n"
            if low.endswith(".rels") and z.getinfo(n).file_size < 1_000_000:
                links += re.findall(r'Target="(https?://[^"]+)"', z.read(n).decode("utf-8", "ignore"))
    except Exception:
        pass
    return text, links, macros


async def file(name: str, data: bytes) -> dict[str, Any]:
    if not data:
        raise CheckError(400, "the file is empty")
    if len(data) > MAX_FILE:
        raise CheckError(413, "the file is larger than 10 MB")
    name = (name or "file").strip()[-120:]
    sha = hashlib.sha256(data).hexdigest()
    kind, kind_en, kind_ar = _kind(data, name)
    exts = [e.lower() for e in name.split(".")[1:]]
    findings: list[dict[str, str]] = []
    text, links = "", []
    score = 0

    if kind == "program":
        score += 70
        findings.append(_finding("danger", f"This is a program ({kind_en}), not a document. Do not open it unless you asked for it from someone you trust.",
                                 f"هذا برنامج ({kind_ar}) وليس مستندًا. لا تفتحه إلا إذا طلبته أنت من شخص تثق به."))
    if len(exts) >= 2 and exts[-1] in PROGRAM_EXT and exts[-2] in DOC_EXT:
        score += 25
        findings.append(_finding("danger", f"The name ends in .{exts[-2]}.{exts[-1]}: it is made to look like a document.", f"ينتهي الاسم بـ ‎.{exts[-2]}.{exts[-1]}‎: صُمّم ليبدو كمستند."))
    elif exts and exts[-1] in DOC_EXT and kind == "program":
        score += 25
        findings.append(_finding("danger", f"The name says .{exts[-1]} but the file is really a program.", f"الاسم يقول ‎.{exts[-1]}‎ لكن الملف في الحقيقة برنامج."))

    if kind == "pdf":
        for rx, level, en, ar in PDF_RISKS:
            if re.search(rx, data):
                score += 45 if level == "danger" else 15
                findings.append(_finding(level, en, ar))
        text, links = _pdf_text_and_links(data)
    elif kind == "office":
        text, links, macros = _office_text_and_links(data)
        if macros:
            score += 45
            findings.append(_finding("danger", "The document contains macros: small programs that can run when you click Enable content.", "يحتوي المستند على وحدات ماكرو: برامج صغيرة قد تعمل عند الضغط على «تمكين المحتوى»."))
    elif kind == "ole":
        if re.search(rb"VBA|Macros|_VBA_PROJECT", data):
            score += 35
            findings.append(_finding("warn", "This older Office file appears to contain macros, which can run programs.", "يبدو أن ملف Office القديم هذا يحتوي على وحدات ماكرو قد تشغّل برامج."))
        text = " ".join(m.decode("latin-1") for m in re.findall(rb"[\x20-\x7e]{8,}", data[:2_000_000]))
    elif kind == "html":
        raw = data.decode("utf-8", "ignore")
        text = re.sub(r"<(script|style)[^>]*>.*?</\1>", " ", raw, flags=re.S | re.I)
        links = re.findall(r'(?:href|action|src)\s*=\s*["\'](https?://[^"\']+)', raw, flags=re.I)
        text = re.sub(r"<[^>]+>", " ", text)
        if re.search(r'type\s*=\s*["\']?password', raw, re.I):
            score += 45
            findings.append(_finding("danger", "This web page file asks for a password. A sign-in page sent as an attachment is a common trick to steal logins.",
                                     "ملف صفحة الويب هذا يطلب كلمة مرور. صفحة تسجيل الدخول المرسلة كمرفق حيلة شائعة لسرقة بيانات الدخول."))
    elif kind == "zip":
        try:
            inner = zipfile.ZipFile(io.BytesIO(data)).namelist()
        except zipfile.BadZipFile:
            inner = []
        risky = [n for n in inner if n.rsplit(".", 1)[-1].lower() in PROGRAM_EXT]
        if risky:
            score += 50
            findings.append(_finding("danger", f"The ZIP contains a program: {risky[0][-60:]}", f"يحتوي الملف المضغوط على برنامج: {risky[0][-60:]}"))
    elif kind == "text":
        text = data[:400_000].decode("utf-8", "ignore")

    vt = None
    if get_settings().virustotal_key:
        try:
            stats = await intel._vt_stats(f"files/{sha}")
            if stats is not None:
                bad = int(stats.get("malicious", 0)) + int(stats.get("suspicious", 0))
                vt = {"flagged": bad, "engines": sum(int(v) for v in stats.values())}
                if bad >= 3:
                    score += 80
                    findings.append(_finding("danger", f"{bad} antivirus engines flag this exact file as harmful (VirusTotal).", f"{bad} من محركات مكافحة الفيروسات تصنّف هذا الملف نفسه كملف ضار (VirusTotal)."))
                elif bad:
                    score += 25
                    findings.append(_finding("warn", f"{bad} antivirus engine(s) flag this exact file (VirusTotal).", f"{bad} من محركات مكافحة الفيروسات يصنّف هذا الملف (VirusTotal)."))
                else:
                    findings.append(_finding("ok", f"No antivirus engine flags this exact file ({vt['engines']} checked on VirusTotal).", f"لا يصنّفه أي محرك مكافحة فيروسات ({vt['engines']} محركًا على VirusTotal)."))
            else:
                findings.append(_finding("info", "Antivirus services have never seen this exact file, so there is no virus verdict for it.", "لم تشاهد خدمات مكافحة الفيروسات هذا الملف من قبل، لذا لا يوجد حكم عليه."))
        except Exception:
            findings.append(_finding("info", "The antivirus lookup is busy right now. Try again in a minute for a virus verdict.", "خدمة فحص الفيروسات مشغولة الآن. حاول بعد دقيقة للحصول على نتيجة."))

    urls: list[str] = []
    for u in find_urls(" ".join(links) + " " + text[:200_000]):
        if u not in urls:
            urls.append(u)
    return {"name": name, "size": len(data), "sha256": sha, "kind": {"id": kind, "en": kind_en, "ar": kind_ar}, "score": min(100, score),
            "findings": findings, "virustotal": vt, "text": text[:6000].strip(), "urls": urls[:5]}
