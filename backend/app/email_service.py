import os
from . import config
import smtplib
from email.message import EmailMessage

SMTP_SERVER = os.getenv("SMTP_SERVER", "smtp.gmail.com")
SMTP_PORT = int(os.getenv("SMTP_PORT", 587))
SMTP_USERNAME = os.getenv("SMTP_USERNAME")
SMTP_PASSWORD = os.getenv("SMTP_PASSWORD")
FROM_EMAIL = os.getenv("FROM_EMAIL", SMTP_USERNAME)

def send_otp_email(to_email: str, otp: str, subject: str = 'SkillVerse OTP') -> bool:
    """
    Returns True if an email was actually sent.
    Returns False if it fell back to development/mock mode.
    Raises Exception if SMTP fails.
    """
    if not SMTP_USERNAME or not SMTP_PASSWORD:
        print("==================================================")
        print(f"[MOCK EMAIL] To: {to_email}")
        print(f"[MOCK EMAIL] Subject: {subject}")
        print(f"[MOCK EMAIL] OTP: {otp}")
        print("==================================================")
        return False

    msg = EmailMessage()
    msg['Subject'] = subject
    msg['From'] = FROM_EMAIL
    msg['To'] = to_email
    
    msg.set_content(f"Your OTP is: {otp}\n\nThis OTP will expire in 10 minutes.\nIf you did not request this, please ignore this email.")

    try:
        with smtplib.SMTP(SMTP_SERVER, SMTP_PORT) as server:
            server.starttls()
            server.login(SMTP_USERNAME, SMTP_PASSWORD)
            server.send_message(msg)
        return True
    except Exception as e:
        print(f"Failed to send email: {e}")
        raise e

