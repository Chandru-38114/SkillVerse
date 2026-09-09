import os
import smtplib
from email.message import EmailMessage

SMTP_SERVER = os.getenv("SMTP_SERVER", "smtp.gmail.com")
SMTP_PORT = int(os.getenv("SMTP_PORT", 587))
SMTP_USERNAME = os.getenv("SMTP_USERNAME")
SMTP_PASSWORD = os.getenv("SMTP_PASSWORD")
FROM_EMAIL = os.getenv("FROM_EMAIL", SMTP_USERNAME)

def send_otp_email(to_email: str, otp: str):
    """
    Sends an OTP to the specified email address.
    If credentials are not provided via environment variables, 
    it logs the OTP locally for development testing.
    """
    if not SMTP_USERNAME or not SMTP_PASSWORD:
        print("==================================================")
        print(f"[MOCK EMAIL] To: {to_email}")
        print(f"[MOCK EMAIL] Subject: SkillVerse Password Reset")
        print(f"[MOCK EMAIL] OTP: {otp}")
        print("==================================================")
        return

    msg = EmailMessage()
    msg['Subject'] = 'SkillVerse Password Reset OTP'
    msg['From'] = FROM_EMAIL
    msg['To'] = to_email
    
    msg.set_content(f"Your password reset OTP is: {otp}\n\nThis OTP will expire in 10 minutes.\nIf you did not request this, please ignore this email.")

    try:
        with smtplib.SMTP(SMTP_SERVER, SMTP_PORT) as server:
            server.starttls()
            server.login(SMTP_USERNAME, SMTP_PASSWORD)
            server.send_message(msg)
    except Exception as e:
        print(f"Failed to send email: {e}")
        # In a real app we might raise an error, but let's fail gracefully here
        pass
