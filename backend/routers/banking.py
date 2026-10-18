"""
routers/banking.py - Banking endpoints backed by live Supabase persistence.
Handles:
1. Recipient verification across registered users (email, name, UUID)
2. List of registered Voxa users for peer transfers
3. Real-time server-backed peer transfers (debit sender & credit recipient in database)
4. Deposit funds & utility bill payments with database transaction logging
5. Live account ledger & balance calculation (survives cross-browser, cross-device, incognito)
"""
import logging
import time
import uuid
from datetime import datetime
from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field
from fastapi import APIRouter, HTTPException, Depends, status

from database import get_db
from dependencies import get_current_user

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/banking", tags=["banking"])


# ─── Request & Response Models ────────────────────────────────────────────────

class VerifyRecipientRequest(BaseModel):
    identifier: str = Field(..., min_length=1, description="Recipient email, full name, or Voxa ID")


class RecipientResponse(BaseModel):
    id: str
    full_name: str
    email: str


class VoxaUserItem(BaseModel):
    id: str
    full_name: str
    email: str


class TransferRequest(BaseModel):
    recipient: str = Field(..., min_length=1, description="Recipient email, full name, or Voxa ID")
    amount: float = Field(..., gt=0, description="Transfer amount in INR (greater than 0)")
    category: Optional[str] = Field(default="Peer Transfer", description="Transaction category")
    note: Optional[str] = Field(default=None, description="Optional note or memo")


class TransferResponse(BaseModel):
    success: bool
    ref_id: str
    recipient: str
    recipient_id: str
    amount: float
    category: str
    date: str
    new_balance: float


class DepositRequest(BaseModel):
    amount: float = Field(..., gt=0, description="Deposit amount in INR")
    method: Optional[str] = Field(default="UPI", description="Payment method: UPI, NetBanking, IMPS, NEFT")


class BillPayRequest(BaseModel):
    amount: float = Field(..., gt=0, description="Bill payment amount in INR")
    biller: str = Field(..., min_length=1, description="Biller name / category")


class BalanceSyncRequest(BaseModel):
    balance: float = Field(default=0.0, ge=0, description="Existing local balance to sync if server ledger empty")


class AccountStateResponse(BaseModel):
    balance: float
    transactions: List[Dict[str, Any]]
    user_id: str
    full_name: str
    email: str


# ─── Helpers: Recipient Lookup & Ledger Calculation ───────────────────────────

def find_recipient_in_db(identifier: str, current_user_id: str) -> dict:
    """
    Looks up a recipient in Supabase `users` by:
    1. Exact email
    2. Exact UUID
    3. Name pattern (case-insensitive substring)
    4. Email pattern (case-insensitive substring)
    Excludes the current user to prevent self-transfers.
    """
    target = identifier.strip()
    if not target:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Recipient identifier is required.")

    db = get_db()

    # 1. Exact email match
    res = db.table("users").select("id, full_name, email").eq("email", target.lower()).execute()

    # 2. UUID match if valid UUID string
    if not res.data:
        try:
            val_uuid = str(uuid.UUID(target))
            res = db.table("users").select("id, full_name, email").eq("id", val_uuid).execute()
        except ValueError:
            pass

    # 3. Name substring match
    if not res.data:
        res = db.table("users").select("id, full_name, email").ilike("full_name", f"%{target}%").execute()

    # 4. Email substring match
    if not res.data:
        res = db.table("users").select("id, full_name, email").ilike("email", f"%{target.lower()}%").execute()

    candidates = [u for u in (res.data or []) if str(u["id"]) != str(current_user_id)]

    if not candidates:
        if res.data and any(str(u["id"]) == str(current_user_id) for u in res.data):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="You cannot transfer money to your own account.",
            )
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Recipient '{identifier}' not found in Voxa database.",
        )

    return candidates[0]


def calculate_user_ledger(user_id: str):
    """
    Calculates user's live balance and transaction history directly from Supabase `audit_log`.
    Guarantees cross-browser, cross-device, and real-time balance consistency.
    """
    db = get_db()
    try:
        res = (
            db.table("audit_log")
            .select("id, event_type, metadata, created_at")
            .eq("user_id", user_id)
            .in_("event_type", ["TRANSFER_DEBIT", "TRANSFER_CREDIT", "DEPOSIT", "BILL_PAY", "BALANCE_SYNC"])
            .order("created_at", desc=False)
            .execute()
        )
        rows = res.data or []
    except Exception as e:
        logger.error("Ledger calculation error for user %s: %s", user_id, e)
        rows = []

    balance = 0.0
    for row in rows:
        meta = row.get("metadata") or {}
        amt = float(meta.get("amount", 0.0))
        tx_type = meta.get("type")
        if not tx_type:
            tx_type = "credit" if row["event_type"] in ("TRANSFER_CREDIT", "DEPOSIT", "BALANCE_SYNC") else "debit"

        if tx_type == "credit":
            balance += amt
        else:
            balance = max(0.0, balance - amt)

    formatted_txs = []
    for row in reversed(rows):
        meta = row.get("metadata") or {}
        amt = float(meta.get("amount", 0.0))
        tx_type = meta.get("type", "credit" if row["event_type"] in ("TRANSFER_CREDIT", "DEPOSIT", "BALANCE_SYNC") else "debit")
        formatted_txs.append({
            "id": meta.get("ref") or f"TXN-{row['id']}",
            "name": meta.get("name") or row["event_type"],
            "date": meta.get("date") or "Today",
            "amount": amt if tx_type == "credit" else -amt,
            "type": tx_type,
            "category": meta.get("category", "General"),
            "status": meta.get("status", "Completed"),
            "ref": meta.get("ref") or f"TXN-{row['id']}",
        })

    return round(balance, 2), formatted_txs


# ─── Endpoints ────────────────────────────────────────────────────────────────

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
    Supports email, name, or UUID. Rejects self-transfers.
    """
    recipient = find_recipient_in_db(body.identifier, current_user["id"])
    return RecipientResponse(
        id=recipient["id"],
        full_name=recipient["full_name"],
        email=recipient["email"],
    )


@router.get(
    "/account",
    response_model=AccountStateResponse,
    summary="Get user's live persistent balance and transaction history",
)
async def get_account_state(current_user: dict = Depends(get_current_user)):
    """
    🔒 Returns the authenticated user's current account balance and full transaction ledger,
    reconstructed directly from the live database audit log.
    """
    balance, txs = calculate_user_ledger(current_user["id"])
    return AccountStateResponse(
        balance=balance,
        transactions=txs,
        user_id=str(current_user["id"]),
        full_name=current_user["full_name"],
        email=current_user["email"],
    )


@router.post(
    "/transfer",
    response_model=TransferResponse,
    summary="Execute peer transfer: debits sender and credits recipient in database",
)
async def execute_transfer(
    body: TransferRequest,
    current_user: dict = Depends(get_current_user),
):
    """
    🔒 Executes a real peer transfer between two verified Voxa accounts in the database.
    1. Verifies recipient exists in Supabase users table (excluding self).
    2. Validates sender has sufficient funds in their database ledger.
    3. Creates TRANSFER_DEBIT audit record for sender.
    4. Creates TRANSFER_CREDIT audit record for recipient.
    Both accounts are instantly updated across all browsers, sessions, and devices.
    """
    recipient = find_recipient_in_db(body.recipient, current_user["id"])
    sender_balance, _ = calculate_user_ledger(current_user["id"])

    if body.amount > sender_balance:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Insufficient balance (₹{sender_balance:,.2f}). Please deposit funds first.",
        )

    ref_id = f"TXN-VOX-{int(time.time() * 1000):X}"
    date_str = f"Today, {datetime.now().strftime('%I:%M %p')}"
    category = body.category or "Peer Transfer"
    db = get_db()

    try:
        # 1. Debit sender in database
        db.table("audit_log").insert({
            "user_id": current_user["id"],
            "event_type": "TRANSFER_DEBIT",
            "metadata": {
                "amount": body.amount,
                "name": f"Transfer to {recipient['full_name']} ({recipient['email']})",
                "date": date_str,
                "type": "debit",
                "category": category,
                "status": "Completed",
                "ref": ref_id,
                "recipient_id": recipient["id"],
                "recipient_name": recipient["full_name"],
                "recipient_email": recipient["email"],
                "note": body.note or "",
            },
        }).execute()

        # 2. Credit recipient in database
        db.table("audit_log").insert({
            "user_id": recipient["id"],
            "event_type": "TRANSFER_CREDIT",
            "metadata": {
                "amount": body.amount,
                "name": f"Received from {current_user['full_name']} ({current_user['email']})",
                "date": date_str,
                "type": "credit",
                "category": category,
                "status": "Completed",
                "ref": ref_id,
                "sender_id": current_user["id"],
                "sender_name": current_user["full_name"],
                "sender_email": current_user["email"],
                "note": body.note or "",
            },
        }).execute()

    except Exception as e:
        logger.error("Failed to commit transfer to database: %s", e)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Transfer execution failed due to database error.",
        )

    new_sender_balance = round(sender_balance - body.amount, 2)

    return TransferResponse(
        success=True,
        ref_id=ref_id,
        recipient=f"{recipient['full_name']} ({recipient['email']})",
        recipient_id=str(recipient["id"]),
        amount=body.amount,
        category=category,
        date=date_str,
        new_balance=new_sender_balance,
    )


@router.post(
    "/deposit",
    summary="Deposit funds into user account",
)
async def execute_deposit(
    body: DepositRequest,
    current_user: dict = Depends(get_current_user),
):
    """
    🔒 Adds deposited funds into user's live database ledger with 0% fees.
    """
    ref_id = f"TXN-DEP-{int(time.time() * 1000):X}"
    date_str = f"Today, {datetime.now().strftime('%I:%M %p')}"
    db = get_db()

    try:
        db.table("audit_log").insert({
            "user_id": current_user["id"],
            "event_type": "DEPOSIT",
            "metadata": {
                "amount": body.amount,
                "name": f"Deposit via {body.method}",
                "date": date_str,
                "type": "credit",
                "category": "Deposit",
                "status": "Completed",
                "ref": ref_id,
                "method": body.method,
            },
        }).execute()
    except Exception as e:
        logger.error("Failed to record deposit: %s", e)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to record deposit.",
        )

    new_balance, txs = calculate_user_ledger(current_user["id"])
    return {
        "success": True,
        "ref_id": ref_id,
        "amount": body.amount,
        "new_balance": new_balance,
        "date": date_str,
    }


@router.post(
    "/bill-pay",
    summary="Pay utility bill",
)
async def execute_bill_pay(
    body: BillPayRequest,
    current_user: dict = Depends(get_current_user),
):
    """
    🔒 Deducts utility bill payment from user's live database ledger.
    """
    balance, _ = calculate_user_ledger(current_user["id"])
    if body.amount > balance:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Insufficient balance (₹{balance:,.2f}) to pay {body.biller}.",
        )

    ref_id = f"TXN-BILL-{int(time.time() * 1000):X}"
    date_str = f"Today, {datetime.now().strftime('%I:%M %p')}"
    db = get_db()

    try:
        db.table("audit_log").insert({
            "user_id": current_user["id"],
            "event_type": "BILL_PAY",
            "metadata": {
                "amount": body.amount,
                "name": f"Bill Payment — {body.biller}",
                "date": date_str,
                "type": "debit",
                "category": "Utilities",
                "status": "Completed",
                "ref": ref_id,
                "biller": body.biller,
            },
        }).execute()
    except Exception as e:
        logger.error("Failed to record bill payment: %s", e)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to process bill payment.",
        )

    new_balance, txs = calculate_user_ledger(current_user["id"])
    return {
        "success": True,
        "ref_id": ref_id,
        "amount": body.amount,
        "new_balance": new_balance,
        "date": date_str,
    }


@router.post(
    "/sync",
    summary="Synchronize client initial balance to server ledger if empty",
)
async def sync_initial_state(
    body: BalanceSyncRequest,
    current_user: dict = Depends(get_current_user),
):
    """
    🔒 Seamless migration helper: if a user already deposited funds in localStorage,
    this initializes their server-side database ledger so their funds are never lost.
    """
    balance, txs = calculate_user_ledger(current_user["id"])
    if len(txs) == 0 and body.balance > 0:
        db = get_db()
        ref_id = f"TXN-DEP-{int(time.time() * 1000):X}"
        date_str = f"Today, {datetime.now().strftime('%I:%M %p')}"
        try:
            db.table("audit_log").insert({
                "user_id": current_user["id"],
                "event_type": "BALANCE_SYNC",
                "metadata": {
                    "amount": body.balance,
                    "name": "Opening Balance / Previous Deposit",
                    "date": date_str,
                    "type": "credit",
                    "category": "Deposit",
                    "status": "Completed",
                    "ref": ref_id,
                    "method": "Account Migration",
                },
            }).execute()
            balance = body.balance
        except Exception as e:
            logger.error("Initial balance sync error: %s", e)

    return {"balance": balance, "transactions_count": len(txs)}
