"""Emails the one-time sign-in code over SMTP (a Gmail app password works)."""
from __future__ import annotations

import smtplib
import ssl
from email.message import EmailMessage
from email.utils import formataddr

from ..config import get_settings


def configured() -> bool:
    s = get_settings()
    return bool(s.smtp_user and s.smtp_password)


def send_code(to: str, code: str) -> None:
    s = get_settings()
    msg = EmailMessage()
    msg["Subject"] = f"{code} is your Trust Issues code | رمز الدخول"
    msg["From"] = formataddr(("Trust Issues", s.mail_from or s.smtp_user))
    msg["To"] = to
    msg.set_content(
        f"Your Trust Issues sign-in code is {code}\n"
        "It works for 10 minutes. If you did not ask for it, you can ignore this email.\n\n"
        f"رمز الدخول إلى «أزمة ثقة» هو {code}\n"
        "صالح لمدة 10 دقائق. إذا لم تطلبه، تجاهل هذه الرسالة.\n"
    )
    msg.add_alternative(
        f"""<div style="font-family:-apple-system,Segoe UI,Arial,sans-serif;max-width:420px;margin:auto;padding:24px;color:#14161a">
<p style="margin:0 0 8px;font-size:15px">Your Trust Issues sign-in code</p>
<p style="margin:0 0 16px;font-size:36px;font-weight:700;letter-spacing:8px">{code}</p>
<p style="margin:0 0 24px;font-size:14px;color:#555">It works for 10 minutes. If you did not ask for it, you can ignore this email.</p>
<p dir="rtl" style="margin:0 0 8px;font-size:15px;text-align:right">رمز الدخول إلى «أزمة ثقة»</p>
<p dir="rtl" style="margin:0;font-size:14px;color:#555;text-align:right">صالح لمدة 10 دقائق. إذا لم تطلبه، تجاهل هذه الرسالة.</p>
</div>""",
        subtype="html",
    )
    password = s.smtp_password.replace(" ", "")
    if s.smtp_port == 465:
        with smtplib.SMTP_SSL(s.smtp_host, s.smtp_port, timeout=20, context=ssl.create_default_context()) as smtp:
            smtp.login(s.smtp_user, password)
            smtp.send_message(msg)
        return
    with smtplib.SMTP(s.smtp_host, s.smtp_port, timeout=20) as smtp:
        smtp.starttls(context=ssl.create_default_context())
        smtp.login(s.smtp_user, password)
        smtp.send_message(msg)
