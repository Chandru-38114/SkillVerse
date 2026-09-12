"""
email_service.py — Production email OTP delivery via Resend API.

Environment variables (set in Render dashboard):
  RESEND_API_KEY       — Resend API key (re_xxx...)
  EMAIL_FROM_ADDRESS   — Verified sender address, e.g. noreply@skillverse.app
  EMAIL_FROM_NAME      — Display name, e.g. SkillVerse
  ENVIRONMENT          — "production" | "development" (default: development)

NEVER log the OTP or include it in error responses.
"""

import os
import requests as http_requests

RESEND_API_KEY     = os.getenv("RESEND_API_KEY", "")
EMAIL_FROM_ADDRESS = os.getenv("EMAIL_FROM_ADDRESS", "noreply@skillverse.app")
EMAIL_FROM_NAME    = os.getenv("EMAIL_FROM_NAME", "SkillVerse")
ENVIRONMENT        = os.getenv("ENVIRONMENT", "development").lower()


def _build_email_html(otp: str, purpose: str, expiry_minutes: int = 10) -> tuple[str, str]:
    """Return (subject, html_body) for an OTP email."""
    purpose_labels = {
        "email_verification": "Email Verification",
        "mobile_verification": "Mobile Verification",
        "password_reset": "Password Reset",
    }
    label = purpose_labels.get(purpose, "Verification")

    subject = f"SkillVerse — Your {label} Code"

    html = f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>{subject}</title>
</head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:40px 16px;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">
          <!-- Header -->
          <tr>
            <td style="background:#2d6a4f;padding:28px 32px;text-align:center;">
              <p style="margin:0;color:#ffffff;font-size:22px;font-weight:700;letter-spacing:-0.5px;">
                Skill<span style="color:#95d5b2;">Verse</span>
              </p>
              <p style="margin:6px 0 0;color:rgba(255,255,255,0.75);font-size:13px;">{label}</p>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="padding:36px 32px 28px;">
              <p style="margin:0 0 20px;color:#18181b;font-size:15px;line-height:1.6;">
                Here is your <strong>{label}</strong> code for SkillVerse:
              </p>
              <!-- OTP box -->
              <div style="background:#f0fdf4;border:2px solid #86efac;border-radius:10px;padding:24px;text-align:center;margin:0 0 24px;">
                <span style="display:block;font-size:38px;font-weight:800;letter-spacing:10px;color:#166534;font-family:'Courier New',Courier,monospace;">
                  {otp}
                </span>
              </div>
              <p style="margin:0 0 10px;color:#52525b;font-size:13px;line-height:1.6;">
                ⏱ This code expires in <strong>{expiry_minutes} minutes</strong>.
              </p>
              <p style="margin:0;color:#52525b;font-size:13px;line-height:1.6;">
                🔒 If you did not request this code, you can safely ignore this email.
                Your account remains secure.
              </p>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="background:#fafafa;border-top:1px solid #e4e4e7;padding:18px 32px;text-align:center;">
              <p style="margin:0;color:#a1a1aa;font-size:11px;">
                This is an automated message from SkillVerse. Do not reply to this email.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>"""

    return subject, html


def send_otp_email(to_email: str, otp: str, purpose: str = "email_verification") -> bool:
    """
    Send an OTP email via Resend API.

    Returns True  — email was dispatched successfully.
    Returns False — credentials not configured (development fallback allowed).
    Raises        — on API/network error in production.

    IMPORTANT: The OTP value is NEVER logged or returned to callers.
    """
    if not RESEND_API_KEY:
        if ENVIRONMENT == "production":
            raise RuntimeError(
                "RESEND_API_KEY is not set. Email delivery is not configured. "
                "Set RESEND_API_KEY in your Render environment variables."
            )
        # Development: log a placeholder, never log the OTP itself
        print(f"[DEV EMAIL] Would send {purpose} OTP to {to_email} — configure RESEND_API_KEY for real delivery.")
        return False

    subject, html_body = _build_email_html(otp, purpose)

    payload = {
        "from": f"{EMAIL_FROM_NAME} <{EMAIL_FROM_ADDRESS}>",
        "to": [to_email],
        "subject": subject,
        "html": html_body,
    }

    try:
        response = http_requests.post(
            "https://api.resend.com/emails",
            headers={
                "Authorization": f"Bearer {RESEND_API_KEY}",
                "Content-Type": "application/json",
            },
            json=payload,
            timeout=10,
        )
        if response.status_code in (200, 201):
            return True
        # Don't log response body — it may echo back request details
        raise RuntimeError(
            f"Resend API returned HTTP {response.status_code}. "
            "Check RESEND_API_KEY and EMAIL_FROM_ADDRESS configuration."
        )
    except http_requests.RequestException as exc:
        raise RuntimeError(f"Email delivery failed (network error): {exc}") from exc
