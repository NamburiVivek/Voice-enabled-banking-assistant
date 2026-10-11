"""
dependencies.py - FastAPI dependency injection helpers.
Extracts and validates the current user from the Authorization header.
"""
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError

from database import get_db
from security import decode_token

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login")


async def get_current_user(token: str = Depends(oauth2_scheme)) -> dict:
    """
    🔒 Dependency: validates JWT, fetches the user row from Supabase.
    Raises 401 on any token error — never leaks the reason.
    """
    credentials_exc = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials.",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = decode_token(token)
        user_id: str = payload.get("sub")
        token_type: str = payload.get("type")
        if not user_id or token_type != "access":
            raise credentials_exc
    except JWTError:
        raise credentials_exc

    db = get_db()
    result = db.table("users").select("id, full_name, email, created_at").eq("id", user_id).single().execute()

    if not result.data:
        raise credentials_exc

    return result.data
