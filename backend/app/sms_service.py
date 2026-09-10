import os

def send_sms_otp(mobile_number: str, otp: str) -> bool:
    """
    Returns True if an SMS was actually sent (if SMS provider integrated).
    Returns False if it fell back to development/mock mode.
    """
    # If a real provider (like Twilio) is configured here in the future:
    # return True on success, raise Exception on failure
    
    print("==================================================")
    print(f"[MOCK SMS] To: {mobile_number}")
    print(f"[MOCK SMS] SkillVerse Verification OTP: {otp}")
    print("==================================================")
    return False
