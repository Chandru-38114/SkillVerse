import re

with open("backend/app/schemas.py", "r", encoding="utf-8") as f:
    content = f.read()

# Make sure re is imported
if "import re" not in content:
    content = "import re\n" + content
    
# Replace UserCreate
user_create_pattern = re.compile(r"class UserCreate\(BaseModel\):.*?return self", re.DOTALL)
new_user_create = """class UserCreate(BaseModel):
    name: str
    email: EmailStr
    mobile_number: str
    college: str
    dob: dt.date
    gender: str
    password: str
    confirm_password: str
    country: Optional[str] = ""

    @model_validator(mode='after')
    def check_passwords_match(self):
        if self.password != self.confirm_password:
            raise ValueError('Passwords do not match')
        pw = self.password
        if len(pw) < 6 or not re.search(r'[A-Z]', pw) or not re.search(r'[a-z]', pw) or not re.search(r'[0-9]', pw) or not re.search(r'[^a-zA-Z0-9]', pw):
            raise ValueError('Password must contain at least 6 characters, one uppercase letter, one lowercase letter, one number, and one special character.')
        return self"""
content = user_create_pattern.sub(new_user_create, content)

# Replace ResetPassword
reset_pw_pattern = re.compile(r"class ResetPassword\(BaseModel\):\n    email: EmailStr\n    otp: str\n    new_password: str", re.DOTALL)
new_reset_pw = """from pydantic import field_validator
class ResetPassword(BaseModel):
    email: EmailStr
    otp: str
    new_password: str

    @field_validator('new_password')
    @classmethod
    def validate_strength(cls, v: str) -> str:
        if len(v) < 6 or not re.search(r'[A-Z]', v) or not re.search(r'[a-z]', v) or not re.search(r'[0-9]', v) or not re.search(r'[^a-zA-Z0-9]', v):
            raise ValueError('Password must contain at least 6 characters, one uppercase letter, one lowercase letter, one number, and one special character.')
        return v"""
content = reset_pw_pattern.sub(new_reset_pw, content)

with open("backend/app/schemas.py", "w", encoding="utf-8") as f:
    f.write(content)
