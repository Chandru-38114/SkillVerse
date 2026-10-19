"""
email_service.py — sends the one-time codes (forgot password, verify email).

With BREVO_API_KEY and EMAIL_FROM set, codes are emailed through Brevo's free
email API (about 300 emails a day). EMAIL_FROM is a sender address you verified
in Brevo, for example a Gmail made for SkillVerse; no own domain is needed.

Without them (local development), the code is only printed in the server log.
The code itself is never printed when real email is set up.
"""
import logging
import os

import requests

logger = logging.getLogger(__name__)

BREVO_URL = "https://api.brevo.com/v3/smtp/email"


class EmailError(Exception):
    """The email could not be sent."""


def email_configured() -> bool:
    return bool(os.getenv("BREVO_API_KEY") and os.getenv("EMAIL_FROM"))


def _message(otp: str, purpose: str) -> tuple:
    if purpose == "password_reset":
        subject = "Your SkillVerse password reset code"
        line = "Use this code to reset your SkillVerse password:"
    else:
        subject = "Your SkillVerse verification code"
        line = "Use this code to verify your email on SkillVerse:"
    text = f"{line}\n\n{otp}\n\nIt expires in 10 minutes. If you didn't ask for it, you can ignore this email."
    html = (
        "<div style=\"font-family:Arial,sans-serif;color:#29251F;max-width:480px\">"
        "<h2 style=\"margin:0 0 12px\">SkillVerse</h2>"
        f"<p>{line}</p>"
        f"<p style=\"font-size:32px;font-weight:bold;letter-spacing:6px;margin:16px 0\">{otp}</p>"
        "<p>It expires in 10 minutes. If you didn't ask for it, you can ignore this email.</p>"
        "</div>"
    )
    return subject, text, html


def send_otp_email(to_email: str, otp: str, purpose: str = "email_verification") -> bool:
    """Send the code. Returns True when sent (or logged in development).
    Raises EmailError when real email is set up but sending failed."""
    if not email_configured():
        label = "Password reset OTP" if purpose == "password_reset" else "Email OTP"
        print(f"[DEV OTP] {label} for {to_email}: {otp}")
        return True

    subject, text, html = _message(otp, purpose)
    payload = {
        "sender": {"name": os.getenv("EMAIL_FROM_NAME", "SkillVerse"), "email": os.getenv("EMAIL_FROM")},
        "to": [{"email": to_email}],
        "subject": subject,
        "textContent": text,
        "htmlContent": html,
    }
    try:
        r = requests.post(BREVO_URL, json=payload, timeout=15,
                          headers={"api-key": os.getenv("BREVO_API_KEY"), "accept": "application/json"})
    except requests.RequestException as err:
        logger.error("[email] Brevo unreachable: %s", type(err).__name__)
        raise EmailError("email service unreachable") from err
    if r.status_code >= 300:
        # Brevo's error text never contains the code or the key.
        logger.error("[email] Brevo refused the email (%s): %s", r.status_code, r.text[:300])
        raise EmailError(f"email service answered {r.status_code}")
    logger.info("[email] %s code sent", purpose)
    return True
