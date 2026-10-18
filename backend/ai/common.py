"""
Shared helpers for VoxaBank NLU & Smart Banking:
- Prompt formatting and robust JSON parsing
- Multi-intent slot extraction covering all 7 VoxaBank Dashboard features:
  * Amounts (digits, currency symbols, and spoken English/Hinglish numbers)
  * Beneficiaries (names, relations, UPI VPAs, account numbers, mobile numbers)
  * P2P Transfer Categories & Memos (Peer Transfer, Rent & Housing, Dining & Food, Services & Work, Gifts, Other)
  * Deposit payment methods (UPI, NetBanking, IMPS, NEFT)
  * Card controls (freeze, unfreeze, daily/per-transaction limit sliders, channel switches)
  * Utility billers (Electricity & Gas, Broadband Fiber, Mobile Postpaid, Rent & Property)
  * Statement analytics (Inflow, Outflow, Net Cash Flow, Filter credits/debits, Search, Export CSV, Print)
  * Banking profile (IFSC VOXA0001824, Account Number, KYC status, Tier, 2FA, Email Alerts)
"""
import json
import re

PROMPT = (
    "### Task: Extract the banking intent, sub_intent and slots from the utterance as JSON.\n"
    "### Utterance: {text}\n"
    "### JSON:"
)

SLOT_INTENTS = {
    "transfer_money",
    "bill_payment",
    "deposit_funds",
    "card_management",
    "statement_analytics",
    "banking_profile",
    "account_overview",
    "check_balance",
}

BENEFICIARY_KEYS = ("recipient", "upi_id", "account_number", "mobile_number")


def build_prompt(text: str) -> str:
    return PROMPT.format(text=text.strip())


def parse_json(s: str) -> dict:
    """Robust JSON extractor that handles markdown fences, leading/trailing text, and nested structures."""
    if not s:
        return {"intent": "out_of_scope", "sub_intent": "none"}
    clean_s = re.sub(r"^```(?:json)?", "", s.strip(), flags=re.I)
    clean_s = re.sub(r"```$", "", clean_s.strip())
    start = clean_s.find("{")
    end = clean_s.rfind("}")
    if start != -1 and end != -1 and end > start:
        cand = clean_s[start : end + 1]
        try:
            d = json.loads(cand)
            if isinstance(d, dict):
                d.setdefault("intent", "out_of_scope")
                d.setdefault("sub_intent", "none")
                return d
        except json.JSONDecodeError:
            pass
    m = re.search(r"\{.*?\}", clean_s, re.S)
    if m:
        try:
            d = json.loads(m.group(0))
            if isinstance(d, dict):
                d.setdefault("intent", "out_of_scope")
                d.setdefault("sub_intent", "none")
                return d
        except json.JSONDecodeError:
            pass
    return {"intent": "out_of_scope", "sub_intent": "none"}


# ---------------------------------------------------------------- NUMBERS & AMOUNTS
_UNITS = {
    w: i
    for i, w in enumerate(
        "zero one two three four five six seven eight nine ten eleven twelve thirteen "
        "fourteen fifteen sixteen seventeen eighteen nineteen".split()
    )
}
_TENS = {w: 10 * (i + 2) for i, w in enumerate("twenty thirty forty fifty sixty seventy eighty ninety".split())}
_SCALE_W = {
    "hundred": 100,
    "thousand": 1000,
    "lakh": 100000,
    "lakhs": 100000,
    "lac": 100000,
    "lacs": 100000,
    "crore": 10000000,
    "crores": 10000000,
}


def words_to_number(text: str):
    """Converts spoken number words (e.g. 'five thousand', 'twenty five thousand') to int."""
    total = cur = 0
    found = False
    for w in re.findall(r"[a-z]+", text.lower()):
        if w in _UNITS:
            cur += _UNITS[w]
            found = True
        elif w in _TENS:
            cur += _TENS[w]
            found = True
        elif w == "hundred":
            cur = max(cur, 1) * 100
            found = True
        elif w in _SCALE_W:
            total += max(cur, 1) * _SCALE_W[w]
            cur = 0
            found = True
        elif w == "and" and found:
            continue
        elif found:
            break
    return (total + cur) if found else None


_SCALE = {
    "lakh": 1e5,
    "lakhs": 1e5,
    "lac": 1e5,
    "lacs": 1e5,
    "crore": 1e7,
    "crores": 1e7,
    "k": 1e3,
    "thousand": 1e3,
}
NUM_RE = re.compile(
    r"(?<![\w@.\-])(\d[\d,]*(?:\.\d+)?)\s*(lakhs?|lacs?|crores?|k|thousand)?(?![\w@])",
    re.I,
)
CUR_BEFORE = re.compile(r"(?:rs\.?|₹|inr)\s*$", re.I)
CUR_AFTER = re.compile(r"^\s*(?:rupees?|rs\b|/-)", re.I)
UNIT_AFTER = re.compile(
    r"^\s*-?\s*(?:minutes?|mins?|hours?|hrs?|days?|months?|years?|yrs?|grams?|gm|%|percent|"
    r"times?|emis?|installments?|ghante|saal|mahine)\b",
    re.I,
)
ID_BEFORE = re.compile(r"(?:ending|number|no\.?|policy|id|card|account|a/c)\s*:?\s*$", re.I)


def find_amount_span(text: str):
    """Returns (value, start, end) of the most likely money amount, or None."""
    cands = []
    for m in NUM_RE.finditer(text):
        raw = m.group(1).replace(",", "")
        try:
            val = float(raw)
        except ValueError:
            continue
        if m.group(2):
            val *= _SCALE[m.group(2).lower()]
        before, after = text[: m.start()], text[m.end() :]
        if m.group(2) or CUR_BEFORE.search(before) or CUR_AFTER.search(after):
            pri = 0
        elif ID_BEFORE.search(before) or UNIT_AFTER.search(after) or len(raw.split(".")[0]) >= 9:
            continue  # phone numbers, card numbers, accounts, durations
        else:
            pri = 1
        cands.append((pri, m.start(), int(val), m.end()))
    if cands:
        pri, start, val, end = sorted(cands)[0]
        return val, start, end
    if re.search(r"\b(hundred|thousand|lakhs?|lacs?|crores?)\b", text, re.I):
        v = words_to_number(text)
        if v:
            return v, 0, 0
    return None


def to_amount(v):
    if v is None:
        return None
    try:
        return int(float(str(v).replace(",", "").replace("Rs", "").replace("₹", "").strip()))
    except (ValueError, TypeError):
        return None


# ---------------------------------------------------------------- BENEFICIARIES & P2P
UPI_RE = re.compile(r"\b[\w.\-]+@[\w.\-]+\b", re.I)
MOBILE_RE = re.compile(r"(?<!\d)[6-9]\d{9}(?!\d)")
ACC_KW_RE = re.compile(r"(?:account\s*(?:number|no\.?)?|a/c)\s*:?\s*(\d{6,18})", re.I)
ACC_LONG_RE = re.compile(r"(?<!\d)\d{11,18}(?!\d)")
TO_NAME_RE = re.compile(r"\b(?:to|for|send\s*to|pay\s*to|transfer\s*to)\s+([A-Za-z]{2,})\b", re.I)
TO_REL_RE = re.compile(
    r"\bto\s+(?:my\s+)?(friend|sister|brother|wife|husband|mother|father|son|daughter|"
    r"vendor|supplier|contractor|landlord|shopkeeper)\b",
    re.I,
)
KNOWN_VOXA_USERS = [
    "Priya",
    "Ravi",
    "Amit",
    "Sneha",
    "Karthik",
    "Anita",
    "Suresh",
    "Divya",
    "Rahul",
    "Meena",
]
NOT_NAMES = {
    "hdfc", "sbi", "icici", "axis", "kotak", "jio", "airtel", "bsnl", "voxabank",
    "upi", "neft", "rtgs", "imps", "bescom", "cesc", "tneb", "lic", "friend",
    "another", "money", "rupees", "balance", "account", "card", "bill", "statement",
    "transfer", "send", "deposit", "pay", "payment", "overview", "details", "limit",
    "freeze", "unfreeze", "lock", "unlock", "kpi", "csv", "print", "settings", "kyc",
    "ifsc", "help", "hi", "hello", "yes", "no", "ok", "sure", "cancel", "stop", "exit"
}

# Transfer Categories
CATEGORIES = {
    "rent": "Rent & Housing",
    "housing": "Rent & Housing",
    "flat": "Rent & Housing",
    "society": "Rent & Housing",
    "dinner": "Dining & Food",
    "food": "Dining & Food",
    "lunch": "Dining & Food",
    "restaurant": "Dining & Food",
    "grocery": "Dining & Food",
    "work": "Services & Work",
    "services": "Services & Work",
    "consultancy": "Services & Work",
    "office": "Services & Work",
    "gift": "Gifts",
    "gifts": "Gifts",
    "birthday": "Gifts",
    "wedding": "Gifts",
    "peer": "Peer Transfer",
}

# ---------------------------------------------------------------- FEATURE SLOTS
METHOD_RE = re.compile(r"\b(upi|netbanking|internet\s*banking|imps|neft|google\s*pay|gpay|phonepe|paytm)\b", re.I)
CHANNEL_RE = re.compile(
    r"\b(international|forex|cross-border|domestic|pos|swipe|online|e-commerce|ecommerce|e-mandate|atm|cash\s*withdrawal)\b",
    re.I,
)
LIMIT_TYPE_RE = re.compile(r"\b(daily|per-transaction|per\s*transaction|single|per-swipe|transaction)\b", re.I)
ACTION_RE = re.compile(r"\b(freeze|unfreeze|lock|unlock|enable|disable|turn\s*on|turn\s*off|toggle)\b", re.I)
BILLER_RE = re.compile(
    r"\b(electricity|gas|broadband|fiber|internet|wi-fi|wifi|postpaid|rent|property|water|recharge|credit\s*card|insurance|bescom|mseb|tata\s*power|cesc|tneb|airtel|jio|act|bsnl)\b",
    re.I,
)
FORMAT_RE = re.compile(r"\b(csv|excel|spreadsheet|pdf|print)\b", re.I)
FILTER_RE = re.compile(r"\b(credits?|debits?|incoming|outgoing|all)\b", re.I)
METRIC_RE = re.compile(r"\b(inflow|outflow|net\s*cash\s*flow|cash\s*flow|kpi|total\s*credits?|total\s*debits?)\b", re.I)


def extract_slots(text: str, intent: str = None) -> dict:
    """Extracts all domain-relevant slots according to VoxaBank Dashboard features."""
    s, rest = {}, text

    # UPI VPA
    m = UPI_RE.search(rest)
    if m:
        s["upi_id"] = m.group(0).lower()
        s["recipient"] = m.group(0).lower()
        rest = rest.replace(m.group(0), " ")

    # Account Number
    m = ACC_KW_RE.search(rest)
    if m:
        s["account_number"] = m.group(1)
        rest = rest.replace(m.group(1), " ")
    else:
        m = ACC_LONG_RE.search(rest)
        if m and "account_number" not in s:
            s["account_number"] = m.group(0)
            rest = rest.replace(m.group(0), " ")

    # Mobile Number
    m = MOBILE_RE.search(rest)
    if m:
        s["mobile_number"] = m.group(0)
        rest = rest.replace(m.group(0), " ")

    # Amount
    amt = find_amount_span(rest)
    if amt:
        s["amount"] = amt[0]

    # Recipient
    if re.search(r"\b(myself|self|my\s*own\s*account|me)\b", text, re.I):
        s["recipient"] = "myself"
    elif "recipient" not in s:
        for name in KNOWN_VOXA_USERS:
            if re.search(rf"\b{name}\b", text, re.I):
                s["recipient"] = name
                break
        if "recipient" not in s:
            m = TO_NAME_RE.search(text)
            if m and m.group(1).lower() not in NOT_NAMES:
                s["recipient"] = m.group(1).title()
            else:
                m = TO_REL_RE.search(text)
                if m:
                    s["recipient"] = m.group(1).lower()
        if "recipient" not in s:
            cleaned_word = re.sub(r"^(?:to|for|send\s+to|pay\s+to|transfer\s+to)\s+", "", text.strip(), flags=re.I).strip()
            words = cleaned_word.lower().split()
            if cleaned_word and len(words) <= 2 and not any(w in NOT_NAMES for w in words) and not any(c.isdigit() for c in cleaned_word):
                s["recipient"] = cleaned_word.title()

    # Category for P2P transfers
    for k, cat in CATEGORIES.items():
        if re.search(rf"\b{k}\b", text, re.I):
            s["category"] = cat
            break

    # Memo
    memo_m = re.search(r"\b(?:memo|for|tagged\s*as|with\s*note)\s+([A-Za-z0-9\s]+?)(?:\s+(?:via|using|from|to|Rs|\d)|$)", text, re.I)
    if memo_m and "category" not in s:
        memo_cand = memo_m.group(1).strip()
        if len(memo_cand.split()) <= 4 and memo_cand.lower() not in NOT_NAMES:
            s["memo"] = memo_cand

    # Deposit Method
    m = METHOD_RE.search(text)
    if m:
        raw_m = m.group(1).lower()
        if "upi" in raw_m or "pay" in raw_m:
            s["payment_method"] = "UPI"
        elif "netbanking" in raw_m or "internet" in raw_m:
            s["payment_method"] = "NetBanking"
        elif "imps" in raw_m:
            s["payment_method"] = "IMPS"
        elif "neft" in raw_m:
            s["payment_method"] = "NEFT"

    # Card Channel & Action
    ch_m = CHANNEL_RE.search(text)
    if ch_m:
        raw_ch = ch_m.group(1).lower()
        if "inter" in raw_ch or "forex" in raw_ch or "cross" in raw_ch:
            s["channel"] = "international"
        elif "domest" in raw_ch or "pos" in raw_ch or "swipe" in raw_ch:
            s["channel"] = "domestic"
        elif "online" in raw_ch or "commerce" in raw_ch or "mandate" in raw_ch:
            s["channel"] = "online"
        elif "atm" in raw_ch or "cash" in raw_ch:
            s["channel"] = "atm"

    act_m = ACTION_RE.search(text)
    if act_m:
        s["action"] = act_m.group(1).lower()

    lim_m = LIMIT_TYPE_RE.search(text)
    if lim_m:
        raw_lim = lim_m.group(1).lower()
        s["limit_type"] = "daily" if "daily" in raw_lim else "per_transaction"

    # Billers
    bil_m = BILLER_RE.search(text)
    if bil_m:
        raw_b = bil_m.group(1).lower()
        if "electr" in raw_b or "gas" in raw_b or "power" in raw_b or "bescom" in raw_b:
            s["biller"] = "Electricity & Gas"
        elif "broad" in raw_b or "fiber" in raw_b or "wi-fi" in raw_b or "wifi" in raw_b:
            s["biller"] = "Broadband Fiber"
        elif "postpaid" in raw_b:
            s["biller"] = "Mobile Postpaid"
        elif "rent" in raw_b or "property" in raw_b:
            s["biller"] = "Rent & Property"

    # Statement Filters / Formats
    fmt_m = FORMAT_RE.search(text)
    if fmt_m:
        s["format"] = "csv" if "csv" in fmt_m.group(1).lower() or "excel" in fmt_m.group(1).lower() else "print"

    flt_m = FILTER_RE.search(text)
    if flt_m:
        s["filter_type"] = flt_m.group(1).lower()

    met_m = METRIC_RE.search(text)
    if met_m:
        s["metric"] = met_m.group(1).lower()

    return s


def slots_for_intent(intent: str, text: str) -> dict:
    if intent in SLOT_INTENTS:
        return extract_slots(text, intent=intent)
    return {}
