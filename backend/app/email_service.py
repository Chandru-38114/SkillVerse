"""
email_service.py — Development email OTP delivery.

Logs the OTP to the backend terminal for testing.
Does NOT make external API calls.
"""

def send_otp_email(to_email: str, otp: str, purpose: str = "email_verification") -> bool:
    """
    Simulate sending an OTP email by logging it to the development terminal.
    
    Returns True - email was "dispatched" successfully.
    """
    if purpose == "password_reset":
        print(f"[DEV OTP] Password reset OTP for {to_email}: {otp}")
    else:
        print(f"[DEV OTP] Email OTP for {to_email}: {otp}")
    return True
