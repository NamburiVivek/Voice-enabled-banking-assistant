"""
routers/banking.py - Banking endpoints.
Includes recipient verification against the live Supabase users table,
and list of registered Voxa users for peer transfers.
"""
import logging
from typing import List
from pydantic import BaseModel, Field
from fastapi import APIRouter, HTTPException, Depends, status

from database import get_db
from dependencies import get_current_user

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/banking", tags=["banking"])


class VerifyRecipientRequest(BaseModel):
    identifier: str = Field(..., min_length=1, description="Recipient email or Voxa ID")


class RecipientResponse(BaseModel):
    id: str
    full_name: str
    email: str


class VoxaUserItem(BaseModel):
    id: str
    full_name: str
    email: str


@router.get(
    "/users",
    response_model=List[VoxaUserItem],
    summary="List other registered Voxa accounts for peer transfers",
)
async def get_voxa_users(current_user: dict = Depends(get_current_user)):
    """
    🔒 Returns other verified Voxa users in the database (excluding self).
    Used to populate quick beneficiaries and validate peer transfers.
    """
    db = get_db()
    try:
        res = (
            db.table("users")
            .select("id, full_name, email")
            .neq("id", current_user["id"])
            .limit(20)
            .execute()
        )
        return [VoxaUserItem(**u) for u in (res.data or [])]
    except Exception as e:
        logger.error("Error fetching Voxa users: %s", e)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Unable to fetch registered Voxa users.",
        )


@router.post(
    "/verify-recipient",
    response_model=RecipientResponse,
    summary="Verify if a recipient exists in the Voxa database",
)
async def verify_recipient(
    body: VerifyRecipientRequest,
    current_user: dict = Depends(get_current_user),
):
    """
    🔒 Ensures money transfers can ONLY be made to verified Voxa users in the database.
    Rejects self-transfers and nonexistent accounts.
    """
    target = body.identifier.strip().lower()

    if target == current_user.get("email", "").lower() or target == str(current_user.get("id")):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You cannot transfer money to your own account.",
        )

    db = get_db()

    import uuid

    # Try lookup by email first
    res = db.table("users").select("id, full_name, email").eq("email", target).execute()
    if not res.data:
        # If target is a valid UUID, look up by id
        try:
            val_uuid = str(uuid.UUID(target))
            res = db.table("users").select("id, full_name, email").eq("id", val_uuid).execute()
        except ValueError:
            pass

    if not res or not res.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Recipient not found. Transfers can ONLY be made to registered Voxa accounts in our database.",
        )

    recipient = res.data[0]
    return RecipientResponse(
        id=recipient["id"],
        full_name=recipient["full_name"],
        email=recipient["email"],
    )
