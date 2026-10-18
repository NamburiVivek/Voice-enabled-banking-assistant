"""
routers/voice.py - Voice Assistant endpoints.
Connects the trained VoxaBank Voice AI pipeline (NLU + Dialog Manager + RBI RAG + LLM)
to the frontend with multi-turn session tracking and structured action payloads.
Dynamically synchronized with the live user account, balance, card, and database state.
"""
import logging
from typing import Optional, Dict, Any, List
from pydantic import BaseModel, Field
from fastapi import APIRouter, HTTPException, status

from ai.banking import MockBank

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/voice", tags=["voice"])

# Global singleton Assistant instance loaded on first startup
_assistant_instance: Optional[Any] = None


def get_assistant():
    global _assistant_instance
    if _assistant_instance is None:
        logger.info("[VoiceAPI] Initializing Assistant pipeline...")
        # STT is handled natively in the browser via Web Speech API or sent as text
        from ai.assistant import Assistant
        _assistant_instance = Assistant(load_stt=False)
        logger.info("[VoiceAPI] Assistant pipeline ready.")
    return _assistant_instance


# Multi-turn session state memory
_sessions: Dict[str, dict] = {}
_session_banks: Dict[str, MockBank] = {}


class VoiceChatRequest(BaseModel):
    query: str = Field(..., min_length=1, description="Text string from speech recognition or typed input")
    session_id: str = Field(default="default_session", description="Unique user session identifier")
    current_balance: Optional[float] = Field(default=None, description="Current dashboard account balance")
    user_name: Optional[str] = Field(default=None, description="User full name")
    user_email: Optional[str] = Field(default=None, description="User email")
    account_number: Optional[str] = Field(default=None, description="User account number")
    card: Optional[Dict[str, Any]] = Field(default=None, description="User card details")
    preferences: Optional[Dict[str, Any]] = Field(default=None, description="User notification and security preferences")
    transactions: Optional[List[Dict[str, Any]]] = Field(default=None, description="Recent ledger transactions")
    inflow: Optional[float] = Field(default=None, description="Total monthly inflow")
    outflow: Optional[float] = Field(default=None, description="Total monthly outflow")


class VoiceChatResponse(BaseModel):
    transcript: str
    bot_response: str
    intent: str
    sub_intent: str
    status: str
    action_payload: Optional[Dict[str, Any]] = None
    updated_balance: float
    is_masked: Optional[bool] = None
    preferences: Optional[Dict[str, Any]] = None


@router.post(
    "/chat",
    response_model=VoiceChatResponse,
    summary="Process voice or typed query through VoxaBank AI pipeline",
)
async def voice_chat(payload: VoiceChatRequest):
    """
    Exposes POST /api/voice/chat
    Processes user query with intent classification, slot extraction,
    dialog state management, and RBI-grounded response generation.
    Synchronizes live with user's balance, name, card, and database state.
    """
    try:
        assistant = get_assistant()

        # Initialize or retrieve user session
        sess_id = payload.session_id or "default_session"
        if sess_id not in _sessions:
            _sessions[sess_id] = {}
        if sess_id not in _session_banks:
            _session_banks[sess_id] = MockBank()

        bank = _session_banks[sess_id]

        # 1. Synchronize live account balance (both savings and current balance)
        if payload.current_balance is not None:
            bal = float(payload.current_balance)
            bank.savings = bal
            bank.current = bal

        # 2. Synchronize user profile & account info
        if payload.user_name:
            bank.user["name"] = payload.user_name
        if payload.user_email:
            bank.user["email"] = payload.user_email
        if payload.account_number:
            bank.user["account_number"] = payload.account_number

        # 3. Synchronize virtual debit card state
        if payload.card:
            if "last4" in payload.card:
                bank.card["last4"] = str(payload.card["last4"])
                bank.card["masked_number"] = f"4532 •••• •••• {payload.card['last4']}"
            if "cardNumber" in payload.card:
                bank.card["number"] = payload.card["cardNumber"]
            if "cvv" in payload.card:
                bank.card["cvv"] = payload.card["cvv"]
            if "expiry" in payload.card:
                bank.card["expiry"] = payload.card["expiry"]
            if "cardholder" in payload.card:
                bank.card["name"] = payload.card["cardholder"]
            if "frozen" in payload.card:
                bank.card["is_frozen"] = bool(payload.card["frozen"])
            if "dailyLimit" in payload.card:
                bank.card["daily_limit"] = float(payload.card["dailyLimit"])
            if "perTxLimit" in payload.card:
                bank.card["per_txn_limit"] = float(payload.card["perTxLimit"])
            for ch in ("domestic", "international", "online", "atm"):
                if ch in payload.card:
                    bank.card["channels"][ch] = bool(payload.card[ch])

        # 3b. Synchronize notification & security preferences
        if payload.preferences:
            if "emailAlerts" in payload.preferences:
                bank.user["instant_email_alerts"] = bool(payload.preferences["emailAlerts"])
            if "twoFactor" in payload.preferences:
                bank.user["two_factor_auth"] = bool(payload.preferences["twoFactor"])

        # 4. Synchronize live ledger transactions & analytics
        if payload.transactions is not None:
            bank.txns = [
                {
                    "date": t.get("date", "Today"),
                    "desc": t.get("name", "Transaction"),
                    "amount": float(t.get("amount", 0)),
                    "type": t.get("type", "debit"),
                    "ref": t.get("id", "TXN"),
                    "cat": t.get("category", "General"),
                }
                for t in payload.transactions
            ]
        if payload.inflow is not None:
            bank.inflow_override = float(payload.inflow)
        if payload.outflow is not None:
            bank.outflow_override = float(payload.outflow)

        # 5. Populate live registered beneficiaries strictly from Supabase (excluding current user)
        try:
            from database import get_db
            db = get_db()
            current_user_email = (payload.user_email or "").strip().lower()
            current_user_name = (payload.user_name or "").strip().lower()

            users_res = db.table("users").select("id, full_name, email").limit(100).execute()
            bank.beneficiaries = {}
            if users_res.data:
                for u in users_res.data:
                    u_email = u["email"].lower().strip()
                    u_name = u["full_name"].strip()
                    # Skip self to prevent self-transfers
                    if u_email == current_user_email or u_name.lower() == current_user_name:
                        continue

                    user_record = {
                        "name": u_name,
                        "vpa": u_email,
                        "acc": str(u["id"])[:8],
                        "bank": "VoxaBank",
                        "id": str(u["id"]),
                    }
                    first_name = u_name.split()[0].lower()
                    bank.beneficiaries[first_name] = user_record
                    bank.beneficiaries[u_name.lower()] = user_record
                    bank.beneficiaries[u_email] = user_record
        except Exception as e:
            logger.error("[VoiceAPI] Supabase beneficiary sync error: %s", e)

        session = _sessions[sess_id]

        # Process structured response
        res = assistant.reply_structured(payload.query.strip(), session, bank=bank)
        res["preferences"] = {
            "emailAlerts": bank.user.get("instant_email_alerts", True),
            "twoFactor": bank.user.get("two_factor_auth", True),
        }

        return VoiceChatResponse(**res)
    except Exception as e:
        logger.error("[VoiceAPI] Error processing query '%s': %s", payload.query, e, exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Voice assistant processing failed: {str(e)}",
        )


@router.post("/reset-session", summary="Reset dialogue state for a session")
async def reset_session(session_id: str = "default_session"):
    _sessions.pop(session_id, None)
    _session_banks.pop(session_id, None)
    return {"status": "ok", "message": f"Session '{session_id}' reset successfully"}
