from django.contrib.auth.hashers import make_password, check_password
from django.contrib.auth import get_user_model

User = get_user_model()


def hash_password(password: str) -> str:
    return make_password(password)


def verify_password(plain: str, hashed: str) -> bool:
    return check_password(plain, hashed)


def validate_password_strength(password: str) -> tuple[bool, list[str]]:
    errors = []
    if len(password) < 8:
        errors.append("Mínimo 8 caracteres")
    if not any(c.isupper() for c in password):
        errors.append("Requiere mayúsculas")
    if not any(c.isdigit() for c in password):
        errors.append("Requiere números")
    return len(errors) == 0, errors

