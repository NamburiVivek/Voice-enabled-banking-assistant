"""
schemas.py - Pydantic request/response models with strict validation.
Input sanitisation happens at this layer — do not skip validation.
"""
import re
from pydantic import BaseModel, EmailStr, Field, field_validator, model_validator


# ── Shared validators ─────────────────────────────────────────────────────────

SAFE_NAME_RE = re.compile(r"^[\w\s\-'\.]{1,80}$")  # only printable safe chars
PASSWORD_MIN_LEN = 8

# Regex: at least 1 uppercase, 1 lowercase, 1 digit, 1 special char
PASSWORD_RE = re.compile(
    r"^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&^#\-_])[A-Za-z\d@$!%*?&^#\-_]{8,128}$"
)


def _sanitise_str(v: str) -> str:
    """Strip leading/trailing whitespace and normalise internal spaces."""
    return " ".join(v.strip().split())


# ── Register ──────────────────────────────────────────────────────────────────

class RegisterRequest(BaseModel):
    full_name: str = Field(..., min_length=2, max_length=80)
    email: EmailStr
    password: str = Field(..., min_length=PASSWORD_MIN_LEN, max_length=128)
    confirm_password: str = Field(..., min_length=PASSWORD_MIN_LEN, max_length=128)

    @field_validator("full_name", mode="before")
    @classmethod
    def validate_name(cls, v: str) -> str:
        v = _sanitise_str(v)
        if not SAFE_NAME_RE.match(v):
            raise ValueError("Name contains invalid characters.")
        return v

    @field_validator("email", mode="before")
    @classmethod
    def lower_email(cls, v: str) -> str:
        return v.strip().lower()

    @field_validator("password")
    @classmethod
    def strong_password(cls, v: str) -> str:
        if not PASSWORD_RE.match(v):
            raise ValueError(
                "Password must be 8-128 characters and include uppercase, lowercase, "
                "a digit, and a special character (@$!%*?&^#-_)."
            )
        return v

    @model_validator(mode="after")
    def passwords_match(self) -> "RegisterRequest":
        if self.password != self.confirm_password:
            raise ValueError("Passwords do not match.")
        return self


# ── Login ─────────────────────────────────────────────────────────────────────

class LoginRequest(BaseModel):
    email: EmailStr
    password: str = Field(..., min_length=1, max_length=128)

    @field_validator("email", mode="before")
    @classmethod
    def lower_email(cls, v: str) -> str:
        return v.strip().lower()


# ── Refresh Token ─────────────────────────────────────────────────────────────

class RefreshRequest(BaseModel):
    refresh_token: str = Field(..., min_length=1)


# ── Change Password ───────────────────────────────────────────────────────────

class ChangePasswordRequest(BaseModel):
    current_password: str = Field(..., min_length=1, max_length=128)
    new_password: str = Field(..., min_length=PASSWORD_MIN_LEN, max_length=128)
    confirm_new_password: str = Field(..., min_length=PASSWORD_MIN_LEN, max_length=128)

    @field_validator("new_password")
    @classmethod
    def strong_new_password(cls, v: str) -> str:
        if not PASSWORD_RE.match(v):
            raise ValueError(
                "New password must be 8-128 characters and include uppercase, lowercase, "
                "a digit, and a special character (@$!%*?&^#-_)."
            )
        return v

    @model_validator(mode="after")
    def new_passwords_match(self) -> "ChangePasswordRequest":
        if self.new_password != self.confirm_new_password:
            raise ValueError("New passwords do not match.")
        return self


# ── Responses ─────────────────────────────────────────────────────────────────

class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"


class UserResponse(BaseModel):
    id: str
    full_name: str
    email: str
    created_at: str

    model_config = {"from_attributes": True}


class AuthResponse(BaseModel):
    user: UserResponse
    tokens: TokenResponse


class MessageResponse(BaseModel):
    message: str


class ErrorResponse(BaseModel):
    detail: str
