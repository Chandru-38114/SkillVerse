"""
sms_service.py — Production SMS OTP delivery via Twilio API.

Environment variables (set in Render dashboard):
  TWILIO_ACCOUNT_SID   — Twilio Account SID (ACxxx...)
  TWILIO_AUTH_TOKEN    — Twilio Auth Token
  TWILIO_FROM_NUMBER   — Twilio verified phone number, e.g. +1234567890
  ENVIRONMENT          — "production" | "development" (default: development)

NEVER log the OTP or include it in error responses.
"""

import os
import requests as http_requests

TWILIO_ACCOUNT_SID = os.getenv("TWILIO_ACCOUNT_SID", "")
TWILIO_AUTH_TOKEN  = os.getenv("TWILIO_AUTH_TOKEN", "")
TWILIO_FROM_NUMBER = os.getenv("TWILIO_FROM_NUMBER", "")
ENVIRONMENT        = os.getenv("ENVIRONMENT", "development").lower()


def send_sms_otp(mobile_number: str, otp: str, purpose: str = "mobile_verification") -> bool:
    """
    Send an SMS OTP via Twilio REST API.

    Returns True  — SMS was dispatched successfully.
    Returns False — credentials not configured (development fallback allowed).
    Raises        — on API/network error in production.

    IMPORTANT: The OTP value is NEVER logged or returned to callers.
    """
    if not (TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN and TWILIO_FROM_NUMBER):
        if ENVIRONMENT == "production":
            raise RuntimeError(
                "Twilio credentials are not fully set. SMS delivery is not configured. "
                "Set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, and TWILIO_FROM_NUMBER in Render."
            )
        # Development: log a placeholder, never log the OTP itself
        print(f"[DEV SMS] Would send {purpose} OTP to {mobile_number} — configure Twilio for real delivery.")
        return False

    purpose_labels = {
        "email_verification": "Email",
        "mobile_verification": "Mobile",
        "password_reset": "Password Reset",
    }
    label = purpose_labels.get(purpose, "Verification")

    message_body = f"SkillVerse: Your {label} code is {otp}. It expires in 10 minutes. Do not share this code."

    try:
        response = http_requests.post(
            f"https://api.twilio.com/2010-04-01/Accounts/{TWILIO_ACCOUNT_SID}/Messages.json",
            auth=(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN),
            data={
                "From": TWILIO_FROM_NUMBER,
                "To": mobile_number,
                "Body": message_body,
            },
            timeout=10,
        )
        
        if response.status_code in (200, 201):
            return True
        
        # Log generic error, don't echo response body as it may contain sensitive info
        raise RuntimeError(f"Twilio API returned HTTP {response.status_code}. Check your credentials.")
        
    except http_requests.RequestException as exc:
        raise RuntimeError(f"SMS delivery failed (network error): {exc}") from exc
