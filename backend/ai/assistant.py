"""
Full pipeline for VoxaBank Smart Banking Assistant:
voice/text -> Whisper STT -> High-Efficiency NLU (Intent + Sub-Intent + Slots)
           -> Intelligent Dialog Manager (VoxaBank business rules & mock bank)
           -> RBI RAG Retriever + Natural Conversational Responder -> gTTS -> Audio

Run web UI:   python assistant.py
Run CLI test: python assistant.py --cli
"""
import os
import re
import sys
import tempfile

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
if BASE_DIR not in sys.path:
    sys.path.insert(0, BASE_DIR)


if hasattr(sys.stdout, "reconfigure"):
    try:
        sys.stdout.reconfigure(encoding="utf-8")
    except Exception:
        pass

import numpy as np
import scipy.io.wavfile as wav
import scipy.signal
import torch

from banking import MockBank, handle
from nlu import NLU
from rag import RBIRetriever

SYSTEM = (
    "You are a friendly voice banking assistant for VoxaBank, an Indian bank. "
    "Reply in the language the user used (English, or Hinglish in Roman script). "
    "Reply in 1 to 3 short sentences that sound natural when spoken aloud. "
    "Use ONLY the 'Action result' for account facts and amounts, and ONLY the 'RBI context' for rules. "
    "If the context does not cover a rules question, say you are not sure and suggest contacting the bank. "
    "If the action result says to ask for details or confirmation, ask exactly that. "
    "Never invent numbers. No markdown, no emojis."
)


class Responder:
    """LLM 2 / Conversational Response Generator grounded strictly on Action Results & RBI Rules."""

    def __init__(self, name=None):
        self.llm_model = None
        self.tok = None
        # Check if user requested a heavy causal LM for LLM2
        if os.getenv("ENABLE_CAUSAL_LLM2") == "1":
            name = name or os.getenv("LLM2", "Qwen/Qwen2.5-1.5B-Instruct")
            dev = os.getenv("LLM2_DEVICE") or ("cuda" if torch.cuda.is_available() else "cpu")
            try:
                from transformers import AutoModelForCausalLM, AutoTokenizer
                print(f"[LLM2] Loading causal LM: {name} on {dev}...")
                dtype = torch.float16 if dev == "cuda" else torch.float32
                self.tok = AutoTokenizer.from_pretrained(name)
                self.llm_model = AutoModelForCausalLM.from_pretrained(
                    name, dtype=dtype, low_cpu_mem_usage=True
                ).to(dev).eval()
            except Exception as e:
                print(f"[LLM2] Notice: Could not load causal LM ({e}). Using native grounded synthesizer.")
                self.llm_model = None

    def synthesize(self, user_msg: str, facts: str, rbi_ctx: str, is_info: bool) -> str:
        """High-efficiency grounded response generator adhering to SYSTEM instructions."""
        facts_clean = (facts or "").strip()
        if facts_clean and not is_info:
            return facts_clean

        # RBI rule query
        if rbi_ctx and rbi_ctx != "(no relevant RBI rule found)":
            first_rule = rbi_ctx.split("\n")[0].lstrip("- *#").strip()
            if len(first_rule) > 15:
                return f"According to RBI guidelines, {first_rule} For complete details, please visit the official RBI portal or contact your branch."

        if facts_clean:
            return facts_clean

        return "I can help you with your account, transfers, cards, deposits, utility bills, and statements. For specialized regulations, please check with your VoxaBank branch."

    @torch.no_grad()
    def generate(self, user_msg: str, facts: str = "", rbi_ctx: str = "", is_info: bool = False) -> str:
        if self.llm_model and self.tok:
            try:
                text = self.tok.apply_chat_template(
                    [{"role": "system", "content": SYSTEM}, {"role": "user", "content": user_msg}],
                    tokenize=False,
                    add_generation_prompt=True,
                )
                enc = self.tok(text, return_tensors="pt").to(self.llm_model.device)
                out = self.llm_model.generate(
                    **enc, max_new_tokens=90, do_sample=False,
                    repetition_penalty=1.05, pad_token_id=self.tok.eos_token_id
                )
                gen = self.tok.decode(out[0][enc["input_ids"].shape[1] :], skip_special_tokens=True).strip()
                if gen:
                    return gen
            except Exception as e:
                print("[LLM2] Causal generation error, using grounded synthesizer:", e)

        return self.synthesize(user_msg, facts, rbi_ctx, is_info)


class Assistant:
    def __init__(self, load_stt=True):
        print("Loading NLU Engine...")
        BASE_DIR = os.path.dirname(os.path.abspath(__file__))
        fast_path = os.path.join(BASE_DIR, "models", "nlu_fast.pt")
        llm_path = os.path.join(BASE_DIR, "models", "llm1")
        model_target = os.getenv("NLU_MODEL", fast_path if os.path.exists(fast_path) else llm_path)
        self.nlu = NLU(model_target)

        print("Loading RBI Retriever...")
        self.rag = RBIRetriever(encoder=getattr(self.nlu, "encoder", None))

        print("Loading Conversational Responder...")
        self.llm2 = Responder()

        self.stt = None
        if load_stt:
            stt_model_name = os.getenv("STT_MODEL", "openai/whisper-tiny")
            print(f"Loading Whisper STT ({stt_model_name})...")
            try:
                from transformers import pipeline
                self.stt = pipeline(
                    "automatic-speech-recognition",
                    model=stt_model_name,
                    device=0 if torch.cuda.is_available() else -1,
                )
                print("Whisper STT ready.")
            except Exception as e:
                print(f"[STT] Warning: Could not initialize Whisper STT ({e}). Voice transcription will be skipped.")
                self.stt = None
        self.bank = MockBank()

    def transcribe(self, audio_input) -> str:
        if not self.stt or audio_input is None:
            return ""
        try:
            # If numpy tuple from Gradio: (sample_rate, data)
            if isinstance(audio_input, tuple):
                sr, data = audio_input
                if data is None or len(data) == 0:
                    return ""
                # Convert stereo to mono
                if len(data.shape) > 1:
                    data = data.mean(axis=-1)
                # Normalize to float32 (-1.0 to 1.0)
                if data.dtype == np.int16:
                    data = data.astype(np.float32) / 32768.0
                elif data.dtype == np.int32:
                    data = data.astype(np.float32) / 2147483648.0
                elif data.dtype != np.float32:
                    data = data.astype(np.float32)

                # Skip if total silence
                if np.max(np.abs(data)) < 0.005:
                    return ""

                # Resample to 16kHz if needed with scipy (no torchaudio or ffmpeg required)
                if sr != 16000:
                    num_samples = int(len(data) * 16000 / sr)
                    data = scipy.signal.resample(data, num_samples).astype(np.float32)

                res = self.stt({"raw": data, "sampling_rate": 16000}, generate_kwargs={"language": "en", "task": "transcribe"})
                return res.get("text", "").strip()

            # If filepath string
            if isinstance(audio_input, str) and os.path.exists(audio_input):
                sr, data = wav.read(audio_input)
                return self.transcribe((sr, data))

            # If dict format
            if isinstance(audio_input, dict):
                res = self.stt(audio_input, generate_kwargs={"language": "en", "task": "transcribe"})
                return res.get("text", "").strip()
        except Exception as e:
            print("[STT] Transcription error:", e)
        return ""

    @staticmethod
    def speak(text: str):
        try:
            from gtts import gTTS
            path = tempfile.NamedTemporaryFile(suffix=".mp3", delete=False).name
            gTTS(text, lang="en", tld="co.in").save(path)
            return path
        except Exception as e:
            return None

    def reply(self, text: str, session: dict) -> str:
        nlu_out = self.nlu.predict(text)
        intent = nlu_out.pop("intent")
        sub = nlu_out.pop("sub_intent", "none")
        if sub in ("upi_transfer", "imps_transfer", "neft_transfer", "rtgs_transfer") or any(w in text.lower().split() for w in ("transfer", "send")):
            if not any(b in text.lower() for b in ("electricity", "bescom", "gas", "broadband", "fiber", "mobile", "postpaid", "rent", "water", "bill")):
                intent = "transfer_money"
        result = handle(intent, sub, nlu_out, text, session, self.bank)

        hits = self.rag.search(f"{text} {result['intent']} {sub.replace('_', ' ')}", k=2)
        ctx = "\n---\n".join(c for _, c in hits) or "(no relevant RBI rule found)"
        msg = (
            f"RBI context:\n{ctx}\n\nUser said: {text}\nIntent: {result['intent']} / {sub}\n"
            f"Slots: {nlu_out}\nAction result: {result['facts']}\n\nReply:"
        )
        return self.llm2.generate(msg, facts=result["facts"], rbi_ctx=ctx, is_info=(result["status"] == "info"))

    def reply_structured(self, text: str, session: dict, bank=None) -> dict:
        if bank is None:
            bank = self.bank

        nlu_out = self.nlu.predict(text)
        intent = nlu_out.pop("intent")
        sub = nlu_out.pop("sub_intent", "none")
        if sub in ("upi_transfer", "imps_transfer", "neft_transfer", "rtgs_transfer") or any(w in text.lower().split() for w in ("transfer", "send")):
            if not any(b in text.lower() for b in ("electricity", "bescom", "gas", "broadband", "fiber", "mobile", "postpaid", "rent", "water", "bill")):
                intent = "transfer_money"
        slots_copy = dict(nlu_out)

        # Capture pending prior to handle
        prev_pending = session.get("pending")

        result = handle(intent, sub, nlu_out, text, session, bank)

        hits = self.rag.search(f"{text} {result.get('intent', intent)} {sub.replace('_', ' ')}", k=2)
        ctx = "\n---\n".join(c for _, c in hits) or "(no relevant RBI rule found)"
        msg = (
            f"RBI context:\n{ctx}\n\nUser said: {text}\nIntent: {result.get('intent', intent)} / {sub}\n"
            f"Slots: {slots_copy}\nAction result: {result['facts']}\n\nReply:"
        )
        bot_response = self.llm2.generate(msg, facts=result["facts"], rbi_ctx=ctx, is_info=(result["status"] == "info"))

        status = result.get("status", "ok")
        final_intent = result.get("intent", intent)
        action_payload = None

        if status == "confirm":
            pending = session.get("pending", {})
            kind = pending.get("kind", "")
            p_slots = pending.get("slots", {})
            if kind == "transfer":
                action_payload = {
                    "action": "TRANSFER_CONFIRMATION",
                    "recipient": p_slots.get("recipient") or slots_copy.get("recipient"),
                    "amount": p_slots.get("amount") or slots_copy.get("amount"),
                    "category": p_slots.get("category", "Peer Transfer"),
                    "memo": p_slots.get("memo", ""),
                }
            elif kind == "bill":
                action_payload = {
                    "action": "BILL_CONFIRMATION",
                    "biller": p_slots.get("biller") or slots_copy.get("biller"),
                    "amount": p_slots.get("amount") or slots_copy.get("amount"),
                }
            elif kind == "deposit":
                action_payload = {
                    "action": "DEPOSIT_CONFIRMATION",
                    "amount": p_slots.get("amount") or slots_copy.get("amount"),
                    "method": p_slots.get("payment_method", "UPI"),
                }
            elif kind in ("freeze_card", "block_card"):
                action_payload = {
                    "action": "FREEZE_CARD_CONFIRMATION",
                    "card_last4": bank.card.get("last4", "6656"),
                }
        elif status == "ok":
            if prev_pending:
                kind = prev_pending.get("kind", "")
                p_slots = prev_pending.get("slots", {})
                if kind == "transfer":
                    action_payload = {
                        "action": "TRANSFER_SUCCESS",
                        "recipient": p_slots.get("recipient"),
                        "recipient_id": p_slots.get("recipient_id"),
                        "recipient_name": p_slots.get("recipient_name"),
                        "recipient_email": p_slots.get("recipient_email"),
                        "amount": p_slots.get("amount"),
                        "category": p_slots.get("category", "Peer Transfer"),
                    }
                elif kind == "bill":
                    action_payload = {
                        "action": "BILL_SUCCESS",
                        "biller": p_slots.get("biller"),
                        "amount": p_slots.get("amount"),
                    }
                elif kind == "deposit":
                    action_payload = {
                        "action": "DEPOSIT_SUCCESS",
                        "amount": p_slots.get("amount"),
                        "method": p_slots.get("payment_method", "UPI"),
                    }
                elif kind in ("freeze_card", "block_card"):
                    action_payload = {
                        "action": "FREEZE_CARD",
                        "frozen": True,
                    }
            elif final_intent == "account_overview":
                if sub == "privacy_toggle" or "hide" in text.lower() or "mask" in text.lower() or "unhide" in text.lower():
                    action_payload = {
                        "action": "TOGGLE_PRIVACY",
                        "is_masked": bank.is_masked,
                    }
                else:
                    action_payload = {"action": "ACCOUNT_OVERVIEW"}
            elif final_intent == "card_management":
                if sub == "freeze_card":
                    action_payload = {"action": "FREEZE_CARD", "frozen": True}
                elif sub == "unfreeze_card":
                    action_payload = {"action": "UNFREEZE_CARD", "frozen": False}
                elif sub == "view_card_details":
                    action_payload = {"action": "VIEW_CARD_DETAILS"}
                elif sub == "channel_control":
                    txt = text.lower()
                    chan = "international"
                    if "domestic" in txt:
                        chan = "domestic"
                    elif "international" in txt or "forex" in txt or "cross-border" in txt:
                        chan = "international"
                    elif "online" in txt or "e-commerce" in txt or "ecommerce" in txt:
                        chan = "online"
                    elif "atm" in txt or "cash" in txt:
                        chan = "atm"
                    is_enable = not ("disable" in txt or "turn off" in txt or "switch off" in txt or "block" in txt or "stop" in txt)
                    action_payload = {
                        "action": "TOGGLE_CARD_CHANNEL",
                        "channel": chan,
                        "enabled": is_enable,
                    }
                elif sub == "set_spending_limit":
                    amt = slots_copy.get("amount")
                    lim_type = slots_copy.get("limit_type", "daily")
                    action_payload = {
                        "action": "SET_CARD_LIMIT",
                        "limit_type": lim_type,
                        "amount": amt,
                    }
            elif final_intent == "statement_analytics":
                if sub == "export_csv":
                    action_payload = {"action": "EXPORT_CSV"}
                elif sub == "print_statement":
                    action_payload = {"action": "PRINT_STATEMENT"}
                elif sub == "filter_transactions":
                    action_payload = {"action": "FILTER_TRANSACTIONS", "filter_type": slots_copy.get("filter_type", "credits")}
            elif final_intent == "banking_profile":
                if sub == "view_ifsc_account":
                    action_payload = {"action": "VIEW_ACCOUNT_DETAILS"}
                elif sub == "security_preferences":
                    txt = text.lower()
                    has_2fa = any(w in txt for w in ("2fa", "two-factor", "two factor", "second factor"))
                    has_email = any(w in txt for w in ("email", "alert", "alerts", "notification", "notifications"))
                    action_payload = {
                        "action": "TOGGLE_PREFERENCE",
                        "two_factor": bank.user.get("two_factor_auth"),
                        "email_alerts": bank.user.get("instant_email_alerts"),
                        "has_2fa": has_2fa,
                        "has_email": has_email,
                    }
        elif status == "cancelled":
            action_payload = {"action": "OPERATION_CANCELLED"}

        return {
            "transcript": text,
            "bot_response": bot_response,
            "intent": final_intent,
            "sub_intent": sub,
            "status": status,
            "action_payload": action_payload,
            "updated_balance": float(bank.savings),
            "is_masked": bank.is_masked,
        }



def cli():
    bot = Assistant(load_stt=False)
    session = {}
    print("\n" + "=" * 60)
    print("VoxaBank Smart Voice Assistant CLI (Type 'exit' to quit)")
    print("=" * 60)
    while True:
        try:
            inp = input("\nYou: ").strip()
            if not inp or inp.lower() in ("exit", "quit"):
                break
            resp = bot.reply(inp, session)
            print(f"Assistant: {resp}")
        except (KeyboardInterrupt, EOFError):
            break


def web():
    import gradio as gr
    bot = Assistant(load_stt=True)

    def run(audio, typed, session):
        text = typed.strip() if typed and typed.strip() else (bot.transcribe(audio) if audio else "")
        if not text:
            return "", "Please speak or type your request.", None, session
        resp = bot.reply(text, session)
        audio_out = bot.speak(resp)
        return text, resp, audio_out, session

    with gr.Blocks(title="VoxaBank Voice Assistant") as demo:
        gr.Markdown("## 🏦 VoxaBank Voice-Enabled Banking Assistant")
        state = gr.State({})
        with gr.Row():
            mic = gr.Audio(sources=["microphone"], type="numpy", label="Speak via Microphone")
            typed = gr.Textbox(label="...or type your banking query")
        btn = gr.Button("Submit Query", variant="primary")
        heard = gr.Textbox(label="Recognized Utterance")
        answer = gr.Textbox(label="Assistant Response")
        voice = gr.Audio(label="Spoken Output", autoplay=True)
        btn.click(run, [mic, typed, state], [heard, answer, voice, state])
    demo.launch()


if __name__ == "__main__":
    cli() if "--cli" in sys.argv else web()
