from passlib.context import CryptContext
pwd_context = CryptContext(schemes=['bcrypt'], deprecated='auto')
try:
    pwd_context.verify('password', None)
    print('NO EXCEPTION')
except Exception as e:
    import traceback
    traceback.print_exc()
