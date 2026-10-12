"""
routers/auth.py - Authentication endpoints.
Includes: register, login, refresh, logout, /me (protected).
"""
import logging
from datetime import datetime, timezone

from fastapi import APIRouter, HTTPException, Request, status, Depends

logger = logging.getLogger(__name__)
from config import get_settings
from database import get_db
from dependencies import get_current_user
from schemas import (
    AuthResponse,
    ChangePasswordRequest,
    LoginRequest,
    MessageResponse,
    RefreshRequest,
    RegisterRequest,
    TokenResponse,
    UserResponse,
)
from security import (
    create_access_token,
    create_refresh_token,
    decode_token,
    hash_password,
    verify_password,
)
from jose import JWTError
from slowapi import Limiter
from slowapi.util import get_remote_address

router = APIRouter(prefix="/api/auth", tags=["auth"])
settings = get_settings()
# Use a limiter bound to no default limits — main.py app-level limiter handles global limits.
# We create this only for route-specific overrides; it won't read .env at import time
# because we pass default_limits=[] explicitly.
limiter = Limiter(key_func=get_remote_address, default_limits=[])


# ── Register ──────────────────────────────────────────────────────────────────

@router.post(
    "/register",
    response_model=AuthResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create a new user account",
)
@limiter.limit(settings.RATE_LIMIT_REGISTER)
async def register(request: Request, body: RegisterRequest):
    """
    🔒 Rate-limited (3/min).
    Creates a new user with a bcrypt-hashed password.
    Returns access + refresh tokens on success.
    """
    db = get_db()

    try:
        # 🔒 Check for existing email
        existing = db.table("users").select("id").eq("email", body.email).execute()
        if existing.data:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="An account with this email already exists.",
            )

        # 🔒 Hash password — never store plaintext
        hashed = hash_password(body.password)
        now = datetime.now(timezone.utc).isoformat()

        result = db.table("users").insert({
            "full_name": body.full_name,
            "email": body.email,
            "password_hash": hashed,
            "created_at": now,
            "updated_at": now,
        }).execute()

    except HTTPException:
        raise  # re-raise 409 etc.
    except Exception as e:
        logger.error("Register Supabase error: %s", e, exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Database error. Have you run the SQL schema in Supabase? Check server logs.",
        )

    if not result.data:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Account creation failed. Please try again.",
        )

    user = result.data[0]
    access_token = create_access_token(user["id"], user["email"])
    refresh_token = create_refresh_token(user["id"])

    return AuthResponse(
        user=UserResponse(
            id=user["id"],
            full_name=user["full_name"],
            email=user["email"],
            created_at=user["created_at"],
        ),
        tokens=TokenResponse(
            access_token=access_token,
            refresh_token=refresh_token,
        ),
    )


# ── Login ─────────────────────────────────────────────────────────────────────

@router.post(
    "/login",
    response_model=AuthResponse,
    summary="Login with email and password",
)
@limiter.limit(settings.RATE_LIMIT_LOGIN)
async def login(request: Request, body: LoginRequest):
    """
    🔒 Rate-limited (5/min).
    Uses timing-safe comparison via passlib — prevents timing attacks.
    Returns the same generic error for wrong email OR wrong password (no enumeration).
    """
    db = get_db()

    result = db.table("users").select("*").eq("email", body.email).execute()

    # 🔒 Always run password verification even if user not found (prevent timing attack)
    _DUMMY_HASH = "$2b$12$eImiTXuWVxfM37uY4JANjQ.LsR9h5FRDS1rCMvBfUfvFxE1mA5V5C"
    user = result.data[0] if result.data else None
    stored_hash = user["password_hash"] if user else _DUMMY_HASH

    if not verify_password(body.password, stored_hash) or user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password.",   # 🔒 No enumeration
        )

    access_token = create_access_token(user["id"], user["email"])
    refresh_token = create_refresh_token(user["id"])

    return AuthResponse(
        user=UserResponse(
            id=user["id"],
            full_name=user["full_name"],
            email=user["email"],
            created_at=user["created_at"],
        ),
        tokens=TokenResponse(
            access_token=access_token,
            refresh_token=refresh_token,
        ),
    )


# ── Token Refresh ─────────────────────────────────────────────────────────────

@router.post(
    "/refresh",
    response_model=TokenResponse,
    summary="Refresh access token using refresh token",
)
@limiter.limit("10/minute")
async def refresh_tokens(request: Request, body: RefreshRequest):
    """🔒 Validates refresh token, issues new access + refresh token pair."""
    creds_exc = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Invalid or expired refresh token.",
    )
    try:
        payload = decode_token(body.refresh_token)
        if payload.get("type") != "refresh":
            raise creds_exc
        user_id: str = payload["sub"]
    except JWTError:
        raise creds_exc

    db = get_db()
    result = db.table("users").select("id, email").eq("id", user_id).execute()
    if not result.data:
        raise creds_exc

    user = result.data[0]
    return TokenResponse(
        access_token=create_access_token(user["id"], user["email"]),
        refresh_token=create_refresh_token(user["id"]),
    )


# ── Current User ──────────────────────────────────────────────────────────────

@router.get(
    "/me",
    response_model=UserResponse,
    summary="Get the currently authenticated user",
)
async def get_me(current_user: dict = Depends(get_current_user)):
    """🔒 Protected route — requires valid Bearer access token."""
    return UserResponse(**current_user)


# ── Logout (client-side) ──────────────────────────────────────────────────────

@router.post(
    "/logout",
    response_model=MessageResponse,
    summary="Logout (client discards tokens)",
)
async def logout(_: dict = Depends(get_current_user)):
    """
    Stateless logout — instructs the client to discard tokens.
    For full token revocation, implement a Redis blacklist.
    """
    return MessageResponse(message="Logged out successfully. Please discard your tokens.")


# ── Change Password ───────────────────────────────────────────────────────────

@router.post(
    "/change-password",
    response_model=MessageResponse,
    summary="Change user password (authenticated)",
)
async def change_password(
    body: ChangePasswordRequest,
    current_user: dict = Depends(get_current_user),
):
    """🔒 Verifies current password and sets new bcrypt-hashed password in database."""
    db = get_db()
    result = db.table("users").select("password_hash").eq("id", current_user["id"]).execute()
    if not result.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User record not found.",
        )

    user_row = result.data[0]
    if not verify_password(body.current_password, user_row["password_hash"]):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Current password is incorrect.",
        )

    new_hash = hash_password(body.new_password)
    now = datetime.now(timezone.utc).isoformat()
    db.table("users").update({
        "password_hash": new_hash,
        "updated_at": now,
    }).eq("id", current_user["id"]).execute()

    return MessageResponse(message="Your password has been changed successfully.")

