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
from ai.voice_biometrics import get_biometrics_engine

import threading

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/voice", tags=["voice"])

# Global singleton Assistant instance loaded on startup / first request
_assistant_instance: Optional[Any] = None
_assistant_lock = threading.Lock()


def get_assistant():
    global _assistant_instance
    if _assistant_instance is None:
        with _assistant_lock:
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
    user_id: Optional[str] = Field(default=None, description="Unique User ID for biometric verification")
    account_number: Optional[str] = Field(default=None, description="User account number")
    card: Optional[Dict[str, Any]] = Field(default=None, description="User card details")
    preferences: Optional[Dict[str, Any]] = Field(default=None, description="User notification and security preferences")
    transactions: Optional[List[Dict[str, Any]]] = Field(default=None, description="Recent ledger transactions")
    inflow: Optional[float] = Field(default=None, description="Total monthly inflow")
    outflow: Optional[float] = Field(default=None, description="Total monthly outflow")
    audio_base64: Optional[str] = Field(default=None, description="Optional Base64-encoded audio WAV recording for speaker verification")


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
    card: Optional[Dict[str, Any]] = None


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

        # Cache spoken audio in session if sent in this turn
        if payload.audio_base64 and len(payload.audio_base64.strip()) > 100:
            session["last_valid_audio_base64"] = payload.audio_base64

        # Process structured response
        res = assistant.reply_structured(payload.query.strip(), session, bank=bank)
        res["preferences"] = {
            "emailAlerts": bool(bank.user.get("instant_email_alerts", True)),
            "twoFactor": bool(bank.user.get("two_factor_auth", True)),
        }
        res["card"] = {
            "cardNumber": bank.card.get("number", "4532 8901 3412 6656"),
            "last4": bank.card.get("last4", "6656"),
            "expiry": bank.card.get("expiry", "08/29"),
            "cvv": bank.card.get("cvv", "829"),
            "cardholder": bank.card.get("name") or bank.user.get("name", "VOXA MEMBER"),
            "dailyLimit": float(bank.card.get("daily_limit", 50000)),
            "perTxLimit": float(bank.card.get("per_txn_limit", 25000)),
            "domestic": bool(bank.card.get("channels", {}).get("domestic", True)),
            "international": bool(bank.card.get("channels", {}).get("international", False)),
            "online": bool(bank.card.get("channels", {}).get("online", True)),
            "atm": bool(bank.card.get("channels", {}).get("atm", True)),
            "frozen": bool(bank.card.get("is_frozen", False)),
        }

        # ── Voice Biometrics Security Check for Transfers ──────────────────
        action = (res.get("action_payload") or {}).get("action")
        user_key = payload.user_id or payload.user_email or sess_id
        biometrics_engine = get_biometrics_engine()
        bio_status = biometrics_engine.get_status(user_key)

        if action == "TRANSFER_SUCCESS" and bio_status.get("has_voiceprint") and bio_status.get("voice_locked_transfers"):
            # Accept audio from the confirmation turn or the initiating speech turn
            audio_to_verify = payload.audio_base64 or session.get("last_valid_audio_base64")
            if audio_to_verify:
                verify_res = biometrics_engine.verify_speaker(user_key, audio_to_verify)
                if not verify_res.get("verified"):
                    # Voice biometric mismatch! Block transfer!
                    logger.warning("[VoiceBiometrics] Unauthorized speaker attempted transfer: %s", verify_res)
                    session.pop("last_valid_audio_base64", None)
                    res["status"] = "voice_auth_failed"
                    res["action_payload"] = {
                        "action": "VOICE_AUTH_FAILED",
                        "similarity": verify_res.get("similarity", 0.0),
                        "confidence": verify_res.get("confidence", 0),
                        "reason": "Voice signature mismatch. Speaker does not match enrolled account owner.",
                    }
                    min_req = int(verify_res.get("threshold", 0.72) * 100)
                    res["bot_response"] = (
                        f"Voice biometric authentication failed ({verify_res.get('confidence', 0)}% match, minimum {min_req}% required). "
                        "Only the enrolled account owner's voice can authorize transfers. Transaction blocked."
                    )
                else:
                    # Verified successfully! Clear cached audio for security
                    session.pop("last_valid_audio_base64", None)
            else:
                # Audio recording missing on voice-locked account
                res["status"] = "voice_auth_required"
                res["action_payload"] = {
                    "action": "VOICE_AUTH_REQUIRED",
                    "reason": "Live voice signature required to dispatch funds.",
                }
                res["bot_response"] = (
                    "Voice Lock is active for your account. Please speak your transfer command via microphone "
                    "so your biometric voiceprint can be authenticated."
                )

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


# ── Voice Biometrics Endpoints ────────────────────────────────────────────────

class VoiceEnrollRequest(BaseModel):
    user_id: str = Field(..., description="Unique user identifier")
    audio_base64: str = Field(..., description="Base64 encoded WAV audio of speaker sample")
    user_email: Optional[str] = Field(default="")
    user_name: Optional[str] = Field(default="")


class VoiceVerifyRequest(BaseModel):
    user_id: str = Field(..., description="Unique user identifier")
    audio_base64: str = Field(..., description="Base64 encoded WAV audio to verify against enrolled voiceprint")
    threshold: Optional[float] = Field(default=0.70, description="Cosine similarity threshold")


class VoiceLockToggleRequest(BaseModel):
    user_id: str = Field(..., description="Unique user identifier")
    enabled: bool = Field(..., description="Enable or disable voice lock for transfers")


@router.post("/biometrics/enroll", summary="Enroll or update a user voiceprint")
async def enroll_voiceprint(body: VoiceEnrollRequest):
    """Enrolls a user voiceprint by extracting acoustic Mel-filterbank embeddings."""
    engine = get_biometrics_engine()
    try:
        result = engine.enroll_voiceprint(
            user_id=body.user_id,
            audio_input=body.audio_base64,
            user_email=body.user_email,
            user_name=body.user_name,
        )
        return result
    except Exception as e:
        logger.error("[VoiceBiometrics] Enrollment failed: %s", e)
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.post("/biometrics/verify", summary="Verify live audio against enrolled voiceprint")
async def verify_voiceprint(body: VoiceVerifyRequest):
    """Compares incoming speech audio against the enrolled voiceprint vector."""
    engine = get_biometrics_engine()
    try:
        result = engine.verify_speaker(
            user_id=body.user_id,
            audio_input=body.audio_base64,
            threshold=body.threshold,
        )
        return result
    except Exception as e:
        logger.error("[VoiceBiometrics] Verification failed: %s", e)
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.get("/biometrics/status", summary="Get voiceprint enrollment and lock status")
async def get_biometric_status(user_id: str):
    """Returns whether voiceprint is active and transfer lock is enabled."""
    engine = get_biometrics_engine()
    return engine.get_status(user_id)


@router.post("/biometrics/toggle-lock", summary="Toggle voice lock for transfers")
async def toggle_voice_lock(body: VoiceLockToggleRequest):
    """Enables or disables voiceprint requirement for fund transfers."""
    engine = get_biometrics_engine()
    return engine.toggle_voice_lock(body.user_id, body.enabled)


@router.delete("/biometrics/voiceprint", summary="Delete enrolled voiceprint")
async def delete_voiceprint(user_id: str):
    """Deletes the stored voiceprint for a user."""
    engine = get_biometrics_engine()
    success = engine.delete_voiceprint(user_id)
    return {"success": success, "message": "Voiceprint removed successfully."}
